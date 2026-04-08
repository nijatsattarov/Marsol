"""
Iteration 9 Tests - Regions CRUD, Per-Contract Payments, Reference Source Enhancement
Tests for:
1. GET /api/settings/regions - returns default regions list
2. POST /api/settings/regions - creates new region
3. DELETE /api/settings/regions/{id} - deletes region
4. GET /api/options/all - returns regions array and updated reference_sources
5. Companies with per-contract payment data
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
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestRegionsCRUD(TestAuth):
    """Test Regions CRUD operations"""
    
    def test_get_regions_returns_list(self, headers):
        """GET /api/settings/regions returns list of regions"""
        response = requests.get(f"{BASE_URL}/api/settings/regions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/settings/regions returns {len(data)} regions")
    
    def test_get_regions_has_default_regions(self, headers):
        """GET /api/settings/regions returns default regions if empty"""
        response = requests.get(f"{BASE_URL}/api/settings/regions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Check for some expected default regions
        region_names = [r.get("name") for r in data]
        expected_defaults = ["Bakı", "Sumqayıt", "Gəncə"]
        found_defaults = [r for r in expected_defaults if r in region_names]
        print(f"✓ Found default regions: {found_defaults}")
        assert len(found_defaults) > 0 or len(data) > 0, "Should have default regions or existing regions"
    
    def test_create_region(self, headers):
        """POST /api/settings/regions creates new region"""
        response = requests.post(f"{BASE_URL}/api/settings/regions", headers=headers, json={
            "name": "TEST_Region_Quba"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Region_Quba"
        print(f"✓ Created region: {data['name']} with id: {data['id']}")
        return data["id"]
    
    def test_created_region_appears_in_list(self, headers):
        """Created region appears in GET /api/settings/regions"""
        # First create a region
        create_response = requests.post(f"{BASE_URL}/api/settings/regions", headers=headers, json={
            "name": "TEST_Region_Qax"
        })
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]
        
        # Then check it appears in list
        list_response = requests.get(f"{BASE_URL}/api/settings/regions", headers=headers)
        assert list_response.status_code == 200
        regions = list_response.json()
        region_names = [r.get("name") for r in regions]
        assert "TEST_Region_Qax" in region_names
        print(f"✓ Created region appears in list")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/regions/{created_id}", headers=headers)
    
    def test_delete_region(self, headers):
        """DELETE /api/settings/regions/{id} deletes region"""
        # First create a region
        create_response = requests.post(f"{BASE_URL}/api/settings/regions", headers=headers, json={
            "name": "TEST_Region_ToDelete"
        })
        assert create_response.status_code == 200
        region_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/settings/regions/{region_id}", headers=headers)
        assert delete_response.status_code == 200
        print(f"✓ Deleted region with id: {region_id}")
        
        # Verify it's gone
        list_response = requests.get(f"{BASE_URL}/api/settings/regions", headers=headers)
        regions = list_response.json()
        region_ids = [r.get("id") for r in regions]
        assert region_id not in region_ids
        print(f"✓ Deleted region no longer in list")


class TestOptionsAllEndpoint(TestAuth):
    """Test /api/options/all endpoint for new fields"""
    
    def test_options_all_returns_regions(self, headers):
        """GET /api/options/all returns regions array"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "regions" in data
        assert isinstance(data["regions"], list)
        print(f"✓ /api/options/all returns regions: {data['regions'][:5]}...")
    
    def test_options_all_returns_updated_reference_sources(self, headers):
        """GET /api/options/all returns updated reference_sources (Şirkət, Şəxs, Media, Digər)"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "reference_sources" in data
        expected_sources = ["Şirkət", "Şəxs", "Media", "Digər"]
        actual_sources = data["reference_sources"]
        print(f"✓ reference_sources: {actual_sources}")
        for source in expected_sources:
            assert source in actual_sources, f"Missing reference source: {source}"
        print(f"✓ All expected reference sources present: {expected_sources}")
    
    def test_options_all_returns_positions(self, headers):
        """GET /api/options/all returns positions array"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "positions" in data
        assert isinstance(data["positions"], list)
        print(f"✓ /api/options/all returns positions: {data['positions'][:5]}...")
    
    def test_created_region_appears_in_options_all(self, headers):
        """Created region appears in /api/options/all regions"""
        # Create a region
        create_response = requests.post(f"{BASE_URL}/api/settings/regions", headers=headers, json={
            "name": "TEST_Region_Zaqatala"
        })
        assert create_response.status_code == 200
        region_id = create_response.json()["id"]
        
        # Check it appears in options/all
        options_response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert options_response.status_code == 200
        regions = options_response.json().get("regions", [])
        assert "TEST_Region_Zaqatala" in regions
        print(f"✓ Created region appears in /api/options/all")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/regions/{region_id}", headers=headers)


