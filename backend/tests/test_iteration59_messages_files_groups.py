"""Iteration 59 — Group conversations, message attachments, file PUT (description).

Tests:
- POST /api/messages/conversations group (participant_ids + name) → is_group, participant_names
- POST /api/messages/conversations legacy (participant_id) → 1-1
- POST /api/messages/conversations empty participant_ids → 400
- POST /api/messages/{conv_id} text → message created
- POST /api/messages/{conv_id} attachment only → conv last_message = filename
- POST /api/messages/{conv_id} neither → 400
- PUT /api/files/{id} description → persisted
- PUT /api/files/{id} empty body → 400
- PUT /api/files/{nonexistent} → 404
"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-hub-563.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASS = "marsol123"
ADMIN2_EMAIL = "admin@marsol.az"
ADMIN2_PASS = "marsol123"


def _login(email: str, password: str):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_me(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def two_other_users(admin_headers, admin_me):
    """Return ids of 2 active users that are not admin."""
    r = requests.get(f"{API}/settings/users", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    users = r.json()
    pool = [u for u in users if u.get("id") != admin_me["id"] and (u.get("status") in (None, "Aktiv", "active"))]
    if len(pool) < 2:
        # try admin@marsol.az login to ensure we have at least one
        t2 = _login(ADMIN2_EMAIL, ADMIN2_PASS)
        r2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t2}"}, timeout=20)
        u2 = r2.json()
        # need at least 1 more
        pool2 = [u for u in users if u.get("id") not in (admin_me["id"], u2["id"])]
        if not pool2:
            pytest.skip("Not enough users in system to test group conversation (need >=2 other users)")
        return [u2["id"], pool2[0]["id"]]
    return [pool[0]["id"], pool[1]["id"]]


# ===================== CONVERSATIONS =====================

class TestConversations:
    created_ids = []

    def test_group_conversation_creation(self, admin_headers, admin_me, two_other_users):
        u1, u2 = two_other_users
        payload = {"participant_ids": [u1, u2], "name": f"TEST_Group_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/messages/conversations", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        conv = r.json()
        assert conv["is_group"] is True
        assert conv["name"].startswith("TEST_Group_")
        assert set(conv["participants"]) == {admin_me["id"], u1, u2}
        pnames = conv.get("participant_names") or {}
        assert admin_me["id"] in pnames and u1 in pnames and u2 in pnames
        assert all(isinstance(v, str) and v for v in pnames.values())
        TestConversations.created_ids.append(conv["id"])

    def test_legacy_single_participant_creates_1to1(self, admin_headers, admin_me, two_other_users):
        u1 = two_other_users[0]
        r = requests.post(f"{API}/messages/conversations", headers=admin_headers,
                          json={"participant_id": u1}, timeout=20)
        assert r.status_code == 200, r.text
        conv = r.json()
        assert conv.get("is_group") in (False, None) or conv["is_group"] is False
        assert set(conv["participants"]) == {admin_me["id"], u1}
        TestConversations.created_ids.append(conv["id"])

    def test_empty_participant_ids_returns_400(self, admin_headers):
        r = requests.post(f"{API}/messages/conversations", headers=admin_headers,
                          json={"participant_ids": []}, timeout=20)
        # Either 400 directly, or legacy path (no participant_id) returns 400
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


# ===================== MESSAGES =====================

class TestMessages:
    conv_id = None

    @pytest.fixture(autouse=True, scope="class")
    def _setup_conv(self, request, admin_headers, two_other_users):
        u1 = two_other_users[0]
        r = requests.post(f"{API}/messages/conversations", headers=admin_headers,
                          json={"participant_ids": [u1], "name": f"TEST_MsgConv_{uuid.uuid4().hex[:6]}"}, timeout=20)
        assert r.status_code == 200, r.text
        TestMessages.conv_id = r.json()["id"]
        yield

    def test_send_text_message(self, admin_headers):
        r = requests.post(f"{API}/messages/{TestMessages.conv_id}", headers=admin_headers,
                          json={"text": "Hi"}, timeout=20)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["text"] == "Hi"
        assert msg["conversation_id"] == TestMessages.conv_id
        assert msg.get("attachment") in (None, {})

    def test_send_attachment_only_updates_preview_to_filename(self, admin_headers):
        attachment = {
            "url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "name": "report_q3.pdf",
            "mime_type": "application/pdf",
            "bytes": 12345,
        }
        r = requests.post(f"{API}/messages/{TestMessages.conv_id}", headers=admin_headers,
                          json={"attachment": attachment}, timeout=20)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg.get("attachment", {}).get("name") == "report_q3.pdf"
        assert (msg.get("text") or "") == ""

        # Verify conversation last_message == filename
        r2 = requests.get(f"{API}/messages/conversations", headers=admin_headers, timeout=20)
        assert r2.status_code == 200, r2.text
        convs = r2.json()
        my_conv = next((c for c in convs if c["id"] == TestMessages.conv_id), None)
        assert my_conv is not None, "Conversation missing from list"
        assert my_conv.get("last_message") == "report_q3.pdf", f"Expected 'report_q3.pdf', got {my_conv.get('last_message')!r}"

    def test_send_neither_text_nor_attachment_returns_400(self, admin_headers):
        r = requests.post(f"{API}/messages/{TestMessages.conv_id}", headers=admin_headers,
                          json={}, timeout=20)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


# ===================== FILES =====================

class TestFilesUpdate:
    file_id = None

    @pytest.fixture(autouse=True, scope="class")
    def _seed_file(self, request, admin_headers, admin_token):
        # Upload a tiny test file via /api/upload (multipart, no auth header content-type)
        files = {"file": ("TEST_iter59.txt", io.BytesIO(b"hello iteration 59"), "text/plain")}
        r = requests.post(f"{API}/upload",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files=files, timeout=60)
        if r.status_code != 200:
            pytest.skip(f"Upload failed: {r.status_code} {r.text}")
        up = r.json()
        # Create files record via POST /api/files
        body = {
            "url": up.get("url"),
            "name": "TEST_iter59.txt",
            "mime_type": "text/plain",
            "bytes": 18,
            "public_id": up.get("public_id"),
            "resource_type": up.get("resource_type", "raw"),
            "stored_name": up.get("stored_name"),
            "description": "",
        }
        rc = requests.post(f"{API}/files", headers=admin_headers, json=body, timeout=20)
        if rc.status_code != 200:
            pytest.skip(f"File create failed: {rc.status_code} {rc.text}")
        TestFilesUpdate.file_id = rc.json()["id"]
        yield
        # Teardown
        try:
            requests.delete(f"{API}/files/{TestFilesUpdate.file_id}", headers=admin_headers, timeout=20)
        except Exception:
            pass

    def test_update_file_description(self, admin_headers):
        r = requests.put(f"{API}/files/{TestFilesUpdate.file_id}",
                         headers=admin_headers,
                         json={"description": "Quartal hesabatı"}, timeout=20)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["description"] == "Quartal hesabatı"
        assert doc["id"] == TestFilesUpdate.file_id

    def test_update_file_empty_body_returns_400(self, admin_headers):
        r = requests.put(f"{API}/files/{TestFilesUpdate.file_id}",
                         headers=admin_headers, json={}, timeout=20)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_update_nonexistent_file_returns_404(self, admin_headers):
        bogus = f"nonexistent-{uuid.uuid4().hex}"
        r = requests.put(f"{API}/files/{bogus}",
                         headers=admin_headers,
                         json={"description": "x"}, timeout=20)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
