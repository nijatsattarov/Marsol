"""Iteration 35 — Cloudinary uploads + Files module tests.

Covers:
- POST /api/uploads (folder validation, RBAC token presence, response shape)
- DELETE /api/uploads (idempotency, response)
- POST/GET/DELETE /api/files (RBAC, persistence)
- Legacy POST /api/upload + /api/public/upload now return Cloudinary URLs
- MAX_UPLOAD_BYTES is 25MB constant
"""
import io
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if BASE_URL:
    BASE_URL = BASE_URL.rstrip("/")
else:
    # fallback — frontend env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        BASE_URL = "http://localhost:8001"

API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def sales_token():
    r = requests.post(f"{API}/auth/login", json=SALES, timeout=15)
    assert r.status_code == 200, f"sales login failed: {r.status_code} {r.text}"
    return r.json().get("access_token")


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def sales_headers(sales_token):
    return {"Authorization": f"Bearer {sales_token}"}


def _fake_png_bytes() -> bytes:
    # Minimal 1x1 transparent PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f"
        b"\x00\x00\x01\x01\x01\x00\x1b\xb6\xee\x56\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _fake_txt_bytes() -> bytes:
    return b"Hello Marsol Cloudinary test " + str(time.time()).encode()


# ====================================================
# /api/uploads — Cloudinary asset upload
# ====================================================
class TestUploadsEndpoint:
    def test_upload_image_to_marsol_files(self, admin_headers):
        files = {"file": ("test_marsol.png", _fake_png_bytes(), "image/png")}
        data = {"folder": "marsol/files"}
        r = requests.post(f"{API}/uploads", files=files, data=data, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for key in ["url", "public_id", "resource_type", "format", "bytes", "original_filename", "mime_type"]:
            assert key in body, f"missing {key} in response"
        assert body["url"].startswith("https://res.cloudinary.com/ddyysroag/"), body["url"]
        assert body["resource_type"] == "image"
        assert body["bytes"] > 0
        # cleanup
        requests.delete(
            f"{API}/uploads",
            params={"public_id": body["public_id"], "resource_type": body["resource_type"]},
            headers=admin_headers, timeout=15,
        )

    def test_upload_raw_doc_resource_type(self, admin_headers):
        files = {"file": ("notes_test.txt", _fake_txt_bytes(), "text/plain")}
        data = {"folder": "marsol/files"}
        r = requests.post(f"{API}/uploads", files=files, data=data, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["resource_type"] == "raw"
        assert "ddyysroag" in body["url"]
        # cleanup
        requests.delete(
            f"{API}/uploads",
            params={"public_id": body["public_id"], "resource_type": "raw"},
            headers=admin_headers, timeout=15,
        )

    def test_upload_invalid_folder_returns_400(self, admin_headers):
        files = {"file": ("x.png", _fake_png_bytes(), "image/png")}
        data = {"folder": "evil/path"}
        r = requests.post(f"{API}/uploads", files=files, data=data, headers=admin_headers, timeout=15)
        assert r.status_code == 400, r.text

    def test_upload_companies_folder_allowed(self, admin_headers):
        files = {"file": ("logo_test.png", _fake_png_bytes(), "image/png")}
        data = {"folder": "marsol/companies"}
        r = requests.post(f"{API}/uploads", files=files, data=data, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "marsol/companies" in body["public_id"]
        requests.delete(
            f"{API}/uploads",
            params={"public_id": body["public_id"], "resource_type": body["resource_type"]},
            headers=admin_headers, timeout=15,
        )

    def test_upload_requires_auth(self):
        files = {"file": ("x.png", _fake_png_bytes(), "image/png")}
        r = requests.post(f"{API}/uploads", files=files, timeout=10)
        assert r.status_code in (401, 403), r.status_code

    def test_max_upload_bytes_constant_is_25mb(self):
        # Inspect constant rather than uploading a huge file
        with open("/app/backend/server.py") as f:
            src = f.read()
        assert "MAX_UPLOAD_BYTES = 25 * 1024 * 1024" in src


# ====================================================
# /api/uploads DELETE — graceful idempotent
# ====================================================
class TestUploadDelete:
    def test_delete_then_redelete_idempotent(self, admin_headers):
        # upload an image
        files = {"file": ("delete_me.png", _fake_png_bytes(), "image/png")}
        data = {"folder": "marsol/files"}
        r = requests.post(f"{API}/uploads", files=files, data=data, headers=admin_headers, timeout=30)
        assert r.status_code == 200
        pid = r.json()["public_id"]
        rt = r.json()["resource_type"]

        # first delete should succeed
        r1 = requests.delete(f"{API}/uploads", params={"public_id": pid, "resource_type": rt}, headers=admin_headers, timeout=15)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("ok") is True

        # second delete: must not crash; returns 404 (asset already gone)
        r2 = requests.delete(f"{API}/uploads", params={"public_id": pid, "resource_type": rt}, headers=admin_headers, timeout=15)
        assert r2.status_code in (200, 404), r2.text


# ====================================================
# /api/files — CRUD + RBAC
# ====================================================
class TestFilesModule:
    def _upload_asset(self, headers) -> dict:
        files = {"file": (f"file_{int(time.time()*1000)}.txt", _fake_txt_bytes(), "text/plain")}
        data = {"folder": "marsol/files"}
        r = requests.post(f"{API}/uploads", files=files, data=data, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        return r.json()

    def test_create_file_persists_metadata_and_get_returns_it(self, admin_headers):
        asset = self._upload_asset(admin_headers)
        payload = {
            "name": "TEST_marsol_doc",
            "description": "regression test doc",
            "tags": ["test", "iter35"],
            "folder": "marsol/files",
            "url": asset["url"],
            "public_id": asset["public_id"],
            "resource_type": asset["resource_type"],
            "format": asset.get("format"),
            "bytes": asset.get("bytes"),
            "mime_type": asset.get("mime_type"),
        }
        r = requests.post(f"{API}/files", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        doc = r.json()
        for key in ["id", "name", "url", "public_id", "resource_type", "uploaded_at", "uploaded_by_id", "uploaded_by_name"]:
            assert key in doc, f"missing {key}"
        assert doc["name"] == "TEST_marsol_doc"
        assert doc["tags"] == ["test", "iter35"]

        # GET listing — sorted by uploaded_at desc
        r2 = requests.get(f"{API}/files", headers=admin_headers, timeout=10)
        assert r2.status_code == 200
        ids = [f["id"] for f in r2.json()]
        assert doc["id"] in ids

        # GET with folder filter
        r3 = requests.get(f"{API}/files", params={"folder": "marsol/files"}, headers=admin_headers, timeout=10)
        assert r3.status_code == 200
        assert all(f.get("folder") == "marsol/files" for f in r3.json())

        # DELETE removes from db + cloudinary and returns ok:true
        r4 = requests.delete(f"{API}/files/{doc['id']}", headers=admin_headers, timeout=15)
        assert r4.status_code == 200, r4.text
        assert r4.json().get("ok") is True

        # listing should no longer have it
        r5 = requests.get(f"{API}/files", headers=admin_headers, timeout=10)
        assert doc["id"] not in [f["id"] for f in r5.json()]

    def test_create_file_missing_url_or_public_id_returns_400(self, admin_headers):
        r = requests.post(f"{API}/files", json={"name": "no url"}, headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_delete_unknown_file_returns_404(self, admin_headers):
        r = requests.delete(f"{API}/files/does-not-exist-xyz", headers=admin_headers, timeout=10)
        assert r.status_code == 404

    def test_sales_can_read_files(self, sales_headers):
        r = requests.get(f"{API}/files", headers=sales_headers, timeout=10)
        assert r.status_code == 200, r.text

    def test_sales_cannot_create_file_403(self, sales_headers):
        # sales has files: read but not write
        payload = {"name": "blocked", "url": "https://res.cloudinary.com/ddyysroag/raw/upload/x", "public_id": "x"}
        r = requests.post(f"{API}/files", json=payload, headers=sales_headers, timeout=10)
        assert r.status_code == 403, r.text

    def test_sales_cannot_delete_file_403(self, admin_headers, sales_headers):
        # admin creates one
        asset = self._upload_asset(admin_headers)
        payload = {"name": "TEST_rbac", "url": asset["url"], "public_id": asset["public_id"], "resource_type": asset["resource_type"]}
        r = requests.post(f"{API}/files", json=payload, headers=admin_headers, timeout=15)
        fid = r.json()["id"]
        try:
            r2 = requests.delete(f"{API}/files/{fid}", headers=sales_headers, timeout=10)
            assert r2.status_code == 403
        finally:
            requests.delete(f"{API}/files/{fid}", headers=admin_headers, timeout=10)


# ====================================================
# Legacy /api/upload  (used by Companies, HR, Settings) now Cloudinary-backed
# ====================================================
class TestLegacyUpload:
    def test_legacy_upload_returns_cloudinary_url(self, admin_headers):
        files = {"file": ("legacy_logo.png", _fake_png_bytes(), "image/png")}
        r = requests.post(f"{API}/upload", files=files, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["url"].startswith("https://res.cloudinary.com/ddyysroag/"), body
        assert "public_id" in body
        assert "resource_type" in body
        # cleanup
        requests.delete(
            f"{API}/uploads",
            params={"public_id": body["public_id"], "resource_type": body["resource_type"]},
            headers=admin_headers, timeout=15,
        )

    def test_public_upload_returns_cloudinary_url_no_auth(self):
        files = {"file": ("public_img.png", _fake_png_bytes(), "image/png")}
        r = requests.post(f"{API}/public/upload", files=files, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["url"].startswith("https://res.cloudinary.com/ddyysroag/"), body


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
