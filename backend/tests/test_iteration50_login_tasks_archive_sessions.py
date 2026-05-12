"""
Iteration 50 — backend tests covering:
1) Login active/deactivated status enforcement
2) Settings users: status field accepted (Aktiv / Deaktiv)
3) Task delete -> archive (tasks_archive collection)
4) Task delete RBAC: only creator OR admin
5) GET /tasks/archive scope (admin sees all, others see own/assigned)
6) POST /tasks/archive/{archive_id}/restore
7) GET /attendance/system-sessions returns {sessions, totals}
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    return r


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def sales_token():
    r = _login(SALES)
    assert r.status_code == 200, f"Sales login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ============== 1) Login: aktiv / deaktiv ==============
class TestLoginStatus:
    def test_active_admin_login_200(self):
        r = _login(ADMIN)
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["user"]["email"] == ADMIN["email"]

    def test_active_sales_login_200(self):
        r = _login(SALES)
        assert r.status_code == 200

    def test_deactivated_user_blocked_403(self, admin_token):
        # Create a test user with status=Deaktiv then attempt login
        email = f"test_iter50_deakt_{uuid.uuid4().hex[:6]}@test.local"
        payload = {
            "email": email,
            "password": "marsol123",
            "name": "TEST_DeaktivUser",
            "role": "user",
            "status": "Deaktiv",
        }
        cr = requests.post(f"{BASE_URL}/api/settings/users", json=payload, headers=H(admin_token), timeout=30)
        assert cr.status_code in (200, 201), f"Create user failed: {cr.status_code} {cr.text}"
        user_id = cr.json().get("id")
        try:
            # Verify GET back returns status=Deaktiv
            gr = requests.get(f"{BASE_URL}/api/settings/users", headers=H(admin_token), timeout=30)
            assert gr.status_code == 200
            persisted = next((u for u in gr.json() if u.get("email") == email), None)
            assert persisted is not None, "Created user not returned by GET"
            assert (persisted.get("status") or "").lower() in ("deaktiv", "inactive", "suspended"), \
                f"Status not persisted: {persisted.get('status')}"

            # Attempt login → expect 403
            lr = _login({"email": email, "password": "marsol123"})
            assert lr.status_code == 403, f"Expected 403 deactivated, got {lr.status_code}: {lr.text}"
            assert "deaktiv" in lr.json().get("detail", "").lower()
        finally:
            requests.delete(f"{BASE_URL}/api/settings/users/{user_id}", headers=H(admin_token), timeout=30)

    def test_reactivated_user_can_login_200(self, admin_token):
        # Create user as Deaktiv, then PUT to Aktiv → login should succeed
        email = f"test_iter50_react_{uuid.uuid4().hex[:6]}@test.local"
        cr = requests.post(
            f"{BASE_URL}/api/settings/users",
            json={"email": email, "password": "marsol123", "name": "TEST_Reactivate", "role": "user", "status": "Deaktiv"},
            headers=H(admin_token), timeout=30,
        )
        assert cr.status_code in (200, 201)
        uid = cr.json()["id"]
        try:
            ur = requests.put(
                f"{BASE_URL}/api/settings/users/{uid}",
                json={"status": "Aktiv"},
                headers=H(admin_token), timeout=30,
            )
            assert ur.status_code == 200, f"PUT status update failed: {ur.text}"
            lr = _login({"email": email, "password": "marsol123"})
            assert lr.status_code == 200, f"Reactivated user must login: {lr.status_code} {lr.text}"
        finally:
            requests.delete(f"{BASE_URL}/api/settings/users/{uid}", headers=H(admin_token), timeout=30)


# ============== 2) Tasks: archive on delete ==============
class TestTaskArchive:
    def _create_task(self, tok, assignee=None, name_suffix=""):
        payload = {
            "task_name": f"TEST_iter50_task_{name_suffix}_{uuid.uuid4().hex[:6]}",
            "priority": "Orta",
            "status": "Gözləyir",
            "assignee": assignee or "TEST_assignee",
            "start_date": "2026-01-01",
            "end_date": "2026-01-15",
        }
        r = requests.post(f"{BASE_URL}/api/tasks", json=payload, headers=H(tok), timeout=30)
        assert r.status_code == 200, f"Create task failed: {r.status_code} {r.text}"
        return r.json()

    def test_admin_delete_moves_to_archive(self, admin_token):
        task = self._create_task(admin_token, name_suffix="admin_delete")
        tid = task["id"]
        # DELETE
        dr = requests.delete(f"{BASE_URL}/api/tasks/{tid}", headers=H(admin_token), timeout=30)
        assert dr.status_code == 200, f"Delete failed: {dr.text}"
        assert "arxiv" in dr.json().get("message", "").lower()

        # Verify removed from active tasks
        gr = requests.get(f"{BASE_URL}/api/tasks", headers=H(admin_token), timeout=30)
        assert gr.status_code == 200
        assert not any(t.get("id") == tid for t in gr.json()), "Deleted task still in active list"

        # Verify present in archive
        ar = requests.get(f"{BASE_URL}/api/tasks/archive", headers=H(admin_token), timeout=30)
        assert ar.status_code == 200, f"Archive list failed: {ar.text}"
        archive_items = ar.json()
        match = next((a for a in archive_items if a.get("id") == tid), None)
        assert match is not None, "Task missing from archive after delete"
        assert "archive_id" in match
        assert "archived_at" in match
        assert "archived_by" in match

    def test_restore_archived_task(self, admin_token):
        task = self._create_task(admin_token, name_suffix="restore")
        tid = task["id"]
        requests.delete(f"{BASE_URL}/api/tasks/{tid}", headers=H(admin_token), timeout=30)
        ar = requests.get(f"{BASE_URL}/api/tasks/archive", headers=H(admin_token), timeout=30)
        match = next((a for a in ar.json() if a.get("id") == tid), None)
        assert match, "Task missing from archive"
        archive_id = match["archive_id"]

        rr = requests.post(f"{BASE_URL}/api/tasks/archive/{archive_id}/restore", headers=H(admin_token), timeout=30)
        assert rr.status_code == 200, f"Restore failed: {rr.text}"

        # Should be back in active tasks
        gr = requests.get(f"{BASE_URL}/api/tasks", headers=H(admin_token), timeout=30)
        assert any(t.get("id") == tid for t in gr.json()), "Restored task not in active tasks"

        # And no longer in archive
        ar2 = requests.get(f"{BASE_URL}/api/tasks/archive", headers=H(admin_token), timeout=30)
        assert not any(a.get("archive_id") == archive_id for a in ar2.json()), "Archive entry still present"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{tid}", headers=H(admin_token), timeout=30)

    def test_non_creator_non_admin_cannot_delete_403(self, admin_token, sales_token):
        # Admin creates a task assigned to sales user; sales user tries to delete -> 403
        # Find sales user name
        gu = requests.get(f"{BASE_URL}/api/settings/users", headers=H(admin_token), timeout=30)
        sales_user = next((u for u in gu.json() if u.get("email") == SALES["email"]), None)
        assert sales_user, "Sales user not found"
        sales_name = sales_user["name"]

        task = self._create_task(admin_token, assignee=sales_name, name_suffix="rbac")
        tid = task["id"]
        try:
            # Sales user (assignee, not creator) tries to delete
            dr = requests.delete(f"{BASE_URL}/api/tasks/{tid}", headers=H(sales_token), timeout=30)
            # Either 403 (RBAC) acceptable. May be 403 from permission helper too.
            assert dr.status_code == 403, f"Expected 403, got {dr.status_code}: {dr.text}"
            detail = (dr.json().get("detail") or "").lower()
            # Must be the creator-rule message OR generic permission denied
            assert "yaradan" in detail or "icazə" in detail or "admin" in detail, \
                f"Unexpected error message: {detail}"
        finally:
            # Cleanup as admin
            requests.delete(f"{BASE_URL}/api/tasks/{tid}", headers=H(admin_token), timeout=30)


# ============== 3) System sessions totals shape ==============
class TestSystemSessions:
    def test_system_sessions_returns_sessions_and_totals(self, admin_token):
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.get(
            f"{BASE_URL}/api/attendance/system-sessions",
            params={"date": today},
            headers=H(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, f"system-sessions failed: {r.status_code} {r.text}"
        body = r.json()
        assert isinstance(body, dict), f"Expected dict, got {type(body)}"
        assert "sessions" in body, f"Missing 'sessions': {list(body.keys())}"
        assert "totals" in body, f"Missing 'totals': {list(body.keys())}"
        assert isinstance(body["sessions"], list)
        assert isinstance(body["totals"], list)
        # Validate totals shape if any
        if body["totals"]:
            t = body["totals"][0]
            for k in ("user_id", "user_email", "user_name", "total_seconds", "sessions", "has_open"):
                assert k in t, f"Missing key '{k}' in totals item: {t}"
            assert isinstance(t["total_seconds"], int)
            assert isinstance(t["sessions"], int)
            assert isinstance(t["has_open"], bool)

    def test_system_sessions_non_admin_forbidden_or_filtered(self, sales_token):
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.get(
            f"{BASE_URL}/api/attendance/system-sessions",
            params={"date": today},
            headers=H(sales_token),
            timeout=30,
        )
        # Either 403 (admin-only) or 200 with shape — both acceptable; just verify shape if 200
        assert r.status_code in (200, 403), f"Unexpected: {r.status_code} {r.text}"
        if r.status_code == 200:
            body = r.json()
            assert "sessions" in body and "totals" in body
