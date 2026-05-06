"""Mailchimp Marketing API client (httpx, async).

Uses HTTP Basic auth with `anystring:apikey`. Datacenter is extracted from the
key suffix (e.g. `-us18`).
"""
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx

MAILCHIMP_API_KEY = os.environ.get("MAILCHIMP_API_KEY", "")
MAILCHIMP_LABEL = os.environ.get("MAILCHIMP_LABEL", "MMS")


def _datacenter() -> str:
    if not MAILCHIMP_API_KEY or "-" not in MAILCHIMP_API_KEY:
        return ""
    return MAILCHIMP_API_KEY.rsplit("-", 1)[-1]


def _base_url() -> str:
    dc = _datacenter()
    if not dc:
        return ""
    return f"https://{dc}.api.mailchimp.com/3.0"


def _auth() -> httpx.BasicAuth:
    return httpx.BasicAuth(username=MAILCHIMP_LABEL or "anystring", password=MAILCHIMP_API_KEY)


async def _request(method: str, path: str, **kwargs) -> Dict[str, Any]:
    if not MAILCHIMP_API_KEY:
        return {"ok": False, "error": "Mailchimp credentials not configured"}
    url = f"{_base_url()}{path}"
    try:
        async with httpx.AsyncClient(auth=_auth(), timeout=httpx.Timeout(30.0)) as client:
            r = await client.request(method, url, **kwargs)
            if r.status_code >= 400:
                try:
                    err = r.json()
                except Exception:
                    err = {"detail": r.text}
                return {"ok": False, "status": r.status_code, "error": err.get("title") or err.get("detail") or "Mailchimp xətası", "raw": err}
            return {"ok": True, "data": r.json() if r.content else {}}
    except Exception as e:
        return {"ok": False, "error": f"HTTP error: {e}"}


async def ping() -> Dict[str, Any]:
    res = await _request("GET", "/")
    if res.get("ok"):
        d = res["data"]
        return {"ok": True, "account": d.get("account_name") or d.get("login", {}).get("login_name"), "datacenter": _datacenter(), "label": MAILCHIMP_LABEL}
    return res


async def list_audiences(count: int = 20, offset: int = 0) -> Dict[str, Any]:
    res = await _request("GET", "/lists", params={"count": count, "offset": offset})
    if not res.get("ok"):
        return res
    d = res["data"]
    return {
        "ok": True,
        "total": d.get("total_items", 0),
        "audiences": [
            {"id": a["id"], "name": a.get("name", ""), "member_count": (a.get("stats") or {}).get("member_count", 0)}
            for a in d.get("lists", [])
        ],
    }


async def add_member(audience_id: str, email: str, first_name: str = "", last_name: str = "", company: str = "", status: str = "subscribed") -> Dict[str, Any]:
    payload = {
        "email_address": email,
        "status": status,
        "merge_fields": {"FNAME": first_name, "LNAME": last_name, "COMPANY": company},
    }
    return await _request("POST", f"/lists/{audience_id}/members", json=payload)


async def upsert_member(audience_id: str, email: str, first_name: str = "", last_name: str = "", company: str = "") -> Dict[str, Any]:
    """PUT — adds OR updates by email-MD5 hash. Idempotent."""
    import hashlib
    sub_hash = hashlib.md5(email.lower().strip().encode()).hexdigest()
    payload = {
        "email_address": email,
        "status_if_new": "subscribed",
        "merge_fields": {"FNAME": first_name, "LNAME": last_name, "COMPANY": company},
    }
    return await _request("PUT", f"/lists/{audience_id}/members/{sub_hash}", json=payload)


async def create_campaign(audience_id: str, subject: str, title: str, from_name: str, reply_to: str, preview_text: str = "") -> Dict[str, Any]:
    payload = {
        "type": "regular",
        "recipients": {"list_id": audience_id},
        "settings": {
            "subject_line": subject,
            "preview_text": preview_text,
            "title": title,
            "from_name": from_name,
            "reply_to": reply_to,
        },
    }
    return await _request("POST", "/campaigns", json=payload)


async def set_campaign_content(campaign_id: str, html: str, plain_text: str = "") -> Dict[str, Any]:
    return await _request("PUT", f"/campaigns/{campaign_id}/content", json={"html": html, "plain_text": plain_text or "Bu e-mail HTML formatındadır."})


async def send_campaign(campaign_id: str) -> Dict[str, Any]:
    return await _request("POST", f"/campaigns/{campaign_id}/actions/send")


async def list_campaigns(count: int = 20, offset: int = 0, status: Optional[str] = None) -> Dict[str, Any]:
    params = {"count": count, "offset": offset, "sort_field": "send_time", "sort_dir": "DESC"}
    if status:
        params["status"] = status
    res = await _request("GET", "/campaigns", params=params)
    if not res.get("ok"):
        return res
    d = res["data"]
    return {
        "ok": True,
        "total": d.get("total_items", 0),
        "campaigns": [
            {
                "id": c["id"],
                "title": (c.get("settings") or {}).get("title", ""),
                "subject": (c.get("settings") or {}).get("subject_line", ""),
                "status": c.get("status", ""),
                "send_time": c.get("send_time", ""),
                "emails_sent": c.get("emails_sent", 0),
                "list_id": (c.get("recipients") or {}).get("list_id", ""),
                "list_name": (c.get("recipients") or {}).get("list_name", ""),
            }
            for c in d.get("campaigns", [])
        ],
    }


async def get_campaign_report(campaign_id: str) -> Dict[str, Any]:
    res = await _request("GET", f"/reports/{campaign_id}")
    if not res.get("ok"):
        return res
    r = res["data"]
    opens = r.get("opens", {}) if isinstance(r.get("opens"), dict) else {}
    clicks = r.get("clicks", {}) if isinstance(r.get("clicks"), dict) else {}
    return {
        "ok": True,
        "stats": {
            "emails_sent": r.get("emails_sent", 0),
            "opens": opens.get("opens_total", r.get("opens", 0) if isinstance(r.get("opens"), int) else 0),
            "open_rate": opens.get("open_rate", 0),
            "unique_opens": opens.get("unique_opens", 0),
            "clicks": clicks.get("clicks_total", 0),
            "click_rate": clicks.get("click_rate", 0),
            "unsubscribes": r.get("unsubscribed", 0),
            "bounces": ((r.get("bounces") or {}).get("hard_bounces", 0) + (r.get("bounces") or {}).get("soft_bounces", 0)) if isinstance(r.get("bounces"), dict) else 0,
        },
    }
