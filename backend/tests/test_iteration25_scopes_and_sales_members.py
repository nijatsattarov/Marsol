"""
Iteration 25 — Scope (Görünüş Miqyası) & /api/sales-members bug fix tests.

Covers:
- Role CRUD persists scopes field
- apply_scope() filters /api/tasks, /api/meetings, /api/members, /api/sales-leads,
  /api/project-events, /api/assemblies based on role scope
- assert_scope_ownership() returns 403 on non-owned record PUT
- /api/sales-members returns HTTP 200 array (previous return-missing bug fixed)
- Admin is never scoped
- Default scope is "all"
- Create task POST returns 200 for sales manager
"""
import os
import uuid
import pytest
import requests

def _load_backend_url():
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if not val:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        val = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert val, "REACT_APP_BACKEND_URL not set"
    return val.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"
SALES_EMAIL = "satis@marsol.az"
SALES_PASSWORD = "marsol123"
SALES_ROLE_NAME = "Satış meneceri"


# ---------- fixtures ----------

def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def sales_token():
    return _login(SALES_EMAIL, SALES_PASSWORD)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def sales_headers(sales_token):
    return {"Authorization": f"Bearer {sales_token}"}


@pytest.fixture(scope="module")
def sales_user(admin_headers):
    r = requests.get(f"{API}/settings/users", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    u = next((x for x in r.json() if x["email"] == SALES_EMAIL), None)
    assert u, "sales user not found"
    return u


@pytest.fixture(scope="module")
def sales_role(admin_headers):
    r = requests.get(f"{API}/roles", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    role = next((x for x in r.json() if x["name"] == SALES_ROLE_NAME), None)
    assert role, f"role {SALES_ROLE_NAME} not found"
    return role


def _set_role_scopes(admin_headers, role, scopes):
    """Update role scopes, also ensure write permission for write-required tests."""
    payload = {
        "name": role["name"],
        "permissions": role.get("permissions", {}) or {},
        "scopes": scopes,
    }
    r = requests.put(f"{API}/roles/{role['id']}", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, f"role update failed: {r.text}"
    return r.json()


# ---------- /api/sales-members bug fix ----------

def test_sales_members_returns_array(sales_headers):
    r = requests.get(f"{API}/sales-members", headers=sales_headers, timeout=15)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_sales_members_admin(admin_headers):
    r = requests.get(f"{API}/sales-members", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Role scopes persistence ----------

def test_role_post_put_persists_scopes(admin_headers):
    # Create a fresh role with scopes
    role_name = f"TEST_scoperole_{uuid.uuid4().hex[:6]}"
    scopes = {"tasks": "own", "members": "all", "meetings": "own"}
    payload = {"name": role_name, "permissions": {"tasks": "write"}, "scopes": scopes}
    r = requests.post(f"{API}/roles", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    created = r.json()
    assert created["scopes"] == scopes
    role_id = created["id"]

    # Re-GET and check persisted
    g = requests.get(f"{API}/roles", headers=admin_headers, timeout=15)
    roles = g.json()
    role = next(x for x in roles if x["id"] == role_id)
    assert role["scopes"] == scopes

    # PUT updates scopes
    new_scopes = {"tasks": "all", "sales": "own"}
    u = requests.put(
        f"{API}/roles/{role_id}",
        json={"name": role_name, "permissions": {"tasks": "write"}, "scopes": new_scopes},
        headers=admin_headers, timeout=15,
    )
    assert u.status_code == 200, u.text
    assert u.json()["scopes"] == new_scopes

    # Cleanup
    requests.delete(f"{API}/roles/{role_id}", headers=admin_headers, timeout=15)


def test_role_default_scope_is_all_when_omitted(admin_headers):
    role_name = f"TEST_noscope_{uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{API}/roles",
        json={"name": role_name, "permissions": {"tasks": "read"}},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200
    role_id = r.json()["id"]
    # scopes should either be {} or not set -> apply_scope treats as "all"
    assert r.json().get("scopes", {}) == {}
    requests.delete(f"{API}/roles/{role_id}", headers=admin_headers, timeout=15)


# ---------- Admin is never scoped ----------

def test_admin_sees_all_records(admin_headers):
    for path in ["tasks", "meetings", "members", "sales-leads", "project-events", "assemblies"]:
        r = requests.get(f"{API}/{path}", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"admin {path} -> {r.status_code} {r.text}"
        assert isinstance(r.json(), list)


# ---------- Scope=own filtering for each module ----------

def test_scope_own_filters_tasks(admin_headers, sales_headers, sales_role, sales_user):
    # Ensure sales role has write for tasks & scope=own
    _set_role_scopes(admin_headers, sales_role, {"tasks": "own", "sales": "all"})
    # Ensure write perm present
    requests.put(
        f"{API}/roles/{sales_role['id']}",
        json={
            "name": sales_role["name"],
            "permissions": {**(sales_role.get("permissions") or {}), "tasks": "write"},
            "scopes": {"tasks": "own"},
        },
        headers=admin_headers, timeout=15,
    )

    # Admin creates task owned by someone else
    admin_task = {
        "task_name": f"TEST_admin_task_{uuid.uuid4().hex[:6]}",
        "department": "IT",
        "assignee": "SomeoneElse",
        "responsible_person": "SomeoneElse",
        "priority": "Orta",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "Gözləyir",
    }
    r = requests.post(f"{API}/tasks", json=admin_task, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    admin_task_id = r.json()["id"]

    # Sales creates own task (assignee = own name)
    own_task = {
        "task_name": f"TEST_own_task_{uuid.uuid4().hex[:6]}",
        "department": "IT",
        "assignee": sales_user["name"],
        "responsible_person": sales_user["name"],
        "priority": "Orta",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "Gözləyir",
    }
    rc = requests.post(f"{API}/tasks", json=own_task, headers=sales_headers, timeout=15)
    assert rc.status_code == 200, f"sales create task failed: {rc.text}"
    own_task_id = rc.json()["id"]

    # Sales GET /tasks with scope=own -> sees own but not admin_task
    g = requests.get(f"{API}/tasks", headers=sales_headers, timeout=15)
    assert g.status_code == 200
    ids = [t["id"] for t in g.json()]
    assert own_task_id in ids, "sales should see own task"
    assert admin_task_id not in ids, "sales should NOT see admin's task under scope=own"

    # Sales PUT admin's task -> 403
    p = requests.put(
        f"{API}/tasks/{admin_task_id}",
        json={"status": "Tamamlandı"}, headers=sales_headers, timeout=15,
    )
    assert p.status_code == 403, f"expected 403 on non-own PUT, got {p.status_code} {p.text}"

    # Sales PUT own task -> 200
    p2 = requests.put(
        f"{API}/tasks/{own_task_id}",
        json={"status": "Tamamlandı"}, headers=sales_headers, timeout=15,
    )
    assert p2.status_code == 200, p2.text
    assert p2.json()["status"] == "Tamamlandı"

    # cleanup
    requests.delete(f"{API}/tasks/{admin_task_id}", headers=admin_headers, timeout=15)
    requests.delete(f"{API}/tasks/{own_task_id}", headers=admin_headers, timeout=15)

    # reset sales role scopes
    _set_role_scopes(admin_headers, sales_role, {})


def test_scope_own_filters_sales_leads(admin_headers, sales_headers, sales_role, sales_user):
    _set_role_scopes(admin_headers, sales_role, {"sales": "own"})

    # Ensure sales has write on sales
    requests.put(
        f"{API}/roles/{sales_role['id']}",
        json={
            "name": sales_role["name"],
            "permissions": {**(sales_role.get("permissions") or {}), "sales": "write"},
            "scopes": {"sales": "own"},
        },
        headers=admin_headers, timeout=15,
    )

    # Admin creates lead as admin (curator=admin)
    admin_lead = {"company_name": f"TEST_admin_lead_{uuid.uuid4().hex[:6]}", "contact_name": "X"}
    ra = requests.post(f"{API}/sales-leads", json=admin_lead, headers=admin_headers, timeout=15)
    assert ra.status_code == 200, ra.text
    admin_lead_id = ra.json()["id"]

    # Sales creates own lead
    own_lead = {"company_name": f"TEST_own_lead_{uuid.uuid4().hex[:6]}", "contact_name": "Y"}
    rs = requests.post(f"{API}/sales-leads", json=own_lead, headers=sales_headers, timeout=15)
    assert rs.status_code == 200, rs.text
    own_lead_id = rs.json()["id"]

    # Sales list -> only own
    g = requests.get(f"{API}/sales-leads", headers=sales_headers, timeout=15)
    assert g.status_code == 200
    ids = [x["id"] for x in g.json()]
    assert own_lead_id in ids
    assert admin_lead_id not in ids

    # Cleanup
    requests.delete(f"{API}/sales-leads/{admin_lead_id}", headers=admin_headers, timeout=15)
    requests.delete(f"{API}/sales-leads/{own_lead_id}", headers=admin_headers, timeout=15)
    _set_role_scopes(admin_headers, sales_role, {})


def test_scope_own_filters_meetings(admin_headers, sales_headers, sales_role, sales_user):
    _set_role_scopes(admin_headers, sales_role, {"meetings": "own"})
    # Admin creates meeting w/ employee = someone else
    mbase = {
        "meeting_type": "Daxili",
        "department": "IT",
        "meeting_setter": "Admin",
        "employee": "OtherPerson",
        "date": "2026-05-01",
        "time": "10:00",
        "company_name": "X",
        "contact_person": "Y",
        "contact_phone": "+994",
    }
    ra = requests.post(f"{API}/meetings", json=mbase, headers=admin_headers, timeout=15)
    assert ra.status_code == 200, ra.text
    admin_mid = ra.json()["id"]

    # Sales list meetings -> should NOT contain admin_mid
    g = requests.get(f"{API}/meetings", headers=sales_headers, timeout=15)
    assert g.status_code == 200
    ids = [x["id"] for x in g.json()]
    assert admin_mid not in ids, "sales should not see admin's meeting under scope=own"

    requests.delete(f"{API}/meetings/{admin_mid}", headers=admin_headers, timeout=15)
    _set_role_scopes(admin_headers, sales_role, {})


def test_scope_own_filters_members(admin_headers, sales_headers, sales_role):
    _set_role_scopes(admin_headers, sales_role, {"members": "own"})
    # Sales list members -> should return 200 list, filtered by curator/created_by=sales_user.name
    g = requests.get(f"{API}/members", headers=sales_headers, timeout=15)
    assert g.status_code == 200
    assert isinstance(g.json(), list)

    # compare with all (admin)
    ga = requests.get(f"{API}/members", headers=admin_headers, timeout=15)
    # sales count <= admin count
    assert len(g.json()) <= len(ga.json())
    _set_role_scopes(admin_headers, sales_role, {})


def test_scope_own_filters_projects_and_assemblies(admin_headers, sales_headers, sales_role):
    _set_role_scopes(admin_headers, sales_role, {"projects": "own", "assembly": "own"})

    for path in ["project-events", "assemblies"]:
        g = requests.get(f"{API}/{path}", headers=sales_headers, timeout=15)
        assert g.status_code == 200, f"{path} -> {g.status_code}"
        assert isinstance(g.json(), list)
        ga = requests.get(f"{API}/{path}", headers=admin_headers, timeout=15)
        assert len(g.json()) <= len(ga.json()), f"{path} scope=own should filter <= admin"

    _set_role_scopes(admin_headers, sales_role, {})


def test_scope_all_returns_all_for_sales(admin_headers, sales_headers, sales_role):
    # With scope=all (default), sales user should see tasks (read permission needed)
    _set_role_scopes(admin_headers, sales_role, {"tasks": "all"})
    g = requests.get(f"{API}/tasks", headers=sales_headers, timeout=15)
    assert g.status_code == 200
    sales_len = len(g.json())
    ga = requests.get(f"{API}/tasks", headers=admin_headers, timeout=15)
    # all scope: sales should see the full set (equal to admin's list at this moment)
    assert sales_len == len(ga.json())
    _set_role_scopes(admin_headers, sales_role, {})


def test_create_task_sales_200(admin_headers, sales_headers, sales_role):
    # Ensure sales can create tasks
    requests.put(
        f"{API}/roles/{sales_role['id']}",
        json={
            "name": sales_role["name"],
            "permissions": {**(sales_role.get("permissions") or {}), "tasks": "write"},
            "scopes": {},
        },
        headers=admin_headers, timeout=15,
    )
    payload = {
        "task_name": f"TEST_sales_create_{uuid.uuid4().hex[:6]}",
        "department": "IT",
        "assignee": "Me",
        "responsible_person": "Me",
        "priority": "Orta",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "Gözləyir",
    }
    r = requests.post(f"{API}/tasks", json=payload, headers=sales_headers, timeout=15)
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    requests.delete(f"{API}/tasks/{tid}", headers=admin_headers, timeout=15)
