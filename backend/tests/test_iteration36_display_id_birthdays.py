"""
Iteration 36 backend tests:
- Companies display_id (auto-generation, backfill idempotent, import-excel)
- Birthday notifications (owners, contacts, employees, contact lists)
- dispatch-emails resilience for new birthday notif type
"""
import os
import re
import io
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


# ------------------------- display_id -------------------------

class TestCompanyDisplayId:

    def test_list_companies_have_display_id(self, auth):
        r = auth.get(f"{BASE_URL}/api/companies")
        assert r.status_code == 200, r.text
        data = r.json()
        # API may wrap in {"companies": [...]} or return list directly
        companies = data if isinstance(data, list) else data.get("companies", [])
        assert len(companies) > 0, "No companies returned"
        missing = [c for c in companies if not c.get("display_id")]
        assert not missing, f"{len(missing)} companies missing display_id (e.g. {missing[0].get('id')})"
        # Pattern check
        pattern = re.compile(r"^C\d{4,}$")
        bad = [c for c in companies if not pattern.match(c["display_id"])]
        assert not bad, f"Bad display_id format: {[c['display_id'] for c in bad[:3]]}"

    def test_backfill_idempotent(self, auth):
        r = auth.post(f"{BASE_URL}/api/companies/backfill-ids")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "assigned" in body and "total" in body
        # On a second run the assigned count should be 0 (idempotent)
        r2 = auth.post(f"{BASE_URL}/api/companies/backfill-ids")
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2["assigned"] == 0, f"Expected 0 assigned on re-run, got {body2['assigned']}"
        assert body2["total"] >= body["total"]

    def test_create_company_assigns_next_display_id(self, auth):
        # Snapshot existing max C-number
        r = auth.get(f"{BASE_URL}/api/companies")
        companies = r.json() if isinstance(r.json(), list) else r.json().get("companies", [])
        max_n = 0
        for c in companies:
            did = c.get("display_id", "") or ""
            m = re.match(r"^C(\d+)$", did)
            if m:
                max_n = max(max_n, int(m.group(1)))

        payload = {
            "brand_name": "TEST_iter36_displayid",
            "legal_name": "TEST_iter36_displayid_LLC",
            "sector": "Test",
            "owner_name": "TEST owner",
            "package": "Standart",
        }
        r = auth.post(f"{BASE_URL}/api/companies", json=payload)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        new_id = created.get("id") or created.get("_id")
        new_display = created.get("display_id")
        assert new_display, f"No display_id in create response: {created}"
        m = re.match(r"^C(\d+)$", new_display)
        assert m, f"Bad format: {new_display}"
        assert int(m.group(1)) == max_n + 1, (
            f"Expected C{max_n+1:04d}, got {new_display}"
        )

        # Verify by GET
        r2 = auth.get(f"{BASE_URL}/api/companies/{new_id}")
        assert r2.status_code == 200
        assert r2.json().get("display_id") == new_display

        # Cleanup
        auth.delete(f"{BASE_URL}/api/companies/{new_id}")

    def test_import_excel_assigns_display_id(self, auth):
        # Build a tiny xlsx in-memory with headers expected by endpoint
        try:
            from openpyxl import Workbook
        except ImportError:
            pytest.skip("openpyxl not installed")
        wb = Workbook()
        ws = wb.active
        # Probe headers — endpoint typically expects: brand_name, package, total/paid maybe
        ws.append(["Şirkət adı", "Paket", "Ödənilib"])
        unique_brand = f"TEST_iter36_import_{datetime.now().timestamp():.0f}"
        ws.append([unique_brand, "Standart", 0])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        # Use multipart (drop content-type header just for this request)
        headers = {k: v for k, v in auth.headers.items() if k.lower() != "content-type"}
        r = requests.post(
            f"{BASE_URL}/api/companies/import-excel",
            headers=headers,
            files={"file": ("test.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        if r.status_code == 404:
            pytest.skip("Import endpoint not available")
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"

        # Find the imported row
        r2 = auth.get(f"{BASE_URL}/api/companies")
        companies = r2.json() if isinstance(r2.json(), list) else r2.json().get("companies", [])
        match = [c for c in companies if c.get("brand_name") == unique_brand]
        assert match, f"Imported company '{unique_brand}' not found"
        imported = match[0]
        assert imported.get("display_id"), f"Imported row missing display_id: {imported}"
        assert re.match(r"^C\d+$", imported["display_id"])

        # Cleanup
        auth.delete(f"{BASE_URL}/api/companies/{imported['id']}")


# ------------------------- Birthday notifications -------------------------

class TestBirthdayNotifications:

    @pytest.fixture
    def picked_company(self, auth):
        """Pick an existing company; save original owner_birth_date for restore."""
        r = auth.get(f"{BASE_URL}/api/companies")
        companies = r.json() if isinstance(r.json(), list) else r.json().get("companies", [])
        assert companies, "No companies to test against"
        # Pick first with a numeric id
        target = companies[0]
        cid = target["id"]
        original = target.get("owner_birth_date", "")
        original_name = target.get("owner_name", "")
        yield {"id": cid, "original": original, "name": original_name}
        # Teardown: restore
        auth.put(
            f"{BASE_URL}/api/companies/{cid}",
            json={"owner_birth_date": original, "owner_name": original_name or "TEST owner"},
        )

    def test_birthday_notif_today_high(self, auth, picked_company):
        cid = picked_company["id"]
        today = datetime.now(timezone.utc).strftime("%m-%d")
        bdate = f"1985-{today}"
        r = auth.put(
            f"{BASE_URL}/api/companies/{cid}",
            json={"owner_birth_date": bdate, "owner_name": "TEST_BDAY_TODAY"},
        )
        assert r.status_code == 200, r.text

        rn = auth.get(f"{BASE_URL}/api/notifications")
        assert rn.status_code == 200, rn.text
        body = rn.json()
        notifs = body.get("notifications", [])
        bday = [n for n in notifs if n.get("type") == "birthday" and "TEST_BDAY_TODAY" in (n.get("title") or "")]
        assert bday, f"No birthday notif for today found. notifs={[(n.get('type'), n.get('title')) for n in notifs[:5]]}"
        assert bday[0]["severity"] == "high"
        assert "Bu gün" in bday[0]["title"]

    def test_birthday_notif_tomorrow_medium(self, auth, picked_company):
        cid = picked_company["id"]
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%m-%d")
        bdate = f"1990-{tomorrow}"
        r = auth.put(
            f"{BASE_URL}/api/companies/{cid}",
            json={"owner_birth_date": bdate, "owner_name": "TEST_BDAY_TMRW"},
        )
        assert r.status_code == 200, r.text

        rn = auth.get(f"{BASE_URL}/api/notifications")
        assert rn.status_code == 200
        notifs = rn.json().get("notifications", [])
        bday = [n for n in notifs if n.get("type") == "birthday" and "TEST_BDAY_TMRW" in (n.get("title") or "")]
        assert bday, "No birthday notif for tomorrow"
        assert bday[0]["severity"] == "medium"
        assert "Sabah" in bday[0]["title"]

    def test_birthday_notif_other_date_absent(self, auth, picked_company):
        cid = picked_company["id"]
        # Far date (not today/tomorrow): pick today + 5 days
        far = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%m-%d")
        bdate = f"1992-{far}"
        r = auth.put(
            f"{BASE_URL}/api/companies/{cid}",
            json={"owner_birth_date": bdate, "owner_name": "TEST_BDAY_FAR"},
        )
        assert r.status_code == 200

        rn = auth.get(f"{BASE_URL}/api/notifications")
        notifs = rn.json().get("notifications", [])
        bday = [n for n in notifs if "TEST_BDAY_FAR" in (n.get("title") or "")]
        assert not bday, f"Should not appear: {bday}"

    def test_dispatch_emails_does_not_crash_with_birthday(self, auth, picked_company):
        cid = picked_company["id"]
        today = datetime.now(timezone.utc).strftime("%m-%d")
        auth.put(
            f"{BASE_URL}/api/companies/{cid}",
            json={"owner_birth_date": f"1985-{today}", "owner_name": "TEST_DISPATCH"},
        )
        r = auth.post(f"{BASE_URL}/api/notifications/dispatch-emails")
        # Should not crash — either 200 with summary or some success-ish code
        assert r.status_code in (200, 202), f"{r.status_code}: {r.text}"
