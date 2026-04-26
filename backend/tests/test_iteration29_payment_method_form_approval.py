"""
Iteration 29 — payment_method on finance + form approval flow.

Tests:
- expense/income payment_method persistence
- companies finance payment_method in payment_history
- sales-leads payment payment_method in payment_history
- public form submission writes to pending_form_data (NOT main fields)
- notifications include 'form_submission' for pending forms
- approve-form moves pending_form_data into real fields and clears pending_*
- reject-form clears pending_form_data, sets status=Rədd edildi
- approve/reject return 400 if no pending data
- scope=own user trying to approve admin's company → 403
"""
import os
import uuid
import pytest
import requests

def _read_env(key):
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return None
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def sales_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=SALES, timeout=15)
    if r.status_code != 200:
        pytest.skip("Sales user login failed")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def sales_h(sales_token):
    return {"Authorization": f"Bearer {sales_token}"}


@pytest.fixture
def temp_company(admin_h):
    payload = {
        "brand_name": f"TEST29_Co_{uuid.uuid4().hex[:6]}",
        "owner_name": "TEST29 Owner",
        "owner_phone": "+994500000001",
        "company_email": "test29@example.com",
    }
    r = requests.post(f"{BASE_URL}/api/companies", json=payload, headers=admin_h, timeout=15)
    assert r.status_code in (200, 201), r.text
    cid = r.json()["id"]
    yield cid
    requests.delete(f"{BASE_URL}/api/companies/{cid}", headers=admin_h, timeout=15)


