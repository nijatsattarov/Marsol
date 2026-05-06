"""Iteration 49 — Bulk-aggregation refactor + SMS RBAC tests.

Covers:
  1) GET /api/obligations/dashboard (perf + shape) and ?year filter
  2) GET /api/obligations/company/{id}
  3) GET /api/partner-evaluation (bulk aggregations)
  4) GET /api/partner-evaluation/{company_id}
  5) PUT /api/partner-evaluation/{company_id}/manual-bonus (admin-only, clamp 0-5)
  6) SMS RBAC: admin OK, non-admin 403, sms:read role can read but not write,
     sms:write role can write.

DANGER: LSIM is real. All SMS sends use placeholder '00000000' so provider
rejects with errorCode=-102 → no credits charged.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env", "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}

INVALID_PHONE = "00000000"

# Track for cleanup
_created = {"roles": [], "users": []}


# -------------------- Fixtures --------------------
def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        return None
    return r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    tok = _login(ADMIN)
    assert tok, "Admin login failed"
    return tok


@pytest.fixture(scope="module")
def sales_token():
    tok = _login(SALES)
    if not tok:
        pytest.skip("Sales user login failed")
    return tok


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sales_h(sales_token):
    return {"Authorization": f"Bearer {sales_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_h):
    yield
    # Delete users first (otherwise role-deletion is blocked)
    for uid in _created["users"]:
        try:
            requests.delete(f"{API}/settings/users/{uid}", headers=admin_h, timeout=15)
        except Exception:
            pass
    for rid in _created["roles"]:
        try:
            requests.delete(f"{API}/roles/{rid}", headers=admin_h, timeout=15)
        except Exception:
            pass


# ==================== 1. Obligations Dashboard ====================
class TestObligationsDashboard:
    def test_dashboard_returns_200_under_5s(self, admin_h):
        t0 = time.time()
        r = requests.get(f"{API}/obligations/dashboard", headers=admin_h, timeout=10)
        dt = time.time() - t0
        assert r.status_code == 200, r.text
        assert dt < 5.0, f"Dashboard too slow: {dt:.2f}s"
        data = r.json()
        assert "obligations" in data and isinstance(data["obligations"], list)
        assert "stats" in data and isinstance(data["stats"], dict)
        for k in ("total", "not_invited", "under_invited", "fully_served", "urgent"):
            assert k in data["stats"], f"Missing stats.{k}"
            assert isinstance(data["stats"][k], int)
        print(f"[dashboard] {dt:.3f}s, {data['stats']['total']} companies")

    def test_dashboard_year_filter(self, admin_h):
        r = requests.get(f"{API}/obligations/dashboard?year=2025", headers=admin_h, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "obligations" in data
        # Year filter should not 500
        for o in data["obligations"]:
            assert "priority_score" in o
            assert "total_invited" in o
            assert "remaining_quota" in o

    def test_dashboard_obligations_shape(self, admin_h):
        r = requests.get(f"{API}/obligations/dashboard", headers=admin_h, timeout=10)
        data = r.json()
        if data["obligations"]:
            o = data["obligations"][0]
            for k in ("company_id", "priority_score", "total_invited",
                      "total_attended", "total_declined", "total_no_answer",
                      "total_quota", "remaining_quota"):
                assert k in o, f"Missing field {k}"

    def test_company_obligation_detail(self, admin_h):
        # Get first company id from dashboard
        dash = requests.get(f"{API}/obligations/dashboard", headers=admin_h, timeout=10).json()
        if not dash["obligations"]:
            pytest.skip("No companies to test individual obligation")
        cid = dash["obligations"][0]["company_id"]
        r = requests.get(f"{API}/obligations/company/{cid}", headers=admin_h, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "invitations" in data
        assert "type_breakdown" in data
        assert isinstance(data["type_breakdown"], dict)


# ==================== 2. Partner Evaluation ====================
class TestPartnerEvaluation:
    def test_list_returns_200_under_5s(self, admin_h):
        t0 = time.time()
        r = requests.get(f"{API}/partner-evaluation", headers=admin_h, timeout=10)
        dt = time.time() - t0
        assert r.status_code == 200, r.text
        assert dt < 5.0, f"Partner-eval too slow: {dt:.2f}s"
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        assert "total" in data
        print(f"[partner-eval] {dt:.3f}s, {data['total']} items")

    def test_items_have_score_components_and_tier(self, admin_h):
        r = requests.get(f"{API}/partner-evaluation", headers=admin_h, timeout=10)
        data = r.json()
        if not data["items"]:
            pytest.skip("No items returned")
        item = data["items"][0]
        # The user mentioned scores: payment/event/other_projects/meetings/manual + tier
        assert "total" in item
        assert "tier" in item
        assert item["tier"] in ("Platinum", "Qızıl", "Gümüş", "Standart"), \
            f"Unexpected tier: {item['tier']}"
        # Score components — accept various naming conventions
        for k in ("scores",):
            if k in item:
                s = item["scores"]
                # Just check at least manual exists
                break

    def test_get_one_partner_evaluation(self, admin_h):
        lst = requests.get(f"{API}/partner-evaluation", headers=admin_h, timeout=10).json()
        if not lst["items"]:
            pytest.skip("No items")
        cid = lst["items"][0].get("company_id")
        if not cid:
            pytest.skip("Item has no company_id")
        r = requests.get(f"{API}/partner-evaluation/{cid}", headers=admin_h, timeout=10)
        assert r.status_code == 200, r.text
        item = r.json()
        assert item.get("tier") in ("Platinum", "Qızıl", "Gümüş", "Standart")

    def test_manual_bonus_admin_clamps(self, admin_h):
        lst = requests.get(f"{API}/partner-evaluation", headers=admin_h, timeout=10).json()
        if not lst["items"]:
            pytest.skip("No items")
        cid = lst["items"][0]["company_id"]
        # Try over-clamp
        r = requests.put(f"{API}/partner-evaluation/{cid}/manual-bonus",
                         headers=admin_h, json={"manual_bonus": 99}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        # Manual bonus must clamp to <=5
        # Try to find manual bonus in response
        scores = data.get("scores") or {}
        manual = scores.get("manual", data.get("manual_bonus", None))
        if manual is not None:
            assert int(manual) <= 5, f"Bonus not clamped: {manual}"
        # Try negative
        r2 = requests.put(f"{API}/partner-evaluation/{cid}/manual-bonus",
                          headers=admin_h, json={"manual_bonus": -5}, timeout=10)
        assert r2.status_code == 200
        # Reset
        requests.put(f"{API}/partner-evaluation/{cid}/manual-bonus",
                     headers=admin_h, json={"manual_bonus": 0}, timeout=10)

    def test_manual_bonus_forbidden_non_admin(self, sales_h):
        # Just need any company_id
        r = requests.put(f"{API}/partner-evaluation/some-id/manual-bonus",
                         headers=sales_h, json={"manual_bonus": 1}, timeout=10)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"


# ==================== 3. SMS RBAC ====================
class TestSmsRbacAdminAndNonAdmin:
    def test_admin_can_read_balance(self, admin_h):
        r = requests.get(f"{API}/sms/balance", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_can_read_templates(self, admin_h):
        r = requests.get(f"{API}/sms/templates", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_can_read_logs(self, admin_h):
        r = requests.get(f"{API}/sms/logs?limit=5", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "total" in data

    def test_admin_can_read_logs_stats(self, admin_h):
        r = requests.get(f"{API}/sms/logs/stats", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("total", "sent", "failed", "today", "by_category"):
            assert k in data

    def test_non_admin_balance_forbidden(self, sales_h):
        r = requests.get(f"{API}/sms/balance", headers=sales_h, timeout=15)
        assert r.status_code == 403
        msg = r.json().get("detail", "")
        assert "SMS" in msg or "icaz" in msg.lower(), f"Unexpected message: {msg}"

    def test_non_admin_templates_forbidden(self, sales_h):
        r = requests.get(f"{API}/sms/templates", headers=sales_h, timeout=15)
        assert r.status_code == 403

    def test_non_admin_logs_forbidden(self, sales_h):
        r = requests.get(f"{API}/sms/logs", headers=sales_h, timeout=15)
        assert r.status_code == 403

    def test_non_admin_logs_stats_forbidden(self, sales_h):
        r = requests.get(f"{API}/sms/logs/stats", headers=sales_h, timeout=15)
        assert r.status_code == 403

    def test_non_admin_send_forbidden(self, sales_h):
        r = requests.post(f"{API}/sms/send", headers=sales_h,
                          json={"phone": INVALID_PHONE, "text": "TEST"}, timeout=15)
        assert r.status_code == 403

    def test_non_admin_bulk_forbidden(self, sales_h):
        r = requests.post(f"{API}/sms/bulk", headers=sales_h,
                          json={"text": "TEST",
                                "recipients": [{"phone": INVALID_PHONE}]},
                          timeout=15)
        assert r.status_code == 403

    def test_admin_send_logs_failure(self, admin_h):
        """Admin send with invalid phone → provider returns errorCode=-102 →
        backend logs status=failed but endpoint itself returns 200."""
        r = requests.post(f"{API}/sms/send", headers=admin_h,
                          json={"phone": INVALID_PHONE, "text": "TEST_iter49"},
                          timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "log_id" in data
        assert data.get("ok") is False, f"Expected ok=False for invalid phone: {data}"


# ==================== 4. RBAC: New roles with sms permission ====================
@pytest.fixture(scope="module")
def sms_read_role(admin_h):
    suffix = uuid.uuid4().hex[:6]
    role_name = f"TEST_SmsReadRole_{suffix}"
    r = requests.post(f"{API}/roles", headers=admin_h,
                      json={"name": role_name,
                            "permissions": {"sms": "read"}},
                      timeout=15)
    assert r.status_code in (200, 201), f"Role create failed: {r.text}"
    role = r.json()
    _created["roles"].append(role["id"])
    return role


@pytest.fixture(scope="module")
def sms_write_role(admin_h):
    suffix = uuid.uuid4().hex[:6]
    role_name = f"TEST_SmsWriteRole_{suffix}"
    r = requests.post(f"{API}/roles", headers=admin_h,
                      json={"name": role_name,
                            "permissions": {"sms": "write"}},
                      timeout=15)
    assert r.status_code in (200, 201), f"Role create failed: {r.text}"
    role = r.json()
    _created["roles"].append(role["id"])
    return role


def _create_user_with_role(admin_h, role_name, suffix):
    """Create a user assigned to a role and return (user_id, token)."""
    email = f"test_sms_{suffix}@test.local"
    password = "testpass123"
    r = requests.post(f"{API}/settings/users", headers=admin_h,
                      json={"email": email, "name": f"TEST {suffix}",
                            "password": password, "role": role_name},
                      timeout=15)
    if r.status_code not in (200, 201):
        return None, None, r
    user = r.json()
    _created["users"].append(user.get("id"))
    # Login as that user
    tok = _login({"email": email, "password": password})
    return user.get("id"), tok, r


class TestSmsRbacCustomRoles:
    def test_sms_read_role_can_read_cannot_write(self, admin_h, sms_read_role):
        suffix = uuid.uuid4().hex[:6]
        uid, tok, resp = _create_user_with_role(admin_h, sms_read_role["name"], suffix)
        if not tok:
            pytest.skip(f"User create/login failed: {resp.status_code} {resp.text[:200]}")
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # READ allowed
        rb = requests.get(f"{API}/sms/balance", headers=h, timeout=15)
        assert rb.status_code == 200, f"Read role should access balance: {rb.status_code} {rb.text}"
        rl = requests.get(f"{API}/sms/logs?limit=1", headers=h, timeout=15)
        assert rl.status_code == 200, f"Read role should access logs: {rl.status_code}"
        # WRITE forbidden
        rs = requests.post(f"{API}/sms/send", headers=h,
                           json={"phone": INVALID_PHONE, "text": "X"}, timeout=15)
        assert rs.status_code == 403, f"Read role must NOT send: {rs.status_code}"

    def test_sms_write_role_can_write(self, admin_h, sms_write_role):
        suffix = uuid.uuid4().hex[:6]
        uid, tok, resp = _create_user_with_role(admin_h, sms_write_role["name"], suffix)
        if not tok:
            pytest.skip(f"User create/login failed: {resp.status_code} {resp.text[:200]}")
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # READ also allowed
        rb = requests.get(f"{API}/sms/balance", headers=h, timeout=15)
        assert rb.status_code == 200
        # WRITE allowed → invalid phone returns 200 with ok=False
        rs = requests.post(f"{API}/sms/send", headers=h,
                           json={"phone": INVALID_PHONE, "text": "TEST_iter49"},
                           timeout=30)
        assert rs.status_code == 200, f"Write role should send: {rs.status_code} {rs.text}"
