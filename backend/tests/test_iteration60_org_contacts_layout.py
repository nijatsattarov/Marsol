"""Iteration 60 — Backend tests for:
   1. /api/settings/manageable-lists contains 'layout_types' with required defaults
   2. /api/organization/venues CRUD persists `contacts` array round-trip
   3. /api/organization/catering CRUD persists `contacts` (regression)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
ADMIN_EMAIL = 'settings@marsol.az'
ADMIN_PASS = 'marsol123'

EXPECTED_LAYOUTS = {"Banket", "Teatr", "Klass", "Boardroom", "Kokteyl", "U-forma", "Yarımdairə", "Konfrans"}


@pytest.fixture(scope='module')
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={'email': ADMIN_EMAIL, 'password': ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json().get('access_token') or r.json().get('token')


@pytest.fixture(scope='module')
def headers(token):
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


# --- Manageable lists: layout_types ---
class TestLayoutTypes:
    def test_layout_types_present(self, headers):
        r = requests.get(f"{BASE_URL}/api/settings/manageable-lists", headers=headers, timeout=20)
        assert r.status_code == 200
        items = r.json()
        layout = next((x for x in items if x.get('key') == 'layout_types'), None)
        assert layout is not None, 'layout_types missing from manageable-lists'
        vals = layout.get('values') or layout.get('defaults') or []
        present = set(vals)
        missing = EXPECTED_LAYOUTS - present
        assert not missing, f"Missing layout_types defaults: {missing}. Got: {present}"


# --- Organization venues: contacts array round-trip ---
class TestVenuesContacts:
    created_id = None

    def test_create_venue_with_contacts(self, headers):
        payload = {
            'name': 'TEST_iter60_venue',
            'category': 'Otel',
            'city': 'Bakı',
            'contacts': [
                {'name': 'TEST_iter60_contact1', 'phone': '+99400000001', 'role': 'Manager'},
                {'name': 'TEST_iter60_contact2', 'phone': '+99400000002'},
            ],
            'table_layouts': ['Banket', 'Teatr'],
        }
        r = requests.post(f"{BASE_URL}/api/organization/venues",
                          json=payload, headers=headers, timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get('id'), 'no id returned'
        assert data['name'] == 'TEST_iter60_venue'
        # contacts array must persist
        contacts = data.get('contacts') or []
        assert isinstance(contacts, list) and len(contacts) == 2, f"contacts not persisted: {contacts}"
        assert contacts[0]['name'] == 'TEST_iter60_contact1'
        assert contacts[0]['phone'] == '+99400000001'
        assert contacts[0].get('role') == 'Manager'
        # table_layouts persists
        assert set(data.get('table_layouts') or []) == {'Banket', 'Teatr'}
        TestVenuesContacts.created_id = data['id']

    def test_get_venue_verifies_contacts(self, headers):
        assert TestVenuesContacts.created_id, 'create test must run first'
        r = requests.get(f"{BASE_URL}/api/organization/venues/{TestVenuesContacts.created_id}",
                         headers=headers, timeout=20)
        # Some routers expose list-only; try list then filter
        if r.status_code == 404 or r.status_code == 405:
            r2 = requests.get(f"{BASE_URL}/api/organization/venues", headers=headers, timeout=20)
            assert r2.status_code == 200
            arr = r2.json()
            found = next((x for x in arr if x.get('id') == TestVenuesContacts.created_id), None)
            assert found, 'created venue not found in list'
            data = found
        else:
            assert r.status_code == 200, f"{r.status_code} {r.text}"
            data = r.json()
        contacts = data.get('contacts') or []
        assert len(contacts) == 2
        names = {c.get('name') for c in contacts}
        assert 'TEST_iter60_contact1' in names

    def test_update_venue_contacts(self, headers):
        assert TestVenuesContacts.created_id
        payload = {
            'name': 'TEST_iter60_venue',
            'contacts': [{'name': 'TEST_iter60_updated', 'phone': '+99400000099'}],
        }
        r = requests.put(f"{BASE_URL}/api/organization/venues/{TestVenuesContacts.created_id}",
                         json=payload, headers=headers, timeout=20)
        assert r.status_code in (200, 204), f"{r.status_code} {r.text}"
        # verify
        r2 = requests.get(f"{BASE_URL}/api/organization/venues", headers=headers, timeout=20)
        arr = r2.json()
        found = next((x for x in arr if x.get('id') == TestVenuesContacts.created_id), None)
        assert found
        contacts = found.get('contacts') or []
        assert len(contacts) == 1 and contacts[0]['name'] == 'TEST_iter60_updated'

    def test_delete_venue(self, headers):
        if not TestVenuesContacts.created_id:
            pytest.skip('no venue created')
        r = requests.delete(f"{BASE_URL}/api/organization/venues/{TestVenuesContacts.created_id}",
                            headers=headers, timeout=20)
        assert r.status_code in (200, 204)


# --- Catering also accepts contacts array (regression) ---
class TestCateringContacts:
    cid = None

    def test_create_catering_with_contacts(self, headers):
        payload = {
            'name': 'TEST_iter60_catering',
            'contacts': [{'name': 'TEST_iter60_cater', 'phone': '+99400000003', 'role': 'Sales'}],
        }
        r = requests.post(f"{BASE_URL}/api/organization/catering",
                          json=payload, headers=headers, timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get('id')
        contacts = data.get('contacts') or []
        assert len(contacts) == 1
        assert contacts[0]['phone'] == '+99400000003'
        TestCateringContacts.cid = data['id']

    def test_cleanup_catering(self, headers):
        if not TestCateringContacts.cid:
            pytest.skip('no catering created')
        r = requests.delete(f"{BASE_URL}/api/organization/catering/{TestCateringContacts.cid}",
                            headers=headers, timeout=20)
        assert r.status_code in (200, 204)
