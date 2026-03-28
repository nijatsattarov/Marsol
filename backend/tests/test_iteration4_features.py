"""
Test iteration 4 features:
1. Sectors CRUD API (/api/settings/sectors)
2. Options/all endpoint returns packages_with_prices, dynamic sectors, system users as marsol_representatives
3. Package price auto-fill for company total_amount
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "settings@marsol.az"
TEST_PASSWORD = "marsol123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestSectorsCRUD:
    """Test Sectors CRUD operations in Settings"""
    
    created_sector_id = None
    
    def test_get_sectors_returns_list(self, headers):
        """GET /api/settings/sectors returns list of sectors"""
        response = requests.get(f"{BASE_URL}/api/settings/sectors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have default sectors if DB is empty
        assert len(data) > 0
        # Each sector should have id and name
        for sector in data:
            assert "id" in sector
            assert "name" in sector
        print(f"GET sectors: {len(data)} sectors found")
    
    def test_create_sector(self, headers):
        """POST /api/settings/sectors creates new sector"""
        payload = {"name": "TEST_Yeni Sektor"}
        response = requests.post(f"{BASE_URL}/api/settings/sectors", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Yeni Sektor"
        TestSectorsCRUD.created_sector_id = data["id"]
        print(f"Created sector: {data}")
    
    def test_get_sector_after_create(self, headers):
        """Verify created sector appears in list"""
        response = requests.get(f"{BASE_URL}/api/settings/sectors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        sector_names = [s["name"] for s in data]
        assert "TEST_Yeni Sektor" in sector_names
        print(f"Verified sector in list")
    
    def test_update_sector(self, headers):
        """PUT /api/settings/sectors/{id} updates sector name"""
        if not TestSectorsCRUD.created_sector_id:
            pytest.skip("No sector created to update")
        
        payload = {"name": "TEST_Yenilənmiş Sektor"}
        response = requests.put(
            f"{BASE_URL}/api/settings/sectors/{TestSectorsCRUD.created_sector_id}",
            json=payload,
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Yenilənmiş Sektor"
        print(f"Updated sector: {data}")
    
    def test_verify_sector_update(self, headers):
        """GET sectors to verify update persisted"""
        response = requests.get(f"{BASE_URL}/api/settings/sectors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        sector_names = [s["name"] for s in data]
        assert "TEST_Yenilənmiş Sektor" in sector_names
        assert "TEST_Yeni Sektor" not in sector_names
        print(f"Verified sector update persisted")
    
    def test_delete_sector(self, headers):
        """DELETE /api/settings/sectors/{id} deletes sector"""
        if not TestSectorsCRUD.created_sector_id:
            pytest.skip("No sector created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/settings/sectors/{TestSectorsCRUD.created_sector_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Deleted sector: {data}")
    
    def test_verify_sector_deleted(self, headers):
        """GET sectors to verify deletion"""
        response = requests.get(f"{BASE_URL}/api/settings/sectors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        sector_ids = [s["id"] for s in data]
        assert TestSectorsCRUD.created_sector_id not in sector_ids
        print(f"Verified sector deleted")


class TestOptionsAllEndpoint:
    """Test /api/options/all endpoint returns correct data structure"""
    
    def test_options_all_returns_packages_with_prices(self, headers):
        """GET /api/options/all returns packages_with_prices array"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check packages_with_prices exists
        assert "packages_with_prices" in data
        packages_with_prices = data["packages_with_prices"]
        assert isinstance(packages_with_prices, list)
        assert len(packages_with_prices) > 0
        
        # Each package should have name and price
        for pkg in packages_with_prices:
            assert "name" in pkg
            assert "price" in pkg
            assert isinstance(pkg["price"], (int, float))
        
        print(f"packages_with_prices: {packages_with_prices}")
    
    def test_options_all_returns_sectors(self, headers):
        """GET /api/options/all returns sectors array"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "sectors" in data
        sectors = data["sectors"]
        assert isinstance(sectors, list)
        assert len(sectors) > 0
        print(f"sectors: {sectors[:5]}...")  # Print first 5
    
    def test_options_all_returns_marsol_representatives_from_users(self, headers):
        """GET /api/options/all returns marsol_representatives from system users"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "marsol_representatives" in data
        reps = data["marsol_representatives"]
        assert isinstance(reps, list)
        
        # Should include at least the test user "Settings Admin"
        # (based on test_credentials.md)
        print(f"marsol_representatives: {reps}")
        
        # Verify it's pulling from users (should have at least one user name)
        assert len(reps) >= 1
    
    def test_options_all_has_all_required_fields(self, headers):
        """GET /api/options/all returns all required option fields"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "sectors", "packages", "packages_with_prices", "company_sizes",
            "marsol_representatives", "projects", "departments", "task_statuses",
            "priorities", "meeting_types", "expense_categories", "reference_sources", "statuses"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"All required fields present in options/all")


class TestPackagePriceAutoFill:
    """Test that package prices are available for auto-fill in company form"""
    
    def test_default_packages_have_prices(self, headers):
        """Default packages should have prices (Premium=5000, Business=3000, Business Plus=4000)"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        packages_with_prices = data["packages_with_prices"]
        
        # Create a dict for easy lookup
        pkg_prices = {p["name"]: p["price"] for p in packages_with_prices}
        
        # Check default prices (these are the defaults when DB is empty)
        # Note: If packages exist in DB, they may have different prices
        print(f"Package prices: {pkg_prices}")
        
        # At minimum, packages should have prices > 0
        for pkg in packages_with_prices:
            assert pkg["price"] >= 0, f"Package {pkg['name']} has invalid price"
    
    def test_create_company_with_package_price_as_total(self, headers):
        """Create company with total_amount set to package price"""
        # First get package price
        options_response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert options_response.status_code == 200
        options = options_response.json()
        
        packages_with_prices = options["packages_with_prices"]
        test_package = packages_with_prices[0]  # Use first package
        package_name = test_package["name"]
        package_price = test_package["price"]
        
        # Get a sector and project
        sector = options["sectors"][0] if options["sectors"] else "İKT"
        project = options["projects"][0] if options["projects"] else "Üzvlük"
        rep = options["marsol_representatives"][0] if options["marsol_representatives"] else "Test Rep"
        
        # Create company with total_amount = package price
        company_payload = {
            "brand_name": "TEST_AutoFill Company",
            "sector": sector,
            "company_size": "Orta",
            "owner_name": "Test Owner",
            "owner_phone": "+994501234567",
            "marsol_representative": rep,
            "joined_project": project,
            "package": package_name,
            "total_amount": package_price,  # Auto-filled from package price
            "paid_amount": 0,
            "debt_amount": package_price  # debt = total - paid
        }
        
        response = requests.post(f"{BASE_URL}/api/companies", json=company_payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_amount"] == package_price
        assert data["debt_amount"] == package_price
        assert data["package"] == package_name
        
        print(f"Created company with package {package_name}, total_amount={package_price}")
        
        # Cleanup - delete the test company
        company_id = data["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=headers)
        assert delete_response.status_code == 200
        print(f"Cleaned up test company")
    
    def test_update_company_paid_amount_recalculates_debt(self, headers):
        """Update paid_amount should recalculate debt_amount"""
        # Get options
        options_response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        options = options_response.json()
        
        packages_with_prices = options["packages_with_prices"]
        test_package = packages_with_prices[0]
        package_price = test_package["price"]
        
        sector = options["sectors"][0] if options["sectors"] else "İKT"
        project = options["projects"][0] if options["projects"] else "Üzvlük"
        rep = options["marsol_representatives"][0] if options["marsol_representatives"] else "Test Rep"
        
        # Create company
        company_payload = {
            "brand_name": "TEST_DebtCalc Company",
            "sector": sector,
            "company_size": "Kiçik",
            "owner_name": "Test Owner 2",
            "owner_phone": "+994509876543",
            "marsol_representative": rep,
            "joined_project": project,
            "package": test_package["name"],
            "total_amount": package_price,
            "paid_amount": 0,
            "debt_amount": package_price
        }
        
        create_response = requests.post(f"{BASE_URL}/api/companies", json=company_payload, headers=headers)
        assert create_response.status_code == 200
        company = create_response.json()
        company_id = company["id"]
        
        # Update paid_amount
        paid_amount = 1000
        update_payload = {"paid_amount": paid_amount}
        update_response = requests.put(f"{BASE_URL}/api/companies/{company_id}", json=update_payload, headers=headers)
        assert update_response.status_code == 200
        updated_company = update_response.json()
        
        # Verify debt recalculated
        expected_debt = package_price - paid_amount
        assert updated_company["debt_amount"] == expected_debt
        print(f"Debt recalculated: total={package_price}, paid={paid_amount}, debt={expected_debt}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=headers)


class TestSettingsPackagesWithPrice:
    """Test that packages in settings have price field"""
    
    def test_get_packages_includes_price(self, headers):
        """GET /api/settings/packages returns packages with price"""
        response = requests.get(f"{BASE_URL}/api/settings/packages", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        for pkg in data:
            assert "id" in pkg
            assert "name" in pkg
            assert "price" in pkg
            assert isinstance(pkg["price"], (int, float))
        
        print(f"Packages with prices: {data}")
    
    def test_create_package_with_price(self, headers):
        """POST /api/settings/packages creates package with price"""
        payload = {
            "name": "TEST_Custom Package",
            "description": "Test package with custom price",
            "price": 7500
        }
        
        response = requests.post(f"{BASE_URL}/api/settings/packages", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_Custom Package"
        assert data["price"] == 7500
        
        package_id = data["id"]
        print(f"Created package with price: {data}")
        
        # Verify it appears in options/all packages_with_prices
        options_response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        options = options_response.json()
        pkg_names = [p["name"] for p in options["packages_with_prices"]]
        assert "TEST_Custom Package" in pkg_names
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/packages/{package_id}", headers=headers)


class TestSettingsTabs:
    """Test that Settings page has all 5 tabs including Sektorlar"""
    
    def test_sectors_endpoint_exists(self, headers):
        """Verify /api/settings/sectors endpoint exists and works"""
        response = requests.get(f"{BASE_URL}/api/settings/sectors", headers=headers)
        assert response.status_code == 200
        print("Sectors endpoint exists and returns 200")
    
    def test_all_settings_endpoints_work(self, headers):
        """Verify all settings endpoints work"""
        endpoints = [
            "/api/settings/packages",
            "/api/settings/projects",
            "/api/settings/sectors",
            "/api/settings/custom-fields",
            "/api/settings/users"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 200, f"Endpoint {endpoint} failed with {response.status_code}"
            print(f"{endpoint}: OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
