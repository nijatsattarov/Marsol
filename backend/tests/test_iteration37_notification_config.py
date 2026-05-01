"""
Iteration 37 backend tests — Global Notification Days Settings:
- GET /api/settings/notification-config returns 6 keys with integer defaults
- PUT /api/settings/notification-config persists + requires settings.write
- PUT mirrors membership_warning_days into legacy /api/settings/lists/membership_warning_days
- GET /api/notifications still works, uses cfg (birthday_advance_days expands window)
- Birthday notifications include company_name field + 'Role (Company) — date' message
- Legacy GET/PUT /api/settings/lists/membership_warning_days still works
"""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_path = "/app/frontend/.env"
        if os.path.exists(env_path):
            for line in open(env_path):
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip("/")


BASE_URL = _load_backend_url()
ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"

EXPECTED_KEYS = {
    "membership_warning_days",
    "contract_expiry_days",
    "birthday_advance_days",
    "debt_overdue_high_days",
    "meeting_reminder_high_days",
    "meeting_reminder_medium_days",
}


# ------------------------- Fixtures -------------------------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No access_token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth(session, token):
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module", autouse=True)
def snapshot_and_restore(auth):
    """Snapshot original notification-config and restore after module."""
    orig = None
    try:
        r = auth.get(f"{BASE_URL}/api/settings/notification-config")
        if r.status_code == 200:
            orig = r.json()
    except Exception:
        pass
    yield
    if isinstance(orig, dict):
        try:
            auth.put(f"{BASE_URL}/api/settings/notification-config", json=orig)
        except Exception:
            pass


# ------------------------- /settings/notification-config -------------------------

