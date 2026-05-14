"""
Iteration 56 — Inventory enhancements
- Declining-balance depreciation per FULL year
- depreciable_assets settings registry (seed + CRUD)
- inventory_categories settings registry (seed + CRUD)
- Auto-generate inventory_code from category prefix (<PREFIX>-NNN)
- Auto-fill depreciation rate from registry on POST and PUT
- marsol_company persistence on inventory and users
"""
import os
import re
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone


def _load_url() -> str:
    env_path = "/app/frontend/.env"
    with open(env_path) as f:
        for line in f:
            if line.strip().startswith("REACT_APP_BACKEND_URL="):
                return line.strip().split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE_URL = _load_url()
ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASS = "marsol123"


# ----------------- Fixtures -----------------

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def cleanup_inventory(admin_headers):
    created_ids = []
    yield created_ids
    for iid in created_ids:
        try:
            requests.delete(f"{BASE_URL}/api/finance/inventory/{iid}", headers=admin_headers, timeout=10)
        except Exception:
            pass


@pytest.fixture
def cleanup_depreciable(admin_headers):
    created_ids = []
    yield created_ids
    for did in created_ids:
        try:
            requests.delete(f"{BASE_URL}/api/settings/depreciable-assets/{did}", headers=admin_headers, timeout=10)
        except Exception:
            pass


@pytest.fixture
def cleanup_categories(admin_headers):
    created_ids = []
    yield created_ids
    for cid in created_ids:
        try:
            requests.delete(f"{BASE_URL}/api/settings/inventory-categories/{cid}", headers=admin_headers, timeout=10)
        except Exception:
            pass


@pytest.fixture
def cleanup_users(admin_headers):
    created_ids = []
    yield created_ids
    for uid in created_ids:
        try:
            requests.delete(f"{BASE_URL}/api/settings/users/{uid}", headers=admin_headers, timeout=10)
        except Exception:
            pass


# ----------------- Helpers -----------------

def _purchase_date_years_ago(n_years: int) -> str:
    # 1 day buffer so completed full years count as expected
    dt = datetime.now(timezone.utc) - timedelta(days=n_years * 365 + 5)
    return dt.strftime("%Y-%m-%d")


# ===================== depreciable-assets =====================

