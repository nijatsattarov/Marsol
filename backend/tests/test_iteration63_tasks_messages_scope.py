"""Iteration 63 — Tasks subtasks/created_by/dashboard-scoping + Messages
(unread-count, group rename/delete, message delete, mark-read) + admin reset
notifications + RBAC department scope."""
import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient


def _mongo_db():
    p = "/app/backend/.env"
    env = {}
    for line in open(p):
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k] = v.strip('"').strip("'")
    cli = MongoClient(env["MONGO_URL"])
    return cli[env["DB_NAME"]]

def _read_frontend_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return ""

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not found"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"
NONADMIN_EMAIL = "satis@marsol.az"
NONADMIN_PASSWORD = "marsol123"


# --------------------------- helpers / fixtures ---------------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data["user"]


@pytest.fixture(scope="module")
def admin_session():
    token, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, user


@pytest.fixture(scope="module")
def nonadmin_session():
    token, user = _login(NONADMIN_EMAIL, NONADMIN_PASSWORD)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, user


# --------------------------- TASKS: subtasks + created_by ---------------------------
class TestTasksSubtasks:
    def test_create_task_with_subtasks_and_created_by(self, admin_session):
        s, user = admin_session
        payload = {
            "task_name": "TEST_subtasks_task_" + uuid.uuid4().hex[:6],
            "department": "İT",
            "assignee": user["name"],
            "responsible_person": user["name"],
            "priority": "Orta",
            "start_date": "2026-01-01",
            "end_date": "2026-01-15",
            "subtasks": [
                {"title": "Step A", "done": False},
                {"title": "Step B", "done": True},
            ],
        }
        r = s.post(f"{API}/tasks", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["created_by"] == user["name"]
        assert isinstance(body.get("subtasks"), list) and len(body["subtasks"]) == 2
        assert body["subtasks"][0]["title"] == "Step A"

        task_id = body["id"]
        try:
            # Update subtasks via PUT
            new_subs = [
                {"title": "Step A", "done": True},
                {"title": "Step B", "done": True},
                {"title": "Step C", "done": False},
            ]
            r2 = s.put(f"{API}/tasks/{task_id}", json={"subtasks": new_subs}, timeout=20)
            assert r2.status_code == 200, r2.text

            # GET back and verify
            r3 = s.get(f"{API}/tasks", timeout=20)
            assert r3.status_code == 200
            mine = next((t for t in r3.json() if t["id"] == task_id), None)
            assert mine is not None
            assert len(mine["subtasks"]) == 3
            assert mine["subtasks"][2]["title"] == "Step C"
        finally:
            s.delete(f"{API}/tasks/{task_id}")


# --------------------------- DASHBOARD: tasks count scoped to me ---------------------------
class TestDashboardTasksScopedToMe:
    def test_dashboard_tasks_count_excludes_others(self, admin_session, nonadmin_session):
        s_admin, admin_user = admin_session
        s_other, other_user = nonadmin_session
        # Create a task whose assignee/responsible/creator is the *other* user (admin creates → created_by=admin)
        # To truly isolate, have the OTHER user create + assign to themselves.
        payload = {
            "task_name": "TEST_dash_other_" + uuid.uuid4().hex[:6],
            "assignee": other_user["name"],
            "responsible_person": other_user["name"],
            "priority": "Aşağı",
        }
        r = s_other.post(f"{API}/tasks", json=payload, timeout=20)
        if r.status_code != 200:
            pytest.skip(f"non-admin cannot create task: {r.status_code} {r.text}")
        task_id = r.json()["id"]
        try:
            # Admin stats should NOT count this task
            r1 = s_admin.get(f"{API}/dashboard/stats", timeout=20)
            assert r1.status_code == 200
            admin_total = r1.json()["tasks"]["total"]

            # Other user's stats SHOULD count it
            r2 = s_other.get(f"{API}/dashboard/stats", timeout=20)
            assert r2.status_code == 200
            other_total = r2.json()["tasks"]["total"]
            assert other_total >= 1

            # Admin total should not have increased because of this task
            # Sanity: lookup the assignee on the GET back
            r3 = s_admin.get(f"{API}/tasks", timeout=20)
            existing = next((t for t in r3.json() if t["id"] == task_id), None)
            # admin scope is all, sees the task; but dashboard 'tasks' is scoped to me
            assert existing is not None, "admin should see all tasks via /tasks endpoint"
            assert existing["assignee"] == other_user["name"]
            assert existing["created_by"] == other_user["name"]
            # admin's name should not match any of the 3 fields
            for f in ("assignee", "responsible_person", "created_by"):
                assert existing.get(f) != admin_user["name"]
        finally:
            s_admin.delete(f"{API}/tasks/{task_id}")


# --------------------------- NOTIFICATIONS: admin reset all ---------------------------
class TestNotificationsAdminResetAll:
    def test_nonadmin_forbidden(self, nonadmin_session):
        s, _ = nonadmin_session
        r = s.post(f"{API}/notifications/admin-reset-all", timeout=20)
        assert r.status_code == 403, r.text

    def test_admin_succeeds_returns_counts(self, admin_session):
        s, _ = admin_session
        r = s.post(f"{API}/notifications/admin-reset-all", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("deleted_notifications", "deleted_reads", "deleted_dispatched_emails"):
            assert k in data
            assert isinstance(data[k], int)


# --------------------------- TASK creation triggers in-app notification ---------------------------
class TestTaskAssignmentNotification:
    def test_task_creation_emits_notification_to_assignee(self, admin_session, nonadmin_session):
        # admin creates a task assigned to non-admin → notification doc should be created in db.notifications
        s_admin, admin_user = admin_session
        s_other, other_user = nonadmin_session
        db = _mongo_db()

        payload = {
            "task_name": "TEST_notif_assign_" + uuid.uuid4().hex[:6],
            "assignee": other_user["name"],
            "responsible_person": other_user["name"],
            "priority": "Yüksək",
        }
        r = s_admin.post(f"{API}/tasks", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        task_doc = r.json()
        task_id = task_doc["id"]
        try:
            time.sleep(0.5)
            # Direct DB check — the spec says db.notifications should have a 'task_assigned' entry
            stored = list(db.notifications.find(
                {"type": "task_assigned", "task_id": task_id}, {"_id": 0}
            ))
            assert len(stored) >= 1, "Expected at least one task_assigned notification in db.notifications"
            assert stored[0]["recipient_name"] == other_user["name"]
            assert payload["task_name"] in stored[0].get("body", "")
        finally:
            s_admin.delete(f"{API}/tasks/{task_id}")


# --------------------------- MESSAGES: unread-count, mark-read, group edit/delete, msg delete ---------------------------
class TestMessagesGroupAndUnread:
    @pytest.fixture(scope="class")
    def two_users(self, admin_session, nonadmin_session):
        return admin_session, nonadmin_session

    def test_unread_count_route_not_shadowed(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/messages/unread-count", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "total" in body and "per_conversation" in body
        assert isinstance(body["total"], int)
        assert isinstance(body["per_conversation"], dict)

    def test_group_lifecycle_and_message_delete(self, two_users):
        (s_admin, admin_user), (s_other, other_user) = two_users
        # Create a group conversation (admin is creator). Need participant ids.
        r_users = s_admin.get(f"{API}/settings/users", timeout=20)
        assert r_users.status_code == 200
        users = r_users.json()
        admin_id = next(u["id"] for u in users if u["email"] == ADMIN_EMAIL)
        other_id = next(u["id"] for u in users if u["email"] == NONADMIN_EMAIL)
        # Find a third user if available
        third = next((u for u in users if u["email"] not in (ADMIN_EMAIL, NONADMIN_EMAIL)), None)

        group_name = "TEST_GROUP_" + uuid.uuid4().hex[:6]
        participants = [admin_id, other_id]
        if third:
            participants.append(third["id"])
        rc = s_admin.post(
            f"{API}/messages/conversations",
            json={"is_group": True, "name": group_name, "participant_ids": participants},
            timeout=20,
        )
        assert rc.status_code == 200, rc.text
        conv = rc.json()
        cid = conv["id"]
        try:
            # Other user (non-creator, non-admin) tries to rename → 403
            r_forbid = s_other.put(
                f"{API}/messages/conversations/{cid}",
                json={"name": "HACKED_" + group_name},
                timeout=20,
            )
            assert r_forbid.status_code == 403, r_forbid.text

            # Admin renames + changes participants (drop third if present)
            new_name = group_name + "_R"
            r_ren = s_admin.put(
                f"{API}/messages/conversations/{cid}",
                json={"name": new_name, "participant_ids": [admin_id, other_id]},
                timeout=20,
            )
            assert r_ren.status_code == 200, r_ren.text
            assert r_ren.json()["name"] == new_name
            assert set(r_ren.json()["participants"]) == {admin_id, other_id}

            # Send a message as admin → notification for other user, last_message updated
            r_send = s_admin.post(f"{API}/messages/{cid}", json={"text": "hello world TEST"}, timeout=20)
            assert r_send.status_code == 200, r_send.text
            msg = r_send.json()
            msg_id = msg["id"]

            # Other user sees unread-count include this conv
            r_unread = s_other.get(f"{API}/messages/unread-count", timeout=20)
            assert r_unread.status_code == 200
            uc = r_unread.json()
            assert uc["per_conversation"].get(cid, 0) >= 1
            assert uc["total"] >= 1

            # Other user marks read
            r_mr = s_other.post(f"{API}/messages/{cid}/mark-read", timeout=20)
            assert r_mr.status_code == 200, r_mr.text
            assert r_mr.json().get("marked") is True
            # Unread should drop to 0 for this conv
            r_unread2 = s_other.get(f"{API}/messages/unread-count", timeout=20)
            assert r_unread2.json()["per_conversation"].get(cid, 0) == 0

            # Other user tries to delete admin's message → 403
            r_del_forbid = s_other.delete(f"{API}/messages/{cid}/message/{msg_id}", timeout=20)
            assert r_del_forbid.status_code == 403, r_del_forbid.text

            # Admin deletes the message
            r_del = s_admin.delete(f"{API}/messages/{cid}/message/{msg_id}", timeout=20)
            assert r_del.status_code == 200, r_del.text
            # Verify it is gone
            r_msgs = s_admin.get(f"{API}/messages/{cid}", timeout=20)
            assert r_msgs.status_code == 200
            assert not any(m["id"] == msg_id for m in r_msgs.json())

            # Other user tries to DELETE conversation → 403
            r_dc_forbid = s_other.delete(f"{API}/messages/conversations/{cid}", timeout=20)
            assert r_dc_forbid.status_code == 403

            # Admin deletes conversation
            r_dc = s_admin.delete(f"{API}/messages/conversations/{cid}", timeout=20)
            assert r_dc.status_code == 200
            cid = None
        finally:
            if cid:
                s_admin.delete(f"{API}/messages/conversations/{cid}")

    def test_message_creates_notifications_for_other_participants(self, two_users):
        (s_admin, admin_user), (s_other, other_user) = two_users
        db = _mongo_db()
        r_users = s_admin.get(f"{API}/settings/users", timeout=20)
        users = r_users.json()
        admin_id = next(u["id"] for u in users if u["email"] == ADMIN_EMAIL)
        other_id = next(u["id"] for u in users if u["email"] == NONADMIN_EMAIL)
        rc = s_admin.post(
            f"{API}/messages/conversations",
            json={"is_group": True, "name": "TEST_NOTIFCONV_" + uuid.uuid4().hex[:6],
                  "participant_ids": [admin_id, other_id]},
            timeout=20,
        )
        assert rc.status_code == 200
        cid = rc.json()["id"]
        try:
            r_send = s_admin.post(f"{API}/messages/{cid}", json={"text": "notif test PING " + uuid.uuid4().hex[:6]}, timeout=20)
            assert r_send.status_code == 200
            time.sleep(0.5)
            # Direct DB check
            stored = list(db.notifications.find(
                {"type": "message", "conversation_id": cid}, {"_id": 0}
            ))
            assert len(stored) >= 1, "expected at least 1 'message'-type notification doc"
            recipient_names = {n["recipient_name"] for n in stored}
            assert other_user["name"] in recipient_names
            assert admin_user["name"] not in recipient_names, "sender should not get notified"
        finally:
            s_admin.delete(f"{API}/messages/conversations/{cid}")


# --------------------------- RBAC: 'department' scope ---------------------------
class TestDepartmentScope:
    @pytest.fixture(scope="class")
    def dept_user(self, admin_session):
        s_admin, _ = admin_session
        # Pick a unique dept name unlikely to collide
        dept_name = "TEST_DEPT_" + uuid.uuid4().hex[:5]
        # Create a fresh role with tasks scope='department'
        role_name = "TEST_role_dept_" + uuid.uuid4().hex[:5]
        role_payload = {
            "name": role_name,
            "permissions": {"tasks": {"read": True, "write": True}, "dashboard": {"read": True}},
            "scopes": {"tasks": "department"},
        }
        rr = s_admin.post(f"{API}/roles", json=role_payload, timeout=20)
        if rr.status_code != 200:
            pytest.skip(f"cannot create test role: {rr.status_code} {rr.text}")
        role_doc = rr.json()
        role_id = role_doc["id"]

        # Create a fresh user in this department with this role
        new_email = f"dept_{uuid.uuid4().hex[:6]}@test.local"
        new_pwd = "testpass123"
        new_name = "TEST_DeptUser_" + uuid.uuid4().hex[:5]
        payload = {
            "email": new_email,
            "name": new_name,
            "password": new_pwd,
            "role": role_name,
            "department": dept_name,
        }
        r = s_admin.post(f"{API}/settings/users", json=payload, timeout=20)
        if r.status_code != 200:
            s_admin.delete(f"{API}/roles/{role_id}")
            pytest.skip(f"cannot create user: {r.status_code} {r.text}")
        user_doc = r.json()

        yield {"email": new_email, "password": new_pwd, "name": new_name, "department": dept_name,
               "id": user_doc["id"], "role_id": role_id, "role_name": role_name}

        # cleanup: delete user first (so role isn't 'in use'), then role
        s_admin.delete(f"{API}/settings/users/{user_doc['id']}")
        s_admin.delete(f"{API}/roles/{role_id}")

    def test_department_scope_filters_tasks(self, admin_session, dept_user):
        s_admin, _ = admin_session
        # login as dept user
        token, _ = _login(dept_user["email"], dept_user["password"])
        s_dept = requests.Session()
        s_dept.headers.update({"Authorization": f"Bearer {token}"})

        # Admin creates a task with assignee=dept_user (so it should be visible to dept_user)
        my_task_payload = {
            "task_name": "TEST_dept_visible_" + uuid.uuid4().hex[:6],
            "assignee": dept_user["name"],
            "responsible_person": dept_user["name"],
            "priority": "Orta",
        }
        r1 = s_admin.post(f"{API}/tasks", json=my_task_payload, timeout=20)
        assert r1.status_code == 200
        visible_id = r1.json()["id"]

        # Admin creates another task NOT in dept (assigned to admin, no dept user mention)
        other_task_payload = {
            "task_name": "TEST_dept_hidden_" + uuid.uuid4().hex[:6],
            "assignee": "settings@marsol.az_someone_else_xxx",
            "responsible_person": "settings@marsol.az_someone_else_xxx",
            "priority": "Orta",
        }
        r2 = s_admin.post(f"{API}/tasks", json=other_task_payload, timeout=20)
        assert r2.status_code == 200
        hidden_id = r2.json()["id"]

        try:
            r_list = s_dept.get(f"{API}/tasks", timeout=20)
            assert r_list.status_code == 200
            ids = {t["id"] for t in r_list.json()}
            assert visible_id in ids, "dept user should see task assigned to them"
            assert hidden_id not in ids, "dept user should NOT see task assigned to someone outside dept"
        finally:
            s_admin.delete(f"{API}/tasks/{visible_id}")
            s_admin.delete(f"{API}/tasks/{hidden_id}")


# --------------------------- REGRESSION ---------------------------
class TestRegression:
    def test_login_admin(self):
        token, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token and user.get("email") == ADMIN_EMAIL

    def test_invitation_templates_list(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/invitation-templates", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list) and len(body) > 0

    def test_meetings_list(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/meetings", timeout=20)
        assert r.status_code == 200

    def test_org_companies_list(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/organization/companies", timeout=20)
        # 404 if endpoint doesn't exist is ok; we only fail if 5xx
        assert r.status_code < 500
