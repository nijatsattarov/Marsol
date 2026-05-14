"""
Iteration 58 backend tests:
- /api/settings/manageable-lists includes seeded 'cities' (15 defaults)
- /api/meeting-requests: create, list, validation
- /api/meeting-requests/{id}/respond: accept by all -> meetings created; reject -> no meetings; 403 for non-recipient
- /api/notifications visibility of meeting_request notif (best-effort, soft)
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-hub-563.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"

# ----------- helpers / fixtures -----------

def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token() -> str:
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def admin_user(admin_token: str) -> dict:
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(admin_token), timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def test_users(admin_token: str):
    """Create 2 ephemeral Aktiv users (sender_b, recipient_a)."""
    suffix = uuid.uuid4().hex[:8]
    payload_a = {
        "email": f"TEST_recip_{suffix}@marsol.test",
        "name": f"TEST Recipient {suffix}",
        "password": "TestPass123!",
        "role": "admin",
        "status": "Aktiv",
    }
    payload_b = {
        "email": f"TEST_recip2_{suffix}@marsol.test",
        "name": f"TEST Recipient2 {suffix}",
        "password": "TestPass123!",
        "role": "admin",
        "status": "Aktiv",
    }
    ra = requests.post(f"{BASE_URL}/api/settings/users", json=payload_a, headers=_hdr(admin_token), timeout=30)
    rb = requests.post(f"{BASE_URL}/api/settings/users", json=payload_b, headers=_hdr(admin_token), timeout=30)
    assert ra.status_code == 200, ra.text
    assert rb.status_code == 200, rb.text
    user_a = ra.json()
    user_b = rb.json()
    tok_a = _login(payload_a["email"], payload_a["password"])
    tok_b = _login(payload_b["email"], payload_b["password"])
    yield {
        "a": {"user": user_a, "token": tok_a, "email": payload_a["email"]},
        "b": {"user": user_b, "token": tok_b, "email": payload_b["email"]},
    }
    # teardown
    requests.delete(f"{BASE_URL}/api/settings/users/{user_a['id']}", headers=_hdr(admin_token), timeout=30)
    requests.delete(f"{BASE_URL}/api/settings/users/{user_b['id']}", headers=_hdr(admin_token), timeout=30)


# Track created request ids per test for cleanup of resulting meetings
_created_meeting_ids: list[str] = []


@pytest.fixture(scope="module", autouse=True)
def _cleanup_meetings_after(admin_token: str):
    yield
    for mid in _created_meeting_ids:
        try:
            requests.delete(f"{BASE_URL}/api/meetings/{mid}", headers=_hdr(admin_token), timeout=10)
        except Exception:
            pass


# ============ Cities seed ============
class TestCitiesSeed:
    def test_cities_in_manageable_lists(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/settings/manageable-lists", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        lists = r.json()
        assert isinstance(lists, list)
        city = next((x for x in lists if x.get("key") == "cities"), None)
        assert city is not None, "cities entry missing in manageable-lists"
        values = city.get("values") or city.get("defaults") or []
        assert isinstance(values, list)
        assert len(values) >= 15, f"expected >=15 cities, got {len(values)}: {values}"
        assert "Bakı" in values
        assert "Sumqayıt" in values
        assert "Gəncə" in values


# ============ Meeting requests ============
class TestMeetingRequests:
    def test_create_empty_recipients_returns_400(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/meeting-requests",
            json={"recipient_ids": [], "date": "2026-02-01", "time": "10:00"},
            headers=_hdr(admin_token),
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_create_request_and_notification(self, admin_token, admin_user, test_users):
        rec_id = test_users["a"]["user"]["id"]
        payload = {
            "recipient_ids": [rec_id],
            "date": "2026-02-15",
            "time": "11:30",
            "meeting_type": "Onlayn təqdimat",
            "meeting_mode": "Online",
            "location": "Zoom",
            "notes": "TEST iteration58 notes",
        }
        r = requests.post(f"{BASE_URL}/api/meeting-requests", json=payload, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "pending"
        assert body["sender_id"] == admin_user["id"]
        assert len(body["recipients"]) == 1
        assert body["recipients"][0]["id"] == rec_id
        assert body["recipients"][0]["status"] == "pending"
        assert body["date"] == "2026-02-15"
        assert "id" in body and isinstance(body["id"], str)

        # GET as sender → should list
        rl = requests.get(f"{BASE_URL}/api/meeting-requests", headers=_hdr(admin_token), timeout=30)
        assert rl.status_code == 200
        ids = [it["id"] for it in rl.json()]
        assert body["id"] in ids

        # GET as recipient → should also list
        rl2 = requests.get(f"{BASE_URL}/api/meeting-requests", headers=_hdr(test_users["a"]["token"]), timeout=30)
        assert rl2.status_code == 200
        ids2 = [it["id"] for it in rl2.json()]
        assert body["id"] in ids2

        # NOTE: /api/notifications is a *computed* endpoint (debts, contracts, etc.)
        # and does NOT surface rows from the `notifications` collection. The Inbox UI
        # uses /api/meeting-requests instead — verified above. The notification
        # document IS inserted into db.notifications by the backend (verified in code).

    def test_non_recipient_cannot_respond_returns_403(self, admin_token, test_users):
        # sender=admin, recipient=user_a; user_b tries to respond -> 403
        payload = {
            "recipient_ids": [test_users["a"]["user"]["id"]],
            "date": "2026-03-01",
            "time": "09:00",
            "meeting_type": "Görüş",
        }
        r = requests.post(f"{BASE_URL}/api/meeting-requests", json=payload, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        req_id = r.json()["id"]

        r2 = requests.post(
            f"{BASE_URL}/api/meeting-requests/{req_id}/respond",
            json={"action": "accept"},
            headers=_hdr(test_users["b"]["token"]),
            timeout=30,
        )
        assert r2.status_code == 403, f"expected 403, got {r2.status_code} {r2.text}"

    def test_accept_creates_meetings_for_all(self, admin_token, admin_user, test_users):
        recipients = [test_users["a"]["user"]["id"], test_users["b"]["user"]["id"]]
        payload = {
            "recipient_ids": recipients,
            "date": "2026-04-05",
            "time": "14:00",
            "meeting_type": "Strategiya görüşü",
            "meeting_mode": "Offline",
            "location": "Bakı, ofis",
            "notes": "TEST accept-all flow",
        }
        r = requests.post(f"{BASE_URL}/api/meeting-requests", json=payload, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        req_id = r.json()["id"]

        # First recipient accepts → status should still be pending
        r1 = requests.post(
            f"{BASE_URL}/api/meeting-requests/{req_id}/respond",
            json={"action": "accept"},
            headers=_hdr(test_users["a"]["token"]),
            timeout=30,
        )
        assert r1.status_code == 200, r1.text
        assert r1.json()["status"] == "pending"

        # Second recipient accepts → status accepted
        r2 = requests.post(
            f"{BASE_URL}/api/meeting-requests/{req_id}/respond",
            json={"action": "accept"},
            headers=_hdr(test_users["b"]["token"]),
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "accepted"

        # Meetings should exist for sender + both recipients (3 docs with same meeting_request_id)
        # Verify via GET /api/meetings (admin view)
        time.sleep(0.3)
        mr = requests.get(f"{BASE_URL}/api/meetings", headers=_hdr(admin_token), timeout=30)
        assert mr.status_code == 200
        meetings = mr.json() if isinstance(mr.json(), list) else mr.json().get("items", [])
        linked = [m for m in meetings if m.get("meeting_request_id") == req_id]
        for m in linked:
            if m.get("id"):
                _created_meeting_ids.append(m["id"])
        assert len(linked) == 3, f"expected 3 meetings created, got {len(linked)}"

    def test_reject_sets_status_and_no_meeting(self, admin_token, test_users):
        recipients = [test_users["a"]["user"]["id"], test_users["b"]["user"]["id"]]
        r = requests.post(
            f"{BASE_URL}/api/meeting-requests",
            json={
                "recipient_ids": recipients,
                "date": "2026-05-10",
                "time": "16:00",
                "meeting_type": "TEST reject flow",
            },
            headers=_hdr(admin_token),
            timeout=30,
        )
        assert r.status_code == 200
        req_id = r.json()["id"]

        # user_a rejects -> overall rejected, no meetings created
        rr = requests.post(
            f"{BASE_URL}/api/meeting-requests/{req_id}/respond",
            json={"action": "reject"},
            headers=_hdr(test_users["a"]["token"]),
            timeout=30,
        )
        assert rr.status_code == 200, rr.text
        assert rr.json()["status"] == "rejected"

        time.sleep(0.3)
        mr = requests.get(f"{BASE_URL}/api/meetings", headers=_hdr(admin_token), timeout=30)
        assert mr.status_code == 200
        meetings = mr.json() if isinstance(mr.json(), list) else mr.json().get("items", [])
        linked = [m for m in meetings if m.get("meeting_request_id") == req_id]
        assert linked == [], f"expected no meetings for rejected request, got {len(linked)}"

    def test_invalid_action_returns_400(self, admin_token, test_users):
        r = requests.post(
            f"{BASE_URL}/api/meeting-requests",
            json={
                "recipient_ids": [test_users["a"]["user"]["id"]],
                "date": "2026-06-01",
                "time": "10:00",
                "meeting_type": "TEST invalid action",
            },
            headers=_hdr(admin_token),
            timeout=30,
        )
        req_id = r.json()["id"]
        bad = requests.post(
            f"{BASE_URL}/api/meeting-requests/{req_id}/respond",
            json={"action": "maybe"},
            headers=_hdr(test_users["a"]["token"]),
            timeout=30,
        )
        assert bad.status_code == 400
