"""
Iteration 45 — Phase 1 quick-fix backend regression tests.
Covers:
  - GET /api/options/all → 'organization_forms' key
  - GET /api/settings/manageable-lists → 'organization_forms' present in Şirkət group
  - POST/PUT /api/companies → organization_form persisted
  - PUT /api/invitations/{id}/notes → note saved & returned by GET /api/invitations
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-hub-563.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASS = "marsol123"


# ---- Fixtures ----------------------------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_resources():
    bag = {"company_ids": [], "event_ids": [], "invitation_ids": []}
    yield bag
    # Cleanup
    try:
        token_r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
        h = {"Authorization": f"Bearer {token_r.json()['access_token']}"}
        for inv_id in bag["invitation_ids"]:
            requests.delete(f"{BASE_URL}/api/invitations/{inv_id}", headers=h, timeout=10)
        for ev_id in bag["event_ids"]:
            requests.delete(f"{BASE_URL}/api/events/{ev_id}", headers=h, timeout=10)
        for cid in bag["company_ids"]:
            requests.delete(f"{BASE_URL}/api/companies/{cid}", headers=h, timeout=10)
    except Exception as e:
        print(f"cleanup error: {e}")


# ---- Tests --------------------------------------------------------------

# (#12-A) /api/options/all exposes organization_forms with required defaults
class TestOptionsAllOrganizationForms:
    def test_organization_forms_in_options(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/options/all", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "organization_forms" in data, f"organization_forms missing. keys={list(data.keys())}"
        of = data["organization_forms"]
        assert isinstance(of, list)
        for needed in ["MMC", "ASC", "QSC"]:
            assert needed in of, f"{needed} missing from organization_forms: {of}"


# (#12-B) /api/settings/manageable-lists registers organization_forms in 'Şirkət' group
class TestManageableListsRegistry:
    def test_organization_forms_registered(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/settings/manageable-lists", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        lists = r.json()
        # Could be list of dicts
        match = next((x for x in lists if x.get("key") == "organization_forms"), None)
        assert match is not None, f"organization_forms not in registry. Got keys: {[x.get('key') for x in lists]}"
        assert match.get("group") == "Şirkət", f"Expected group Şirkət, got: {match.get('group')}"
        defaults_or_values = match.get("values") or match.get("defaults") or []
        for needed in ["MMC", "ASC", "QSC"]:
            assert needed in defaults_or_values, f"{needed} missing in registry values"


# (#12-C) POST/PUT /api/companies preserves organization_form field
class TestCompanyOrganizationForm:
    def test_create_company_with_org_form_and_verify(self, admin_headers, created_resources):
        suffix = uuid.uuid4().hex[:6]
        payload = {
            "name": f"TEST_OrgForm_{suffix}",
            "voen": f"99{suffix}1234",
            "organization_form": "MMC",
            "owner_phone": "",
            "company_phone": "",
            "representative_phone": "",
        }
        r = requests.post(f"{BASE_URL}/api/companies", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), f"Create failed: {r.status_code} {r.text}"
        body = r.json()
        cid = body.get("id")
        assert cid, f"No id returned: {body}"
        created_resources["company_ids"].append(cid)
        assert body.get("organization_form") == "MMC", f"organization_form not saved on create: {body.get('organization_form')}"

        # GET to verify persistence
        g = requests.get(f"{BASE_URL}/api/companies/{cid}", headers=admin_headers, timeout=15)
        assert g.status_code == 200
        assert g.json().get("organization_form") == "MMC"

        # PUT update to ASC
        u = requests.put(
            f"{BASE_URL}/api/companies/{cid}",
            headers=admin_headers,
            json={"name": payload["name"], "voen": payload["voen"], "organization_form": "ASC"},
            timeout=15,
        )
        assert u.status_code in (200, 204), f"PUT failed: {u.status_code} {u.text}"

        # Verify persisted
        g2 = requests.get(f"{BASE_URL}/api/companies/{cid}", headers=admin_headers, timeout=15)
        assert g2.status_code == 200
        assert g2.json().get("organization_form") == "ASC", f"After update got: {g2.json().get('organization_form')}"


# (#18) PUT /api/invitations/{id}/notes saves & is returned by GET /invitations
class TestInvitationNotes:
    def test_put_invitation_notes(self, admin_headers, created_resources):
        suffix = uuid.uuid4().hex[:6]
        # Create company
        cp = requests.post(
            f"{BASE_URL}/api/companies",
            headers=admin_headers,
            json={"name": f"TEST_Inv_{suffix}", "voen": f"77{suffix}9", "owner_phone": "", "company_phone": "", "representative_phone": ""},
            timeout=15,
        )
        assert cp.status_code in (200, 201), cp.text
        cid = cp.json()["id"]
        created_resources["company_ids"].append(cid)

        # Create event
        ev = requests.post(
            f"{BASE_URL}/api/events",
            headers=admin_headers,
            json={"title": f"TEST_Event_{suffix}", "event_date": "2030-01-15", "event_type": "Konfrans"},
            timeout=15,
        )
        assert ev.status_code in (200, 201), ev.text
        ev_id = ev.json()["id"]
        created_resources["event_ids"].append(ev_id)

        # Create invitation
        iv = requests.post(
            f"{BASE_URL}/api/invitations",
            headers=admin_headers,
            json={"event_id": ev_id, "company_id": cid},
            timeout=15,
        )
        assert iv.status_code in (200, 201), iv.text
        inv_id = iv.json()["id"]
        created_resources["invitation_ids"].append(inv_id)

        # PUT notes
        note_text = "Test qeyd: səfərdə olduğu üçün qatıla bilməyəcək"
        pn = requests.put(
            f"{BASE_URL}/api/invitations/{inv_id}/notes",
            headers=admin_headers,
            json={"notes": note_text},
            timeout=15,
        )
        assert pn.status_code == 200, f"PUT notes: {pn.status_code} {pn.text}"
        assert pn.json().get("notes") == note_text

        # Verify GET /api/invitations returns the note
        g = requests.get(f"{BASE_URL}/api/invitations?event_id={ev_id}", headers=admin_headers, timeout=15)
        assert g.status_code == 200
        rows = g.json()
        target = next((x for x in rows if x.get("id") == inv_id), None)
        assert target is not None, f"Created invitation not in list response"
        assert target.get("notes") == note_text, f"notes not persisted in list: {target.get('notes')}"

    def test_put_notes_404_for_missing(self, admin_headers):
        r = requests.put(
            f"{BASE_URL}/api/invitations/nonexistent-id-xyz/notes",
            headers=admin_headers,
            json={"notes": "x"},
            timeout=15,
        )
        assert r.status_code == 404
