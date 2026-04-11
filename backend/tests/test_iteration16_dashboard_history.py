"""
Iteration 16 - Testing Dashboard Stats, Package invitation_count, and Obligation History features

Features to test:
1. Dashboard shows 'Fəaliyyət statistikası' card with total events and breakdown by event type
2. Dashboard shows 'Dəvət statistikası' card with total invitations, attended, declined, no answer counts
3. Dashboard API (/api/dashboard/stats) returns events and invitations data in response
4. Settings packages page has 'Dəvət sayı' (invitation_count) input field
5. Package creation/editing saves invitation_count correctly
6. Package card displays invitation count badge
7. Obligation dashboard reads quota from packages collection dynamically
8. Obligation History page filters (event type, date range, status)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIteration16Features:
    """Test new Dashboard, Package invitation_count, and Obligation History features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test credentials
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Authentication failed - skipping tests")
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    # ==================== DASHBOARD STATS TESTS ====================
    
    def test_dashboard_stats_returns_events_data(self):
        """Test that dashboard/stats returns events data with total and by_type"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "events" in data, "Response should contain 'events' key"
        
        events = data["events"]
        assert "total" in events, "Events should have 'total' field"
        assert "by_type" in events, "Events should have 'by_type' field"
        assert isinstance(events["total"], int), "Events total should be an integer"
        assert isinstance(events["by_type"], list), "Events by_type should be a list"
        
        print(f"Dashboard events stats: total={events['total']}, by_type count={len(events['by_type'])}")
    
    def test_dashboard_stats_returns_invitations_data(self):
        """Test that dashboard/stats returns invitations data with all required fields"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "invitations" in data, "Response should contain 'invitations' key"
        
        invitations = data["invitations"]
        required_fields = ["total", "attended", "declined", "no_answer", "pending", "by_type"]
        for field in required_fields:
            assert field in invitations, f"Invitations should have '{field}' field"
        
        assert isinstance(invitations["total"], int), "Invitations total should be an integer"
        assert isinstance(invitations["attended"], int), "Invitations attended should be an integer"
        assert isinstance(invitations["declined"], int), "Invitations declined should be an integer"
        assert isinstance(invitations["no_answer"], int), "Invitations no_answer should be an integer"
        assert isinstance(invitations["pending"], int), "Invitations pending should be an integer"
        assert isinstance(invitations["by_type"], list), "Invitations by_type should be a list"
        
        print(f"Dashboard invitations stats: total={invitations['total']}, attended={invitations['attended']}, declined={invitations['declined']}, no_answer={invitations['no_answer']}")
    
    def test_dashboard_stats_invitations_by_type_structure(self):
        """Test that invitations by_type has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        by_type = data["invitations"]["by_type"]
        
        if len(by_type) > 0:
            item = by_type[0]
            assert "name" in item, "by_type item should have 'name' field"
            assert "total" in item, "by_type item should have 'total' field"
            assert "attended" in item, "by_type item should have 'attended' field"
            assert "declined" in item, "by_type item should have 'declined' field"
            print(f"Invitations by_type sample: {item}")
        else:
            print("No invitations by_type data yet (empty list)")
    
    def test_dashboard_stats_events_by_type_structure(self):
        """Test that events by_type has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        by_type = data["events"]["by_type"]
        
        if len(by_type) > 0:
            item = by_type[0]
            assert "name" in item, "by_type item should have 'name' field"
            assert "count" in item, "by_type item should have 'count' field"
            print(f"Events by_type sample: {item}")
        else:
            print("No events by_type data yet (empty list)")
    
    # ==================== PACKAGE INVITATION_COUNT TESTS ====================
    
    def test_get_packages_returns_invitation_count(self):
        """Test that packages endpoint returns invitation_count field"""
        response = self.session.get(f"{BASE_URL}/api/settings/packages")
        assert response.status_code == 200
        
        packages = response.json()
        assert isinstance(packages, list), "Packages should be a list"
        
        if len(packages) > 0:
            pkg = packages[0]
            assert "invitation_count" in pkg, "Package should have 'invitation_count' field"
            print(f"Package sample: name={pkg.get('name')}, invitation_count={pkg.get('invitation_count')}")
    
    def test_create_package_with_invitation_count(self):
        """Test creating a package with invitation_count field"""
        test_package = {
            "name": "TEST_Package_Iter16",
            "description": "Test package for iteration 16",
            "price": 1000,
            "invitation_count": 20
        }
        
        response = self.session.post(f"{BASE_URL}/api/settings/packages", json=test_package)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        assert created["name"] == test_package["name"]
        assert created["invitation_count"] == 20, f"Expected invitation_count=20, got {created.get('invitation_count')}"
        
        # Cleanup
        pkg_id = created["id"]
        self.session.delete(f"{BASE_URL}/api/settings/packages/{pkg_id}")
        print(f"Created and deleted test package with invitation_count=20")
    
    def test_update_package_invitation_count(self):
        """Test updating a package's invitation_count field"""
        # Create a test package first
        test_package = {
            "name": "TEST_Package_Update_Iter16",
            "description": "Test package for update",
            "price": 2000,
            "invitation_count": 15
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/settings/packages", json=test_package)
        assert create_response.status_code == 200
        pkg_id = create_response.json()["id"]
        
        # Update invitation_count
        update_response = self.session.put(f"{BASE_URL}/api/settings/packages/{pkg_id}", json={
            "invitation_count": 30
        })
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["invitation_count"] == 30, f"Expected invitation_count=30, got {updated.get('invitation_count')}"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/settings/packages/{pkg_id}")
        print(f"Updated package invitation_count from 15 to 30")
    
    # ==================== PACKAGE QUOTAS DYNAMIC READING TESTS ====================
    
    def test_options_returns_package_quotas(self):
        """Test that /api/options/all returns package_quotas from packages collection"""
        response = self.session.get(f"{BASE_URL}/api/options/all")
        assert response.status_code == 200
        
        data = response.json()
        assert "package_quotas" in data, "Options should contain 'package_quotas' key"
        
        quotas = data["package_quotas"]
        assert isinstance(quotas, dict), "package_quotas should be a dictionary"
        
        print(f"Package quotas: {quotas}")
    
    def test_package_quotas_reflect_database_values(self):
        """Test that package_quotas are read dynamically from packages collection"""
        # Create a test package with specific invitation_count
        test_package = {
            "name": "TEST_Quota_Package",
            "description": "Test quota package",
            "price": 5000,
            "invitation_count": 99
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/settings/packages", json=test_package)
        assert create_response.status_code == 200
        pkg_id = create_response.json()["id"]
        
        # Check if options/all reflects the new package quota
        options_response = self.session.get(f"{BASE_URL}/api/options/all")
        assert options_response.status_code == 200
        
        quotas = options_response.json().get("package_quotas", {})
        # The new package should be in quotas if it has invitation_count > 0
        assert "TEST_Quota_Package" in quotas, f"New package should be in quotas: {quotas}"
        assert quotas["TEST_Quota_Package"] == 99, f"Expected quota=99, got {quotas.get('TEST_Quota_Package')}"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/settings/packages/{pkg_id}")
        print(f"Verified dynamic quota reading: TEST_Quota_Package=99")
    
    # ==================== OBLIGATION DASHBOARD TESTS ====================
    
    def test_obligations_dashboard_endpoint(self):
        """Test that obligations dashboard endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/obligations/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "obligations" in data, "Response should contain 'obligations' key"
        assert "stats" in data, "Response should contain 'stats' key"
        
        print(f"Obligations dashboard: {len(data['obligations'])} companies, stats={data['stats']}")
    
    # ==================== INVITATIONS ENDPOINT TESTS ====================
    
    def test_invitations_endpoint(self):
        """Test that invitations endpoint returns data with required fields"""
        response = self.session.get(f"{BASE_URL}/api/invitations")
        assert response.status_code == 200
        
        invitations = response.json()
        assert isinstance(invitations, list), "Invitations should be a list"
        
        if len(invitations) > 0:
            inv = invitations[0]
            expected_fields = ["id", "event_id", "event_name", "event_type", "event_date", 
                              "company_id", "company_name", "call_status", "participation_status"]
            for field in expected_fields:
                assert field in inv, f"Invitation should have '{field}' field"
            print(f"Invitations sample: company={inv.get('company_name')}, event={inv.get('event_name')}, status={inv.get('call_status')}")
        else:
            print("No invitations data yet")
    
    # ==================== EVENTS ENDPOINT TESTS ====================
    
    def test_events_endpoint(self):
        """Test that events endpoint returns data with required fields"""
        response = self.session.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        
        events = response.json()
        assert isinstance(events, list), "Events should be a list"
        
        if len(events) > 0:
            event = events[0]
            expected_fields = ["id", "name", "event_type", "date"]
            for field in expected_fields:
                assert field in event, f"Event should have '{field}' field"
            print(f"Events sample: name={event.get('name')}, type={event.get('event_type')}, date={event.get('date')}")
        else:
            print("No events data yet")
    
    # ==================== DEFAULT PACKAGE QUOTAS TEST ====================
    
    def test_default_package_quotas_exist(self):
        """Test that default package quotas are returned when no packages in DB"""
        response = self.session.get(f"{BASE_URL}/api/options/all")
        assert response.status_code == 200
        
        quotas = response.json().get("package_quotas", {})
        
        # Should have at least some default quotas
        assert len(quotas) > 0, "Should have at least some package quotas"
        
        # Check for expected default packages
        expected_defaults = ["Premium", "Business", "Business Plus", "Sponsor"]
        found_defaults = [pkg for pkg in expected_defaults if pkg in quotas]
        print(f"Found default packages: {found_defaults}")
        print(f"All quotas: {quotas}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
