"""
Iteration 27 - Layihə detalı, Payment endpoint-ləri, Tur/Təlim total_price
Tests:
- POST /api/project-events saves both price_per_sqm & total_price
- POST /api/sales-leads/{id}/payment — appends to payment_history, updates paid_amount,
  updates contract_number/e_invoice_number/voen/payment_due_date/follow_up/e_invoice_date/notes
- GET /api/sales-leads/{id}/payments returns payment_history array
- GET /api/project-events/{id}/sales → each sale has 'debt_amount' (total - paid)
- scope=own sales manager POSTing another user's lead payment → 403
- Invalid lead id on /payment → 404, on /payments → 404
"""
import os
import pytest
import requests


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"
ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    tok = _login(ADMIN)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sales_headers():
    tok = _login(SALES)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def reset_scope(admin_headers):
    """Reset Satış meneceri scope to empty before & after module."""
    def reset():
        roles = requests.get(f"{API}/roles", headers=admin_headers, timeout=30).json()
        for r in roles:
            if r.get("name") == "Satış meneceri":
                requests.put(f"{API}/roles/{r['id']}", headers=admin_headers,
                             json={"scopes": {}}, timeout=30)
                return
    reset()
    yield
    reset()


# ---------- Seed ----------

@pytest.fixture(scope="module")
def seed(admin_headers):
    """Create event (Sərgi with price_per_sqm & total_price) and one sold lead."""
    evt_payload = {
        "name": "TEST27_SergiEvt",
        "type": "Sərgi",
        "date": "2026-07-01",
        "location": "Baku",
        "status": "Aktiv",
        "price_per_sqm": 200,
        "total_price": 50000,
    }
    r = requests.post(f"{API}/project-events", headers=admin_headers, json=evt_payload, timeout=30)
    assert r.status_code == 200, f"create evt {r.status_code} {r.text}"
    evt = r.json()
    assert evt["price_per_sqm"] == 200
    assert evt["total_price"] == 50000

    # Tur event with total_price
    tur_payload = {
        "name": "TEST27_TurEvt",
        "type": "Tur",
        "date": "2026-08-01",
        "location": "Istanbul",
        "status": "Aktiv",
        "total_price": 3500,
    }
    r2 = requests.post(f"{API}/project-events", headers=admin_headers, json=tur_payload, timeout=30)
    assert r2.status_code == 200
    tur_evt = r2.json()
    assert tur_evt["total_price"] == 3500

    # Sold lead linked to sergi event
    lead_payload = {
        "company_name": "TEST27_LeadCo",
        "contact_name": "P",
        "phone": "+994500000027",
        "sale_type": "Sərgi",
        "status": "Satıldı",
        "project_id": evt["id"],
        "kv_m": 10,
        "price_per_sqm": 200,
        "total_amount": 2000,
        "paid_amount": 0,
    }
    r3 = requests.post(f"{API}/sales-leads", headers=admin_headers, json=lead_payload, timeout=30)
    assert r3.status_code == 200, f"{r3.status_code} {r3.text}"
    lead = r3.json()

    yield {"evt": evt, "tur_evt": tur_evt, "lead": lead}

    # cleanup
    requests.delete(f"{API}/project-events/{evt['id']}", headers=admin_headers, timeout=30)
    requests.delete(f"{API}/project-events/{tur_evt['id']}", headers=admin_headers, timeout=30)


# ---------- Project Event total_price ----------

