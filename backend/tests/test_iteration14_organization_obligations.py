"""
Iteration 14 - Organization, Obligations, and Invitations Module Tests
Tests for:
- Events CRUD (create, read, update, delete)
- Auto-suggest companies for events
- Invitations management (create, bulk create, call status updates)
- Obligations dashboard and company details
- Obligation deduction logic
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "settings@marsol.az"


class TestEvents:
    """Events CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def test_event_id(self, headers):
        """Create a test event and return its ID"""
        event_data = {
            "name": "TEST_Breakfast Event",
            "event_type": "Breakfast",
            "date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "time": "09:00",
            "venue": "Marsol Office",
            "participant_limit": 25,
            "status": "Planlaşdırılır",
            "notes": "Test event for iteration 14"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert response.status_code == 200, f"Failed to create event: {response.text}"
        return response.json()["id"]
    
    def test_get_events_list(self, headers):
        """Test getting list of events"""
        response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} events")
    
    def test_create_event(self, headers):
        """Test creating a new event"""
        event_data = {
            "name": "TEST_Mafia Night",
            "event_type": "Mafia",
            "date": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "venue": "Game Center",
            "participant_limit": 15,
            "status": "Planlaşdırılır",
            "notes": "Test mafia event"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Mafia Night"
        assert data["event_type"] == "Mafia"
        assert data["participant_limit"] == 15
        assert "id" in data
        print(f"Created event: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{data['id']}", headers=headers)
    
    def test_create_office_visit_event(self, headers):
        """Test creating office visit event with host company"""
        # First get a company to use as host
        companies_response = requests.get(f"{BASE_URL}/api/options/companies", headers=headers)
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        if len(companies) > 0:
            host_company = companies[0]
            event_data = {
                "name": "TEST_Office Visit",
                "event_type": "Ofis ziyarəti",
                "date": (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d"),
                "time": "14:00",
                "venue": host_company.get("brand_name", "Test Office"),
                "participant_limit": 10,
                "host_company_id": host_company.get("id", ""),
                "host_company_name": host_company.get("brand_name", ""),
                "status": "Planlaşdırılır"
            }
            response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data["event_type"] == "Ofis ziyarəti"
            assert data["host_company_id"] == host_company.get("id", "")
            print(f"Created office visit event with host: {data['host_company_name']}")
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/events/{data['id']}", headers=headers)
    
    def test_get_event_by_id(self, headers, test_event_id):
        """Test getting a specific event"""
        response = requests.get(f"{BASE_URL}/api/events/{test_event_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_event_id
        assert "name" in data
        assert "event_type" in data
    
    def test_update_event(self, headers, test_event_id):
        """Test updating an event"""
        update_data = {
            "name": "TEST_Updated Breakfast Event",
            "participant_limit": 30
        }
        response = requests.put(f"{BASE_URL}/api/events/{test_event_id}", json=update_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Updated Breakfast Event"
        assert data["participant_limit"] == 30
    
    def test_get_event_types(self, headers):
        """Test getting event types list"""
        response = requests.get(f"{BASE_URL}/api/events/types/list", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        expected_types = ["Breakfast", "Ofis ziyarəti", "Mafia", "Sosial fəaliyyət", "Təlim", "B2B görüş"]
        for et in expected_types:
            assert et in data, f"Missing event type: {et}"
        print(f"Event types: {data}")


class TestAutoSuggest:
    """Auto-suggest companies tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def test_event_for_suggest(self, headers):
        """Create a test event for auto-suggest"""
        event_data = {
            "name": "TEST_Auto Suggest Event",
            "event_type": "Breakfast",
            "date": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
            "time": "09:00",
            "venue": "Test Venue",
            "participant_limit": 20,
            "status": "Planlaşdırılır"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert response.status_code == 200
        return response.json()["id"]
    
    def test_auto_suggest_companies(self, headers, test_event_for_suggest):
        """Test auto-suggest endpoint returns prioritized companies"""
        response = requests.post(
            f"{BASE_URL}/api/events/{test_event_for_suggest}/auto-suggest",
            json={"count": 10},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
        assert "total_candidates" in data
        suggestions = data["suggestions"]
        assert isinstance(suggestions, list)
        
        if len(suggestions) > 0:
            # Verify suggestion structure
            first = suggestions[0]
            assert "company_id" in first
            assert "company_name" in first
            assert "package" in first
            assert "remaining_quota" in first
            assert "total_quota" in first
            assert "priority_score" in first
            assert "days_remaining" in first
            print(f"Got {len(suggestions)} suggestions, top: {first['company_name']} (score: {first['priority_score']})")
            
            # Verify sorting by priority score (descending)
            if len(suggestions) > 1:
                for i in range(len(suggestions) - 1):
                    assert suggestions[i]["priority_score"] >= suggestions[i+1]["priority_score"], \
                        "Suggestions should be sorted by priority score descending"
    
    def test_auto_suggest_with_custom_count(self, headers, test_event_for_suggest):
        """Test auto-suggest with custom count parameter"""
        response = requests.post(
            f"{BASE_URL}/api/events/{test_event_for_suggest}/auto-suggest",
            json={"count": 5},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["suggestions"]) <= 5
    
    def test_auto_suggest_excludes_already_invited(self, headers, test_event_for_suggest):
        """Test that auto-suggest excludes already invited companies"""
        # First get suggestions
        response1 = requests.post(
            f"{BASE_URL}/api/events/{test_event_for_suggest}/auto-suggest",
            json={"count": 5},
            headers=headers
        )
        assert response1.status_code == 200
        suggestions = response1.json()["suggestions"]
        
        if len(suggestions) > 0:
            # Invite the first company
            company_to_invite = suggestions[0]
            invite_response = requests.post(
                f"{BASE_URL}/api/invitations/bulk",
                json={
                    "event_id": test_event_for_suggest,
                    "company_ids": [company_to_invite["company_id"]]
                },
                headers=headers
            )
            assert invite_response.status_code == 200
            
            # Get suggestions again
            response2 = requests.post(
                f"{BASE_URL}/api/events/{test_event_for_suggest}/auto-suggest",
                json={"count": 10},
                headers=headers
            )
            assert response2.status_code == 200
            new_suggestions = response2.json()["suggestions"]
            
            # Verify the invited company is not in new suggestions
            invited_ids = [s["company_id"] for s in new_suggestions]
            assert company_to_invite["company_id"] not in invited_ids, \
                "Already invited company should not appear in suggestions"


class TestInvitations:
    """Invitations management tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def test_event_for_invitations(self, headers):
        """Create a test event for invitations"""
        event_data = {
            "name": "TEST_Invitations Event",
            "event_type": "Training",
            "date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "time": "10:00",
            "venue": "Training Center",
            "participant_limit": 30,
            "status": "Planlaşdırılır"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert response.status_code == 200
        return response.json()
    
    def test_get_invitations_list(self, headers):
        """Test getting all invitations"""
        response = requests.get(f"{BASE_URL}/api/invitations", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} invitations")
    
    def test_get_invitations_by_event(self, headers, test_event_for_invitations):
        """Test getting invitations filtered by event"""
        event_id = test_event_for_invitations["id"]
        response = requests.get(f"{BASE_URL}/api/invitations?event_id={event_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned invitations should be for this event
        for inv in data:
            assert inv["event_id"] == event_id
    
    def test_create_single_invitation(self, headers, test_event_for_invitations):
        """Test creating a single invitation"""
        # Get a company
        companies_response = requests.get(f"{BASE_URL}/api/options/companies", headers=headers)
        companies = companies_response.json()
        
        if len(companies) > 0:
            company = companies[0]
            event = test_event_for_invitations
            
            inv_data = {
                "event_id": event["id"],
                "event_name": event["name"],
                "event_type": event["event_type"],
                "event_date": event["date"],
                "company_id": company["id"],
                "company_name": company.get("brand_name", "")
            }
            response = requests.post(f"{BASE_URL}/api/invitations", json=inv_data, headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data["event_id"] == event["id"]
            assert data["company_id"] == company["id"]
            assert data["call_status"] == "Gözləyir"
            assert "id" in data
            print(f"Created invitation: {data['id']}")
    
    def test_bulk_create_invitations(self, headers, test_event_for_invitations):
        """Test bulk creating invitations"""
        # Get companies
        companies_response = requests.get(f"{BASE_URL}/api/options/companies", headers=headers)
        companies = companies_response.json()
        
        if len(companies) >= 3:
            event_id = test_event_for_invitations["id"]
            company_ids = [c["id"] for c in companies[1:4]]  # Get 3 companies
            
            response = requests.post(
                f"{BASE_URL}/api/invitations/bulk",
                json={"event_id": event_id, "company_ids": company_ids},
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "created" in data
            assert data["created"] >= 0  # May be 0 if already invited
            print(f"Bulk created {data['created']} invitations")
    
    def test_update_call_status_accepted(self, headers, test_event_for_invitations):
        """Test updating call status to accepted (Qatılır)"""
        event_id = test_event_for_invitations["id"]
        
        # Get invitations for this event
        inv_response = requests.get(f"{BASE_URL}/api/invitations?event_id={event_id}", headers=headers)
        invitations = inv_response.json()
        
        if len(invitations) > 0:
            inv = invitations[0]
            response = requests.put(
                f"{BASE_URL}/api/invitations/{inv['id']}/call",
                json={"call_status": "Cavab verdi", "participation_status": "Qatılır"},
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["call_status"] == "Cavab verdi"
            assert data["participation_status"] == "Qatılır"
            assert data["obligation_deducted"] == True
            assert "called_by" in data
            print(f"Updated invitation {inv['id']} to Qatılır")
    
    def test_update_call_status_declined(self, headers, test_event_for_invitations):
        """Test updating call status to declined (Qatılmır)"""
        event_id = test_event_for_invitations["id"]
        
        # Get invitations for this event
        inv_response = requests.get(f"{BASE_URL}/api/invitations?event_id={event_id}", headers=headers)
        invitations = inv_response.json()
        
        # Find one that's still waiting
        waiting_inv = next((i for i in invitations if i["call_status"] == "Gözləyir"), None)
        
        if waiting_inv:
            response = requests.put(
                f"{BASE_URL}/api/invitations/{waiting_inv['id']}/call",
                json={"call_status": "Cavab verdi", "participation_status": "Qatılmır"},
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["call_status"] == "Cavab verdi"
            assert data["participation_status"] == "Qatılmır"
            assert data["obligation_deducted"] == True  # Obligation deducted even for decline
            print(f"Updated invitation {waiting_inv['id']} to Qatılmır")
    
    def test_update_call_status_no_answer(self, headers, test_event_for_invitations):
        """Test updating call status to no answer (Cavab vermədi)"""
        event_id = test_event_for_invitations["id"]
        
        # Get invitations for this event
        inv_response = requests.get(f"{BASE_URL}/api/invitations?event_id={event_id}", headers=headers)
        invitations = inv_response.json()
        
        # Find one that's still waiting
        waiting_inv = next((i for i in invitations if i["call_status"] == "Gözləyir"), None)
        
        if waiting_inv:
            response = requests.put(
                f"{BASE_URL}/api/invitations/{waiting_inv['id']}/call",
                json={"call_status": "Cavab vermədi"},
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["call_status"] == "Cavab vermədi"
            assert data["obligation_deducted"] == False  # No deduction for no answer
            print(f"Updated invitation {waiting_inv['id']} to Cavab vermədi")
    
    def test_delete_invitation(self, headers, test_event_for_invitations):
        """Test deleting an invitation"""
        event_id = test_event_for_invitations["id"]
        
        # Get invitations for this event
        inv_response = requests.get(f"{BASE_URL}/api/invitations?event_id={event_id}", headers=headers)
        invitations = inv_response.json()
        
        if len(invitations) > 0:
            inv_to_delete = invitations[-1]  # Delete the last one
            response = requests.delete(f"{BASE_URL}/api/invitations/{inv_to_delete['id']}", headers=headers)
            assert response.status_code == 200
            
            # Verify deletion
            verify_response = requests.get(f"{BASE_URL}/api/invitations?event_id={event_id}", headers=headers)
            remaining = verify_response.json()
            remaining_ids = [i["id"] for i in remaining]
            assert inv_to_delete["id"] not in remaining_ids


class TestObligations:
    """Obligations dashboard and company detail tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_obligations_dashboard(self, headers):
        """Test getting obligations dashboard"""
        response = requests.get(f"{BASE_URL}/api/obligations/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "obligations" in data
        assert "stats" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "total" in stats
        assert "not_invited" in stats
        assert "under_invited" in stats
        assert "fully_served" in stats
        assert "urgent" in stats
        
        print(f"Dashboard stats: total={stats['total']}, not_invited={stats['not_invited']}, urgent={stats['urgent']}")
        
        # Verify obligations structure
        obligations = data["obligations"]
        assert isinstance(obligations, list)
        
        if len(obligations) > 0:
            obl = obligations[0]
            assert "company_id" in obl
            assert "company_name" in obl
            assert "package" in obl
            assert "total_quota" in obl
            assert "used_quota" in obl
            assert "remaining_quota" in obl
            assert "priority_score" in obl
            assert "total_invited" in obl
            assert "total_attended" in obl
            assert "total_declined" in obl
            assert "total_no_answer" in obl
            assert "days_remaining" in obl
    
    def test_obligations_sorted_by_priority(self, headers):
        """Test that obligations are sorted by priority score descending"""
        response = requests.get(f"{BASE_URL}/api/obligations/dashboard", headers=headers)
        assert response.status_code == 200
        obligations = response.json()["obligations"]
        
        if len(obligations) > 1:
            for i in range(len(obligations) - 1):
                assert obligations[i]["priority_score"] >= obligations[i+1]["priority_score"], \
                    "Obligations should be sorted by priority score descending"
    
    def test_get_company_obligation_detail(self, headers):
        """Test getting detailed obligation for a specific company"""
        # First get a company from dashboard
        dashboard_response = requests.get(f"{BASE_URL}/api/obligations/dashboard", headers=headers)
        obligations = dashboard_response.json()["obligations"]
        
        if len(obligations) > 0:
            company_id = obligations[0]["company_id"]
            response = requests.get(f"{BASE_URL}/api/obligations/company/{company_id}", headers=headers)
            assert response.status_code == 200
            data = response.json()
            
            # Verify structure
            assert data["company_id"] == company_id
            assert "company_name" in data
            assert "package" in data
            assert "total_quota" in data
            assert "used_quota" in data
            assert "remaining_quota" in data
            assert "invitations" in data
            assert "type_breakdown" in data
            
            # Verify invitations list
            assert isinstance(data["invitations"], list)
            
            # Verify type breakdown
            assert isinstance(data["type_breakdown"], dict)
            
            print(f"Company {data['company_name']}: quota {data['used_quota']}/{data['total_quota']}, invitations: {len(data['invitations'])}")
    
    def test_company_obligation_not_found(self, headers):
        """Test getting obligation for non-existent company"""
        response = requests.get(f"{BASE_URL}/api/obligations/company/non-existent-id", headers=headers)
        assert response.status_code == 404


class TestObligationDeduction:
    """Test obligation deduction logic"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_obligation_deducted_on_answer(self, headers):
        """Test that obligation is deducted when call is answered (accept or decline)"""
        # Create a test event
        event_data = {
            "name": "TEST_Obligation Deduction Event",
            "event_type": "Breakfast",
            "date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "time": "09:00",
            "venue": "Test Venue",
            "participant_limit": 10,
            "status": "Planlaşdırılır"
        }
        event_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert event_response.status_code == 200
        event = event_response.json()
        
        # Get a company
        companies_response = requests.get(f"{BASE_URL}/api/options/companies", headers=headers)
        companies = companies_response.json()
        
        if len(companies) > 0:
            company = companies[0]
            company_id = company["id"]
            
            # Get initial obligation
            obl_before = requests.get(f"{BASE_URL}/api/obligations/company/{company_id}", headers=headers).json()
            used_before = obl_before["used_quota"]
            
            # Create invitation
            inv_data = {
                "event_id": event["id"],
                "event_name": event["name"],
                "event_type": event["event_type"],
                "event_date": event["date"],
                "company_id": company_id,
                "company_name": company.get("brand_name", "")
            }
            inv_response = requests.post(f"{BASE_URL}/api/invitations", json=inv_data, headers=headers)
            assert inv_response.status_code == 200
            inv = inv_response.json()
            
            # Mark as answered (Qatılır)
            call_response = requests.put(
                f"{BASE_URL}/api/invitations/{inv['id']}/call",
                json={"call_status": "Cavab verdi", "participation_status": "Qatılır"},
                headers=headers
            )
            assert call_response.status_code == 200
            assert call_response.json()["obligation_deducted"] == True
            
            # Check obligation increased
            obl_after = requests.get(f"{BASE_URL}/api/obligations/company/{company_id}", headers=headers).json()
            used_after = obl_after["used_quota"]
            
            assert used_after == used_before + 1, f"Obligation should increase by 1: was {used_before}, now {used_after}"
            print(f"Obligation deduction verified: {used_before} -> {used_after}")
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/invitations/{inv['id']}", headers=headers)
            requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=headers)
    
    def test_obligation_not_deducted_on_no_answer(self, headers):
        """Test that obligation is NOT deducted when call has no answer"""
        # Create a test event
        event_data = {
            "name": "TEST_No Answer Event",
            "event_type": "Mafia",
            "date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "time": "19:00",
            "venue": "Test Venue",
            "participant_limit": 10,
            "status": "Planlaşdırılır"
        }
        event_response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=headers)
        assert event_response.status_code == 200
        event = event_response.json()
        
        # Get a company
        companies_response = requests.get(f"{BASE_URL}/api/options/companies", headers=headers)
        companies = companies_response.json()
        
        if len(companies) > 1:
            company = companies[1]  # Use different company
            company_id = company["id"]
            
            # Get initial obligation
            obl_before = requests.get(f"{BASE_URL}/api/obligations/company/{company_id}", headers=headers).json()
            used_before = obl_before["used_quota"]
            
            # Create invitation
            inv_data = {
                "event_id": event["id"],
                "event_name": event["name"],
                "event_type": event["event_type"],
                "event_date": event["date"],
                "company_id": company_id,
                "company_name": company.get("brand_name", "")
            }
            inv_response = requests.post(f"{BASE_URL}/api/invitations", json=inv_data, headers=headers)
            assert inv_response.status_code == 200
            inv = inv_response.json()
            
            # Mark as no answer
            call_response = requests.put(
                f"{BASE_URL}/api/invitations/{inv['id']}/call",
                json={"call_status": "Cavab vermədi"},
                headers=headers
            )
            assert call_response.status_code == 200
            assert call_response.json()["obligation_deducted"] == False
            
            # Check obligation NOT increased
            obl_after = requests.get(f"{BASE_URL}/api/obligations/company/{company_id}", headers=headers).json()
            used_after = obl_after["used_quota"]
            
            assert used_after == used_before, f"Obligation should NOT increase for no answer: was {used_before}, now {used_after}"
            print(f"No deduction verified for no answer: {used_before} -> {used_after}")
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/invitations/{inv['id']}", headers=headers)
            requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=headers)


class TestCompaniesOptions:
    """Test companies options endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_companies_options(self, headers):
        """Test getting companies for select dropdowns"""
        response = requests.get(f"{BASE_URL}/api/options/companies", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            company = data[0]
            assert "id" in company
            assert "brand_name" in company
            print(f"Found {len(data)} companies for options")


# Cleanup fixture to run after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Cleanup runs after all tests
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "settings@marsol.az",
        "password": "marsol123"
    })
    if response.status_code == 200:
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Delete test events
        events_response = requests.get(f"{BASE_URL}/api/events", headers=headers)
        if events_response.status_code == 200:
            for event in events_response.json():
                if event.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=headers)
                    print(f"Cleaned up test event: {event['name']}")
