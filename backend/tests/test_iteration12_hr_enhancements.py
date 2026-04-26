"""
Iteration 12 - HR Module New Enhancements Testing
Tests for:
1. Marsol Companies CRUD in Settings
2. Work Experiences array in employees
3. Marsol Company field in employees
4. Multiple Reminders array in employees
5. /api/options/all returns marsol_companies
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://marsol-connect.preview.emergentagent.com').rstrip('/')

class TestMarsolCompaniesCRUD:
    """Test Marsol Companies CRUD endpoints in Settings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_marsol_companies_returns_list(self):
        """GET /api/settings/marsol-companies returns list"""
        response = requests.get(f"{BASE_URL}/api/settings/marsol-companies", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have default companies or existing ones
        print(f"Marsol companies count: {len(data)}")
        if len(data) > 0:
            assert "name" in data[0]
            assert "id" in data[0]
    
    def test_create_marsol_company(self):
        """POST /api/settings/marsol-companies creates new company"""
        test_name = f"TEST_Marsol_Company_{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/settings/marsol-companies",
            json={"name": test_name},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_name
        assert "id" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/settings/marsol-companies/{data['id']}", headers=self.headers)
    
    def test_delete_marsol_company(self):
        """DELETE /api/settings/marsol-companies/{id} deletes company"""
        # Create first
        test_name = f"TEST_Delete_Company_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/settings/marsol-companies",
            json={"name": test_name},
            headers=self.headers
        )
        assert create_response.status_code == 200
        company_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/settings/marsol-companies/{company_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        
        # Verify deleted - should not be in list
        list_response = requests.get(f"{BASE_URL}/api/settings/marsol-companies", headers=self.headers)
        companies = list_response.json()
        assert not any(c["id"] == company_id for c in companies)


class TestOptionsAllMarsolCompanies:
    """Test /api/options/all returns marsol_companies array"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_options_all_contains_marsol_companies(self):
        """GET /api/options/all returns marsol_companies array"""
        response = requests.get(f"{BASE_URL}/api/options/all", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "marsol_companies" in data, "marsol_companies key missing from options/all"
        assert isinstance(data["marsol_companies"], list)
        print(f"Marsol companies in options: {data['marsol_companies']}")
        
        # Should have default companies
        if len(data["marsol_companies"]) > 0:
            assert isinstance(data["marsol_companies"][0], str)


class TestEmployeeWorkExperiences:
    """Test work_experiences array in employees"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_employee_with_work_experiences(self):
        """POST /api/employees accepts work_experiences array"""
        employee_data = {
            "first_name": "TEST_WorkExp",
            "last_name": f"User_{uuid.uuid4().hex[:6]}",
            "full_name": "TEST_WorkExp User",
            "gender": "Kişi",
            "personal_phone": "+994501234567",
            "department": "İT",
            "position": "Developer",
            "status": "Aktiv",
            "work_experiences": [
                {
                    "company_name": "Previous Company 1",
                    "position": "Junior Developer",
                    "start_date": "2020-01-01",
                    "end_date": "2022-06-30",
                    "leave_reason": "Career growth"
                },
                {
                    "company_name": "Previous Company 2",
                    "position": "Mid Developer",
                    "start_date": "2022-07-01",
                    "end_date": "2024-12-31",
                    "leave_reason": "Better opportunity"
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert "work_experiences" in data
        assert len(data["work_experiences"]) == 2
        assert data["work_experiences"][0]["company_name"] == "Previous Company 1"
        assert data["work_experiences"][1]["position"] == "Mid Developer"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_create_employee_with_empty_work_experiences(self):
        """POST /api/employees accepts empty work_experiences array"""
        employee_data = {
            "first_name": "TEST_NoExp",
            "last_name": f"User_{uuid.uuid4().hex[:6]}",
            "full_name": "TEST_NoExp User",
            "gender": "Qadın",
            "personal_phone": "+994501234568",
            "department": "HR",
            "position": "HR Specialist",
            "status": "Aktiv",
            "work_experiences": []
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "work_experiences" in data
        assert len(data["work_experiences"]) == 0
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)


class TestEmployeeMarsolCompany:
    """Test marsol_company field in employees"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_employee_with_marsol_company(self):
        """POST /api/employees accepts marsol_company field"""
        employee_data = {
            "first_name": "TEST_Marsol",
            "last_name": f"Employee_{uuid.uuid4().hex[:6]}",
            "full_name": "TEST_Marsol Employee",
            "gender": "Kişi",
            "personal_phone": "+994501234569",
            "department": "Marketing",
            "position": "Marketing Manager",
            "status": "Aktiv",
            "marsol_company": "Marsol Group"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert "marsol_company" in data
        assert data["marsol_company"] == "Marsol Group"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)


class TestEmployeeReminders:
    """Test reminders array in employees"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_employee_with_multiple_reminders(self):
        """POST /api/employees accepts reminders array with date, time, note"""
        employee_data = {
            "first_name": "TEST_Reminder",
            "last_name": f"User_{uuid.uuid4().hex[:6]}",
            "full_name": "TEST_Reminder User",
            "gender": "Kişi",
            "personal_phone": "+994501234570",
            "department": "Satış",
            "position": "Sales Manager",
            "status": "Aktiv",
            "reminders": [
                {
                    "date": "2026-02-15",
                    "time": "09:00",
                    "note": "Müqavilə bitməsinə 1 ay qalmış"
                },
                {
                    "date": "2026-03-01",
                    "time": "10:30",
                    "note": "Sınaq müddəti bitir"
                },
                {
                    "date": "2026-04-01",
                    "time": "14:00",
                    "note": "Əmək haqqı artımı"
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert "reminders" in data
        assert len(data["reminders"]) == 3
        assert data["reminders"][0]["date"] == "2026-02-15"
        assert data["reminders"][0]["time"] == "09:00"
        assert data["reminders"][0]["note"] == "Müqavilə bitməsinə 1 ay qalmış"
        assert data["reminders"][1]["note"] == "Sınaq müddəti bitir"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_create_employee_with_empty_reminders(self):
        """POST /api/employees accepts empty reminders array"""
        employee_data = {
            "first_name": "TEST_NoReminder",
            "last_name": f"User_{uuid.uuid4().hex[:6]}",
            "full_name": "TEST_NoReminder User",
            "gender": "Qadın",
            "personal_phone": "+994501234571",
            "department": "Maliyyə",
            "position": "Accountant",
            "status": "Aktiv",
            "reminders": []
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "reminders" in data
        assert len(data["reminders"]) == 0
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)


class TestEmployeeComprehensive:
    """Comprehensive test with all new fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_employee_with_all_new_fields(self):
        """POST /api/employees with work_experiences, marsol_company, reminders"""
        employee_data = {
            "first_name": "TEST_Comprehensive",
            "last_name": f"Employee_{uuid.uuid4().hex[:6]}",
            "full_name": "TEST_Comprehensive Employee",
            "father_name": "Ata",
            "birth_date": "1990-05-15",
            "gender": "Kişi",
            "id_card_number": "AZE12345678",
            "fin_code": "ABC1234",
            "personal_phone": "+994501234572",
            "personal_email": "test@example.com",
            "corporate_email": "test@marsol.az",
            "registration_address": "Bakı şəhəri",
            "actual_address": "Bakı şəhəri",
            "department": "İT",
            "position": "Senior Developer",
            "status": "Aktiv",
            "marsol_company": "Marsol Events",
            "contract_signing_date": "2025-01-01",
            "work_start_date": "2025-01-15",
            "contract_end_date": "2026-01-14",
            "probation_end_date": "2025-04-15",
            "gross_salary": 3000,
            "net_salary": 2550,
            "salary_supplement": 500,
            "bonuses": "Quarterly bonus",
            "work_experiences": [
                {
                    "company_name": "Tech Corp",
                    "position": "Developer",
                    "start_date": "2018-01-01",
                    "end_date": "2024-12-31",
                    "leave_reason": "New opportunity"
                }
            ],
            "reminders": [
                {
                    "date": "2025-12-15",
                    "time": "09:00",
                    "note": "Müqavilə bitməsinə 1 ay qalmış"
                },
                {
                    "date": "2025-04-01",
                    "time": "10:00",
                    "note": "Sınaq müddəti bitir"
                }
            ],
            "educations": [
                {
                    "education_level": "Bakalavr",
                    "education_institution": "Bakı Dövlət Universiteti",
                    "specialty": "Kompüter elmləri",
                    "admission_date": "2008-09-01",
                    "graduation_date": "2012-06-30"
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify all new fields
        assert data["marsol_company"] == "Marsol Events"
        assert len(data["work_experiences"]) == 1
        assert data["work_experiences"][0]["company_name"] == "Tech Corp"
        assert len(data["reminders"]) == 2
        assert data["reminders"][0]["note"] == "Müqavilə bitməsinə 1 ay qalmış"
        
        # Verify GET returns same data
        get_response = requests.get(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        
        assert get_data["marsol_company"] == "Marsol Events"
        assert len(get_data["work_experiences"]) == 1
        assert len(get_data["reminders"]) == 2
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_update_employee_work_experiences_and_reminders(self):
        """PUT /api/employees/{id} updates work_experiences and reminders"""
        # Create employee first
        employee_data = {
            "first_name": "TEST_Update",
            "last_name": f"User_{uuid.uuid4().hex[:6]}",
            "full_name": "TEST_Update User",
            "gender": "Kişi",
            "personal_phone": "+994501234573",
            "department": "HR",
            "position": "HR Manager",
            "status": "Aktiv",
            "work_experiences": [],
            "reminders": []
        }
        
        create_response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert create_response.status_code == 200
        employee_id = create_response.json()["id"]
        
        # Update with work experiences and reminders
        update_data = {
            "work_experiences": [
                {
                    "company_name": "Updated Company",
                    "position": "Manager",
                    "start_date": "2020-01-01",
                    "end_date": "2024-12-31",
                    "leave_reason": "Promotion"
                }
            ],
            "reminders": [
                {
                    "date": "2026-06-01",
                    "time": "11:00",
                    "note": "Updated reminder"
                }
            ],
            "marsol_company": "Marsol Academy"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/employees/{employee_id}",
            json=update_data,
            headers=self.headers
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        
        assert len(updated_data["work_experiences"]) == 1
        assert updated_data["work_experiences"][0]["company_name"] == "Updated Company"
        assert len(updated_data["reminders"]) == 1
        assert updated_data["reminders"][0]["note"] == "Updated reminder"
        assert updated_data["marsol_company"] == "Marsol Academy"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
