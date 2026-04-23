"""
Iteration 26 - Project sales & dynamic lead fields (Layihə növü)
Tests:
- POST /api/sales-leads saves new fields (project_id, package, kv_m, price_per_sqm, stand_number, hall_number, total_amount, participant_count)
- PUT /api/sales-leads updates them
- POST /api/project-events saves price_per_sqm
- GET /api/project-events/{id}/sales returns {event, sales} enriched with sector/sub_sector
- GET /api/project-events/invalid-id/sales returns 404
- Sergi lead soldu → görünür
- Scope=own kontrol - yalnız öz leadlərini görür
"""
import os
import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # load from frontend/.env
        env_file = "/app/frontend/.env"
        if os.path.exists(env_file):
            with open(env_file) as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
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
def reset_sales_role_scope(admin_headers):
    """Ensure 'Satış meneceri' role has no scope restriction (empty scopes = all)."""
    r = requests.get(f"{API}/settings/roles", headers=admin_headers, timeout=30)
    if r.status_code != 200:
        r = requests.get(f"{API}/roles", headers=admin_headers, timeout=30)
    if r.status_code == 200:
        roles = r.json()
        if isinstance(roles, list):
            for role in roles:
                if role.get("name") == "Satış meneceri":
                    rid = role.get("id")
                    requests.put(
                        f"{API}/roles/{rid}",
                        headers=admin_headers,
                        json={"scopes": {}},
                        timeout=30,
                    )
    yield


