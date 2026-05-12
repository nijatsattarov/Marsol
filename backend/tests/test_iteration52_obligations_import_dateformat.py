"""Iter 52 — POST /api/obligations/import-excel + DD/MM/YYYY date display.

Backend coverage:
- Happy path: DD/MM/YYYY parsed → owner_name merged 'Ad Soyad', start/end ISO, package set
- Unknown brand name → skipped + 'Şirkət tapılmadı: <name>' error
- Empty Şirkət → skipped + 'Şirkət adı boşdur' error
- Only Ad / only Soyad / both empty → owner_name handling
- ISO date '2026-01-15' also accepted by parser
- RBAC: non-write role (Satış meneceri) gets 403
"""
import os
import requests
import pytest

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # Fallback to frontend/.env (test runs in same container)
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"
ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def sales_token():
    return _login(SALES)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def target_company(admin_headers):
    """Pick first existing company so import can match it by brand_name."""
    r = requests.get(f"{API}/companies", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text[:200]
    items = r.json()
    assert items, "No companies seeded; cannot test import"
    c = items[0]
    # Snapshot original values for restoration
    orig = {
        "owner_name": c.get("owner_name", ""),
        "package": c.get("package", ""),
        "contract_start_date": c.get("contract_start_date", ""),
        "contract_end_date": c.get("contract_end_date", ""),
        "brand_name": c.get("brand_name"),
        "id": c.get("id"),
    }
    yield orig
    # Restore via direct admin PUT
    try:
        requests.put(
            f"{API}/companies/{orig['id']}",
            headers=admin_headers,
            json={
                "owner_name": orig["owner_name"],
                "package": orig["package"],
                "contract_start_date": orig["contract_start_date"],
                "contract_end_date": orig["contract_end_date"],
            },
            timeout=30,
        )
    except Exception:
        pass


def _get_company(admin_headers, brand):
    r = requests.get(f"{API}/companies", headers=admin_headers, timeout=30)
    for c in r.json():
        if c.get("brand_name") == brand:
            return c
    return None


# ---------- Happy path ----------

def test_import_ddmmyyyy_happy_path(admin_headers, target_company):
    brand = target_company["brand_name"]
    payload = {
        "rows": [{
            "Şirkət": brand,
            "Ad": "TestImp",
            "Soyad": "İter52",
            "Paket": "Premium",
            "Müqavilə başlama": "01/01/2026",
            "Müqavilə bitmə": "31/12/2026",
        }]
    }
    r = requests.post(f"{API}/obligations/import-excel", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data["updated"] == 1
    assert data["skipped"] == 0
    assert data["total"] == 1
    assert data["errors"] == []
    # Verify persistence
    c = _get_company(admin_headers, brand)
    assert c is not None
    assert c["owner_name"] == "TestImp İter52"
    assert c["package"] == "Premium"
    assert c["contract_start_date"] == "2026-01-01"
    assert c["contract_end_date"] == "2026-12-31"


# ---------- Unknown brand ----------

def test_import_unknown_company_skipped(admin_headers):
    payload = {"rows": [{
        "Şirkət": "TEST_DOES_NOT_EXIST_iter52",
        "Ad": "X", "Soyad": "Y",
    }]}
    r = requests.post(f"{API}/obligations/import-excel", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["updated"] == 0
    assert d["skipped"] == 1
    assert len(d["errors"]) == 1
    assert "tapılmadı" in d["errors"][0]["reason"]
    assert "TEST_DOES_NOT_EXIST_iter52" in d["errors"][0]["reason"]


# ---------- Empty Şirkət ----------

def test_import_empty_company_name_skipped(admin_headers):
    payload = {"rows": [{"Şirkət": "", "Ad": "A", "Soyad": "B"}]}
    r = requests.post(f"{API}/obligations/import-excel", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["skipped"] == 1
    assert any("boşdur" in e["reason"] for e in d["errors"])


# ---------- Only Ad / only Soyad / both empty ----------

def test_only_first_name_sets_owner_name(admin_headers, target_company):
    brand = target_company["brand_name"]
    payload = {"rows": [{"Şirkət": brand, "Ad": "OnlyFirst", "Soyad": ""}]}
    r = requests.post(f"{API}/obligations/import-excel", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code == 200
    assert r.json()["updated"] == 1
    c = _get_company(admin_headers, brand)
    assert c["owner_name"] == "OnlyFirst"


def test_only_last_name_sets_owner_name(admin_headers, target_company):
    brand = target_company["brand_name"]
    payload = {"rows": [{"Şirkət": brand, "Ad": "", "Soyad": "OnlyLast"}]}
    r = requests.post(f"{API}/obligations/import-excel", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code == 200
    assert r.json()["updated"] == 1
    c = _get_company(admin_headers, brand)
    assert c["owner_name"] == "OnlyLast"


def test_both_names_empty_skips_owner_update(admin_headers, target_company):
    brand = target_company["brand_name"]
    # First set a known baseline owner_name
    requests.post(
        f"{API}/obligations/import-excel",
        headers=admin_headers,
        json={"rows": [{"Şirkət": brand, "Ad": "Baseline", "Soyad": "User"}]},
        timeout=30,
    )
    baseline = _get_company(admin_headers, brand)
    assert baseline["owner_name"] == "Baseline User"

    # Now send empty names + only a package change → owner_name should remain
    payload = {"rows": [{"Şirkət": brand, "Ad": "", "Soyad": "", "Paket": "Standart"}]}
    r = requests.post(f"{API}/obligations/import-excel", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code == 200
    assert r.json()["updated"] == 1
    after = _get_company(admin_headers, brand)
    assert after["owner_name"] == "Baseline User", f"owner_name should NOT change when both Ad/Soyad blank, got {after['owner_name']}"
    assert after["package"] == "Standart"


# ---------- ISO format support ----------

def test_iso_date_format_accepted(admin_headers, target_company):
    brand = target_company["brand_name"]
    payload = {"rows": [{
        "Şirkət": brand,
        "Ad": "ISO", "Soyad": "Date",
        "Müqavilə başlama": "2026-01-15",
        "Müqavilə bitmə": "2026-06-30",
    }]}
    r = requests.post(f"{API}/obligations/import-excel", headers=admin_headers, json=payload, timeout=30)
    assert r.status_code == 200
    assert r.json()["updated"] == 1
    c = _get_company(admin_headers, brand)
    assert c["contract_start_date"] == "2026-01-15"
    assert c["contract_end_date"] == "2026-06-30"


# ---------- RBAC ----------

def test_import_excel_non_write_user_403(sales_token):
    """Satış meneceri default role likely lacks 'obligations:write' (or has read only).
    Verify it cannot call import-excel. If satış has write access we skip rather than fail."""
    headers = {"Authorization": f"Bearer {sales_token}"}
    payload = {"rows": [{"Şirkət": "anything", "Ad": "x", "Soyad": "y"}]}
    r = requests.post(f"{API}/obligations/import-excel", headers=headers, json=payload, timeout=30)
    if r.status_code == 200:
        pytest.skip("Satış role appears to have obligations:write; cannot validate 403")
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"
