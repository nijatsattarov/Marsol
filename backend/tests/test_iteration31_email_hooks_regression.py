"""Iteration 31 — Resend email hooks regression.

Verifies that email hook integration (server.py _email_notify_safe wrapper)
does NOT break any existing endpoints. We DO NOT verify actual email delivery
(Resend may rate-limit). We only verify HTTP responses degrade gracefully.

Hooks live at: meetings POST, sales-leads PUT, public/form POST,
notifications/dispatch-emails.
"""
import os
import uuid
import pytest
import requests

def _read_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL is not set")


BASE_URL = _read_backend_url().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}
ACCT = {"email": "muhasib@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login {creds['email']} -> {r.status_code} {r.text}"
    j = r.json()
    assert "access_token" in j, f"login response missing access_token: {j}"
    return j["access_token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def sales_h():
    return {"Authorization": f"Bearer {_login(SALES)}"}


@pytest.fixture(scope="module")
def acct_h():
    return {"Authorization": f"Bearer {_login(ACCT)}"}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self):
        tok = _login(ADMIN)
        assert isinstance(tok, str) and len(tok) > 10

    def test_sales_login(self):
        assert _login(SALES)

    def test_acct_login(self):
        assert _login(ACCT)


# ---------- Notifications ----------
class TestNotifications:
    def test_get_notifications(self, admin_h):
        r = requests.get(f"{API}/notifications", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "notifications" in j and isinstance(j["notifications"], list)
        assert "count" in j and isinstance(j["count"], int)
        assert "high_count" in j and isinstance(j["high_count"], int)

    def test_dispatch_emails_returns_object(self, admin_h):
        r = requests.post(f"{API}/notifications/dispatch-emails", headers=admin_h, timeout=60)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "sent" in j and "skipped" in j
        assert isinstance(j["sent"], int) and isinstance(j["skipped"], int)

    def test_dispatch_emails_idempotent(self, admin_h):
        # second call within seconds: nothing new should be sent
        r1 = requests.post(f"{API}/notifications/dispatch-emails", headers=admin_h, timeout=60)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/notifications/dispatch-emails", headers=admin_h, timeout=60)
        assert r2.status_code == 200
        j2 = r2.json()
        # second dispatch should send 0 (everything already in notification_email_log)
        assert j2["sent"] == 0, f"second dispatch should be idempotent, got {j2}"


# ---------- Meetings (email hook on POST) ----------
class TestMeetings:
    def test_create_meeting_no_500_and_persisted(self, admin_h):
        suffix = uuid.uuid4().hex[:6]
        payload = {
            "employee": "Admin",
            "meeting_setter": "Admin",
            "date": "2026-02-15",
            "time": "10:30",
            "company": f"TEST31_meet_{suffix}",
            "contact_person": "Test Person",
            "meeting_type": "Müştəri görüşü",
            "meeting_mode": "Online",
            "location": "Zoom",
            "result": "",
            "notes": "Email-hook regression",
            "reminders": [],
        }
        r = requests.post(f"{API}/meetings", headers=admin_h, json=payload, timeout=60)
        assert r.status_code == 200, f"meetings POST -> {r.status_code} {r.text}"
        body = r.json()
        assert body.get("id"), body
        meeting_id = body["id"]

        # Verify persisted
        gr = requests.get(f"{API}/meetings", headers=admin_h, timeout=30)
        assert gr.status_code == 200
        meetings = gr.json()
        assert any(m.get("id") == meeting_id for m in meetings), "meeting not persisted"

        # cleanup
        requests.delete(f"{API}/meetings/{meeting_id}", headers=admin_h, timeout=30)


# ---------- Sales-leads (email hook on PUT->Bağlandı) ----------
class TestSalesLeads:
    def _ensure_lead(self, h):
        # create a fresh lead
        suffix = uuid.uuid4().hex[:6]
        r = requests.post(
            f"{API}/sales-leads",
            headers=h,
            json={
                "company_name": f"TEST31_lead_{suffix}",
                "contact_name": "Test Contact",
                "phone": "+994000000000",
                "status": "Yeni",
                "value": 100,
                "currency": "AZN",
            },
            timeout=30,
        )
        assert r.status_code == 200, f"create lead -> {r.status_code} {r.text}"
        return r.json()["id"]

    def test_list_sales_leads(self, admin_h):
        r = requests.get(f"{API}/sales-leads", headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_update_lead_to_baglandi_no_500(self, admin_h):
        lead_id = self._ensure_lead(admin_h)
        try:
            r = requests.put(
                f"{API}/sales-leads/{lead_id}",
                headers=admin_h,
                json={"status": "Bağlandı"},
                timeout=60,
            )
            assert r.status_code == 200, f"PUT lead Bağlandı -> {r.status_code} {r.text}"
            # verify persisted
            gr = requests.get(f"{API}/sales-leads", headers=admin_h, timeout=30)
            assert gr.status_code == 200
            target = next((x for x in gr.json() if x.get("id") == lead_id), None)
            assert target is not None
            assert target.get("status") == "Bağlandı"
        finally:
            requests.delete(f"{API}/sales-leads/{lead_id}", headers=admin_h, timeout=30)


# ---------- Public form (email hook on POST submit) ----------
class TestPublicForm:
    def test_public_form_submit_no_500(self, admin_h):
        # create a company to attach a token to
        suffix = uuid.uuid4().hex[:6]
        cr = requests.post(
            f"{API}/companies",
            headers=admin_h,
            json={
                "brand_name": f"TEST31_pubco_{suffix}",
                "owner_name": "Owner",
                "owner_phone": "+994000000111",
            },
            timeout=30,
        )
        assert cr.status_code in (200, 201), cr.text
        company_id = cr.json()["id"]

        try:
            # generate token
            tr = requests.post(
                f"{API}/forum/generate-link/{company_id}",
                headers=admin_h,
                timeout=30,
            )
            if tr.status_code != 200:
                pytest.skip(f"forum/generate-link unavailable: {tr.status_code}")
            tj = tr.json()
            tok = tj.get("token") or (tj.get("url", "").rsplit("/", 1)[-1] if tj.get("url") else None)
            assert tok, f"no token in response: {tj}"

            # GET public form (no auth) — also returns enabled fields
            gr = requests.get(f"{API}/public/form/{tok}", timeout=30)
            assert gr.status_code == 200, gr.text
            enabled_keys = [f["key"] for f in gr.json().get("fields", [])]
            if not enabled_keys:
                pytest.skip("No enabled fields in public form settings")

            # Build a payload using only enabled keys (string values).
            payload = {k: f"TEST31_val_{suffix}" for k in enabled_keys[:3]}

            # POST public form (no auth) — triggers email hook
            sr = requests.post(
                f"{API}/public/form/{tok}",
                json=payload,
                timeout=60,
            )
            assert sr.status_code == 200, f"public submit -> {sr.status_code} {sr.text}"

            # Verify pending_form_data persisted, but real fields untouched
            cg = requests.get(f"{API}/companies/{company_id}", headers=admin_h, timeout=30)
            assert cg.status_code == 200
            cdoc = cg.json()
            assert cdoc.get("pending_form_data"), f"pending_form_data not stored. enabled_keys={enabled_keys}"
            # Ensure approve-form still works
            ar = requests.post(
                f"{API}/companies/{company_id}/approve-form",
                headers=admin_h,
                timeout=30,
            )
            assert ar.status_code == 200, f"approve-form -> {ar.status_code} {ar.text}"
        finally:
            requests.delete(f"{API}/companies/{company_id}", headers=admin_h, timeout=30)


# ---------- Existing core flows ----------
class TestCoreFlows:
    @pytest.mark.parametrize(
        "path",
        [
            "/companies",
            "/members",
            "/obligations/dashboard",
            "/sales-leads",
            "/project-events",
            "/finance/expenses",
            "/finance/incomes",
        ],
    )
    def test_list_endpoints(self, admin_h, path):
        r = requests.get(f"{API}{path}", headers=admin_h, timeout=30)
        assert r.status_code == 200, f"GET {path} -> {r.status_code} {r.text[:200]}"
        # All these endpoints return JSON (list or dict)
        body = r.json()
        assert body is not None


# ---------- RBAC scope: sales user own ----------
class TestRBACScope:
    def test_sales_sees_subset_of_admin(self, admin_h, sales_h):
        ar = requests.get(f"{API}/sales-leads", headers=admin_h, timeout=30)
        sr = requests.get(f"{API}/sales-leads", headers=sales_h, timeout=30)
        assert ar.status_code == 200 and sr.status_code == 200
        admin_count = len(ar.json())
        sales_count = len(sr.json())
        # Sales user with scope=own should never see more than admin
        assert sales_count <= admin_count, f"sales={sales_count} > admin={admin_count}"

    def test_sales_meetings_scope(self, admin_h, sales_h):
        ar = requests.get(f"{API}/meetings", headers=admin_h, timeout=30)
        sr = requests.get(f"{API}/meetings", headers=sales_h, timeout=30)
        assert ar.status_code == 200 and sr.status_code == 200
        assert len(sr.json()) <= len(ar.json())
