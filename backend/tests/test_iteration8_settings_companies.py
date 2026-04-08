"""
Iteration 8 - Testing Settings (Sub-sectors, Positions, Activities) and Companies Module
Tests for:
1. Settings - Alt Sektorlar (Sub-sectors) CRUD
2. Settings - Vəzifələr (Positions) CRUD
3. Settings - Fəaliyyətlər (Activities) CRUD
4. /api/options/all returns sub_sectors, positions, activities, education_levels
5. /api/upload endpoint for file uploads
6. Companies CRUD with new fields (VOEN, sub_sector, region, employee_count, etc.)
"""

import pytest
import requests
import os
import uuid

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
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestOptionsAll(TestAuth):
    """Test /api/options/all endpoint returns all required fields"""
    
    def test_options_all_returns_sub_sectors(self, headers):
        """Test that /api/options/all returns sub_sectors field"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "sub_sectors" in data, "sub_sectors field missing from /api/options/all"
        assert isinstance(data["sub_sectors"], dict), "sub_sectors should be a dict (sector -> list of sub-sectors)"
    
    def test_options_all_returns_positions(self, headers):
        """Test that /api/options/all returns positions field"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "positions" in data, "positions field missing from /api/options/all"
        assert isinstance(data["positions"], list), "positions should be a list"
    
    def test_options_all_returns_activities(self, headers):
        """Test that /api/options/all returns activities field"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data, "activities field missing from /api/options/all"
        assert isinstance(data["activities"], list), "activities should be a list"
    
    def test_options_all_returns_education_levels(self, headers):
        """Test that /api/options/all returns education_levels field"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "education_levels" in data, "education_levels field missing from /api/options/all"
        assert isinstance(data["education_levels"], list), "education_levels should be a list"
        # Check default education levels
        expected_levels = ["Orta təhsil", "Sub bakalavr", "Bakalavr", "Magistratura", "Doktorantura"]
        for level in expected_levels:
            assert level in data["education_levels"], f"Education level '{level}' missing"
    
    def test_options_all_returns_sectors(self, headers):
        """Test that /api/options/all returns sectors field"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "sectors" in data, "sectors field missing from /api/options/all"
        assert isinstance(data["sectors"], list), "sectors should be a list"


class TestSectors(TestAuth):
    """Test Sectors CRUD - needed for sub-sectors"""
    
    def test_get_sectors(self, headers):
        """Test GET /api/settings/sectors"""
        response = requests.get(f"{BASE_URL}/api/settings/sectors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_sector(self, headers):
        """Test POST /api/settings/sectors"""
        sector_name = f"TEST_Sector_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/settings/sectors", 
                                headers=headers, 
                                json={"name": sector_name})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sector_name
        assert "id" in data
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/sectors/{data['id']}", headers=headers)


class TestSubSectors(TestAuth):
    """Test Sub-sectors CRUD"""
    
    @pytest.fixture(scope="class")
    def test_sector(self, headers):
        """Create a test sector for sub-sector tests"""
        sector_name = f"TEST_ParentSector_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/settings/sectors", 
                                headers=headers, 
                                json={"name": sector_name})
        assert response.status_code == 200
        sector = response.json()
        yield sector
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/sectors/{sector['id']}", headers=headers)
    
    def test_get_sub_sectors(self, headers):
        """Test GET /api/settings/sub-sectors"""
        response = requests.get(f"{BASE_URL}/api/settings/sub-sectors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_sub_sector(self, headers, test_sector):
        """Test POST /api/settings/sub-sectors"""
        sub_sector_name = f"TEST_SubSector_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/settings/sub-sectors", 
                                headers=headers, 
                                json={"name": sub_sector_name, "sector": test_sector["name"]})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sub_sector_name
        assert data["sector"] == test_sector["name"]
        assert "id" in data
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/sub-sectors/{data['id']}", headers=headers)
    
    def test_update_sub_sector(self, headers, test_sector):
        """Test PUT /api/settings/sub-sectors/{id}"""
        # Create
        sub_sector_name = f"TEST_SubSector_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/settings/sub-sectors", 
                                   headers=headers, 
                                   json={"name": sub_sector_name, "sector": test_sector["name"]})
        assert create_resp.status_code == 200
        sub_sector = create_resp.json()
        
        # Update
        new_name = f"TEST_Updated_{uuid.uuid4().hex[:6]}"
        update_resp = requests.put(f"{BASE_URL}/api/settings/sub-sectors/{sub_sector['id']}", 
                                  headers=headers, 
                                  json={"name": new_name})
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["name"] == new_name
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/sub-sectors/{sub_sector['id']}", headers=headers)
    
    def test_delete_sub_sector(self, headers, test_sector):
        """Test DELETE /api/settings/sub-sectors/{id}"""
        # Create
        sub_sector_name = f"TEST_SubSector_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/settings/sub-sectors", 
                                   headers=headers, 
                                   json={"name": sub_sector_name, "sector": test_sector["name"]})
        assert create_resp.status_code == 200
        sub_sector = create_resp.json()
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/settings/sub-sectors/{sub_sector['id']}", headers=headers)
        assert delete_resp.status_code == 200
    
    def test_sub_sectors_appear_in_options_all(self, headers, test_sector):
        """Test that created sub-sectors appear in /api/options/all"""
        # Create a sub-sector
        sub_sector_name = f"TEST_SubSector_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/settings/sub-sectors", 
                                   headers=headers, 
                                   json={"name": sub_sector_name, "sector": test_sector["name"]})
        assert create_resp.status_code == 200
        sub_sector = create_resp.json()
        
        # Check options/all
        options_resp = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert options_resp.status_code == 200
        options = options_resp.json()
        
        # Verify sub_sectors dict contains our sector with our sub-sector
        assert test_sector["name"] in options["sub_sectors"], f"Sector {test_sector['name']} not in sub_sectors"
        assert sub_sector_name in options["sub_sectors"][test_sector["name"]], f"Sub-sector {sub_sector_name} not found"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/sub-sectors/{sub_sector['id']}", headers=headers)


class TestPositions(TestAuth):
    """Test Positions CRUD"""
    
    def test_get_positions(self, headers):
        """Test GET /api/settings/positions"""
        response = requests.get(f"{BASE_URL}/api/settings/positions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_position(self, headers):
        """Test POST /api/settings/positions"""
        position_name = f"TEST_Position_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/settings/positions", 
                                headers=headers, 
                                json={"name": position_name})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == position_name
        assert "id" in data
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/positions/{data['id']}", headers=headers)
    
    def test_delete_position(self, headers):
        """Test DELETE /api/settings/positions/{id}"""
        # Create
        position_name = f"TEST_Position_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/settings/positions", 
                                   headers=headers, 
                                   json={"name": position_name})
        assert create_resp.status_code == 200
        position = create_resp.json()
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/settings/positions/{position['id']}", headers=headers)
        assert delete_resp.status_code == 200
    
    def test_positions_appear_in_options_all(self, headers):
        """Test that created positions appear in /api/options/all"""
        # Create a position
        position_name = f"TEST_Position_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/settings/positions", 
                                   headers=headers, 
                                   json={"name": position_name})
        assert create_resp.status_code == 200
        position = create_resp.json()
        
        # Check options/all
        options_resp = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert options_resp.status_code == 200
        options = options_resp.json()
        
        assert position_name in options["positions"], f"Position {position_name} not found in options"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/positions/{position['id']}", headers=headers)


class TestActivities(TestAuth):
    """Test Activities CRUD"""
    
    def test_get_activities(self, headers):
        """Test GET /api/settings/activities"""
        response = requests.get(f"{BASE_URL}/api/settings/activities", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_activity(self, headers):
        """Test POST /api/settings/activities"""
        activity_name = f"TEST_Activity_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/settings/activities", 
                                headers=headers, 
                                json={"name": activity_name})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == activity_name
        assert "id" in data
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/activities/{data['id']}", headers=headers)
    
    def test_delete_activity(self, headers):
        """Test DELETE /api/settings/activities/{id}"""
        # Create
        activity_name = f"TEST_Activity_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/settings/activities", 
                                   headers=headers, 
                                   json={"name": activity_name})
        assert create_resp.status_code == 200
        activity = create_resp.json()
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/settings/activities/{activity['id']}", headers=headers)
        assert delete_resp.status_code == 200
    
    def test_activities_appear_in_options_all(self, headers):
        """Test that created activities appear in /api/options/all"""
        # Create an activity
        activity_name = f"TEST_Activity_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/settings/activities", 
                                   headers=headers, 
                                   json={"name": activity_name})
        assert create_resp.status_code == 200
        activity = create_resp.json()
        
        # Check options/all
        options_resp = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert options_resp.status_code == 200
        options = options_resp.json()
        
        assert activity_name in options["activities"], f"Activity {activity_name} not found in options"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/activities/{activity['id']}", headers=headers)


class TestFileUpload(TestAuth):
    """Test file upload endpoint"""
    
    def test_upload_file(self, auth_token):
        """Test POST /api/upload"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Create a simple test file
        files = {'file': ('test_logo.png', b'fake image content', 'image/png')}
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "filename" in data
        assert data["url"].startswith("/uploads/")


