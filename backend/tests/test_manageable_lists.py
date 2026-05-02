"""
Tests for Settings/Manageable Lists feature (iteration_41).

Covers:
 - GET /api/settings/manageable-lists (16 items, correct groups, defaults=values when no override)
 - PUT /api/settings/lists/{key} persistence + mirrored in /options/all
 - /api/options/all includes new dynamic keys
 - Backward compatibility (meeting_types/lead_sources/sale_types still work)
 - Reset-to-default restores defaults via PUT
"""

import os
import pytest
import requests
from pathlib import Path


def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_file = Path("/app/frontend/.env")
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip("/")


BASE_URL = _load_base_url()
ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"


# Expected registry (must match backend MANAGEABLE_LISTS)
EXPECTED_LISTS = {
    "company_sizes":                  {"group": "Şirkət",       "defaults": ["Böyük", "Orta", "Kiçik", "Mikro"]},
    "company_statuses":               {"group": "Şirkət",       "defaults": ["Aktiv", "Qeyri-aktiv", "Gözləmədə"]},
    "contract_statuses":              {"group": "Şirkət",       "defaults": ["Aktiv", "Yeni", "Yeniləmə gözlənir", "Bitdi", "Ləğv edilib"]},
    "departments":                    {"group": "HR",           "defaults": ["Satış", "Marketing", "HR", "Maliyyə", "Layihə", "İT", "İdarəetmə"]},
    "education_levels":               {"group": "HR",           "defaults": ["Orta təhsil", "Sub bakalavr", "Bakalavr", "Magistratura", "Doktorantura"]},
    "citizenships":                   {"group": "HR",           "defaults": ["Azərbaycan", "Türkiyə", "Rusiya", "Gürcüstan", "Ukrayna", "Digər"]},
    "employee_statuses":              {"group": "HR",           "defaults": ["Aktiv", "Məzuniyyətdə", "Xəstələnib", "İşdən çıxıb"]},
    "marital_statuses":               {"group": "HR",           "defaults": ["Subay", "Evli", "Boşanmış", "Dul"]},
    "task_statuses":                  {"group": "Tapşırıqlar",  "defaults": ["Gözləyir", "İcrada", "Tamamlandı", "Ləğv edildi"]},
    "priorities":                     {"group": "Tapşırıqlar",  "defaults": ["Yüksək", "Orta", "Aşağı"]},
    "lead_statuses":                  {"group": "Satış",        "defaults": ["Yeni", "Əlaqə quruldu", "Görüş təyin edildi", "Təklif göndərildi", "Danışıqda", "Üzv oldu", "Satıldı", "İmtina"]},
    "reference_sources":              {"group": "Satış",        "defaults": ["Şirkət", "Şəxs", "Media", "Digər"]},
    "payment_methods":                {"group": "Maliyyə",      "defaults": ["Nağd", "Köçürmə", "Kart", "Hissə-hissə"]},
    "expense_types":                  {"group": "Maliyyə",      "defaults": ["Əməliyyat", "Marketinq", "Layihə", "Texniki", "Satış", "Digər"]},
    "event_types":                    {"group": "Tədbirlər",    "defaults": ["Konfrans", "Seminar", "Təlim", "Sərgi", "Networking", "İclas"]},
    "invitation_response_statuses":   {"group": "Tədbirlər",    "defaults": ["Gözləmədə", "Qatıldı", "Rədd etdi", "Cavab vermədi"]},
}


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Auth failed: {r.status_code} {r.text}")
    token = r.json().get("access_token") or r.json().get("token")
    if not token:
        pytest.skip("No token in login response")
    return token


@pytest.fixture(scope="module")
def auth_client(api_client, auth_token):
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


@pytest.fixture(scope="module", autouse=True)
def cleanup_after_module(auth_client):
    """Reset all manageable lists to defaults after all tests complete."""
    yield
    for key, meta in EXPECTED_LISTS.items():
        try:
            auth_client.put(f"{BASE_URL}/api/settings/lists/{key}",
                            json={"values": meta["defaults"]})
        except Exception:
            pass


# ---------- Tests: manageable-lists registry ----------

