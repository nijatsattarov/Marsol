"""
Iteration 11 - HR Module Enhanced Features Testing
Tests for:
1. Repeatable educations array with multiple education entries
2. Certificate scans (multi-file) in documents
3. Expanded contract tab fields: contract_signing_date, work_start_date, contract_end_date, 
   contract_indefinite, probation_end_date, contract_reminder, position_change, payment_system,
   position_instructions_file, employment_contract_file, position_change_file
4. Salary fields: salary_supplement, bonuses
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHREnhancedFeatures:
    """Test HR module enhanced features - iteration 11"""
    
    token = None
    created_employee_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before tests"""
        if not TestHREnhancedFeatures.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "settings@marsol.az",
                "password": "marsol123"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            TestHREnhancedFeatures.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {TestHREnhancedFeatures.token}"}
    
    def test_01_create_employee_with_multiple_educations(self):
        """Test creating employee with educations array (multiple educations)"""
        employee_data = {
            "first_name": "TEST_Iteration11",
            "last_name": "MultiEducation",
            "full_name": "TEST_Iteration11 MultiEducation",
            "gender": "Kişi",
            "personal_phone": "+994501234567",
            "department": "İT",
            "position": "Developer",
            "status": "Aktiv",
            # Multiple educations array
            "educations": [
                {
                    "education_level": "Ali",
                    "education_institution": "Bakı Dövlət Universiteti",
                    "specialty": "Kompüter elmləri",
                    "admission_date": "2015-09-01",
                    "graduation_date": "2019-06-30"
                },
                {
                    "education_level": "Magistratura",
                    "education_institution": "ADA Universiteti",
                    "specialty": "İnformasiya texnologiyaları",
                    "admission_date": "2019-09-01",
                    "graduation_date": "2021-06-30"
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        TestHREnhancedFeatures.created_employee_id = data["id"]
        
        # Verify educations array is saved
        assert "educations" in data, "educations field missing in response"
        assert isinstance(data["educations"], list), "educations should be a list"
        assert len(data["educations"]) == 2, f"Expected 2 educations, got {len(data['educations'])}"
        
        # Verify first education
        assert data["educations"][0]["education_level"] == "Ali"
        assert data["educations"][0]["education_institution"] == "Bakı Dövlət Universiteti"
        assert data["educations"][0]["specialty"] == "Kompüter elmləri"
        
        # Verify second education
        assert data["educations"][1]["education_level"] == "Magistratura"
        assert data["educations"][1]["education_institution"] == "ADA Universiteti"
        
        print(f"✓ Created employee with {len(data['educations'])} educations")
    
    def test_02_create_employee_with_contract_fields(self):
        """Test creating employee with expanded contract fields"""
        employee_data = {
            "first_name": "TEST_Contract",
            "last_name": "Fields",
            "full_name": "TEST_Contract Fields",
            "gender": "Qadın",
            "personal_phone": "+994502345678",
            "department": "HR",
            "position": "HR Manager",
            "status": "Aktiv",
            # Expanded contract fields
            "contract_signing_date": "2024-01-15",
            "work_start_date": "2024-02-01",
            "contract_end_date": "2025-02-01",
            "contract_indefinite": False,
            "probation_end_date": "2024-05-01",
            "contract_reminder": True,
            "position_change": False,
            "payment_system": "Vaxtamuzd",
            # Contract file uploads (URLs)
            "position_instructions_file": "/uploads/test_instructions.pdf",
            "employment_contract_file": "/uploads/test_contract.pdf",
            "position_change_file": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        
        # Verify contract fields
        assert data.get("contract_signing_date") == "2024-01-15", "contract_signing_date not saved"
        assert data.get("work_start_date") == "2024-02-01", "work_start_date not saved"
        assert data.get("contract_end_date") == "2025-02-01", "contract_end_date not saved"
        assert data.get("contract_indefinite") == False, "contract_indefinite not saved"
        assert data.get("probation_end_date") == "2024-05-01", "probation_end_date not saved"
        assert data.get("contract_reminder") == True, "contract_reminder not saved"
        assert data.get("position_change") == False, "position_change not saved"
        assert data.get("payment_system") == "Vaxtamuzd", "payment_system not saved"
        assert data.get("position_instructions_file") == "/uploads/test_instructions.pdf"
        assert data.get("employment_contract_file") == "/uploads/test_contract.pdf"
        
        print("✓ Created employee with all contract fields")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_03_create_employee_with_indefinite_contract(self):
        """Test creating employee with indefinite contract (Müddətsiz)"""
        employee_data = {
            "first_name": "TEST_Indefinite",
            "last_name": "Contract",
            "full_name": "TEST_Indefinite Contract",
            "gender": "Kişi",
            "personal_phone": "+994503456789",
            "department": "Maliyyə",
            "position": "Accountant",
            "status": "Aktiv",
            "contract_signing_date": "2024-01-01",
            "work_start_date": "2024-01-15",
            "contract_indefinite": True,
            "contract_end_date": ""  # Should be empty when indefinite
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        assert data.get("contract_indefinite") == True, "contract_indefinite should be True"
        
        print("✓ Created employee with indefinite contract")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_04_create_employee_with_salary_fields(self):
        """Test creating employee with salary supplement and bonuses"""
        employee_data = {
            "first_name": "TEST_Salary",
            "last_name": "Fields",
            "full_name": "TEST_Salary Fields",
            "gender": "Kişi",
            "personal_phone": "+994504567890",
            "department": "Satış",
            "position": "Sales Manager",
            "status": "Aktiv",
            "gross_salary": 2500,
            "net_salary": 2000,
            "salary_supplement": 500,
            "bonuses": "Aylıq satış bonusu 10%"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        
        assert data.get("gross_salary") == 2500, "gross_salary not saved"
        assert data.get("net_salary") == 2000, "net_salary not saved"
        assert data.get("salary_supplement") == 500, "salary_supplement not saved"
        assert data.get("bonuses") == "Aylıq satış bonusu 10%", "bonuses not saved"
        
        print("✓ Created employee with salary supplement and bonuses")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_05_create_employee_with_certificate_scans(self):
        """Test creating employee with certificate scans array"""
        employee_data = {
            "first_name": "TEST_Certificates",
            "last_name": "Scans",
            "full_name": "TEST_Certificates Scans",
            "gender": "Qadın",
            "personal_phone": "+994505678901",
            "department": "Marketing",
            "position": "Marketing Specialist",
            "status": "Aktiv",
            # Certificate scans array (multi-file)
            "certificate_scans": [
                "/uploads/cert1.pdf",
                "/uploads/cert2.pdf",
                "/uploads/cert3.jpg"
            ],
            "document_scans": [
                "/uploads/doc1.pdf"
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        
        assert "certificate_scans" in data, "certificate_scans field missing"
        assert isinstance(data["certificate_scans"], list), "certificate_scans should be a list"
        assert len(data["certificate_scans"]) == 3, f"Expected 3 certificates, got {len(data['certificate_scans'])}"
        
        print(f"✓ Created employee with {len(data['certificate_scans'])} certificate scans")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_06_create_employee_with_position_change(self):
        """Test creating employee with position change = Bəli"""
        employee_data = {
            "first_name": "TEST_Position",
            "last_name": "Change",
            "full_name": "TEST_Position Change",
            "gender": "Kişi",
            "personal_phone": "+994506789012",
            "department": "İdarəetmə",
            "position": "Director",
            "status": "Aktiv",
            "position_change": True,
            "position_change_file": "/uploads/position_change.pdf"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        
        assert data.get("position_change") == True, "position_change should be True"
        assert data.get("position_change_file") == "/uploads/position_change.pdf"
        
        print("✓ Created employee with position change")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_07_create_employee_with_payment_system_isemuzd(self):
        """Test creating employee with İşəmuzd payment system"""
        employee_data = {
            "first_name": "TEST_Payment",
            "last_name": "System",
            "full_name": "TEST_Payment System",
            "gender": "Kişi",
            "personal_phone": "+994507890123",
            "department": "Layihə",
            "position": "Project Worker",
            "status": "Aktiv",
            "payment_system": "İşəmuzd"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        
        assert data.get("payment_system") == "İşəmuzd", "payment_system should be İşəmuzd"
        
        print("✓ Created employee with İşəmuzd payment system")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_08_get_employee_with_all_new_fields(self):
        """Test GET employee returns all new fields"""
        if not TestHREnhancedFeatures.created_employee_id:
            pytest.skip("No employee created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/employees/{TestHREnhancedFeatures.created_employee_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get employee failed: {response.text}"
        
        data = response.json()
        
        # Verify educations array persisted
        assert "educations" in data, "educations field missing in GET response"
        assert len(data["educations"]) == 2, "educations not persisted correctly"
        
        print("✓ GET employee returns all new fields including educations array")
    
    def test_09_update_employee_add_education(self):
        """Test updating employee to add another education"""
        if not TestHREnhancedFeatures.created_employee_id:
            pytest.skip("No employee created in previous test")
        
        # Add a third education
        update_data = {
            "educations": [
                {
                    "education_level": "Ali",
                    "education_institution": "Bakı Dövlət Universiteti",
                    "specialty": "Kompüter elmləri",
                    "admission_date": "2015-09-01",
                    "graduation_date": "2019-06-30"
                },
                {
                    "education_level": "Magistratura",
                    "education_institution": "ADA Universiteti",
                    "specialty": "İnformasiya texnologiyaları",
                    "admission_date": "2019-09-01",
                    "graduation_date": "2021-06-30"
                },
                {
                    "education_level": "Doktorantura",
                    "education_institution": "AMEA",
                    "specialty": "Süni intellekt",
                    "admission_date": "2021-09-01",
                    "graduation_date": ""
                }
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/employees/{TestHREnhancedFeatures.created_employee_id}",
            json=update_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Update employee failed: {response.text}"
        
        data = response.json()
        assert len(data["educations"]) == 3, f"Expected 3 educations after update, got {len(data['educations'])}"
        
        print("✓ Updated employee with 3rd education")
    
    def test_10_update_employee_contract_fields(self):
        """Test updating employee contract fields"""
        if not TestHREnhancedFeatures.created_employee_id:
            pytest.skip("No employee created in previous test")
        
        update_data = {
            "contract_signing_date": "2024-03-01",
            "work_start_date": "2024-03-15",
            "contract_indefinite": True,
            "contract_reminder": False,
            "position_change": True,
            "payment_system": "Vaxtamuzd",
            "salary_supplement": 300,
            "bonuses": "Quarterly bonus"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/employees/{TestHREnhancedFeatures.created_employee_id}",
            json=update_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Update employee failed: {response.text}"
        
        data = response.json()
        assert data.get("contract_signing_date") == "2024-03-01"
        assert data.get("contract_indefinite") == True
        assert data.get("position_change") == True
        assert data.get("payment_system") == "Vaxtamuzd"
        assert data.get("salary_supplement") == 300
        assert data.get("bonuses") == "Quarterly bonus"
        
        print("✓ Updated employee contract and salary fields")
    
    def test_11_cleanup_test_employee(self):
        """Cleanup test employee"""
        if TestHREnhancedFeatures.created_employee_id:
            response = requests.delete(
                f"{BASE_URL}/api/employees/{TestHREnhancedFeatures.created_employee_id}",
                headers=self.headers
            )
            assert response.status_code == 200, f"Delete employee failed: {response.text}"
            print("✓ Cleaned up test employee")
        else:
            print("No employee to cleanup")


class TestHREnhancedFieldsValidation:
    """Additional validation tests for HR enhanced fields"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before tests"""
        if not TestHREnhancedFieldsValidation.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "settings@marsol.az",
                "password": "marsol123"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            TestHREnhancedFieldsValidation.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {TestHREnhancedFieldsValidation.token}"}
    
    def test_01_empty_educations_array(self):
        """Test creating employee with empty educations array"""
        employee_data = {
            "first_name": "TEST_Empty",
            "last_name": "Educations",
            "full_name": "TEST_Empty Educations",
            "gender": "Kişi",
            "personal_phone": "+994508901234",
            "department": "İT",
            "position": "Junior Dev",
            "status": "Aktiv",
            "educations": []
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        assert data.get("educations") == [] or data.get("educations") is None or len(data.get("educations", [])) == 0
        
        print("✓ Created employee with empty educations array")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_02_empty_certificate_scans(self):
        """Test creating employee with empty certificate_scans array"""
        employee_data = {
            "first_name": "TEST_Empty",
            "last_name": "Certs",
            "full_name": "TEST_Empty Certs",
            "gender": "Qadın",
            "personal_phone": "+994509012345",
            "department": "HR",
            "position": "HR Specialist",
            "status": "Aktiv",
            "certificate_scans": []
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        
        print("✓ Created employee with empty certificate_scans array")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
    
    def test_03_all_fields_comprehensive(self):
        """Test creating employee with ALL new fields at once"""
        employee_data = {
            "first_name": "TEST_Comprehensive",
            "last_name": "AllFields",
            "full_name": "TEST_Comprehensive AllFields",
            "father_name": "Test Ata",
            "birth_date": "1990-05-15",
            "gender": "Kişi",
            "id_card_number": "AZE12345678",
            "fin_code": "ABC1234",
            "personal_phone": "+994510123456",
            "company_phone": "+994121234567",
            "personal_email": "test@personal.com",
            "corporate_email": "test@marsol.az",
            "registration_address": "Bakı, Nəsimi",
            "actual_address": "Bakı, Yasamal",
            "department": "İT",
            "position": "Senior Developer",
            "status": "Aktiv",
            "marital_status": "Evli",
            "children_count": 2,
            "children_birth_dates": ["2018-03-10", "2020-07-22"],
            # Multiple educations
            "educations": [
                {
                    "education_level": "Ali",
                    "education_institution": "BDU",
                    "specialty": "Proqramlaşdırma",
                    "admission_date": "2008-09-01",
                    "graduation_date": "2012-06-30"
                },
                {
                    "education_level": "Magistratura",
                    "education_institution": "ADNSU",
                    "specialty": "İT idarəetmə",
                    "admission_date": "2012-09-01",
                    "graduation_date": "2014-06-30"
                }
            ],
            # Contract fields
            "contract_signing_date": "2024-01-01",
            "work_start_date": "2024-01-15",
            "contract_end_date": "2026-01-15",
            "contract_indefinite": False,
            "probation_end_date": "2024-04-15",
            "contract_reminder": True,
            "position_change": False,
            "payment_system": "Vaxtamuzd",
            "position_instructions_file": "/uploads/instructions.pdf",
            "employment_contract_file": "/uploads/contract.pdf",
            "position_change_file": "",
            "main_vacation_days": 21,
            "additional_vacation_days": 5,
            "work_schedule": "09:00-18:00",
            # Salary fields
            "gross_salary": 3500,
            "net_salary": 2800,
            "salary_supplement": 700,
            "bonuses": "Performance bonus quarterly",
            # Document fields
            "criminal_record_scan": "/uploads/criminal.pdf",
            "health_certificate_scan": "/uploads/health.pdf",
            "certificate_scans": ["/uploads/cert1.pdf", "/uploads/cert2.pdf"],
            "document_scans": ["/uploads/doc1.pdf"],
            "photo_url": "/uploads/photo.jpg"
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=self.headers)
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        
        data = response.json()
        
        # Verify all key fields
        assert data.get("first_name") == "TEST_Comprehensive"
        assert len(data.get("educations", [])) == 2
        assert data.get("contract_signing_date") == "2024-01-01"
        assert data.get("work_start_date") == "2024-01-15"
        assert data.get("contract_indefinite") == False
        assert data.get("contract_reminder") == True
        assert data.get("payment_system") == "Vaxtamuzd"
        assert data.get("salary_supplement") == 700
        assert data.get("bonuses") == "Performance bonus quarterly"
        assert len(data.get("certificate_scans", [])) == 2
        
        print("✓ Created employee with ALL comprehensive fields")
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        
        assert len(get_data.get("educations", [])) == 2, "educations not persisted"
        assert get_data.get("salary_supplement") == 700, "salary_supplement not persisted"
        
        print("✓ Verified all fields persisted with GET")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/employees/{data['id']}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
