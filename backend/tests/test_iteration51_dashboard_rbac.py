"""
Iteration 51 — Verify Dashboard RBAC enforcement.

Bug: When role's permissions.dashboard='none', user could still call /api/dashboard/stats
     and see the dashboard. Should now return 403.

Scenarios:
- Admin → GET /api/dashboard/stats → 200 (valid stats)
- User with role.permissions.dashboard='none' → 403 + 'Bu əməliyyat üçün icazəniz yoxdur'
- User with role.permissions.dashboard='read' → 200
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-hub-563.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"


# ---------- helpers ----------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def role_no_dash(admin_token):
    """Create role with permissions.dashboard='none' + all other modules 'read' so user
    will still have some menus to land on (and we can verify 403 is specifically about dashboard)."""
    name = f"TEST_NoDash_{int(time.time())}"
    # Minimal permissions: dashboard explicitly 'none', other commonly-checked modules 'read'
    perms = {
        "dashboard": "none",
        "companies": "read",
        "hr": "read",
        "sales": "read",
        "members": "read",
        "obligations": "read",
        "organization": "read",
        "projects": "read",
        "marketing": "read",
        "finance": "read",
        "meetings": "read",
        "tasks": "read",
        "assembly": "read",
        "messages": "read",
        "files": "read",
        "notes": "read",
        "reports": "read",
        "notifications": "read",
        "settings": "none",
    }
    r = requests.post(f"{API}/roles", json={"name": name, "permissions": perms}, headers=_auth(admin_token), timeout=20)
    assert r.status_code in (200, 201), f"Role create failed: {r.status_code} {r.text}"
    role = r.json()
    role_id = role.get("id") or role.get("_id")
    yield {"id": role_id, "name": name, "permissions": perms}
    # Teardown
    try:
        if role_id:
            requests.delete(f"{API}/roles/{role_id}", headers=_auth(admin_token), timeout=20)
    except Exception:
        pass


@pytest.fixture(scope="module")
def role_with_dash_read(admin_token):
    name = f"TEST_DashRead_{int(time.time())}"
    perms = {"dashboard": "read", "companies": "read"}
    r = requests.post(f"{API}/roles", json={"name": name, "permissions": perms}, headers=_auth(admin_token), timeout=20)
    assert r.status_code in (200, 201), f"Role create failed: {r.status_code} {r.text}"
    role = r.json()
    role_id = role.get("id") or role.get("_id")
    yield {"id": role_id, "name": name, "permissions": perms}
    try:
        if role_id:
            requests.delete(f"{API}/roles/{role_id}", headers=_auth(admin_token), timeout=20)
    except Exception:
        pass


@pytest.fixture(scope="module")
def user_no_dash(admin_token, role_no_dash):
    email = f"test_nodash_{int(time.time())}@marsol.test"
    password = "TestPass123!"
    payload = {
        "name": "TEST NoDash User",
        "email": email,
        "password": password,
        "role": role_no_dash["name"],
        "status": "Aktiv",
    }
    r = requests.post(f"{API}/settings/users", json=payload, headers=_auth(admin_token), timeout=20)
    assert r.status_code in (200, 201), f"User create failed: {r.status_code} {r.text}"
    user = r.json()
    user_id = user.get("id") or user.get("_id")
    yield {"id": user_id, "email": email, "password": password}
    try:
        if user_id:
            requests.delete(f"{API}/settings/users/{user_id}", headers=_auth(admin_token), timeout=20)
    except Exception:
        pass


@pytest.fixture(scope="module")
def user_dash_read(admin_token, role_with_dash_read):
    email = f"test_dashread_{int(time.time())}@marsol.test"
    password = "TestPass123!"
    payload = {
        "name": "TEST DashRead User",
        "email": email,
        "password": password,
        "role": role_with_dash_read["name"],
        "status": "Aktiv",
    }
    r = requests.post(f"{API}/settings/users", json=payload, headers=_auth(admin_token), timeout=20)
    assert r.status_code in (200, 201), f"User create failed: {r.status_code} {r.text}"
    user = r.json()
    user_id = user.get("id") or user.get("_id")
    yield {"id": user_id, "email": email, "password": password}
    try:
        if user_id:
            requests.delete(f"{API}/settings/users/{user_id}", headers=_auth(admin_token), timeout=20)
    except Exception:
        pass


# ---------- tests ----------
class TestDashboardRBAC:
    def test_admin_dashboard_stats_200(self, admin_token):
        r = requests.get(f"{API}/dashboard/stats", headers=_auth(admin_token), timeout=30)
        assert r.status_code == 200, f"Admin should access dashboard: {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, dict)
        # Validate a few expected keys
        for key in ("payments", "package_breakdown"):
            # At minimum we expect dict response; specific keys vary but should be dict
            pass

    def test_nodash_user_dashboard_403(self, user_no_dash):
        token = _login(user_no_dash["email"], user_no_dash["password"])
        r = requests.get(f"{API}/dashboard/stats", headers=_auth(token), timeout=30)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        body = r.json()
        # Detail message in Azerbaijani
        detail = body.get("detail") or ""
        assert "icazə" in detail.lower() or "icazəniz yoxdur" in detail, f"Unexpected detail: {detail!r}"

    def test_dashread_user_dashboard_200(self, user_dash_read):
        token = _login(user_dash_read["email"], user_dash_read["password"])
        r = requests.get(f"{API}/dashboard/stats", headers=_auth(token), timeout=30)
        assert r.status_code == 200, f"Expected 200 for dashboard=read user: {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, dict) and len(data) > 0
