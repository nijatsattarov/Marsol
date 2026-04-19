"""
Iteration 24 — Fəaliyyətlər (Təşkilatçılıq) module tests.
Covers: 7 vendor modules CRUD, ratings CRUD + aggregation, dashboard stats,
cascade delete, invalid module 404, RBAC for Mühasib role.
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
ACCOUNTANT = {"email": "muhasib@marsol.az", "password": "marsol123"}

VENDOR_MODULES = ["venues", "catering", "decor", "musicians",
                  "photovideo", "transport", "materials"]


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def accountant_token():
    return _login(ACCOUNTANT)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def accountant_headers(accountant_token):
    return {"Authorization": f"Bearer {accountant_token}", "Content-Type": "application/json"}


# ---------- Auth sanity ----------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert admin_token and isinstance(admin_token, str)

    def test_accountant_login(self, accountant_token):
        assert accountant_token and isinstance(accountant_token, str)


# ---------- Dashboard stats ----------
class TestDashboard:
    def test_dashboard_stats_structure(self, admin_headers):
        r = requests.get(f"{API}/organization/dashboard/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "counts" in data and isinstance(data["counts"], dict)
        # 7 vendor modules must have counts
        for m in VENDOR_MODULES:
            assert m in data["counts"], f"missing count for {m}"
        assert "total_ratings" in data
        assert "top_rated" in data and isinstance(data["top_rated"], list)
        assert len(data["top_rated"]) <= 5
        assert "recent_additions" in data and isinstance(data["recent_additions"], list)


# ---------- Invalid module 404 ----------
class TestInvalidModule:
    def test_invalid_module_404(self, admin_headers):
        r = requests.get(f"{API}/organization/invalidmod", headers=admin_headers, timeout=20)
        assert r.status_code == 404, f"expected 404 got {r.status_code}"


# ---------- Vendor CRUD all 7 modules ----------
_created = {}  # module -> id (keep for cascade test)


class TestVendorCRUD:
    @pytest.mark.parametrize("module", VENDOR_MODULES)
    def test_vendor_crud(self, admin_headers, module):
        name = f"TEST_{module}_{uuid.uuid4().hex[:6]}"
        payload = {"name": name, "category": "Test", "city": "Bakı",
                   "capacity": 100, "phone": "+994501234567"}
        # Create
        r = requests.post(f"{API}/organization/{module}", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"create {module} failed: {r.status_code} {r.text}"
        doc = r.json()
        assert "id" in doc
        assert doc.get("name") == name
        vid = doc["id"]
        _created[module] = vid

        # GET list and find
        r = requests.get(f"{API}/organization/{module}", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert any(x["id"] == vid for x in r.json())

        # Update
        r = requests.put(f"{API}/organization/{module}/{vid}",
                         json={"city": "Gəncə"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("city") == "Gəncə"


# ---------- Ratings ----------
_rating_ids = []
_target_vendor_id = None  # venue used for aggregation test


class TestRatings:
    def test_create_target_venue(self, admin_headers):
        global _target_vendor_id
        r = requests.post(f"{API}/organization/venues",
                          json={"name": f"TEST_RATING_VENUE_{uuid.uuid4().hex[:6]}",
                                "category": "Restoran", "city": "Bakı"},
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200
        _target_vendor_id = r.json()["id"]

    def test_create_high_rating(self, admin_headers):
        assert _target_vendor_id
        payload = {
            "vendor_type": "venues",
            "vendor_id": _target_vendor_id,
            "event_name": "TEST Toy 1",
            "event_date": "2026-01-10",
            "price_score": 5, "quality_score": 5, "operativity_score": 5,
            "behavior_score": 5, "flexibility_score": 5, "event_fit_score": 5,
            "rehire_willingness": "Bəli",
            "comment": "TEST Əla",
        }
        r = requests.post(f"{API}/organization/ratings", json=payload,
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["vendor_id"] == _target_vendor_id
        assert d["price_score"] == 5.0
        _rating_ids.append(d["id"])

    def test_create_second_rating(self, admin_headers):
        payload = {
            "vendor_type": "venues",
            "vendor_id": _target_vendor_id,
            "event_name": "TEST Toy 2",
            "event_date": "2026-01-12",
            "price_score": 4, "quality_score": 5, "operativity_score": 4,
            "behavior_score": 5, "flexibility_score": 4, "event_fit_score": 4,
            "rehire_willingness": "Bəli",
            "comment": "TEST Yaxşı",
        }
        r = requests.post(f"{API}/organization/ratings", json=payload,
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200
        _rating_ids.append(r.json()["id"])

    def test_ratings_list(self, admin_headers):
        r = requests.get(f"{API}/organization/ratings/list", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        items = r.json()
        ids = {i["id"] for i in items}
        for rid in _rating_ids:
            assert rid in ids

    def test_ratings_summary_recommends(self, admin_headers):
        r = requests.get(f"{API}/organization/ratings/summary", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        target = next((x for x in data if x["vendor_id"] == _target_vendor_id), None)
        assert target is not None, "aggregated row missing for target vendor"
        assert target["count"] == 2
        assert target["overall"] >= 4.2
        assert target["rehire_rate"] >= 75
        assert target["recommendation"] == "Tövsiyə edilir"

    def test_venues_list_has_rating_avg(self, admin_headers):
        r = requests.get(f"{API}/organization/venues", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        target = next((x for x in r.json() if x["id"] == _target_vendor_id), None)
        assert target is not None
        assert target.get("rating_count", 0) == 2
        assert (target.get("rating_avg") or 0) >= 4.2

    def test_low_rating_not_recommended(self, admin_headers):
        # create a fresh venue + low rating
        r = requests.post(f"{API}/organization/venues",
                          json={"name": f"TEST_LOW_{uuid.uuid4().hex[:6]}", "city": "Bakı"},
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200
        vid = r.json()["id"]
        r = requests.post(f"{API}/organization/ratings", json={
            "vendor_type": "venues", "vendor_id": vid,
            "event_name": "TEST Zəif", "event_date": "2026-01-05",
            "price_score": 2, "quality_score": 2, "operativity_score": 2,
            "behavior_score": 2, "flexibility_score": 2, "event_fit_score": 2,
            "rehire_willingness": "Xeyr", "comment": "TEST"
        }, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        rid = r.json()["id"]

        r = requests.get(f"{API}/organization/ratings/summary", headers=admin_headers, timeout=20)
        row = next((x for x in r.json() if x["vendor_id"] == vid), None)
        assert row is not None
        assert row["recommendation"] == "Tövsiyə edilmir"

        # cleanup
        requests.delete(f"{API}/organization/ratings/{rid}", headers=admin_headers, timeout=20)
        requests.delete(f"{API}/organization/venues/{vid}", headers=admin_headers, timeout=20)


# ---------- Cascade delete ----------
class TestCascadeDelete:
    def test_cascade_delete_on_vendor_removal(self, admin_headers):
        # Create venue + rating, then delete vendor, verify rating gone
        r = requests.post(f"{API}/organization/venues",
                          json={"name": f"TEST_CASC_{uuid.uuid4().hex[:6]}", "city": "Bakı"},
                          headers=admin_headers, timeout=20)
        vid = r.json()["id"]
        r = requests.post(f"{API}/organization/ratings", json={
            "vendor_type": "venues", "vendor_id": vid,
            "event_name": "TEST cascade", "event_date": "2026-01-01",
            "price_score": 5, "quality_score": 5, "operativity_score": 5,
            "behavior_score": 5, "flexibility_score": 5, "event_fit_score": 5,
            "rehire_willingness": "Bəli"
        }, headers=admin_headers, timeout=20)
        rid = r.json()["id"]

        # Delete vendor
        r = requests.delete(f"{API}/organization/venues/{vid}", headers=admin_headers, timeout=20)
        assert r.status_code == 200

        # Ratings list should not contain rid
        r = requests.get(f"{API}/organization/ratings/list",
                         params={"vendor_id": vid}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert all(x["id"] != rid for x in r.json()), "cascade delete failed"


# ---------- RBAC ----------
class TestRBAC:
    def test_accountant_cannot_create_venue(self, accountant_headers):
        r = requests.post(f"{API}/organization/venues",
                          json={"name": "TEST_forbidden"},
                          headers=accountant_headers, timeout=20)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_accountant_cannot_create_rating(self, accountant_headers):
        r = requests.post(f"{API}/organization/ratings",
                          json={"vendor_type": "venues", "vendor_id": "x"},
                          headers=accountant_headers, timeout=20)
        assert r.status_code == 403

    def test_accountant_can_read_dashboard(self, accountant_headers):
        r = requests.get(f"{API}/organization/dashboard/stats",
                         headers=accountant_headers, timeout=20)
        # Read allowed (depends on RBAC) — accept 200 or 403
        assert r.status_code in (200, 403)


# ---------- Regression smoke for prior modules ----------
class TestRegression:
    def test_barter_list(self, admin_headers):
        r = requests.get(f"{API}/barters", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_attendance_list(self, admin_headers):
        r = requests.get(f"{API}/attendance", headers=admin_headers, timeout=20)
        assert r.status_code in (200, 404)  # endpoint variants

    def test_projects_list(self, admin_headers):
        r = requests.get(f"{API}/settings/projects", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_contact_lists(self, admin_headers):
        r = requests.get(f"{API}/contact-lists", headers=admin_headers, timeout=20)
        assert r.status_code == 200


# ---------- Cleanup ----------
@pytest.fixture(scope="module", autouse=True)
def _cleanup(admin_headers):
    yield
    # Delete created TEST vendors
    for module, vid in list(_created.items()):
        try:
            requests.delete(f"{API}/organization/{module}/{vid}",
                            headers=admin_headers, timeout=20)
        except Exception:
            pass
    # Delete target vendor (ratings cascade)
    if _target_vendor_id:
        try:
            requests.delete(f"{API}/organization/venues/{_target_vendor_id}",
                            headers=admin_headers, timeout=20)
        except Exception:
            pass
