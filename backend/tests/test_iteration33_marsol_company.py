"""
Iteration 33: marsol_company field across Finance/Sales endpoints.

Covers:
- POST/PUT /api/finance/expenses with marsol_company
- PUT /api/companies/{id}/finance with marsol_company
- POST/PUT /api/sales-leads with marsol_company
- POST /api/sales-leads/{id}/payment with marsol_company
- GET /api/settings/marsol-companies returns entities and requires auth
- Regression: existing endpoints still work without marsol_company
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    tok = _login(ADMIN)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sales_headers():
    tok = _login(SALES)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --- /api/settings/marsol-companies ---
class TestMarsolCompaniesEndpoint:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/settings/marsol-companies", timeout=15)
        assert r.status_code in (401, 403)

    def test_returns_list_authenticated(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/settings/marsol-companies", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert all("name" in i for i in data)


# --- expense create/update with marsol_company ---
class TestExpenseMarsolCompany:
    def test_create_expense_with_marsol_company(self, admin_headers):
        payload = {
            "expense_name": "TEST_iter33_expense",
            "category": "Ofis",
            "amount": 100.0,
            "currency": "AZN",
            "date": "2026-01-15",
            "marsol_company": "Marsol Group",
        }
        r = requests.post(f"{BASE_URL}/api/finance/expenses", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["marsol_company"] == "Marsol Group"
        assert data["expense_name"] == "TEST_iter33_expense"
        eid = data["id"]

        # GET to verify persistence
        rg = requests.get(f"{BASE_URL}/api/finance/expenses", headers=admin_headers, timeout=15)
        assert rg.status_code == 200
        found = next((e for e in rg.json() if e["id"] == eid), None)
        assert found is not None
        assert found["marsol_company"] == "Marsol Group"

        # PUT update marsol_company
        ru = requests.put(
            f"{BASE_URL}/api/finance/expenses/{eid}",
            json={"marsol_company": "Marsol Events"},
            headers=admin_headers,
            timeout=15,
        )
        assert ru.status_code == 200
        assert ru.json()["marsol_company"] == "Marsol Events"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/finance/expenses/{eid}", headers=admin_headers, timeout=15)

    def test_create_expense_without_marsol_company_regression(self, admin_headers):
        payload = {
            "expense_name": "TEST_iter33_expense_no_marsol",
            "category": "Ofis",
            "amount": 50.0,
            "currency": "AZN",
            "date": "2026-01-15",
        }
        r = requests.post(f"{BASE_URL}/api/finance/expenses", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("marsol_company", "") == ""
        # Cleanup
        requests.delete(f"{BASE_URL}/api/finance/expenses/{data['id']}", headers=admin_headers, timeout=15)


# --- companies/{id}/finance with marsol_company ---
class TestCompanyFinanceMarsolCompany:
    @pytest.fixture(scope="class")
    def company_id(self, admin_headers):
        # Pick any existing company
        r = requests.get(f"{BASE_URL}/api/companies", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        comps = r.json()
        if not comps:
            pytest.skip("No companies in DB to test against")
        return comps[0]["id"]

    def test_update_marsol_company(self, admin_headers, company_id):
        r = requests.put(
            f"{BASE_URL}/api/companies/{company_id}/finance",
            json={"marsol_company": "Marsol Media"},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text

        rg = requests.get(f"{BASE_URL}/api/companies/{company_id}", headers=admin_headers, timeout=15)
        assert rg.status_code == 200
        assert rg.json().get("marsol_company") == "Marsol Media"

    def test_new_payment_amount_still_works(self, admin_headers, company_id):
        r = requests.put(
            f"{BASE_URL}/api/companies/{company_id}/finance",
            json={"new_payment_amount": 1, "payment_date": "2026-01-15", "payment_note": "TEST_iter33"},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text


# --- sales-leads with marsol_company ---
class TestSalesLeadMarsolCompany:
    def test_full_flow(self, sales_headers):
        # CREATE
        payload = {
            "company_name": "TEST_iter33_lead",
            "contact_name": "T",
            "phone": "+994500000000",
            "sale_type": "Üzvlük",
            "marsol_company": "Marsol Academy",
            "total_amount": 500,
        }
        r = requests.post(f"{BASE_URL}/api/sales-leads", json=payload, headers=sales_headers, timeout=15)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["marsol_company"] == "Marsol Academy"
        lid = lead["id"]

        # GET to verify
        rg = requests.get(f"{BASE_URL}/api/sales-leads", headers=sales_headers, timeout=15)
        assert rg.status_code == 200
        found = next((l for l in rg.json() if l["id"] == lid), None)
        assert found is not None
        assert found["marsol_company"] == "Marsol Academy"

        # PUT updates marsol_company
        ru = requests.put(
            f"{BASE_URL}/api/sales-leads/{lid}",
            json={"marsol_company": "Marsol Group"},
            headers=sales_headers,
            timeout=15,
        )
        assert ru.status_code == 200, ru.text

        rg2 = requests.get(f"{BASE_URL}/api/sales-leads", headers=sales_headers, timeout=15)
        found = next((l for l in rg2.json() if l["id"] == lid), None)
        assert found["marsol_company"] == "Marsol Group"

        # POST payment with marsol_company override
        rp = requests.post(
            f"{BASE_URL}/api/sales-leads/{lid}/payment",
            json={"new_payment_amount": 100, "payment_date": "2026-01-15", "marsol_company": "Marsol Events"},
            headers=sales_headers,
            timeout=15,
        )
        assert rp.status_code == 200, rp.text

        rg3 = requests.get(f"{BASE_URL}/api/sales-leads", headers=sales_headers, timeout=15)
        found = next((l for l in rg3.json() if l["id"] == lid), None)
        assert found["marsol_company"] == "Marsol Events"
        assert float(found.get("paid_amount") or 0) >= 100

        # Cleanup
        requests.delete(f"{BASE_URL}/api/sales-leads/{lid}", headers=sales_headers, timeout=15)
