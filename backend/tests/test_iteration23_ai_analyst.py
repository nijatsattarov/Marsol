"""
Iteration 23: AI Data Analyst (Reports module) backend tests.

Covers:
- /api/ai/examples
- /api/ai/analyze (happy paths + validation + security)
- /api/ai/save-to-list (happy path + validation + RBAC)
- Regression on key non-AI endpoints to ensure we didn't break anything.
"""
import os
import time
import pytest
import requests

def _get_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Fall back to frontend/.env to match what users see
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not configured")
    return url.rstrip("/")


BASE_URL = _get_backend_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
MUHASIB = {"email": "muhasib@marsol.az", "password": "marsol123"}


def _login(session: requests.Session, creds: dict) -> str:
    r = session.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    token = _login(s, ADMIN)
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def muhasib_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    token = _login(s, MUHASIB)
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def cleanup_tracker():
    """Track list_ids created during tests for cleanup."""
    created = {"list_ids": []}
    yield created
    # Teardown
    s = requests.Session()
    try:
        token = _login(s, ADMIN)
        s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        for lid in created["list_ids"]:
            try:
                s.delete(f"{API}/contact-lists/{lid}", timeout=20)
            except Exception:
                pass
    except Exception:
        pass


# ---------------- /api/ai/examples ----------------
class TestAIExamples:
    def test_examples_returns_list(self, admin_session):
        r = admin_session.get(f"{API}/ai/examples", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "examples" in data
        assert isinstance(data["examples"], list)
        assert len(data["examples"]) == 13, f"expected 13 examples, got {len(data['examples'])}"
        # All examples should be non-empty strings
        for ex in data["examples"]:
            assert isinstance(ex, str) and len(ex) > 0

    def test_examples_requires_auth(self):
        r = requests.get(f"{API}/ai/examples", timeout=20)
        assert r.status_code in (401, 403)


# ---------------- /api/ai/analyze validation ----------------
class TestAIAnalyzeValidation:
    def test_empty_prompt_returns_400(self, admin_session):
        r = admin_session.post(f"{API}/ai/analyze", json={"prompt": ""}, timeout=30)
        assert r.status_code == 400
        assert "Prompt" in r.json().get("detail", "")

    def test_whitespace_prompt_returns_400(self, admin_session):
        r = admin_session.post(f"{API}/ai/analyze", json={"prompt": "    "}, timeout=30)
        assert r.status_code == 400

    def test_too_long_prompt_returns_400(self, admin_session):
        long_prompt = "a" * 2100
        r = admin_session.post(f"{API}/ai/analyze", json={"prompt": long_prompt}, timeout=30)
        assert r.status_code == 400
        assert "uzun" in r.json().get("detail", "").lower()

    def test_requires_auth(self):
        r = requests.post(f"{API}/ai/analyze", json={"prompt": "test"}, timeout=20)
        assert r.status_code in (401, 403)


# ---------------- /api/ai/analyze happy paths ----------------
ANALYZE_PROMPTS = [
    "Hansı sektordan neçə şirkət var",
    "Aktiv üzv şirkətlər ad və telefon",
    "Paketlər üzrə üzv sayı",
    "Borcu olan şirkətlər",
]


class TestAIAnalyzeHappy:
    @pytest.mark.parametrize("prompt", ANALYZE_PROMPTS)
    def test_analyze_returns_structured_table(self, admin_session, prompt):
        r = admin_session.post(f"{API}/ai/analyze", json={"prompt": prompt}, timeout=130)
        assert r.status_code == 200, f"prompt='{prompt}' -> {r.status_code} {r.text[:500]}"
        data = r.json()
        # Shape
        for key in ("title", "headers", "rows", "row_count", "collection", "list_mapping"):
            assert key in data, f"missing key {key} for prompt '{prompt}'"
        assert isinstance(data["title"], str) and len(data["title"]) > 0
        assert isinstance(data["headers"], list)
        assert isinstance(data["rows"], list)
        assert isinstance(data["row_count"], int)
        assert data["row_count"] == len(data["rows"])
        assert isinstance(data["collection"], str) and len(data["collection"]) > 0
        assert isinstance(data["list_mapping"], dict)
        # rows should be arrays of length == headers length (if any rows)
        if data["rows"]:
            assert len(data["rows"][0]) == len(data["headers"])
        # Small delay to be polite to AI endpoint
        time.sleep(1)


# ---------------- /api/ai/save-to-list ----------------
class TestAISaveToList:
    def test_save_empty_title_400(self, admin_session):
        payload = {
            "title": "",
            "description": "",
            "headers": ["Ad", "Telefon"],
            "rows": [["Test", "+994"]],
            "mapping": {"name": "Ad", "phone": "Telefon"},
        }
        r = admin_session.post(f"{API}/ai/save-to-list", json=payload, timeout=30)
        assert r.status_code == 400

    def test_save_empty_rows_400(self, admin_session):
        payload = {
            "title": "TEST_empty_rows",
            "description": "",
            "headers": ["Ad"],
            "rows": [],
            "mapping": {"name": "Ad"},
        }
        r = admin_session.post(f"{API}/ai/save-to-list", json=payload, timeout=30)
        assert r.status_code == 400

    def test_save_happy_path_and_verify_contacts(self, admin_session, cleanup_tracker):
        payload = {
            "title": "TEST_AI_List_Iter23",
            "description": "Iteration 23 AI save-to-list test",
            "headers": ["Ad", "Şirkət", "Telefon", "Email"],
            "rows": [
                ["Ali Mammadov", "Marsol A", "+994501111111", "ali@example.com"],
                ["Leyla Huseynova", "Marsol B", "+994502222222", "leyla@example.com"],
            ],
            "mapping": {
                "name": "Ad",
                "company": "Şirkət",
                "phone": "Telefon",
                "email": "Email",
            },
        }
        r = admin_session.post(f"{API}/ai/save-to-list", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "list_id" in data
        assert "message" in data
        assert "2" in data["message"]
        lid = data["list_id"]
        cleanup_tracker["list_ids"].append(lid)

        # Verify contacts persisted
        r2 = admin_session.get(f"{API}/contact-lists/{lid}/contacts", timeout=30)
        assert r2.status_code == 200, r2.text
        contacts = r2.json()
        # contacts may be a list directly or under a key
        if isinstance(contacts, dict):
            contacts = contacts.get("contacts") or contacts.get("items") or []
        assert len(contacts) == 2, f"expected 2 contacts, got {len(contacts)}"
        emails = {c.get("email") for c in contacts}
        assert "ali@example.com" in emails
        assert "leyla@example.com" in emails
        # Name/surname split check
        names = {c.get("name") for c in contacts}
        assert "Ali" in names or "Leyla" in names

    def test_save_rbac_muhasib_forbidden(self, muhasib_session):
        payload = {
            "title": "TEST_muhasib_should_fail",
            "headers": ["Ad"],
            "rows": [["X"]],
            "mapping": {"name": "Ad"},
        }
        r = muhasib_session.post(f"{API}/ai/save-to-list", json=payload, timeout=30)
        assert r.status_code == 403, f"expected 403 for muhasib (no sales.write), got {r.status_code}: {r.text}"


# ---------------- Regression ----------------
class TestRegression:
    @pytest.mark.parametrize("path", [
        "/companies",
        "/contact-lists",
        "/attendance",
        "/barters",
        "/project-events",
        "/invitations",
    ])
    def test_key_endpoints_respond(self, admin_session, path):
        r = admin_session.get(f"{API}{path}", timeout=30)
        assert r.status_code in (200, 201), f"{path} -> {r.status_code}: {r.text[:200]}"