class TestOptionsCompanies(TestAuth):
    """Test /api/options/companies endpoint"""
    
    def test_options_companies_returns_list(self, headers):
        """GET /api/options/companies returns simplified company list"""
        response = requests.get(f"{BASE_URL}/api/options/companies", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ /api/options/companies returns {len(data)} companies")
        if len(data) > 0:
            # Check structure
            company = data[0]
            assert "id" in company
            assert "brand_name" in company
            print(f"✓ Company structure: {list(company.keys())}")


class TestCompanyWithNewFields(TestAuth):
    """Test company creation with new fields (region, reference source details)"""
    
    def test_create_company_with_region(self, headers):
        """POST /api/companies with region field"""
        company_data = {
            "brand_name": "TEST_Company_Region",
            "sector": "İKT",
            "company_size": "Kiçik",
            "region": "Bakı",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        company_id = data["id"]
        print(f"✓ Created company with region: {data.get('region')}")
        
        # Verify region is stored
        get_response = requests.get(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
        assert get_response.status_code == 200
        company = get_response.json()
        assert company.get("region") == "Bakı"
        print(f"✓ Region persisted correctly: {company.get('region')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
    
    def test_create_company_with_reference_source_company(self, headers):
        """POST /api/companies with reference_source='Şirkət' and company reference fields"""
        company_data = {
            "brand_name": "TEST_Company_RefCompany",
            "sector": "İKT",
            "company_size": "Kiçik",
            "region": "Bakı",
            "reference_source": "Şirkət",
            "reference_company_id": "some-company-id",
            "reference_company_name": "Referans Şirkət",
            "reference_person_name": "Əli",
            "reference_person_surname": "Məmmədov",
            "reference_person_position": "Direktor",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        company_id = data["id"]
        print(f"✓ Created company with reference_source='Şirkət'")
        
        # Verify fields are stored
        get_response = requests.get(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
        company = get_response.json()
        assert company.get("reference_source") == "Şirkət"
        assert company.get("reference_company_name") == "Referans Şirkət"
        assert company.get("reference_person_name") == "Əli"
        print(f"✓ Reference source fields persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
    
    def test_create_company_with_reference_source_person(self, headers):
        """POST /api/companies with reference_source='Şəxs' and person reference fields"""
        company_data = {
            "brand_name": "TEST_Company_RefPerson",
            "sector": "İKT",
            "company_size": "Kiçik",
            "region": "Bakı",
            "reference_source": "Şəxs",
            "reference_person_name": "Vüqar",
            "reference_person_surname": "Həsənov",
            "reference_person_position": "Menecer",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        company_id = data["id"]
        print(f"✓ Created company with reference_source='Şəxs'")
        
        # Verify fields are stored
        get_response = requests.get(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
        company = get_response.json()
        assert company.get("reference_source") == "Şəxs"
        assert company.get("reference_person_name") == "Vüqar"
        assert company.get("reference_person_surname") == "Həsənov"
        print(f"✓ Reference person fields persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
    
    def test_create_company_with_reference_source_media(self, headers):
        """POST /api/companies with reference_source='Media' and note field"""
        company_data = {
            "brand_name": "TEST_Company_RefMedia",
            "sector": "İKT",
            "company_size": "Kiçik",
            "region": "Bakı",
            "reference_source": "Media",
            "reference_note": "Instagram reklamı vasitəsilə",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        company_id = data["id"]
        print(f"✓ Created company with reference_source='Media'")
        
        # Verify fields are stored
        get_response = requests.get(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
        company = get_response.json()
        assert company.get("reference_source") == "Media"
        assert company.get("reference_note") == "Instagram reklamı vasitəsilə"
        print(f"✓ Reference note field persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=headers)


class TestCompanyWithContracts(TestAuth):
    """Test company with multiple contracts and per-contract payments"""
    
    def test_create_company_with_multiple_contracts(self, headers):
        """POST /api/companies with multiple contracts array"""
        company_data = {
            "brand_name": "TEST_Company_MultiContract",
            "sector": "İKT",
            "company_size": "Orta",
            "region": "Bakı",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "status": "Aktiv",
            "contracts": [
                {
                    "project": "Üzvlük",
                    "package": "Premium",
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "total_amount": 5000,
                    "paid_amount": 3000,
                    "debt_amount": 2000
                },
                {
                    "project": "Sərgi",
                    "package": "Business",
                    "start_date": "2024-06-01",
                    "end_date": "2024-06-30",
                    "total_amount": 2000,
                    "paid_amount": 2000,
                    "debt_amount": 0
                }
            ],
            "total_amount": 7000,
            "paid_amount": 5000,
            "debt_amount": 2000
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        company_id = data["id"]
        print(f"✓ Created company with multiple contracts")
        
        # Verify contracts are stored
        get_response = requests.get(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
        company = get_response.json()
        assert "contracts" in company
        assert len(company["contracts"]) == 2
        print(f"✓ Company has {len(company['contracts'])} contracts")
        
        # Verify per-contract payment data
        contract1 = company["contracts"][0]
        assert contract1.get("total_amount") == 5000
        assert contract1.get("paid_amount") == 3000
        assert contract1.get("debt_amount") == 2000
        print(f"✓ Contract 1 payment data: total={contract1.get('total_amount')}, paid={contract1.get('paid_amount')}, debt={contract1.get('debt_amount')}")
        
        contract2 = company["contracts"][1]
        assert contract2.get("total_amount") == 2000
        assert contract2.get("paid_amount") == 2000
        assert contract2.get("debt_amount") == 0
        print(f"✓ Contract 2 payment data: total={contract2.get('total_amount')}, paid={contract2.get('paid_amount')}, debt={contract2.get('debt_amount')}")
        
        # Verify grand totals
        assert company.get("total_amount") == 7000
        assert company.get("paid_amount") == 5000
        print(f"✓ Grand totals: total={company.get('total_amount')}, paid={company.get('paid_amount')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
    
    def test_create_company_with_contact_position(self, headers):
        """POST /api/companies with contact_position field"""
        company_data = {
            "brand_name": "TEST_Company_ContactPos",
            "sector": "İKT",
            "company_size": "Kiçik",
            "region": "Bakı",
            "contact_first_name": "Nigar",
            "contact_last_name": "Əliyeva",
            "contact_position": "Direktor",
            "contact_phone": "+994501234567",
            "contact_email": "nigar@test.com",
            "marsol_representative": "Test Rep",
            "joined_project": "Üzvlük",
            "package": "Premium",
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=headers, json=company_data)
        assert response.status_code == 200
        data = response.json()
        company_id = data["id"]
        print(f"✓ Created company with contact position")
        
        # Verify contact position is stored
        get_response = requests.get(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
        company = get_response.json()
        assert company.get("contact_position") == "Direktor"
        print(f"✓ Contact position persisted: {company.get('contact_position')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=headers)


class TestCleanup(TestAuth):
    """Cleanup test data"""
    
    def test_cleanup_test_regions(self, headers):
        """Clean up TEST_ prefixed regions"""
        response = requests.get(f"{BASE_URL}/api/settings/regions", headers=headers)
        if response.status_code == 200:
            regions = response.json()
            for region in regions:
                if region.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/settings/regions/{region['id']}", headers=headers)
                    print(f"✓ Cleaned up region: {region['name']}")
    
    def test_cleanup_test_companies(self, headers):
        """Clean up TEST_ prefixed companies"""
        response = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        if response.status_code == 200:
            companies = response.json()
            for company in companies:
                if company.get("brand_name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/companies/{company['id']}", headers=headers)
                    print(f"✓ Cleaned up company: {company['brand_name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
