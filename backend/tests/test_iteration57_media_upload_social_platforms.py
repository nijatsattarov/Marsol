"""
Iteration 57 tests — Media upload + Social platforms CRUD + Venue array persistence.

Covers:
1. /api/settings/social-platforms — seed 9 defaults, POST, PUT, DELETE, duplicate-400.
2. /api/organization/venues — POST with photos as ARRAY of URLs + social_links as ARRAY of {platform,url}
   persists & GET returns arrays as-is. Backward compat with legacy multiline string.
3. /api/upload — uploads a small PNG to Cloudinary and returns url.
"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-hub-563.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "settings@marsol.az"
ADMIN_PASSWORD = "marsol123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, f"No access_token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ============== SOCIAL PLATFORMS CRUD ==============

class TestSocialPlatforms:
    DEFAULT_NAMES = {"Facebook", "Instagram", "LinkedIn", "Twitter / X", "TikTok", "YouTube", "WhatsApp", "Telegram", "Website"}

    def test_list_seeds_defaults(self, auth_headers):
        r = requests.get(f"{API}/settings/social-platforms", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        names = {i["name"] for i in items}
        # All 9 defaults must be present (other custom test items may also exist)
        missing = self.DEFAULT_NAMES - names
        assert not missing, f"Missing default platforms: {missing}"
        # Each item must have id + name + icon (no _id)
        for it in items:
            assert "id" in it and "name" in it and "icon" in it
            assert "_id" not in it

    def test_post_create_and_duplicate_400(self, auth_headers):
        name = "TEST_SP_Mastodon"
        # Cleanup if exists from prior run
        items = requests.get(f"{API}/settings/social-platforms", headers=auth_headers, timeout=15).json()
        for it in items:
            if it["name"] == name:
                requests.delete(f"{API}/settings/social-platforms/{it['id']}", headers=auth_headers, timeout=15)

        created_id = None
        try:
            r = requests.post(
                f"{API}/settings/social-platforms",
                headers=auth_headers,
                json={"name": name, "icon": "at-sign"},
                timeout=15,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["name"] == name
            assert data["icon"] == "at-sign"
            assert "id" in data
            created_id = data["id"]

            # Duplicate → 400
            r2 = requests.post(
                f"{API}/settings/social-platforms",
                headers=auth_headers,
                json={"name": name, "icon": "at-sign"},
                timeout=15,
            )
            assert r2.status_code == 400, f"Expected 400 for duplicate, got {r2.status_code}: {r2.text}"

            # GET — verify persistence
            items = requests.get(f"{API}/settings/social-platforms", headers=auth_headers, timeout=15).json()
            assert any(i["id"] == created_id and i["name"] == name for i in items)
        finally:
            if created_id:
                requests.delete(f"{API}/settings/social-platforms/{created_id}", headers=auth_headers, timeout=15)

    def test_put_update(self, auth_headers):
        name = "TEST_SP_Threads"
        # Create
        r = requests.post(f"{API}/settings/social-platforms", headers=auth_headers, json={"name": name, "icon": "hash"}, timeout=15)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        try:
            r2 = requests.put(
                f"{API}/settings/social-platforms/{pid}",
                headers=auth_headers,
                json={"name": "TEST_SP_Threads2", "icon": "at-sign"},
                timeout=15,
            )
            assert r2.status_code == 200, r2.text
            updated = r2.json()
            assert updated["name"] == "TEST_SP_Threads2"
            assert updated["icon"] == "at-sign"
        finally:
            requests.delete(f"{API}/settings/social-platforms/{pid}", headers=auth_headers, timeout=15)

    def test_delete(self, auth_headers):
        r = requests.post(f"{API}/settings/social-platforms", headers=auth_headers, json={"name": "TEST_SP_Bluesky", "icon": "cloud"}, timeout=15)
        assert r.status_code == 200
        pid = r.json()["id"]
        rd = requests.delete(f"{API}/settings/social-platforms/{pid}", headers=auth_headers, timeout=15)
        assert rd.status_code == 200
        # 404 on second delete
        rd2 = requests.delete(f"{API}/settings/social-platforms/{pid}", headers=auth_headers, timeout=15)
        assert rd2.status_code == 404

    def test_post_empty_name_400(self, auth_headers):
        r = requests.post(f"{API}/settings/social-platforms", headers=auth_headers, json={"name": "  ", "icon": "x"}, timeout=15)
        assert r.status_code == 400


# ============== VENUE — array persistence (photos + social_links) ==============

class TestVenueMediaArrays:
    def _create_venue(self, headers, payload):
        r = requests.post(f"{API}/organization/venues", headers=headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def _delete_venue(self, headers, vid):
        requests.delete(f"{API}/organization/venues/{vid}", headers=headers, timeout=15)

    def test_venue_photos_array_persists(self, auth_headers):
        photos = [
            "https://res.cloudinary.com/demo/image/upload/v1/sample1.jpg",
            "https://res.cloudinary.com/demo/image/upload/v1/sample2.jpg",
        ]
        social_links = [
            {"platform": "Instagram", "url": "https://instagram.com/test_venue"},
            {"platform": "Facebook", "url": "https://fb.com/test_venue"},
        ]
        payload = {
            "name": "TEST_Venue_Array1",
            "photos": photos,
            "social_links": social_links,
            "video_link": "https://youtube.com/watch?v=abc",
        }
        created = self._create_venue(auth_headers, payload)
        vid = created["id"]
        try:
            # Verify create response
            assert created["photos"] == photos
            assert created["social_links"] == social_links
            assert created["video_link"] == "https://youtube.com/watch?v=abc"
            # GET — persistence
            r = requests.get(f"{API}/organization/venues", headers=auth_headers, timeout=15)
            assert r.status_code == 200
            items = r.json()
            found = next((i for i in items if i["id"] == vid), None)
            assert found is not None, "Venue not found after create"
            assert isinstance(found["photos"], list)
            assert found["photos"] == photos
            assert isinstance(found["social_links"], list)
            assert found["social_links"] == social_links
            assert "_id" not in found
        finally:
            self._delete_venue(auth_headers, vid)

    def test_venue_legacy_multiline_string_still_loads(self, auth_headers):
        # Insert venue with photos as legacy multiline string (backward compat)
        legacy_photos = "https://example.com/1.jpg\nhttps://example.com/2.jpg"
        payload = {
            "name": "TEST_Venue_Legacy1",
            "photos": legacy_photos,
            "social_links": "https://twitter.com/legacy",
        }
        created = self._create_venue(auth_headers, payload)
        vid = created["id"]
        try:
            r = requests.get(f"{API}/organization/venues", headers=auth_headers, timeout=15)
            assert r.status_code == 200
            items = r.json()
            found = next((i for i in items if i["id"] == vid), None)
            assert found is not None
            # Backend just returns whatever was stored — string OR list. Frontend handles normalization.
            assert found["photos"] == legacy_photos
        finally:
            self._delete_venue(auth_headers, vid)

    def test_venue_update_photos_array(self, auth_headers):
        created = self._create_venue(auth_headers, {"name": "TEST_Venue_Update1", "photos": ["https://a.com/1.jpg"]})
        vid = created["id"]
        try:
            new_photos = ["https://a.com/2.jpg", "https://a.com/3.jpg", "https://a.com/4.jpg"]
            r = requests.put(
                f"{API}/organization/venues/{vid}",
                headers=auth_headers,
                json={"photos": new_photos, "social_links": [{"platform": "YouTube", "url": "https://youtube.com/@v"}]},
                timeout=15,
            )
            assert r.status_code == 200, r.text
            doc = r.json()
            assert doc["photos"] == new_photos
            assert doc["social_links"] == [{"platform": "YouTube", "url": "https://youtube.com/@v"}]
        finally:
            self._delete_venue(auth_headers, vid)


# ============== UPLOAD — Cloudinary ==============

class TestUploadEndpoint:
    def _tiny_png_bytes(self):
        # 1x1 transparent PNG
        return bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
            "0000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
        )

    def test_upload_returns_url(self, admin_token):
        png = self._tiny_png_bytes()
        files = {"file": ("test_pixel.png", io.BytesIO(png), "image/png")}
        r = requests.post(
            f"{API}/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            timeout=60,
        )
        assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text}"
        data = r.json()
        assert "url" in data and data["url"].startswith("http"), f"No url returned: {data}"
        # Spec says fields: url, filename, stored_name, public_id, resource_type
        assert "public_id" in data or "stored_name" in data