# ---------- 1. expense payment_method ----------
class TestExpenseIncomePaymentMethod:
    def test_expense_payment_method_persists(self, admin_h):
        payload = {
            "expense_name": "TEST29_Expense",
            "category": "Ofis",
            "amount": 50,
            "currency": "AZN",
            "date": "2026-01-10",
            "payment_method": "Köçürmə",
        }
        r = requests.post(f"{BASE_URL}/api/finance/expenses", json=payload, headers=admin_h, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("payment_method") == "Köçürmə"
        eid = body["id"]
        # Verify via GET
        g = requests.get(f"{BASE_URL}/api/finance/expenses", headers=admin_h, timeout=15)
        assert g.status_code == 200
        match = [e for e in g.json() if e.get("id") == eid]
        assert len(match) == 1
        assert match[0].get("payment_method") == "Köçürmə"
        # cleanup
        requests.delete(f"{BASE_URL}/api/finance/expenses/{eid}", headers=admin_h, timeout=15)

    @pytest.mark.parametrize("method", ["Nəğd", "Posterminal", "CTC"])
    def test_expense_other_methods(self, admin_h, method):
        payload = {
            "expense_name": f"TEST29_Exp_{method}",
            "category": "Ofis",
            "amount": 10,
            "date": "2026-01-10",
            "payment_method": method,
        }
        r = requests.post(f"{BASE_URL}/api/finance/expenses", json=payload, headers=admin_h, timeout=15)
        assert r.status_code in (200, 201), r.text
        assert r.json().get("payment_method") == method
        requests.delete(f"{BASE_URL}/api/finance/expenses/{r.json()['id']}", headers=admin_h, timeout=15)

    def test_income_payment_method_persists(self, admin_h, temp_company):
        payload = {
            "company_id": temp_company,
            "company_name": "TEST29_Co",
            "owner_name": "TEST29",
            "marsol_representative": "Admin",
            "project": "Test29",
            "package": "Standart",
            "amount": 100,
            "paid_amount": 100,
            "payment_method": "Posterminal",
        }
        r = requests.post(f"{BASE_URL}/api/finance/incomes", json=payload, headers=admin_h, timeout=15)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("payment_method") == "Posterminal"


# ---------- 2. companies finance payment payment_method ----------
class TestCompanyPaymentMethod:
    def test_company_payment_records_method(self, admin_h, temp_company):
        # First set total_amount
        requests.put(
            f"{BASE_URL}/api/companies/{temp_company}/finance",
            json={"total_amount": 500},
            headers=admin_h, timeout=15
        )
        # Now add a payment with method
        r = requests.put(
            f"{BASE_URL}/api/companies/{temp_company}/finance",
            json={
                "new_payment_amount": 200,
                "payment_date": "2026-01-15",
                "payment_method": "CTC",
                "payment_note": "TEST29 partial",
            },
            headers=admin_h, timeout=15
        )
        assert r.status_code == 200, r.text
        # Get payment history
        h = requests.get(f"{BASE_URL}/api/companies/{temp_company}/payments", headers=admin_h, timeout=15)
        assert h.status_code == 200
        payments = h.json()
        assert len(payments) >= 1
        latest = payments[0]  # sorted desc
        assert latest.get("payment_method") == "CTC"
        assert latest.get("amount") == 200


# ---------- 3. sales-leads payment_method ----------
class TestSalesLeadPaymentMethod:
    def test_sales_lead_payment_records_method(self, admin_h):
        # Create a sales-lead
        lead_payload = {
            "company_name": f"TEST29_Lead_{uuid.uuid4().hex[:5]}",
            "owner_name": "Lead Owner",
            "phone": "+994500000099",
            "project": "TestProj",
            "amount": 1000,
            "paid_amount": 0,
        }
        c = requests.post(f"{BASE_URL}/api/sales-leads", json=lead_payload, headers=admin_h, timeout=15)
        assert c.status_code in (200, 201), c.text
        lead_id = c.json()["id"]
        try:
            r = requests.post(
                f"{BASE_URL}/api/sales-leads/{lead_id}/payment",
                json={
                    "new_payment_amount": 250,
                    "payment_date": "2026-01-20",
                    "payment_method": "Nəğd",
                    "payment_note": "TEST29 lead pay",
                },
                headers=admin_h, timeout=15
            )
            assert r.status_code == 200, r.text
            data = r.json()
            history = data.get("payment_history", [])
            assert len(history) >= 1
            assert history[-1].get("payment_method") == "Nəğd"
            assert history[-1].get("amount") == 250
        finally:
            requests.delete(f"{BASE_URL}/api/sales-leads/{lead_id}", headers=admin_h, timeout=15)


# ---------- 4. public form submission flow ----------
class TestPublicFormFlow:
    def _make_token(self, admin_h, company_id):
        r = requests.post(f"{BASE_URL}/api/forum/generate-link/{company_id}", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()["token"]

    def test_submit_writes_to_pending_only(self, admin_h, temp_company):
        # Get company before submission
        before = requests.get(f"{BASE_URL}/api/companies/{temp_company}", headers=admin_h, timeout=15).json()
        original_phone = before.get("company_phone", "")
        original_email = before.get("company_email", "")
        token = self._make_token(admin_h, temp_company)
        # Submit
        new_phone = "+994559999999"
        new_email = "PENDING_NEW@example.com"
        r = requests.post(
            f"{BASE_URL}/api/public/form/{token}",
            json={"company_phone": new_phone, "company_email": new_email},
            timeout=15
        )
        assert r.status_code == 200, r.text
        # Verify main fields NOT changed
        after = requests.get(f"{BASE_URL}/api/companies/{temp_company}", headers=admin_h, timeout=15).json()
        assert after.get("company_phone", "") == original_phone, "company_phone must NOT change before approval"
        assert after.get("company_email", "") == original_email, "company_email must NOT change before approval"
        # Verify pending_form_data exists
        assert after.get("pending_form_data") is not None
        pending = after["pending_form_data"]
        # at least one of phone/email present
        assert pending.get("company_phone") == new_phone or pending.get("company_email") == new_email
        assert after.get("pending_form_status") == "Gözləyir"
        assert after.get("pending_form_submitted_at")

    def test_notifications_include_form_submission(self, admin_h, temp_company):
        token = self._make_token(admin_h, temp_company)
        requests.post(
            f"{BASE_URL}/api/public/form/{token}",
            json={"company_phone": "+994551111111"},
            timeout=15
        )
        n = requests.get(f"{BASE_URL}/api/notifications", headers=admin_h, timeout=20)
        assert n.status_code == 200, n.text
        notes = n.json()
        if isinstance(notes, dict):
            notes = notes.get("notifications", notes.get("items", []))
        target_id = f"form-pending-{temp_company}"
        match = [x for x in notes if x.get("id") == target_id]
        assert len(match) == 1, f"Expected exactly 1 form-submission notification, got {len(match)}"
        assert match[0].get("type") == "form_submission"

    def test_approve_form_moves_pending_to_real(self, admin_h, temp_company):
        token = self._make_token(admin_h, temp_company)
        new_phone = "+994559876543"
        requests.post(f"{BASE_URL}/api/public/form/{token}",
                      json={"company_phone": new_phone}, timeout=15)
        # Approve
        a = requests.post(
            f"{BASE_URL}/api/companies/{temp_company}/approve-form",
            headers=admin_h, timeout=15
        )
        assert a.status_code == 200, a.text
        # Verify
        after = requests.get(f"{BASE_URL}/api/companies/{temp_company}", headers=admin_h, timeout=15).json()
        assert after.get("company_phone") == new_phone
        # pending fields cleared
        assert not after.get("pending_form_data"), "pending_form_data should be cleared"
        assert not after.get("pending_form_status"), "pending_form_status should be cleared"
        assert not after.get("pending_form_submitted_at"), "pending_form_submitted_at should be cleared"

    def test_reject_form_clears_pending_with_reason(self, admin_h, temp_company):
        token = self._make_token(admin_h, temp_company)
        requests.post(f"{BASE_URL}/api/public/form/{token}",
                      json={"company_phone": "+994551234567"}, timeout=15)
        r = requests.post(
            f"{BASE_URL}/api/companies/{temp_company}/reject-form",
            json={"reason": "Yanlış məlumat"},
            headers=admin_h, timeout=15
        )
        assert r.status_code == 200, r.text
        after = requests.get(f"{BASE_URL}/api/companies/{temp_company}", headers=admin_h, timeout=15).json()
        assert not after.get("pending_form_data")
        assert after.get("pending_form_status") == "Rədd edildi"
        assert after.get("pending_form_reject_reason") == "Yanlış məlumat"

    def test_approve_with_no_pending_returns_400(self, admin_h, temp_company):
        # Make sure no pending data
        r = requests.post(
            f"{BASE_URL}/api/companies/{temp_company}/approve-form",
            headers=admin_h, timeout=15
        )
        assert r.status_code == 400, r.text

    def test_reject_with_no_pending_returns_400(self, admin_h, temp_company):
        r = requests.post(
            f"{BASE_URL}/api/companies/{temp_company}/reject-form",
            json={"reason": "no"},
            headers=admin_h, timeout=15
        )
        assert r.status_code == 400, r.text


# ---------- 5. scope=own forbidden for non-owner approve ----------
class TestScopeOwnApprove:
    def test_sales_own_scope_cannot_approve_admin_company(self, admin_h, sales_h, sales_token, temp_company):
        # Generate token + submit as admin first
        gen = requests.post(f"{BASE_URL}/api/forum/generate-link/{temp_company}", headers=admin_h, timeout=15)
        assert gen.status_code == 200
        tk = gen.json()["token"]
        requests.post(f"{BASE_URL}/api/public/form/{tk}",
                      json={"company_phone": "+994500000077"}, timeout=15)

        # Inspect sales user role + scope
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=sales_h, timeout=15)
        if me.status_code != 200:
            pytest.skip("Cannot fetch sales user")
        user = me.json()
        role_name = user.get("role")
        if not role_name:
            pytest.skip("Sales user has no role")

        # Get role
        roles = requests.get(f"{BASE_URL}/api/roles", headers=admin_h, timeout=15).json()
        role = next((r for r in roles if r.get("name") == role_name), None)
        if not role:
            pytest.skip("Role not found")

        # Save original
        original_perms = role.get("permissions", {})
        original_scopes = role.get("scopes", {})
        # Set companies:write + scopes.companies='own'
        new_perms = dict(original_perms)
        new_perms["companies"] = "write"
        new_scopes = dict(original_scopes)
        new_scopes["companies"] = "own"
        role_id = role.get("id") or role.get("_id")
        upd = requests.put(
            f"{BASE_URL}/api/roles/{role_id}",
            json={"permissions": new_perms, "scopes": new_scopes},
            headers=admin_h, timeout=15
        )
        try:
            if upd.status_code not in (200, 201):
                pytest.skip(f"Cannot update role: {upd.status_code} {upd.text}")
            # Try approve as sales (company is owned by admin or unowned -- not sales)
            r = requests.post(
                f"{BASE_URL}/api/companies/{temp_company}/approve-form",
                headers=sales_h, timeout=15
            )
            assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        finally:
            # Restore role
            requests.put(
                f"{BASE_URL}/api/roles/{role_id}",
                json={"permissions": original_perms, "scopes": original_scopes},
                headers=admin_h, timeout=15
            )
