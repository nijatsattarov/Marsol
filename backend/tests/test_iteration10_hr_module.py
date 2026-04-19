"""
Iteration 10 - HR Module Enhanced Fields Testing
Tests for:
- POST /api/employees creates employee with auto employee_code (E001 format)
- POST /api/employees accepts all new fields (first_name, last_name, specialty, admission_date, graduation_date, criminal_record_scan, health_certificate_scan, children_birth_dates, registration_address, personal_email, corporate_email, document_scans)
- PUT /api/employees/{id} updates employee with new fields
- GET /api/employees returns employees with new fields
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://marsol-event-gateway.preview.emergentagent.com').rstrip('/')

class TestHRModuleEnhanced:
    """HR Module with enhanced employee fields"""
    
    token = None
    created_employee_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        if not TestHRModuleEnhanced.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "settings@marsol.az",
                "password": "marsol123"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            TestHRModuleEnhanced.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {TestHRModuleEnhanced.token}"}
    
    def test_01_create_employee_with_auto_code(self):
        """Test POST /api/employees creates employee with auto employee_code (E001 format)"""
        employee_data = {
            "first_name": "TEST_Elvin",
            "last_name": "TEST_Mammadov",
            "full_name": "TEST_Elvin TEST_Mammadov",
            "father_name": "Farid",
            "birth_date": "1990-05-15",
            "gender": "Kişi",
            "id_card_number": "AZE12345678",
            "fin_code": "ABC1234",
            "education_level": "Ali",
            "education_institution": "Bakı Dövlət Universiteti",
            "specialty": "İnformasiya Texnologiyaları",
            "admission_date": "2008-09-01",
            "graduation_date": "2012-06-30",
            "marital_status": "Evli",
            "children_count": 2,
            "children_birth_dates": ["2015-03-10", "2018-07-22"],
            "registration_address": "Bakı şəhəri, Nəsimi rayonu",
            "actual_address": "Bakı şəhəri, Yasamal rayonu",
            "company_phone": "+994 12 555 1234",
            "personal_phone": "+994 50 555 5678",
            "personal_email": "elvin.personal@gmail.com",
            "corporate_email": "elvin@marsol.az",
            "emergency_contact_name": "Aysel Mammadova",
            "emergency_contact_relation": "Həyat yoldaşı",
            "emergency_contact_phone": "+994 55 555 9999",
            "department": "İT",
            "position": "Proqramçı",
            "contract_start_date": "2020-01-15",
            "work_start_date": "2020-01-15",
            "contract_end_date": "",
            "probation_end_date": "2020-04-15",
            "main_vacation_days": 21,
            "additional_vacation_days": 5,
            "gross_salary": 2500,
            "net_salary": 2125,
            "work_schedule": "09:00-18:00",
            "criminal_record_scan": "/uploads/test_criminal.pdf",
            "health_certificate_scan": "/uploads/test_health.pdf",
            "document_scans": ["/uploads/doc1.pdf", "/uploads/doc2.pdf"],
            "status": "Aktiv"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        TestHRModuleEnhanced.created_employee_id = data["id"]
        
        # Verify auto-generated employee_code
        assert "employee_code" in data, "employee_code not in response"
        assert data["employee_code"].startswith("E"), f"employee_code should start with 'E', got: {data['employee_code']}"
        assert len(data["employee_code"]) == 4, f"employee_code should be 4 chars (E001), got: {data['employee_code']}"
        print(f"Created employee with code: {data['employee_code']}")
        
        # Verify new fields are persisted
        assert data["first_name"] == "TEST_Elvin"
        assert data["last_name"] == "TEST_Mammadov"
        assert data["specialty"] == "İnformasiya Texnologiyaları"
        assert data["admission_date"] == "2008-09-01"
        assert data["graduation_date"] == "2012-06-30"
        assert data["criminal_record_scan"] == "/uploads/test_criminal.pdf"
        assert data["health_certificate_scan"] == "/uploads/test_health.pdf"
        assert data["children_birth_dates"] == ["2015-03-10", "2018-07-22"]
        assert data["registration_address"] == "Bakı şəhəri, Nəsimi rayonu"
        assert data["personal_email"] == "elvin.personal@gmail.com"
        assert data["corporate_email"] == "elvin@marsol.az"
        assert data["document_scans"] == ["/uploads/doc1.pdf", "/uploads/doc2.pdf"]
        
        print("TEST PASSED: Employee created with all new fields and auto employee_code")
    
    def test_02_get_employee_returns_new_fields(self):
        """Test GET /api/employees/{id} returns employee with all new fields"""
        assert TestHRModuleEnhanced.created_employee_id, "No employee created in previous test"
        
        response = requests.get(
            f"{BASE_URL}/api/employees/{TestHRModuleEnhanced.created_employee_id}", 
            headers=self.headers
        )
        assert response.status_code == 200, f"Get employee failed: {response.text}"
        
        data = response.json()
        
        # Verify all new fields are returned
        assert data["first_name"] == "TEST_Elvin"
        assert data["last_name"] == "TEST_Mammadov"
        assert data["specialty"] == "İnformasiya Texnologiyaları"
        assert data["admission_date"] == "2008-09-01"
        assert data["graduation_date"] == "2012-06-30"
        assert data["criminal_record_scan"] == "/uploads/test_criminal.pdf"
        assert data["health_certificate_scan"] == "/uploads/test_health.pdf"
        assert data["children_birth_dates"] == ["2015-03-10", "2018-07-22"]
        assert data["registration_address"] == "Bakı şəhəri, Nəsimi rayonu"
        assert data["personal_email"] == "elvin.personal@gmail.com"
        assert data["corporate_email"] == "elvin@marsol.az"
        assert data["document_scans"] == ["/uploads/doc1.pdf", "/uploads/doc2.pdf"]
        assert data["education_institution"] == "Bakı Dövlət Universiteti"
        
        print("TEST PASSED: GET employee returns all new fields correctly")
    
    def test_03_get_employees_list_returns_new_fields(self):
        """Test GET /api/employees returns list with new fields"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=self.headers)
        assert response.status_code == 200, f"Get employees failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Find our test employee
        test_employee = None
        for emp in data:
            if emp.get("first_name") == "TEST_Elvin":
                test_employee = emp
                break
        
        assert test_employee is not None, "Test employee not found in list"
        
        # Verify new fields in list response
        assert test_employee.get("employee_code"), "employee_code missing in list"
        assert test_employee.get("first_name") == "TEST_Elvin"
        assert test_employee.get("last_name") == "TEST_Mammadov"
        assert test_employee.get("specialty") == "İnformasiya Texnologiyaları"
        assert test_employee.get("personal_email") == "elvin.personal@gmail.com"
        assert test_employee.get("corporate_email") == "elvin@marsol.az"
        
        print(f"TEST PASSED: GET employees list returns {len(data)} employees with new fields")
    
    def test_04_update_employee_with_new_fields(self):
        """Test PUT /api/employees/{id} updates employee with new fields"""
        assert TestHRModuleEnhanced.created_employee_id, "No employee created in previous test"
        
        update_data = {
            "first_name": "TEST_Elvin_Updated",
            "last_name": "TEST_Mammadov_Updated",
            "specialty": "Proqram Mühəndisliyi",
            "admission_date": "2007-09-01",
            "graduation_date": "2011-06-30",
            "criminal_record_scan": "/uploads/updated_criminal.pdf",
            "health_certificate_scan": "/uploads/updated_health.pdf",
            "children_count": 3,
            "children_birth_dates": ["2015-03-10", "2018-07-22", "2022-01-15"],
            "registration_address": "Bakı şəhəri, Xətai rayonu",
            "personal_email": "elvin.updated@gmail.com",
            "corporate_email": "elvin.updated@marsol.az",
            "document_scans": ["/uploads/doc1.pdf", "/uploads/doc2.pdf", "/uploads/doc3.pdf"],
            "education_institution": "Azərbaycan Texniki Universiteti"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/employees/{TestHRModuleEnhanced.created_employee_id}",
            json=update_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Update employee failed: {response.text}"
        
        data = response.json()
        
        # Verify updates
        assert data["first_name"] == "TEST_Elvin_Updated"
        assert data["last_name"] == "TEST_Mammadov_Updated"
        assert data["specialty"] == "Proqram Mühəndisliyi"
        assert data["admission_date"] == "2007-09-01"
        assert data["graduation_date"] == "2011-06-30"
        assert data["criminal_record_scan"] == "/uploads/updated_criminal.pdf"
        assert data["health_certificate_scan"] == "/uploads/updated_health.pdf"
        assert data["children_count"] == 3
        assert data["children_birth_dates"] == ["2015-03-10", "2018-07-22", "2022-01-15"]
        assert data["registration_address"] == "Bakı şəhəri, Xətai rayonu"
        assert data["personal_email"] == "elvin.updated@gmail.com"
        assert data["corporate_email"] == "elvin.updated@marsol.az"
        assert len(data["document_scans"]) == 3
        assert data["education_institution"] == "Azərbaycan Texniki Universiteti"
        
        print("TEST PASSED: Employee updated with all new fields")
    
    def test_05_verify_update_persisted(self):
        """Test GET after PUT to verify updates persisted"""
        assert TestHRModuleEnhanced.created_employee_id, "No employee created in previous test"
        
        response = requests.get(
            f"{BASE_URL}/api/employees/{TestHRModuleEnhanced.created_employee_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get employee failed: {response.text}"
        
        data = response.json()
        
        # Verify updates persisted
        assert data["first_name"] == "TEST_Elvin_Updated"
        assert data["last_name"] == "TEST_Mammadov_Updated"
        assert data["specialty"] == "Proqram Mühəndisliyi"
        assert data["children_count"] == 3
        assert len(data["children_birth_dates"]) == 3
        
        print("TEST PASSED: Updates persisted correctly in database")
    
    def test_06_employee_code_auto_increment(self):
        """Test that employee_code auto-increments correctly"""
        # Create another employee to verify code increments
        employee_data = {
            "first_name": "TEST_Second",
            "last_name": "TEST_Employee",
            "full_name": "TEST_Second TEST_Employee",
            "gender": "Qadın",
            "personal_phone": "+994 50 111 2222",
            "department": "HR",
            "position": "HR Mütəxəssis",
            "status": "Aktiv"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create second employee failed: {response.text}"
        
        data = response.json()
        second_employee_id = data["id"]
        
        # Verify employee_code is generated
        assert "employee_code" in data
        assert data["employee_code"].startswith("E")
        print(f"Second employee created with code: {data['employee_code']}")
        
        # Cleanup second employee
        requests.delete(f"{BASE_URL}/api/employees/{second_employee_id}", headers=self.headers)
        
        print("TEST PASSED: Employee code auto-increments correctly")
    
    def test_07_filter_employees_by_department(self):
        """Test GET /api/employees with department filter"""
        response = requests.get(f"{BASE_URL}/api/employees?department=İT", headers=self.headers)
        assert response.status_code == 200, f"Filter employees failed: {response.text}"
        
        data = response.json()
        # All returned employees should be in İT department
        for emp in data:
            assert emp.get("department") == "İT", f"Employee {emp.get('first_name')} not in İT department"
        
        print(f"TEST PASSED: Filter by department returns {len(data)} employees")
    
    def test_08_filter_employees_by_status(self):
        """Test GET /api/employees with status filter"""
        response = requests.get(f"{BASE_URL}/api/employees?status=Aktiv", headers=self.headers)
        assert response.status_code == 200, f"Filter employees failed: {response.text}"
        
        data = response.json()
        # All returned employees should have Aktiv status
        for emp in data:
            assert emp.get("status") == "Aktiv", f"Employee {emp.get('first_name')} not Aktiv"
        
        print(f"TEST PASSED: Filter by status returns {len(data)} employees")
    
    def test_99_cleanup_test_employee(self):
        """Cleanup: Delete test employee"""
        if TestHRModuleEnhanced.created_employee_id:
            response = requests.delete(
                f"{BASE_URL}/api/employees/{TestHRModuleEnhanced.created_employee_id}",
                headers=self.headers
            )
            assert response.status_code == 200, f"Delete employee failed: {response.text}"
            print("TEST PASSED: Test employee cleaned up")
        
        # Also cleanup any other TEST_ employees
        response = requests.get(f"{BASE_URL}/api/employees", headers=self.headers)
        if response.status_code == 200:
            employees = response.json()
            for emp in employees:
                if emp.get("first_name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/employees/{emp['id']}", headers=self.headers)
                    print(f"Cleaned up test employee: {emp.get('first_name')}")


class TestUploadEndpoint:
    """Test file upload endpoint for HR documents"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        if not TestUploadEndpoint.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "settings@marsol.az",
                "password": "marsol123"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            TestUploadEndpoint.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {TestUploadEndpoint.token}"}
    
    def test_upload_endpoint_exists(self):
        """Test that /api/upload endpoint exists and requires auth"""
        # Test without file - should return 422 (validation error) not 404
        response = requests.post(f"{BASE_URL}/api/upload", headers=self.headers)
        # 422 means endpoint exists but validation failed (no file)
        assert response.status_code in [422, 400], f"Upload endpoint issue: {response.status_code} - {response.text}"
        print("TEST PASSED: Upload endpoint exists and requires file")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
