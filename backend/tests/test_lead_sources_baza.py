"""Tests for Settings Lead Sources 'Baza' presence + parity with /options/all"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
EXPECTED = ['Baza', 'Marketing', 'Referans', 'Sosial media', 'Veb sayt', 'Sərgi', 'Soyuq zəng', 'Digər']


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "settings@marsol.az", "password": "marsol123"})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_lead_sources_endpoint_has_baza_first(auth_headers):
    r = requests.get(f"{BASE_URL}/api/settings/lists/lead_sources", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    sources = data if isinstance(data, list) else data.get("items") or data.get("values") or data.get("lead_sources")
    assert sources is not None, f"unexpected shape: {data}"
    assert 'Baza' in sources, f"Baza missing: {sources}"
    assert sources[0] == 'Baza', f"Baza not first: {sources}"
    print(f"lead_sources: {sources}")


def test_options_all_matches_lead_sources(auth_headers):
    r1 = requests.get(f"{BASE_URL}/api/settings/lists/lead_sources", headers=auth_headers)
    r2 = requests.get(f"{BASE_URL}/api/options/all", headers=auth_headers)
    assert r1.status_code == 200 and r2.status_code == 200
    d1 = r1.json()
    s1 = d1 if isinstance(d1, list) else d1.get("items") or d1.get("values") or d1.get("lead_sources")
    d2 = r2.json()
    s2 = d2.get("lead_sources") if isinstance(d2, dict) else None
    assert s2 is not None, f"options/all missing lead_sources: {d2}"
    assert list(s1) == list(s2), f"mismatch:\n settings={s1}\n options={s2}"


def test_expected_8_defaults_present(auth_headers):
    r = requests.get(f"{BASE_URL}/api/options/all", headers=auth_headers)
    assert r.status_code == 200
    sources = r.json().get("lead_sources") or []
    for exp in EXPECTED:
        assert exp in sources, f"missing default {exp} in {sources}"
    assert sources[0] == 'Baza'
