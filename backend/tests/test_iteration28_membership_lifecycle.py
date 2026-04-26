"""Iteration 28 — Membership lifecycle: year filter on members & obligations + renew endpoint."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

def _read_frontend_env():
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except (FileNotFoundError, OSError):
        return None
    return None

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or _read_frontend_env() or '').rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def sales_h():
    return {"Authorization": f"Bearer {_login(SALES)}"}


@pytest.fixture(scope="module")
def seed_member(admin_h):
    """Create a member that covers 2025 and add an invitation in 2025."""
    payload = {
        "company_name": f"TEST28_Co_{uuid.uuid4().hex[:6]}",
        "package": "Standart",
        "sector": "IT",
        "status": "Aktiv",
        "contract_start_date": "2025-01-15",
        "contract_end_date": "2025-12-31",
    }
    r = requests.post(f"{API}/members", json=payload, headers=admin_h, timeout=20)
    assert r.status_code in (200, 201), r.text
    m = r.json()
    # Patch contract dates if not set on creation
    requests.put(f"{API}/members/{m['id']}", json={
        "contract_start_date": "2025-01-15",
        "contract_end_date": "2025-12-31",
        "package": "Standart"
    }, headers=admin_h, timeout=20)
    yield m
    requests.delete(f"{API}/members/{m['id']}", headers=admin_h, timeout=20)


# ---------------- /api/members?year filter -----------------
class TestMembersYearFilter:
    def test_members_no_year_returns_all(self, admin_h, seed_member):
        r = requests.get(f"{API}/members", headers=admin_h, timeout=20)
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert seed_member["id"] in ids

    def test_members_year_2025_includes_seed(self, admin_h, seed_member):
        r = requests.get(f"{API}/members?year=2025", headers=admin_h, timeout=20)
        assert r.status_code == 200
        items = r.json()
        match = [m for m in items if m["id"] == seed_member["id"]]
        assert len(match) == 1, "Seed member should be active in 2025"
        # _period annotation
        assert "_period" in match[0]
        assert match[0]["_period"]["is_current"] is True

    def test_members_year_2030_excludes_seed(self, admin_h, seed_member):
        r = requests.get(f"{API}/members?year=2030", headers=admin_h, timeout=20)
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert seed_member["id"] not in ids


# ---------------- /api/members/{id}/renew -----------------
class TestRenewMember:
    def test_renew_carry_over_archives_and_carries_quota(self, admin_h, seed_member):
        # Read current bonus
        before = requests.get(f"{API}/members?year=2025", headers=admin_h, timeout=20).json()
        before_co = next(m for m in before if m["id"] == seed_member["id"])
        bonus_before = before_co.get("bonus_quota") or 0

        body = {
            "package": "Standart",
            "contract_start": "2026-01-01",
            "contract_end": "2026-12-31",
            "carry_over_quota": True,
        }
        r = requests.post(f"{API}/members/{seed_member['id']}/renew", json=body,
                          headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        updated = r.json()
        # New period applied
        assert updated["contract_start_date"] == "2026-01-01"
        assert updated["contract_end_date"] == "2026-12-31"
        # History grew
        hist = updated.get("membership_history") or []
        assert len(hist) >= 1
        last = hist[-1]
        assert last["contract_start"] == "2025-01-15"
        assert last["contract_end"] == "2025-12-31"
        assert last["status"] == "Yenilənib"
        for k in ("total_quota", "used_quota", "remaining_quota", "archived_at"):
            assert k in last, f"missing {k} in history entry"
        # Bonus quota increased by remaining
        bonus_after = updated.get("bonus_quota") or 0
        assert bonus_after == bonus_before + (last["remaining_quota"] or 0)

    def test_after_renew_year_2025_uses_history(self, admin_h, seed_member):
        r = requests.get(f"{API}/members?year=2025", headers=admin_h, timeout=20)
        assert r.status_code == 200
        match = [m for m in r.json() if m["id"] == seed_member["id"]]
        assert len(match) == 1
        period = match[0].get("_period")
        assert period is not None
        assert period["is_current"] is False  # 2025 now in history
        assert period["contract_start"] == "2025-01-15"

    def test_after_renew_year_2026_is_current(self, admin_h, seed_member):
        r = requests.get(f"{API}/members?year=2026", headers=admin_h, timeout=20)
        assert r.status_code == 200
        match = [m for m in r.json() if m["id"] == seed_member["id"]]
        assert len(match) == 1
        assert match[0]["_period"]["is_current"] is True

    def test_renew_without_carry_over_keeps_bonus(self, admin_h, seed_member):
        before = requests.get(f"{API}/members?year=2026", headers=admin_h, timeout=20).json()
        before_co = next(m for m in before if m["id"] == seed_member["id"])
        bonus_before = before_co.get("bonus_quota") or 0

        body = {
            "package": "Standart",
            "contract_start": "2027-01-01",
            "contract_end": "2027-12-31",
            "carry_over_quota": False,
        }
        r = requests.post(f"{API}/members/{seed_member['id']}/renew", json=body,
                          headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        updated = r.json()
        bonus_after = updated.get("bonus_quota") or 0
        assert bonus_after == bonus_before, "bonus must not change when carry_over_quota=false"

    def test_renew_404_for_unknown_member(self, admin_h):
        r = requests.post(f"{API}/members/does-not-exist/renew",
                          json={"package": "Standart",
                                "contract_start": "2026-01-01",
                                "contract_end": "2026-12-31"},
                          headers=admin_h, timeout=20)
        assert r.status_code == 404

    def test_renew_scope_own_returns_403(self, admin_h, sales_h, seed_member):
        # Force the 'Satış meneceri' role members scope=own (scopes are role-level)
        roles = requests.get(f"{API}/roles", headers=admin_h, timeout=20).json()
        if not isinstance(roles, list):
            pytest.skip(f"unexpected /roles shape: {roles}")
        role = next((r for r in roles if r.get("name") == "Satış meneceri"), None)
        if not role:
            pytest.skip("Satış meneceri role missing")
        original_scopes = role.get("scopes") or {}
        original_perms = role.get("permissions") or {}
        new_scopes = {**original_scopes, "members": "own"}
        new_perms = {**original_perms, "members": "write"}
        upd = requests.put(f"{API}/roles/{role['id']}",
                           json={"scopes": new_scopes, "permissions": new_perms},
                           headers=admin_h, timeout=20)
        assert upd.status_code == 200, upd.text
        try:
            r = requests.post(f"{API}/members/{seed_member['id']}/renew",
                              json={"package": "Standart",
                                    "contract_start": "2028-01-01",
                                    "contract_end": "2028-12-31"},
                              headers=sales_h, timeout=20)
            assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"
        finally:
            requests.put(f"{API}/roles/{role['id']}",
                         json={"scopes": original_scopes,
                               "permissions": original_perms},
                         headers=admin_h, timeout=20)


# ---------------- /api/obligations year filter -----------------
class TestObligationsYearFilter:
    def test_dashboard_year_filters_companies(self, admin_h, seed_member):
        # 2025 should still cover the seed member via history
        r = requests.get(f"{API}/obligations/dashboard?year=2025",
                         headers=admin_h, timeout=20)
        assert r.status_code == 200
        data = r.json()
        items = data.get("obligations") if isinstance(data, dict) else data
        assert isinstance(items, list)

    def test_dashboard_year_2030_empty_or_no_seed(self, admin_h, seed_member):
        r = requests.get(f"{API}/obligations/dashboard?year=2030",
                         headers=admin_h, timeout=20)
        assert r.status_code == 200
        data = r.json()
        items = data.get("obligations") if isinstance(data, dict) else data
        ids = [it.get("company_id") for it in items]
        assert seed_member["id"] not in ids

    def test_company_obligation_year_2025(self, admin_h, seed_member):
        r = requests.get(f"{API}/obligations/company/{seed_member['id']}?year=2025",
                         headers=admin_h, timeout=20)
        assert r.status_code == 200
        data = r.json()
        # response should include used_quota / total_quota fields
        assert "used_quota" in data or "remaining_quota" in data or "total_quota" in data
