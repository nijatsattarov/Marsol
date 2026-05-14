"""
Iteration 55 — Inventory financial valuation tests.

Covers: total_initial_value math, depreciation (annual/monthly), months_used,
book_value floor at 0, operational_status logic, revaluation/writeoff suggestion,
market_above_book flag, negative-value guard, /valuation and /value-report endpoints,
RBAC enforcement (sales-manager 403 on writes).
"""
import os
import pytest
import requests
from pathlib import Path
from datetime import datetime, timezone


def _load_url() -> str:
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if val:
        return val.rstrip("/")
    env = Path("/app/frontend/.env")
    if env.exists():
        for ln in env.read_text().splitlines():
            if ln.startswith("REACT_APP_BACKEND_URL="):
                return ln.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE = _load_url()
ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{BASE}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def sales_h():
    return {"Authorization": f"Bearer {_login(SALES)}"}


@pytest.fixture
def created_items():
    ids = []
    yield ids
    # teardown — admin delete
    try:
        tok = _login(ADMIN)
        h = {"Authorization": f"Bearer {tok}"}
        for i in ids:
            requests.delete(f"{BASE}/api/finance/inventory/{i}", headers=h, timeout=10)
    except Exception:
        pass


# ---------- Total initial value & depreciation math ----------
def test_total_initial_value_and_depreciation(admin_h, created_items):
    payload = {
        "asset_name": "TEST_Valuation_Math",
        "department": "TEST_Dept",
        "category": "TEST_Cat",
        "quantity": 1,
        "purchase_price": 2000,
        "delivery_cost": 50,
        "customs_cost": 150,
        "installation_cost": 100,
        "other_costs": 50,
        "useful_life_years": 5,
        "market_value": 1500,
        "is_operational": True,
        "purchase_date": "2024-01-15",
    }
    r = requests.post(f"{BASE}/api/finance/inventory", json=payload, headers=admin_h, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    created_items.append(body["id"])
    v = body["valuation"]
    assert v["total_initial_value"] == 2350.0
    assert v["annual_depreciation"] == 470.0
    assert v["monthly_depreciation"] == 39.17
    assert v["months_used"] >= 1
    assert v["book_value"] >= 0
    assert v["book_value"] <= v["total_initial_value"]
    assert v["accumulated_depreciation"] == round(v["monthly_depreciation"] * v["months_used"], 2) or v["accumulated_depreciation"] <= v["total_initial_value"]


# ---------- Months used ~24 ----------
def test_months_used_from_purchase_date(admin_h, created_items):
    now = datetime.now(timezone.utc)
    purchase_year = now.year - 2
    purchase_iso = f"{purchase_year}-{now.month:02d}-15"
    payload = {
        "asset_name": "TEST_Months_24",
        "purchase_price": 1200,
        "useful_life_years": 10,
        "purchase_date": purchase_iso,
        "is_operational": True,
    }
    r = requests.post(f"{BASE}/api/finance/inventory", json=payload, headers=admin_h, timeout=15)
    assert r.status_code == 200
    body = r.json()
    created_items.append(body["id"])
    months = body["valuation"]["months_used"]
    # day-15 today (logic uses day comparison), purchase day 15 → roughly 24, allow 23-25
    assert 22 <= months <= 25, f"expected ~24 got {months}"


# ---------- Book value floor at 0 ----------
def test_book_value_floor_zero_when_fully_depreciated(admin_h, created_items):
    now = datetime.now(timezone.utc)
    purchase_iso = f"{now.year - 5}-{now.month:02d}-01"
    payload = {
        "asset_name": "TEST_FullyDepreciated",
        "purchase_price": 600,
        "useful_life_years": 1,
        "purchase_date": purchase_iso,
        "is_operational": False,
    }
    r = requests.post(f"{BASE}/api/finance/inventory", json=payload, headers=admin_h, timeout=15)
    assert r.status_code == 200
    body = r.json()
    created_items.append(body["id"])
    v = body["valuation"]
    assert v["book_value"] == 0
    assert v["accumulated_depreciation"] == v["total_initial_value"]
    # fully depreciated + not operational + market=0 → write-off candidate
    assert v["operational_status"] == "Silinməyə namizəd"
    assert v["suggestion"] == "Utilizasiya / silinmə tövsiyə olunur"


# ---------- Operational status matrix ----------
def test_operational_status_in_use(admin_h, created_items):
    payload = {
        "asset_name": "TEST_OpStatus_InUse",
        "purchase_price": 1000,
        "useful_life_years": 10,
        "purchase_date": "2024-06-01",
        "is_operational": True,
    }
    r = requests.post(f"{BASE}/api/finance/inventory", json=payload, headers=admin_h, timeout=15)
    body = r.json()
    created_items.append(body["id"])
    assert body["valuation"]["operational_status"] == "İstifadədədir"


def test_operational_status_fully_depreciated_but_in_use(admin_h, created_items):
    now = datetime.now(timezone.utc)
    payload = {
        "asset_name": "TEST_OpStatus_FD_InUse",
        "purchase_price": 500,
        "useful_life_years": 1,
        "purchase_date": f"{now.year - 4}-01-01",
        "is_operational": True,
    }
    r = requests.post(f"{BASE}/api/finance/inventory", json=payload, headers=admin_h, timeout=15)
    body = r.json()
    created_items.append(body["id"])
    assert body["valuation"]["operational_status"] == "Tam amortizasiya olunub, amma istifadədədir"


def test_operational_status_unusable_only(admin_h, created_items):
    payload = {
        "asset_name": "TEST_OpStatus_Unusable",
        "purchase_price": 2000,
        "useful_life_years": 10,
        "purchase_date": "2024-09-01",
        "is_operational": False,
    }
    r = requests.post(f"{BASE}/api/finance/inventory", json=payload, headers=admin_h, timeout=15)
    body = r.json()
    created_items.append(body["id"])
    assert body["valuation"]["operational_status"] == "İstifadəyə yararsız"


# ---------- Revaluation suggestion / market_above_book ----------
def test_market_above_book_revaluation_suggestion(admin_h, created_items):
    payload = {
        "asset_name": "TEST_Revaluation",
        "purchase_price": 2000,
        "delivery_cost": 50, "customs_cost": 150, "installation_cost": 100, "other_costs": 50,
        "useful_life_years": 5,
        "purchase_date": "2024-01-15",
        "market_value": 5000,
        "is_operational": True,
    }
    r = requests.post(f"{BASE}/api/finance/inventory", json=payload, headers=admin_h, timeout=15)
    body = r.json()
    created_items.append(body["id"])
    v = body["valuation"]
    assert v["market_above_book"] is True
    assert v["suggestion"] is not None
    assert "yenidən qiymətləndirmə" in v["suggestion"]


# ---------- Negative-value guard on create ----------
def test_negative_values_coerced_to_zero_on_create(admin_h, created_items):
    payload = {
        "asset_name": "TEST_Negative",
        "purchase_price": -500,
        "delivery_cost": -100,
        "customs_cost": -50,
        "installation_cost": -25,
        "other_costs": -10,
        "useful_life_years": -3,
        "market_value": -200,
        "is_operational": True,
    }
    r = requests.post(f"{BASE}/api/finance/inventory", json=payload, headers=admin_h, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    created_items.append(body["id"])
    v = body["valuation"]
    assert v["purchase_price"] == 0.0
    assert v["delivery_cost"] == 0.0
    assert v["total_initial_value"] == 0.0
    assert v["useful_life_years"] == 0.0
    assert v["market_value"] == 0.0
    assert v["book_value"] == 0.0


# ---------- Negative-value guard on PUT ----------
def test_negative_values_coerced_on_update(admin_h, created_items):
    create = requests.post(f"{BASE}/api/finance/inventory", json={
        "asset_name": "TEST_NegativeUpdate",
        "purchase_price": 1000, "useful_life_years": 5,
    }, headers=admin_h, timeout=15).json()
    iid = create["id"]
    created_items.append(iid)
    r = requests.put(f"{BASE}/api/finance/inventory/{iid}", json={
        "delivery_cost": -100,
        "useful_life_years": -3,
        "market_value": -50,
    }, headers=admin_h, timeout=15)
    assert r.status_code == 200, r.text
    v = r.json()["valuation"]
    assert v["delivery_cost"] == 0.0
    assert v["useful_life_years"] == 0.0
    assert v["market_value"] == 0.0


# ---------- Standalone /valuation endpoint ----------
def test_standalone_valuation_endpoint(admin_h, created_items):
    create = requests.post(f"{BASE}/api/finance/inventory", json={
        "asset_name": "TEST_Standalone_Val",
        "purchase_price": 1000, "delivery_cost": 100,
        "useful_life_years": 4, "purchase_date": "2025-01-01",
        "market_value": 800, "is_operational": True,
    }, headers=admin_h, timeout=15).json()
    iid = create["id"]
    created_items.append(iid)
    r = requests.get(f"{BASE}/api/finance/inventory/{iid}/valuation", headers=admin_h, timeout=15)
    assert r.status_code == 200, r.text
    v = r.json()
    for key in ("total_initial_value", "annual_depreciation", "monthly_depreciation",
                "months_used", "accumulated_depreciation", "book_value",
                "market_value", "operational_status", "market_above_book", "suggestion"):
        assert key in v, f"missing key {key}"
    assert v["total_initial_value"] == 1100.0
    assert v["annual_depreciation"] == 275.0


def test_valuation_endpoint_404(admin_h):
    r = requests.get(f"{BASE}/api/finance/inventory/__bogus__/valuation", headers=admin_h, timeout=15)
    assert r.status_code == 404


# ---------- /value-report aggregations ----------
def test_value_report_structure_and_aggregations(admin_h, created_items):
    # seed two writeoff candidates + one revaluation candidate
    now = datetime.now(timezone.utc)
    wo = requests.post(f"{BASE}/api/finance/inventory", json={
        "asset_name": "TEST_VR_Writeoff",
        "department": "TEST_DeptA", "category": "TEST_CatA",
        "purchase_price": 400, "useful_life_years": 1,
        "purchase_date": f"{now.year - 5}-01-01",
        "is_operational": False, "market_value": 0,
    }, headers=admin_h, timeout=15).json()
    created_items.append(wo["id"])
    rv = requests.post(f"{BASE}/api/finance/inventory", json={
        "asset_name": "TEST_VR_Revaluation",
        "department": "TEST_DeptA", "category": "TEST_CatA",
        "purchase_price": 1000, "useful_life_years": 5,
        "purchase_date": "2024-01-01",
        "market_value": 5000, "is_operational": True,
    }, headers=admin_h, timeout=15).json()
    created_items.append(rv["id"])

    r = requests.get(f"{BASE}/api/finance/inventory/value-report", headers=admin_h, timeout=20)
    assert r.status_code == 200, r.text
    rep = r.json()
    assert "totals" in rep
    t = rep["totals"]
    for k in ("items", "quantity", "initial_value", "book_value",
              "market_value", "accumulated_depreciation", "fully_depreciated_count"):
        assert k in t, f"missing totals key {k}"
    assert t["fully_depreciated_count"] >= 1
    assert isinstance(rep["by_department"], list)
    assert isinstance(rep["by_category"], list)
    assert isinstance(rep["by_operational_status"], list)
    assert isinstance(rep["writeoff_candidates"], list)
    assert isinstance(rep["revaluation_candidates"], list)
    wo_ids = [x["id"] for x in rep["writeoff_candidates"]]
    assert wo["id"] in wo_ids
    rev_ids = [x["id"] for x in rep["revaluation_candidates"]]
    assert rv["id"] in rev_ids
    # delta field present
    for item in rep["revaluation_candidates"]:
        assert "delta" in item


# ---------- RBAC: sales-manager blocked from writes ----------
def test_rbac_sales_manager_blocked_post(sales_h):
    r = requests.post(f"{BASE}/api/finance/inventory", json={
        "asset_name": "TEST_RBAC_Should_Fail", "purchase_price": 100,
    }, headers=sales_h, timeout=15)
    assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text[:200]}"


def test_rbac_sales_manager_blocked_put_delete(admin_h, sales_h, created_items):
    created = requests.post(f"{BASE}/api/finance/inventory", json={
        "asset_name": "TEST_RBAC_Edit", "purchase_price": 100,
    }, headers=admin_h, timeout=15).json()
    iid = created["id"]
    created_items.append(iid)
    r1 = requests.put(f"{BASE}/api/finance/inventory/{iid}", json={"asset_name": "x"}, headers=sales_h, timeout=15)
    assert r1.status_code == 403
    r2 = requests.delete(f"{BASE}/api/finance/inventory/{iid}", headers=sales_h, timeout=15)
    assert r2.status_code == 403
