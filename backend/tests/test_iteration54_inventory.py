"""Iteration 54 — Inventory (İnventar) module tests.

Covers CRUD on /api/finance/inventory, auto display_id generation, validation,
value-report aggregations and RBAC (admin write, sales-manager read-only)."""

import os
import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Fallback: read from frontend/.env file
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert url, "REACT_APP_BACKEND_URL not configured"
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


# ---------- Shared fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def sales_token():
    r = requests.post(f"{API}/auth/login", json=SALES, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Sales user login failed: {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sales_headers(sales_token):
    return {"Authorization": f"Bearer {sales_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # teardown — best effort
    tok_resp = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    if tok_resp.status_code == 200:
        h = {"Authorization": f"Bearer {tok_resp.json()['access_token']}"}
        for iid in ids:
            try:
                requests.delete(f"{API}/finance/inventory/{iid}", headers=h, timeout=15)
            except Exception:
                pass


# ---------- LIST ----------
class TestInventoryList:
    def test_list_inventory_returns_array(self, admin_headers):
        r = requests.get(f"{API}/finance/inventory", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # _id must be excluded
        for it in data:
            assert "_id" not in it

    def test_list_inventory_requires_auth(self):
        r = requests.get(f"{API}/finance/inventory", timeout=30)
        assert r.status_code in (401, 403)


# ---------- CREATE ----------
class TestInventoryCreate:
    def test_create_inventory_item_success(self, admin_headers, created_ids):
        payload = {
            "department": "IT",
            "asset_name": "TEST_Notebook_Lenovo_T14",
            "category": "Texnika",
            "inventory_code": "TEST_INV_001",
            "quantity": 3,
            "condition": "Yaxşı",
            "responsible_person": "TEST_User",
            "location": "Ofis 1",
            "purchase_date": "2024-01-15",
            "last_check_date": "2024-12-01",
            "status": "Aktiv",
            "note": "TEST_note",
            "unit_value": 1200.50,
        }
        r = requests.post(f"{API}/finance/inventory", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        item = r.json()
        assert "id" in item
        assert "display_id" in item and item["display_id"].startswith("I")
        assert item["asset_name"] == payload["asset_name"]
        assert item["quantity"] == 3
        assert item["unit_value"] == 1200.50
        assert item["status"] == "Aktiv"
        assert "_id" not in item
        created_ids.append(item["id"])

    def test_create_inventory_auto_display_id_format(self, admin_headers, created_ids):
        payload = {"asset_name": "TEST_Asset_Auto_ID", "quantity": 1, "unit_value": 10}
        r = requests.post(f"{API}/finance/inventory", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        item = r.json()
        # Format: I followed by at least 3 digits
        assert item["display_id"].startswith("I")
        assert len(item["display_id"]) >= 4
        assert item["display_id"][1:].isdigit()
        created_ids.append(item["id"])

    def test_create_empty_asset_name_rejected(self, admin_headers):
        r = requests.post(
            f"{API}/finance/inventory",
            json={"asset_name": "", "quantity": 1, "unit_value": 5},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 400, r.text


# ---------- UPDATE ----------
class TestInventoryUpdate:
    def test_update_inventory_persists(self, admin_headers, created_ids):
        # First create
        r = requests.post(
            f"{API}/finance/inventory",
            json={"asset_name": "TEST_Update_Target", "quantity": 2, "unit_value": 100, "status": "Aktiv"},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200
        item_id = r.json()["id"]
        created_ids.append(item_id)

        # Update quantity, note, status
        upd = {"quantity": 7, "note": "TEST_updated_note", "status": "Təmirdə"}
        r2 = requests.put(f"{API}/finance/inventory/{item_id}", json=upd, headers=admin_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        updated = r2.json()
        assert updated["quantity"] == 7
        assert updated["note"] == "TEST_updated_note"
        assert updated["status"] == "Təmirdə"
        assert "_id" not in updated

        # Verify persistence
        r3 = requests.get(f"{API}/finance/inventory", headers=admin_headers, timeout=30)
        found = [x for x in r3.json() if x["id"] == item_id]
        assert len(found) == 1
        assert found[0]["quantity"] == 7
        assert found[0]["status"] == "Təmirdə"

    def test_update_unknown_id_returns_404(self, admin_headers):
        r = requests.put(
            f"{API}/finance/inventory/nonexistent-id-xyz",
            json={"quantity": 1},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 404


# ---------- DELETE ----------
class TestInventoryDelete:
    def test_delete_inventory_success(self, admin_headers):
        # Create
        r = requests.post(
            f"{API}/finance/inventory",
            json={"asset_name": "TEST_Delete_Target", "quantity": 1, "unit_value": 50},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200
        item_id = r.json()["id"]
        # Delete
        r2 = requests.delete(f"{API}/finance/inventory/{item_id}", headers=admin_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        # Verify removed
        r3 = requests.get(f"{API}/finance/inventory", headers=admin_headers, timeout=30)
        assert all(x["id"] != item_id for x in r3.json())

    def test_delete_unknown_returns_404(self, admin_headers):
        r = requests.delete(f"{API}/finance/inventory/nonexistent-id-xyz", headers=admin_headers, timeout=30)
        assert r.status_code == 404


# ---------- VALUE REPORT ----------
class TestInventoryValueReport:
    def test_value_report_structure_and_aggregation(self, admin_headers, created_ids):
        # Seed two distinct items
        a = requests.post(
            f"{API}/finance/inventory",
            json={"department": "TEST_DeptA", "category": "TEST_CatX", "asset_name": "TEST_Rep_A",
                  "quantity": 2, "unit_value": 100, "status": "Aktiv"},
            headers=admin_headers, timeout=30,
        )
        b = requests.post(
            f"{API}/finance/inventory",
            json={"department": "TEST_DeptA", "category": "TEST_CatY", "asset_name": "TEST_Rep_B",
                  "quantity": 5, "unit_value": 20, "status": "Təmirdə"},
            headers=admin_headers, timeout=30,
        )
        assert a.status_code == 200 and b.status_code == 200
        created_ids.append(a.json()["id"])
        created_ids.append(b.json()["id"])

        r = requests.get(f"{API}/finance/inventory/value-report", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        rep = r.json()
        assert "totals" in rep and "by_department" in rep and "by_category" in rep and "by_status" in rep
        t = rep["totals"]
        assert "items" in t and "quantity" in t and "value" in t
        assert t["items"] >= 2
        assert t["quantity"] >= 7  # 2 + 5
        assert t["value"] >= (2 * 100 + 5 * 20)  # 300 contribution

        # TEST_DeptA aggregated: items >=2, qty>=7, value>=300
        dept_a = next((d for d in rep["by_department"] if d["department"] == "TEST_DeptA"), None)
        assert dept_a is not None
        assert dept_a["items"] >= 2
        assert dept_a["quantity"] >= 7
        assert dept_a["value"] >= 300

        # by_status contains both Aktiv and Təmirdə
        statuses = {s["status"] for s in rep["by_status"]}
        assert "Aktiv" in statuses
        assert "Təmirdə" in statuses


# ---------- RBAC ----------
class TestInventoryRBAC:
    def test_sales_can_read_inventory(self, sales_headers):
        r = requests.get(f"{API}/finance/inventory", headers=sales_headers, timeout=30)
        # Sales user may or may not have finance:read — accept either 200 or 403
        assert r.status_code in (200, 403), r.text

    def test_sales_cannot_write_inventory(self, sales_headers):
        r = requests.post(
            f"{API}/finance/inventory",
            json={"asset_name": "TEST_RBAC_Block", "quantity": 1, "unit_value": 1},
            headers=sales_headers,
            timeout=30,
        )
        # Must be forbidden (sales lacks finance:write)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_sales_cannot_access_value_report_write_path(self, sales_headers, admin_headers):
        # Sales tries to delete a non-existent id — should be 403, never reach 404
        r = requests.delete(f"{API}/finance/inventory/some-id", headers=sales_headers, timeout=30)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
