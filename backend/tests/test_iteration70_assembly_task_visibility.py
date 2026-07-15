"""
Iteration 70 — Assembly → Tasks propagation & per-user visibility.

Bug that was fixed: _sync_assembly_tasks used to store assignee/responsible_person
as comma-joined strings which never matched MongoDB `{assignee: name}` element
equality, so assembly-generated tasks were invisible in every assignee's
personal Tapşırıqlar module. This suite verifies the LIST-based storage,
created_by/marsol_company propagation, notification fan-out and idempotent
re-sync on update.
"""

import os
import uuid
import time
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # fallback: read frontend/.env
    for candidate in ("/app/frontend/.env", os.path.join(os.path.dirname(__file__), "../../frontend/.env")):
        try:
            with open(candidate) as f:
                for line in f:
                    if line.strip().startswith("REACT_APP_BACKEND_URL="):
                        return line.split("=", 1)[1].strip().rstrip("/")
        except FileNotFoundError:
            continue
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"


# --------------------------- helpers ---------------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    return body["access_token"], body["user"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --------------------------- fixtures ---------------------------
@pytest.fixture(scope="module")
def admin_ctx():
    token, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"token": token, "user": user, "name": user["name"]}


@pytest.fixture(scope="module")
def test_users(admin_ctx):
    """Create 3 test users, yield ctx dict list, cleanup at teardown."""
    created = []
    hdr = _hdr(admin_ctx["token"])
    suffix = uuid.uuid4().hex[:6]
    for i, label in enumerate(["Alpha", "Beta", "Gamma"]):
        payload = {
            "email": f"test_exec_{label.lower()}_{suffix}@marsol.local",
            "name": f"TEST_Exec_{label}_{suffix}",
            "password": "Test1234!",
            "role": "user",
            "department": "Test",
            "marsol_company": "",
            "phone": "",
            "status": "Aktiv",
        }
        r = requests.post(f"{API}/settings/users", json=payload, headers=hdr, timeout=30)
        assert r.status_code == 200, f"user create failed: {r.status_code} {r.text}"
        created.append(r.json())
    # log each user in to obtain tokens
    ctxs = []
    for u in created:
        try:
            tok, usr = _login(u["email"], "Test1234!")
            ctxs.append({"token": tok, "user": usr, "name": usr["name"], "id": u["id"]})
        except AssertionError as e:
            pytest.fail(f"could not log in seeded test user {u['email']}: {e}")
    yield ctxs
    # cleanup users
    for c in ctxs:
        requests.delete(f"{API}/settings/users/{c['id']}", headers=_hdr(admin_ctx["token"]), timeout=30)


@pytest.fixture
def cleanup_assemblies(admin_ctx):
    """Track assemblies created during a test and delete them + their tasks."""
    created_ids = []
    yield created_ids
    hdr = _hdr(admin_ctx["token"])
    for aid in created_ids:
        requests.delete(f"{API}/assemblies/{aid}", headers=hdr, timeout=30)


def _post_assembly(admin_ctx, payload):
    r = requests.post(f"{API}/assemblies", json=payload, headers=_hdr(admin_ctx["token"]), timeout=30)
    assert r.status_code == 200, f"assembly create failed: {r.status_code} {r.text}"
    return r.json()


def _tasks_for(token):
    r = requests.get(f"{API}/tasks", headers=_hdr(token), timeout=30)
    assert r.status_code == 200, f"GET /tasks failed {r.status_code}: {r.text}"
    return r.json()


# --------------------------- SCENARIO A ---------------------------
class TestScenarioA_CreatorSelfAssigned:
    def test_creator_sees_own_assembly_task(self, admin_ctx, test_users, cleanup_assemblies):
        creator = admin_ctx["name"]
        other = test_users[0]["name"]
        title = f"TEST_A_selftask_{uuid.uuid4().hex[:6]}"
        payload = {
            "department": "Test",
            "purpose": "TEST_ScenarioA",
            "deadline": "2026-12-31",
            "agendas": [{
                "title": "TEST_Agenda_A",
                "tasks": [{
                    "title": title,
                    "assignees": [creator, other],
                    "responsible_persons": [creator],
                    "deadline": "2026-12-31",
                }],
            }],
            "general_tasks": [],
        }
        asm = _post_assembly(admin_ctx, payload)
        cleanup_assemblies.append(asm["id"])
        # (3) admin GET /api/tasks must include the freshly created assembly task
        my_tasks = _tasks_for(admin_ctx["token"])
        match = [t for t in my_tasks if t.get("assembly_id") == asm["id"] and title in t.get("task_name", "")]
        assert match, "Creator/self-assignee did NOT see own assembly task"
        t = match[0]
        assert t["source"] == "assembly"
        assert t["task_code"].startswith("T-")
        assert t["task_name"].startswith(f"[{asm['assembly_code']}]")
        # assignee stored as LIST
        assert isinstance(t["assignee"], list), f"assignee not list: {type(t['assignee'])}"
        assert creator in t["assignee"] and other in t["assignee"]
        assert isinstance(t["responsible_person"], list)
        assert creator in t["responsible_person"]
        # propagation
        assert t["created_by"] == creator