@pytest.fixture(scope="module")
def test_event(admin_headers):
    """Create a Sərgi project-event with price_per_sqm."""
    payload = {
        "name": "TEST_Sergi_2026",
        "type": "Sərgi",
        "date": "2026-06-01",
        "end_date": "2026-06-05",
        "location": "Baku Expo",
        "status": "Aktiv",
        "price_per_sqm": 250,
    }
    r = requests.post(f"{API}/project-events", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code == 200, f"create event failed {r.status_code} {r.text}"
    doc = r.json()
    assert doc["price_per_sqm"] == 250
    assert doc["type"] == "Sərgi"
    yield doc
    requests.delete(f"{API}/project-events/{doc['id']}", headers=admin_headers, timeout=30)


@pytest.fixture(scope="module")
def test_company(admin_headers):
    """Seed a company for sector enrichment."""
    payload = {
        "brand_name": "TEST_SergiCo",
        "legal_name": "TEST_SergiCo LLC",
        "sector": "IT",
        "sub_sector": "SaaS",
        "owner_name": "Test Owner",
        "owner_phone": "+994500000001",
        "owner_email": "owner@test.az",
        "company_phone": "+994500000002",
        "company_email": "co@test.az",
        "package": "",
        "joined_project": "Sərgi",
        "status": "Aktiv",
    }
    r = requests.post(f"{API}/companies", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    doc = r.json()
    yield doc
    requests.delete(f"{API}/companies/{doc['id']}", headers=admin_headers, timeout=30)


# --- TESTS ---

class TestSalesLeadsNewFields:
    def test_post_saves_new_fields(self, admin_headers, test_event):
        payload = {
            "company_name": "TEST_SergiCo",
            "contact_name": "Test Contact",
            "phone": "+994500000001",
            "email": "lead@test.az",
            "sale_type": "Sərgi",
            "status": "Yeni",
            "project_id": test_event["id"],
            "kv_m": 20,
            "price_per_sqm": 250,
            "stand_number": "A-12",
            "hall_number": "Hall-1",
            "total_amount": 5000,
            "package": "",
            "participant_count": None,
        }
        r = requests.post(f"{API}/sales-leads", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert d["project_id"] == test_event["id"]
        assert d["kv_m"] == 20
        assert d["price_per_sqm"] == 250
        assert d["stand_number"] == "A-12"
        assert d["hall_number"] == "Hall-1"
        assert d["total_amount"] == 5000
        assert d["sale_type"] == "Sərgi"
        pytest.lead_id_sergi = d["id"]

        # GET verify persistence
        r2 = requests.get(f"{API}/sales-leads", headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        leads = r2.json()
        match = [le for le in leads if le["id"] == d["id"]]
        assert match and match[0]["stand_number"] == "A-12"

    def test_put_updates_new_fields(self, admin_headers):
        lid = pytest.lead_id_sergi
        r = requests.put(
            f"{API}/sales-leads/{lid}",
            headers=admin_headers,
            json={"kv_m": 30, "total_amount": 7500, "stand_number": "B-5"},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert d["kv_m"] == 30
        assert d["total_amount"] == 7500
        assert d["stand_number"] == "B-5"

    def test_post_uzvluk_with_package(self, admin_headers, test_event):
        payload = {
            "company_name": "TEST_UzvCo",
            "contact_name": "Uzv Contact",
            "phone": "+994500000009",
            "sale_type": "Üzvlük",
            "status": "Yeni",
            "project_id": test_event["id"],
            "package": "Premium",
            "total_amount": 5000,
        }
        r = requests.post(f"{API}/sales-leads", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["package"] == "Premium"
        assert d["sale_type"] == "Üzvlük"
        pytest.lead_id_uzv = d["id"]

    def test_post_tur_with_participant_count(self, admin_headers, test_event):
        payload = {
            "company_name": "TEST_TurCo",
            "contact_name": "Tur Contact",
            "phone": "+994500000010",
            "sale_type": "Tur",
            "status": "Yeni",
            "project_id": test_event["id"],
            "participant_count": 15,
            "total_amount": 1500,
        }
        r = requests.post(f"{API}/sales-leads", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["participant_count"] == 15
        pytest.lead_id_tur = d["id"]


class TestProjectSalesEndpoint:
    def test_get_sales_invalid_event_404(self, admin_headers):
        r = requests.get(f"{API}/project-events/invalid-id-xyz/sales", headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_sold_lead_appears_in_project_sales(self, admin_headers, test_event, test_company):
        # mark the sergi lead as Satıldı
        r = requests.put(
            f"{API}/sales-leads/{pytest.lead_id_sergi}",
            headers=admin_headers,
            json={"status": "Satıldı"},
            timeout=30,
        )
        assert r.status_code == 200
        # mark uzv lead as Üzv oldu
        r2 = requests.put(
            f"{API}/sales-leads/{pytest.lead_id_uzv}",
            headers=admin_headers,
            json={"status": "Üzv oldu"},
            timeout=30,
        )
        assert r2.status_code == 200

        # GET /project-events/{id}/sales
        r3 = requests.get(f"{API}/project-events/{test_event['id']}/sales", headers=admin_headers, timeout=30)
        assert r3.status_code == 200, f"{r3.status_code} {r3.text}"
        body = r3.json()
        assert "event" in body and "sales" in body
        assert body["event"]["id"] == test_event["id"]
        ids = [s["id"] for s in body["sales"]]
        assert pytest.lead_id_sergi in ids
        assert pytest.lead_id_uzv in ids

        # Sergi lead should be enriched with sector from TEST_SergiCo (matches company brand_name)
        sergi_sale = next(s for s in body["sales"] if s["id"] == pytest.lead_id_sergi)
        assert "sector" in sergi_sale
        assert "sub_sector" in sergi_sale
        assert sergi_sale["sector"] == "IT"
        assert sergi_sale["sub_sector"] == "SaaS"

    def test_tur_lead_not_in_sales_if_not_sold(self, admin_headers, test_event):
        # Tur lead status is 'Yeni', should NOT appear
        r = requests.get(f"{API}/project-events/{test_event['id']}/sales", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()["sales"]]
        assert pytest.lead_id_tur not in ids


class TestScopeOwnFiltersSales:
    def test_sales_manager_sees_only_own_when_scope_own(self, admin_headers, sales_headers, test_event):
        # Set sales role scope 'own'
        roles = requests.get(f"{API}/roles", headers=admin_headers, timeout=30).json()
        sm_role = next(r for r in roles if r["name"] == "Satış meneceri")
        requests.put(
            f"{API}/roles/{sm_role['id']}",
            headers=admin_headers,
            json={"scopes": {"sales": "own"}},
            timeout=30,
        )
        try:
            # create a lead owned by sales manager
            payload = {
                "company_name": "TEST_OwnSales",
                "contact_name": "own",
                "phone": "+994500000099",
                "sale_type": "Sərgi",
                "status": "Satıldı",
                "project_id": test_event["id"],
                "kv_m": 10,
                "price_per_sqm": 100,
                "total_amount": 1000,
            }
            r = requests.post(f"{API}/sales-leads", headers=sales_headers, json=payload, timeout=30)
            assert r.status_code == 200, f"{r.status_code} {r.text}"
            own_id = r.json()["id"]

            # sales-manager GET - should include own
            r2 = requests.get(
                f"{API}/project-events/{test_event['id']}/sales",
                headers=sales_headers,
                timeout=30,
            )
            assert r2.status_code == 200
            ids = [s["id"] for s in r2.json()["sales"]]
            assert own_id in ids
            # Must NOT see admin-created leads
            assert pytest.lead_id_sergi not in ids
            assert pytest.lead_id_uzv not in ids

            # Admin GET - should see all
            r3 = requests.get(
                f"{API}/project-events/{test_event['id']}/sales",
                headers=admin_headers,
                timeout=30,
            )
            assert r3.status_code == 200
            ids_admin = [s["id"] for s in r3.json()["sales"]]
            assert own_id in ids_admin
            assert pytest.lead_id_sergi in ids_admin
        finally:
            # Reset scope
            requests.put(
                f"{API}/roles/{sm_role['id']}",
                headers=admin_headers,
                json={"scopes": {}},
                timeout=30,
            )


def teardown_module(module):
    """Cleanup TEST_ leads."""
    try:
        tok = _login(ADMIN)
        headers = {"Authorization": f"Bearer {tok}"}
        leads = requests.get(f"{API}/sales-leads", headers=headers, timeout=30).json()
        for le in leads:
            if le.get("company_name", "").startswith("TEST_"):
                requests.delete(f"{API}/sales-leads/{le['id']}", headers=headers, timeout=30)
    except Exception as e:
        print(f"cleanup failed: {e}")
