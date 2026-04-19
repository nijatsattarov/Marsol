"""
Iteration 22: Attendance & Barter modules — Marsol ERP
- Attendance upsert, bulk, stats
- Leave requests CRUD + auto-attendance on approve
- Barter CRUD + stats
- RBAC for hr (attendance/leaves) and finance (barters)
"""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}
ACCOUNTANT = {"email": "muhasib@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    if r.status_code != 200:
        return None
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def admin_headers():
    t = _login(ADMIN)
    if not t:
        pytest.skip("Admin login failed")
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def sales_headers():
    t = _login(SALES)
    if not t:
        pytest.skip("Sales login failed")
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def accountant_headers():
    t = _login(ACCOUNTANT)
    if not t:
        pytest.skip("Accountant login failed")
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def employee_id(admin_headers):
    # Create a TEST employee so we don't pollute real data
    payload = {
        "full_name": "TEST_AttendanceEmp",
        "first_name": "TEST",
        "last_name": "Emp",
        "department": "QA",
        "position": "Tester",
        "status": "Aktiv",
        "email": "test_att_emp@marsol.test",
        "phone": "+994000000000",
    }
    r = requests.post(f"{API}/employees", json=payload, headers=admin_headers, timeout=20)
    assert r.status_code in (200, 201), f"employee create failed: {r.status_code} {r.text}"
    emp = r.json()
    eid = emp.get("id")
    assert eid
    yield eid
    # cleanup
    requests.delete(f"{API}/employees/{eid}", headers=admin_headers, timeout=20)


# -------------------- AUTH --------------------
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
        assert r.status_code == 200
        assert r.json().get("access_token") or r.json().get("token")

    def test_sales_login(self):
        r = requests.post(f"{API}/auth/login", json=SALES, timeout=20)
        assert r.status_code == 200

    def test_accountant_login(self):
        r = requests.post(f"{API}/auth/login", json=ACCOUNTANT, timeout=20)
        assert r.status_code == 200


# -------------------- ATTENDANCE --------------------
class TestAttendance:
    def test_post_creates_record(self, admin_headers, employee_id):
        payload = {"employee_id": employee_id, "date": "2026-01-05", "status": "İşdə", "notes": "TEST"}
        r = requests.post(f"{API}/attendance", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["employee_id"] == employee_id
        assert data["date"] == "2026-01-05"
        assert data["status"] == "İşdə"
        assert "id" in data

    def test_post_upsert_updates_not_inserts(self, admin_headers, employee_id):
        # second POST same employee+date should update same doc
        payload = {"employee_id": employee_id, "date": "2026-01-05", "status": "Gəlməyib", "notes": "TEST upsert"}
        r = requests.post(f"{API}/attendance", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        # verify only 1 record exists
        g = requests.get(f"{API}/attendance", params={"date": "2026-01-05", "employee_id": employee_id},
                         headers=admin_headers, timeout=20)
        assert g.status_code == 200
        recs = [x for x in g.json() if x["employee_id"] == employee_id]
        assert len(recs) == 1, f"Expected 1 record after upsert, got {len(recs)}"
        assert recs[0]["status"] == "Gəlməyib"

    def test_get_by_date(self, admin_headers, employee_id):
        r = requests.get(f"{API}/attendance", params={"date": "2026-01-05"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_by_date_range(self, admin_headers, employee_id):
        r = requests.get(f"{API}/attendance",
                         params={"start": "2026-01-01", "end": "2026-01-31", "employee_id": employee_id},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_bulk_attendance(self, admin_headers, employee_id):
        payload = {
            "date": "2026-01-06",
            "records": [
                {"employee_id": employee_id, "status": "İşdə"}
            ]
        }
        r = requests.post(f"{API}/attendance/bulk", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert "saxlanıldı" in r.json().get("message", "") or "qeyd" in r.json().get("message", "")

    def test_stats(self, admin_headers, employee_id):
        r = requests.get(f"{API}/attendance/stats", params={"month": "2026-01"},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["month"] == "2026-01"
        assert "per_employee" in data
        assert "totals" in data
        assert isinstance(data["per_employee"], list)
        # totals should contain all statuses
        for s in ["İşdə", "Gəlməyib", "Məzuniyyət", "Xəstəlik", "İcazəli", "Uzaq"]:
            assert s in data["totals"]

    def test_rbac_accountant_cannot_write_attendance(self, accountant_headers, employee_id):
        payload = {"employee_id": employee_id, "date": "2026-01-07", "status": "İşdə"}
        r = requests.post(f"{API}/attendance", json=payload, headers=accountant_headers, timeout=20)
        assert r.status_code in (401, 403), f"Accountant should not write hr, got {r.status_code}"

    def test_rbac_sales_cannot_write_attendance(self, sales_headers, employee_id):
        payload = {"employee_id": employee_id, "date": "2026-01-07", "status": "İşdə"}
        r = requests.post(f"{API}/attendance", json=payload, headers=sales_headers, timeout=20)
        assert r.status_code in (401, 403)


# -------------------- LEAVE REQUESTS --------------------
class TestLeaveRequests:
    _created = {"id": None}

    def test_create_leave(self, admin_headers, employee_id):
        payload = {
            "employee_id": employee_id,
            "type": "Məzuniyyət",
            "start_date": "2026-01-10",
            "end_date": "2026-01-12",
            "reason": "TEST leave"
        }
        r = requests.post(f"{API}/leave-requests", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "Gözləyir"
        assert data["employee_id"] == employee_id
        TestLeaveRequests._created["id"] = data["id"]

    def test_list_leaves(self, admin_headers, employee_id):
        r = requests.get(f"{API}/leave-requests", params={"employee_id": employee_id},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert any(x["id"] == TestLeaveRequests._created["id"] for x in r.json())

    def test_approve_leave_auto_fills_attendance(self, admin_headers, employee_id):
        lid = TestLeaveRequests._created["id"]
        assert lid
        r = requests.put(f"{API}/leave-requests/{lid}",
                         json={"status": "Təsdiqlənib"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "Təsdiqlənib"
        # Verify attendance auto-filled for 10, 11, 12 Jan 2026 with "Məzuniyyət"
        time.sleep(0.5)
        g = requests.get(f"{API}/attendance",
                         params={"start": "2026-01-10", "end": "2026-01-12", "employee_id": employee_id},
                         headers=admin_headers, timeout=20)
        assert g.status_code == 200
        recs = g.json()
        dates = {r_["date"]: r_["status"] for r_ in recs if r_["employee_id"] == employee_id}
        for d in ["2026-01-10", "2026-01-11", "2026-01-12"]:
            assert d in dates, f"Missing auto-filled date {d}"
            assert dates[d] == "Məzuniyyət", f"Date {d} expected Məzuniyyət got {dates[d]}"

    def test_delete_leave(self, admin_headers):
        lid = TestLeaveRequests._created["id"]
        r = requests.delete(f"{API}/leave-requests/{lid}", headers=admin_headers, timeout=20)
        assert r.status_code == 200


# -------------------- BARTERS --------------------
class TestBarters:
    _created_ids = []

    def test_create_barter_auto_code(self, admin_headers):
        payload = {
            "partner_name": "TEST_PartnerX",
            "partner_contact": "Ali Test",
            "partner_phone": "+994500000000",
            "our_service": "Reklam",
            "their_service": "Dizayn",
            "our_value": 1000,
            "their_value": 1200,
            "status": "Aktiv",
            "notes": "TEST barter"
        }
        r = requests.post(f"{API}/barters", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["barter_code"].startswith("B-"), f"barter_code format {d.get('barter_code')}"
        assert len(d["barter_code"]) >= 5
        assert d["our_value"] == 1000.0
        assert d["their_value"] == 1200.0
        assert d["status"] == "Aktiv"
        TestBarters._created_ids.append(d["id"])

    def test_list_barters(self, admin_headers):
        r = requests.get(f"{API}/barters", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_barter(self, admin_headers):
        bid = TestBarters._created_ids[0]
        r = requests.put(f"{API}/barters/{bid}",
                         json={"status": "Tamamlandı", "our_value": 1500},
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        # verify persisted
        g = requests.get(f"{API}/barters", headers=admin_headers, timeout=20)
        mine = next((x for x in g.json() if x["id"] == bid), None)
        assert mine is not None
        assert mine["status"] == "Tamamlandı"
        assert mine["our_value"] == 1500.0

    def test_barter_stats(self, admin_headers):
        r = requests.get(f"{API}/barters/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total", "active", "by_status", "total_our_value", "total_their_value", "net_balance"]:
            assert k in d, f"stats missing key {k}"
        # net_balance = their - our
        assert d["net_balance"] == round(d["total_their_value"] - d["total_our_value"], 2)
        for s in ["Təklif", "Müzakirədə", "Aktiv", "Tamamlandı", "Ləğv edilib"]:
            assert s in d["by_status"]

    def test_accountant_can_write_barter(self, accountant_headers):
        payload = {"partner_name": "TEST_AccountantBarter", "our_service": "X", "their_service": "Y",
                   "our_value": 100, "their_value": 100, "status": "Təklif"}
        r = requests.post(f"{API}/barters", json=payload, headers=accountant_headers, timeout=20)
        assert r.status_code == 200, f"Accountant should write finance, got {r.status_code} {r.text}"
        TestBarters._created_ids.append(r.json()["id"])

    def test_sales_cannot_write_barter(self, sales_headers):
        payload = {"partner_name": "TEST_SalesBarter", "our_service": "X", "their_service": "Y"}
        r = requests.post(f"{API}/barters", json=payload, headers=sales_headers, timeout=20)
        assert r.status_code in (401, 403), f"Sales should not write finance, got {r.status_code}"

    def test_delete_barter(self, admin_headers):
        for bid in TestBarters._created_ids:
            r = requests.delete(f"{API}/barters/{bid}", headers=admin_headers, timeout=20)
            assert r.status_code == 200


# -------------------- REGRESSION --------------------
class TestRegression:
    def test_projects(self, admin_headers):
        r = requests.get(f"{API}/project-events", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_invitations(self, admin_headers):
        r = requests.get(f"{API}/event-invitations", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_contact_lists(self, admin_headers):
        r = requests.get(f"{API}/contact-lists", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_finance_summary(self, admin_headers):
        r = requests.get(f"{API}/finance/summary", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_employees(self, admin_headers):
        r = requests.get(f"{API}/employees", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_meetings(self, admin_headers):
        r = requests.get(f"{API}/meetings", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_tasks(self, admin_headers):
        r = requests.get(f"{API}/tasks", headers=admin_headers, timeout=20)
        assert r.status_code == 200

    def test_assembly_sessions(self, admin_headers):
        r = requests.get(f"{API}/assembly-sessions", headers=admin_headers, timeout=20)
        # 200 or 404 acceptable if module not present in this env
        assert r.status_code in (200, 404)


# -------------------- CLEANUP --------------------
class TestCleanup:
    def test_cleanup_attendance_created(self, admin_headers, employee_id):
        g = requests.get(f"{API}/attendance",
                         params={"start": "2026-01-01", "end": "2026-01-31", "employee_id": employee_id},
                         headers=admin_headers, timeout=20)
        if g.status_code == 200:
            for rec in g.json():
                if rec.get("employee_id") == employee_id:
                    requests.delete(f"{API}/attendance/{rec['id']}", headers=admin_headers, timeout=20)
        assert True
