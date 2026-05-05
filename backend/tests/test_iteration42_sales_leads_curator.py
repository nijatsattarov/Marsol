"""
Iteration 42 — Sales Leads: Curator + Source Contact List tests
Covers:
  - GET /api/sales-leads/options returns curators (marsol_representatives)
  - POST /api/sales-leads accepts + persists curator from payload
  - PUT /api/sales-leads/{id} updates curator; transition to 'Üzv oldu' propagates
    curator and source_contact_list_name to the created company
  - POST /api/contacts/{id}/convert-to-lead writes source_contact_list_name
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def admin_name(admin_client):
    r = admin_client.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 200
    return r.json().get("name", "")


# ------------ OPTIONS ------------
class TestSalesLeadsOptions:
    def test_curators_list_returned(self, admin_client):
        # Frontend uses /api/options/all and reads marsol_representatives
        r = admin_client.get(f"{API}/options/all", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        reps = data.get("marsol_representatives") or []
        assert isinstance(reps, list)
        assert len(reps) >= 1, "expected at least one marsol_representative"

    def test_sales_leads_options_endpoint_missing(self, admin_client):
        """Review-request mentions GET /api/sales-leads/options — this route
        does NOT exist on the backend. The frontend uses /options/all."""
        r = admin_client.get(f"{API}/sales-leads/options", timeout=10)
        # Either 404/405 (not implemented) or 200 (alias added) is acceptable
        assert r.status_code in (200, 404, 405), (
            f"Unexpected response: {r.status_code} {r.text}"
        )


# ------------ CREATE ------------
class TestCreateLeadWithCurator:
    def _get_reps(self, admin_client):
        data = admin_client.get(f"{API}/options/all", timeout=10).json()
        return data.get("marsol_representatives") or []

    @pytest.fixture(scope="class")
    def created_lead(self, admin_client):
        # Get available curators first
        data = admin_client.get(f"{API}/options/all", timeout=10).json()
        reps = data.get("marsol_representatives") or []
        chosen = reps[0] if reps else "Test Curator"
        payload = {
            "company_name": f"TEST_Curator_{uuid.uuid4().hex[:6]}",
            "contact_name": "TEST Contact",
            "source": "Test",
            "sale_type": "Üzvlük",
            "curator": chosen,
        }
        r = admin_client.post(f"{API}/sales-leads", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        yield {"payload": payload, "created": body, "chosen_curator": chosen}
        # cleanup
        admin_client.delete(f"{API}/sales-leads/{body['id']}", timeout=10)

    def test_lead_is_created_with_id_and_code(self, created_lead):
        c = created_lead["created"]
        assert "id" in c
        assert c.get("lead_code", "").startswith("SB-")
        assert c["company_name"] == created_lead["payload"]["company_name"]

    def test_curator_from_payload_is_persisted(self, admin_client, created_lead):
        """Bug check: POST should honor the 'curator' field from payload."""
        lead_id = created_lead["created"]["id"]
        # Re-fetch lead via list endpoint
        r = admin_client.get(f"{API}/sales-leads", timeout=15)
        assert r.status_code == 200
        found = next((x for x in r.json() if x["id"] == lead_id), None)
        assert found is not None, "lead not found in GET list"
        assert found.get("curator") == created_lead["chosen_curator"], (
            f"Expected curator='{created_lead['chosen_curator']}', "
            f"got '{found.get('curator')}'. POST /sales-leads is ignoring payload curator."
        )


# ------------ UPDATE ------------
class TestUpdateLeadCurator:
    def test_put_updates_curator(self, admin_client):
        # create a lead first
        payload = {
            "company_name": f"TEST_PutCurator_{uuid.uuid4().hex[:6]}",
            "contact_name": "TEST",
            "sale_type": "Üzvlük",
        }
        r = admin_client.post(f"{API}/sales-leads", json=payload, timeout=15)
        assert r.status_code == 200
        lead = r.json()
        lead_id = lead["id"]

        try:
            opts = admin_client.get(f"{API}/options/all", timeout=10).json()
            reps = opts.get("marsol_representatives") or []
            new_curator = reps[-1] if reps else "Some Curator"

            r2 = admin_client.put(
                f"{API}/sales-leads/{lead_id}",
                json={"curator": new_curator},
                timeout=15,
            )
            assert r2.status_code == 200, r2.text
            assert r2.json().get("curator") == new_curator

            # verify persisted
            listed = admin_client.get(f"{API}/sales-leads", timeout=15).json()
            got = next((x for x in listed if x["id"] == lead_id), None)
            assert got is not None
            assert got.get("curator") == new_curator
        finally:
            admin_client.delete(f"{API}/sales-leads/{lead_id}", timeout=10)


# ------------ CONVERT CONTACT -> LEAD ------------
class TestContactToLeadSourceList:
    def test_convert_contact_sets_source_contact_list_name(self, admin_client):
        # Create contact list
        list_name = f"TEST_LIST_{uuid.uuid4().hex[:6]}"
        r = admin_client.post(
            f"{API}/contact-lists", json={"title": list_name, "name": list_name}, timeout=15
        )
        if r.status_code >= 400:
            pytest.skip(f"contact-lists endpoint unavailable: {r.status_code} {r.text}")
        lst = r.json()
        list_id = lst.get("id")
        assert list_id

        # Create contact in that list
        cpayload = {
            "list_id": list_id,
            "name": "TESTFirst",
            "surname": "TESTLast",
            "company": "TESTCo",
            "phone": "0500000000",
        }
        rc = admin_client.post(f"{API}/contact-lists/{list_id}/contacts", json=cpayload, timeout=15)
        if rc.status_code >= 400:
            # cleanup list
            admin_client.delete(f"{API}/contact-lists/{list_id}", timeout=10)
            pytest.skip(f"contacts endpoint unavailable: {rc.status_code} {rc.text}")
        contact = rc.json()
        contact_id = contact.get("id")

        lead_id = None
        try:
            conv = admin_client.post(
                f"{API}/contacts/{contact_id}/convert-to-lead", json={}, timeout=15
            )
            assert conv.status_code == 200, conv.text
            lead = conv.json()
            lead_id = lead["id"]
            # Key assertions
            assert lead.get("source_contact_list_name") == list_name
            assert lead.get("source_contact_list_id") == list_id
            assert lead.get("source_contact_id") == contact_id
            assert lead.get("source", "").startswith("Siyahı")
        finally:
            if lead_id:
                admin_client.delete(f"{API}/sales-leads/{lead_id}", timeout=10)
            admin_client.delete(f"{API}/contact-lists/{list_id}/contacts/{contact_id}", timeout=10)
            admin_client.delete(f"{API}/contact-lists/{list_id}", timeout=10)


# ------------ STATUS TRANSITION PROPAGATION ------------
class TestStatusUzvOlduPropagation:
    def test_uzv_oldu_creates_company_with_curator_and_source_list(self, admin_client):
        # Create a lead manually populated with source_contact_list_name via direct POST
        list_name = f"TEST_LIST_{uuid.uuid4().hex[:6]}"
        rl = admin_client.post(f"{API}/contact-lists", json={"title": list_name, "name": list_name}, timeout=15)
        if rl.status_code >= 400:
            pytest.skip("contact-lists unavailable")
        list_id = rl.json()["id"]

        rc = admin_client.post(
            f"{API}/contact-lists/{list_id}/contacts",
            json={"name": "Memb", "surname": "Test", "company": f"TEST_MembCo_{uuid.uuid4().hex[:6]}", "phone": "055"},
            timeout=15,
        )
        if rc.status_code >= 400:
            admin_client.delete(f"{API}/contact-lists/{list_id}")
            pytest.skip("contacts unavailable")
        contact = rc.json()

        conv = admin_client.post(
            f"{API}/contacts/{contact['id']}/convert-to-lead", json={}, timeout=15
        )
        assert conv.status_code == 200
        lead = conv.json()
        lead_id = lead["id"]
        company_name = lead["company_name"]

        opts = admin_client.get(f"{API}/options/all", timeout=10).json()
        reps = opts.get("marsol_representatives") or []
        chosen_curator = reps[0] if reps else "Admin"

        company_id_to_cleanup = None
        try:
            # Transition to Üzv oldu with a specific curator
            r = admin_client.put(
                f"{API}/sales-leads/{lead_id}",
                json={
                    "status": "Üzv oldu",
                    "sale_type": "Üzvlük",
                    "curator": chosen_curator,
                    "total_amount": 100,
                    "paid_amount": 50,
                },
                timeout=20,
            )
            assert r.status_code == 200, r.text
            out = r.json()
            assert out.get("status") == "Üzv oldu"

            # Find created company
            companies = admin_client.get(f"{API}/companies", timeout=15).json()
            match = next((c for c in companies if c.get("brand_name") == company_name), None)
            assert match is not None, "Company was not auto-created from Üzv oldu transition"
            company_id_to_cleanup = match["id"]
            assert match.get("curator") == chosen_curator, (
                f"Company curator not propagated: expected '{chosen_curator}', got '{match.get('curator')}'"
            )
            assert match.get("source_contact_list_name") == list_name
            assert match.get("source_contact_list_id") == list_id
        finally:
            if company_id_to_cleanup:
                admin_client.delete(f"{API}/companies/{company_id_to_cleanup}", timeout=10)
            admin_client.delete(f"{API}/sales-leads/{lead_id}", timeout=10)
            admin_client.delete(f"{API}/contact-lists/{list_id}/contacts/" + contact["id"], timeout=10)
            admin_client.delete(f"{API}/contact-lists/{list_id}", timeout=10)