# --------------------------- SCENARIO B ---------------------------
class TestScenarioB_NonCreatorAssignee:
    def test_non_creator_sees_task(self, admin_ctx, test_users, cleanup_assemblies):
        executor = test_users[0]
        title = f"TEST_B_execTask_{uuid.uuid4().hex[:6]}"
        asm = _post_assembly(admin_ctx, {
            "department": "Test",
            "purpose": "TEST_ScenarioB",
            "deadline": "2026-12-31",
            "agendas": [{
                "title": "Agenda_B",
                "tasks": [{
                    "title": title,
                    "assignees": [executor["name"]],
                    "responsible_persons": [executor["name"]],
                    "deadline": "2026-12-31",
                }],
            }],
        })
        cleanup_assemblies.append(asm["id"])
        exec_tasks = _tasks_for(executor["token"])
        match = [t for t in exec_tasks if t.get("assembly_id") == asm["id"]]
        assert match, "Executor did NOT see assembly task in their /api/tasks"
        t = match[0]
        assert t["source"] == "assembly"
        assert t["assembly_id"] == asm["id"]
        assert executor["name"] in t["assignee"]


# --------------------------- SCENARIO C ---------------------------
class TestScenarioC_MultiAssigneeListMatch:
    def test_three_assignees_all_see(self, admin_ctx, test_users, cleanup_assemblies):
        names = [u["name"] for u in test_users]
        title = f"TEST_C_multi_{uuid.uuid4().hex[:6]}"
        asm = _post_assembly(admin_ctx, {
            "department": "Test",
            "purpose": "TEST_ScenarioC",
            "deadline": "2026-12-31",
            "agendas": [{
                "title": "Agenda_C",
                "tasks": [{
                    "title": title,
                    "assignees": names,
                    "responsible_persons": names,
                    "deadline": "2026-12-31",
                }],
            }],
        })
        cleanup_assemblies.append(asm["id"])
        # Verify list stored via admin
        admin_task = next((t for t in _tasks_for(admin_ctx["token"])
                           if t.get("assembly_id") == asm["id"]), None)
        assert admin_task is not None
        assert isinstance(admin_task["assignee"], list)
        assert set(admin_task["assignee"]) == set(names)
        assert isinstance(admin_task["responsible_person"], list)
        assert set(admin_task["responsible_person"]) == set(names)
        # Each user must see it
        for u in test_users:
            seen = [t for t in _tasks_for(u["token"]) if t.get("assembly_id") == asm["id"]]
            assert seen, f"user {u['name']} did NOT see multi-assignee task"


# --------------------------- SCENARIO D ---------------------------
class TestScenarioD_UpdateResync:
    def test_update_assembly_resyncs_tasks(self, admin_ctx, test_users, cleanup_assemblies):
        removed = test_users[0]
        kept = test_users[1]
        newcomer = test_users[2]
        title = f"TEST_D_resync_{uuid.uuid4().hex[:6]}"
        asm = _post_assembly(admin_ctx, {
            "department": "Test",
            "purpose": "TEST_ScenarioD",
            "deadline": "2026-12-31",
            "agendas": [{
                "title": "Agenda_D",
                "tasks": [{
                    "title": title,
                    "assignees": [removed["name"], kept["name"]],
                    "responsible_persons": [removed["name"], kept["name"]],
                    "deadline": "2026-12-31",
                }],
            }],
        })
        cleanup_assemblies.append(asm["id"])
        assert any(t.get("assembly_id") == asm["id"] for t in _tasks_for(removed["token"])), \
            "removed user should INITIALLY see the task"

        # PUT — replace assignees: swap removed → newcomer
        updated_payload = {
            "department": "Test",
            "purpose": "TEST_ScenarioD",
            "deadline": "2026-12-31",
            "agendas": [{
                "title": "Agenda_D",
                "tasks": [{
                    "title": title,
                    "assignees": [kept["name"], newcomer["name"]],
                    "responsible_persons": [kept["name"], newcomer["name"]],
                    "deadline": "2026-12-31",
                }],
            }],
            "general_tasks": [],
        }
        r = requests.put(f"{API}/assemblies/{asm['id']}", json=updated_payload,
                         headers=_hdr(admin_ctx["token"]), timeout=30)
        assert r.status_code == 200, f"PUT failed {r.status_code}: {r.text}"

        removed_tasks = [t for t in _tasks_for(removed["token"]) if t.get("assembly_id") == asm["id"]]
        assert not removed_tasks, "Removed user should NO LONGER see the task after re-sync"
        assert any(t.get("assembly_id") == asm["id"] for t in _tasks_for(kept["token"]))
        assert any(t.get("assembly_id") == asm["id"] for t in _tasks_for(newcomer["token"]))


