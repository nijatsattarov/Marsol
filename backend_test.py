#!/usr/bin/env python3
"""
Marsol Dashboard Backend API Tests
Tests the authentication and dashboard endpoints
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
                required_keys = ["events", "members", "sectors", "payments", "financials"]
                missing_keys = [key for key in required_keys if key not in data]
                
                if not missing_keys:
                    # Validate structure
                    events_valid = "total" in data["events"] and "breakdown" in data["events"]
                    members_valid = "total" in data["members"] and "breakdown" in data["members"]
                    sectors_valid = "total" in data["sectors"] and "breakdown" in data["sectors"]
                    payments_valid = "total" in data["payments"] and "paid" in data["payments"]
                    financials_valid = "income" in data["financials"] and "expenses" in data["financials"]
                    
                    if all([events_valid, members_valid, sectors_valid, payments_valid, financials_valid]):
                        self.log_test("Dashboard Stats", "PASS", 
                                    f"Stats retrieved: {data['events']['total']} events, "
                                    f"{data['members']['total']} members, "
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