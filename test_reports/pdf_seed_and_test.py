"""Seed stress-test assembly, download PDF via HTTP-authorized page interaction
is skipped: since PDF generation happens client-side, we must trigger via UI.
This script only creates the seed and returns the id."""
import os, sys, json, requests

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://business-hub-563.preview.emergentagent.com').rstrip('/')

def login():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": "settings@marsol.az", "password": "marsol123"}, timeout=30)
    r.raise_for_status()
    return r.json()

def make_names(prefix, n):
    return [f"TEST_{prefix}_{i:02d}" for i in range(1, n+1)]

def build_payload():
    long_title = "Bu tapşırığın adı çox uzundur və mütləq təsvirin bir neçə sətrə keçməsi üçün 150 simvoldan daha da uzun olsun deyə əlavə mətn buraya yazılır TEST"
    long_topic = "Bu müzakirə mövzusu çox uzun bir mətn kimi yazılmışdır ki, autoTable-in çoxsətirli sütunda düzgün pagination etdiyini görək - əlavə söz və söz və söz TEST"
    resp = make_names("RESP", 8)
    ass = make_names("ASSIGN", 8)
    def task():
        return {
            "title": long_title,
            "responsible_persons": resp,
            "assignees": ass,
            "deadline": "2026-06-30",
            "status": "Davam edir",
        }
    return {
        "assembly_code": "TEST_ICLAS_PDF",  # ignored by backend (auto)
        "department": "İdarəetmə",
        "purpose": "Bu iclasın məqsədi PDF export-un stress testini keçirməkdir və uzun mətnin doğru wrap olub-olmadığını yoxlamaqdır TEST",
        "deadline": "2026-02-15",
        "next_assembly_date": "2026-03-15",
        "attendees": make_names("ATTND", 30),
        "responsible_persons": make_names("MASUL", 5),
        "agendas": [
            {"title": f"TEST Gündəlik #{i} - uzun başlıq mətni {i}", "tasks": [task(), task()]}
            for i in range(1, 5)
        ],
        "general_tasks": [task(), task(), task()],
        "discussion_topics": [long_topic + f" #{i}" for i in range(1, 7)],
        "decisions": [long_topic + f" qərar #{i}" for i in range(1, 6)],
    }

def main():
    login_data = login()
    token = login_data.get("token") or login_data.get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    payload = build_payload()
    r = requests.post(f"{BASE}/api/assemblies", json=payload, headers=headers, timeout=30)
    print("CREATE_STATUS", r.status_code)
    if r.status_code >= 300:
        print(r.text)
        sys.exit(1)
    doc = r.json()
    out = {"id": doc["id"], "assembly_code": doc["assembly_code"], "token": token, "user": login_data.get("user", {})}
    with open('/tmp/seed_info.json', 'w') as f:
        json.dump(out, f)
    print(json.dumps(out))

if __name__ == "__main__":
    main()
