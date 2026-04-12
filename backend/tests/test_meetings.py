"""
Test suite for Meetings (Görüşlər) module
Tests: CRUD operations, reminders, notifications integration, filters
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMeetingsModule:
    """Meetings module tests - CRUD, reminders, notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        data = login_response.json()
        self.token = data.get("access_token")
        assert self.token, "No access_token in login response"
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Store created meeting IDs for cleanup
        self.created_meeting_ids = []
        yield
        
        # Cleanup created meetings
        for meeting_id in self.created_meeting_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/meetings/{meeting_id}")
            except:
                pass
    
    # ==================== MEETINGS CRUD ====================
    
    def test_get_meetings_list(self):
        """Test GET /api/meetings returns list"""
        response = self.session.get(f"{BASE_URL}/api/meetings")
        assert response.status_code == 200, f"GET meetings failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/meetings returned {len(data)} meetings")
    
    def test_create_meeting_basic(self):
        """Test POST /api/meetings - create meeting with basic fields"""
        meeting_data = {
            "employee": "TEST_Employee",
            "meeting_setter": "TEST_Setter",
            "date": "2026-02-15",
            "time": "10:00",
            "company": "TEST_Company",
            "contact_person": "TEST_Contact",
            "meeting_type": "Satış görüşü",
            "meeting_mode": "Offline",
            "department": "Satış",
            "location": "Bakı, Ofis",
            "notes": "Test meeting notes",
            "reminders": []
        }
        
        response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert response.status_code == 200, f"Create meeting failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["employee"] == "TEST_Employee"
        assert data["meeting_type"] == "Satış görüşü"
        assert data["meeting_mode"] == "Offline"
        assert data["department"] == "Satış"
        
        self.created_meeting_ids.append(data["id"])
        print(f"✓ Created meeting with id: {data['id']}")
        return data["id"]
    
    def test_create_meeting_with_reminders(self):
        """Test POST /api/meetings - create meeting with reminders"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        meeting_data = {
            "employee": "TEST_ReminderEmployee",
            "meeting_setter": "TEST_Setter",
            "date": tomorrow,
            "time": "14:00",
            "company": "TEST_ReminderCompany",
            "contact_person": "TEST_Contact",
            "meeting_type": "Müştəri görüşü",
            "meeting_mode": "Online",
            "department": "Marketing",
            "location": "https://zoom.us/test",
            "notes": "Meeting with reminders",
            "reminders": [
                {"date": tomorrow, "time": "09:00", "note": "Reminder 1 - morning"},
                {"date": tomorrow, "time": "13:00", "note": "Reminder 2 - before meeting"}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert response.status_code == 200, f"Create meeting with reminders failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["meeting_mode"] == "Online"
        assert len(data.get("reminders", [])) == 2
        
        self.created_meeting_ids.append(data["id"])
        print(f"✓ Created meeting with 2 reminders, id: {data['id']}")
        return data["id"]
    
    def test_get_meeting_by_id(self):
        """Test that created meeting can be retrieved"""
        # First create a meeting
        meeting_data = {
            "employee": "TEST_GetById",
            "date": "2026-03-01",
            "time": "11:00",
            "meeting_type": "Daxili iclas",
            "meeting_mode": "Offline"
        }
        create_response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert create_response.status_code == 200
        meeting_id = create_response.json()["id"]
        self.created_meeting_ids.append(meeting_id)
        
        # Verify it appears in list
        list_response = self.session.get(f"{BASE_URL}/api/meetings")
        assert list_response.status_code == 200
        meetings = list_response.json()
        found = any(m["id"] == meeting_id for m in meetings)
        assert found, f"Created meeting {meeting_id} not found in list"
        print(f"✓ Meeting {meeting_id} found in list")
    
    def test_update_meeting(self):
        """Test PUT /api/meetings/{id} - update meeting"""
        # Create meeting first
        meeting_data = {
            "employee": "TEST_UpdateEmployee",
            "date": "2026-04-01",
            "time": "09:00",
            "meeting_type": "Satış görüşü",
            "meeting_mode": "Offline",
            "department": "Satış",
            "notes": "Original notes"
        }
        create_response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert create_response.status_code == 200
        meeting_id = create_response.json()["id"]
        self.created_meeting_ids.append(meeting_id)
        
        # Update meeting
        update_data = {
            "employee": "TEST_UpdatedEmployee",
            "meeting_mode": "Online",
            "location": "https://teams.microsoft.com/test",
            "notes": "Updated notes",
            "result": "Uğurlu"
        }
        update_response = self.session.put(f"{BASE_URL}/api/meetings/{meeting_id}", json=update_data)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated["employee"] == "TEST_UpdatedEmployee"
        assert updated["meeting_mode"] == "Online"
        assert updated["notes"] == "Updated notes"
        assert updated["result"] == "Uğurlu"
        print(f"✓ Meeting {meeting_id} updated successfully")
    
    def test_update_meeting_reminders(self):
        """Test PUT /api/meetings/{id} - update reminders (should recreate notifications)"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Create meeting with 1 reminder
        meeting_data = {
            "employee": "TEST_UpdateReminders",
            "date": tomorrow,
            "time": "15:00",
            "meeting_type": "Partnyor görüşü",
            "reminders": [{"date": tomorrow, "time": "10:00", "note": "Original reminder"}]
        }
        create_response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert create_response.status_code == 200
        meeting_id = create_response.json()["id"]
        self.created_meeting_ids.append(meeting_id)
        
        # Update with 2 new reminders
        update_data = {
            "reminders": [
                {"date": tomorrow, "time": "08:00", "note": "New reminder 1"},
                {"date": tomorrow, "time": "14:00", "note": "New reminder 2"}
            ]
        }
        update_response = self.session.put(f"{BASE_URL}/api/meetings/{meeting_id}", json=update_data)
        assert update_response.status_code == 200
        
        # Verify reminders in notifications
        notif_response = self.session.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200
        notifs = notif_response.json().get("notifications", [])
        meeting_reminders = [n for n in notifs if n.get("meeting_id") == meeting_id and n.get("type") == "reminder"]
        assert len(meeting_reminders) == 2, f"Expected 2 reminders, got {len(meeting_reminders)}"
        print(f"✓ Meeting reminders updated - 2 notifications created")
    
    def test_delete_meeting(self):
        """Test DELETE /api/meetings/{id}"""
        # Create meeting
        meeting_data = {
            "employee": "TEST_DeleteEmployee",
            "date": "2026-05-01",
            "time": "16:00",
            "meeting_type": "Təqdimat"
        }
        create_response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert create_response.status_code == 200
        meeting_id = create_response.json()["id"]
        
        # Delete meeting
        delete_response = self.session.delete(f"{BASE_URL}/api/meetings/{meeting_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify not in list
        list_response = self.session.get(f"{BASE_URL}/api/meetings")
        meetings = list_response.json()
        found = any(m["id"] == meeting_id for m in meetings)
        assert not found, f"Deleted meeting {meeting_id} still in list"
        print(f"✓ Meeting {meeting_id} deleted successfully")
    
    def test_delete_meeting_removes_reminders(self):
        """Test DELETE /api/meetings/{id} also removes associated notifications"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Create meeting with reminders
        meeting_data = {
            "employee": "TEST_DeleteReminders",
            "date": tomorrow,
            "time": "17:00",
            "meeting_type": "Satış görüşü",
            "reminders": [
                {"date": tomorrow, "time": "12:00", "note": "Reminder to delete"}
            ]
        }
        create_response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert create_response.status_code == 200
        meeting_id = create_response.json()["id"]
        
        # Verify reminder exists in notifications
        notif_response = self.session.get(f"{BASE_URL}/api/notifications")
        notifs = notif_response.json().get("notifications", [])
        before_count = len([n for n in notifs if n.get("meeting_id") == meeting_id])
        assert before_count >= 1, "Reminder should exist before delete"
        
        # Delete meeting
        delete_response = self.session.delete(f"{BASE_URL}/api/meetings/{meeting_id}")
        assert delete_response.status_code == 200
        
        # Verify reminders removed from notifications
        notif_response2 = self.session.get(f"{BASE_URL}/api/notifications")
        notifs2 = notif_response2.json().get("notifications", [])
        after_count = len([n for n in notifs2 if n.get("meeting_id") == meeting_id])
        assert after_count == 0, f"Reminders should be deleted, but found {after_count}"
        print(f"✓ Meeting deletion also removed associated reminders from notifications")
    
    # ==================== FILTERS ====================
    
    def test_filter_by_meeting_type(self):
        """Test GET /api/meetings?meeting_type=X"""
        # Create meetings with different types
        for mtype in ["Satış görüşü", "Daxili iclas"]:
            meeting_data = {
                "employee": f"TEST_Filter_{mtype}",
                "date": "2026-06-01",
                "time": "10:00",
                "meeting_type": mtype
            }
            resp = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
            if resp.status_code == 200:
                self.created_meeting_ids.append(resp.json()["id"])
        
        # Filter by type
        response = self.session.get(f"{BASE_URL}/api/meetings?meeting_type=Satış görüşü")
        assert response.status_code == 200
        meetings = response.json()
        for m in meetings:
            assert m["meeting_type"] == "Satış görüşü", f"Filter failed: got {m['meeting_type']}"
        print(f"✓ Filter by meeting_type works - {len(meetings)} results")
    
    def test_filter_by_department(self):
        """Test GET /api/meetings?department=X"""
        # Create meeting with specific department
        meeting_data = {
            "employee": "TEST_FilterDept",
            "date": "2026-06-15",
            "time": "11:00",
            "meeting_type": "Daxili iclas",
            "department": "İT"
        }
        resp = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        if resp.status_code == 200:
            self.created_meeting_ids.append(resp.json()["id"])
        
        # Filter by department
        response = self.session.get(f"{BASE_URL}/api/meetings?department=İT")
        assert response.status_code == 200
        meetings = response.json()
        for m in meetings:
            assert m.get("department") == "İT", f"Filter failed: got {m.get('department')}"
        print(f"✓ Filter by department works - {len(meetings)} results")
    
    def test_filter_by_employee(self):
        """Test GET /api/meetings?employee=X"""
        unique_name = "TEST_UniqueEmployee123"
        meeting_data = {
            "employee": unique_name,
            "date": "2026-07-01",
            "time": "09:00",
            "meeting_type": "Müştəri görüşü"
        }
        resp = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        if resp.status_code == 200:
            self.created_meeting_ids.append(resp.json()["id"])
        
        # Filter by employee
        response = self.session.get(f"{BASE_URL}/api/meetings?employee={unique_name}")
        assert response.status_code == 200
        meetings = response.json()
        assert len(meetings) >= 1, "Should find at least 1 meeting"
        for m in meetings:
            assert m["employee"] == unique_name
        print(f"✓ Filter by employee works - {len(meetings)} results")
    
    def test_filter_by_date_range(self):
        """Test GET /api/meetings?date_from=X&date_to=Y"""
        # Create meeting in specific date range
        meeting_data = {
            "employee": "TEST_DateRange",
            "date": "2026-08-15",
            "time": "14:00",
            "meeting_type": "Təqdimat"
        }
        resp = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        if resp.status_code == 200:
            self.created_meeting_ids.append(resp.json()["id"])
        
        # Filter by date range
        response = self.session.get(f"{BASE_URL}/api/meetings?date_from=2026-08-01&date_to=2026-08-31")
        assert response.status_code == 200
        meetings = response.json()
        for m in meetings:
            assert "2026-08" in m["date"], f"Date filter failed: {m['date']}"
        print(f"✓ Filter by date range works - {len(meetings)} results")
    
    # ==================== NOTIFICATIONS ====================
    
    def test_notifications_endpoint(self):
        """Test GET /api/notifications returns proper structure"""
        response = self.session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200, f"Notifications failed: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should have 'notifications' key"
        assert "count" in data, "Response should have 'count' key"
        assert "high_count" in data, "Response should have 'high_count' key"
        assert isinstance(data["notifications"], list)
        print(f"✓ GET /api/notifications - {data['count']} notifications, {data['high_count']} high priority")
    
    def test_meeting_reminders_in_notifications(self):
        """Test that meeting reminders appear in /api/notifications with type='reminder'"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Create meeting with reminder
        meeting_data = {
            "employee": "TEST_NotifReminder",
            "date": tomorrow,
            "time": "10:00",
            "meeting_type": "Satış görüşü",
            "company": "TEST_NotifCompany",
            "reminders": [{"date": tomorrow, "time": "08:00", "note": "Test notification reminder"}]
        }
        create_response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert create_response.status_code == 200
        meeting_id = create_response.json()["id"]
        self.created_meeting_ids.append(meeting_id)
        
        # Check notifications
        notif_response = self.session.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200
        
        notifs = notif_response.json().get("notifications", [])
        reminder_notifs = [n for n in notifs if n.get("type") == "reminder" and n.get("meeting_id") == meeting_id]
        
        assert len(reminder_notifs) >= 1, f"Expected reminder notification, found {len(reminder_notifs)}"
        
        reminder = reminder_notifs[0]
        assert "title" in reminder
        assert "message" in reminder
        assert "severity" in reminder
        assert reminder["severity"] in ["high", "medium", "low"]
        print(f"✓ Meeting reminder appears in notifications with type='reminder', severity='{reminder['severity']}'")
    
    # ==================== OPTIONS/DROPDOWNS ====================
    
    def test_options_all_endpoint(self):
        """Test GET /api/options/all returns meeting_types and departments"""
        response = self.session.get(f"{BASE_URL}/api/options/all")
        assert response.status_code == 200, f"Options failed: {response.text}"
        
        data = response.json()
        assert "meeting_types" in data, "Should have meeting_types"
        assert "departments" in data, "Should have departments"
        assert isinstance(data["meeting_types"], list)
        assert isinstance(data["departments"], list)
        assert len(data["meeting_types"]) > 0, "meeting_types should not be empty"
        assert len(data["departments"]) > 0, "departments should not be empty"
        print(f"✓ GET /api/options/all - {len(data['meeting_types'])} meeting types, {len(data['departments'])} departments")
    
    def test_employees_endpoint(self):
        """Test GET /api/employees returns list for dropdown"""
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Employees failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/employees - {len(data)} employees for dropdown")
    
    # ==================== MEETING MODES ====================
    
    def test_online_meeting_mode(self):
        """Test creating Online meeting"""
        meeting_data = {
            "employee": "TEST_OnlineMode",
            "date": "2026-09-01",
            "time": "15:00",
            "meeting_type": "Müştəri görüşü",
            "meeting_mode": "Online",
            "location": "https://zoom.us/j/123456"
        }
        response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert response.status_code == 200
        data = response.json()
        assert data["meeting_mode"] == "Online"
        self.created_meeting_ids.append(data["id"])
        print(f"✓ Online meeting mode works")
    
    def test_offline_meeting_mode(self):
        """Test creating Offline meeting"""
        meeting_data = {
            "employee": "TEST_OfflineMode",
            "date": "2026-09-15",
            "time": "11:00",
            "meeting_type": "Partnyor görüşü",
            "meeting_mode": "Offline",
            "location": "Bakı, Nizami küçəsi 10"
        }
        response = self.session.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        assert response.status_code == 200
        data = response.json()
        assert data["meeting_mode"] == "Offline"
        self.created_meeting_ids.append(data["id"])
        print(f"✓ Offline meeting mode works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
