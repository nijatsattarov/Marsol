"""
Iteration 21 — Project Events, Event Invitations, Contact Lists modules
Tests B2B networking modules: Projects/Events, Guest Invitations, Contact Lists,
cascade deletions, guest counts, Excel import, lead conversion, and RBAC checks.
"""
import os
import pytest
import requests
from pathlib import Path


def _load_backend_url():
    env_val = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if env_val:
        return env_val.rstrip("/")
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}
ACCOUNTANT = {"email": "muhasib@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed {creds['email']}: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers():
    tok = _login(ADMIN)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sales_headers():
    tok = _login(SALES)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def accountant_headers():
    tok = _login(ACCOUNTANT)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# State for cleanup across tests
_created = {"events": [], "invitations": [], "lists": [], "contacts": [], "leads": []}


# =================== AUTH ===================
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200
        data = r.json()
        assert ("access_token" in data) or ("token" in data)

    def test_sales_login(self):
        r = requests.post(f"{API}/auth/login", json=SALES)
        assert r.status_code == 200

    def test_accountant_login(self):
        r = requests.post(f"{API}/auth/login", json=ACCOUNTANT)
        assert r.status_code == 200


# =================== PROJECT EVENTS ===================
class TestProjectEvents:
    def test_get_project_events(self, admin_headers):
        r = requests.get(f"{API}/project-events", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_project_event(self, admin_headers):
        payload = {
            "name": "TEST_Event Marsol 2026",
            "type": "Konfrans",
            "date": "2026-02-15",
            "end_date": "2026-02-16",
            "location": "Baku Convention Center",
            "description": "TEST tədbiri",
            "status": "Planlaşdırılır",
        }
        r = requests.post(f"{API}/project-events", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["name"] == payload["name"]
        assert doc["type"] == payload["type"]
        assert "id" in doc
        assert doc.get("guest_count") == 0
        assert doc.get("attended_count") == 0
        _created["events"].append(doc["id"])

    def test_update_project_event(self, admin_headers):
        eid = _created["events"][0]
        r = requests.put(f"{API}/project-events/{eid}", headers=admin_headers,
                         json={"status": "Davam edir"})
        assert r.status_code == 200
        # verify via GET
        rg = requests.get(f"{API}/project-events", headers=admin_headers)
        match = [e for e in rg.json() if e["id"] == eid]
        assert match and match[0]["status"] == "Davam edir"

    def test_guest_count_after_adding_invitations(self, admin_headers):
        eid = _created["events"][0]
        for i in range(3):
            payload = {
                "event_id": eid,
                "event_name": "TEST_Event Marsol 2026",
                "guest_name": f"TEST_Guest {i}",
                "guest_company": "TEST Co",
                "guest_position": "CEO",
                "guest_phone": "+994501234567",
                "guest_email": f"guest{i}@test.az",
            }
            r = requests.post(f"{API}/event-invitations", headers=admin_headers, json=payload)
            assert r.status_code == 200, r.text
            _created["invitations"].append(r.json()["id"])
        # mark one as attended
        inv_id = _created["invitations"][0]
        ru = requests.put(f"{API}/event-invitations/{inv_id}", headers=admin_headers,
                          json={"status": "İştirak etdi"})
        assert ru.status_code == 200
        # Verify counts
        rg = requests.get(f"{API}/project-events", headers=admin_headers)
        match = [e for e in rg.json() if e["id"] == eid][0]
        assert match["guest_count"] == 3, f"expected 3 got {match['guest_count']}"
        assert match["attended_count"] == 1, f"expected 1 got {match['attended_count']}"


# =================== EVENT INVITATIONS ===================
class TestEventInvitations:
    def test_list_invitations(self, admin_headers):
        r = requests.get(f"{API}/event-invitations", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_by_event_id(self, admin_headers):
        eid = _created["events"][0]
        r = requests.get(f"{API}/event-invitations?event_id={eid}", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3
        assert all(i["event_id"] == eid for i in data)

    def test_status_transitions(self, admin_headers):
        inv_id = _created["invitations"][1]
        for st in ["Gələcəm", "Gəlməyəcəm", "İştirak etdi"]:
            r = requests.put(f"{API}/event-invitations/{inv_id}", headers=admin_headers,
                             json={"status": st})
            assert r.status_code == 200
            assert r.json()["status"] == st

    def test_convert_invitation_to_lead(self, admin_headers):
        inv_id = _created["invitations"][2]
        r = requests.post(f"{API}/event-invitations/{inv_id}/convert-to-lead",
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert "lead_code" in lead and lead["lead_code"].startswith("SB-")
        assert lead["company_name"] == "TEST Co"
        _created["leads"].append(lead["id"])
        # Verify lead exists
        rl = requests.get(f"{API}/sales-leads", headers=admin_headers)
        if rl.status_code == 200:
            ids = [x["id"] for x in rl.json()]
            assert lead["id"] in ids


# =================== CONTACT LISTS ===================
class TestContactLists:
    def test_get_lists(self, admin_headers):
        r = requests.get(f"{API}/contact-lists", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_list(self, admin_headers):
        r = requests.post(f"{API}/contact-lists", headers=admin_headers,
                         json={"title": "TEST_VIP List", "description": "TEST siyahı"})
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["title"] == "TEST_VIP List"
        assert doc.get("contact_count") == 0
        _created["lists"].append(doc["id"])

    def test_add_contact(self, admin_headers):
        lid = _created["lists"][0]
        r = requests.post(f"{API}/contact-lists/{lid}/contacts", headers=admin_headers, json={
            "name": "TEST_Ali", "surname": "TEST_Veliyev",
            "company": "TestCo LLC", "position": "Manager",
            "phone": "+994501112233", "email": "ali@test.az"
        })
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["name"] == "TEST_Ali"
        _created["contacts"].append(doc["id"])
        # Verify contact_count updated
        rl = requests.get(f"{API}/contact-lists", headers=admin_headers)
        match = [x for x in rl.json() if x["id"] == lid][0]
        assert match["contact_count"] == 1

    def test_import_contacts(self, admin_headers):
        lid = _created["lists"][0]
        payload = {"contacts": [
            {"Ad": "TEST_Nicat", "Soyad": "Həsənov", "Şirkət": "ImportCo", "Telefon": "+994551000001", "Email": "n@t.az"},
            {"name": "TEST_Leyla", "surname": "Mammadova", "company": "ImportCo2", "phone": "+994551000002", "email": "l@t.az"}
        ]}
        r = requests.post(f"{API}/contact-lists/{lid}/import", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        assert "2" in r.json()["message"]
        # Verify in GET
        rg = requests.get(f"{API}/contact-lists/{lid}/contacts", headers=admin_headers)
        assert rg.status_code == 200
        data = rg.json()
        assert len(data) == 3  # 1 added + 2 imported
        names = [c["name"] for c in data]
        assert "TEST_Nicat" in names
        assert "TEST_Leyla" in names

    def test_import_empty_returns_400(self, admin_headers):
        lid = _created["lists"][0]
        r = requests.post(f"{API}/contact-lists/{lid}/import", headers=admin_headers,
                          json={"contacts": []})
        assert r.status_code == 400

    def test_convert_contact_to_lead(self, admin_headers):
        cid = _created["contacts"][0]
        r = requests.post(f"{API}/contacts/{cid}/convert-to-lead", headers=admin_headers)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["lead_code"].startswith("SB-")
        assert "TEST_Ali" in lead["contact_name"]
        _created["leads"].append(lead["id"])


# =================== RBAC ===================
class TestRBAC:
    def test_sales_can_create_event_invitation(self, sales_headers):
        # Need an event first; use existing
        ev_resp = requests.get(f"{API}/project-events", headers=sales_headers)
        assert ev_resp.status_code == 200
        if not ev_resp.json():
            pytest.skip("No events available")
        eid = _created["events"][0] if _created["events"] else ev_resp.json()[0]["id"]
        r = requests.post(f"{API}/event-invitations", headers=sales_headers, json={
            "event_id": eid, "event_name": "TEST", "guest_name": "TEST_Sales Guest",
            "guest_company": "X", "guest_email": "s@t.az"
        })
        assert r.status_code == 200, f"Sales should be allowed: {r.status_code} {r.text}"
        _created["invitations"].append(r.json()["id"])

    def test_accountant_cannot_create_event_invitation(self, accountant_headers):
        eid = _created["events"][0] if _created["events"] else None
        if not eid:
            pytest.skip("No event")
        r = requests.post(f"{API}/event-invitations", headers=accountant_headers, json={
            "event_id": eid, "event_name": "TEST", "guest_name": "TEST_Acc Guest",
            "guest_company": "X"
        })
        assert r.status_code in (401, 403), f"Accountant should be blocked but got {r.status_code}"

    def test_accountant_cannot_create_contact_list(self, accountant_headers):
        r = requests.post(f"{API}/contact-lists", headers=accountant_headers,
                         json={"title": "TEST_AccList"})
        assert r.status_code in (401, 403)

    def test_sales_can_create_contact_list(self, sales_headers):
        r = requests.post(f"{API}/contact-lists", headers=sales_headers,
                         json={"title": "TEST_SalesList"})
        assert r.status_code == 200, r.text
        _created["lists"].append(r.json()["id"])


# =================== REGRESSION: OLD OBLIGATIONS UNAFFECTED ===================
class TestRegressionObligations:
    def test_obligations_dashboard_still_works(self, admin_headers):
        r = requests.get(f"{API}/obligations/dashboard", headers=admin_headers)
        assert r.status_code == 200, r.text

    def test_old_invitations_endpoint_still_works(self, admin_headers):
        # Old /api/invitations endpoint (Obligations, company_id based)
        r = requests.get(f"{API}/invitations", headers=admin_headers)
        # Should return 200 and be separate from /event-invitations
        assert r.status_code == 200, r.text


# =================== CASCADE DELETE & CLEANUP ===================
class TestCascadeAndCleanup:
    def test_delete_event_cascades_invitations(self, admin_headers):
        # Create a fresh event + invitation
        ev = requests.post(f"{API}/project-events", headers=admin_headers, json={
            "name": "TEST_Cascade", "type": "Tədbir", "date": "2026-03-01"
        }).json()
        eid = ev["id"]
        inv = requests.post(f"{API}/event-invitations", headers=admin_headers, json={
            "event_id": eid, "event_name": "TEST_Cascade", "guest_name": "TEST_Cascade Guest"
        }).json()
        inv_id = inv["id"]

        # Delete event
        rd = requests.delete(f"{API}/project-events/{eid}", headers=admin_headers)
        assert rd.status_code == 200

        # Verify invitation gone
        rg = requests.get(f"{API}/event-invitations?event_id={eid}", headers=admin_headers)
        assert rg.status_code == 200
        assert len(rg.json()) == 0, f"Cascade failed — invitations remain: {rg.json()}"
        # Also verify it's not in full list
        rg2 = requests.get(f"{API}/event-invitations", headers=admin_headers)
        ids = [i["id"] for i in rg2.json()]
        assert inv_id not in ids

    def test_z_cleanup_created_data(self, admin_headers):
        """Cleanup all TEST_ prefixed data created during this module run."""
        # Delete invitations
        for iid in list(set(_created["invitations"])):
            requests.delete(f"{API}/event-invitations/{iid}", headers=admin_headers)
        # Delete events (cascades invitations)
        for eid in list(set(_created["events"])):
            requests.delete(f"{API}/project-events/{eid}", headers=admin_headers)
        # Delete contact lists (cascades contacts)
        for lid in list(set(_created["lists"])):
            requests.delete(f"{API}/contact-lists/{lid}", headers=admin_headers)
        # Delete leads
        for lid in list(set(_created["leads"])):
            requests.delete(f"{API}/sales-leads/{lid}", headers=admin_headers)
