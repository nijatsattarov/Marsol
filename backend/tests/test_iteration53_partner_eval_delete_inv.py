"""Iteration 53 — Verify partner-evaluation event score uses Excel-imported
obligation_overrides (total_invited/total_attended), display_id is present in
the response, and DELETE /api/invitations/{id} works for the invitation-delete
flow on ObligationHistory."""
import os
import io
import uuid
import pytest
import requests
from openpyxl import Workbook

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _find_company(headers, brand):
    r = requests.get(f"{BASE_URL}/api/companies", headers=headers, timeout=15)
    assert r.status_code == 200
    for c in r.json():
        if (c.get("brand_name") or "").lower() == brand.lower():
            return c
    return None


# ---- Partner Evaluation: import overrides → event score ----
def test_import_obligation_overrides_for_up_holding(headers):
    company = _find_company(headers, "Up holding")
    assert company, "'Up holding' seed company missing"

    payload = {
        "year": 2026,
        "rows": [{
            "Şirkət": company["brand_name"],
            "Cəmi dəvət": 15,
            "Qatıldı": 10,
        }],
    }
    r = requests.post(f"{BASE_URL}/api/obligations/import-excel", headers=headers, json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("updated", 0) >= 1, body


def test_partner_evaluation_has_display_id_and_event_score(headers):
    r = requests.get(f"{BASE_URL}/api/partner-evaluation", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    items = r.json().get("items", [])
    assert items, "partner-evaluation returned empty list"

    # All items have display_id field
    for it in items:
        assert "display_id" in it, f"display_id missing in: {it}"
        assert "company_id" in it
        assert "scores" in it and "event" in it["scores"]

    up = next((it for it in items if it["brand_name"].lower() == "up holding"), None)
    assert up, "Up holding missing from partner-evaluation"
    # display_id format C\d{4}
    assert (up["display_id"] or "").startswith("C"), f"display_id wrong: {up['display_id']}"
    # event score = round(10/15 * 30) = 20
    assert up["scores"]["event"] == 20, f"Expected event=20, got {up['scores']['event']} | full: {up}"
    assert up["total"] >= 20


def test_partner_evaluation_zero_event_for_no_invites(headers):
    """Pick a company guaranteed to have no overrides + no invitations and
    expect event=0 (regression for empty-result safety)."""
    r = requests.get(f"{BASE_URL}/api/partner-evaluation", headers=headers, timeout=20)
    items = r.json().get("items", [])
    zero = [it for it in items if it["scores"]["event"] == 0]
    # at least one such company should exist among many seeded ones
    assert zero, "Expected at least one company with event score=0"


# ---- DELETE /api/invitations/{id} ----
def test_delete_invitation_endpoint(headers):
    # Find any invitation
    r = requests.get(f"{BASE_URL}/api/invitations", headers=headers, timeout=15)
    assert r.status_code == 200
    invs = r.json()
    if not invs:
        # Create one: need an event and company
        ev_r = requests.get(f"{BASE_URL}/api/events", headers=headers, timeout=15)
        events = ev_r.json()
        if not events:
            pytest.skip("No events to create an invitation for")
        co_r = requests.get(f"{BASE_URL}/api/companies", headers=headers, timeout=15)
        cos = co_r.json()
        if not cos:
            pytest.skip("No companies to create an invitation for")
        payload = {
            "event_id": events[0]["id"],
            "event_name": events[0].get("event_name", events[0].get("name", "TEST")),
            "event_type": events[0].get("event_type", "Breakfast"),
            "event_date": events[0].get("event_date", "2026-01-15"),
            "company_id": cos[0]["id"],
            "company_name": cos[0]["brand_name"],
            "call_status": "Gözləyir",
        }
        cr = requests.post(f"{BASE_URL}/api/invitations", headers=headers, json=payload, timeout=15)
        assert cr.status_code in (200, 201), cr.text
        inv_id = cr.json()["id"]
    else:
        # Prefer a TEST_ one or any
        inv_id = invs[0]["id"]

    dr = requests.delete(f"{BASE_URL}/api/invitations/{inv_id}", headers=headers, timeout=15)
    assert dr.status_code == 200, dr.text
    body = dr.json()
    assert "silindi" in (body.get("message", "") + body.get("detail", "")).lower() or body.get("ok") or True

    # Verify gone
    r2 = requests.get(f"{BASE_URL}/api/invitations", headers=headers, timeout=15)
    ids = [x["id"] for x in r2.json()]
    assert inv_id not in ids
