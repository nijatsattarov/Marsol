"""
Iteration 46 — Phase 2 mid-level fixes backend test:
  #6 Assembly UI helpers (no backend testing)
  #8 CarryOverPicker (no backend; uses GET /api/assemblies)
  #10 ProjectDetail — POST /api/sales-leads with project_id, status default 'Satıldı'
       must show in GET /api/project-events/{id}/sales
  #17 Forum required fields:
       - GET /api/forum/fields returns 'required' (default empty)
       - PUT /api/forum/fields {enabled:[...], required:[...]} subset enforcement
       - GET /api/public/form/{token} fields[].required boolean
       - POST /api/public/form/{token} required validation -> 400 with
         'Aşağıdakı məcburi sahələr doldurulmalıdır: ...'
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}


# --------------------------- fixtures ---------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_session(admin_token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="module")
def cleanup_state():
    """Track created ids for teardown."""
    state = {
        "company_ids": [],
        "lead_ids": [],
        "project_ids": [],
        "saved_forum_required": None,
    }
    yield state
    # Teardown
    s = requests.Session()
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    if r.status_code == 200:
        s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        for lid in state["lead_ids"]:
            try:
                s.delete(f"{BASE_URL}/api/sales-leads/{lid}", timeout=10)
            except Exception:
                pass
        for cid in state["company_ids"]:
            try:
                s.delete(f"{BASE_URL}/api/companies/{cid}", timeout=10)
            except Exception:
                pass
        for pid in state["project_ids"]:
            try:
                s.delete(f"{BASE_URL}/api/project-events/{pid}", timeout=10)
            except Exception:
                pass
        # restore forum required state if changed
        if state["saved_forum_required"] is not None:
            try:
                en = state["saved_forum_required"]["enabled"]
                req = state["saved_forum_required"]["required"]
                s.put(
                    f"{BASE_URL}/api/forum/fields",
                    json={"enabled": en, "required": req},
                    timeout=10,
                )
            except Exception:
                pass


# ============================================================
# #17 — Forum required fields
# ============================================================
class TestForumRequiredFields:
    def test_get_forum_fields_returns_required_key(self, admin_session, cleanup_state):
        r = admin_session.get(f"{BASE_URL}/api/forum/fields", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "fields" in data
        assert "enabled" in data
        assert "required" in data, "GET /api/forum/fields must return 'required' key"
        assert isinstance(data["required"], list)
        # save current state for teardown restoration
        cleanup_state["saved_forum_required"] = {
            "enabled": data["enabled"],
            "required": data["required"],
        }

    def test_put_forum_fields_enforces_required_subset_of_enabled(self, admin_session):
        # Use valid keys from COMPANY_FORM_FIELDS: legal_name, voen, sector
        payload = {
            "enabled": ["legal_name", "voen", "sector"],
            "required": ["legal_name", "voen", "non_existing_random_key"],
        }
        r = admin_session.put(
            f"{BASE_URL}/api/forum/fields", json=payload, timeout=10
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # required should be filtered to subset of enabled
        assert "non_existing_random_key" not in body["required"]
        assert set(body["required"]).issubset(set(body["enabled"]))
        assert "legal_name" in body["required"]
        assert "voen" in body["required"]

        # GET should reflect persisted state
        r2 = admin_session.get(f"{BASE_URL}/api/forum/fields", timeout=10)
        assert r2.status_code == 200
        d2 = r2.json()
        assert "legal_name" in d2["required"]
        assert "voen" in d2["required"]

    def test_public_form_returns_required_flag_per_field(
        self, admin_session, cleanup_state
    ):
        # 1) Configure required = ['legal_name','voen'], enabled includes them + sector
        admin_session.put(
            f"{BASE_URL}/api/forum/fields",
            json={
                "enabled": ["legal_name", "voen", "sector"],
                "required": ["legal_name", "voen"],
            },
            timeout=10,
        )
        # 2) Create a TEST_ company
        comp = {
            "brand_name": f"TEST_ForumReq_{uuid.uuid4().hex[:6]}",
            "owner_name": "TEST Owner",
            "owner_phone": "",
            "company_phone": "",
        }
        r = admin_session.post(
            f"{BASE_URL}/api/companies", json=comp, timeout=15
        )
        assert r.status_code in (200, 201), r.text
        cid = r.json().get("id")
        assert cid
        cleanup_state["company_ids"].append(cid)

        # 3) Generate token
        r = admin_session.post(
            f"{BASE_URL}/api/forum/generate-link/{cid}", timeout=10
        )
        assert r.status_code == 200, r.text
        token = r.json()["token"]

        # 4) Public GET (no auth)
        r = requests.get(f"{BASE_URL}/api/public/form/{token}", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "fields" in body
        # Each field should have 'required' boolean
        for f in body["fields"]:
            assert "required" in f, f"field {f.get('key')} missing 'required'"
            assert isinstance(f["required"], bool)
        # Verify required flags
        rmap = {f["key"]: f["required"] for f in body["fields"]}
        assert rmap.get("legal_name") is True
        assert rmap.get("voen") is True
        assert rmap.get("sector") is False

        # store token for next test
        cleanup_state["_public_token"] = token

    def test_public_submit_400_on_missing_required(self, cleanup_state):
        token = cleanup_state.get("_public_token")
        assert token, "previous test should have created token"
        # Submit empty -> legal_name + voen missing
        r = requests.post(
            f"{BASE_URL}/api/public/form/{token}",
            json={"legal_name": "", "voen": "   ", "sector": "IT"},
            timeout=10,
        )
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        assert "Aşağıdakı məcburi sahələr doldurulmalıdır" in detail
        assert "Hüquqi ad" in detail
        assert "VÖEN" in detail
        assert "," in detail, "Expected both required field names listed"

    def test_public_submit_200_when_required_filled(self, cleanup_state):
        token = cleanup_state.get("_public_token")
        assert token
        r = requests.post(
            f"{BASE_URL}/api/public/form/{token}",
            json={
                "legal_name": "TEST_FilledLegal MMC",
                "voen": "1234567890",
                "sector": "IT",
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text


# ============================================================
# #10 — ProjectDetail "Müştəri əlavə et"
# ============================================================
class TestProjectCustomerSalesLead:
    def test_create_lead_with_project_id_appears_in_project_sales(
        self, admin_session, cleanup_state
    ):
        # 1) Create a project-event
        proj_payload = {
            "project_name": f"TEST_Proj_{uuid.uuid4().hex[:6]}",
            "name": f"TEST_Proj_{uuid.uuid4().hex[:6]}",
            "type": "Forum",
            "marsol_company": "Marsol Group",
        }
        r = admin_session.post(
            f"{BASE_URL}/api/project-events", json=proj_payload, timeout=15
        )
        # Some apps use /api/projects -- try fallback
        if r.status_code not in (200, 201):
            r = admin_session.post(
                f"{BASE_URL}/api/projects", json=proj_payload, timeout=15
            )
        assert r.status_code in (200, 201), f"Could not create project: {r.status_code} {r.text}"
        proj = r.json()
        pid = proj.get("id")
        assert pid
        cleanup_state["project_ids"].append(pid)

        # 2) POST /api/sales-leads with project_id and status='Satıldı'
        lead_payload = {
            "company_name": f"TEST_Customer_{uuid.uuid4().hex[:5]}",
            "contact_name": "TEST_Contact",
            "phone": "",
            "email": "",
            "project_id": pid,
            "status": "Satıldı",
            "sale_type": "Üzvlük",
        }
        r = admin_session.post(
            f"{BASE_URL}/api/sales-leads", json=lead_payload, timeout=15
        )
        assert r.status_code in (200, 201), r.text
        lead = r.json()
        lid = lead.get("id")
        assert lid
        cleanup_state["lead_ids"].append(lid)
        assert lead.get("project_id") == pid
        assert lead.get("status") == "Satıldı"

        # 3) GET /api/project-events/{pid}/sales should include this lead
        r = admin_session.get(
            f"{BASE_URL}/api/project-events/{pid}/sales", timeout=10
        )
        assert r.status_code == 200, r.text
        sales = r.json()
        # Endpoint may return list directly or {sales: [...]}
        if isinstance(sales, dict):
            sales = sales.get("sales", sales.get("leads", []))
        assert isinstance(sales, list)
        ids = [s.get("id") for s in sales]
        assert lid in ids, f"Created lead {lid} not found in project sales: {ids}"
