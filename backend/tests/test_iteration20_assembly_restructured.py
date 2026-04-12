"""
Iteration 20 - Assembly Module Restructured Tests
Tests for:
1. Nested agendas[{title, tasks[{title, responsible_person}]}] structure
2. Task sync to Tasks module (source='assembly')
3. Task re-sync on update (old tasks removed, new ones created)
4. Task deletion when assembly is deleted
5. Department and date range filters
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAssemblyRestructured:
    """Test the restructured Assembly module with nested agendas/tasks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_assembly_ids = []
        yield
        # Cleanup: Delete test assemblies
        for assembly_id in self.created_assembly_ids:
            try:
                requests.delete(f"{BASE_URL}/api/assemblies/{assembly_id}", headers=self.headers)
            except:
                pass
    
    # ==================== TEST 1: POST with nested agendas/tasks ====================
    def test_create_assembly_with_nested_structure(self):
        """Test POST /api/assemblies with nested agendas[{title, tasks[{title, responsible_person}]}]"""
        payload = {
            "department": "Satış",
            "purpose": "TEST_Nested structure test",
            "agendas": [
                {
                    "title": "TEST_Agenda 1",
                    "tasks": [
                        {"title": "TEST_Task 1.1", "responsible_person": "Test Person 1"},
                        {"title": "TEST_Task 1.2", "responsible_person": "Test Person 2"}
                    ]
                },
                {
                    "title": "TEST_Agenda 2",
                    "tasks": [
                        {"title": "TEST_Task 2.1", "responsible_person": "Test Person 3"}
                    ]
                }
            ],
            "discussion_topics": ["Topic 1", "Topic 2"],
            "deadline": "2026-05-30",
            "next_assembly_date": "2026-06-15",
            "decisions": ["Decision 1"]
        }
        
        response = requests.post(f"{BASE_URL}/api/assemblies", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        self.created_assembly_ids.append(data["id"])
        
        # Verify IC-XXX auto-ID
        assert "assembly_code" in data
        assert data["assembly_code"].startswith("IC-"), f"Expected IC-XXX format, got {data['assembly_code']}"
        
        # Verify nested structure preserved
        assert "agendas" in data
        assert len(data["agendas"]) == 2
        assert data["agendas"][0]["title"] == "TEST_Agenda 1"
        assert len(data["agendas"][0]["tasks"]) == 2
        assert data["agendas"][0]["tasks"][0]["title"] == "TEST_Task 1.1"
        assert data["agendas"][0]["tasks"][0]["responsible_person"] == "Test Person 1"
        
        print(f"✓ Created assembly {data['assembly_code']} with nested structure")
        return data
    
    # ==================== TEST 2: Verify tasks synced to Tasks module ====================
    def test_tasks_synced_after_create(self):
        """After creating assembly, verify tasks appear in GET /api/tasks with source='assembly'"""
        # Create assembly
        payload = {
            "department": "Marketing",
            "purpose": "TEST_Task sync test",
            "agendas": [
                {
                    "title": "TEST_Sync Agenda",
                    "tasks": [
                        {"title": "TEST_Sync Task 1", "responsible_person": "Sync Person 1"},
                        {"title": "TEST_Sync Task 2", "responsible_person": "Sync Person 2"}
                    ]
                }
            ],
            "deadline": "2026-06-30"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assemblies", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        assembly = create_response.json()
        self.created_assembly_ids.append(assembly["id"])
        assembly_code = assembly["assembly_code"]
        assembly_id = assembly["id"]
        
        # Get all tasks
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        assert tasks_response.status_code == 200
        tasks = tasks_response.json()
        
        # Filter tasks from this assembly
        assembly_tasks = [t for t in tasks if t.get("source") == "assembly" and t.get("assembly_id") == assembly_id]
        
        assert len(assembly_tasks) == 2, f"Expected 2 synced tasks, got {len(assembly_tasks)}"
        
        # Verify task structure
        for task in assembly_tasks:
            assert task["task_name"].startswith(f"[{assembly_code}]"), f"Task name should have [{assembly_code}] prefix"
            assert task["source"] == "assembly"
            assert task["assembly_id"] == assembly_id
            assert task["department"] == "Marketing"
            assert task["status"] == "Gözləyir"
            assert task["priority"] == "Orta"
        
        print(f"✓ Verified {len(assembly_tasks)} tasks synced with source='assembly' and assembly_id={assembly_id}")
    
    # ==================== TEST 3: PUT re-syncs tasks ====================
    def test_update_assembly_resyncs_tasks(self):
        """PUT /api/assemblies/{id} - verify tasks are re-synced (old tasks removed, new ones created)"""
        # Create assembly with 2 tasks
        payload = {
            "department": "HR",
            "purpose": "TEST_Resync test",
            "agendas": [
                {
                    "title": "TEST_Original Agenda",
                    "tasks": [
                        {"title": "TEST_Original Task 1", "responsible_person": "Original Person 1"},
                        {"title": "TEST_Original Task 2", "responsible_person": "Original Person 2"}
                    ]
                }
            ],
            "deadline": "2026-07-30"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assemblies", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        assembly = create_response.json()
        self.created_assembly_ids.append(assembly["id"])
        assembly_id = assembly["id"]
        assembly_code = assembly["assembly_code"]
        
        # Get initial tasks
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        initial_tasks = [t for t in tasks_response.json() if t.get("assembly_id") == assembly_id]
        initial_task_ids = [t["id"] for t in initial_tasks]
        assert len(initial_tasks) == 2, f"Expected 2 initial tasks, got {len(initial_tasks)}"
        
        # Update assembly with different tasks
        update_payload = {
            "agendas": [
                {
                    "title": "TEST_Updated Agenda",
                    "tasks": [
                        {"title": "TEST_New Task 1", "responsible_person": "New Person 1"},
                        {"title": "TEST_New Task 2", "responsible_person": "New Person 2"},
                        {"title": "TEST_New Task 3", "responsible_person": "New Person 3"}
                    ]
                }
            ]
        }
        
        update_response = requests.put(f"{BASE_URL}/api/assemblies/{assembly_id}", json=update_payload, headers=self.headers)
        assert update_response.status_code == 200
        
        # Get tasks after update
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        updated_tasks = [t for t in tasks_response.json() if t.get("assembly_id") == assembly_id]
        updated_task_ids = [t["id"] for t in updated_tasks]
        
        # Verify old tasks removed and new ones created
        assert len(updated_tasks) == 3, f"Expected 3 updated tasks, got {len(updated_tasks)}"
        
        # Verify old task IDs are gone
        for old_id in initial_task_ids:
            assert old_id not in updated_task_ids, f"Old task {old_id} should have been removed"
        
        # Verify new tasks have correct names
        task_names = [t["task_name"] for t in updated_tasks]
        assert any("TEST_New Task 1" in name for name in task_names)
        assert any("TEST_New Task 2" in name for name in task_names)
        assert any("TEST_New Task 3" in name for name in task_names)
        
        print(f"✓ Verified tasks re-synced: {len(initial_tasks)} old tasks removed, {len(updated_tasks)} new tasks created")
    
    # ==================== TEST 4: DELETE removes associated tasks ====================
    def test_delete_assembly_removes_tasks(self):
        """DELETE /api/assemblies/{id} - verify associated tasks are also deleted"""
        # Create assembly
        payload = {
            "department": "Maliyyə",
            "purpose": "TEST_Delete test",
            "agendas": [
                {
                    "title": "TEST_Delete Agenda",
                    "tasks": [
                        {"title": "TEST_Delete Task 1", "responsible_person": "Delete Person 1"},
                        {"title": "TEST_Delete Task 2", "responsible_person": "Delete Person 2"}
                    ]
                }
            ],
            "deadline": "2026-08-30"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assemblies", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        assembly = create_response.json()
        assembly_id = assembly["id"]
        # Don't add to cleanup list since we're deleting it
        
        # Verify tasks exist
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        tasks_before = [t for t in tasks_response.json() if t.get("assembly_id") == assembly_id]
        assert len(tasks_before) == 2, f"Expected 2 tasks before delete, got {len(tasks_before)}"
        
        # Delete assembly
        delete_response = requests.delete(f"{BASE_URL}/api/assemblies/{assembly_id}", headers=self.headers)
        assert delete_response.status_code == 200
        
        # Verify tasks are gone
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        tasks_after = [t for t in tasks_response.json() if t.get("assembly_id") == assembly_id]
        assert len(tasks_after) == 0, f"Expected 0 tasks after delete, got {len(tasks_after)}"
        
        print(f"✓ Verified assembly deletion also deleted {len(tasks_before)} associated tasks")
    
    # ==================== TEST 5: Department filter ====================
    def test_department_filter(self):
        """GET /api/assemblies with department filter"""
        # Create assembly with specific department
        payload = {
            "department": "İT",
            "purpose": "TEST_Department filter test",
            "agendas": [{"title": "TEST_IT Agenda", "tasks": []}],
            "deadline": "2026-09-30"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assemblies", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        assembly = create_response.json()
        self.created_assembly_ids.append(assembly["id"])
        
        # Filter by department
        filter_response = requests.get(f"{BASE_URL}/api/assemblies?department=İT", headers=self.headers)
        assert filter_response.status_code == 200
        filtered = filter_response.json()
        
        # All results should have İT department
        for a in filtered:
            assert a["department"] == "İT", f"Expected department İT, got {a['department']}"
        
        # Our test assembly should be in results
        assert any(a["id"] == assembly["id"] for a in filtered), "Test assembly not found in filtered results"
        
        print(f"✓ Department filter works: {len(filtered)} assemblies with department=İT")
    
    # ==================== TEST 6: Date range filter ====================
    def test_date_range_filter(self):
        """GET /api/assemblies with date_from and date_to filters"""
        # Get all assemblies first
        all_response = requests.get(f"{BASE_URL}/api/assemblies", headers=self.headers)
        assert all_response.status_code == 200
        all_assemblies = all_response.json()
        
        if len(all_assemblies) == 0:
            pytest.skip("No assemblies to test date filter")
        
        # Use today's date for filter
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Filter with date_from
        filter_response = requests.get(f"{BASE_URL}/api/assemblies?date_from=2026-01-01", headers=self.headers)
        assert filter_response.status_code == 200
        
        # Filter with date_to
        filter_response = requests.get(f"{BASE_URL}/api/assemblies?date_to=2026-12-31", headers=self.headers)
        assert filter_response.status_code == 200
        
        # Filter with both
        filter_response = requests.get(f"{BASE_URL}/api/assemblies?date_from=2026-01-01&date_to=2026-12-31", headers=self.headers)
        assert filter_response.status_code == 200
        
        print(f"✓ Date range filter works")
    
    # ==================== TEST 7: Verify existing IC-001 assembly structure ====================
    def test_existing_assembly_structure(self):
        """Verify existing IC-001 assembly has correct nested structure"""
        response = requests.get(f"{BASE_URL}/api/assemblies", headers=self.headers)
        assert response.status_code == 200
        assemblies = response.json()
        
        # Find IC-001
        ic001 = next((a for a in assemblies if a.get("assembly_code") == "IC-001"), None)
        if ic001 is None:
            pytest.skip("IC-001 not found in database")
        
        # Verify nested structure
        assert "agendas" in ic001
        assert len(ic001["agendas"]) >= 1
        
        for agenda in ic001["agendas"]:
            assert "title" in agenda
            assert "tasks" in agenda
            for task in agenda.get("tasks", []):
                assert "title" in task
                assert "responsible_person" in task
        
        print(f"✓ IC-001 has correct nested structure with {len(ic001['agendas'])} agendas")
    
    # ==================== TEST 8: Verify IC-001 tasks in Tasks module ====================
    def test_existing_assembly_tasks_in_tasks_module(self):
        """Verify IC-001 tasks appear in Tasks module with [IC-001] prefix"""
        # Get IC-001 assembly
        assemblies_response = requests.get(f"{BASE_URL}/api/assemblies", headers=self.headers)
        assemblies = assemblies_response.json()
        ic001 = next((a for a in assemblies if a.get("assembly_code") == "IC-001"), None)
        
        if ic001 is None:
            pytest.skip("IC-001 not found")
        
        # Get tasks
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        assert tasks_response.status_code == 200
        tasks = tasks_response.json()
        
        # Filter IC-001 tasks
        ic001_tasks = [t for t in tasks if t.get("assembly_id") == ic001["id"]]
        
        # Count expected tasks from agendas
        expected_task_count = sum(len(a.get("tasks", [])) for a in ic001.get("agendas", []))
        
        # Verify task count (only tasks with both title and responsible_person are synced)
        valid_tasks = sum(
            1 for a in ic001.get("agendas", []) 
            for t in a.get("tasks", []) 
            if t.get("title") and t.get("responsible_person")
        )
        
        assert len(ic001_tasks) == valid_tasks, f"Expected {valid_tasks} tasks, got {len(ic001_tasks)}"
        
        # Verify all have [IC-001] prefix
        for task in ic001_tasks:
            assert "[IC-001]" in task["task_name"], f"Task should have [IC-001] prefix: {task['task_name']}"
            assert task["source"] == "assembly"
        
        print(f"✓ Found {len(ic001_tasks)} tasks with [IC-001] prefix in Tasks module")
    
    # ==================== TEST 9: Tasks without responsible_person not synced ====================
    def test_tasks_without_responsible_not_synced(self):
        """Tasks without responsible_person should not be synced to Tasks module"""
        payload = {
            "department": "Layihə",
            "purpose": "TEST_No responsible test",
            "agendas": [
                {
                    "title": "TEST_Agenda with incomplete tasks",
                    "tasks": [
                        {"title": "TEST_Task with responsible", "responsible_person": "Has Person"},
                        {"title": "TEST_Task without responsible", "responsible_person": ""},  # Empty
                        {"title": "", "responsible_person": "Person without task"}  # Empty title
                    ]
                }
            ],
            "deadline": "2026-10-30"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assemblies", json=payload, headers=self.headers)
        assert create_response.status_code == 200
        assembly = create_response.json()
        self.created_assembly_ids.append(assembly["id"])
        
        # Get tasks
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        assembly_tasks = [t for t in tasks_response.json() if t.get("assembly_id") == assembly["id"]]
        
        # Only 1 task should be synced (the one with both title and responsible_person)
        assert len(assembly_tasks) == 1, f"Expected 1 synced task, got {len(assembly_tasks)}"
        assert "TEST_Task with responsible" in assembly_tasks[0]["task_name"]
        
        print(f"✓ Only tasks with both title and responsible_person are synced")


class TestAssemblyEdgeCases:
    """Edge case tests for Assembly module"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "settings@marsol.az",
            "password": "marsol123"
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_ids = []
        yield
        for aid in self.created_ids:
            try:
                requests.delete(f"{BASE_URL}/api/assemblies/{aid}", headers=self.headers)
            except:
                pass
    
    def test_assembly_with_empty_agendas(self):
        """Assembly with empty agendas array should work"""
        payload = {
            "department": "Satış",
            "purpose": "TEST_Empty agendas",
            "agendas": [],
            "deadline": "2026-11-30"
        }
        
        response = requests.post(f"{BASE_URL}/api/assemblies", json=payload, headers=self.headers)
        assert response.status_code == 200
        assembly = response.json()
        self.created_ids.append(assembly["id"])
        
        # No tasks should be created
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        assembly_tasks = [t for t in tasks_response.json() if t.get("assembly_id") == assembly["id"]]
        assert len(assembly_tasks) == 0
        
        print(f"✓ Assembly with empty agendas works, no tasks created")
    
    def test_assembly_with_agenda_no_tasks(self):
        """Assembly with agenda but no tasks should work"""
        payload = {
            "department": "Marketing",
            "purpose": "TEST_Agenda no tasks",
            "agendas": [
                {"title": "TEST_Agenda without tasks", "tasks": []}
            ],
            "deadline": "2026-12-30"
        }
        
        response = requests.post(f"{BASE_URL}/api/assemblies", json=payload, headers=self.headers)
        assert response.status_code == 200
        assembly = response.json()
        self.created_ids.append(assembly["id"])
        
        # No tasks should be created
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        assembly_tasks = [t for t in tasks_response.json() if t.get("assembly_id") == assembly["id"]]
        assert len(assembly_tasks) == 0
        
        print(f"✓ Assembly with agenda but no tasks works")
    
    def test_update_nonexistent_assembly(self):
        """PUT to nonexistent assembly should return 404"""
        response = requests.put(
            f"{BASE_URL}/api/assemblies/nonexistent-id-12345",
            json={"purpose": "Updated"},
            headers=self.headers
        )
        assert response.status_code == 404
        print(f"✓ PUT to nonexistent assembly returns 404")
    
    def test_delete_nonexistent_assembly(self):
        """DELETE nonexistent assembly should return 404"""
        response = requests.delete(
            f"{BASE_URL}/api/assemblies/nonexistent-id-12345",
            headers=self.headers
        )
        assert response.status_code == 404
        print(f"✓ DELETE nonexistent assembly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