class TestProjectEventTotalPrice:
    def test_post_saves_total_price_and_price_per_sqm(self, seed):
        assert seed["evt"]["price_per_sqm"] == 200
        assert seed["evt"]["total_price"] == 50000

    def test_post_tur_total_price_persisted(self, admin_headers, seed):
        # GET list and find it
        r = requests.get(f"{API}/project-events", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        events = r.json()
        match = [e for e in events if e["id"] == seed["tur_evt"]["id"]]
        assert match
        assert match[0]["total_price"] == 3500
        assert match[0]["type"] == "Tur"


# ---------- Payment POST ----------

class TestLeadPayment:
    def test_invalid_lead_payment_404(self, admin_headers):
        r = requests.post(
            f"{API}/sales-leads/nonexistent-id/payment",
            headers=admin_headers,
            json={"new_payment_amount": 100},
            timeout=30,
        )
        assert r.status_code == 404

    def test_invalid_lead_payments_get_404(self, admin_headers):
        r = requests.get(f"{API}/sales-leads/nonexistent-id/payments",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_post_payment_appends_history_and_updates_paid(self, admin_headers, seed):
        lid = seed["lead"]["id"]
        payload = {
            "new_payment_amount": 500,
            "payment_date": "2026-07-10",
            "payment_note": "ilk ödəniş",
            "contract_number": "CN-27-001",
            "e_invoice_number": "EIN-27",
            "e_invoice_date": "2026-07-11",
            "voen": "1234567890",
            "payment_due_date": "2026-07-20",
            "follow_up": "Next week follow up",
            "notes": "meta-note",
        }
        r = requests.post(f"{API}/sales-leads/{lid}/payment",
                          headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        # paid updated
        assert float(d["paid_amount"]) == 500
        # history appended
        ph = d.get("payment_history", [])
        assert len(ph) == 1
        entry = ph[0]
        assert entry["amount"] == 500
        assert entry["date"] == "2026-07-10"
        assert entry["note"] == "ilk ödəniş"
        assert "id" in entry
        assert "added_by" in entry
        # meta
        assert d["contract_number"] == "CN-27-001"
        assert d["e_invoice_number"] == "EIN-27"
        assert d["voen"] == "1234567890"
        assert d["payment_due_date"] == "2026-07-20"
        assert d["follow_up"] == "Next week follow up"
        assert d["e_invoice_date"] == "2026-07-11"
        assert d["notes"] == "meta-note"

    def test_post_second_payment_accumulates(self, admin_headers, seed):
        lid = seed["lead"]["id"]
        r = requests.post(f"{API}/sales-leads/{lid}/payment",
                          headers=admin_headers,
                          json={"new_payment_amount": 300, "payment_date": "2026-07-15",
                                "payment_note": "2nd"},
                          timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert float(d["paid_amount"]) == 800  # 500 + 300
        assert len(d["payment_history"]) == 2

    def test_get_payments_returns_history_array(self, admin_headers, seed):
        lid = seed["lead"]["id"]
        r = requests.get(f"{API}/sales-leads/{lid}/payments",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        history = r.json()
        assert isinstance(history, list)
        assert len(history) == 2
        amounts = sorted([p["amount"] for p in history])
        assert amounts == [300, 500]

    def test_post_meta_only_no_amount_doesnt_add_history(self, admin_headers, seed):
        lid = seed["lead"]["id"]
        pre = requests.get(f"{API}/sales-leads/{lid}/payments",
                           headers=admin_headers, timeout=30).json()
        pre_len = len(pre)
        r = requests.post(f"{API}/sales-leads/{lid}/payment",
                          headers=admin_headers,
                          json={"contract_number": "CN-UPDATED",
                                "new_payment_amount": 0},
                          timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["contract_number"] == "CN-UPDATED"
        assert len(d["payment_history"]) == pre_len  # unchanged


# ---------- debt_amount enrichment ----------

class TestProjectSalesDebtAmount:
    def test_sales_contain_debt_amount(self, admin_headers, seed):
        r = requests.get(f"{API}/project-events/{seed['evt']['id']}/sales",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        sale = next((s for s in body["sales"] if s["id"] == seed["lead"]["id"]), None)
        assert sale is not None, "sold lead missing"
        assert "debt_amount" in sale
        # total=2000, paid=800 after two payments → debt 1200
        assert float(sale["debt_amount"]) == 1200
        assert float(sale["paid_amount"]) == 800


# ---------- Scope enforcement ----------

class TestPaymentScopeOwn:
    def test_sales_manager_own_scope_403_on_other_lead(self, admin_headers, sales_headers, seed):
        # Set sales manager scope=own
        roles = requests.get(f"{API}/roles", headers=admin_headers, timeout=30).json()
        sm = next(r for r in roles if r["name"] == "Satış meneceri")
        requests.put(f"{API}/roles/{sm['id']}", headers=admin_headers,
                     json={"scopes": {"sales": "own"}}, timeout=30)
        try:
            # admin-owned lead
            lid = seed["lead"]["id"]
            r = requests.post(f"{API}/sales-leads/{lid}/payment",
                              headers=sales_headers,
                              json={"new_payment_amount": 50},
                              timeout=30)
            assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text}"
        finally:
            requests.put(f"{API}/roles/{sm['id']}", headers=admin_headers,
                         json={"scopes": {}}, timeout=30)


def teardown_module(module):
    try:
        tok = _login(ADMIN)
        h = {"Authorization": f"Bearer {tok}"}
        leads = requests.get(f"{API}/sales-leads", headers=h, timeout=30).json()
        for le in leads:
            if le.get("company_name", "").startswith("TEST27_"):
                requests.delete(f"{API}/sales-leads/{le['id']}", headers=h, timeout=30)
    except Exception as e:
        print(f"cleanup err: {e}")
