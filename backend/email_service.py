"""Email notification service for Marsol ERP via Resend.

All notifications are mirrored to admin (ADMIN_EMAIL env), and additional
recipients (curator, assignee, etc.) are notified when the event is relevant
to them.

Sending is non-blocking via asyncio.to_thread so the API request does not wait.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Iterable, Optional

import resend

logger = logging.getLogger(__name__)

resend.api_key = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")


def _clean_emails(emails: Iterable[Optional[str]]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for e in emails:
        if not e:
            continue
        e = str(e).strip().lower()
        if "@" not in e or e in seen:
            continue
        seen.add(e)
        out.append(e)
    return out


def _wrap_html(title: str, body_html: str) -> str:
    """Wrap content in a simple branded email template (table layout, inline CSS)."""
    return f"""
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f1f5f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background:#3D4F6F;padding:18px 24px;color:#ffffff;font-size:16px;font-weight:bold;">Marsol Group MMS</td></tr>
      <tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6;">
        <h2 style="margin:0 0 12px;color:#3D4F6F;font-size:18px;">{title}</h2>
        {body_html}
      </td></tr>
      <tr><td style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;">Bu avtomatik bildirişdir — Marsol Group İdarəetmə Sistemi.</td></tr>
    </table>
  </td></tr>
</table>
""".strip()


async def send_email(to: list[str] | str, subject: str, html: str) -> bool:
    """Send a single email (non-blocking). Returns True on success."""
    if not resend.api_key:
        logger.warning("RESEND_API_KEY missing — skipping email '%s'", subject)
        return False
    recipients = _clean_emails([to] if isinstance(to, str) else to)
    if not recipients:
        return False
    params = {"from": SENDER_EMAIL, "to": recipients, "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info("Email sent (id=%s) to %s", (result or {}).get("id"), recipients)
        return True
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        return False


async def notify(
    *,
    title: str,
    body_html: str,
    extra_recipients: Iterable[Optional[str]] = (),
    subject: Optional[str] = None,
) -> bool:
    """Compose + send a notification email.

    The admin is always added. Extra recipients (curator, assignee, etc.) are
    deduplicated and merged. Failure is logged but never raised — emails are
    fire-and-forget so user-facing actions are not blocked.
    Returns True on success.
    """
    recipients = _clean_emails([ADMIN_EMAIL, *extra_recipients])
    if not recipients:
        return False
    html = _wrap_html(title, body_html)
    return await send_email(recipients, subject or title, html)