class TestManageableListsRegistry:

    def test_returns_16_items(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/settings/manageable-lists")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 16, f"expected 16 items, got {len(data)}"

    def test_each_item_has_required_fields(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/settings/manageable-lists")
        assert r.status_code == 200
        for item in r.json():
            for f in ("key", "label", "group", "defaults", "values"):
                assert f in item, f"missing {f} in item {item}"
            assert isinstance(item["defaults"], list)
            assert isinstance(item["values"], list)

    def test_all_expected_keys_present(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/settings/manageable-lists")
        keys = {i["key"] for i in r.json()}
        assert keys == set(EXPECTED_LISTS.keys()), f"keys diff: {keys ^ set(EXPECTED_LISTS.keys())}"

    def test_group_distribution(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/settings/manageable-lists")
        groups = {}
        for i in r.json():
            groups[i["group"]] = groups.get(i["group"], 0) + 1
        expected = {"Şirkət": 3, "HR": 5, "Tapşırıqlar": 2, "Satış": 2, "Maliyyə": 2, "Tədbirlər": 2}
        assert groups == expected, f"group counts mismatch: {groups}"

    def test_defaults_and_groups_match(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/settings/manageable-lists")
        by_key = {i["key"]: i for i in r.json()}
        for key, meta in EXPECTED_LISTS.items():
            assert by_key[key]["group"] == meta["group"], key
            assert by_key[key]["defaults"] == meta["defaults"], key

    def test_values_equal_defaults_when_no_override(self, auth_client):
        """Reset every key to clean state, then assert values == defaults."""
        for key, meta in EXPECTED_LISTS.items():
            auth_client.put(f"{BASE_URL}/api/settings/lists/{key}",
                            json={"values": meta["defaults"]})
        r = auth_client.get(f"{BASE_URL}/api/settings/manageable-lists")
        for item in r.json():
            assert item["values"] == item["defaults"], f"{item['key']}: values != defaults"

    def test_requires_authentication(self, api_client):
        plain = requests.Session()
        r = plain.get(f"{BASE_URL}/api/settings/manageable-lists")
        assert r.status_code in (401, 403), f"expected auth error, got {r.status_code}"


# ---------- Tests: PUT persistence ----------

class TestListPutPersistence:

    def test_put_company_sizes_persists_and_others_unchanged(self, auth_client):
        new_values = ["Mega", "Böyük", "Orta", "Kiçik"]
        r = auth_client.put(f"{BASE_URL}/api/settings/lists/company_sizes",
                            json={"values": new_values})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("key") == "company_sizes"
        assert body.get("values") == new_values

        r2 = auth_client.get(f"{BASE_URL}/api/settings/manageable-lists")
        by_key = {i["key"]: i for i in r2.json()}
        assert by_key["company_sizes"]["values"] == new_values
        # another key must still equal defaults
        assert by_key["departments"]["values"] == EXPECTED_LISTS["departments"]["defaults"]
        assert by_key["priorities"]["values"] == EXPECTED_LISTS["priorities"]["defaults"]

    def test_options_all_reflects_updated_company_sizes(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/options/all")
        assert r.status_code == 200
        data = r.json()
        assert data["company_sizes"] == ["Mega", "Böyük", "Orta", "Kiçik"]

    def test_reset_to_defaults_restores(self, auth_client):
        defaults = EXPECTED_LISTS["company_sizes"]["defaults"]
        r = auth_client.put(f"{BASE_URL}/api/settings/lists/company_sizes",
                            json={"values": defaults})
        assert r.status_code == 200
        assert r.json().get("values") == defaults

        r2 = auth_client.get(f"{BASE_URL}/api/options/all")
        assert r2.json()["company_sizes"] == defaults


# ---------- Tests: /options/all dynamic keys ----------

class TestOptionsAllKeys:

    REQUIRED_KEYS = [
        # newly dynamic keys
        "company_statuses", "contract_statuses", "citizenships",
        "employee_statuses", "marital_statuses", "payment_methods",
        "expense_types", "invitation_response_statuses",
        # previously static but now dynamic
        "task_statuses", "priorities", "departments",
        "education_levels", "event_types", "lead_statuses",
        # backward-compat keys
        "meeting_types", "lead_sources", "sale_types",
        # misc existing keys
        "company_sizes", "reference_sources", "sectors", "regions",
        "marsol_companies", "marsol_representatives", "statuses",
    ]

    def test_all_required_keys_present(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/options/all")
        assert r.status_code == 200
        data = r.json()
        missing = [k for k in self.REQUIRED_KEYS if k not in data]
        assert not missing, f"missing keys in /options/all: {missing}"

    def test_defaults_returned_when_no_override(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/options/all")
        data = r.json()
        # After module-level reset fixtures, these should equal registry defaults
        for key in ["task_statuses", "priorities", "company_statuses",
                    "contract_statuses", "citizenships", "employee_statuses",
                    "marital_statuses", "payment_methods",
                    "invitation_response_statuses", "education_levels"]:
            assert data[key] == EXPECTED_LISTS[key]["defaults"], f"{key}: {data[key]}"

    def test_dynamic_override_reflects_in_options(self, auth_client):
        """Override priorities, confirm /options/all reflects; then reset."""
        new_vals = ["Kritik", "Yüksək", "Orta", "Aşağı"]
        r = auth_client.put(f"{BASE_URL}/api/settings/lists/priorities",
                            json={"values": new_vals})
        assert r.status_code == 200

        r2 = auth_client.get(f"{BASE_URL}/api/options/all")
        assert r2.json()["priorities"] == new_vals

        # reset
        auth_client.put(f"{BASE_URL}/api/settings/lists/priorities",
                        json={"values": EXPECTED_LISTS["priorities"]["defaults"]})
        r3 = auth_client.get(f"{BASE_URL}/api/options/all")
        assert r3.json()["priorities"] == EXPECTED_LISTS["priorities"]["defaults"]


# ---------- Tests: Backward compatibility ----------

class TestBackwardCompatibility:

    def test_meeting_types_override_works(self, auth_client):
        new_vals = ["Test meeting A", "Test meeting B"]
        r = auth_client.put(f"{BASE_URL}/api/settings/lists/meeting_types",
                            json={"values": new_vals})
        assert r.status_code == 200
        r2 = auth_client.get(f"{BASE_URL}/api/options/all")
        assert r2.json()["meeting_types"] == new_vals
        # cleanup
        auth_client.put(f"{BASE_URL}/api/settings/lists/meeting_types",
                        json={"values": ["Satış görüşü", "Daxili iclas", "Müştəri görüşü",
                                         "Partnyor görüşü", "Təqdimat"]})

    def test_lead_sources_override_works(self, auth_client):
        new_vals = ["Kanal A", "Kanal B"]
        auth_client.put(f"{BASE_URL}/api/settings/lists/lead_sources",
                        json={"values": new_vals})
        r = auth_client.get(f"{BASE_URL}/api/options/all")
        assert r.json()["lead_sources"] == new_vals
        # cleanup
        auth_client.put(f"{BASE_URL}/api/settings/lists/lead_sources",
                        json={"values": ["Marketing", "Referans", "Sosial media",
                                         "Veb sayt", "Sərgi", "Soyuq zəng", "Digər"]})

    def test_sale_types_override_works(self, auth_client):
        new_vals = ["Test sale type"]
        auth_client.put(f"{BASE_URL}/api/settings/lists/sale_types",
                        json={"values": new_vals})
        r = auth_client.get(f"{BASE_URL}/api/options/all")
        assert r.json()["sale_types"] == new_vals
        # cleanup
        auth_client.put(f"{BASE_URL}/api/settings/lists/sale_types",
                        json={"values": ["Üzvlük", "Sərgi stendi", "Tur (Daxili)",
                                         "Tur (Xarici)", "Təlim", "Digər"]})

    def test_membership_warning_days_legacy_still_works(self, auth_client):
        # legacy: setting it via /settings/lists/membership_warning_days mirrors into
        # notification config (one-way) OR notif-config PUT mirrors back. Validate notif GET.
        r = auth_client.get(f"{BASE_URL}/api/settings/notification-config")
        assert r.status_code == 200
        cfg = r.json()
        assert "membership_warning_days" in cfg
        assert isinstance(cfg["membership_warning_days"], int)

        # Override via legacy endpoint and confirm reflected in notification-config
        auth_client.put(f"{BASE_URL}/api/settings/lists/membership_warning_days",
                        json={"values": [15]})
        r2 = auth_client.get(f"{BASE_URL}/api/settings/notification-config")
        assert r2.json()["membership_warning_days"] == 15
        # reset to original
        auth_client.put(f"{BASE_URL}/api/settings/lists/membership_warning_days",
                        json={"values": [cfg["membership_warning_days"]]})
