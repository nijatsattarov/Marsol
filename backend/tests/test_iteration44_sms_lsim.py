"""Iteration 44 — LSIM Quick SMS integration tests.

DANGER: LSIM is a real paid provider. All tests here either:
  (a) only READ (balance/templates/logs/stats), or
  (b) send with deliberately INVALID phone numbers so LSIM returns errorCode -102
      (no money is deducted). sms_logs should still record status='failed'.

Cleanup: TEST_SMS_ prefixed companies/events/invitations removed in finally.
Admin: settings@marsol.az / marsol123
Sales (non-admin for 403): satis@marsol.az / marsol123
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to frontend/.env
    try:
        with open("/app/frontend/.env", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except FileNotFoundError:
        pass
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}

# Invalid phones → LSIM returns errorCode -102 (yanlış nömrə formatı)
INVALID_PHONE_1 = "00000000"
INVALID_PHONE_2 = "11111111"


# -------------------- Fixtures --------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def sales_token():
    r = requests.post(f"{API}/auth/login", json=SALES, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Sales user login failed ({r.status_code}) — skipping 403 tests")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sales_h(sales_token):
    return {"Authorization": f"Bearer {sales_token}", "Content-Type": "application/json"}


# IDs to cleanup after all tests
_created = {"companies": [], "events": [], "invitations": [], "sms_log_ids": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_h):
    yield
    for cid in _created["companies"]:
        try:
            requests.delete(f"{API}/companies/{cid}", headers=admin_h, timeout=15)
        except Exception:
            pass
    for eid in _created["events"]:
        try:
            requests.delete(f"{API}/events/{eid}", headers=admin_h, timeout=15)
        except Exception:
            pass


# ==================== 1. Balance ====================
class TestBalance:
    def test_balance_admin_ok(self, admin_h):
        r = requests.get(f"{API}/sms/balance", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True, f"LSIM balance not ok: {data}"
        assert isinstance(data.get("balance"), int), f"balance should be int, got {type(data.get('balance'))}"
        assert data["balance"] >= 0
        print(f"[balance] {data['balance']}")

    def test_balance_forbidden_for_non_admin(self, sales_h):
        r = requests.get(f"{API}/sms/balance", headers=sales_h, timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"


# ==================== 2. Templates ====================
class TestTemplates:
    def test_get_default_templates(self, admin_h):
        r = requests.get(f"{API}/sms/templates", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "event_reminder" in data
        assert "birthday" in data
        assert isinstance(data["event_reminder"], str) and data["event_reminder"]
        assert isinstance(data["birthday"], str) and data["birthday"]

    def test_update_event_reminder_template(self, admin_h):
        # Fetch original to restore later
        r0 = requests.get(f"{API}/sms/templates", headers=admin_h, timeout=30)
        original = r0.json().get("event_reminder", "")

        new_text = "TEST_SMS_ tmpl {date} {time} {event_name} {venue} {name}"
        r = requests.put(f"{API}/sms/templates/event_reminder",
                         headers=admin_h, json={"text": new_text}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["key"] == "event_reminder"
        assert data["text"] == new_text

        # GET to verify persisted
        r2 = requests.get(f"{API}/sms/templates", headers=admin_h, timeout=30)
        assert r2.json()["event_reminder"] == new_text

        # Restore default if we had one
        if original:
            requests.put(f"{API}/sms/templates/event_reminder",
                         headers=admin_h, json={"text": original}, timeout=30)

    def test_update_birthday_template(self, admin_h):
        r0 = requests.get(f"{API}/sms/templates", headers=admin_h, timeout=30)
        original = r0.json().get("birthday", "")

        new_text = "TEST_SMS_ bday {name} — təbriklər!"
        r = requests.put(f"{API}/sms/templates/birthday",
                         headers=admin_h, json={"text": new_text}, timeout=30)
        assert r.status_code == 200
        assert r.json()["text"] == new_text

        if original:
            requests.put(f"{API}/sms/templates/birthday",
                         headers=admin_h, json={"text": original}, timeout=30)

    def test_update_template_invalid_key(self, admin_h):
        r = requests.put(f"{API}/sms/templates/unknown_key",
                         headers=admin_h, json={"text": "x"}, timeout=30)
        assert r.status_code == 400

    def test_update_template_empty_text(self, admin_h):
        r = requests.put(f"{API}/sms/templates/event_reminder",
                         headers=admin_h, json={"text": "   "}, timeout=30)
        assert r.status_code == 400

    def test_templates_forbidden_non_admin(self, sales_h):
        # GET is currently open, but PUT must 403
        r = requests.put(f"{API}/sms/templates/event_reminder",
                         headers=sales_h, json={"text": "x"}, timeout=30)
        assert r.status_code == 403


# ==================== 3. Single SMS send (invalid phone → failed log) ====================
class TestSendSingle:
    def test_send_invalid_phone_is_logged_as_failed(self, admin_h):
        body = {
            "phone": INVALID_PHONE_1,
            "text": "TEST_SMS_ single failure test",
            "recipient_name": "TEST_SMS_ recipient",
        }
        r = requests.post(f"{API}/sms/send", headers=admin_h, json=body, timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is False, f"Expected failure for invalid phone but got: {data}"
        assert "log_id" in data and data["log_id"]
        _created["sms_log_ids"].append(data["log_id"])

        # Verify log entry exists
        logs = requests.get(f"{API}/sms/logs?category=manual&limit=50",
                            headers=admin_h, timeout=30).json()
        matched = [x for x in logs["items"] if x["id"] == data["log_id"]]
        assert matched, "Log record not found for manual single send"
        log = matched[0]
        assert log["status"] == "failed"
        assert log["category"] == "manual"
        assert log["phone"] == INVALID_PHONE_1
        assert log["sender"] == "MARSOL"
        assert log["text"].startswith("TEST_SMS_")

    def test_send_missing_fields(self, admin_h):
        r = requests.post(f"{API}/sms/send", headers=admin_h,
                          json={"phone": INVALID_PHONE_1}, timeout=30)
        assert r.status_code == 400

    def test_send_forbidden_non_admin(self, sales_h):
        r = requests.post(f"{API}/sms/send", headers=sales_h,
                          json={"phone": INVALID_PHONE_1, "text": "hi"}, timeout=30)
        assert r.status_code == 403


# ==================== 4. Bulk (companies / contacts) ====================
class TestBulk:
    @pytest.fixture(scope="class")
    def test_companies(self, admin_h):
        """Create 2 TEST_SMS_ companies with invalid phones."""
        created = []
        for i in range(2):
            payload = {
                "brand_name": f"TEST_SMS_Company_{i}_{uuid.uuid4().hex[:6]}",
                "owner_name": f"TEST_SMS_Owner_{i}",
                "owner_phone": INVALID_PHONE_1 if i == 0 else INVALID_PHONE_2,
                "representative_name": f"TEST_SMS_Rep_{i}",
                "representative_phone": "",
                "company_phone": "",
                "status": "Aktiv",
            }
            r = requests.post(f"{API}/companies", headers=admin_h, json=payload, timeout=30)
            assert r.status_code in (200, 201), r.text
            comp = r.json()
            created.append(comp["id"])
            _created["companies"].append(comp["id"])
        return created

    def test_bulk_companies_all_failed_logged(self, admin_h, test_companies):
        body = {
            "recipient_type": "companies",
            "ids": test_companies,
            "text": "TEST_SMS_ bulk hello {name}",
        }
        r = requests.post(f"{API}/sms/bulk", headers=admin_h, json=body, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] >= 2
        assert data["failed"] == data["total"]  # all invalid
        assert data["sent"] == 0

        # verify bulk logs
        logs = requests.get(f"{API}/sms/logs?category=bulk&limit=100",
                            headers=admin_h, timeout=30).json()
        test_logs = [x for x in logs["items"] if x.get("text", "").startswith("TEST_SMS_ bulk")]
        assert len(test_logs) >= data["total"]
        for log in test_logs[: data["total"]]:
            assert log["category"] == "bulk"
            assert log["status"] == "failed"
            assert log["recipient_type"] == "company"

    def test_bulk_explicit_recipients(self, admin_h):
        body = {
            "recipients": [
                {"phone": INVALID_PHONE_1, "name": "TEST_SMS_R1"},
                {"phone": INVALID_PHONE_1, "name": "TEST_SMS_R1_dup"},  # same msisdn → deduped
                {"phone": INVALID_PHONE_2, "name": "TEST_SMS_R2"},
            ],
            "text": "TEST_SMS_ explicit bulk",
        }
        r = requests.post(f"{API}/sms/bulk", headers=admin_h, json=body, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expect 2 unique msisdn after dedup
        assert data["total"] == 2, f"dedup failed, got total={data['total']}"

    def test_bulk_no_valid_phone(self, admin_h):
        body = {"recipients": [{"phone": "", "name": "x"}], "text": "x"}
        r = requests.post(f"{API}/sms/bulk", headers=admin_h, json=body, timeout=30)
        assert r.status_code == 400

    def test_bulk_forbidden_non_admin(self, sales_h):
        r = requests.post(f"{API}/sms/bulk", headers=sales_h,
                          json={"text": "x", "recipients": [{"phone": INVALID_PHONE_1}]}, timeout=30)
        assert r.status_code == 403


# ==================== 5. Logs & Stats ====================
class TestLogs:
    def test_logs_sorted_desc_and_filter(self, admin_h):
        r = requests.get(f"{API}/sms/logs?limit=20", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "total" in data
        items = data["items"]
        # Verify descending by created_at
        for a, b in zip(items, items[1:]):
            assert a["created_at"] >= b["created_at"], "logs not sorted desc by created_at"

        # category filter
        r2 = requests.get(f"{API}/sms/logs?category=manual&limit=50",
                          headers=admin_h, timeout=30)
        assert r2.status_code == 200
        for it in r2.json()["items"]:
            assert it["category"] == "manual"

    def test_logs_stats(self, admin_h):
        r = requests.get(f"{API}/sms/logs/stats", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("total", "sent", "failed", "today", "by_category"):
            assert k in data
        for k in ("manual", "bulk", "event_reminder", "birthday"):
            assert k in data["by_category"]
            assert isinstance(data["by_category"][k], int)
        # After our failed sends, failed >= 3 and manual >= 1, bulk >= 2
        assert data["failed"] >= 3
        assert data["by_category"]["manual"] >= 1
        assert data["by_category"]["bulk"] >= 2

    def test_logs_forbidden_non_admin(self, sales_h):
        r = requests.get(f"{API}/sms/logs", headers=sales_h, timeout=30)
        assert r.status_code == 403
        r2 = requests.get(f"{API}/sms/logs/stats", headers=sales_h, timeout=30)
        assert r2.status_code == 403


# ==================== 6. Dispatch-daily (idempotency + event reminder) ====================
class TestDispatchDaily:
    @pytest.fixture(scope="class")
    def tomorrow_event(self, admin_h):
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        # Create company with invalid phone
        comp_payload = {
            "brand_name": f"TEST_SMS_EvtComp_{uuid.uuid4().hex[:6]}",
            "owner_name": "TEST_SMS_EvtOwner",
            "owner_phone": INVALID_PHONE_1,
            "status": "Aktiv",
        }
        rc = requests.post(f"{API}/companies", headers=admin_h, json=comp_payload, timeout=30)
        assert rc.status_code in (200, 201), rc.text
        comp = rc.json()
        _created["companies"].append(comp["id"])

        # Create event scheduled tomorrow
        ev_payload = {
            "name": f"TEST_SMS_Event_{uuid.uuid4().hex[:6]}",
            "event_type": "Toplantı",
            "date": tomorrow,
            "time": "18:00",
            "venue": "TEST_SMS_ venue",
            "host_company_id": comp["id"],
            "host_company_name": comp["brand_name"],
        }
        re_ = requests.post(f"{API}/events", headers=admin_h, json=ev_payload, timeout=30)
        assert re_.status_code in (200, 201), re_.text
        ev = re_.json()
        _created["events"].append(ev["id"])

        # Invitation
        inv_payload = {
            "event_id": ev["id"],
            "event_name": ev["name"],
            "event_date": tomorrow,
            "company_id": comp["id"],
            "company_name": comp["brand_name"],
        }
        ri = requests.post(f"{API}/invitations", headers=admin_h, json=inv_payload, timeout=30)
        assert ri.status_code in (200, 201), ri.text
        return {"event": ev, "company": comp}

    def test_dispatch_daily_first_call(self, admin_h, tomorrow_event):
        r = requests.post(f"{API}/sms/dispatch-daily", headers=admin_h, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("event_reminders_sent", "birthday_sent", "skipped", "failed"):
            assert k in data
        # Our test event has invalid phone → should be in failed
        assert data["failed"] >= 1, f"expected at least 1 failed, got {data}"

        # Verify event_reminder log present for our test company
        logs = requests.get(
            f"{API}/sms/logs?category=event_reminder&limit=100",
            headers=admin_h, timeout=30).json()
        our_logs = [x for x in logs["items"]
                    if x.get("recipient_id") == tomorrow_event["company"]["id"]]
        assert our_logs, "event_reminder log for test company not found"
        assert our_logs[0]["status"] == "failed"
        assert our_logs[0]["related_object_type"] == "event"

    def test_dispatch_daily_idempotent(self, admin_h, tomorrow_event):
        """Second call same day → skipped counter > 0, no duplicate logs for same key."""
        # Count existing event_reminder logs for our company
        logs_before = requests.get(
            f"{API}/sms/logs?category=event_reminder&limit=200",
            headers=admin_h, timeout=30).json()["items"]
        before = len([x for x in logs_before
                      if x.get("recipient_id") == tomorrow_event["company"]["id"]])

        r = requests.post(f"{API}/sms/dispatch-daily", headers=admin_h, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["skipped"] >= 1, f"Expected skipped>=1 on 2nd call, got {data}"

        logs_after = requests.get(
            f"{API}/sms/logs?category=event_reminder&limit=200",
            headers=admin_h, timeout=30).json()["items"]
        after = len([x for x in logs_after
                     if x.get("recipient_id") == tomorrow_event["company"]["id"]])
        assert after == before, f"Duplicate logs created (before={before}, after={after})"

    def test_dispatch_daily_forbidden_non_admin(self, sales_h):
        r = requests.post(f"{API}/sms/dispatch-daily", headers=sales_h, timeout=30)
        assert r.status_code == 403


# ==================== 7. Phone normalization (indirect via /sms/send) ====================
class TestPhoneNormalization:
    """Verify that normalize_phone reaches LSIM as 12 digits (994XXXXXXXXX).
    We assert by examining `msisdn` field in sms_logs for different input formats.
    All still use invalid numbers to avoid real sends."""

    @pytest.mark.parametrize("raw,expected", [
        ("+994 00 000 00 00", "994000000000"),
        ("050 000 00 00", "994500000000"),  # 0501234567 → 994501234567 (but invalid digits)
        ("500000000", "994500000000"),
        ("994000000000", "994000000000"),
    ])
    def test_normalize_via_send(self, admin_h, raw, expected):
        text = f"TEST_SMS_ normalize {uuid.uuid4().hex[:6]}"
        body = {"phone": raw, "text": text}
        r = requests.post(f"{API}/sms/send", headers=admin_h, json=body, timeout=45)
        assert r.status_code == 200, r.text
        log_id = r.json()["log_id"]
        logs = requests.get(f"{API}/sms/logs?category=manual&limit=100",
                            headers=admin_h, timeout=30).json()
        log = next((x for x in logs["items"] if x["id"] == log_id), None)
        assert log is not None, "log not found"
        assert log["msisdn"] == expected, \
            f"normalize failed: input={raw!r} got msisdn={log['msisdn']!r}, expected={expected!r}"
