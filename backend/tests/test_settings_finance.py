"""
Backend API Tests for Marsol ERP System
Testing: Settings (Packages, Projects, Custom Fields, Users) and Finance (Incomes, Expenses) CRUD
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://marsol-event-gateway.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "settings@marsol.az"
TEST_PASSWORD = "marsol123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ==================== PACKAGES CRUD TESTS ====================
class TestPackagesCRUD:
    """Test /api/settings/packages endpoints"""
    
    created_package_id = None
    
    def test_get_packages(self, headers):
        """GET /api/settings/packages - should return list of packages"""
        response = requests.get(f"{BASE_URL}/api/settings/packages", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET packages returned {len(data)} packages")
    
    def test_create_package(self, headers):
        """POST /api/settings/packages - should create new package"""
        unique_name = f"TEST_Package_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": unique_name,
            "description": "Test package description",
            "price": 1500
        }
        response = requests.post(f"{BASE_URL}/api/settings/packages", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == unique_name
        assert data["price"] == 1500
        assert "id" in data
        TestPackagesCRUD.created_package_id = data["id"]
        print(f"✓ Created package: {data['name']} with id {data['id']}")
    
    def test_update_package(self, headers):
        """PUT /api/settings/packages/{id} - should update package"""
        if not TestPackagesCRUD.created_package_id:
            pytest.skip("No package created to update")
        
        payload = {"name": "TEST_Updated_Package", "price": 2000}
        response = requests.put(
            f"{BASE_URL}/api/settings/packages/{TestPackagesCRUD.created_package_id}",
            json=payload, headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Updated_Package"
        assert data["price"] == 2000
        print(f"✓ Updated package to: {data['name']}")
    
    def test_delete_package(self, headers):
        """DELETE /api/settings/packages/{id} - should delete package"""
        if not TestPackagesCRUD.created_package_id:
            pytest.skip("No package created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/settings/packages/{TestPackagesCRUD.created_package_id}",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted package: {TestPackagesCRUD.created_package_id}")


# ==================== PROJECTS CRUD TESTS ====================
class TestProjectsCRUD:
    """Test /api/settings/projects endpoints"""
    
    created_project_id = None
    
    def test_get_projects(self, headers):
        """GET /api/settings/projects - should return list of projects"""
        response = requests.get(f"{BASE_URL}/api/settings/projects", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET projects returned {len(data)} projects")
    
    def test_create_project(self, headers):
        """POST /api/settings/projects - should create new project"""
        unique_name = f"TEST_Project_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": unique_name,
            "description": "Test project description"
        }
        response = requests.post(f"{BASE_URL}/api/settings/projects", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == unique_name
        assert "id" in data
        TestProjectsCRUD.created_project_id = data["id"]
        print(f"✓ Created project: {data['name']} with id {data['id']}")
    
    def test_update_project(self, headers):
        """PUT /api/settings/projects/{id} - should update project"""
        if not TestProjectsCRUD.created_project_id:
            pytest.skip("No project created to update")
        
        payload = {"name": "TEST_Updated_Project", "description": "Updated description"}
        response = requests.put(
            f"{BASE_URL}/api/settings/projects/{TestProjectsCRUD.created_project_id}",
            json=payload, headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Updated_Project"
        print(f"✓ Updated project to: {data['name']}")
    
    def test_delete_project(self, headers):
        """DELETE /api/settings/projects/{id} - should delete project"""
        if not TestProjectsCRUD.created_project_id:
            pytest.skip("No project created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/settings/projects/{TestProjectsCRUD.created_project_id}",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted project: {TestProjectsCRUD.created_project_id}")


# ==================== CUSTOM FIELDS CRUD TESTS ====================
class TestCustomFieldsCRUD:
    """Test /api/settings/custom-fields endpoints"""
    
    created_field_id = None
    
    def test_get_custom_fields(self, headers):
        """GET /api/settings/custom-fields - should return list of custom fields"""
        response = requests.get(f"{BASE_URL}/api/settings/custom-fields", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET custom-fields returned {len(data)} fields")
    
    def test_create_custom_field(self, headers):
        """POST /api/settings/custom-fields - should create new custom field"""
        unique_name = f"test_field_{uuid.uuid4().hex[:6]}"
        payload = {
            "module": "companies",
            "field_name": unique_name,
            "field_label": "Test Field Label",
            "field_type": "text",
            "required": False,
            "options": []
        }
        response = requests.post(f"{BASE_URL}/api/settings/custom-fields", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["field_name"] == unique_name
        assert data["module"] == "companies"
        assert data["field_type"] == "text"
        assert "id" in data
        TestCustomFieldsCRUD.created_field_id = data["id"]
        print(f"✓ Created custom field: {data['field_name']} with id {data['id']}")
    
    def test_create_select_field_with_options(self, headers):
        """POST /api/settings/custom-fields - should create select field with options"""
        unique_name = f"test_select_{uuid.uuid4().hex[:6]}"
        payload = {
            "module": "finance",
            "field_name": unique_name,
            "field_label": "Test Select Field",
            "field_type": "select",
            "required": True,
            "options": ["Option 1", "Option 2", "Option 3"]
        }
        response = requests.post(f"{BASE_URL}/api/settings/custom-fields", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["field_type"] == "select"
        assert len(data["options"]) == 3
        # Clean up
        requests.delete(f"{BASE_URL}/api/settings/custom-fields/{data['id']}", headers=headers)
        print(f"✓ Created and deleted select field with options")
    
    def test_update_custom_field(self, headers):
        """PUT /api/settings/custom-fields/{id} - should update custom field"""
        if not TestCustomFieldsCRUD.created_field_id:
            pytest.skip("No field created to update")
        
        payload = {"field_label": "Updated Label", "required": True}
        response = requests.put(
            f"{BASE_URL}/api/settings/custom-fields/{TestCustomFieldsCRUD.created_field_id}",
            json=payload, headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["field_label"] == "Updated Label"
        assert data["required"] == True
        print(f"✓ Updated custom field label to: {data['field_label']}")
    
    def test_delete_custom_field(self, headers):
        """DELETE /api/settings/custom-fields/{id} - should delete custom field"""
        if not TestCustomFieldsCRUD.created_field_id:
            pytest.skip("No field created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/settings/custom-fields/{TestCustomFieldsCRUD.created_field_id}",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted custom field: {TestCustomFieldsCRUD.created_field_id}")


# ==================== USER MANAGEMENT CRUD TESTS ====================
class TestUserManagementCRUD:
    """Test /api/settings/users endpoints"""
    
    created_user_id = None
    
    def test_get_users(self, headers):
        """GET /api/settings/users - should return list of users"""
        response = requests.get(f"{BASE_URL}/api/settings/users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify password is not returned
        for user in data:
            assert "password" not in user
        print(f"✓ GET users returned {len(data)} users (passwords excluded)")
    
    def test_create_user(self, headers):
        """POST /api/settings/users - should create new user"""
        unique_email = f"test_{uuid.uuid4().hex[:6]}@marsol.az"
        payload = {
            "name": "Test User",
            "email": unique_email,
            "password": "testpass123",
            "role": "manager",
            "department": "Satış",
            "phone": "+994501234567",
            "status": "Aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/settings/users", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == unique_email
        assert data["role"] == "manager"
        assert "password" not in data  # Password should not be returned
        assert "id" in data
        TestUserManagementCRUD.created_user_id = data["id"]
        print(f"✓ Created user: {data['email']} with role {data['role']}")
    
    def test_create_user_duplicate_email(self, headers):
        """POST /api/settings/users - should fail for duplicate email"""
        payload = {
            "name": "Duplicate User",
            "email": TEST_EMAIL,  # Already exists
            "password": "testpass123",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/settings/users", json=payload, headers=headers)
        assert response.status_code == 400
        print(f"✓ Duplicate email correctly rejected")
    
    def test_update_user(self, headers):
        """PUT /api/settings/users/{id} - should update user"""
        if not TestUserManagementCRUD.created_user_id:
            pytest.skip("No user created to update")
        
        payload = {"name": "Updated Test User", "role": "admin", "department": "İT"}
        response = requests.put(
            f"{BASE_URL}/api/settings/users/{TestUserManagementCRUD.created_user_id}",
            json=payload, headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Test User"
        assert data["role"] == "admin"
        print(f"✓ Updated user to: {data['name']} with role {data['role']}")
    
    def test_update_user_password(self, headers):
        """PUT /api/settings/users/{id} - should update user password"""
        if not TestUserManagementCRUD.created_user_id:
            pytest.skip("No user created to update")
        
        payload = {"password": "newpassword123"}
        response = requests.put(
            f"{BASE_URL}/api/settings/users/{TestUserManagementCRUD.created_user_id}",
            json=payload, headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Updated user password successfully")
    
    def test_delete_user(self, headers):
        """DELETE /api/settings/users/{id} - should delete user"""
        if not TestUserManagementCRUD.created_user_id:
            pytest.skip("No user created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/settings/users/{TestUserManagementCRUD.created_user_id}",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted user: {TestUserManagementCRUD.created_user_id}")


# ==================== FINANCE INCOMES CRUD TESTS ====================
class TestFinanceIncomesCRUD:
    """Test /api/finance/incomes endpoints"""
    
    created_income_id = None
    
    def test_get_incomes(self, headers):
        """GET /api/finance/incomes - should return list of incomes"""
        response = requests.get(f"{BASE_URL}/api/finance/incomes", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET incomes returned {len(data)} incomes")
    
    def test_create_income(self, headers):
        """POST /api/finance/incomes - should create new income"""
        payload = {
            "company_id": "test-company-id",
            "company_name": "TEST_Company",
            "owner_name": "Test Owner",
            "marsol_representative": "Test Rep",
            "project": "Üzvlük",
            "package": "Premium",
            "amount": 5000,
            "paid_amount": 2500,
            "currency": "AZN"
        }
        response = requests.post(f"{BASE_URL}/api/finance/incomes", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == "TEST_Company"
        assert data["amount"] == 5000
        assert data["paid_amount"] == 2500
        assert data["debt_amount"] == 2500  # Auto-calculated
        assert "id" in data
        TestFinanceIncomesCRUD.created_income_id = data["id"]
        print(f"✓ Created income: {data['company_name']} - {data['amount']} AZN")
    
    def test_update_income(self, headers):
        """PUT /api/finance/incomes/{id} - should update income"""
        if not TestFinanceIncomesCRUD.created_income_id:
            pytest.skip("No income created to update")
        
        payload = {"paid_amount": 4000, "amount": 5000}
        response = requests.put(
            f"{BASE_URL}/api/finance/incomes/{TestFinanceIncomesCRUD.created_income_id}",
            json=payload, headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["paid_amount"] == 4000
        assert data["debt_amount"] == 1000  # Recalculated
        print(f"✓ Updated income paid_amount to: {data['paid_amount']}")
    
    def test_delete_income(self, headers):
        """DELETE /api/finance/incomes/{id} - should delete income"""
        if not TestFinanceIncomesCRUD.created_income_id:
            pytest.skip("No income created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/finance/incomes/{TestFinanceIncomesCRUD.created_income_id}",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted income: {TestFinanceIncomesCRUD.created_income_id}")


# ==================== FINANCE EXPENSES CRUD TESTS ====================
class TestFinanceExpensesCRUD:
    """Test /api/finance/expenses endpoints"""
    
    created_expense_id = None
    
    def test_get_expenses(self, headers):
        """GET /api/finance/expenses - should return list of expenses"""
        response = requests.get(f"{BASE_URL}/api/finance/expenses", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET expenses returned {len(data)} expenses")
    
    def test_create_expense(self, headers):
        """POST /api/finance/expenses - should create new expense"""
        payload = {
            "expense_name": "TEST_Office Rent",
            "category": "Əməliyyat xərcləri",
            "sub_category": "Ofis icarəsi",
            "amount": 1500,
            "currency": "AZN",
            "date": "2025-01-15",
            "project": "Üzvlük",
            "responsible_person": "Test Person",
            "status": "Ödənilib"
        }
        response = requests.post(f"{BASE_URL}/api/finance/expenses", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["expense_name"] == "TEST_Office Rent"
        assert data["amount"] == 1500
        assert data["category"] == "Əməliyyat xərcləri"
        assert "id" in data
        TestFinanceExpensesCRUD.created_expense_id = data["id"]
        print(f"✓ Created expense: {data['expense_name']} - {data['amount']} AZN")
    
    def test_update_expense(self, headers):
        """PUT /api/finance/expenses/{id} - should update expense"""
        if not TestFinanceExpensesCRUD.created_expense_id:
            pytest.skip("No expense created to update")
        
        payload = {"amount": 2000, "status": "Gözləyir"}
        response = requests.put(
            f"{BASE_URL}/api/finance/expenses/{TestFinanceExpensesCRUD.created_expense_id}",
            json=payload, headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 2000
        assert data["status"] == "Gözləyir"
        print(f"✓ Updated expense amount to: {data['amount']}")
    
    def test_delete_expense(self, headers):
        """DELETE /api/finance/expenses/{id} - should delete expense"""
        if not TestFinanceExpensesCRUD.created_expense_id:
            pytest.skip("No expense created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/finance/expenses/{TestFinanceExpensesCRUD.created_expense_id}",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✓ Deleted expense: {TestFinanceExpensesCRUD.created_expense_id}")


# ==================== FINANCE SUMMARY TEST ====================
class TestFinanceSummary:
    """Test /api/finance/summary endpoint"""
    
    def test_get_finance_summary(self, headers):
        """GET /api/finance/summary - should return financial summary"""
        response = requests.get(f"{BASE_URL}/api/finance/summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_income" in data
        assert "paid_income" in data
        assert "debt" in data
        assert "total_expenses" in data
        assert "net_profit" in data
        assert "current_profit" in data
        assert data["currency"] == "AZN"
        print(f"✓ Finance summary: Income={data['total_income']}, Expenses={data['total_expenses']}, Profit={data['net_profit']}")


# ==================== OPTIONS ENDPOINTS TEST ====================
class TestOptionsEndpoints:
    """Test options endpoints for dropdowns"""
    
    def test_get_companies_for_select(self, headers):
        """GET /api/options/companies - should return companies for dropdown"""
        response = requests.get(f"{BASE_URL}/api/options/companies", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET options/companies returned {len(data)} companies")
    
    def test_get_all_options(self, headers):
        """GET /api/options/all - should return all options"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "sectors" in data
        assert "packages" in data
        assert "projects" in data
        assert "departments" in data
        print(f"✓ GET options/all returned all option categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
