"""Backend tests: Settings ↔ options/all sync for lead_sources + registry keys.

Covers bug RCA: _get_setting_list previously fell back to defaults when values=[].
Now: DB doc absent → defaults from LIST_DEFAULTS. DB doc present (even []) → respected.
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

DEFAULT_LEAD_SOURCES = ["Marketing", "Referans", "Sosial media", "Veb sayt", "Sərgi", "Soyuq zəng", "Digər"]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "settings@marsol.az", "password": "marsol123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def mongo():
    with open("/app/backend/.env") as f:
        env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.strip().startswith("#"))
    mu = env.get("MONGO_URL", "").strip('"')
    dn = env.get("DB_NAME", "").strip('"')
    client = MongoClient(mu)
    yield client[dn]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def preserve_original(hdr, mongo):
    r = requests.get(f"{BASE_URL}/api/settings/lists/lead_sources", headers=hdr)
    original = r.json() if r.status_code == 200 else DEFAULT_LEAD_SOURCES
    yield
    # Restore
    requests.put(f"{BASE_URL}/api/settings/lists/lead_sources", headers=hdr, json={"values": original})


def _get_both(hdr):
    a = requests.get(f"{BASE_URL}/api/settings/lists/lead_sources", headers=hdr).json()
    b = requests.get(f"{BASE_URL}/api/options/all", headers=hdr).json().get("lead_sources")
    return a, b


def test_put_custom_syncs_both(hdr):
    custom = ["TEST_Google Ads", "TEST_LinkedIn"]
    r = requests.put(f"{BASE_URL}/api/settings/lists/lead_sources", headers=hdr, json={"values": custom})
    assert r.status_code == 200
    a, b = _get_both(hdr)
    assert a == custom
    assert b == custom


def test_put_empty_returns_empty_both(hdr):
    r = requests.put(f"{BASE_URL}/api/settings/lists/lead_sources", headers=hdr, json={"values": []})
    assert r.status_code == 200
    a, b = _get_both(hdr)
    assert a == []
    assert b == []


def test_delete_doc_returns_defaults_both(hdr, mongo):
    mongo.setting_lists.delete_one({"key": "lead_sources"})
    a, b = _get_both(hdr)
    assert a == DEFAULT_LEAD_SOURCES
    assert b == DEFAULT_LEAD_SOURCES


def test_manageable_lists_includes_new_keys(hdr):
    r = requests.get(f"{BASE_URL}/api/settings/manageable-lists", headers=hdr)
    assert r.status_code == 200
    data = r.json()
    by_key = {d["key"]: d for d in data}
    for k, label in [("lead_sources", "Lead mənbələri"), ("sale_types", "Satış növləri"), ("meeting_types", "Görüş növləri")]:
        assert k in by_key, f"{k} missing from manageable-lists"
        assert by_key[k]["label"] == label
        assert isinstance(by_key[k]["values"], list) and len(by_key[k]["values"]) > 0


def test_sale_types_sync(hdr):
    custom = ["TEST_SaleTypeA"]
    requests.put(f"{BASE_URL}/api/settings/lists/sale_types", headers=hdr, json={"values": custom})
    try:
        a = requests.get(f"{BASE_URL}/api/settings/lists/sale_types", headers=hdr).json()
        b = requests.get(f"{BASE_URL}/api/options/all", headers=hdr).json().get("sale_types")
        assert a == custom
        assert b == custom
    finally:
        requests.put(f"{BASE_URL}/api/settings/lists/sale_types", headers=hdr,
                     json={"values": ["Üzvlük", "Sərgi stendi", "Tur (Daxili)", "Tur (Xarici)", "Təlim", "Digər"]})


def test_lead_statuses_sync(hdr):
    custom = ["TEST_StatusA", "TEST_StatusB"]
    orig = requests.get(f"{BASE_URL}/api/settings/lists/lead_statuses", headers=hdr).json()
    requests.put(f"{BASE_URL}/api/settings/lists/lead_statuses", headers=hdr, json={"values": custom})
    try:
        a = requests.get(f"{BASE_URL}/api/settings/lists/lead_statuses", headers=hdr).json()
        b = requests.get(f"{BASE_URL}/api/options/all", headers=hdr).json().get("lead_statuses")
        assert a == custom
        assert b == custom
    finally:
        requests.put(f"{BASE_URL}/api/settings/lists/lead_statuses", headers=hdr, json={"values": orig})


def test_meeting_types_settings_endpoint(hdr):
    """meeting_types is in registry but NOT in /options/all — only test settings endpoint sync."""
    custom = ["TEST_MeetingA"]
    orig = requests.get(f"{BASE_URL}/api/settings/lists/meeting_types", headers=hdr).json()
    requests.put(f"{BASE_URL}/api/settings/lists/meeting_types", headers=hdr, json={"values": custom})
    try:
        a = requests.get(f"{BASE_URL}/api/settings/lists/meeting_types", headers=hdr).json()
        assert a == custom
    finally:
        requests.put(f"{BASE_URL}/api/settings/lists/meeting_types", headers=hdr, json={"values": orig})
