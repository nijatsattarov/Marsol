"""LSIM Quick SMS API client + SMS log helpers.

Docs: https://apps.lsim.az/quicksms/v1
Auth: MD5( md5(password) + LOGIN + MSG_BODY + MSISDN + SENDER )
"""
import hashlib
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import httpx

LSIM_LOGIN = os.environ.get("LSIM_LOGIN", "")
LSIM_PASSWORD = os.environ.get("LSIM_PASSWORD", "")
LSIM_SENDER = os.environ.get("LSIM_SENDER", "MARSOL")
LSIM_BASE_URL = os.environ.get("LSIM_BASE_URL", "https://apps.lsim.az/quicksms/v1").rstrip("/")

LSIM_REPORT_STATUS = {
    100: "Növbədə",
    101: "Çatdırıldı",
    102: "Çatdırılmadı",
    103: "Vaxtı keçdi",
    104: "Rədd edildi",
    105: "Ləğv edildi",
    106: "Xəta",
    107: "Naməlum",
    108: "Göndərildi",
    109: "Qara siyahı",
}

LSIM_ERROR_TEXT = {
    -100: "Yanlış açar",
    -101: "Mətn icazə verilən uzunluqdan çoxdur",
    -102: "Yanlış nömrə formatı",
    -103: "Yanlış sender adı (təsdiqlənməyib)",
    -104: "Balans kifayət deyil",
    -105: "Nömrə qara siyahıdadır",
    -106: "Yanlış əməliyyat ID",
    -107: "IP ünvanına icazə verilməyib",
    -108: "Yanlış hash",
    -109: "Host yoxdur",
    -110: "Hesabat limiti aşıldı",
    -500: "Daxili xəta",
}


def normalize_phone(phone: str) -> Optional[str]:
    """Convert any AZ phone format → 994XXXXXXXXX (12 digits, no '+').
    Returns None if number is unrecognisable.
    """
    if not phone:
        return None
    digits = re.sub(r"\D+", "", str(phone))
    if not digits:
        return None
    if digits.startswith("994") and len(digits) == 12:
        return digits
    if digits.startswith("0") and len(digits) == 10:  # 0XX XXX XX XX
        return "994" + digits[1:]
    if len(digits) == 9:  # 50 XXX XX XX (no leading 0)
        return "994" + digits
    if digits.startswith("994"):
        return digits  # let provider validate
    # Other countries — pass through (provider rejects if not allowed)
    return digits


