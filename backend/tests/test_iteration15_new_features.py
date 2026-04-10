"""
Iteration 15 - Testing new Organization module features:
1. Google Maps location_link field in events
2. WhatsApp wa.me link integration (frontend only - uses wa.me links)
3. Sector conflict prevention in auto-suggest and manual add
"""
import pytest
import requests
import os

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
        return response.json()["access_token"]
    
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
        print("✓ Login successful")


class TestEventLocationLink:
    """Test Google Maps location_link field in events"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_event_with_location_link(self, auth_headers):
        """Test creating event with Google Maps location_link"""
        event_data = {
            "name": "TEST_Event_With_Location",
            "event_type": "Breakfast",
            "date": "2026-02-15",
            "time": "09:00",
            "venue": "Marsol Office",
            "location_link": "https://maps.google.com/maps?q=40.4093,49.8671",
            "participant_limit": 20,
            "status": "Planlaşdırılır"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        assert response.status_code == 200, f"Create event failed: {response.text}"
        data = response.json()
        assert data["location_link"] == "https://maps.google.com/maps?q=40.4093,49.8671"
        assert data["name"] == "TEST_Event_With_Location"
        print(f"✓ Event created with location_link: {data['id']}")
        return data["id"]
    
    def test_get_event_has_location_link(self, auth_headers):
        """Test that GET event returns location_link"""
        # First create an event
        event_data = {
            "name": "TEST_Event_Location_Get",
            "event_type": "Ofis ziyarəti",
            "date": "2026-02-20",
            "venue": "Test Venue",
            "location_link": "https://goo.gl/maps/test123",
            "participant_limit": 15
        }
        create_resp = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        event_id = create_resp.json()["id"]
        
        # Get the event
        response = requests.get(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["location_link"] == "https://goo.gl/maps/test123"
        print(f"✓ GET event returns location_link correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
    
    def test_update_event_location_link(self, auth_headers):
        """Test updating event location_link"""
        # Create event
        event_data = {
            "name": "TEST_Event_Update_Location",
            "event_type": "Mafia",
            "date": "2026-03-01",
            "venue": "Game Room",
            "location_link": "",
            "participant_limit": 10
        }
        create_resp = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        event_id = create_resp.json()["id"]
        
        # Update with location_link
        update_resp = requests.put(f"{BASE_URL}/api/events/{event_id}", 
            json={"location_link": "https://maps.google.com/updated"}, headers=auth_headers)
        assert update_resp.status_code == 200
        assert update_resp.json()["location_link"] == "https://maps.google.com/updated"
        print(f"✓ Event location_link updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_id}", headers=auth_headers)
    
    def test_events_list_includes_location_link(self, auth_headers):
        """Test that events list includes location_link field"""
        response = requests.get(f"{BASE_URL}/api/events", headers=auth_headers)
        assert response.status_code == 200
        events = response.json()
        # Check that location_link field exists in event objects
        if events:
            assert "location_link" in events[0] or events[0].get("location_link") is not None or "location_link" in events[0].keys()
        print(f"✓ Events list endpoint working, {len(events)} events found")


class TestCompaniesWithPhones:
    """Test that companies have owner_phone and company_phone for WhatsApp"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_companies_options_has_phone_fields(self, auth_headers):
        """Test that /api/options/companies returns phone fields"""
        response = requests.get(f"{BASE_URL}/api/options/companies", headers=auth_headers)
        assert response.status_code == 200
        companies = response.json()
        print(f"✓ Companies options endpoint returned {len(companies)} companies")
        
        # Check that phone fields are included in response
        if companies:
            company = companies[0]
            # These fields should be in the projection
            assert "owner_phone" in company or company.get("owner_phone") is not None or "owner_phone" in company.keys()
            assert "company_phone" in company or company.get("company_phone") is not None or "company_phone" in company.keys()
            print(f"✓ Company has owner_phone and company_phone fields")