class TestDepreciableAssetsRegistry:
    def test_get_seeds_six_defaults(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/settings/depreciable-assets", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        names = {it["name"] for it in items}
        expected_pairs = {
            "Binalar və tikililər": 5,
            "Maşın və avadanlıqlar": 20,
            "Nəqliyyat vasitələri": 25,
            "İT və ofis avadanlığı": 25,
            "Mebel": 20,
            "Digər əsas vəsait": 10,
        }
        # All 6 defaults must be present
        for n, rate in expected_pairs.items():
            assert n in names, f"Default '{n}' not seeded; got {names}"
            it = next(i for i in items if i["name"] == n)
            assert float(it["rate"]) == float(rate), f"{n} rate mismatch: {it['rate']}"

    def test_crud_and_rate_clamp_and_duplicate(self, admin_headers, cleanup_depreciable):
        uniq = uuid.uuid4().hex[:6].upper()
        # CREATE
        name = f"TEST_DA_{uniq}"
        r = requests.post(
            f"{BASE_URL}/api/settings/depreciable-assets",
            headers=admin_headers, json={"name": name, "rate": 15}, timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        cleanup_depreciable.append(d["id"])
        assert d["name"] == name
        assert float(d["rate"]) == 15.0

        # UPDATE rate clamped at 100
        r = requests.put(
            f"{BASE_URL}/api/settings/depreciable-assets/{d['id']}",
            headers=admin_headers, json={"rate": 250}, timeout=10,
        )
        assert r.status_code == 200, r.text
        assert float(r.json()["rate"]) == 100.0

        # DUPLICATE name rejected
        r = requests.post(
            f"{BASE_URL}/api/settings/depreciable-assets",
            headers=admin_headers, json={"name": name, "rate": 5}, timeout=10,
        )
        assert r.status_code == 400, r.text

        # DELETE
        r = requests.delete(
            f"{BASE_URL}/api/settings/depreciable-assets/{d['id']}",
            headers=admin_headers, timeout=10,
        )
        assert r.status_code == 200
        cleanup_depreciable.remove(d["id"])

        # Confirm gone
        r = requests.get(f"{BASE_URL}/api/settings/depreciable-assets", headers=admin_headers, timeout=10)
        assert all(it["id"] != d["id"] for it in r.json())


# ===================== inventory-categories =====================

class TestInventoryCategoriesRegistry:
    def test_get_seeds_six_defaults_with_prefix(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/settings/inventory-categories", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        names = {it["name"]: it for it in items}
        expected = {
            "Kompüter texnikası": "KOM",
            "Mebel": "MEB",
            "Nəqliyyat": "NQL",
            "Ofis avadanlığı": "OFS",
            "Texniki avadanlıq": "TXN",
            "Digər": "DGR",
        }
        for nm, prefix in expected.items():
            assert nm in names, f"Default category '{nm}' missing"
            assert names[nm]["code_prefix"] == prefix

    def test_crud_prefix_uppercased_and_truncated(self, admin_headers, cleanup_categories):
        uniq = uuid.uuid4().hex[:5].upper()
        name = f"TEST_CAT_{uniq}"
        # POST with lowercase, too-long prefix → upper + truncate to 6
        r = requests.post(
            f"{BASE_URL}/api/settings/inventory-categories",
            headers=admin_headers,
            json={"name": name, "code_prefix": "abcdefghij"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        c = r.json()
        cleanup_categories.append(c["id"])
        assert c["code_prefix"] == "ABCDEF"  # uppercased + 6 chars

        # PUT update prefix
        r = requests.put(
            f"{BASE_URL}/api/settings/inventory-categories/{c['id']}",
            headers=admin_headers, json={"code_prefix": "xyz"}, timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["code_prefix"] == "XYZ"

        # DELETE
        r = requests.delete(
            f"{BASE_URL}/api/settings/inventory-categories/{c['id']}",
            headers=admin_headers, timeout=10,
        )
        assert r.status_code == 200
        cleanup_categories.remove(c["id"])


# ===================== Inventory: auto-fill rate, auto-code, marsol_company =====================

class TestInventoryAutoFields:
    def test_post_rate_autofilled_from_registry(self, admin_headers, cleanup_inventory):
        # 'İT və ofis avadanlığı' is a seeded depreciable asset @ 25%
        payload = {
            "asset_name": f"TEST_AutoRate_{uuid.uuid4().hex[:6]}",
            "depreciable_asset": "İT və ofis avadanlığı",
            "quantity": 1,
            "unit_value": 1000,
            "purchase_price": 1000,
            "purchase_date": _purchase_date_years_ago(0),
            "is_operational": True,
        }
        r = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        item = r.json()
        cleanup_inventory.append(item["id"])
        assert float(item["depreciable_asset_rate"]) == 25.0

    def test_post_autogenerates_code_from_category_prefix(self, admin_headers, cleanup_inventory):
        # Snapshot existing max KOM-NNN before test for sequential check
        payload = {
            "asset_name": f"TEST_KOM1_{uuid.uuid4().hex[:6]}",
            "category": "Kompüter texnikası",
            "quantity": 1,
            "unit_value": 500,
            "purchase_price": 500,
            "purchase_date": _purchase_date_years_ago(0),
            "is_operational": True,
        }
        r1 = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload, timeout=15)
        assert r1.status_code == 200, r1.text
        item1 = r1.json()
        cleanup_inventory.append(item1["id"])
        code1 = item1.get("inventory_code", "")
        assert re.match(r"^KOM-\d{3}$", code1), f"Bad code: {code1}"

        # Second item with same category → next sequential code
        payload2 = {**payload, "asset_name": f"TEST_KOM2_{uuid.uuid4().hex[:6]}"}
        r2 = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload2, timeout=15)
        assert r2.status_code == 200, r2.text
        item2 = r2.json()
        cleanup_inventory.append(item2["id"])
        code2 = item2["inventory_code"]
        assert re.match(r"^KOM-\d{3}$", code2)

        n1 = int(code1.split("-")[1])
        n2 = int(code2.split("-")[1])
        assert n2 == n1 + 1, f"Sequential expected: {code1} -> {code2}"

        # Third
        payload3 = {**payload, "asset_name": f"TEST_KOM3_{uuid.uuid4().hex[:6]}"}
        r3 = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload3, timeout=15)
        item3 = r3.json()
        cleanup_inventory.append(item3["id"])
        n3 = int(item3["inventory_code"].split("-")[1])
        assert n3 == n2 + 1

    def test_put_changes_depreciable_asset_refreshes_rate(self, admin_headers, cleanup_inventory):
        # Create with İT (25%)
        payload = {
            "asset_name": f"TEST_RateRefresh_{uuid.uuid4().hex[:6]}",
            "depreciable_asset": "İT və ofis avadanlığı",
            "purchase_price": 1000,
            "purchase_date": _purchase_date_years_ago(0),
            "is_operational": True,
        }
        r = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200
        item = r.json()
        cleanup_inventory.append(item["id"])
        assert float(item["depreciable_asset_rate"]) == 25.0

        # PUT change to 'Binalar və tikililər' (5%) without explicit rate
        r = requests.put(
            f"{BASE_URL}/api/finance/inventory/{item['id']}",
            headers=admin_headers,
            json={"depreciable_asset": "Binalar və tikililər"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        updated = r.json()
        assert float(updated["depreciable_asset_rate"]) == 5.0

    def test_marsol_company_persists_on_inventory(self, admin_headers, cleanup_inventory):
        payload = {
            "asset_name": f"TEST_MS_{uuid.uuid4().hex[:6]}",
            "marsol_company": "TestCo Holdings",
            "purchase_price": 100,
            "purchase_date": _purchase_date_years_ago(0),
            "is_operational": True,
        }
        r = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        item = r.json()
        cleanup_inventory.append(item["id"])
        assert item["marsol_company"] == "TestCo Holdings"

        # PUT update
        r = requests.put(
            f"{BASE_URL}/api/finance/inventory/{item['id']}",
            headers=admin_headers,
            json={"marsol_company": "TestCo Branch B"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["marsol_company"] == "TestCo Branch B"

        # GET list contains it
        r = requests.get(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        found = next((x for x in r.json() if x["id"] == item["id"]), None)
        assert found is not None
        assert found["marsol_company"] == "TestCo Branch B"


# ===================== Declining-balance math =====================

class TestDecliningBalanceMath:
    def test_two_full_years_1000_at_25pct(self, admin_headers, cleanup_inventory):
        # 1000 @ 25% for 2 full years → y1: 1000→750 (depr 250); y2: 750→562.5 (depr 187.5)
        payload = {
            "asset_name": f"TEST_DB_2y_{uuid.uuid4().hex[:6]}",
            "purchase_price": 1000,
            "depreciable_asset_rate": 25,
            "purchase_date": _purchase_date_years_ago(2),
            "is_operational": True,
        }
        r = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        item = r.json()
        cleanup_inventory.append(item["id"])
        v = item["valuation"]
        assert v["depreciation_method"] == "declining_balance"
        assert v["total_initial_value"] == 1000.0
        assert v["book_value"] == 562.5, f"book_value={v['book_value']}"
        assert v["accumulated_depreciation"] == 437.5, f"acc_depr={v['accumulated_depreciation']}"

        breakdown = v.get("yearly_breakdown", [])
        assert len(breakdown) == 2, f"Expected 2 years, got {breakdown}"
        assert breakdown[0]["year"] == 1
        assert breakdown[0]["opening_balance"] == 1000.0
        assert breakdown[0]["depreciation"] == 250.0
        assert breakdown[0]["closing_balance"] == 750.0
        assert breakdown[1]["year"] == 2
        assert breakdown[1]["opening_balance"] == 750.0
        assert breakdown[1]["depreciation"] == 187.5
        assert breakdown[1]["closing_balance"] == 562.5

    def test_declining_balance_stops_at_zero(self, admin_headers, cleanup_inventory):
        # rate=90%, 10 years elapsed → book never < 0, breakdown truncates
        payload = {
            "asset_name": f"TEST_DB_zero_{uuid.uuid4().hex[:6]}",
            "purchase_price": 1000,
            "depreciable_asset_rate": 90,
            "purchase_date": _purchase_date_years_ago(10),
            "is_operational": True,
        }
        r = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        item = r.json()
        cleanup_inventory.append(item["id"])
        v = item["valuation"]
        assert v["book_value"] >= 0, f"book_value negative: {v['book_value']}"
        assert v["book_value"] <= 1.0, f"after 10y@90% book should be near 0: {v['book_value']}"
        # breakdown should have <= 10 entries
        assert len(v["yearly_breakdown"]) <= 10
        # All closing balances must be >= 0
        for row in v["yearly_breakdown"]:
            assert row["closing_balance"] >= 0
            assert row["depreciation"] >= 0

    def test_straight_line_fallback_when_no_rate_but_useful_life(self, admin_headers, cleanup_inventory):
        # rate=0 but useful_life_years=5 → method=straight_line
        payload = {
            "asset_name": f"TEST_SL_{uuid.uuid4().hex[:6]}",
            "purchase_price": 1200,
            "useful_life_years": 5,
            "purchase_date": _purchase_date_years_ago(1),
            "is_operational": True,
        }
        r = requests.post(f"{BASE_URL}/api/finance/inventory", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        item = r.json()
        cleanup_inventory.append(item["id"])
        v = item["valuation"]
        assert v["depreciation_method"] == "straight_line"
        # annual = 1200/5 = 240; monthly = 20; after ~12 months acc ≈ 240
        assert abs(v["annual_depreciation"] - 240.0) < 0.5
        assert v["book_value"] < 1200.0


# ===================== Users marsol_company =====================

class TestUsersMarsolCompany:
    def test_create_update_get_user_marsol_company(self, admin_headers, cleanup_users):
        uniq = uuid.uuid4().hex[:8]
        payload = {
            "email": f"test_marsol_{uniq}@marsol.test",
            "name": f"TEST_User_{uniq}",
            "password": "Test1234!",
            "role": "user",
            "department": "QA",
            "marsol_company": "MarsolCo A",
            "phone": "",
            "status": "Aktiv",
        }
        r = requests.post(f"{BASE_URL}/api/settings/users", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        u = r.json()
        cleanup_users.append(u["id"])
        assert u.get("marsol_company") == "MarsolCo A"

        # PUT update
        r = requests.put(
            f"{BASE_URL}/api/settings/users/{u['id']}",
            headers=admin_headers, json={"marsol_company": "MarsolCo B"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("marsol_company") == "MarsolCo B"

        # GET list
        r = requests.get(f"{BASE_URL}/api/settings/users", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        found = next((x for x in r.json() if x["id"] == u["id"]), None)
        assert found is not None
        assert found.get("marsol_company") == "MarsolCo B"