class TestNotificationConfig:

    def test_get_returns_all_keys_with_int_defaults(self, auth):
        r = auth.get(f"{BASE_URL}/api/settings/notification-config")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        missing = EXPECTED_KEYS - set(data.keys())
        assert not missing, f"Missing keys: {missing}. Got: {list(data.keys())}"
        for k in EXPECTED_KEYS:
            assert isinstance(data[k], int), f"{k} is not int: {data[k]!r}"
            assert data[k] >= 0, f"{k} should be non-negative default: {data[k]}"

    def test_put_persists_and_get_reflects_values(self, auth):
        new_values = {
            "membership_warning_days": 12,
            "contract_expiry_days": 45,
            "birthday_advance_days": 7,
            "debt_overdue_high_days": 21,
            "meeting_reminder_high_days": 2,
            "meeting_reminder_medium_days": 5,
        }
        r = auth.put(f"{BASE_URL}/api/settings/notification-config", json=new_values)
        assert r.status_code == 200, r.text
        put_data = r.json()
        for k, v in new_values.items():
            assert put_data.get(k) == v, f"PUT response {k}={put_data.get(k)} != {v}"

        # GET to verify persistence
        g = auth.get(f"{BASE_URL}/api/settings/notification-config")
        assert g.status_code == 200
        g_data = g.json()
        for k, v in new_values.items():
            assert g_data.get(k) == v, f"GET after PUT {k}={g_data.get(k)} != {v}"

    def test_put_mirrors_membership_warning_days_into_legacy(self, auth):
        # Change membership_warning_days to a unique value
        payload = {"membership_warning_days": 17}
        r = auth.put(f"{BASE_URL}/api/settings/notification-config", json=payload)
        assert r.status_code == 200, r.text

        # legacy GET should reflect the mirrored value
        legacy = auth.get(f"{BASE_URL}/api/settings/lists/membership_warning_days")
        assert legacy.status_code == 200, legacy.text
        values = legacy.json()
        assert isinstance(values, list) and len(values) >= 1, f"Unexpected legacy shape: {values}"
        assert int(values[0]) == 17, f"Legacy list did not mirror new value: {values}"

    def test_put_non_integer_values_fall_back_to_defaults(self, auth):
        # Send garbage for one field — backend should coerce to default, not 500
        r = auth.put(
            f"{BASE_URL}/api/settings/notification-config",
            json={"birthday_advance_days": "abc"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("birthday_advance_days"), int)

    def test_put_requires_auth(self, session):
        # Use a bare session without Authorization header
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.put(
            f"{BASE_URL}/api/settings/notification-config",
            json={"membership_warning_days": 10},
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text}"

    def test_get_requires_auth(self):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/settings/notification-config")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ------------------------- Legacy backward-compat -------------------------

class TestLegacySettingsListMembershipWarning:

    def test_legacy_get_still_works(self, auth):
        r = auth.get(f"{BASE_URL}/api/settings/lists/membership_warning_days")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_legacy_put_still_works_and_get_reflects(self, auth):
        r = auth.put(
            f"{BASE_URL}/api/settings/lists/membership_warning_days",
            json={"values": [25]},
        )
        assert r.status_code == 200, r.text
        g = auth.get(f"{BASE_URL}/api/settings/lists/membership_warning_days")
        assert g.status_code == 200
        values = g.json()
        assert isinstance(values, list) and len(values) >= 1
        assert int(values[0]) == 25

    def test_legacy_put_propagates_to_notification_config_get(self, auth):
        # Legacy PUT should override membership_warning_days on GET /notification-config
        auth.put(
            f"{BASE_URL}/api/settings/lists/membership_warning_days",
            json={"values": [33]},
        )
        r = auth.get(f"{BASE_URL}/api/settings/notification-config")
        assert r.status_code == 200
        assert r.json().get("membership_warning_days") == 33


# ------------------------- /notifications uses cfg -------------------------

class TestNotificationsEndpoint:

    def test_notifications_endpoint_works(self, auth):
        # Reset to sensible values first
        auth.put(
            f"{BASE_URL}/api/settings/notification-config",
            json={
                "membership_warning_days": 10,
                "contract_expiry_days": 30,
                "birthday_advance_days": 1,
                "debt_overdue_high_days": 30,
                "meeting_reminder_high_days": 1,
                "meeting_reminder_medium_days": 3,
            },
        )
        r = auth.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "notifications" in data and isinstance(data["notifications"], list)
        assert "count" in data and isinstance(data["count"], int)
        assert data["count"] == len(data["notifications"])

    def test_birthday_notifications_include_company_name_field(self, auth):
        # Seed a company with an owner whose birthday is within a wide window
        # Use 3 days ahead
        target = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%m-%d")
        bdate = f"1985-{target}"
        payload = {
            "brand_name": "TEST_BDAY_COMPANY_IT37",
            "legal_name": "TEST BDAY LLC",
            "owner_name": "TEST Owner Birthday",
            "owner_birth_date": bdate,
            "contract_end_date": "",
        }
        cr = auth.post(f"{BASE_URL}/api/companies", json=payload)
        assert cr.status_code in (200, 201), cr.text
        cid = cr.json().get("id")
        try:
            # Set advance days large enough (7)
            auth.put(
                f"{BASE_URL}/api/settings/notification-config",
                json={"birthday_advance_days": 7},
            )
            # Verify cfg took effect
            cfg = auth.get(f"{BASE_URL}/api/settings/notification-config").json()
            assert cfg["birthday_advance_days"] == 7

            r = auth.get(f"{BASE_URL}/api/notifications")
            assert r.status_code == 200, r.text
            data = r.json()
            bdays = [n for n in data["notifications"] if n.get("type") == "birthday"]

            # Find our seeded bday notif
            ours = [n for n in bdays if "TEST Owner Birthday" in (n.get("title") or "")]
            assert ours, (
                f"Seeded birthday (3 days ahead) not picked up by /notifications with "
                f"birthday_advance_days=7. Got {len(bdays)} bday notifs."
            )
            n = ours[0]
            # company_name field present
            assert "company_name" in n, f"Missing company_name field: {n}"
            assert n["company_name"] == "TEST_BDAY_COMPANY_IT37", (
                f"company_name mismatch: {n['company_name']!r}"
            )
            # message has 'Role (Company) — date'
            msg = n.get("message", "")
            assert "(TEST_BDAY_COMPANY_IT37)" in msg, f"Company not in msg: {msg!r}"
            assert "—" in msg and bdate in msg, f"Unexpected message format: {msg!r}"
        finally:
            if cid:
                auth.delete(f"{BASE_URL}/api/companies/{cid}")

    def test_birthday_advance_days_window_respected(self, auth):
        # Seed birthday 5 days ahead; with advance=1 should NOT appear, with advance=7 SHOULD
        target = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%m-%d")
        bdate = f"1990-{target}"
        payload = {
            "brand_name": "TEST_BDAY_WINDOW_IT37",
            "legal_name": "TEST BDAY WIN LLC",
            "owner_name": "TEST Owner Window",
            "owner_birth_date": bdate,
            "contract_end_date": "",
        }
        cr = auth.post(f"{BASE_URL}/api/companies", json=payload)
        assert cr.status_code in (200, 201), cr.text
        cid = cr.json().get("id")
        try:
            # advance=1 -> should not appear
            auth.put(
                f"{BASE_URL}/api/settings/notification-config",
                json={"birthday_advance_days": 1},
            )
            r1 = auth.get(f"{BASE_URL}/api/notifications").json()
            found1 = any("TEST Owner Window" in (n.get("title") or "")
                         for n in r1["notifications"] if n.get("type") == "birthday")
            assert not found1, "Birthday 5 days ahead should NOT appear with advance=1"

            # advance=7 -> should appear
            auth.put(
                f"{BASE_URL}/api/settings/notification-config",
                json={"birthday_advance_days": 7},
            )
            r2 = auth.get(f"{BASE_URL}/api/notifications").json()
            found2 = any("TEST Owner Window" in (n.get("title") or "")
                         for n in r2["notifications"] if n.get("type") == "birthday")
            assert found2, "Birthday 5 days ahead SHOULD appear with advance=7"
        finally:
            if cid:
                auth.delete(f"{BASE_URL}/api/companies/{cid}")