class TestCompanies(TestAuth):
    """Test Companies CRUD with new fields"""
    
    def test_get_companies(self, headers):
        """Test GET /api/companies"""
        response = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_company_with_new_fields(self, headers):
        """Test POST /api/companies with VOEN, sub_sector, region, employee_count"""
        company_data = {
            "brand_name": f"TEST_Company_{uuid.uuid4().hex[:6]}",
            "legal_name": "Test Legal Name",
            "voen": "1234567890",
            "sector": "İKT",
            "sub_sector": "Proqram təminatı",
            "company_size": "Kiçik",
            "employee_count": "25",
            "region": "Bakı",
            "registration_date": "2024-01-15",
            "address": "Test Address",
            "company_phone": "+994501234567",
            "owner_name": "Test Owner",
            "owner_phone": "+994501234568",
            "marsol_representative": "Settings Admin",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "total_amount": 5000,
            "paid_amount": 2000,
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        assert data["brand_name"] == company_data["brand_name"]
        assert data["voen"] == "1234567890"
        assert data["sub_sector"] == "Proqram təminatı"
        assert data["region"] == "Bakı"
        assert data["employee_count"] == "25"
        assert "id" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{data['id']}", headers=headers)
    
    def test_create_company_with_owners_array(self, headers):
        """Test POST /api/companies with multiple owners"""
        company_data = {
            "brand_name": f"TEST_MultiOwner_{uuid.uuid4().hex[:6]}",
            "sector": "İKT",
            "company_size": "Orta",
            "owner_name": "Primary Owner",
            "owner_phone": "+994501234567",
            "marsol_representative": "Settings Admin",
            "joined_project": "Üzvlük",
            "package": "Business",
            "owners": [
                {
                    "first_name": "Owner1",
                    "last_name": "Test",
                    "phone": "+994501111111",
                    "email": "owner1@test.com",
                    "position": "Direktor",
                    "education": "Bakalavr"
                },
                {
                    "first_name": "Owner2",
                    "last_name": "Test",
                    "phone": "+994502222222",
                    "email": "owner2@test.com",
                    "position": "Təsisçi"
                }
            ],
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        
        # Verify owners array is stored
        get_resp = requests.get(f"{BASE_URL}/api/companies/{data['id']}", headers=headers)
        assert get_resp.status_code == 200
        company = get_resp.json()
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{data['id']}", headers=headers)
    
    def test_create_company_with_contracts_array(self, headers):
        """Test POST /api/companies with multiple contracts"""
        company_data = {
            "brand_name": f"TEST_MultiContract_{uuid.uuid4().hex[:6]}",
            "sector": "Maliyyə",
            "company_size": "Böyük",
            "owner_name": "Contract Owner",
            "owner_phone": "+994501234567",
            "marsol_representative": "Settings Admin",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "contracts": [
                {
                    "project": "Üzvlük",
                    "package": "Premium",
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "total_amount": 5000
                },
                {
                    "project": "Sərgi",
                    "package": "Business",
                    "start_date": "2024-06-01",
                    "end_date": "2024-06-30",
                    "total_amount": 3000
                }
            ],
            "total_amount": 8000,
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{data['id']}", headers=headers)
    
    def test_get_company_by_id(self, headers):
        """Test GET /api/companies/{id}"""
        # Create
        company_data = {
            "brand_name": f"TEST_GetById_{uuid.uuid4().hex[:6]}",
            "sector": "Təhsil",
            "company_size": "Mikro",
            "owner_name": "Test Owner",
            "owner_phone": "+994501234567",
            "marsol_representative": "Settings Admin",
            "joined_project": "Təlim/Proqram",
            "package": "Business"
        }
        create_resp = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert create_resp.status_code == 200
        company = create_resp.json()
        
        # Get by ID
        get_resp = requests.get(f"{BASE_URL}/api/companies/{company['id']}", headers=headers)
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched["brand_name"] == company_data["brand_name"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company['id']}", headers=headers)
    
    def test_update_company(self, headers):
        """Test PUT /api/companies/{id}"""
        # Create
        company_data = {
            "brand_name": f"TEST_Update_{uuid.uuid4().hex[:6]}",
            "sector": "Qida",
            "company_size": "Kiçik",
            "owner_name": "Test Owner",
            "owner_phone": "+994501234567",
            "marsol_representative": "Settings Admin",
            "joined_project": "Üzvlük",
            "package": "Business"
        }
        create_resp = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert create_resp.status_code == 200
        company = create_resp.json()
        
        # Update
        update_data = {
            "brand_name": f"TEST_Updated_{uuid.uuid4().hex[:6]}",
            "voen": "9876543210",
            "region": "Gəncə"
        }
        update_resp = requests.put(f"{BASE_URL}/api/companies/{company['id']}", headers=headers, json=update_data)
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["voen"] == "9876543210"
        assert updated["region"] == "Gəncə"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company['id']}", headers=headers)
    
    def test_delete_company(self, headers):
        """Test DELETE /api/companies/{id}"""
        # Create
        company_data = {
            "brand_name": f"TEST_Delete_{uuid.uuid4().hex[:6]}",
            "sector": "Logistika",
            "company_size": "Orta",
            "owner_name": "Test Owner",
            "owner_phone": "+994501234567",
            "marsol_representative": "Settings Admin",
            "joined_project": "Üzvlük",
            "package": "Premium"
        }
        create_resp = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert create_resp.status_code == 200
        company = create_resp.json()
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/companies/{company['id']}", headers=headers)
        assert delete_resp.status_code == 200
        
        # Verify deleted
        get_resp = requests.get(f"{BASE_URL}/api/companies/{company['id']}", headers=headers)
        assert get_resp.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
