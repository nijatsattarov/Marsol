"""
Iteration 6 - Phase 5 Backend Tests
Testing: Sales module, Messages module, Notifications, Custom Fields, RBAC
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "settings@marsol.az"
TEST_PASSWORD = "marsol123"

# Second user for messaging tests
SECOND_USER_EMAIL = f"test_user_{uuid.uuid4().hex[:8]}@marsol.az"
SECOND_USER_NAME = "Test User Messaging"

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL


class TestSalesModule:
    """Sales/Leads CRUD and Stats tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_leads(self, headers):
        """Test GET /api/sales/leads returns list"""
        response = requests.get(f"{BASE_URL}/api/sales/leads", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} existing leads")
    
    def test_get_sales_stats(self, headers):
        """Test GET /api/sales/stats returns stage statistics"""
        response = requests.get(f"{BASE_URL}/api/sales/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Should have all 6 stages
        expected_stages = ["Yeni Lead", "Əlaqə", "Təklif", "Danışıq", "Uğurlu", "Uğursuz"]
        for stage in expected_stages:
            assert stage in data, f"Missing stage: {stage}"
            assert "count" in data[stage]
            assert "amount" in data[stage]
    
    def test_create_lead(self, headers):
        """Test POST /api/sales/leads creates new lead"""
        lead_data = {
            "company_name": "TEST_NewTech Solutions",
            "contact_person": "Test Contact",
            "phone": "+994501234567",
            "email": "test@newtech.az",
            "source": "Veb sayt",
            "stage": "Yeni Lead",
            "expected_amount": 5000,
            "priority": "Yüksək",
            "notes": "Test lead for iteration 6"
        }
        response = requests.post(f"{BASE_URL}/api/sales/leads", json=lead_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["company_name"] == lead_data["company_name"]
        assert data["stage"] == "Yeni Lead"
        assert data["priority"] == "Yüksək"
        # Store for later tests
        TestSalesModule.created_lead_id = data["id"]
        print(f"Created lead: {data['id']}")
    
    def test_update_lead_stage(self, headers):
        """Test PUT /api/sales/leads/{id} updates lead stage"""
        lead_id = getattr(TestSalesModule, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created to update")
        
        response = requests.put(f"{BASE_URL}/api/sales/leads/{lead_id}", 
                               json={"stage": "Əlaqə"}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["stage"] == "Əlaqə"
        print(f"Updated lead stage to: {data['stage']}")
    
    def test_update_lead_full(self, headers):
        """Test PUT /api/sales/leads/{id} updates multiple fields"""
        lead_id = getattr(TestSalesModule, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created to update")
        
        update_data = {
            "expected_amount": 7500,
            "priority": "Orta",
            "notes": "Updated notes"
        }
        response = requests.put(f"{BASE_URL}/api/sales/leads/{lead_id}", 
                               json=update_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["expected_amount"] == 7500
        assert data["priority"] == "Orta"
    
    def test_delete_lead(self, headers):
        """Test DELETE /api/sales/leads/{id} deletes lead"""
        lead_id = getattr(TestSalesModule, 'created_lead_id', None)
        if not lead_id:
            pytest.skip("No lead created to delete")
        
        response = requests.delete(f"{BASE_URL}/api/sales/leads/{lead_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/sales/leads", headers=headers)
        leads = get_response.json()
        assert not any(l["id"] == lead_id for l in leads), "Lead should be deleted"
        print(f"Deleted lead: {lead_id}")


class TestMessagesModule:
    """Messages/Conversations CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get auth token and user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"]
        }
    
    @pytest.fixture(scope="class")
    def headers(self, auth_data):
        return {"Authorization": f"Bearer {auth_data['token']}"}
    
    @pytest.fixture(scope="class")
    def second_user_id(self, headers):
        """Create a second user for messaging tests"""
        user_data = {
            "email": SECOND_USER_EMAIL,
            "name": SECOND_USER_NAME,
            "password": "test123",
            "role": "user"
        }
        response = requests.post(f"{BASE_URL}/api/settings/users", json=user_data, headers=headers)
        if response.status_code == 200:
            user = response.json()
            TestMessagesModule.created_user_id = user["id"]
            return user["id"]
        elif response.status_code == 400:
            # User might already exist, get from list
            users_response = requests.get(f"{BASE_URL}/api/settings/users", headers=headers)
            users = users_response.json()
            for u in users:
                if u["email"] == SECOND_USER_EMAIL:
                    return u["id"]
            # Create with different email
            user_data["email"] = f"test_{uuid.uuid4().hex[:6]}@marsol.az"
            response = requests.post(f"{BASE_URL}/api/settings/users", json=user_data, headers=headers)
            if response.status_code == 200:
                user = response.json()
                TestMessagesModule.created_user_id = user["id"]
                return user["id"]
        pytest.skip("Could not create second user for messaging tests")
    
    def test_get_conversations(self, headers):
        """Test GET /api/messages/conversations returns list"""
        response = requests.get(f"{BASE_URL}/api/messages/conversations", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} existing conversations")
    
    def test_create_conversation(self, headers, second_user_id):
        """Test POST /api/messages/conversations creates new conversation"""
        response = requests.post(f"{BASE_URL}/api/messages/conversations", 
                                json={"participant_id": second_user_id}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "participants" in data
        assert "participant_names" in data
        assert second_user_id in data["participants"]
        TestMessagesModule.created_conv_id = data["id"]
        print(f"Created conversation: {data['id']}")
    
    def test_get_messages_empty(self, headers):
        """Test GET /api/messages/{conv_id} returns empty list for new conversation"""
        conv_id = getattr(TestMessagesModule, 'created_conv_id', None)
        if not conv_id:
            pytest.skip("No conversation created")
        
        response = requests.get(f"{BASE_URL}/api/messages/{conv_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_send_message(self, headers):
        """Test POST /api/messages/{conv_id} sends message"""
        conv_id = getattr(TestMessagesModule, 'created_conv_id', None)
        if not conv_id:
            pytest.skip("No conversation created")
        
        response = requests.post(f"{BASE_URL}/api/messages/{conv_id}", 
                                json={"text": "Test message from iteration 6"}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["text"] == "Test message from iteration 6"
        assert "sender_id" in data
        assert "created_at" in data
        TestMessagesModule.created_msg_id = data["id"]
        print(f"Sent message: {data['id']}")
    
    def test_get_messages_with_content(self, headers):
        """Test GET /api/messages/{conv_id} returns messages after sending"""
        conv_id = getattr(TestMessagesModule, 'created_conv_id', None)
        if not conv_id:
            pytest.skip("No conversation created")
        
        response = requests.get(f"{BASE_URL}/api/messages/{conv_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(m["text"] == "Test message from iteration 6" for m in data)
    
    def test_conversation_last_message_updated(self, headers):
        """Test conversation last_message is updated after sending"""
        conv_id = getattr(TestMessagesModule, 'created_conv_id', None)
        if not conv_id:
            pytest.skip("No conversation created")
        
        response = requests.get(f"{BASE_URL}/api/messages/conversations", headers=headers)
        assert response.status_code == 200
        convs = response.json()
        conv = next((c for c in convs if c["id"] == conv_id), None)
        assert conv is not None
        assert conv["last_message"] == "Test message from iteration 6"


class TestNotificationsModule:
    """Notifications endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_notifications(self, headers):
        """Test GET /api/notifications returns notification data"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "count" in data
        assert "high_count" in data
        assert isinstance(data["notifications"], list)
        print(f"Found {data['count']} notifications, {data['high_count']} high priority")
    
    def test_notification_structure(self, headers):
        """Test notification objects have correct structure"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        if data["notifications"]:
            notif = data["notifications"][0]
            assert "id" in notif
            assert "type" in notif
            assert "severity" in notif
            assert "title" in notif
            assert "message" in notif
            assert notif["severity"] in ["high", "medium", "low"]
            assert notif["type"] in ["debt_overdue", "debt_pending", "contract_expired", "contract_expiring"]
    
    def test_notifications_sorted_by_severity(self, headers):
        """Test notifications are sorted by severity (high first)"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["notifications"]) > 1:
            severity_order = {"high": 0, "medium": 1, "low": 2}
            severities = [severity_order.get(n["severity"], 3) for n in data["notifications"]]
            assert severities == sorted(severities), "Notifications should be sorted by severity"


class TestCustomFields:
    """Custom Fields CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_custom_fields(self, headers):
        """Test GET /api/settings/custom-fields returns list"""
        response = requests.get(f"{BASE_URL}/api/settings/custom-fields", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} custom fields")
    
    def test_create_custom_field_for_companies(self, headers):
        """Test POST /api/settings/custom-fields creates field for companies module"""
        field_data = {
            "module": "companies",
            "field_name": "test_custom_field",
            "field_label": "Test Xüsusi Sahə",
            "field_type": "text",
            "required": False
        }
        response = requests.post(f"{BASE_URL}/api/settings/custom-fields", 
                                json=field_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["module"] == "companies"
        assert data["field_name"] == "test_custom_field"
        TestCustomFields.created_field_id = data["id"]
        print(f"Created custom field: {data['id']}")
    
    def test_get_custom_fields_by_module(self, headers):
        """Test GET /api/settings/custom-fields?module=companies filters by module"""
        response = requests.get(f"{BASE_URL}/api/settings/custom-fields?module=companies", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned fields should be for companies module
        for field in data:
            assert field["module"] == "companies"
    
    def test_update_custom_field(self, headers):
        """Test PUT /api/settings/custom-fields/{id} updates field"""
        field_id = getattr(TestCustomFields, 'created_field_id', None)
        if not field_id:
            pytest.skip("No custom field created")
        
        response = requests.put(f"{BASE_URL}/api/settings/custom-fields/{field_id}", 
                               json={"field_label": "Updated Label"}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["field_label"] == "Updated Label"
    
    def test_delete_custom_field(self, headers):
        """Test DELETE /api/settings/custom-fields/{id} deletes field"""
        field_id = getattr(TestCustomFields, 'created_field_id', None)
        if not field_id:
            pytest.skip("No custom field created")
        
        response = requests.delete(f"{BASE_URL}/api/settings/custom-fields/{field_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/settings/custom-fields", headers=headers)
        fields = get_response.json()
        assert not any(f["id"] == field_id for f in fields), "Field should be deleted"


class TestRBAC:
    """RBAC helper and role-based access tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_admin_user_has_role(self, headers):
        """Test admin user has role field"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "role" in data
        assert data["role"] == "admin"
    
    def test_protected_endpoint_requires_auth(self):
        """Test protected endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/sales/leads")
        assert response.status_code in [401, 403]
    
    def test_invalid_token_rejected(self):
        """Test invalid token is rejected"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/sales/leads", headers=headers)
        assert response.status_code == 401


class TestSidebarMenuItems:
    """Test that required menu endpoints exist"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_sales_endpoint_exists(self, headers):
        """Test /api/sales/leads endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/sales/leads", headers=headers)
        assert response.status_code == 200
    
    def test_messages_endpoint_exists(self, headers):
        """Test /api/messages/conversations endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/messages/conversations", headers=headers)
        assert response.status_code == 200
    
    def test_notifications_endpoint_exists(self, headers):
        """Test /api/notifications endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup(request):
    """Cleanup test data after all tests"""
    def cleanup_func():
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            return
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Delete test user if created
        user_id = getattr(TestMessagesModule, 'created_user_id', None)
        if user_id:
            requests.delete(f"{BASE_URL}/api/settings/users/{user_id}", headers=headers)
        
        # Delete any TEST_ prefixed leads
        leads_response = requests.get(f"{BASE_URL}/api/sales/leads", headers=headers)
        if leads_response.status_code == 200:
            for lead in leads_response.json():
                if lead.get("company_name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/sales/leads/{lead['id']}", headers=headers)
    
    request.addfinalizer(cleanup_func)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
