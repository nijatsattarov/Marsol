#!/usr/bin/env python3
"""
Marsol Dashboard Backend API Tests
Tests the authentication, dashboard, companies, and other endpoints
"""

import requests
import json
import sys
from datetime import datetime
import uuid

class MarsolAPITester:
    def __init__(self, base_url="https://marsol-dashboard.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_test(self, name, status, details="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if status == "PASS":
            self.tests_passed += 1
            
        result = {
            "test_name": name,
            "status": status,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status_emoji = "✅" if status == "PASS" else "❌"
        print(f"{status_emoji} {name}: {status}")
        if details:
            print(f"   Details: {details}")
    
    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("API Root", "PASS", f"Message: {data['message']}")
                    return True
                else:
                    self.log_test("API Root", "FAIL", "No message in response")
                    return False
            else:
                self.log_test("API Root", "FAIL", f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("API Root", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_register_user(self, email, password, name):
        """Test user registration"""
        try:
            payload = {
                "email": email,
                "password": password,
                "name": name
            }
            
            response = self.session.post(f"{self.base_url}/auth/register", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.token = data["access_token"]
                    user = data["user"]
                    self.log_test("User Registration", "PASS", 
                                f"User created: {user.get('name')} ({user.get('email')})")
                    return True, data
                else:
                    self.log_test("User Registration", "FAIL", "Missing token or user data")
                    return False, {}
            elif response.status_code == 400:
                error_detail = response.json().get("detail", "Unknown error")
                self.log_test("User Registration", "FAIL", f"Registration failed: {error_detail}")
                return False, {}
            else:
                self.log_test("User Registration", "FAIL", 
                            f"Status code: {response.status_code}, Response: {response.text}")
                return False, {}
        except Exception as e:
            self.log_test("User Registration", "FAIL", f"Exception: {str(e)}")
            return False, {}
    
    def test_login_user(self, email, password):
        """Test user login"""
        try:
            payload = {
                "email": email,
                "password": password
            }
            
            response = self.session.post(f"{self.base_url}/auth/login", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.token = data["access_token"]
                    user = data["user"]
                    self.log_test("User Login", "PASS", 
                                f"Login successful: {user.get('name')} ({user.get('email')})")
                    return True, data
                else:
                    self.log_test("User Login", "FAIL", "Missing token or user data")
                    return False, {}
            elif response.status_code == 401:
                error_detail = response.json().get("detail", "Unknown error")
                self.log_test("User Login", "FAIL", f"Login failed: {error_detail}")
                return False, {}
            else:
                self.log_test("User Login", "FAIL", 
                            f"Status code: {response.status_code}, Response: {response.text}")
                return False, {}
        except Exception as e:
            self.log_test("User Login", "FAIL", f"Exception: {str(e)}")
            return False, {}
    
    def test_get_current_user(self):
        """Test get current user endpoint"""
        if not self.token:
            self.log_test("Get Current User", "FAIL", "No authentication token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = self.session.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "email" in data and "name" in data:
                    self.log_test("Get Current User", "PASS", 
                                f"User info: {data.get('name')} ({data.get('email')})")
                    return True
                else:
                    self.log_test("Get Current User", "FAIL", "Missing user data fields")
                    return False
            elif response.status_code == 401:
                self.log_test("Get Current User", "FAIL", "Authentication failed")
                return False
            else:
                self.log_test("Get Current User", "FAIL", 
                            f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Current User", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        if not self.token:
            self.log_test("Dashboard Stats", "FAIL", "No authentication token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = self.session.get(f"{self.base_url}/dashboard/stats", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_keys = ["companies", "employees", "tasks", "meetings", "sectors", "financials", "payments"]
                missing_keys = [key for key in required_keys if key not in data]
                
                if not missing_keys:
                    # Validate structure
                    companies_valid = "total" in data["companies"] and "breakdown" in data["companies"]
                    employees_valid = "total" in data["employees"]
                    tasks_valid = "total" in data["tasks"] and "pending" in data["tasks"]
                    meetings_valid = "total" in data["meetings"]
                    sectors_valid = "total" in data["sectors"] and "breakdown" in data["sectors"]
                    payments_valid = "total" in data["payments"] and "paid" in data["payments"]
                    financials_valid = "income" in data["financials"] and "expenses" in data["financials"]
                    
                    if all([companies_valid, employees_valid, tasks_valid, meetings_valid, sectors_valid, payments_valid, financials_valid]):
                        self.log_test("Dashboard Stats", "PASS", 
                                    f"Stats retrieved: {data['companies']['total']} companies, "
                                    f"{data['employees']['total']} employees, "
                                    f"{data['tasks']['total']} tasks, "
                                    f"{data['sectors']['total']} sectors")
                        return True
                    else:
                        self.log_test("Dashboard Stats", "FAIL", "Invalid data structure")
                        return False
                else:
                    self.log_test("Dashboard Stats", "FAIL", f"Missing keys: {missing_keys}")
                    return False
            elif response.status_code == 401:
                self.log_test("Dashboard Stats", "FAIL", "Authentication failed")
                return False
            else:
                self.log_test("Dashboard Stats", "FAIL", 
                            f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Dashboard Stats", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_get_options(self):
        """Test get all options endpoint"""
        if not self.token:
            self.log_test("Get Options", "FAIL", "No authentication token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = self.session.get(f"{self.base_url}/options/all", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_keys = ["sectors", "packages", "company_sizes", "marsol_representatives", "projects", "departments"]
                missing_keys = [key for key in required_keys if key not in data]
                
                if not missing_keys:
                    self.log_test("Get Options", "PASS", 
                                f"Options retrieved: {len(data['sectors'])} sectors, "
                                f"{len(data['packages'])} packages, {len(data['marsol_representatives'])} representatives")
                    return True, data
                else:
                    self.log_test("Get Options", "FAIL", f"Missing keys: {missing_keys}")
                    return False, {}
            elif response.status_code == 401:
                self.log_test("Get Options", "FAIL", "Authentication failed")
                return False, {}
            else:
                self.log_test("Get Options", "FAIL", f"Status code: {response.status_code}")
                return False, {}
        except Exception as e:
            self.log_test("Get Options", "FAIL", f"Exception: {str(e)}")
            return False, {}
    
    def test_get_companies(self):
        """Test get companies list endpoint"""
        if not self.token:
            self.log_test("Get Companies", "FAIL", "No authentication token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = self.session.get(f"{self.base_url}/companies", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Companies", "PASS", f"Retrieved {len(data)} companies")
                    return True, data
                else:
                    self.log_test("Get Companies", "FAIL", "Response is not a list")
                    return False, []
            elif response.status_code == 401:
                self.log_test("Get Companies", "FAIL", "Authentication failed")
                return False, []
            else:
                self.log_test("Get Companies", "FAIL", f"Status code: {response.status_code}")
                return False, []
        except Exception as e:
            self.log_test("Get Companies", "FAIL", f"Exception: {str(e)}")
            return False, []
    
    def test_create_company(self):
        """Test create company endpoint"""
        if not self.token:
            self.log_test("Create Company", "FAIL", "No authentication token available")
            return False, None
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            test_company = {
                "brand_name": f"Test Company {str(uuid.uuid4())[:8]}",
                "legal_name": f"Test Legal Company {str(uuid.uuid4())[:8]}",
                "sector": "İKT",
                "company_size": "Orta",
                "owner_name": "Test Owner",
                "owner_phone": "+994501234567",
                "marsol_representative": "Əli Məmmədov",
                "joined_project": "Üzvlük",
                "package": "Business",
                "total_amount": 1000,
                "paid_amount": 500,
                "status": "Aktiv"
            }
            
            response = self.session.post(f"{self.base_url}/companies", json=test_company, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "brand_name" in data:
                    self.log_test("Create Company", "PASS", 
                                f"Company created: {data['brand_name']} (ID: {data['id']})")
                    return True, data
                else:
                    self.log_test("Create Company", "FAIL", "Missing id or brand_name in response")
                    return False, None
            elif response.status_code == 401:
                self.log_test("Create Company", "FAIL", "Authentication failed")
                return False, None
            else:
                self.log_test("Create Company", "FAIL", 
                            f"Status code: {response.status_code}, Response: {response.text}")
                return False, None
        except Exception as e:
            self.log_test("Create Company", "FAIL", f"Exception: {str(e)}")
            return False, None
    
    def test_get_single_company(self, company_id):
        """Test get single company endpoint"""
        if not self.token:
            self.log_test("Get Single Company", "FAIL", "No authentication token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = self.session.get(f"{self.base_url}/companies/{company_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "brand_name" in data:
                    self.log_test("Get Single Company", "PASS", 
                                f"Company retrieved: {data['brand_name']}")
                    return True
                else:
                    self.log_test("Get Single Company", "FAIL", "Missing required fields")
                    return False
            elif response.status_code == 404:
                self.log_test("Get Single Company", "FAIL", "Company not found")
                return False
            elif response.status_code == 401:
                self.log_test("Get Single Company", "FAIL", "Authentication failed")
                return False
            else:
                self.log_test("Get Single Company", "FAIL", f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Single Company", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_update_company(self, company_id):
        """Test update company endpoint"""
        if not self.token:
            self.log_test("Update Company", "FAIL", "No authentication token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            update_data = {
                "brand_name": f"Updated Company {str(uuid.uuid4())[:8]}",
                "sector": "Maliyyə"
            }
            
            response = self.session.put(f"{self.base_url}/companies/{company_id}", 
                                      json=update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["brand_name"] == update_data["brand_name"]:
                    self.log_test("Update Company", "PASS", 
                                f"Company updated: {data['brand_name']}")
                    return True
                else:
                    self.log_test("Update Company", "FAIL", "Update not reflected in response")
                    return False
            elif response.status_code == 404:
                self.log_test("Update Company", "FAIL", "Company not found")
                return False
            elif response.status_code == 401:
                self.log_test("Update Company", "FAIL", "Authentication failed")
                return False
            else:
                self.log_test("Update Company", "FAIL", 
                            f"Status code: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Update Company", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_delete_company(self, company_id):
        """Test delete company endpoint"""
        if not self.token:
            self.log_test("Delete Company", "FAIL", "No authentication token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = self.session.delete(f"{self.base_url}/companies/{company_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Delete Company", "PASS", f"Company deleted: {data['message']}")
                    return True
                else:
                    self.log_test("Delete Company", "FAIL", "No confirmation message")
                    return False
            elif response.status_code == 404:
                self.log_test("Delete Company", "FAIL", "Company not found")
                return False
            elif response.status_code == 401:
                self.log_test("Delete Company", "FAIL", "Authentication failed")
                return False
            else:
                self.log_test("Delete Company", "FAIL", f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Delete Company", "FAIL", f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Marsol Dashboard Backend API Tests...")
        print(f"🎯 Testing against: {self.base_url}")
        print("-" * 60)
        
        # Generate unique test user
        test_id = str(uuid.uuid4())[:8]
        test_email = f"test_{test_id}@marsol.test"
        test_password = "TestPass123!"
        test_name = f"Test User {test_id}"
        
        # Test sequence
        self.test_api_root()
        
        # Test registration
        reg_success, reg_data = self.test_register_user(test_email, test_password, test_name)
        
        if not reg_success:
            # Try login if registration failed (user might already exist)
            print("🔄 Registration failed, trying login...")
            login_success, login_data = self.test_login_user(test_email, test_password)
        else:
            login_success = True
        
        # Test authenticated endpoints
        if self.token:
            self.test_get_current_user()
            self.test_dashboard_stats()
            
            # Test options endpoint
            print("\n📋 Testing Options Endpoint...")
            options_success, options_data = self.test_get_options()
            
            # Test company endpoints
            print("\n🏢 Testing Company Management Endpoints...")
            
            # Get companies list
            companies_success, companies_data = self.test_get_companies()
            
            # Create a test company
            create_success, created_company = self.test_create_company()
            
            if create_success and created_company:
                company_id = created_company["id"]
                
                # Test single company retrieval
                self.test_get_single_company(company_id)
                
                # Test company update
                self.test_update_company(company_id)
                
                # Test company deletion
                self.test_delete_company(company_id)
            else:
                print("⚠️ Skipping company CRUD tests due to creation failure")
        else:
            print("❌ No valid token - skipping authenticated tests")
        
        # Print summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # List failed tests
        failed_tests = [t for t in self.test_results if t["status"] == "FAIL"]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  • {test['test_name']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = MarsolAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())