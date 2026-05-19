"""Iteration 64 — bulk delete tasks, task comments, task_updated/task_comment
notifications, single shared meeting on accept, files/notes scope leak, notes
sharing notifications, and note_shared/task_* surfacing in /notifications.
"""
import os
import time
import uuid
import pytest
import requests

def _read_env_url():
    env_url = os.environ.get("REACT_APP_BACKEND_URL")
    if env_url:
        return env_url.rstrip("/")
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE_URL = _read_env_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
USER2 = {"email": "satis@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data.get("user") or data


@pytest.fixture(scope="module")
def admin_ctx():
    tok, user = _login(ADMIN)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def user2_ctx():
    tok, user = _login(USER2)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


def _cleanup_task(headers, tid):
    try:
        requests.delete(f"{API}/tasks/{tid}", headers=headers, timeout=10)
    except Exception:
        pass


# ============================================================
# A. Bulk-delete tasks
# ============================================================
class TestBulkDelete:
    def test_admin_bulk_delete_archives_and_deletes(self, admin_ctx):
        h = admin_ctx["headers"]
        ids = []
        try:
            for i in range(2):
                payload = {
                    "task_name": f"TEST_bulk_{uuid.uuid4().hex[:6]}_{i}",
                    "assignee": admin_ctx["user"]["name"],
                    "responsible_person": admin_ctx["user"]["name"],
                    "priority": "Orta",
                    "status": "Yeni",
                    "start_date": "2026-01-15",
                    "end_date": "2026-01-30",
                }
                r = requests.post(f"{API}/tasks", json=payload, headers=h, timeout=15)
                assert r.status_code == 200, r.text
                ids.append(r.json()["id"])
            r = requests.post(f"{API}/tasks/bulk-delete", json={"ids": ids}, headers=h, timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["deleted"] == 2
            assert data["skipped"] == 0
            # Verify gone — list tasks and confirm none of our ids present
            lst = requests.get(f"{API}/tasks", headers=h, timeout=15).json()
            remaining = {t["id"] for t in lst} & set(ids)
            assert not remaining, f"tasks still listed after bulk-delete: {remaining}"
            ids = []  # consumed
        finally:
            for tid in ids:
                _cleanup_task(h, tid)

    def test_non_admin_can_only_delete_own(self, admin_ctx, user2_ctx):
        h_a = admin_ctx["headers"]
        h_u = user2_ctx["headers"]
        # admin creates 1 task (not deletable by user2), user2 creates 1 task
        u2_name = user2_ctx["user"]["name"]
        admin_task_id = None
        user2_task_id = None
        try:
            r = requests.post(
                f"{API}/tasks",
                json={
                    "task_name": f"TEST_admin_owned_{uuid.uuid4().hex[:6]}",
                    "assignee": u2_name, "responsible_person": u2_name,
                    "priority": "Aşağı", "status": "Yeni",
                    "start_date": "2026-01-15", "end_date": "2026-01-30",
                },
                headers=h_a, timeout=15,
            )
            assert r.status_code == 200, r.text
            admin_task_id = r.json()["id"]

            r = requests.post(
                f"{API}/tasks",
                json={
                    "task_name": f"TEST_u2_owned_{uuid.uuid4().hex[:6]}",
                    "assignee": u2_name, "responsible_person": u2_name,
                    "priority": "Aşağı", "status": "Yeni",
                    "start_date": "2026-01-15", "end_date": "2026-01-30",
                },
                headers=h_u, timeout=15,
            )
            assert r.status_code == 200, r.text
            user2_task_id = r.json()["id"]

            # user2 attempts to bulk delete both; should delete only its own
            r = requests.post(
                f"{API}/tasks/bulk-delete",
                json={"ids": [admin_task_id, user2_task_id]},
                headers=h_u, timeout=15,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["deleted"] == 1
            assert data["skipped"] == 1
            # admin task survives (visible to admin's task list)
            adm_list = requests.get(f"{API}/tasks", headers=h_a, timeout=10).json()
            assert any(t["id"] == admin_task_id for t in adm_list), "admin task missing after partial bulk-delete"
            user2_task_id = None
        finally:
            if admin_task_id:
                _cleanup_task(h_a, admin_task_id)
            if user2_task_id:
                _cleanup_task(h_a, user2_task_id)


# ============================================================
# B. Task comments
# ============================================================
class TestTaskComments:
    def test_comment_create_list_delete(self, admin_ctx, user2_ctx):
        h_a = admin_ctx["headers"]
        h_u = user2_ctx["headers"]
        u2_name = user2_ctx["user"]["name"]
        task_id = None
        try:
            r = requests.post(
                f"{API}/tasks",
                json={
                    "task_name": f"TEST_comment_task_{uuid.uuid4().hex[:6]}",
                    "assignee": u2_name, "responsible_person": admin_ctx["user"]["name"],
                    "priority": "Orta", "status": "Yeni",
                    "start_date": "2026-01-15", "end_date": "2026-01-30",
                },
                headers=h_a, timeout=15,
            )
            assert r.status_code == 200, r.text
            task_id = r.json()["id"]

            # admin posts 1
            c1 = requests.post(f"{API}/tasks/{task_id}/comments", json={"text": "TEST first by admin"}, headers=h_a, timeout=15)
            assert c1.status_code == 200, c1.text
            c1_id = c1.json()["id"]
            time.sleep(0.05)
            # user2 posts 1
            c2 = requests.post(f"{API}/tasks/{task_id}/comments", json={"text": "TEST second by user2"}, headers=h_u, timeout=15)
            assert c2.status_code == 200, c2.text
            c2_id = c2.json()["id"]

            # list — oldest first
            lst = requests.get(f"{API}/tasks/{task_id}/comments", headers=h_a, timeout=10)
            assert lst.status_code == 200
            items = lst.json()
            assert len(items) >= 2
            ours = [i for i in items if i["id"] in (c1_id, c2_id)]
            assert len(ours) == 2
            assert ours[0]["id"] == c1_id  # oldest first
            assert ours[0]["text"] == "TEST first by admin"

            # delete: user2 cannot delete admin's comment
            d_forbidden = requests.delete(f"{API}/tasks/{task_id}/comments/{c1_id}", headers=h_u, timeout=10)
            assert d_forbidden.status_code == 403, d_forbidden.text

            # user2 deletes own
            d_own = requests.delete(f"{API}/tasks/{task_id}/comments/{c2_id}", headers=h_u, timeout=10)
            assert d_own.status_code == 200

            # admin deletes admin's own
            d_admin = requests.delete(f"{API}/tasks/{task_id}/comments/{c1_id}", headers=h_a, timeout=10)
            assert d_admin.status_code == 200

            # verify empty (only ours removed)
            lst2 = requests.get(f"{API}/tasks/{task_id}/comments", headers=h_a, timeout=10)
            remaining = [i for i in lst2.json() if i["id"] in (c1_id, c2_id)]
            assert remaining == []
        finally:
            if task_id:
                _cleanup_task(h_a, task_id)

    def test_comment_triggers_notification_to_other_stakeholders(self, admin_ctx, user2_ctx):
        """A comment from admin on a task assigned to user2 must create a task_comment
        notification for user2, surfaced via GET /notifications."""
        h_a = admin_ctx["headers"]
        h_u = user2_ctx["headers"]
        u2_name = user2_ctx["user"]["name"]
        task_id = None
        try:
            r = requests.post(
                f"{API}/tasks",
                json={
                    "task_name": f"TEST_notif_comment_{uuid.uuid4().hex[:6]}",
                    "assignee": u2_name, "responsible_person": u2_name,
                    "priority": "Yüksək", "status": "Yeni",
                    "start_date": "2026-01-15", "end_date": "2026-01-30",
                },
                headers=h_a, timeout=15,
            )
            assert r.status_code == 200
            task_id = r.json()["id"]
            marker = f"MARKER_{uuid.uuid4().hex[:8]}"
            c = requests.post(f"{API}/tasks/{task_id}/comments", json={"text": marker}, headers=h_a, timeout=15)
            assert c.status_code == 200
            time.sleep(0.4)
            n = requests.get(f"{API}/notifications", headers=h_u, timeout=15)
            assert n.status_code == 200
            items = n.json().get("notifications", []) if isinstance(n.json(), dict) else n.json()
            types = {i.get("type") for i in items}
            assert "task_comment" in types, f"task_comment missing from user2 notifications types={types}"
            hits = [i for i in items if i.get("type") == "task_comment" and marker in (i.get("message") or "")]
            assert hits, "task_comment with marker text not surfaced in /notifications"
        finally:
            if task_id:
                _cleanup_task(h_a, task_id)


# ============================================================
# C. Task update notification
# ============================================================
class TestTaskUpdateNotification:
    def test_update_triggers_task_updated_for_assignee(self, admin_ctx, user2_ctx):
        h_a = admin_ctx["headers"]
        h_u = user2_ctx["headers"]
        u2_name = user2_ctx["user"]["name"]
        task_id = None
        try:
            r = requests.post(
                f"{API}/tasks",
                json={
                    "task_name": f"TEST_update_notif_{uuid.uuid4().hex[:6]}",
                    "assignee": u2_name, "responsible_person": u2_name,
                    "priority": "Orta", "status": "Yeni",
                    "start_date": "2026-01-15", "end_date": "2026-01-30",
                },
                headers=h_a, timeout=15,
            )
            assert r.status_code == 200
            task_id = r.json()["id"]
            # admin updates priority
            up = requests.put(f"{API}/tasks/{task_id}", json={"priority": "Yüksək", "status": "Davam edir"}, headers=h_a, timeout=15)
            assert up.status_code == 200
            time.sleep(0.4)
            n = requests.get(f"{API}/notifications", headers=h_u, timeout=15)
            assert n.status_code == 200
            items_u = n.json().get("notifications", []) if isinstance(n.json(), dict) else n.json()
            updates = [i for i in items_u if i.get("type") == "task_updated" and i.get("task_id") == task_id]
            assert updates, f"task_updated for assignee not found in /notifications (sample={items_u[:3]})"
            # actor (admin) should NOT receive a task_updated for this task (they were the actor)
            n_a = requests.get(f"{API}/notifications", headers=h_a, timeout=15)
            items_a = n_a.json().get("notifications", []) if isinstance(n_a.json(), dict) else n_a.json()
            actor_hits = [i for i in items_a if i.get("type") == "task_updated" and i.get("task_id") == task_id]
            assert not actor_hits, "actor (admin) should not see their own task_updated"
        finally:
            if task_id:
                _cleanup_task(h_a, task_id)


# ============================================================
# D. Meeting request → ONE shared meeting
# ============================================================
class TestMeetingSingleShared:
    def test_accepted_request_creates_one_shared_meeting(self, admin_ctx, user2_ctx):
        h_a = admin_ctx["headers"]
        h_u = user2_ctx["headers"]
        u2_id = user2_ctx["user"]["id"]
        marker = f"TEST_meet_{uuid.uuid4().hex[:6]}"
        req_id = None
        meeting_id = None
        try:
            r = requests.post(
                f"{API}/meeting-requests",
                json={
                    "recipient_ids": [u2_id],
                    "date": "2026-02-10",
                    "time": "14:00",
                    "meeting_type": marker,
                    "meeting_mode": "Online",
                    "location": "Zoom",
                    "notes": marker,
                },
                headers=h_a, timeout=15,
            )
            assert r.status_code == 200, r.text
            req_id = r.json()["id"]

            # user2 accepts
            resp = requests.post(f"{API}/meeting-requests/{req_id}/respond", json={"action": "accept"}, headers=h_u, timeout=15)
            assert resp.status_code == 200, resp.text

            # Sender's meetings list contains exactly one with meeting_request_id=req_id
            m_a = requests.get(f"{API}/meetings", headers=h_a, timeout=15)
            assert m_a.status_code == 200
            a_hits = [m for m in m_a.json() if m.get("meeting_request_id") == req_id]
            assert len(a_hits) == 1, f"expected 1 shared meeting in sender's list, got {len(a_hits)}"
            meeting_id = a_hits[0]["id"]
            assert admin_ctx["user"]["name"] in (a_hits[0].get("participant_names") or [])
            assert user2_ctx["user"]["name"] in (a_hits[0].get("participant_names") or [])

            # Recipient's list shows the SAME meeting id
            m_u = requests.get(f"{API}/meetings", headers=h_u, timeout=15)
            assert m_u.status_code == 200
            u_hits = [m for m in m_u.json() if m.get("meeting_request_id") == req_id]
            assert len(u_hits) == 1
            assert u_hits[0]["id"] == meeting_id, "sender and recipient see different meeting ids"
        finally:
            # cleanup meeting + request
            if meeting_id:
                try:
                    requests.delete(f"{API}/meetings/{meeting_id}", headers=admin_ctx["headers"], timeout=10)
                except Exception:
                    pass
            if req_id:
                try:
                    requests.delete(f"{API}/meeting-requests/{req_id}", headers=admin_ctx["headers"], timeout=10)
                except Exception:
                    pass


# ============================================================
# E. Files scope leak (uses role with scope.files=own)
# ============================================================
class TestFilesScope:
    def test_files_own_scope_does_not_leak(self, admin_ctx, user2_ctx):
        h_a = admin_ctx["headers"]
        h_u = user2_ctx["headers"]
        cloud = "ddyysroag"  # from /app/backend/.env (CLOUDINARY_CLOUD_NAME)
        role_name = None
        prev_scopes = None
        prev_perms = None
        admin_file_id = None
        user_file_id = None
        try:
            # Find user2's role and snapshot then patch scope.files='own'
            u2_role = user2_ctx["user"]["role"]
            r = requests.get(f"{API}/roles", headers=h_a, timeout=15)
            assert r.status_code == 200
            roles = r.json()
            target = next((rr for rr in roles if rr["name"] == u2_role), None)
            assert target, f"role {u2_role} not found"
            role_name = target["name"]
            prev_scopes = dict(target.get("scopes") or {})
            prev_perms = dict(target.get("permissions") or {})
            new_perms = {**prev_perms, "files": "write"}
            new_scopes = {**prev_scopes, "files": "own"}
            # try update by role id
            up = requests.put(f"{API}/roles/{target['id']}", json={"scopes": new_scopes, "permissions": new_perms}, headers=h_a, timeout=15)
            assert up.status_code == 200, f"role patch failed: {up.status_code} {up.text}"

            # admin uploads a file
            r1 = requests.post(
                f"{API}/files",
                json={
                    "url": f"https://res.cloudinary.com/{cloud}/raw/upload/v1/marsol/files/TEST_admin_{uuid.uuid4().hex[:6]}.txt",
                    "public_id": f"marsol/files/TEST_admin_{uuid.uuid4().hex[:6]}",
                    "name": "TEST_admin_file.txt",
                    "folder": "marsol/files",
                    "resource_type": "raw",
                },
                headers=h_a, timeout=15,
            )
            assert r1.status_code == 200, r1.text
            admin_file_id = r1.json()["id"]

            # user2 uploads its own
            r2 = requests.post(
                f"{API}/files",
                json={
                    "url": f"https://res.cloudinary.com/{cloud}/raw/upload/v1/marsol/files/TEST_u2_{uuid.uuid4().hex[:6]}.txt",
                    "public_id": f"marsol/files/TEST_u2_{uuid.uuid4().hex[:6]}",
                    "name": "TEST_u2_file.txt",
                    "folder": "marsol/files",
                    "resource_type": "raw",
                },
                headers=h_u, timeout=15,
            )
            assert r2.status_code == 200, r2.text
            user_file_id = r2.json()["id"]

            # user2 GET /files — must NOT include admin's file
            lst = requests.get(f"{API}/files", headers=h_u, timeout=15)
            assert lst.status_code == 200
            ids = {f["id"] for f in lst.json()}
            assert user_file_id in ids, "user2 cannot see its own file"
            assert admin_file_id not in ids, "FILES SCOPE LEAK: user2 sees admin's file under own scope"
        finally:
            # restore role scopes
            if role_name and prev_scopes is not None:
                target = next((rr for rr in (requests.get(f"{API}/roles", headers=h_a).json() or []) if rr["name"] == role_name), None)
                if target:
                    restore_body = {"scopes": prev_scopes}
                    if prev_perms is not None:
                        restore_body["permissions"] = prev_perms
                    requests.put(f"{API}/roles/{target['id']}", json=restore_body, headers=h_a, timeout=15)
            for fid in (admin_file_id, user_file_id):
                if fid:
                    try:
                        requests.delete(f"{API}/files/{fid}", headers=admin_ctx["headers"], timeout=10)
                    except Exception:
                        pass


# ============================================================
# F. Notes — note_shared notification + surfacing
# ============================================================
class TestNoteShared:
    def test_note_share_notifies_recipient(self, admin_ctx, user2_ctx):
        h_a = admin_ctx["headers"]
        h_u = user2_ctx["headers"]
        u2_id = user2_ctx["user"]["id"]
        marker = f"TEST_note_share_{uuid.uuid4().hex[:6]}"
        note_id = None
        try:
            r = requests.post(
                f"{API}/notes",
                json={
                    "title": marker,
                    "content": "Hello shared note",
                    "shared_with_users": [u2_id],
                    "shared_with_all": False,
                },
                headers=h_a, timeout=15,
            )
            assert r.status_code == 200, r.text
            note_id = r.json()["id"]
            time.sleep(0.4)
            n = requests.get(f"{API}/notifications", headers=h_u, timeout=15)
            assert n.status_code == 200
            items = n.json().get("notifications", []) if isinstance(n.json(), dict) else n.json()
            shared = [i for i in items if i.get("type") == "note_shared"]
            assert shared, f"note_shared missing from user2 /notifications. Types seen: {[i.get('type') for i in items]}"
        finally:
            if note_id:
                try:
                    requests.delete(f"{API}/notes/{note_id}", headers=admin_ctx["headers"], timeout=10)
                except Exception:
                    pass


# ============================================================
# G. Regression — basic invitation-templates / meetings list
# ============================================================
class TestRegression:
    def test_invitation_templates_list(self, admin_ctx):
        r = requests.get(f"{API}/invitation-templates", headers=admin_ctx["headers"], timeout=10)
        assert r.status_code == 200

    def test_meetings_list(self, admin_ctx):
        r = requests.get(f"{API}/meetings", headers=admin_ctx["headers"], timeout=10)
        assert r.status_code == 200

    def test_messages_unread_count(self, admin_ctx):
        r = requests.get(f"{API}/messages/unread-count", headers=admin_ctx["headers"], timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "count" in body or "unread_count" in body or isinstance(body, dict)
