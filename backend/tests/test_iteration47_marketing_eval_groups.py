"""Iteration 47 backend tests — Marketing (Mailchimp), Partner Evaluation, Message Groups.

NOTE: Real Mailchimp account; we only do non-destructive reads + send_now=false draft.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-hub-563.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "settings@marsol.az", "password": "marsol123"}
SALES = {"email": "satis@marsol.az", "password": "marsol123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def sales_headers():
    return {"Authorization": f"Bearer {_login(SALES)}"}


# ---------- MARKETING / MAILCHIMP ----------

class TestMailchimp:
    def test_ping_ok(self, admin_headers):
        r = requests.get(f"{API}/marketing/mailchimp/ping", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("datacenter") == "us18"
        assert d.get("label") == "MMS"
        assert "MARSOL" in (d.get("account") or "").upper()

    def test_ping_admin_only(self, sales_headers):
        r = requests.get(f"{API}/marketing/mailchimp/ping", headers=sales_headers, timeout=30)
        assert r.status_code == 403

    def test_audiences(self, admin_headers):
        r = requests.get(f"{API}/marketing/mailchimp/audiences", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("total", 0) >= 2
        auds = d.get("audiences") or []
        assert len(auds) >= 2
        for a in auds:
            assert "id" in a and "name" in a and "member_count" in a

    def test_campaigns_list(self, admin_headers):
        r = requests.get(f"{API}/marketing/mailchimp/campaigns", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert isinstance(d.get("campaigns"), list)

    def test_create_campaign_validation(self, admin_headers):
        r = requests.post(f"{API}/marketing/mailchimp/campaigns",
                          json={"audience_id": "", "subject": "", "html": "", "reply_to": ""},
                          headers=admin_headers, timeout=30)
        assert r.status_code == 400

    def test_create_campaign_draft(self, admin_headers):
        # Fetch a valid audience id first
        aud_r = requests.get(f"{API}/marketing/mailchimp/audiences", headers=admin_headers, timeout=30)
        aud_id = aud_r.json()["audiences"][0]["id"]
        payload = {
            "audience_id": aud_id,
            "subject": f"TEST_Draft_{uuid.uuid4().hex[:6]}",
            "title": "TEST_Iter47_Draft",
            "from_name": "Marsol Test",
            "reply_to": "settings@marsol.az",
            "html": "<p>TEST DRAFT — do not send</p>",
            "send_now": False,
        }
        r = requests.post(f"{API}/marketing/mailchimp/campaigns", json=payload, headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("status") == "draft"
        assert d.get("campaign_id")

    def test_sync_companies_structure(self, admin_headers):
        # Existing audience id per problem statement
        audience_id = "42e10db190"
        r = requests.post(f"{API}/marketing/mailchimp/audiences/{audience_id}/sync-companies",
                          json={}, headers=admin_headers, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "synced", "failed", "skipped_no_email"):
            assert k in d, f"missing key {k}"


# ---------- PARTNER EVALUATION ----------

class TestPartnerEvaluation:
    def test_list(self, admin_headers):
        r = requests.get(f"{API}/partner-evaluation", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("total", 0) >= 1
        items = d.get("items") or []
        assert len(items) >= 1
        # Check ordering DESC by total
        totals = [i["total"] for i in items]
        assert totals == sorted(totals, reverse=True)
        # Check structure
        first = items[0]
        assert "company_id" in first
        assert "scores" in first and isinstance(first["scores"], dict)
        for k in ("payment", "event", "other_projects", "meetings", "manual"):
            assert k in first["scores"]
        assert "total" in first and "tier" in first
        assert first["tier"] in ("Platinum", "Qızıl", "Gümüş", "Standart")

    def test_single(self, admin_headers):
        lst = requests.get(f"{API}/partner-evaluation", headers=admin_headers, timeout=30).json()
        cid = lst["items"][0]["company_id"]
        r = requests.get(f"{API}/partner-evaluation/{cid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["company_id"] == cid
        assert "scores" in d and "total" in d and "tier" in d

    def test_single_404(self, admin_headers):
        r = requests.get(f"{API}/partner-evaluation/nonexistent-id-xyz", headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_manual_bonus_clamp(self, admin_headers):
        lst = requests.get(f"{API}/partner-evaluation", headers=admin_headers, timeout=30).json()
        cid = lst["items"][0]["company_id"]
        # Try to set 99 → must clamp to 5
        r = requests.put(f"{API}/partner-evaluation/{cid}/manual-bonus",
                         json={"manual_bonus": 99, "note": "TEST_iter47_clamp"},
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["scores"]["manual"] == 5
        # Negative → 0
        r = requests.put(f"{API}/partner-evaluation/{cid}/manual-bonus",
                         json={"manual_bonus": -10, "note": "TEST_iter47_neg"},
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["scores"]["manual"] == 0
        # Reset to 0 for cleanliness
        requests.put(f"{API}/partner-evaluation/{cid}/manual-bonus",
                     json={"manual_bonus": 0, "note": ""},
                     headers=admin_headers, timeout=30)

    def test_manual_bonus_admin_only(self, sales_headers):
        r = requests.put(f"{API}/partner-evaluation/any/manual-bonus",
                         json={"manual_bonus": 2}, headers=sales_headers, timeout=30)
        assert r.status_code == 403


# ---------- MESSAGE GROUPS ----------

class TestMessageGroups:
    created_group_id = None

    def test_create_group_requires_min_2_members(self, admin_headers):
        r = requests.post(f"{API}/messages/groups",
                          json={"name": "TEST_bad", "members": ["only-one"]},
                          headers=admin_headers, timeout=30)
        assert r.status_code == 400

    def test_create_group_success(self, admin_headers):
        # Get 2 user ids
        ur = requests.get(f"{API}/users", headers=admin_headers, timeout=30)
        users = ur.json() if ur.status_code == 200 else []
        if isinstance(users, dict):
            users = users.get("items", users)
        other_ids = [u["id"] for u in users if u.get("email") != ADMIN["email"]][:2]
        assert len(other_ids) >= 2, f"Need 2 other users; found {len(other_ids)}"

        payload = {"name": f"TEST_group_{uuid.uuid4().hex[:6]}", "members": other_ids, "color": "#FF5500"}
        r = requests.post(f"{API}/messages/groups", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g.get("id")
        assert g["name"].startswith("TEST_group_")
        # creator auto-added
        me = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=30).json()
        assert me["id"] in g["members"]
        TestMessageGroups.created_group_id = g["id"]

    def test_list_groups_visible(self, admin_headers):
        r = requests.get(f"{API}/messages/groups", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        ids = [g["id"] for g in r.json()]
        assert TestMessageGroups.created_group_id in ids

    def test_post_message_and_read(self, admin_headers):
        gid = TestMessageGroups.created_group_id
        r = requests.post(f"{API}/messages/groups/{gid}/messages",
                          json={"body": "TEST_iter47 hello"}, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m.get("id") and m.get("body") == "TEST_iter47 hello"
        rr = requests.get(f"{API}/messages/groups/{gid}/messages", headers=admin_headers, timeout=30)
        assert rr.status_code == 200
        bodies = [x.get("body") for x in rr.json()]
        assert "TEST_iter47 hello" in bodies

    def test_non_member_cannot_read_or_post(self, sales_headers, admin_headers):
        gid = TestMessageGroups.created_group_id
        # Update group to remove sales user — first ensure sales is not a member
        me_sales = requests.get(f"{API}/auth/me", headers=sales_headers, timeout=30).json()
        g = requests.get(f"{API}/messages/groups", headers=admin_headers, timeout=30).json()
        group = next(x for x in g if x["id"] == gid)
        if me_sales["id"] in group["members"]:
            new_members = [m for m in group["members"] if m != me_sales["id"]]
            requests.put(f"{API}/messages/groups/{gid}", json={"members": new_members}, headers=admin_headers, timeout=30)
        # Try read as sales — 403
        r = requests.get(f"{API}/messages/groups/{gid}/messages", headers=sales_headers, timeout=30)
        assert r.status_code == 403
        # Try post
        r2 = requests.post(f"{API}/messages/groups/{gid}/messages", json={"body": "nope"}, headers=sales_headers, timeout=30)
        assert r2.status_code == 403

    def test_update_group_forbidden_for_non_member(self, sales_headers):
        gid = TestMessageGroups.created_group_id
        r = requests.put(f"{API}/messages/groups/{gid}", json={"name": "HACK"}, headers=sales_headers, timeout=30)
        assert r.status_code == 403

    def test_delete_group_only_creator(self, sales_headers):
        gid = TestMessageGroups.created_group_id
        # sales is not creator → 403
        r = requests.delete(f"{API}/messages/groups/{gid}", headers=sales_headers, timeout=30)
        assert r.status_code == 403

    def test_delete_by_creator(self, admin_headers):
        gid = TestMessageGroups.created_group_id
        r = requests.delete(f"{API}/messages/groups/{gid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json().get("deleted") is True
