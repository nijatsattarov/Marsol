"""
Iteration 19 - Assembly (İclas) Module Tests
Tests for CRUD operations, filters, and auto-ID generation for assemblies
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAssemblyModule:
    """Assembly (İclas) CRUD and filter tests"""
    
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
        token = login_response.json().get("access_token")
        assert token, "No access_token in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Store created assembly IDs for cleanup
        self.created_assembly_ids = []
        yield
        
        # Cleanup - delete test assemblies
        for assembly_id in self.created_assembly_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/assemblies/{assembly_id}")
            except:
                pass
    
    # ==================== GET ASSEMBLIES ====================
    
    def test_get_assemblies_returns_list(self):
        """GET /api/assemblies returns list"""
        response = self.session.get(f"{BASE_URL}/api/assemblies")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/assemblies returns list with {len(data)} assemblies")
    
    def test_get_assemblies_with_department_filter(self):
        """GET /api/assemblies?department=X filters by department"""
        # First create an assembly with specific department
        create_payload = {
            "department": "Satış",
            "purpose": "TEST_Filter test assembly",
            "agendas": ["Test agenda"],
            "tasks": ["Test task"],
            "responsible_persons": [],
            "decisions": []
        }
        create_response = self.session.post(f"{BASE_URL}/api/assemblies", json=create_payload)
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        created = create_response.json()
        self.created_assembly_ids.append(created["id"])
        
        # Filter by department
        response = self.session.get(f"{BASE_URL}/api/assemblies?department=Satış")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned assemblies should have department=Satış
        for assembly in data:
            assert assembly.get("department") == "Satış", f"Expected department 'Satış', got '{assembly.get('department')}'"
        print(f"✓ GET /api/assemblies?department=Satış returns {len(data)} filtered assemblies")
    
    # ==================== CREATE ASSEMBLY ====================
    
    def test_create_assembly_with_all_fields(self):
        """POST /api/assemblies creates assembly with all fields and auto-generates IC-XXX code"""
        payload = {
            "department": "Marketing",
            "purpose": "TEST_Quarterly marketing review",
            "agendas": ["Budget review", "Campaign analysis", "Q2 planning"],
            "discussion_topics": ["Social media strategy", "Event marketing"],
            "tasks": ["Prepare Q1 report", "Draft Q2 budget"],
            "responsible_persons": ["Test Person 1", "Test Person 2"],
            "deadline": "2026-02-15",
            "next_assembly_date": "2026-03-01",
            "decisions": ["Increase social media budget by 20%", "Launch new campaign in March"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_assembly_ids.append(data["id"])
        
        # Verify auto-generated assembly_code (IC-XXX format)
        assert "assembly_code" in data, "Response should contain assembly_code"
        assert data["assembly_code"].startswith("IC-"), f"assembly_code should start with 'IC-', got '{data['assembly_code']}'"
        
        # Verify all fields
        assert data["department"] == payload["department"]
        assert data["purpose"] == payload["purpose"]
        assert data["agendas"] == payload["agendas"]
        assert data["discussion_topics"] == payload["discussion_topics"]
        assert data["tasks"] == payload["tasks"]
        assert data["responsible_persons"] == payload["responsible_persons"]
        assert data["deadline"] == payload["deadline"]
        assert data["next_assembly_date"] == payload["next_assembly_date"]
        assert data["decisions"] == payload["decisions"]
        assert "id" in data
        assert "created_at" in data
        
        print(f"✓ POST /api/assemblies created assembly with code {data['assembly_code']}")
    
    def test_create_assembly_minimal_fields(self):
        """POST /api/assemblies with minimal required fields"""
        payload = {
            "department": "HR",
            "purpose": "TEST_Quick sync meeting"
        }
        
        response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_assembly_ids.append(data["id"])
        
        assert data["department"] == "HR"
        assert data["purpose"] == "TEST_Quick sync meeting"
        assert data["assembly_code"].startswith("IC-")
        # Arrays should be empty or default
        assert isinstance(data.get("agendas", []), list)
        assert isinstance(data.get("tasks", []), list)
        
        print(f"✓ POST /api/assemblies with minimal fields created {data['assembly_code']}")
    
    def test_create_assembly_auto_id_increments(self):
        """Verify IC-XXX auto-ID increments correctly"""
        # Create first assembly
        payload1 = {"department": "İT", "purpose": "TEST_First assembly"}
        response1 = self.session.post(f"{BASE_URL}/api/assemblies", json=payload1)
        assert response1.status_code == 200
        data1 = response1.json()
        self.created_assembly_ids.append(data1["id"])
        code1 = data1["assembly_code"]
        
        # Create second assembly
        payload2 = {"department": "İT", "purpose": "TEST_Second assembly"}
        response2 = self.session.post(f"{BASE_URL}/api/assemblies", json=payload2)
        assert response2.status_code == 200
        data2 = response2.json()
        self.created_assembly_ids.append(data2["id"])
        code2 = data2["assembly_code"]
        
        # Extract numbers and verify increment
        num1 = int(code1.split("-")[1])
        num2 = int(code2.split("-")[1])
        assert num2 == num1 + 1, f"Expected {code2} to be one more than {code1}"
        
        print(f"✓ Auto-ID increments correctly: {code1} -> {code2}")
    
    # ==================== GET SINGLE ASSEMBLY ====================
    
    def test_get_assembly_by_id(self):
        """GET /api/assemblies/{id} returns single assembly (via list filter)"""
        # Create assembly first
        payload = {"department": "Maliyyə", "purpose": "TEST_Get by ID test"}
        create_response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert create_response.status_code == 200
        created = create_response.json()
        self.created_assembly_ids.append(created["id"])
        
        # Get all assemblies and find the one we created
        response = self.session.get(f"{BASE_URL}/api/assemblies")
        assert response.status_code == 200
        assemblies = response.json()
        
        found = next((a for a in assemblies if a["id"] == created["id"]), None)
        assert found is not None, f"Created assembly {created['id']} not found in list"
        assert found["purpose"] == "TEST_Get by ID test"
        
        print(f"✓ Assembly {created['assembly_code']} found in list")
    
    # ==================== UPDATE ASSEMBLY ====================
    
    def test_update_assembly(self):
        """PUT /api/assemblies/{id} updates assembly fields"""
        # Create assembly
        payload = {
            "department": "Layihə",
            "purpose": "TEST_Original purpose",
            "agendas": ["Original agenda"],
            "tasks": ["Original task"]
        }
        create_response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert create_response.status_code == 200
        created = create_response.json()
        self.created_assembly_ids.append(created["id"])
        original_code = created["assembly_code"]
        
        # Update assembly
        update_payload = {
            "purpose": "TEST_Updated purpose",
            "agendas": ["Updated agenda 1", "Updated agenda 2"],
            "tasks": ["Updated task 1"],
            "decisions": ["New decision"],
            "deadline": "2026-03-15"
        }
        update_response = self.session.put(f"{BASE_URL}/api/assemblies/{created['id']}", json=update_payload)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        
        # Verify updates
        assert updated["purpose"] == "TEST_Updated purpose"
        assert updated["agendas"] == ["Updated agenda 1", "Updated agenda 2"]
        assert updated["tasks"] == ["Updated task 1"]
        assert updated["decisions"] == ["New decision"]
        assert updated["deadline"] == "2026-03-15"
        # assembly_code should NOT change
        assert updated["assembly_code"] == original_code, "assembly_code should not change on update"
        # department should remain unchanged
        assert updated["department"] == "Layihə"
        
        print(f"✓ PUT /api/assemblies/{created['id']} updated successfully")
    
    def test_update_assembly_verify_persistence(self):
        """Update assembly and verify changes persist via GET"""
        # Create
        payload = {"department": "Satış", "purpose": "TEST_Persistence test"}
        create_response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert create_response.status_code == 200
        created = create_response.json()
        self.created_assembly_ids.append(created["id"])
        
        # Update
        update_payload = {"purpose": "TEST_Updated persistence test", "responsible_persons": ["Person A"]}
        update_response = self.session.put(f"{BASE_URL}/api/assemblies/{created['id']}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify via GET
        get_response = self.session.get(f"{BASE_URL}/api/assemblies")
        assert get_response.status_code == 200
        assemblies = get_response.json()
        
        found = next((a for a in assemblies if a["id"] == created["id"]), None)
        assert found is not None
        assert found["purpose"] == "TEST_Updated persistence test"
        assert found["responsible_persons"] == ["Person A"]
        
        print(f"✓ Update persisted correctly for {created['assembly_code']}")
    
    def test_update_nonexistent_assembly_returns_404(self):
        """PUT /api/assemblies/{invalid_id} returns 404"""
        response = self.session.put(f"{BASE_URL}/api/assemblies/nonexistent-id-12345", json={"purpose": "test"})
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT nonexistent assembly returns 404")
    
    # ==================== DELETE ASSEMBLY ====================
    
    def test_delete_assembly(self):
        """DELETE /api/assemblies/{id} removes assembly"""
        # Create
        payload = {"department": "İdarəetmə", "purpose": "TEST_To be deleted"}
        create_response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert create_response.status_code == 200
        created = create_response.json()
        assembly_id = created["id"]
        # Don't add to cleanup list since we're deleting it
        
        # Delete
        delete_response = self.session.delete(f"{BASE_URL}/api/assemblies/{assembly_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify deletion via GET
        get_response = self.session.get(f"{BASE_URL}/api/assemblies")
        assert get_response.status_code == 200
        assemblies = get_response.json()
        
        found = next((a for a in assemblies if a["id"] == assembly_id), None)
        assert found is None, f"Assembly {assembly_id} should have been deleted"
        
        print(f"✓ DELETE /api/assemblies/{assembly_id} removed assembly successfully")
    
    def test_delete_nonexistent_assembly_returns_404(self):
        """DELETE /api/assemblies/{invalid_id} returns 404"""
        response = self.session.delete(f"{BASE_URL}/api/assemblies/nonexistent-id-99999")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ DELETE nonexistent assembly returns 404")
    
    # ==================== SUPPORTING ENDPOINTS ====================
    
    def test_options_all_returns_departments(self):
        """GET /api/options/all returns departments for assembly form"""
        response = self.session.get(f"{BASE_URL}/api/options/all")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "departments" in data, "Response should contain 'departments'"
        assert isinstance(data["departments"], list)
        assert len(data["departments"]) > 0, "Departments list should not be empty"
        
        print(f"✓ GET /api/options/all returns {len(data['departments'])} departments")
    
    def test_employees_endpoint_for_responsible_persons(self):
        """GET /api/employees returns employee list for responsible_persons select"""
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ GET /api/employees returns {len(data)} employees for responsible_persons dropdown")
    
    # ==================== ARRAY FIELDS TESTS ====================
    
    def test_assembly_with_multiple_agendas(self):
        """Assembly with multiple agendas array items"""
        payload = {
            "department": "Marketing",
            "purpose": "TEST_Multiple agendas test",
            "agendas": ["Agenda 1", "Agenda 2", "Agenda 3", "Agenda 4", "Agenda 5"]
        }
        response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert response.status_code == 200
        data = response.json()
        self.created_assembly_ids.append(data["id"])
        
        assert len(data["agendas"]) == 5
        assert data["agendas"] == payload["agendas"]
        
        print(f"✓ Assembly created with {len(data['agendas'])} agendas")
    
    def test_assembly_with_multiple_decisions(self):
        """Assembly with multiple decisions array items"""
        payload = {
            "department": "İdarəetmə",
            "purpose": "TEST_Multiple decisions test",
            "decisions": ["Decision A", "Decision B", "Decision C"]
        }
        response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert response.status_code == 200
        data = response.json()
        self.created_assembly_ids.append(data["id"])
        
        assert len(data["decisions"]) == 3
        assert data["decisions"] == payload["decisions"]
        
        print(f"✓ Assembly created with {len(data['decisions'])} decisions")
    
    def test_assembly_with_all_array_fields(self):
        """Assembly with all array fields populated"""
        payload = {
            "department": "Layihə",
            "purpose": "TEST_All arrays test",
            "agendas": ["Agenda item 1", "Agenda item 2"],
            "discussion_topics": ["Topic 1", "Topic 2", "Topic 3"],
            "tasks": ["Task A", "Task B"],
            "responsible_persons": ["Person X", "Person Y", "Person Z"],
            "decisions": ["Decision 1"]
        }
        response = self.session.post(f"{BASE_URL}/api/assemblies", json=payload)
        assert response.status_code == 200
        data = response.json()
        self.created_assembly_ids.append(data["id"])
        
        assert len(data["agendas"]) == 2
        assert len(data["discussion_topics"]) == 3
        assert len(data["tasks"]) == 2
        assert len(data["responsible_persons"]) == 3
        assert len(data["decisions"]) == 1
        
        print(f"✓ Assembly created with all array fields populated")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
