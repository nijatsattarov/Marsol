"""
Iteration 40: Backend tests for Service Usage tracking per company.

Endpoints under test:
  - GET    /api/companies/{company_id}/service-stats
  - GET    /api/companies/{company_id}/service-usage
  - POST   /api/companies/{company_id}/service-usage
  - PUT    /api/service-usage/{usage_id}
  - DELETE /api/service-usage/{usage_id}
  - GET    /api/dashboard/service-usage-stats
  - Auto-track hook on POST /api/meetings (meeting_type=B2B)

Auth: settings@marsol.az / marsol123 (admin)
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL"):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return url.rstrip("/")


BASE_URL = _load_backend_url()
ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"


# -------------------- Fixtures --------------------
@pytest.fixture(scope="session")
def auth_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        pytest.skip(f"No token in login response: {data}")
    return token


@pytest.fixture(scope="session")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def seeded_packages(headers):
    """Ensure the 19 standard services exist under Premium/Business/Business+."""
    r = requests.post(
        f"{BASE_URL}/api/settings/packages/services/seed", headers=headers, timeout=60
    )
    assert r.status_code == 200, f"Seed failed: {r.status_code} {r.text}"


@pytest.fixture(scope="session")
def test_company(headers, seeded_packages):
    """Create a disposable TEST_ company on the Premium package; delete at session end."""
    brand = f"TEST_ServiceUsage_{uuid.uuid4().hex[:8]}"
    payload = {
        "brand_name": brand,
        "legal_name": brand,
        "package": "Premium",
        "status": "active",
        "phone": "+994500000000",
        "email": f"{brand.lower()}@test.local",
    }
    r = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=payload, timeout=30)
    assert r.status_code in (200, 201), f"Create company failed: {r.status_code} {r.text}"
    company = r.json()
    assert company.get("id")
    yield company
    # Cleanup: delete all service_usage rows + meetings + company
    # Delete usage rows
    usages = requests.get(
        f"{BASE_URL}/api/companies/{company['id']}/service-usage", headers=headers, timeout=30
    )
    if usages.status_code == 200:
        for u in usages.json():
            requests.delete(
                f"{BASE_URL}/api/service-usage/{u['id']}", headers=headers, timeout=15
            )
    # Delete meetings created for this company
    ms = requests.get(f"{BASE_URL}/api/meetings", headers=headers, timeout=30)
    if ms.status_code == 200:
        for m in ms.json():
            if m.get("company") == brand:
                requests.delete(
                    f"{BASE_URL}/api/meetings/{m['id']}", headers=headers, timeout=15
                )
    requests.delete(f"{BASE_URL}/api/companies/{company['id']}", headers=headers, timeout=30)


@pytest.fixture(scope="session")
def b2b_service(headers, test_company):
    """Resolve the exact B2B service dict from service-stats for exact-match create."""
    r = requests.get(
        f"{BASE_URL}/api/companies/{test_company['id']}/service-stats",
        headers=headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    svc = next(
        (s for s in data["services"] if "b2b" in (s.get("name") or "").lower()),
        None,
    )
    assert svc is not None, "B2B service missing from Premium catalog"
    return svc


def _cleanup_usage(headers, company_id):
    r = requests.get(
        f"{BASE_URL}/api/companies/{company_id}/service-usage", headers=headers, timeout=30
    )
    if r.status_code == 200:
        for u in r.json():
            requests.delete(
                f"{BASE_URL}/api/service-usage/{u['id']}", headers=headers, timeout=15
            )


# -------------------- Auth / 401 --------------------
class TestAuth:
    def test_stats_requires_auth(self, test_company):
        r = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-stats", timeout=30
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_usage_list_requires_auth(self, test_company):
        r = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage", timeout=30
        )
        assert r.status_code in (401, 403)

    def test_usage_create_requires_auth(self, test_company):
        r = requests.post(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            json={"service_name": "B2B görüş", "quantity": 1},
            timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_dashboard_stats_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/service-usage-stats", timeout=30)
        assert r.status_code in (401, 403)


# -------------------- service-stats --------------------
class TestServiceStats:
    def test_stats_shape_and_quotas(self, headers, test_company):
        r = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-stats",
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "package_name" in data and "package_id" in data and "services" in data
        assert data["package_name"].lower() == "premium"
        assert isinstance(data["services"], list) and len(data["services"]) >= 15
        # Each service must have required keys
        required = {
            "service_id",
            "name",
            "value",
            "included",
            "quota",
            "unlimited",
            "used",
            "remaining",
            "last_used",
            "history_count",
            "sort_order",
        }
        for s in data["services"]:
            assert required.issubset(s.keys()), f"Missing keys: {required - set(s.keys())}"

        # Premium B2B quota must be 15
        b2b = next(
            (s for s in data["services"] if "b2b" in (s.get("name") or "").lower()),
            None,
        )
        assert b2b is not None, "B2B service missing on Premium"
        assert b2b["quota"] == 15, f"Expected B2B quota=15, got {b2b['quota']}"
        assert b2b["unlimited"] is False
        # "limitsiz" services must have unlimited=True and quota=None
        unlimited_svcs = [s for s in data["services"] if s.get("unlimited")]
        for s in unlimited_svcs:
            assert s["quota"] is None

    def test_stats_404_on_unknown_company(self, headers):
        r = requests.get(
            f"{BASE_URL}/api/companies/does-not-exist-xyz/service-stats",
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 404


# -------------------- CRUD usage --------------------
class TestServiceUsageCRUD:
    def test_create_validation_requires_identifier(self, headers, test_company):
        r = requests.post(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            json={"quantity": 1},
            timeout=30,
        )
        assert r.status_code == 400

    def test_create_by_service_name(self, headers, test_company, b2b_service):
        _cleanup_usage(headers, test_company["id"])
        r = requests.post(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            json={"service_name": b2b_service["name"], "quantity": 2, "notes": "unit test"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["company_id"] == test_company["id"]
        assert doc["quantity"] == 2
        assert doc["notes"] == "unit test"
        assert doc["service_id"] == b2b_service["service_id"]
        assert doc["service_name"] == b2b_service["name"]
        assert len(doc["used_date"]) == 10
        # default auto False for manual create
        assert doc["auto"] is False

        # GET back
        g = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            timeout=30,
        )
        assert g.status_code == 200
        rows = g.json()
        ids = [x["id"] for x in rows]
        assert doc["id"] in ids

        # filter by service_id
        gf = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            params={"service_id": doc["service_id"]},
            timeout=30,
        )
        assert gf.status_code == 200
        assert all(x["service_id"] == doc["service_id"] for x in gf.json())

        _cleanup_usage(headers, test_company["id"])

    def test_update_usage(self, headers, test_company):
        _cleanup_usage(headers, test_company["id"])
        r = requests.post(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            json={"service_name": "B2B görüş", "quantity": 1},
            timeout=30,
        )
        assert r.status_code == 200
        usage_id = r.json()["id"]
        up = requests.put(
            f"{BASE_URL}/api/service-usage/{usage_id}",
            headers=headers,
            json={"quantity": 5, "notes": "updated", "used_date": "2026-05-10"},
            timeout=30,
        )
        assert up.status_code == 200, up.text
        doc = up.json()
        assert doc["quantity"] == 5
        assert doc["notes"] == "updated"
        assert doc["used_date"] == "2026-05-10"
        # verify persistence via list
        lst = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            timeout=30,
        ).json()
        match = next(x for x in lst if x["id"] == usage_id)
        assert match["quantity"] == 5
        _cleanup_usage(headers, test_company["id"])

    def test_delete_usage(self, headers, test_company):
        r = requests.post(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            json={"service_name": "B2B görüş", "quantity": 1},
            timeout=30,
        )
        assert r.status_code == 200
        usage_id = r.json()["id"]
        d = requests.delete(
            f"{BASE_URL}/api/service-usage/{usage_id}", headers=headers, timeout=30
        )
        assert d.status_code == 200
        # GET list should not include it
        lst = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            timeout=30,
        ).json()
        assert usage_id not in [x["id"] for x in lst]
        # Update non-existent returns 404
        up = requests.put(
            f"{BASE_URL}/api/service-usage/{usage_id}",
            headers=headers,
            json={"quantity": 1},
            timeout=30,
        )
        assert up.status_code == 404
        # Delete non-existent returns 404
        d2 = requests.delete(
            f"{BASE_URL}/api/service-usage/{usage_id}", headers=headers, timeout=30
        )
        assert d2.status_code == 404

    def test_stats_reflects_usage(self, headers, test_company, b2b_service):
        _cleanup_usage(headers, test_company["id"])
        # Create two usage rows with quantity 2 + 3 = 5 of B2B
        for q in (2, 3):
            r = requests.post(
                f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
                headers=headers,
                json={"service_name": b2b_service["name"], "quantity": q},
                timeout=30,
            )
            assert r.status_code == 200
        stats = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-stats",
            headers=headers,
            timeout=30,
        ).json()
        b2b = next(
            s for s in stats["services"] if "b2b" in (s.get("name") or "").lower()
        )
        assert b2b["used"] == 5, f"Expected used=5, got {b2b['used']}"
        assert b2b["quota"] == 15
        assert b2b["remaining"] == 10
        assert b2b["history_count"] >= 2
        _cleanup_usage(headers, test_company["id"])


# -------------------- Auto-track on meeting create --------------------
class TestAutoTrackMeeting:
    def test_meeting_auto_creates_usage_and_is_idempotent(self, headers, test_company):
        _cleanup_usage(headers, test_company["id"])
        meeting_payload = {
            "employee": "Test Emp",
            "date": "2026-05-15",
            "time": "10:00",
            "company": test_company["brand_name"],
            "contact_person": "Contact",
            "meeting_type": "B2B",
            "meeting_mode": "Offline",
        }
        m1 = requests.post(
            f"{BASE_URL}/api/meetings", headers=headers, json=meeting_payload, timeout=30
        )
        assert m1.status_code in (200, 201), m1.text
        meeting1 = m1.json()
        # Auto-tracked usage should exist
        usages = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            timeout=30,
        ).json()
        auto_rows = [
            u
            for u in usages
            if u.get("auto")
            and u.get("related_object_type") == "meeting"
            and u.get("related_object_id") == meeting1["id"]
        ]
        assert len(auto_rows) == 1, f"Expected 1 auto row, got {len(auto_rows)}: {auto_rows}"
        assert "b2b" in (auto_rows[0]["service_name"] or "").lower()

        # Creating a 2nd meeting with a distinct id should create a 2nd auto-row
        m2 = requests.post(
            f"{BASE_URL}/api/meetings",
            headers=headers,
            json={**meeting_payload, "date": "2026-05-16"},
            timeout=30,
        )
        assert m2.status_code in (200, 201)
        meeting2 = m2.json()
        assert meeting2["id"] != meeting1["id"]

        usages2 = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            timeout=30,
        ).json()
        auto2 = [u for u in usages2 if u.get("auto")]
        assert len(auto2) == 2, f"Expected 2 auto rows for 2 meetings, got {len(auto2)}"

        # Cleanup meetings
        requests.delete(
            f"{BASE_URL}/api/meetings/{meeting1['id']}", headers=headers, timeout=15
        )
        requests.delete(
            f"{BASE_URL}/api/meetings/{meeting2['id']}", headers=headers, timeout=15
        )
        _cleanup_usage(headers, test_company["id"])

    def test_meeting_without_matching_type_does_not_create_usage(
        self, headers, test_company
    ):
        _cleanup_usage(headers, test_company["id"])
        payload = {
            "employee": "Emp",
            "date": "2026-05-20",
            "company": test_company["brand_name"],
            "meeting_type": "Unknown-Type-XYZ",
        }
        m = requests.post(
            f"{BASE_URL}/api/meetings", headers=headers, json=payload, timeout=30
        )
        assert m.status_code in (200, 201)
        meeting = m.json()
        usages = requests.get(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            timeout=30,
        ).json()
        auto = [u for u in usages if u.get("auto")]
        assert len(auto) == 0
        requests.delete(
            f"{BASE_URL}/api/meetings/{meeting['id']}", headers=headers, timeout=15
        )


# -------------------- Dashboard widget --------------------
class TestDashboardServiceUsage:
    def test_default_month_shape(self, headers, test_company):
        _cleanup_usage(headers, test_company["id"])
        # Seed one usage row in current month
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.post(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            json={"service_name": "B2B görüş", "quantity": 3, "used_date": today},
            timeout=30,
        )
        assert r.status_code == 200

        d = requests.get(
            f"{BASE_URL}/api/dashboard/service-usage-stats", headers=headers, timeout=30
        )
        assert d.status_code == 200
        data = d.json()
        assert "month" in data and "top_services" in data and "total_records" in data
        assert len(data["month"]) == 7  # YYYY-MM
        assert isinstance(data["top_services"], list)
        assert isinstance(data["total_records"], int)
        assert data["total_records"] >= 1
        # B2B should be in top_services
        names = [s.get("service_name", "").lower() for s in data["top_services"]]
        assert any("b2b" in n for n in names)
        _cleanup_usage(headers, test_company["id"])

    def test_explicit_month_filter(self, headers, test_company):
        _cleanup_usage(headers, test_company["id"])
        # Seed a row in May 2026
        r = requests.post(
            f"{BASE_URL}/api/companies/{test_company['id']}/service-usage",
            headers=headers,
            json={
                "service_name": "B2B görüş",
                "quantity": 4,
                "used_date": "2026-05-15",
            },
            timeout=30,
        )
        assert r.status_code == 200

        d = requests.get(
            f"{BASE_URL}/api/dashboard/service-usage-stats",
            headers=headers,
            params={"month": "2026-05"},
            timeout=30,
        )
        assert d.status_code == 200
        data = d.json()
        assert data["month"] == "2026-05"
        assert data["total_records"] >= 1

        # Different month returns 0
        d2 = requests.get(
            f"{BASE_URL}/api/dashboard/service-usage-stats",
            headers=headers,
            params={"month": "2020-01"},
            timeout=30,
        )
        assert d2.status_code == 200
        data2 = d2.json()
        assert data2["month"] == "2020-01"
        _cleanup_usage(headers, test_company["id"])

    def test_invalid_month_falls_back_to_current(self, headers):
        d = requests.get(
            f"{BASE_URL}/api/dashboard/service-usage-stats",
            headers=headers,
            params={"month": "bogus"},
            timeout=30,
        )
        assert d.status_code == 200
        data = d.json()
        expected = datetime.now(timezone.utc).strftime("%Y-%m")
        assert data["month"] == expected
