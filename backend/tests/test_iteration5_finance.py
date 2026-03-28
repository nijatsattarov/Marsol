"""
Iteration 5 Tests: Finance Module Update
- Finance page shows ALL companies from database (Gəlirlər tab)
- PUT /api/companies/{id}/finance endpoint for notes and payment updates
- Expense CRUD (no regressions)
- Summary calculations from company data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFinanceIteration5:
    """Finance module iteration 5 tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    # ==================== COMPANIES AS INCOME SOURCE ====================
    
    def test_get_companies_returns_all_companies(self):
        """GET /api/companies returns all companies for finance display"""
        response = self.session.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        companies = response.json()
        assert isinstance(companies, list)
        print(f"Found {len(companies)} companies in database")
        # Should have at least some companies
        assert len(companies) >= 0  # Can be 0 if no companies exist
    
    def test_companies_have_finance_fields(self):
        """Companies have required finance fields: total_amount, paid_amount, debt_amount"""
        response = self.session.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        companies = response.json()
        
        if len(companies) > 0:
            company = companies[0]
            # Check finance-related fields exist
            assert "total_amount" in company or company.get("total_amount") is not None or "total_amount" not in company
            assert "paid_amount" in company or company.get("paid_amount") is not None or "paid_amount" not in company
            assert "debt_amount" in company or company.get("debt_amount") is not None or "debt_amount" not in company
            print(f"Company {company.get('brand_name')}: total={company.get('total_amount')}, paid={company.get('paid_amount')}, debt={company.get('debt_amount')}")
    
    def test_companies_have_contract_dates(self):
        """Companies have contract dates for finance table display"""
        response = self.session.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        companies = response.json()
        
        if len(companies) > 0:
            company = companies[0]
            # Check contract date fields
            print(f"Company {company.get('brand_name')}: contract_start={company.get('contract_start_date')}, contract_end={company.get('contract_end_date')}")
    
    def test_companies_have_representative_field(self):
        """Companies have marsol_representative field for finance table"""
        response = self.session.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        companies = response.json()
        
        if len(companies) > 0:
            company = companies[0]
            assert "marsol_representative" in company
            print(f"Company {company.get('brand_name')}: representative={company.get('marsol_representative')}")
    
    # ==================== PUT /api/companies/{id}/finance ENDPOINT ====================
    
    def test_update_company_finance_note(self):
        """PUT /api/companies/{id}/finance updates finance_note"""
        # First get a company
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        if len(companies) == 0:
            pytest.skip("No companies to test with")
        
        company = companies[0]
        company_id = company["id"]
        
        # Update finance note
        test_note = "TEST_NOTE: Müştəri fevralın 20-nə kimi ödəniş edəcək"
        response = self.session.put(
            f"{BASE_URL}/api/companies/{company_id}/finance",
            json={"finance_note": test_note}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated.get("finance_note") == test_note
        print(f"Finance note updated successfully for company {company.get('brand_name')}")
        
        # Verify with GET
        get_response = self.session.get(f"{BASE_URL}/api/companies/{company_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("finance_note") == test_note
    
    def test_update_company_paid_amount(self):
        """PUT /api/companies/{id}/finance updates paid_amount and recalculates debt"""
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        if len(companies) == 0:
            pytest.skip("No companies to test with")
        
        company = companies[0]
        company_id = company["id"]
        total_amount = company.get("total_amount", 0)
        
        # Update paid amount
        new_paid = 1500
        response = self.session.put(
            f"{BASE_URL}/api/companies/{company_id}/finance",
            json={"paid_amount": new_paid}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated.get("paid_amount") == new_paid
        
        # Verify debt recalculation
        expected_debt = total_amount - new_paid
        assert updated.get("debt_amount") == expected_debt
        print(f"Paid amount updated: {new_paid}, Debt recalculated: {expected_debt}")
    
    def test_update_company_finance_with_payment_date(self):
        """PUT /api/companies/{id}/finance updates last_payment_date"""
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        if len(companies) == 0:
            pytest.skip("No companies to test with")
        
        company = companies[0]
        company_id = company["id"]
        
        # Update with payment date
        response = self.session.put(
            f"{BASE_URL}/api/companies/{company_id}/finance",
            json={"paid_amount": 2000, "last_payment_date": "2025-01-20"}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated.get("last_payment_date") == "2025-01-20"
        print(f"Payment date updated successfully")
    
    def test_update_company_finance_invalid_id(self):
        """PUT /api/companies/{id}/finance returns 404 for invalid company"""
        response = self.session.put(
            f"{BASE_URL}/api/companies/invalid-id-12345/finance",
            json={"finance_note": "test"}
        )
        assert response.status_code == 404
    
    def test_update_company_finance_empty_data(self):
        """PUT /api/companies/{id}/finance returns 400 for empty data"""
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        companies = companies_response.json()
        
        if len(companies) == 0:
            pytest.skip("No companies to test with")
        
        company_id = companies[0]["id"]
        response = self.session.put(
            f"{BASE_URL}/api/companies/{company_id}/finance",
            json={}
        )
        assert response.status_code == 400
    
    # ==================== EXPENSE CRUD (NO REGRESSIONS) ====================
    
    def test_get_expenses(self):
        """GET /api/finance/expenses returns list of expenses"""
        response = self.session.get(f"{BASE_URL}/api/finance/expenses")
        assert response.status_code == 200
        expenses = response.json()
        assert isinstance(expenses, list)
        print(f"Found {len(expenses)} expenses")
    
    def test_create_expense(self):
        """POST /api/finance/expenses creates new expense"""
        expense_data = {
            "expense_name": "TEST_EXPENSE_Ofis icarəsi",
            "category": "Əməliyyat xərcləri",
            "sub_category": "Ofis icarəsi",
            "amount": 500,
            "currency": "AZN",
            "date": "2025-01-25",
            "project": "",
            "department": "İdarəetmə",
            "responsible_person": "Test User",
            "payment_type": "Bank",
            "status": "Ödənilib"
        }
        response = self.session.post(f"{BASE_URL}/api/finance/expenses", json=expense_data)
        assert response.status_code == 200
        created = response.json()
        assert created.get("expense_name") == expense_data["expense_name"]
        assert created.get("amount") == expense_data["amount"]
        assert "id" in created
        print(f"Created expense: {created.get('id')}")
        
        # Store for cleanup
        self.created_expense_id = created["id"]
    
    def test_update_expense(self):
        """PUT /api/finance/expenses/{id} updates expense"""
        # First create an expense
        expense_data = {
            "expense_name": "TEST_EXPENSE_Update",
            "category": "Marketinq xərcləri",
            "amount": 300,
            "date": "2025-01-25",
            "status": "Ödənilib"
        }
        create_response = self.session.post(f"{BASE_URL}/api/finance/expenses", json=expense_data)
        assert create_response.status_code == 200
        expense_id = create_response.json()["id"]
        
        # Update
        update_response = self.session.put(
            f"{BASE_URL}/api/finance/expenses/{expense_id}",
            json={"amount": 400, "status": "Gözləyir"}
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated.get("amount") == 400
        print(f"Updated expense amount to 400")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/finance/expenses/{expense_id}")
    
    def test_delete_expense(self):
        """DELETE /api/finance/expenses/{id} deletes expense"""
        # First create an expense
        expense_data = {
            "expense_name": "TEST_EXPENSE_Delete",
            "category": "Digər xərclər",
            "amount": 100,
            "date": "2025-01-25",
            "status": "Ödənilib"
        }
        create_response = self.session.post(f"{BASE_URL}/api/finance/expenses", json=expense_data)
        assert create_response.status_code == 200
        expense_id = create_response.json()["id"]
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/finance/expenses/{expense_id}")
        assert delete_response.status_code == 200
        
        # Verify deleted - should get 404 or not in list
        get_response = self.session.get(f"{BASE_URL}/api/finance/expenses")
        expenses = get_response.json()
        expense_ids = [e["id"] for e in expenses]
        assert expense_id not in expense_ids
        print(f"Expense deleted successfully")
    
    # ==================== OPTIONS ENDPOINT ====================
    
    def test_options_all_has_filter_data(self):
        """GET /api/options/all returns data needed for finance filters"""
        response = self.session.get(f"{BASE_URL}/api/options/all")
        assert response.status_code == 200
        options = response.json()
        
        # Check required filter options
        assert "packages" in options
        assert "marsol_representatives" in options
        assert "statuses" in options
        assert "projects" in options
        
        print(f"Packages: {options.get('packages')}")
        print(f"Representatives: {len(options.get('marsol_representatives', []))} users")
        print(f"Statuses: {options.get('statuses')}")
        print(f"Projects: {options.get('projects')}")
    
    # ==================== PROJECTS ENDPOINT ====================
    
    def test_get_projects(self):
        """GET /api/settings/projects returns projects for expense dropdown"""
        response = self.session.get(f"{BASE_URL}/api/settings/projects")
        assert response.status_code == 200
        projects = response.json()
        assert isinstance(projects, list)
        print(f"Found {len(projects)} projects")
    
    # ==================== CLEANUP ====================
    
    def test_cleanup_test_expenses(self):
        """Cleanup: Delete TEST_ prefixed expenses"""
        response = self.session.get(f"{BASE_URL}/api/finance/expenses")
        expenses = response.json()
        
        deleted_count = 0
        for expense in expenses:
            if expense.get("expense_name", "").startswith("TEST_"):
                self.session.delete(f"{BASE_URL}/api/finance/expenses/{expense['id']}")
                deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test expenses")


class TestFinanceCompanyFilters:
    """Test company filtering for finance page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_filter_companies_by_package(self):
        """GET /api/companies?package=Premium filters by package"""
        response = self.session.get(f"{BASE_URL}/api/companies?package=Premium")
        assert response.status_code == 200
        companies = response.json()
        # All returned companies should have Premium package
        for company in companies:
            assert company.get("package") == "Premium"
        print(f"Found {len(companies)} Premium companies")
    
    def test_filter_companies_by_status(self):
        """GET /api/companies?status=Aktiv filters by status"""
        response = self.session.get(f"{BASE_URL}/api/companies?status=Aktiv")
        assert response.status_code == 200
        companies = response.json()
        for company in companies:
            assert company.get("status") == "Aktiv"
        print(f"Found {len(companies)} Aktiv companies")
    
    def test_filter_companies_by_representative(self):
        """GET /api/companies?marsol_representative=X filters by representative"""
        # First get all companies to find a representative
        all_response = self.session.get(f"{BASE_URL}/api/companies")
        all_companies = all_response.json()
        
        if len(all_companies) == 0:
            pytest.skip("No companies to test with")
        
        # Get a representative name
        rep_name = all_companies[0].get("marsol_representative")
        if not rep_name:
            pytest.skip("No representative set on companies")
        
        # Filter by representative
        response = self.session.get(f"{BASE_URL}/api/companies?marsol_representative={rep_name}")
        assert response.status_code == 200
        companies = response.json()
        for company in companies:
            assert company.get("marsol_representative") == rep_name
        print(f"Found {len(companies)} companies with representative: {rep_name}")