# --------------------------- SCENARIO E ---------------------------
class TestScenarioE_Notification:
    def test_assignee_receives_notification(self, admin_ctx, test_users, cleanup_assemblies):
        executor = test_users[0]
        title = f"TEST_E_notif_{uuid.uuid4().hex[:6]}"
        asm = _post_assembly(admin_ctx, {
            "department": "Test",
            "purpose": "TEST_ScenarioE",
            "deadline": "2026-12-31",
            "agendas": [{
                "title": "Agenda_E",
                "tasks": [{
                    "title": title,
                    "assignees": [executor["name"]],
                    "responsible_persons": [executor["name"]],
                    "deadline": "2026-12-31",
                }],
            }],
        })
        cleanup_assemblies.append(asm["id"])
        # slight delay in case notification writes are async
        time.sleep(1)
        r = requests.get(f"{API}/notifications", headers=_hdr(executor["token"]), timeout=30)
        assert r.status_code == 200, r.text
        notifs = r.json() if isinstance(r.json(), list) else r.json().get("notifications", [])
        # /api/notifications transforms body→message; title/message contain assembly code
        fresh = [n for n in notifs
                 if n.get("title") == "Yeni tapşırıq (İclas)"
                 and asm["assembly_code"] in (n.get("message") or n.get("body") or "")]
        assert fresh, f"No 'Yeni tapşırıq (İclas)' notification for {executor['name']}. Sample: {notifs[:3]}"
        # Also verify the raw DB stored recipient_name — sanity via direct query
        # (skipped; API doesn't expose it) — just verify at least the type in output is task_assigned
        assert fresh[0].get("type") == "task_assigned"


# --------------------------- SCENARIO F ---------------------------
class TestScenarioF_TenantPropagation:
    def test_marsol_company_propagated(self, admin_ctx, test_users, cleanup_assemblies):
        """Verify task.marsol_company == assembly.marsol_company."""
        title = f"TEST_F_tenant_{uuid.uuid4().hex[:6]}"
        asm = _post_assembly(admin_ctx, {
            "department": "Test",
            "purpose": "TEST_ScenarioF",
            "deadline": "2026-12-31",
            "agendas": [{
                "title": "Agenda_F",
                "tasks": [{
                    "title": title,
                    "assignees": [test_users[0]["name"]],
                    "responsible_persons": [test_users[0]["name"]],
                    "deadline": "2026-12-31",
                }],
            }],
        })
        cleanup_assemblies.append(asm["id"])
        my_tasks = _tasks_for(admin_ctx["token"])
        t = next((x for x in my_tasks if x.get("assembly_id") == asm["id"]), None)
        assert t is not None
        # Both should equal (whatever admin's marsol_company is — commonly "")
        assert t.get("marsol_company", "") == asm.get("marsol_company", ""), \
            f"tenant not propagated: task={t.get('marsol_company')!r} vs assembly={asm.get('marsol_company')!r}"


# --------------------------- REGRESSION ---------------------------
class TestRegression_RegularTasks:
    def test_regular_task_visible_to_all_assignees(self, admin_ctx, test_users):
        a = test_users[0]
        b = test_users[1]
        title = f"TEST_REG_regular_{uuid.uuid4().hex[:6]}"
        payload = {
            "task_name": title,
            "department": "Test",
            "assignee": [a["name"], b["name"]],
            "responsible_person": [a["name"], b["name"]],
            "priority": "Orta",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "status": "Gözləyir",
            "notes": "regression",
        }
        r = requests.post(f"{API}/tasks", json=payload, headers=_hdr(admin_ctx["token"]), timeout=30)
        assert r.status_code == 200, f"POST /tasks failed {r.status_code}: {r.text}"
        task = r.json()
        task_id = task["id"]
        try:
            for u in (a, b):
                seen = [t for t in _tasks_for(u["token"]) if t.get("id") == task_id]
                assert seen, f"regular task not visible to {u['name']}"
                assert isinstance(seen[0]["assignee"], list)
                assert u["name"] in seen[0]["assignee"]

            # Update/Delete flow — non-creator cannot delete
            r_del = requests.delete(f"{API}/tasks/{task_id}", headers=_hdr(a["token"]), timeout=30)
            assert r_del.status_code in (403, 401, 404), \
                f"non-creator should NOT be able to delete: status={r_del.status_code}"
            # Creator can delete
            r_ok = requests.delete(f"{API}/tasks/{task_id}", headers=_hdr(admin_ctx["token"]), timeout=30)
            assert r_ok.status_code == 200, f"creator delete failed: {r_ok.status_code} {r_ok.text}"
            task_id = None
        finally:
            if task_id:
                requests.delete(f"{API}/tasks/{task_id}", headers=_hdr(admin_ctx["token"]), timeout=30)