def _md5(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def _send_key(login: str, password: str, msg: str, msisdn: str, sender: str) -> str:
    """LSIM /send hash: md5( md5(password) + LOGIN + MSG_BODY + MSISDN + SENDER )."""
    return _md5(_md5(password) + login + msg + msisdn + sender)


def _balance_key(login: str, password: str) -> str:
    return _md5(_md5(password) + login)


def _is_unicode(text: str) -> bool:
    """LSIM expects unicode=true if message contains non-GSM 03.38 chars
    (Azerbaijani diacritics: ə, ı, ş, ç, ğ, ö, ü...)."""
    try:
        text.encode("ascii")
        return False
    except (UnicodeEncodeError, AttributeError):
        return True


async def lsim_send_sms(phone: str, text: str, sender: Optional[str] = None) -> Dict[str, Any]:
    """Send a single SMS. Returns dict {ok, transid, error_code, error_message, raw}."""
    sender = sender or LSIM_SENDER
    if not LSIM_LOGIN or not LSIM_PASSWORD:
        return {"ok": False, "error_message": "LSIM credentials not configured", "transid": None}
    msisdn = normalize_phone(phone)
    if not msisdn:
        return {"ok": False, "error_message": "Yanlış telefon nömrəsi", "transid": None}
    key = _send_key(LSIM_LOGIN, LSIM_PASSWORD, text, msisdn, sender)
    payload = {
        "login": LSIM_LOGIN,
        "key": key,
        "msisdn": msisdn,
        "text": text,
        "sender": sender,
        "scheduled": "NOW",
        "unicode": _is_unicode(text),
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(f"{LSIM_BASE_URL}/smssender", json=payload)
            data = r.json()
    except Exception as e:
        return {"ok": False, "error_message": f"HTTP error: {e}", "transid": None}
    err_code = data.get("errorCode")
    if data.get("obj") and (err_code is None or err_code >= 0):
        return {"ok": True, "transid": str(data["obj"]), "error_code": None, "error_message": None, "raw": data}
    return {
        "ok": False,
        "transid": None,
        "error_code": err_code,
        "error_message": data.get("errorMessage") or LSIM_ERROR_TEXT.get(err_code, "Bilinməyən xəta"),
        "raw": data,
    }


async def lsim_check_balance() -> Dict[str, Any]:
    if not LSIM_LOGIN or not LSIM_PASSWORD:
        return {"ok": False, "balance": None, "error_message": "LSIM credentials not configured"}
    key = _balance_key(LSIM_LOGIN, LSIM_PASSWORD)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{LSIM_BASE_URL}/balance", params={"login": LSIM_LOGIN, "key": key})
            data = r.json()
    except Exception as e:
        return {"ok": False, "balance": None, "error_message": f"HTTP error: {e}"}
    if data.get("obj") is not None and (data.get("errorCode") is None or data["errorCode"] >= 0):
        return {"ok": True, "balance": data["obj"], "raw": data}
    return {
        "ok": False,
        "balance": None,
        "error_code": data.get("errorCode"),
        "error_message": data.get("errorMessage") or LSIM_ERROR_TEXT.get(data.get("errorCode"), "Bilinməyən xəta"),
    }


async def lsim_check_status(transid: str) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(f"{LSIM_BASE_URL}/smsreporter", json={"login": LSIM_LOGIN, "transid": transid})
            data = r.json()
    except Exception as e:
        return {"ok": False, "error_message": f"HTTP error: {e}"}
    code = data.get("obj")
    if isinstance(code, int) and code in LSIM_REPORT_STATUS:
        return {"ok": True, "status_code": code, "status_label": LSIM_REPORT_STATUS[code], "raw": data}
    return {"ok": False, "raw": data, "error_message": data.get("errorMessage") or "Status alına bilmədi"}


def render_template(template: str, ctx: Dict[str, Any]) -> str:
    """Replace {placeholder} in template with values from ctx (best-effort, missing → empty)."""
    if not template:
        return ""
    out = template
    for k, v in (ctx or {}).items():
        out = out.replace("{" + k + "}", "" if v is None else str(v))
    # Strip any leftover {placeholders} so users don't see raw braces
    out = re.sub(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}", "", out)
    return out.strip()


async def log_sms(db, *, phone: str, msisdn: Optional[str], text: str, sender: str,
                  category: str, ok: bool, transid: Optional[str],
                  error_code: Optional[int], error_message: Optional[str],
                  recipient_type: str = "", recipient_id: str = "",
                  recipient_name: str = "", sent_by: str = "",
                  related_object_id: str = "", related_object_type: str = "") -> Dict[str, Any]:
    """Persist a single SMS attempt to db.sms_logs."""
    doc = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "msisdn": msisdn,
        "text": text,
        "sender": sender,
        "category": category,  # "manual" | "bulk" | "event_reminder" | "birthday"
        "status": "sent" if ok else "failed",
        "transid": transid,
        "error_code": error_code,
        "error_message": error_message,
        "recipient_type": recipient_type,  # "company" | "member" | "contact" | "employee" | "manual"
        "recipient_id": recipient_id,
        "recipient_name": recipient_name,
        "sent_by": sent_by,
        "related_object_id": related_object_id,
        "related_object_type": related_object_type,  # "event" | ""
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.sms_logs.insert_one(doc)
    doc.pop("_id", None)
    return doc


# Default templates (overridable via db.sms_templates)
DEFAULT_TEMPLATES = {
    "event_reminder": "Marsol: Sabah {date} {time}-da {event_name} - {venue}. Iştirakınızı gözləyirik!",
    "birthday": "Hörmətli {name}, doğum gününüz mübarək olsun! Marsol Group sizə xoşbəxtlik və uğurlar arzulayır.",
}


async def get_template(db, key: str) -> str:
    doc = await db.sms_templates.find_one({"key": key}, {"_id": 0})
    if doc and doc.get("text"):
        return doc["text"]
    return DEFAULT_TEMPLATES.get(key, "")


async def set_template(db, key: str, text: str, updated_by: str = "") -> Dict[str, Any]:
    doc = {
        "key": key,
        "text": text,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": updated_by,
    }
    await db.sms_templates.update_one({"key": key}, {"$set": doc}, upsert=True)
    return doc
