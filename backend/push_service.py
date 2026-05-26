"""Firebase Cloud Messaging (FCM) integration for Marsol MMS.

Public API:
    - init_firebase(): one-time SDK bootstrap (idempotent)
    - send_push(tokens, title, body, data, link): fan-out push notification
    - cleanup_invalid_tokens(): remove stale tokens from MongoDB

Token storage:
    push_tokens collection — { user_id, user_name, token, platform, created_at, last_used_at }
    Each user can hold multiple tokens (multi-device).
"""

import logging
import os
from datetime import datetime, timezone
from typing import Iterable, List, Optional, Sequence

import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

_initialized = False


def init_firebase() -> bool:
    """Initialize Firebase Admin SDK once. Returns True if usable, False otherwise.

    Two credential sources are supported (in priority order):
      1. FIREBASE_ADMIN_JSON  — raw JSON content as a single env var (preferred
         on Render / Heroku / Vercel where the file system is ephemeral and
         secrets are managed via env vars)
      2. FIREBASE_ADMIN_JSON_PATH — absolute path to the service-account JSON
         on disk (suitable for self-hosted servers / docker volumes)
    """
    global _initialized
    if _initialized:
        return True
    if firebase_admin._apps:
        _initialized = True
        return True

    cred = None
    raw_json = os.environ.get("FIREBASE_ADMIN_JSON", "").strip()
    if raw_json:
        try:
            import json
            info = json.loads(raw_json)
            cred = credentials.Certificate(info)
        except Exception as exc:
            logger.error("Failed to parse FIREBASE_ADMIN_JSON env var: %s", exc)
    if cred is None:
        path = os.environ.get("FIREBASE_ADMIN_JSON_PATH")
        if path and os.path.exists(path):
            try:
                cred = credentials.Certificate(path)
            except Exception as exc:
                logger.error("Failed to read FIREBASE_ADMIN_JSON_PATH: %s", exc)
    if cred is None:
        logger.warning("Firebase Admin credentials not configured (set FIREBASE_ADMIN_JSON or FIREBASE_ADMIN_JSON_PATH)")
        return False
    try:
        firebase_admin.initialize_app(cred)
        _initialized = True
        logger.info("Firebase Admin SDK initialized")
        return True
    except Exception as exc:
        logger.error("Firebase init failed: %s", exc)
        return False


async def send_push(
    db,
    tokens: Sequence[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
    link: Optional[str] = None,
) -> dict:
    """Send a single notification to up to 500 tokens in one call.

    Returns: { success: int, failure: int, invalid: [token, ...] }
    Invalid tokens are removed from the database automatically.
    """
    if not init_firebase():
        return {"success": 0, "failure": 0, "invalid": [], "skipped": True}
    tokens = [t for t in tokens if t]
    if not tokens:
        return {"success": 0, "failure": 0, "invalid": []}

    # FCM HTTP v1 caps multicast at 500 tokens — chunk just in case
    invalid: List[str] = []
    success = 0
    failure = 0
    payload_data = {k: str(v) for k, v in (data or {}).items() if v is not None}
    if link:
        payload_data["link"] = link

    for start in range(0, len(tokens), 500):
        batch = tokens[start : start + 500]
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title[:200], body=body[:500]),
            data=payload_data,
            tokens=batch,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title[:200],
                    body=body[:500],
                    icon="/icon-192.png",
                    badge="/favicon-64.png",
                ),
                fcm_options=messaging.WebpushFCMOptions(link=link or "/dashboard"),
            ),
        )
        try:
            resp = messaging.send_each_for_multicast(message)
            success += resp.success_count
            failure += resp.failure_count
            for idx, r in enumerate(resp.responses):
                if r.success:
                    continue
                code = (r.exception and getattr(r.exception, "code", "") or "").lower()
                # Stale / invalid registration → drop from DB
                if any(s in str(r.exception) for s in ("registration-token-not-registered", "invalid-registration-token", "INVALID_ARGUMENT")):
                    invalid.append(batch[idx])
                elif "404" in str(r.exception) or "not-found" in code:
                    invalid.append(batch[idx])
        except Exception as exc:
            logger.error("FCM send failed: %s", exc)
            failure += len(batch)

    if invalid:
        try:
            await db.push_tokens.delete_many({"token": {"$in": invalid}})
        except Exception as exc:
            logger.error("Failed to prune invalid tokens: %s", exc)
    return {"success": success, "failure": failure, "invalid": invalid}


async def push_to_users(
    db,
    user_names: Iterable[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
    link: Optional[str] = None,
) -> dict:
    """Resolve user names → tokens → send_push. Skips if no tokens registered."""
    names = [n for n in (user_names or []) if n]
    if not names:
        return {"success": 0, "failure": 0, "invalid": [], "no_recipients": True}
    rows = await db.push_tokens.find(
        {"user_name": {"$in": names}}, {"_id": 0, "token": 1}
    ).to_list(2000)
    tokens = list({r["token"] for r in rows if r.get("token")})
    if not tokens:
        return {"success": 0, "failure": 0, "invalid": [], "no_tokens": True}
    return await send_push(db, tokens, title, body, data, link)