class TestSectorConflictPrevention:
    """Test sector conflict prevention in auto-suggest and manual add"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_companies(self, auth_headers):
        """Create test companies with same sector for conflict testing"""
        companies = []
        
        # Company 1 - İnşaat sector
        c1_data = {
            "brand_name": "TEST_Sector_Company_1",
            "legal_name": "Test Company 1 LLC",
            "sector": "İnşaat",
            "sub_sector": "Tikinti",
            "company_size": "Orta",
            "owner_name": "Test Owner 1",
            "owner_phone": "+994501111111",
            "company_phone": "+994121111111",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Business",
            "contract_start_date": "2025-01-01",
            "contract_end_date": "2026-12-31",
            "status": "Aktiv"
        }
        resp1 = requests.post(f"{BASE_URL}/api/companies", json=c1_data, headers=auth_headers)
        if resp1.status_code == 200:
            companies.append(resp1.json())
        
        # Company 2 - Same İnşaat sector (should conflict)
        c2_data = {
            "brand_name": "TEST_Sector_Company_2",
            "legal_name": "Test Company 2 LLC",
            "sector": "İnşaat",
            "sub_sector": "Tikinti",
            "company_size": "Kiçik",
            "owner_name": "Test Owner 2",
            "owner_phone": "+994502222222",
            "company_phone": "+994122222222",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "contract_start_date": "2025-01-01",
            "contract_end_date": "2026-12-31",
            "status": "Aktiv"
        }
        resp2 = requests.post(f"{BASE_URL}/api/companies", json=c2_data, headers=auth_headers)
        if resp2.status_code == 200:
            companies.append(resp2.json())
        
        # Company 3 - Different sector (İKT - no conflict)
        c3_data = {
            "brand_name": "TEST_Sector_Company_3",
            "legal_name": "Test Company 3 LLC",
            "sector": "İKT",
            "sub_sector": "Proqram təminatı",
            "company_size": "Orta",
            "owner_name": "Test Owner 3",
            "owner_phone": "+994503333333",
            "company_phone": "+994123333333",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Business Plus",
            "contract_start_date": "2025-01-01",
            "contract_end_date": "2026-12-31",
            "status": "Aktiv"
        }
        resp3 = requests.post(f"{BASE_URL}/api/companies", json=c3_data, headers=auth_headers)
        if resp3.status_code == 200:
            companies.append(resp3.json())
        
        yield companies
        
        # Cleanup
        for c in companies:
            requests.delete(f"{BASE_URL}/api/companies/{c['id']}", headers=auth_headers)
    
    @pytest.fixture(scope="class")
    def test_event(self, auth_headers):
        """Create test event for sector conflict testing"""
        event_data = {
            "name": "TEST_Sector_Conflict_Event",
            "event_type": "Breakfast",
            "date": "2026-03-15",
            "time": "09:00",
            "venue": "Test Venue",
            "location_link": "https://maps.google.com/test",
            "participant_limit": 20,
            "status": "Planlaşdırılır"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        event = response.json()
        yield event
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=auth_headers)
    
    def test_check_sector_conflict_endpoint_exists(self, auth_headers, test_event, test_companies):
        """Test that check-sector-conflict endpoint exists and works"""
        if not test_companies or len(test_companies) < 2:
            pytest.skip("Not enough test companies created")
        
        event_id = test_event["id"]
        company_id = test_companies[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/check-sector-conflict",
            json={"company_id": company_id},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Check sector conflict failed: {response.text}"
        data = response.json()
        assert "conflict" in data
        print(f"✓ Check sector conflict endpoint works, conflict={data['conflict']}")
    
    def test_sector_conflict_detection(self, auth_headers, test_event, test_companies):
        """Test that sector conflict is detected when adding company from same sector"""
        if not test_companies or len(test_companies) < 2:
            pytest.skip("Not enough test companies created")
        
        event_id = test_event["id"]
        
        # First, add company 1 (İnşaat sector) to the event
        inv_data = {
            "event_id": event_id,
            "event_name": test_event["name"],
            "event_type": test_event["event_type"],
            "event_date": test_event["date"],
            "company_id": test_companies[0]["id"],
            "company_name": test_companies[0]["brand_name"]
        }
        inv_resp = requests.post(f"{BASE_URL}/api/invitations", json=inv_data, headers=auth_headers)
        assert inv_resp.status_code == 200, f"Create invitation failed: {inv_resp.text}"
        inv_id = inv_resp.json()["id"]
        print(f"✓ Added first company (İnşaat sector) to event")
        
        # Now check if company 2 (same İnşaat sector) has conflict
        conflict_resp = requests.post(
            f"{BASE_URL}/api/events/{event_id}/check-sector-conflict",
            json={"company_id": test_companies[1]["id"]},
            headers=auth_headers
        )
        assert conflict_resp.status_code == 200
        conflict_data = conflict_resp.json()
        
        # Should detect conflict since both are İnşaat/Tikinti
        assert conflict_data["conflict"] == True, f"Expected conflict=True, got {conflict_data}"
        assert "conflicting_company" in conflict_data
        assert "conflict_type" in conflict_data
        assert "conflict_value" in conflict_data
        print(f"✓ Sector conflict detected: {conflict_data['conflicting_company']} ({conflict_data['conflict_value']})")
        
        # Cleanup invitation
        requests.delete(f"{BASE_URL}/api/invitations/{inv_id}", headers=auth_headers)
    
    def test_no_conflict_different_sector(self, auth_headers, test_event, test_companies):
        """Test that no conflict when adding company from different sector"""
        if not test_companies or len(test_companies) < 3:
            pytest.skip("Not enough test companies created")
        
        event_id = test_event["id"]
        
        # Add company 1 (İnşaat sector)
        inv_data = {
            "event_id": event_id,
            "event_name": test_event["name"],
            "event_type": test_event["event_type"],
            "event_date": test_event["date"],
            "company_id": test_companies[0]["id"],
            "company_name": test_companies[0]["brand_name"]
        }
        inv_resp = requests.post(f"{BASE_URL}/api/invitations", json=inv_data, headers=auth_headers)
        inv_id = inv_resp.json()["id"]
        
        # Check company 3 (İKT sector) - should NOT conflict
        conflict_resp = requests.post(
            f"{BASE_URL}/api/events/{event_id}/check-sector-conflict",
            json={"company_id": test_companies[2]["id"]},
            headers=auth_headers
        )
        assert conflict_resp.status_code == 200
        conflict_data = conflict_resp.json()
        
        assert conflict_data["conflict"] == False, f"Expected no conflict for different sector, got {conflict_data}"
        print(f"✓ No conflict for different sector (İKT vs İnşaat)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/invitations/{inv_id}", headers=auth_headers)
    
    def test_auto_suggest_filters_by_sector(self, auth_headers, test_event, test_companies):
        """Test that auto-suggest filters companies by sector (1 per sector)"""
        if not test_companies or len(test_companies) < 2:
            pytest.skip("Not enough test companies created")
        
        event_id = test_event["id"]
        
        # Call auto-suggest
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/auto-suggest",
            json={"count": 50},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Auto-suggest failed: {response.text}"
        data = response.json()
        
        assert "suggestions" in data
        suggestions = data["suggestions"]
        print(f"✓ Auto-suggest returned {len(suggestions)} suggestions")
        
        # Check that only 1 company per sector/sub_sector
        seen_sectors = {}
        for s in suggestions:
            sector_key = (s.get("sub_sector") or s.get("sector") or "").strip().lower()
            if sector_key:
                if sector_key in seen_sectors:
                    pytest.fail(f"Duplicate sector found: {sector_key} - companies: {seen_sectors[sector_key]} and {s['company_name']}")
                seen_sectors[sector_key] = s["company_name"]
        
        print(f"✓ Auto-suggest correctly filters by sector (1 per sector)")


class TestInvitationCallStatus:
    """Test invitation call status and obligation deduction"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_call_status_cavab_verdi_deducts_obligation(self, auth_headers):
        """Test that 'Cavab verdi' (answered) deducts obligation"""
        # Create test event
        event_resp = requests.post(f"{BASE_URL}/api/events", json={
            "name": "TEST_Call_Status_Event",
            "event_type": "Breakfast",
            "date": "2026-04-01",
            "participant_limit": 10
        }, headers=auth_headers)
        event = event_resp.json()
        
        # Get a company
        companies_resp = requests.get(f"{BASE_URL}/api/options/companies", headers=auth_headers)
        companies = companies_resp.json()
        if not companies:
            pytest.skip("No companies available")
        company = companies[0]
        
        # Create invitation
        inv_resp = requests.post(f"{BASE_URL}/api/invitations", json={
            "event_id": event["id"],
            "event_name": event["name"],
            "event_type": event["event_type"],
            "event_date": event["date"],
            "company_id": company["id"],
            "company_name": company["brand_name"]
        }, headers=auth_headers)
        inv = inv_resp.json()
        
        # Update call status to "Cavab verdi" with "Qatılır"
        call_resp = requests.put(
            f"{BASE_URL}/api/invitations/{inv['id']}/call",
            json={"call_status": "Cavab verdi", "participation_status": "Qatılır"},
            headers=auth_headers
        )
        assert call_resp.status_code == 200
        updated_inv = call_resp.json()
        
        assert updated_inv["call_status"] == "Cavab verdi"
        assert updated_inv["participation_status"] == "Qatılır"
        assert updated_inv["obligation_deducted"] == True
        print(f"✓ 'Cavab verdi' + 'Qatılır' correctly deducts obligation")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/invitations/{inv['id']}", headers=auth_headers)
        requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=auth_headers)
    
    def test_call_status_cavab_vermedi_no_deduction(self, auth_headers):
        """Test that 'Cavab vermədi' (no answer) does NOT deduct obligation"""
        # Create test event
        event_resp = requests.post(f"{BASE_URL}/api/events", json={
            "name": "TEST_No_Answer_Event",
            "event_type": "Mafia",
            "date": "2026-04-02",
            "participant_limit": 10
        }, headers=auth_headers)
        event = event_resp.json()
        
        # Get a company
        companies_resp = requests.get(f"{BASE_URL}/api/options/companies", headers=auth_headers)
        companies = companies_resp.json()
        if not companies:
            pytest.skip("No companies available")
        company = companies[0]
        
        # Create invitation
        inv_resp = requests.post(f"{BASE_URL}/api/invitations", json={
            "event_id": event["id"],
            "event_name": event["name"],
            "event_type": event["event_type"],
            "event_date": event["date"],
            "company_id": company["id"],
            "company_name": company["brand_name"]
        }, headers=auth_headers)
        inv = inv_resp.json()
        
        # Update call status to "Cavab vermədi"
        call_resp = requests.put(
            f"{BASE_URL}/api/invitations/{inv['id']}/call",
            json={"call_status": "Cavab vermədi"},
            headers=auth_headers
        )
        assert call_resp.status_code == 200
        updated_inv = call_resp.json()
        
        assert updated_inv["call_status"] == "Cavab vermədi"
        assert updated_inv["obligation_deducted"] == False
        print(f"✓ 'Cavab vermədi' correctly does NOT deduct obligation")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/invitations/{inv['id']}", headers=auth_headers)
        requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=auth_headers)


class TestEventCRUD:
    """Test basic event CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_event(self, auth_headers):
        """Test creating an event"""
        event_data = {
            "name": "TEST_CRUD_Event",
            "event_type": "B2B görüş",
            "date": "2026-05-01",
            "time": "14:00",
            "venue": "Conference Room",
            "location_link": "https://maps.google.com/crud-test",
            "participant_limit": 25,
            "status": "Planlaşdırılır"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=event_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_CRUD_Event"
        assert data["event_type"] == "B2B görüş"
        assert data["location_link"] == "https://maps.google.com/crud-test"
        print(f"✓ Event created: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{data['id']}", headers=auth_headers)
    
    def test_update_event(self, auth_headers):
        """Test updating an event"""
        # Create
        event_resp = requests.post(f"{BASE_URL}/api/events", json={
            "name": "TEST_Update_Event",
            "event_type": "Təlim",
            "date": "2026-05-10",
            "participant_limit": 30
        }, headers=auth_headers)
        event = event_resp.json()
        
        # Update
        update_resp = requests.put(f"{BASE_URL}/api/events/{event['id']}", json={
            "name": "TEST_Updated_Event",
            "venue": "New Venue",
            "location_link": "https://maps.google.com/new-location"
        }, headers=auth_headers)
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["name"] == "TEST_Updated_Event"
        assert updated["venue"] == "New Venue"
        assert updated["location_link"] == "https://maps.google.com/new-location"
        print(f"✓ Event updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=auth_headers)
    
    def test_delete_event(self, auth_headers):
        """Test deleting an event"""
        # Create
        event_resp = requests.post(f"{BASE_URL}/api/events", json={
            "name": "TEST_Delete_Event",
            "event_type": "Sosial fəaliyyət",
            "date": "2026-05-15",
            "participant_limit": 50
        }, headers=auth_headers)
        event = event_resp.json()
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=auth_headers)
        assert delete_resp.status_code == 200
        
        # Verify deleted
        get_resp = requests.get(f"{BASE_URL}/api/events/{event['id']}", headers=auth_headers)
        assert get_resp.status_code == 404
        print(f"✓ Event deleted successfully")


# Cleanup function to remove test data
def cleanup_test_data():
    """Remove all TEST_ prefixed data"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "settings@marsol.az",
        "password": "marsol123"
    })
    if response.status_code != 200:
        return
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Cleanup events
    events_resp = requests.get(f"{BASE_URL}/api/events", headers=headers)
    if events_resp.status_code == 200:
        for event in events_resp.json():
            if event.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/events/{event['id']}", headers=headers)
    
    # Cleanup companies
    companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=headers)
    if companies_resp.status_code == 200:
        for company in companies_resp.json():
            if company.get("brand_name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/companies/{company['id']}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
