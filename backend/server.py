from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Email notification service (Resend)
from email_service import notify as _email_notify  # noqa: E402

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError("MONGO_URL environment variable is not set")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'marsol_db')]

# JWT Settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'marsol-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Static files for uploads
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ==================== MODELS ====================

class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# Company (Şirkət) Models
class CompanyCreate(BaseModel):
    brand_name: str
    legal_name: Optional[str] = ""
    sector: str
    company_size: str  # Böyük, Orta, Kiçik, Mikro
    registration_date: Optional[str] = ""
    address: Optional[str] = ""
    bank_details: Optional[str] = ""
    # Owner info
    owner_name: str
    owner_phone: str
    owner_email: Optional[str] = ""
    owner_social_links: Optional[str] = ""
    # Co-founders
    co_founders: Optional[List[str]] = []
    # Representative
    representative_name: Optional[str] = ""
    representative_phone: Optional[str] = ""
    representative_email: Optional[str] = ""
    # Company contacts
    company_phone: Optional[str] = ""
    company_website: Optional[str] = ""
    company_social_links: Optional[str] = ""
    # Children info (owner's)
    children_count: Optional[int] = 0
    children_info: Optional[List[Dict]] = []
    # Reference
    reference_source: Optional[str] = ""  # Media, Partnyor, Digər
    reference_person: Optional[str] = ""
    reference_company: Optional[str] = ""
    # Marsol
    marsol_representative: str
    # Project/Package
    joined_project: str  # Üzvlük, Sərgi, Təlim, ICMA, Sosial layihə
    package: str  # Premium, Business, Business Plus
    # Contract
    contract_start_date: Optional[str] = ""
    contract_end_date: Optional[str] = ""
    contract_file: Optional[str] = ""
    # Payment
    total_amount: Optional[float] = 0
    paid_amount: Optional[float] = 0
    debt_amount: Optional[float] = 0
    last_payment_date: Optional[str] = ""
    payment_due_date: Optional[str] = ""
    # Status
    status: Optional[str] = "Aktiv"

class CompanyUpdate(BaseModel):
    brand_name: Optional[str] = None
    legal_name: Optional[str] = None
    sector: Optional[str] = None
    company_size: Optional[str] = None
    registration_date: Optional[str] = None
    address: Optional[str] = None
    bank_details: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_email: Optional[str] = None
    owner_social_links: Optional[str] = None
    co_founders: Optional[List[str]] = None
    representative_name: Optional[str] = None
    representative_phone: Optional[str] = None
    representative_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_website: Optional[str] = None
    company_social_links: Optional[str] = None
    children_count: Optional[int] = None
    children_info: Optional[List[Dict]] = None
    reference_source: Optional[str] = None
    reference_person: Optional[str] = None
    reference_company: Optional[str] = None
    marsol_representative: Optional[str] = None
    joined_project: Optional[str] = None
    package: Optional[str] = None
    contract_start_date: Optional[str] = None
    contract_end_date: Optional[str] = None
    contract_file: Optional[str] = None
    total_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    debt_amount: Optional[float] = None
    last_payment_date: Optional[str] = None
    payment_due_date: Optional[str] = None
    status: Optional[str] = None

# Employee Model
class EmployeeCreate(BaseModel):
    photo: Optional[str] = ""
    full_name: str
    father_name: Optional[str] = ""
    birth_date: Optional[str] = ""
    gender: str
    id_card_number: Optional[str] = ""
    fin_code: Optional[str] = ""
    education_level: Optional[str] = ""
    education_institution: Optional[str] = ""
    marital_status: Optional[str] = ""
    children_count: Optional[int] = 0
    registration_address: Optional[str] = ""
    actual_address: Optional[str] = ""
    company_phone: Optional[str] = ""
    personal_phone: str
    email: str
    emergency_contact_name: Optional[str] = ""
    emergency_contact_relation: Optional[str] = ""
    emergency_contact_phone: Optional[str] = ""
    # Contract
    department: str
    position: str
    contract_start_date: Optional[str] = ""
    work_start_date: Optional[str] = ""
    contract_end_date: Optional[str] = ""
    probation_end_date: Optional[str] = ""
    main_vacation_days: Optional[int] = 21
    additional_vacation_days: Optional[int] = 0
    gross_salary: Optional[float] = 0
    net_salary: Optional[float] = 0
    work_schedule: Optional[str] = ""
    status: Optional[str] = "Aktiv"

# Finance Models
class IncomeCreate(BaseModel):
    company_id: str
    company_name: str
    owner_name: str
    marsol_representative: str
    project: str
    package: str
    amount: float
    paid_amount: Optional[float] = 0
    debt_amount: Optional[float] = 0
    currency: Optional[str] = "AZN"
    contract_start_date: Optional[str] = ""
    contract_end_date: Optional[str] = ""
    payment_method: Optional[str] = ""
    marsol_company: Optional[str] = ""

class ExpenseCreate(BaseModel):
    expense_name: str
    category: str
    sub_category: Optional[str] = ""
    amount: float
    currency: Optional[str] = "AZN"
    date: str
    project: Optional[str] = ""
    department: Optional[str] = ""
    responsible_person: Optional[str] = ""
    payment_type: Optional[str] = ""
    payment_method: Optional[str] = ""
    status: Optional[str] = "Ödənilib"
    marsol_company: Optional[str] = ""

# Task Model
class TaskCreate(BaseModel):
    task_name: str
    department: Optional[str] = ""
    assignee: Optional[str] = ""
    responsible_person: Optional[str] = ""
    priority: str  # Yüksək, Orta, Aşağı
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    related_object_type: Optional[str] = ""
    related_object_id: Optional[str] = ""
    related_object: Optional[str] = ""
    phase: Optional[str] = ""
    status: Optional[str] = "Gözləyir"
    notes: Optional[str] = ""

# Meeting Model  
class MeetingCreate(BaseModel):
    employee: str
    meeting_setter: str
    date: str
    time: str
    company: Optional[str] = ""
    contact_person: Optional[str] = ""
    project: Optional[str] = ""
    meeting_type: str
    meeting_mode: Optional[str] = "Offline"
    department: Optional[str] = ""
    location: Optional[str] = ""
    result: Optional[str] = ""
    next_meeting: Optional[str] = ""
    notes: Optional[str] = ""
    reminders: Optional[list] = []

# ==================== AUTH FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== RBAC HELPER ====================

MODULES = [
    "dashboard", "companies", "hr", "sales", "members", "obligations",
    "finance", "organization", "meetings", "assembly", "tasks",
    "marketing", "projects", "reports", "messages", "files", "notes",
    "settings", "notifications"
]

async def get_user_permissions(user: dict) -> dict:
    """Get merged permissions for a user based on their role"""
    if user.get("role") == "admin":
        return {m: "write" for m in MODULES}
    role_name = user.get("role", "")
    if role_name:
        role = await db.roles.find_one({"name": role_name}, {"_id": 0})
        if role:
            return role.get("permissions", {})
    return {m: "read" for m in MODULES}

def check_permission(module: str, level: str = "read"):
    """Dependency: check if current user has required permission for a module"""
    async def checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") == "admin":
            return current_user
        perms = await get_user_permissions(current_user)
        user_level = perms.get(module, "none")
        if level == "read" and user_level in ("read", "write"):
            return current_user
        if level == "write" and user_level == "write":
            return current_user
        raise HTTPException(status_code=403, detail="Bu əməliyyat üçün icazəniz yoxdur")
    return checker

# ==================== SCOPE (RECORD-LEVEL VISIBILITY) HELPER ====================
# Each module defines which stored fields identify "ownership" of a record.
# If a role has scopes[module] == "own", only records where one of these
# fields equals the user's name are visible / editable. Default is "all".
SCOPE_FIELDS = {
    "members": ["curator", "created_by"],
    "companies": ["curator", "created_by"],
    "tasks": ["assignee", "responsible_person", "created_by"],
    "meetings": ["employee", "meeting_setter", "created_by"],
    "sales": ["curator", "created_by"],
    "projects": ["created_by"],
    "assembly": ["created_by", "curator"],
}

async def get_user_scopes(user: dict) -> dict:
    if user.get("role") == "admin":
        return {}
    role = await db.roles.find_one({"name": user.get("role", "")}, {"_id": 0})
    if not role:
        return {}
    return role.get("scopes", {}) or {}

async def apply_scope(query: dict, user: dict, module: str) -> dict:
    """Merge scope-based ownership filter into query. Returns new query dict."""
    if user.get("role") == "admin":
        return query
    scopes = await get_user_scopes(user)
    if scopes.get(module, "all") != "own":
        return query
    fields = SCOPE_FIELDS.get(module, [])
    if not fields:
        return query
    user_name = user.get("name", "")
    clauses = [{f: user_name} for f in fields]
    if "$or" in query or "$and" in query:
        return {"$and": [query, {"$or": clauses}]}
    new_query = dict(query)
    new_query["$or"] = clauses
    return new_query

async def assert_scope_ownership(user: dict, module: str, record: Optional[dict]):
    """Raise 403 if user has 'own' scope and record is not theirs."""
    if user.get("role") == "admin" or not record:
        return
    scopes = await get_user_scopes(user)
    if scopes.get(module, "all") != "own":
        return
    fields = SCOPE_FIELDS.get(module, [])
    user_name = user.get("name", "")
    if any(record.get(f) == user_name for f in fields):
        return
    raise HTTPException(status_code=403, detail="Bu qeyd sizə aid deyil")


async def _user_email_by_name(name: str) -> Optional[str]:
    """Look up a system user's email by display name."""
    if not name:
        return None
    user = await db.users.find_one({"name": name}, {"_id": 0, "email": 1})
    return user.get("email") if user else None


async def _email_notify_safe(**kwargs) -> bool:
    """Wrapper that logs but never raises so notifications never break the API.
    Returns True if at least one recipient received the email."""
    try:
        from email_service import notify as _en
        return bool(await _en(**kwargs))
    except Exception as e:
        logging.error("Email notify failed: %s", e)
        return False

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token({"sub": user_id})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={"id": user_id, "email": user_data.email, "name": user_data.name, "role": "admin"}
    )

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Yanlış email və ya şifrə")
    
    access_token = create_access_token({"sub": user["id"]})
    user_dict = {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}
    perms = await get_user_permissions(user)
    user_dict["permissions"] = perms
    # Record system session (for Davamiyyət — Sistem fəaliyyəti)
    try:
        now = datetime.now(timezone.utc)
        await db.user_sessions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "user_email": user["email"],
            "user_name": user["name"],
            "login_at": now.isoformat(),
            "last_active_at": now.isoformat(),
            "logout_at": None,
        })
    except Exception as e:
        logging.error("Session record failed: %s", e)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_dict
    )

@api_router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Mark the user's most recent open session as closed."""
    now = datetime.now(timezone.utc).isoformat()
    await db.user_sessions.update_one(
        {"user_id": current_user["id"], "logout_at": None},
        {"$set": {"logout_at": now, "last_active_at": now}},
        upsert=False,
    )
    return {"ok": True}

@api_router.post("/auth/heartbeat")
async def heartbeat(current_user: dict = Depends(get_current_user)):
    """Bumps last_active_at on the latest open session so we can compute
    accurate active duration even when the user closes the tab without logout."""
    now = datetime.now(timezone.utc).isoformat()
    await db.user_sessions.update_one(
        {"user_id": current_user["id"], "logout_at": None},
        {"$set": {"last_active_at": now}},
        upsert=False,
    )
    return {"ok": True, "ts": now}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== DASHBOARD ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get real counts from database
    companies_count = await db.companies.count_documents({})
    employees_count = await db.employees.count_documents({})
    tasks_count = await db.tasks.count_documents({})
    meetings_count = await db.meetings.count_documents({})
    
    # Events stats
    events_count = await db.events.count_documents({})
    invitations_count = await db.invitations.count_documents({})
    events_type_pipeline = [
        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    events_by_type = await db.events.aggregate(events_type_pipeline).to_list(20)
    
    # Invitations stats
    inv_attended = await db.invitations.count_documents({"participation_status": "Qatılır"})
    inv_declined = await db.invitations.count_documents({"participation_status": "Qatılmır"})
    inv_no_answer = await db.invitations.count_documents({"call_status": "Cavab vermədi"})
    inv_pending = await db.invitations.count_documents({"call_status": "Gözləyir"})
    
    # Invitations by event type
    inv_type_pipeline = [
        {"$group": {"_id": "$event_type", "total": {"$sum": 1},
                     "attended": {"$sum": {"$cond": [{"$eq": ["$participation_status", "Qatılır"]}, 1, 0]}},
                     "declined": {"$sum": {"$cond": [{"$eq": ["$participation_status", "Qatılmır"]}, 1, 0]}}}},
        {"$sort": {"total": -1}}
    ]
    inv_by_type = await db.invitations.aggregate(inv_type_pipeline).to_list(20)
    
    # Get companies by package
    premium_count = await db.companies.count_documents({"package": "Premium"})
    business_count = await db.companies.count_documents({"package": "Business"})
    business_plus_count = await db.companies.count_documents({"package": "Business Plus"})
    
    # Get companies by sector
    sectors_pipeline = [
        {"$group": {"_id": "$sector", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    sectors_data = await db.companies.aggregate(sectors_pipeline).to_list(20)
    
    # Calculate financials from companies
    company_finance_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}, "paid": {"$sum": "$paid_amount"}, "debt": {"$sum": "$debt_amount"}}}
    ]
    company_finance = await db.companies.aggregate(company_finance_pipeline).to_list(1)
    
    expense_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    expense_data = await db.expenses.aggregate(expense_pipeline).to_list(1)
    
    total_income = company_finance[0]["total"] if company_finance else 0
    total_paid = company_finance[0]["paid"] if company_finance else 0
    total_debt = company_finance[0]["debt"] if company_finance else 0
    total_expenses = expense_data[0]["total"] if expense_data else 0
    
    # Build sector breakdown with colors
    colors = ["#3D4F6F", "#9ACD32", "#64748B", "#94A3B8", "#CBD5E1", "#2A364C", "#475569", "#334155"]
    sector_breakdown = [
        {"name": s["_id"] or "Digər", "count": s["count"], "color": colors[i % len(colors)]}
        for i, s in enumerate(sectors_data)
    ]
    
    return {
        "companies": {
            "total": companies_count,
            "breakdown": [
                {"name": "Premium paket", "count": premium_count, "color": "#3D4F6F"},
                {"name": "Business paket", "count": business_count, "color": "#9ACD32"},
                {"name": "Business Plus paket", "count": business_plus_count, "color": "#64748B"}
            ]
        },
        "employees": {
            "total": employees_count
        },
        "tasks": {
            "total": tasks_count,
            "pending": await db.tasks.count_documents({"status": "Gözləyir"}),
            "in_progress": await db.tasks.count_documents({"status": "İcrada"}),
            "completed": await db.tasks.count_documents({"status": "Tamamlandı"})
        },
        "meetings": {
            "total": meetings_count
        },
        "events": {
            "total": events_count,
            "by_type": [{"name": e["_id"] or "Digər", "count": e["count"]} for e in events_by_type],
        },
        "invitations": {
            "total": invitations_count,
            "attended": inv_attended,
            "declined": inv_declined,
            "no_answer": inv_no_answer,
            "pending": inv_pending,
            "by_type": [{"name": i["_id"] or "Digər", "total": i["total"], "attended": i["attended"], "declined": i["declined"]} for i in inv_by_type],
        },
        "sectors": {
            "total": len(sectors_data),
            "breakdown": sector_breakdown
        },
        "financials": {
            "income": total_income,
            "paid": total_paid,
            "debt": total_debt,
            "expenses": total_expenses,
            "profit": total_income - total_expenses,
            "currency": "AZN"
        },
        "payments": {
            "total": total_income,
            "paid": total_paid,
            "remaining": total_debt,
            "currency": "AZN"
        }
    }

# ==================== COMPANIES (ŞİRKƏT MƏLUMATLARI) ====================

@api_router.get("/companies")
async def get_companies(
    sector: Optional[str] = None,
    package: Optional[str] = None,
    company_size: Optional[str] = None,
    marsol_representative: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if sector and sector != "all":
        query["sector"] = sector
    if package and package != "all":
        query["package"] = package
    if company_size and company_size != "all":
        query["company_size"] = company_size
    if marsol_representative and marsol_representative != "all":
        query["marsol_representative"] = marsol_representative
    if status and status != "all":
        query["status"] = status
    query = await apply_scope(query, current_user, "companies")
    companies = await db.companies.find(query, {"_id": 0}).sort("created_at", 1).to_list(1000)
    # Compute finance_id (FN001, FN002...) and contract_days
    today = datetime.now(timezone.utc).date()
    for idx, c in enumerate(companies):
        c["finance_id"] = f"FN{str(idx + 1).zfill(3)}"
        cs = c.get("contract_start_date", "")
        if cs:
            try:
                d = datetime.strptime(cs, "%Y-%m-%d").date()
                c["contract_days"] = (today - d).days
            except (ValueError, TypeError):
                c["contract_days"] = None
        else:
            c["contract_days"] = None
    return companies

@api_router.post("/companies")
async def create_company(company_data: dict, current_user: dict = Depends(check_permission("companies", "write"))):
    company_id = str(uuid.uuid4())
    company_doc = {
        "id": company_id,
        **company_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Calculate debt
    total = company_doc.get("total_amount", 0) or 0
    paid = company_doc.get("paid_amount", 0) or 0
    company_doc["debt_amount"] = total - paid
    
    await db.companies.insert_one(company_doc)
    company_doc.pop("_id", None)
    return company_doc

@api_router.get("/companies/{company_id}")
async def get_company(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    return company

@api_router.put("/companies/{company_id}")
async def update_company(company_id: str, company_data: dict, current_user: dict = Depends(check_permission("companies", "write"))):
    update_data = {k: v for k, v in company_data.items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Yenilənəcək məlumat yoxdur")
    
    # Recalculate debt if amounts changed
    if "total_amount" in update_data or "paid_amount" in update_data:
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        total = update_data.get("total_amount", company.get("total_amount", 0)) or 0
        paid = update_data.get("paid_amount", company.get("paid_amount", 0)) or 0
        update_data["debt_amount"] = total - paid
    
    result = await db.companies.update_one({"id": company_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return company

# Update finance note and payment info for a company
@api_router.put("/companies/{company_id}/finance")
async def update_company_finance(company_id: str, data: dict, current_user: dict = Depends(check_permission("finance", "write"))):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    
    update_data = {}
    
    # Handle new payment (additive)
    new_payment = data.get("new_payment_amount")
    if new_payment and float(new_payment) > 0:
        payment_amount = float(new_payment)
        old_paid = float(company.get("paid_amount", 0) or 0)
        total = float(company.get("total_amount", 0) or company.get("payment_amount", 0) or 0)
        new_paid = old_paid + payment_amount
        update_data["paid_amount"] = new_paid
        update_data["debt_amount"] = total - new_paid
        update_data["last_payment_date"] = data.get("payment_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        
        # Save payment history
        payment_record = {
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "amount": payment_amount,
            "date": data.get("payment_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "note": data.get("payment_note", ""),
            "payment_method": data.get("payment_method", ""),
            "recorded_by": current_user.get("name", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_history.insert_one(payment_record)
    
    # Handle direct field updates (total_amount, finance_note, contract dates, finance tracking fields)
    for key in ["finance_note", "total_amount", "payment_amount", "last_payment_date",
                "contract_start_date", "contract_end_date", "contract_status",
                "finance_contract_number", "payment_due_date", "voen",
                "e_invoice_date", "e_invoice_number", "follow_up", "marsol_company"]:
        if key in data and key != "new_payment_amount":
            update_data[key] = data[key]
    
    # Recalculate debt if total changed
    if "total_amount" in update_data or "payment_amount" in update_data:
        total = float(update_data.get("total_amount", update_data.get("payment_amount", company.get("total_amount", 0) or company.get("payment_amount", 0))) or 0)
        paid = float(update_data.get("paid_amount", company.get("paid_amount", 0)) or 0)
        update_data["debt_amount"] = total - paid
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Yenilənəcək məlumat yoxdur")
    
    await db.companies.update_one({"id": company_id}, {"$set": update_data})
    updated = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return updated

@api_router.get("/companies/{company_id}/payments")
async def get_payment_history(company_id: str, current_user: dict = Depends(get_current_user)):
    payments = await db.payment_history.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return payments

@api_router.delete("/companies/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(check_permission("companies", "write"))):
    result = await db.companies.delete_one({"id": company_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    return {"message": "Şirkət silindi"}

# ==================== EMPLOYEES (İNSAN RESURSLARI) ====================

@api_router.get("/employees")
async def get_employees(
    department: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if department and department != "all":
        query["department"] = department
    if status and status != "all":
        query["status"] = status
    
    employees = await db.employees.find(query, {"_id": 0}).to_list(1000)
    return employees

@api_router.post("/employees")
async def create_employee(employee_data: dict, current_user: dict = Depends(check_permission("hr", "write"))):
    employee_id = str(uuid.uuid4())
    # Auto-generate employee code (E001, E002...)
    count = await db.employees.count_documents({})
    employee_code = f"E{str(count + 1).zfill(3)}"
    employee_doc = {
        "id": employee_id,
        "employee_code": employee_code,
        **employee_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.employees.insert_one(employee_doc)
    employee_doc.pop("_id", None)
    return employee_doc

@api_router.get("/employees/{employee_id}")
async def get_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    employee = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Əməkdaş tapılmadı")
    return employee

@api_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, employee_data: dict, current_user: dict = Depends(check_permission("hr", "write"))):
    update_data = {k: v for k, v in employee_data.items() if v is not None}
    result = await db.employees.update_one({"id": employee_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Əməkdaş tapılmadı")
    employee = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    return employee

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, current_user: dict = Depends(check_permission("hr", "write"))):
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Əməkdaş tapılmadı")
    return {"message": "Əməkdaş silindi"}

# ==================== ATTENDANCE (DAVAMİYYƏT) ====================

ATTENDANCE_STATUSES = ["İşdə", "Gəlməyib", "Məzuniyyət", "Xəstəlik", "İcazəli", "Uzaq"]

@api_router.get("/attendance")
async def get_attendance(
    date: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if date:
        query["date"] = date
    elif start and end:
        query["date"] = {"$gte": start, "$lte": end}
    if employee_id:
        query["employee_id"] = employee_id
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    return records

@api_router.post("/attendance")
async def upsert_attendance(data: dict, current_user: dict = Depends(check_permission("hr", "write"))):
    employee_id = data.get("employee_id", "")
    date = data.get("date", "")
    if not employee_id or not date:
        raise HTTPException(status_code=400, detail="employee_id və date tələb olunur")
    emp = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    update = {
        "employee_id": employee_id,
        "employee_name": (emp.get("full_name") or f"{emp.get('first_name','')} {emp.get('last_name','')}".strip()) if emp else data.get("employee_name", ""),
        "date": date,
        "status": data.get("status", "İşdə"),
        "check_in": data.get("check_in", ""),
        "check_out": data.get("check_out", ""),
        "notes": data.get("notes", ""),
        "updated_by": current_user.get("name", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    existing = await db.attendance.find_one({"employee_id": employee_id, "date": date})
    if existing:
        await db.attendance.update_one({"employee_id": employee_id, "date": date}, {"$set": update})
        update["id"] = existing["id"]
    else:
        update["id"] = str(uuid.uuid4())
        update["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.attendance.insert_one(dict(update))
    update.pop("_id", None)
    return update

@api_router.post("/attendance/bulk")
async def bulk_attendance(data: dict, current_user: dict = Depends(check_permission("hr", "write"))):
    date = data.get("date", "")
    records = data.get("records", [])
    if not date or not records:
        raise HTTPException(status_code=400, detail="date və records tələb olunur")
    count = 0
    for r in records:
        emp = await db.employees.find_one({"id": r.get("employee_id", "")}, {"_id": 0})
        doc = {
            "employee_id": r.get("employee_id", ""),
            "employee_name": (emp.get("full_name") or f"{emp.get('first_name','')} {emp.get('last_name','')}".strip()) if emp else "",
            "date": date,
            "status": r.get("status", "İşdə"),
            "check_in": r.get("check_in", ""),
            "check_out": r.get("check_out", ""),
            "notes": r.get("notes", ""),
            "updated_by": current_user.get("name", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        existing = await db.attendance.find_one({"employee_id": doc["employee_id"], "date": date})
        if existing:
            await db.attendance.update_one({"employee_id": doc["employee_id"], "date": date}, {"$set": doc})
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.attendance.insert_one(dict(doc))
        count += 1
    return {"message": f"{count} qeyd saxlanıldı"}

@api_router.get("/attendance/stats")
async def attendance_stats(month: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    start = f"{month}-01"
    end = f"{month}-31"
    records = await db.attendance.find({"date": {"$gte": start, "$lte": end}}, {"_id": 0}).to_list(10000)
    employees = await db.employees.find({"status": "Aktiv"}, {"_id": 0}).to_list(1000)
    per_employee = {}
    for e in employees:
        eid = e["id"]
        per_employee[eid] = {
            "employee_id": eid,
            "employee_name": e.get("full_name") or f"{e.get('first_name','')} {e.get('last_name','')}".strip(),
            "department": e.get("department", ""),
            "position": e.get("position", ""),
            **{s: 0 for s in ATTENDANCE_STATUSES}
        }
    for r in records:
        eid = r.get("employee_id", "")
        st = r.get("status", "")
        if eid in per_employee and st in per_employee[eid]:
            per_employee[eid][st] += 1
    totals = {s: sum(p[s] for p in per_employee.values()) for s in ATTENDANCE_STATUSES}
    return {"month": month, "per_employee": list(per_employee.values()), "totals": totals}

@api_router.delete("/attendance/{record_id}")
async def delete_attendance(record_id: str, current_user: dict = Depends(check_permission("hr", "write"))):
    await db.attendance.delete_one({"id": record_id})
    return {"message": "Qeyd silindi"}

@api_router.get("/attendance/system-sessions")
async def attendance_system_sessions(
    date: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: dict = Depends(check_permission("hr", "read")),
):
    """Returns user login/logout sessions with active duration in seconds.

    - `date` filter (YYYY-MM-DD) keeps sessions whose login_at is on that day
    - Open sessions (logout_at is null) report active_seconds based on last_active_at
    """
    query: Dict[str, Any] = {}
    if user_id:
        query["user_id"] = user_id
    if date:
        # date filter on login_at prefix (ISO strings start with YYYY-MM-DD)
        query["login_at"] = {"$regex": f"^{date}"}
    sessions = await db.user_sessions.find(query, {"_id": 0}).sort("login_at", -1).to_list(2000)

    def _parse(ts: Optional[str]) -> Optional[datetime]:
        if not ts:
            return None
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return None

    out = []
    now_dt = datetime.now(timezone.utc)
    for s in sessions:
        login_dt = _parse(s.get("login_at"))
        logout_dt = _parse(s.get("logout_at"))
        last_dt = _parse(s.get("last_active_at"))
        is_open = s.get("logout_at") is None
        # For open sessions report a LIVE duration (now - login) so the UI is
        # accurate without waiting for the next heartbeat.
        if is_open:
            end = now_dt
        else:
            end = logout_dt or last_dt or login_dt
        active_seconds = 0
        if login_dt and end:
            active_seconds = max(0, int((end - login_dt).total_seconds()))
        out.append({
            **s,
            "active_seconds": active_seconds,
            "is_open": is_open,
        })
    return out

# ==================== LEAVE REQUESTS (MƏZUNİYYƏT SORĞULARI) ====================

@api_router.get("/leave-requests")
async def get_leave_requests(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if status and status != "all":
        query["status"] = status
    items = await db.leave_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@api_router.post("/leave-requests")
async def create_leave_request(data: dict, current_user: dict = Depends(check_permission("hr", "write"))):
    emp = await db.employees.find_one({"id": data.get("employee_id", "")}, {"_id": 0})
    doc = {
        "id": str(uuid.uuid4()),
        "employee_id": data.get("employee_id", ""),
        "employee_name": (emp.get("full_name") or f"{emp.get('first_name','')} {emp.get('last_name','')}".strip()) if emp else "",
        "type": data.get("type", "Məzuniyyət"),
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "reason": data.get("reason", ""),
        "status": "Gözləyir",
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.leave_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/leave-requests/{req_id}")
async def update_leave_request(req_id: str, data: dict, current_user: dict = Depends(check_permission("hr", "write"))):
    update = {k: v for k, v in data.items() if k not in ("id",)}
    update["updated_by"] = current_user.get("name", "")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.leave_requests.update_one({"id": req_id}, {"$set": update})
    # If approved, auto-fill attendance records for the period
    if update.get("status") == "Təsdiqlənib":
        req = await db.leave_requests.find_one({"id": req_id}, {"_id": 0})
        if req and req.get("start_date") and req.get("end_date"):
            try:
                from datetime import date as _date, timedelta
                s = datetime.strptime(req["start_date"], "%Y-%m-%d").date()
                e = datetime.strptime(req["end_date"], "%Y-%m-%d").date()
                att_status = "Xəstəlik" if req.get("type") == "Xəstəlik" else "Məzuniyyət"
                cur = s
                while cur <= e:
                    ds = cur.strftime("%Y-%m-%d")
                    existing = await db.attendance.find_one({"employee_id": req["employee_id"], "date": ds})
                    att_doc = {
                        "employee_id": req["employee_id"],
                        "employee_name": req.get("employee_name", ""),
                        "date": ds,
                        "status": att_status,
                        "notes": f"Sorğu: {req.get('reason', '')}",
                        "updated_by": current_user.get("name", ""),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    if existing:
                        await db.attendance.update_one({"employee_id": req["employee_id"], "date": ds}, {"$set": att_doc})
                    else:
                        att_doc["id"] = str(uuid.uuid4())
                        att_doc["created_at"] = datetime.now(timezone.utc).isoformat()
                        await db.attendance.insert_one(dict(att_doc))
                    cur += timedelta(days=1)
            except (ValueError, TypeError):
                pass
    doc = await db.leave_requests.find_one({"id": req_id}, {"_id": 0})
    return doc

@api_router.delete("/leave-requests/{req_id}")
async def delete_leave_request(req_id: str, current_user: dict = Depends(check_permission("hr", "write"))):
    await db.leave_requests.delete_one({"id": req_id})
    return {"message": "Sorğu silindi"}

# ==================== FINANCE (MALİYYƏ) ====================

@api_router.get("/finance/incomes")
async def get_incomes(current_user: dict = Depends(get_current_user)):
    incomes = await db.incomes.find({}, {"_id": 0}).to_list(1000)
    return incomes

@api_router.post("/finance/incomes")
async def create_income(income_data: IncomeCreate, current_user: dict = Depends(check_permission("finance", "write"))):
    income_id = str(uuid.uuid4())
    income_doc = {
        "id": income_id,
        **income_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    income_doc["debt_amount"] = income_doc["amount"] - income_doc["paid_amount"]
    await db.incomes.insert_one(income_doc)
    income_doc.pop("_id", None)
    return income_doc

@api_router.put("/finance/incomes/{income_id}")
async def update_income(income_id: str, income_data: dict, current_user: dict = Depends(check_permission("finance", "write"))):
    update_data = {k: v for k, v in income_data.items() if v is not None}
    if "amount" in update_data or "paid_amount" in update_data:
        current = await db.incomes.find_one({"id": income_id}, {"_id": 0})
        if current:
            amount = update_data.get("amount", current.get("amount", 0))
            paid = update_data.get("paid_amount", current.get("paid_amount", 0))
            update_data["debt_amount"] = amount - paid
    result = await db.incomes.update_one({"id": income_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Gəlir tapılmadı")
    income = await db.incomes.find_one({"id": income_id}, {"_id": 0})
    return income

@api_router.delete("/finance/incomes/{income_id}")
async def delete_income(income_id: str, current_user: dict = Depends(check_permission("finance", "write"))):
    result = await db.incomes.delete_one({"id": income_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gəlir tapılmadı")
    return {"message": "Gəlir silindi"}

@api_router.get("/finance/expenses")
async def get_expenses(current_user: dict = Depends(get_current_user)):
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
    return expenses

@api_router.post("/finance/expenses")
async def create_expense(expense_data: ExpenseCreate, current_user: dict = Depends(check_permission("finance", "write"))):
    expense_id = str(uuid.uuid4())
    expense_doc = {
        "id": expense_id,
        **expense_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.expenses.insert_one(expense_doc)
    expense_doc.pop("_id", None)
    return expense_doc

@api_router.put("/finance/expenses/{expense_id}")
async def update_expense(expense_id: str, expense_data: dict, current_user: dict = Depends(check_permission("finance", "write"))):
    update_data = {k: v for k, v in expense_data.items() if v is not None}
    result = await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Xərc tapılmadı")
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    return expense

@api_router.delete("/finance/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(check_permission("finance", "write"))):
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Xərc tapılmadı")
    return {"message": "Xərc silindi"}

# ==================== BARTER ƏMƏLİYYATLARI ====================

BARTER_STATUSES = ["Təklif", "Müzakirədə", "Aktiv", "Tamamlandı", "Ləğv edilib"]

@api_router.get("/barters")
async def get_barters(
    status: Optional[str] = None,
    partner_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status and status != "all":
        query["status"] = status
    if partner_id:
        query["partner_id"] = partner_id
    items = await db.barters.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@api_router.post("/barters")
async def create_barter(data: dict, current_user: dict = Depends(check_permission("finance", "write"))):
    count = await db.barters.count_documents({})
    doc = {
        "id": str(uuid.uuid4()),
        "barter_code": f"B-{str(count + 1).zfill(3)}",
        "partner_id": data.get("partner_id", ""),
        "partner_name": data.get("partner_name", ""),
        "partner_contact": data.get("partner_contact", ""),
        "partner_phone": data.get("partner_phone", ""),
        "our_service": data.get("our_service", ""),
        "their_service": data.get("their_service", ""),
        "our_value": float(data.get("our_value", 0) or 0),
        "their_value": float(data.get("their_value", 0) or 0),
        "status": data.get("status", "Təklif"),
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "notes": data.get("notes", ""),
        "responsible": data.get("responsible", current_user.get("name", "")),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.barters.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/barters/{barter_id}")
async def update_barter(barter_id: str, data: dict, current_user: dict = Depends(check_permission("finance", "write"))):
    update = {k: v for k, v in data.items() if k not in ("id", "barter_code", "created_at", "created_by")}
    if "our_value" in update:
        update["our_value"] = float(update["our_value"] or 0)
    if "their_value" in update:
        update["their_value"] = float(update["their_value"] or 0)
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.barters.update_one({"id": barter_id}, {"$set": update})
    doc = await db.barters.find_one({"id": barter_id}, {"_id": 0})
    return doc

@api_router.delete("/barters/{barter_id}")
async def delete_barter(barter_id: str, current_user: dict = Depends(check_permission("finance", "write"))):
    await db.barters.delete_one({"id": barter_id})
    return {"message": "Barter silindi"}

@api_router.get("/barters/stats")
async def barter_stats(current_user: dict = Depends(get_current_user)):
    items = await db.barters.find({}, {"_id": 0}).to_list(5000)
    by_status = {s: 0 for s in BARTER_STATUSES}
    total_our = 0
    total_their = 0
    active_count = 0
    for b in items:
        st = b.get("status", "Təklif")
        if st in by_status:
            by_status[st] += 1
        if st in ("Aktiv", "Tamamlandı"):
            total_our += b.get("our_value", 0) or 0
            total_their += b.get("their_value", 0) or 0
        if st == "Aktiv":
            active_count += 1
    return {
        "total": len(items),
        "active": active_count,
        "by_status": by_status,
        "total_our_value": round(total_our, 2),
        "total_their_value": round(total_their, 2),
        "net_balance": round(total_their - total_our, 2)
    }

@api_router.get("/finance/summary")
async def get_finance_summary(current_user: dict = Depends(get_current_user)):
    income_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "paid": {"$sum": "$paid_amount"}, "debt": {"$sum": "$debt_amount"}}}
    ]
    expense_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    income_data = await db.incomes.aggregate(income_pipeline).to_list(1)
    expense_data = await db.expenses.aggregate(expense_pipeline).to_list(1)
    
    total_income = income_data[0]["total"] if income_data else 0
    total_paid = income_data[0]["paid"] if income_data else 0
    total_debt = income_data[0]["debt"] if income_data else 0
    total_expenses = expense_data[0]["total"] if expense_data else 0
    
    return {
        "total_income": total_income,
        "paid_income": total_paid,
        "debt": total_debt,
        "total_expenses": total_expenses,
        "net_profit": total_income - total_expenses,
        "current_profit": total_paid - total_expenses,
        "currency": "AZN"
    }

# ==================== TASKS (TAPŞIRIQLAR) ====================

@api_router.get("/tasks")
async def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status and status != "all":
        query["status"] = status
    if priority and priority != "all":
        query["priority"] = priority
    if assignee and assignee != "all":
        query["assignee"] = {"$regex": assignee, "$options": "i"}
    query = await apply_scope(query, current_user, "tasks")
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tasks

@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, current_user: dict = Depends(check_permission("tasks", "write"))):
    count = await db.tasks.count_documents({})
    task_code = f"T-{str(count + 1).zfill(3)}"
    task_doc = {
        "id": str(uuid.uuid4()),
        "task_code": task_code,
        **task_data.model_dump(),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(task_doc)
    task_doc.pop("_id", None)
    return task_doc

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task_data: dict, current_user: dict = Depends(check_permission("tasks", "write"))):
    existing = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Tapşırıq tapılmadı")
    await assert_scope_ownership(current_user, "tasks", existing)
    update_data = {k: v for k, v in task_data.items() if v is not None}
    result = await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tapşırıq tapılmadı")
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(check_permission("tasks", "write"))):
    existing = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Tapşırıq tapılmadı")
    await assert_scope_ownership(current_user, "tasks", existing)
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tapşırıq tapılmadı")
    return {"message": "Tapşırıq silindi"}

# ==================== MEETINGS (GÖRÜŞLƏR) ====================

@api_router.get("/meetings")
async def get_meetings(
    meeting_type: Optional[str] = None,
    department: Optional[str] = None,
    employee: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if meeting_type and meeting_type != "all":
        query["meeting_type"] = meeting_type
    if department and department != "all":
        query["department"] = department
    if employee and employee != "all":
        query["employee"] = employee
    if date_from:
        query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to
    query = await apply_scope(query, current_user, "meetings")
    
    meetings = await db.meetings.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return meetings

@api_router.post("/meetings")
async def create_meeting(data: dict, current_user: dict = Depends(check_permission("meetings", "write"))):
    meeting_id = str(uuid.uuid4())
    meeting_doc = {
        "id": meeting_id,
        "employee": data.get("employee", ""),
        "meeting_setter": data.get("meeting_setter", ""),
        "date": data.get("date", ""),
        "time": data.get("time", ""),
        "company": data.get("company", ""),
        "contact_person": data.get("contact_person", ""),
        "project": data.get("project", ""),
        "meeting_type": data.get("meeting_type", ""),
        "meeting_mode": data.get("meeting_mode", "Offline"),
        "department": data.get("department", ""),
        "location": data.get("location", ""),
        "result": data.get("result", ""),
        "next_meeting": data.get("next_meeting", ""),
        "notes": data.get("notes", ""),
        "reminders": data.get("reminders", []),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.meetings.insert_one(meeting_doc)
    meeting_doc.pop("_id", None)
    # Create notification for each reminder
    for rem in meeting_doc.get("reminders", []):
        notif_doc = {
            "id": str(uuid.uuid4()),
            "title": f"Görüş xatırlatması: {meeting_doc['meeting_type']}",
            "message": f"{meeting_doc['date']} {meeting_doc['time']} - {meeting_doc['company'] or meeting_doc['employee']}. {rem.get('note', '')}",
            "type": "reminder",
            "meeting_id": meeting_id,
            "reminder_date": rem.get("date", ""),
            "reminder_time": rem.get("time", ""),
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notif_doc)
    
    # Email notify the meeting employee + setter (and admin)
    emp_email = await _user_email_by_name(meeting_doc.get("employee", ""))
    setter_email = await _user_email_by_name(meeting_doc.get("meeting_setter", ""))
    body = f"""<p>Yeni görüş təyin edildi:</p>
    <table cellpadding='6' cellspacing='0' style='width:100%;border:1px solid #e2e8f0;border-radius:8px;font-size:13px'>
      <tr><td style='color:#64748b'>Tarix</td><td style='font-weight:600'>{meeting_doc.get('date', '')} {meeting_doc.get('time', '')}</td></tr>
      <tr><td style='color:#64748b'>Şirkət</td><td>{meeting_doc.get('company') or '—'}</td></tr>
      <tr><td style='color:#64748b'>Növ</td><td>{meeting_doc.get('meeting_type', '')}</td></tr>
      <tr><td style='color:#64748b'>Məkan</td><td>{meeting_doc.get('location') or meeting_doc.get('meeting_mode', '')}</td></tr>
      <tr><td style='color:#64748b'>Əməkdaş</td><td>{meeting_doc.get('employee', '')}</td></tr>
    </table>"""
    await _email_notify_safe(
        title=f"Görüş təyin edildi: {meeting_doc.get('date', '')}",
        body_html=body,
        extra_recipients=[emp_email, setter_email],
    )
    return meeting_doc

@api_router.put("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, data: dict, current_user: dict = Depends(check_permission("meetings", "write"))):
    existing = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Görüş tapılmadı")
    await assert_scope_ownership(current_user, "meetings", existing)
    update_data = {k: v for k, v in data.items() if k != "id"}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.meetings.update_one({"id": meeting_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Görüş tapılmadı")
    # Update reminders as notifications
    await db.notifications.delete_many({"meeting_id": meeting_id, "type": "reminder"})
    meeting = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    for rem in update_data.get("reminders", []):
        notif_doc = {
            "id": str(uuid.uuid4()),
            "title": f"Görüş xatırlatması: {meeting.get('meeting_type', '')}",
            "message": f"{meeting.get('date', '')} {meeting.get('time', '')} - {meeting.get('company', '') or meeting.get('employee', '')}. {rem.get('note', '')}",
            "type": "reminder",
            "meeting_id": meeting_id,
            "reminder_date": rem.get("date", ""),
            "reminder_time": rem.get("time", ""),
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notif_doc)
    return meeting

@api_router.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, current_user: dict = Depends(check_permission("meetings", "write"))):
    existing = await db.meetings.find_one({"id": meeting_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Görüş tapılmadı")
    await assert_scope_ownership(current_user, "meetings", existing)
    result = await db.meetings.delete_one({"id": meeting_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Görüş tapılmadı")
    await db.notifications.delete_many({"meeting_id": meeting_id, "type": "reminder"})
    return {"message": "Görüş silindi"}



# ==================== PROJECT EVENTS (LAYİHƏLƏR/TƏDBİRLƏR) ====================

@api_router.get("/project-events")
async def get_project_events(current_user: dict = Depends(get_current_user)):
    query = await apply_scope({}, current_user, "projects")
    events = await db.project_events.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    for e in events:
        e["guest_count"] = await db.event_invitations.count_documents({"event_id": e["id"]})
        e["attended_count"] = await db.event_invitations.count_documents({"event_id": e["id"], "status": "İştirak etdi"})
    return events

@api_router.post("/project-events")
async def create_project_event(data: dict, current_user: dict = Depends(check_permission("projects", "write"))):
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "type": data.get("type", ""),
        "date": data.get("date", ""),
        "end_date": data.get("end_date", ""),
        "location": data.get("location", ""),
        "description": data.get("description", ""),
        "status": data.get("status", "Planlaşdırılır"),
        "price_per_sqm": data.get("price_per_sqm"),
        "total_price": data.get("total_price"),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.project_events.insert_one(doc)
    doc.pop("_id", None)
    doc["guest_count"] = 0
    doc["attended_count"] = 0
    return doc

@api_router.put("/project-events/{event_id}")
async def update_project_event(event_id: str, data: dict, current_user: dict = Depends(check_permission("projects", "write"))):
    existing = await db.project_events.find_one({"id": event_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Layihə tapılmadı")
    await assert_scope_ownership(current_user, "projects", existing)
    update = {k: v for k, v in data.items() if k not in ("id",)}
    await db.project_events.update_one({"id": event_id}, {"$set": update})
    doc = await db.project_events.find_one({"id": event_id}, {"_id": 0})
    return doc

@api_router.delete("/project-events/{event_id}")
async def delete_project_event(event_id: str, current_user: dict = Depends(check_permission("projects", "write"))):
    existing = await db.project_events.find_one({"id": event_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Layihə tapılmadı")
    await assert_scope_ownership(current_user, "projects", existing)
    await db.project_events.delete_one({"id": event_id})
    await db.event_invitations.delete_many({"event_id": event_id})
    return {"message": "Layihə silindi"}

@api_router.get("/project-events/{event_id}/sales")
async def get_project_sales(event_id: str, current_user: dict = Depends(get_current_user)):
    """Return all sales-leads linked to this project (status Satıldı or Üzv oldu)."""
    event = await db.project_events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Layihə tapılmadı")
    query = {
        "project_id": event_id,
        "status": {"$in": ["Satıldı", "Üzv oldu"]}
    }
    query = await apply_scope(query, current_user, "sales")
    sales = await db.sales_leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    # Enrich each sale with sector info from companies if linked by name
    for s in sales:
        comp = await db.companies.find_one({"brand_name": s.get("company_name", "")}, {"_id": 0, "sector": 1, "sub_sector": 1})
        s["sector"] = comp.get("sector", "") if comp else ""
        s["sub_sector"] = comp.get("sub_sector", "") if comp else ""
        # Compute debt
        total = s.get("total_amount") or 0
        paid = s.get("paid_amount") or 0
        s["debt_amount"] = max(float(total) - float(paid), 0)
    return {"event": event, "sales": sales}

@api_router.post("/sales-leads/{lead_id}/payment")
async def add_lead_payment(lead_id: str, data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    """Append a payment to a lead and update paid_amount & metadata (contract, e-qaimə, follow-up)."""
    lead = await db.sales_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead tapılmadı")
    await assert_scope_ownership(current_user, "sales", lead)
    
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    # Metadata updates (all optional)
    for k in ("contract_number", "e_invoice_date", "e_invoice_number", "voen", "payment_due_date", "follow_up", "notes", "marsol_company"):
        if k in data:
            updates[k] = data[k]
    
    # Add new payment if amount > 0
    amount = data.get("new_payment_amount")
    if amount is not None and str(amount).strip() and float(amount) > 0:
        payment = {
            "id": str(uuid.uuid4()),
            "amount": float(amount),
            "date": data.get("payment_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "note": data.get("payment_note", ""),
            "payment_method": data.get("payment_method", ""),
            "added_by": current_user.get("name", ""),
            "added_at": datetime.now(timezone.utc).isoformat()
        }
        history = lead.get("payment_history", []) or []
        history.append(payment)
        updates["payment_history"] = history
        updates["paid_amount"] = float(lead.get("paid_amount") or 0) + float(amount)
    
    await db.sales_leads.update_one({"id": lead_id}, {"$set": updates})
    updated = await db.sales_leads.find_one({"id": lead_id}, {"_id": 0})
    return updated

@api_router.get("/sales-leads/{lead_id}/payments")
async def get_lead_payments(lead_id: str, current_user: dict = Depends(get_current_user)):
    lead = await db.sales_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead tapılmadı")
    return lead.get("payment_history", []) or []

# ==================== EVENT INVITATIONS (QONAQLAR / DƏVƏTLƏR) ====================

@api_router.get("/event-invitations")
async def get_event_invitations(
    event_id: Optional[str] = None,
    status: Optional[str] = None,
    invited_by: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if event_id and event_id != "all":
        query["event_id"] = event_id
    if status and status != "all":
        query["status"] = status
    if invited_by and invited_by != "all":
        query["invited_by"] = invited_by
    invitations = await db.event_invitations.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return invitations

@api_router.post("/event-invitations")
async def create_event_invitation(data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    doc = {
        "id": str(uuid.uuid4()),
        "event_id": data.get("event_id", ""),
        "event_name": data.get("event_name", ""),
        "guest_name": data.get("guest_name", ""),
        "guest_company": data.get("guest_company", ""),
        "guest_position": data.get("guest_position", ""),
        "guest_phone": data.get("guest_phone", ""),
        "guest_email": data.get("guest_email", ""),
        "status": "Dəvət edilib",
        "decline_reason": "",
        "notes": data.get("notes", ""),
        "invited_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.event_invitations.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/event-invitations/{inv_id}")
async def update_event_invitation(inv_id: str, data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    update = {k: v for k, v in data.items() if k not in ("id",)}
    await db.event_invitations.update_one({"id": inv_id}, {"$set": update})
    doc = await db.event_invitations.find_one({"id": inv_id}, {"_id": 0})
    return doc

@api_router.delete("/event-invitations/{inv_id}")
async def delete_event_invitation(inv_id: str, current_user: dict = Depends(check_permission("sales", "write"))):
    await db.event_invitations.delete_one({"id": inv_id})
    return {"message": "Dəvət silindi"}

@api_router.post("/event-invitations/{inv_id}/convert-to-lead")
async def convert_event_invitation_to_lead(inv_id: str, current_user: dict = Depends(check_permission("sales", "write"))):
    inv = await db.event_invitations.find_one({"id": inv_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Dəvət tapılmadı")
    count = await db.sales_leads.count_documents({})
    lead_code = f"SB-{str(count + 1).zfill(3)}"
    lead = {
        "id": str(uuid.uuid4()), "lead_code": lead_code,
        "company_name": inv.get("guest_company", ""),
        "contact_name": inv.get("guest_name", ""),
        "position": inv.get("guest_position", ""),
        "phone": inv.get("guest_phone", ""),
        "email": inv.get("guest_email", ""),
        "source": f"Dəvət - {inv.get('event_name', '')}",
        "sale_type": "Üzvlük", "status": "Yeni",
        "notes": inv.get("notes", ""),
        "curator": current_user.get("name", ""),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sales_leads.insert_one(lead)
    lead.pop("_id", None)
    await db.event_invitations.update_one({"id": inv_id}, {"$set": {"converted_to_lead": True, "lead_id": lead["id"]}})
    return lead

# ==================== CONTACT LISTS (SİYAHILAR) ====================

@api_router.get("/contact-lists")
async def get_contact_lists(current_user: dict = Depends(get_current_user)):
    lists = await db.contact_lists.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for l in lists:
        l["contact_count"] = await db.contacts.count_documents({"list_id": l["id"]})
    return lists

@api_router.post("/contact-lists")
async def create_contact_list(data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    doc = {
        "id": str(uuid.uuid4()),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.contact_lists.insert_one(doc)
    doc.pop("_id", None)
    doc["contact_count"] = 0
    return doc

@api_router.put("/contact-lists/{list_id}")
async def update_contact_list(list_id: str, data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    await db.contact_lists.update_one({"id": list_id}, {"$set": {k: v for k, v in data.items() if k not in ("id",)}})
    doc = await db.contact_lists.find_one({"id": list_id}, {"_id": 0})
    return doc

@api_router.delete("/contact-lists/{list_id}")
async def delete_contact_list(list_id: str, current_user: dict = Depends(check_permission("sales", "write"))):
    await db.contact_lists.delete_one({"id": list_id})
    await db.contacts.delete_many({"list_id": list_id})
    return {"message": "Siyahı silindi"}

@api_router.get("/contact-lists/{list_id}/contacts")
async def get_list_contacts(list_id: str, current_user: dict = Depends(get_current_user)):
    contacts = await db.contacts.find({"list_id": list_id}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return contacts

@api_router.post("/contact-lists/{list_id}/contacts")
async def add_contact_to_list(list_id: str, data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    doc = {
        "id": str(uuid.uuid4()), "list_id": list_id,
        "name": data.get("name", ""), "surname": data.get("surname", ""),
        "company": data.get("company", ""), "position": data.get("position", ""),
        "phone": data.get("phone", ""), "email": data.get("email", ""),
        "notes": data.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.contacts.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.post("/contact-lists/{list_id}/import")
async def import_contacts(list_id: str, data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    contacts = data.get("contacts", [])
    if not contacts:
        raise HTTPException(status_code=400, detail="Boş siyahı")
    docs = []
    for c in contacts:
        docs.append({
            "id": str(uuid.uuid4()), "list_id": list_id,
            "name": c.get("name", c.get("Ad", "")), "surname": c.get("surname", c.get("Soyad", "")),
            "company": c.get("company", c.get("Şirkət", "")), "position": c.get("position", c.get("Vəzifə", "")),
            "phone": c.get("phone", c.get("Telefon", "")), "email": c.get("email", c.get("Email", "")),
            "notes": c.get("notes", c.get("Qeyd", "")),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    await db.contacts.insert_many(docs)
    return {"message": f"{len(docs)} kontakt import edildi"}

@api_router.delete("/contact-lists/{list_id}/contacts/{contact_id}")
async def delete_contact(list_id: str, contact_id: str, current_user: dict = Depends(check_permission("sales", "write"))):
    await db.contacts.delete_one({"id": contact_id, "list_id": list_id})
    return {"message": "Kontakt silindi"}

@api_router.post("/contacts/{contact_id}/convert-to-lead")
async def convert_contact_to_lead(contact_id: str, current_user: dict = Depends(check_permission("sales", "write"))):
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Kontakt tapılmadı")
    count = await db.sales_leads.count_documents({})
    lead = {
        "id": str(uuid.uuid4()), "lead_code": f"SB-{str(count+1).zfill(3)}",
        "company_name": contact.get("company", ""), "contact_name": f"{contact.get('name','')} {contact.get('surname','')}".strip(),
        "position": contact.get("position", ""), "phone": contact.get("phone", ""), "email": contact.get("email", ""),
        "source": "Siyahıdan", "sale_type": "Üzvlük", "status": "Yeni", "notes": contact.get("notes", ""),
        "curator": current_user.get("name", ""), "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sales_leads.insert_one(lead)
    lead.pop("_id", None)
    return lead


# ==================== SALES LEADS (ŞİRKƏT BAZASI) ====================

LEAD_STATUSES = ["Yeni", "Əlaqə quruldu", "Görüş təyin edildi", "Təklif göndərildi", "Danışıqda", "Üzv oldu", "Satıldı", "İmtina"]

@api_router.get("/sales-leads")
async def get_sales_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status and status != "all":
        query["status"] = status
    if source and source != "all":
        query["source"] = source
    query = await apply_scope(query, current_user, "sales")
    leads = await db.sales_leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return leads

@api_router.get("/sales-leads/stats")
async def get_sales_leads_stats(current_user: dict = Depends(get_current_user)):
    query = await apply_scope({}, current_user, "sales")
    total = await db.sales_leads.count_documents(query)
    stats = {"total": total}
    for s in LEAD_STATUSES:
        q = await apply_scope({"status": s}, current_user, "sales")
        stats[s] = await db.sales_leads.count_documents(q)
    return stats

@api_router.post("/sales-leads")
async def create_sales_lead(data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    count = await db.sales_leads.count_documents({})
    lead_code = f"SB-{str(count + 1).zfill(3)}"
    doc = {
        "id": str(uuid.uuid4()),
        "lead_code": lead_code,
        "company_name": data.get("company_name", ""),
        "contact_name": data.get("contact_name", ""),
        "position": data.get("position", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "source": data.get("source", ""),
        "sale_type": data.get("sale_type", "Üzvlük"),
        "status": data.get("status", "Yeni"),
        "notes": data.get("notes", ""),
        "project_id": data.get("project_id", ""),
        "package": data.get("package", ""),
        "kv_m": data.get("kv_m"),
        "price_per_sqm": data.get("price_per_sqm"),
        "stand_number": data.get("stand_number", ""),
        "hall_number": data.get("hall_number", ""),
        "total_amount": data.get("total_amount"),
        "participant_count": data.get("participant_count"),
        "marsol_company": data.get("marsol_company", ""),
        "curator": current_user.get("name", ""),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sales_leads.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/sales-leads/{lead_id}")
async def update_sales_lead(lead_id: str, data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    update_data = {k: v for k, v in data.items() if k not in ("id", "lead_code")}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Check if status changed to "Üzv oldu"
    new_status = update_data.get("status")
    lead = await db.sales_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead tapılmadı")
    await assert_scope_ownership(current_user, "sales", lead)
    
    result = await db.sales_leads.update_one({"id": lead_id}, {"$set": update_data})
    
    if new_status == "Üzv oldu" and lead.get("status") != "Üzv oldu":
        sale_type = update_data.get("sale_type", lead.get("sale_type", ""))
        if sale_type == "Üzvlük":
            # Check if company already exists
            existing = await db.companies.find_one({"brand_name": lead["company_name"]}, {"_id": 0})
            if not existing:
                company_doc = {
                    "id": str(uuid.uuid4()),
                    "brand_name": lead["company_name"],
                    "legal_name": lead["company_name"],
                    "sector": "",
                    "company_size": "",
                    "registration_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "address": "",
                    "bank_details": "",
                    "owner_name": lead.get("contact_name", ""),
                    "owner_phone": lead.get("phone", ""),
                    "owner_email": lead.get("email", ""),
                    "owner_social_links": "",
                    "co_founders": [],
                    "representative_name": "",
                    "representative_phone": "",
                    "representative_email": "",
                    "company_phone": lead.get("phone", ""),
                    "company_email": lead.get("email", ""),
                    "website": "",
                    "package": "",
                    "joined_project": "Üzvlük",
                    "contract_start_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "contract_end_date": "",
                    "payment_amount": 0,
                    "paid_amount": 0,
                    "debt_amount": 0,
                    "payment_due_date": "",
                    "status": "Aktiv",
                    "sub_sector": "",
                    "marsol_representative": lead.get("curator", ""),
                    "source_lead_id": lead_id,
                    "curator": lead.get("curator", ""),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.companies.insert_one(company_doc)
    
    doc = await db.sales_leads.find_one({"id": lead_id}, {"_id": 0})
    
    # Email notify on status transition to "Satıldı"/"Üzv oldu"
    if new_status in ("Satıldı", "Üzv oldu") and lead.get("status") not in ("Satıldı", "Üzv oldu"):
        curator_email = await _user_email_by_name(doc.get("curator", ""))
        amount = doc.get("total_amount") or 0
        body = f"""<p>🎉 Yeni satış bağlandı!</p>
        <table cellpadding='6' cellspacing='0' style='width:100%;border:1px solid #e2e8f0;border-radius:8px;font-size:13px'>
          <tr><td style='color:#64748b'>Şirkət</td><td style='font-weight:600'>{doc.get('company_name', '')}</td></tr>
          <tr><td style='color:#64748b'>Sahibkar</td><td>{doc.get('contact_name', '')}</td></tr>
          <tr><td style='color:#64748b'>Növ</td><td>{doc.get('sale_type', '')}</td></tr>
          <tr><td style='color:#64748b'>Status</td><td><span style='background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px'>{new_status}</span></td></tr>
          <tr><td style='color:#64748b'>Məbləğ</td><td style='font-weight:600;color:#166534'>{amount} AZN</td></tr>
          <tr><td style='color:#64748b'>Kurator</td><td>{doc.get('curator', '')}</td></tr>
        </table>"""
        await _email_notify_safe(
            title=f"Yeni satış: {doc.get('company_name', '')}",
            body_html=body,
            extra_recipients=[curator_email],
        )
    return doc
    return doc

@api_router.delete("/sales-leads/{lead_id}")
async def delete_sales_lead(lead_id: str, current_user: dict = Depends(check_permission("sales", "write"))):
    existing = await db.sales_leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead tapılmadı")
    await assert_scope_ownership(current_user, "sales", existing)
    result = await db.sales_leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead tapılmadı")
    return {"message": "Lead silindi"}

@api_router.get("/sales-members")
async def get_sales_members(current_user: dict = Depends(get_current_user)):
    query = {"status": "Üzv oldu", "sale_type": "Üzvlük"}
    query = await apply_scope(query, current_user, "sales")
    members = await db.sales_leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return members

@api_router.get("/members")
async def get_members(
    package: Optional[str] = None,
    sector: Optional[str] = None,
    status: Optional[str] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if package and package != "all":
        query["package"] = package
    if sector and sector != "all":
        query["sector"] = sector
    if status and status != "all":
        query["status"] = status
    query = await apply_scope(query, current_user, "members")
    companies = await db.companies.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    if year is not None:
        companies = [c for c in companies if _company_covers_year(c, year)]
    # Annotate each company with the membership-period applicable to that year (or current)
    for c in companies:
        if year is not None:
            cs_y_cur = (c.get("contract_start_date") or "")[:4]
            ce_y_cur = (c.get("contract_end_date") or "")[:4]
            try:
                cs_yi = int(cs_y_cur) if cs_y_cur else 0
                ce_yi = int(ce_y_cur) if ce_y_cur else 9999
            except (ValueError, TypeError):
                cs_yi, ce_yi = 0, 9999
            if cs_yi <= year <= ce_yi:
                c["_period"] = {
                    "package": c.get("package", ""),
                    "contract_start": c.get("contract_start_date", ""),
                    "contract_end": c.get("contract_end_date", ""),
                    "is_current": True
                }
            else:
                for h in (c.get("membership_history") or []):
                    try:
                        hcs_y = int((h.get("contract_start") or "")[:4]) if h.get("contract_start") else 0
                        hce_y = int((h.get("contract_end") or "")[:4]) if h.get("contract_end") else 9999
                    except (ValueError, TypeError):
                        hcs_y, hce_y = 0, 9999
                    if hcs_y <= year <= hce_y:
                        c["_period"] = { **h, "is_current": False }
                        break
    return companies
    # Map fields for frontend compatibility
    now = datetime.now(timezone.utc)
    members = []
    for c in companies:
        c["company_name"] = c.get("brand_name", "")
        c["director_name"] = c.get("owner_name", "")
        c["director_phone"] = c.get("owner_phone", "")
        c["contact_person"] = c.get("representative_name", "")
        c["contact_position"] = c.get("representative_position", "")
        c["business_size"] = c.get("company_size", "")
        # Calculate days until expiry
        end_date_str = c.get("contract_end_date", "")
        c["days_until_expiry"] = None
        if end_date_str:
            try:
                end_dt = datetime.strptime(end_date_str, "%Y-%m-%d")
                c["days_until_expiry"] = (end_dt - now.replace(tzinfo=None)).days
            except (ValueError, TypeError):
                pass
        members.append(c)
    # Sort: expiring soon first (non-null days_until_expiry, ascending)
    members.sort(key=lambda m: (m["days_until_expiry"] is None, m["days_until_expiry"] if m["days_until_expiry"] is not None else 9999))
    return members

@api_router.get("/members/options/all")
async def get_members_options(current_user: dict = Depends(get_current_user)):
    packages_db = await db.packages.find({}, {"_id": 0}).to_list(100)
    sectors_db = await db.sectors.find({}, {"_id": 0}).to_list(100)
    projects_db = await db.projects.find({}, {"_id": 0}).to_list(100)
    users_db = await db.users.find({}, {"_id": 0, "name": 1}).to_list(500)
    return {
        "packages": [p["name"] for p in packages_db] if packages_db else ["Premium", "Business", "Business Plus"],
        "sectors": [s["name"] for s in sectors_db] if sectors_db else [],
        "statuses": ["Aktiv", "Qeyri-aktiv", "Gözləmədə"],
        "business_sizes": ["Böyük", "Orta", "Kiçik", "Mikro"],
        "curators": [u["name"] for u in users_db if u.get("name")],
        "projects": [p["name"] for p in projects_db] if projects_db else ["Üzvlük", "Sərgi", "Təlim/Proqram"],
        "contract_statuses": ["Gözləyir", "Bağlanıb", "Aktiv", "Bitib", "Ləğv edilib"],
    }

@api_router.post("/members")
async def create_member(data: dict, current_user: dict = Depends(check_permission("members", "write"))):
    doc = {
        "id": str(uuid.uuid4()),
        "brand_name": data.get("company_name", ""),
        "legal_name": data.get("company_name", ""),
        "sector": data.get("sector", ""),
        "company_size": data.get("business_size", ""),
        "owner_name": data.get("director_name", ""),
        "owner_phone": data.get("director_phone", ""),
        "owner_email": data.get("email", ""),
        "representative_name": data.get("contact_person", ""),
        "company_phone": data.get("phone", ""),
        "package": data.get("package", ""),
        "joined_project": data.get("project", "Üzvlük"),
        "status": data.get("status", "Aktiv"),
        "curator": current_user.get("name", ""),
        "registration_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.companies.insert_one(doc)
    doc.pop("_id", None)
    doc["company_name"] = doc["brand_name"]
    doc["director_name"] = doc["owner_name"]
    doc["business_size"] = doc["company_size"]
    return doc

@api_router.put("/members/{member_id}")
async def update_member(member_id: str, data: dict, current_user: dict = Depends(check_permission("members", "write"))):
    existing = await db.companies.find_one({"id": member_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Üzv tapılmadı")
    await assert_scope_ownership(current_user, "members", existing)
    update = {}
    field_map = {"company_name": "brand_name", "director_name": "owner_name", "director_phone": "owner_phone", "business_size": "company_size", "contact_person": "representative_name", "contact_position": "representative_position"}
    for k, v in data.items():
        if k in field_map:
            update[field_map[k]] = v
        elif k not in ("id",):
            update[k] = v
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.companies.update_one({"id": member_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Üzv tapılmadı")
    doc = await db.companies.find_one({"id": member_id}, {"_id": 0})
    doc["company_name"] = doc.get("brand_name", "")
    doc["director_name"] = doc.get("owner_name", "")
    doc["business_size"] = doc.get("company_size", "")
    return doc

@api_router.delete("/members/{member_id}")
async def delete_member(member_id: str, current_user: dict = Depends(check_permission("members", "write"))):
    existing = await db.companies.find_one({"id": member_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Üzv tapılmadı")
    await assert_scope_ownership(current_user, "members", existing)
    result = await db.companies.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Üzv tapılmadı")
    return {"message": "Üzv silindi"}

@api_router.post("/members/{member_id}/renew")
async def renew_member(member_id: str, data: dict, current_user: dict = Depends(check_permission("members", "write"))):
    """Archive current membership period to history, then start a new period.
    Body: {package, contract_start, contract_end, carry_over_quota?: bool}.
    """
    company = await db.companies.find_one({"id": member_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Üzv tapılmadı")
    await assert_scope_ownership(current_user, "members", company)

    # Snapshot current period's used_quota (counts invitations during current contract period)
    quotas = await get_package_quotas()
    cur_total_quota = quotas.get(company.get("package", ""), 0)
    cur_used_quota = await db.invitations.count_documents({
        "company_id": member_id,
        "obligation_deducted": True,
        "event_date": {
            "$gte": company.get("contract_start_date") or "0000-00-00",
            "$lte": company.get("contract_end_date") or "9999-99-99"
        }
    })

    history_entry = {
        "id": str(uuid.uuid4()),
        "package": company.get("package", ""),
        "contract_start": company.get("contract_start_date", ""),
        "contract_end": company.get("contract_end_date", ""),
        "total_quota": cur_total_quota,
        "used_quota": cur_used_quota,
        "remaining_quota": max(cur_total_quota - cur_used_quota, 0),
        "status": "Yenilənib",
        "archived_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Build update
    history = company.get("membership_history") or []
    history.append(history_entry)
    
    new_package = data.get("package", company.get("package", ""))
    update = {
        "membership_history": history,
        "package": new_package,
        "contract_start_date": data.get("contract_start", ""),
        "contract_end_date": data.get("contract_end", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # Carry-over (track as bonus quota)
    carry_over = bool(data.get("carry_over_quota"))
    if carry_over:
        update["bonus_quota"] = (company.get("bonus_quota") or 0) + history_entry["remaining_quota"]
    
    await db.companies.update_one({"id": member_id}, {"$set": update})
    updated = await db.companies.find_one({"id": member_id}, {"_id": 0})
    return updated

@api_router.post("/sales-leads/{lead_id}/create-meeting")
async def create_meeting_from_lead(lead_id: str, data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    lead = await db.sales_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead tapılmadı")
    meeting_id = str(uuid.uuid4())
    meeting_doc = {
        "id": meeting_id,
        "employee": current_user.get("name", ""),
        "meeting_setter": data.get("meeting_setter", current_user.get("name", "")),
        "date": data.get("date", ""),
        "time": data.get("time", ""),
        "company": lead["company_name"],
        "contact_person": lead["contact_name"],
        "project": "",
        "meeting_type": data.get("meeting_type", "Müştəri görüşü"),
        "meeting_mode": data.get("meeting_mode", "Offline"),
        "department": "Satış",
        "location": data.get("location", ""),
        "result": "",
        "next_meeting": "",
        "notes": data.get("notes", ""),
        "reminders": [],
        "source_lead_id": lead_id,
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.meetings.insert_one(meeting_doc)
    meeting_doc.pop("_id", None)
    # Update lead status
    await db.sales_leads.update_one({"id": lead_id}, {"$set": {"status": "Görüş təyin edildi", "updated_at": datetime.now(timezone.utc).isoformat()}})
    return meeting_doc

# ==================== ASSEMBLIES (İCLAS) ====================

async def _sync_assembly_tasks(assembly_doc):
    """Sync assembly agenda tasks + general tasks to the tasks collection"""
    assembly_uuid = assembly_doc["id"]
    assembly_code = assembly_doc["assembly_code"]
    department = assembly_doc.get("department", "")
    deadline = assembly_doc.get("deadline", "")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Remove old tasks from this assembly
    await db.tasks.delete_many({"source": "assembly", "assembly_id": assembly_uuid})

    async def _create_task(task, related_label):
        task_title = task.get("title", "")
        responsibles = task.get("responsible_persons", [])
        assignees = task.get("assignees", [])
        # Backward compat for single values
        if not responsibles and task.get("responsible_person"):
            responsibles = [task["responsible_person"]]
        if not assignees and task.get("assignee"):
            assignees = [task["assignee"]]
        task_deadline = task.get("deadline", "") or deadline
        if task_title and (responsibles or assignees):
            count = await db.tasks.count_documents({})
            task_code = f"T-{str(count + 1).zfill(3)}"
            task_doc = {
                "id": str(uuid.uuid4()),
                "task_code": task_code,
                "task_name": f"[{assembly_code}] {task_title}",
                "department": department,
                "assignee": ", ".join(assignees) if assignees else ", ".join(responsibles),
                "responsible_person": ", ".join(responsibles),
                "priority": "Orta",
                "start_date": today,
                "end_date": task_deadline,
                "related_object_type": "İclas",
                "related_object_id": assembly_code,
                "related_object": related_label,
                "phase": "",
                "status": "Gözləyir",
                "notes": f"İclas: {assembly_code}",
                "source": "assembly",
                "assembly_id": assembly_uuid,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.tasks.insert_one(task_doc)

    # Agenda tasks
    for agenda in assembly_doc.get("agendas", []):
        agenda_title = agenda.get("title", "")
        for task in agenda.get("tasks", []):
            await _create_task(task, f"{assembly_code} - {agenda_title}")
    # General tasks (not linked to any agenda)
    for task in assembly_doc.get("general_tasks", []):
        await _create_task(task, f"{assembly_code} - Ümumi")

@api_router.get("/assemblies")
async def get_assemblies(
    department: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if department and department != "all":
        query["department"] = department
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        query["created_at"] = date_q
    query = await apply_scope(query, current_user, "assembly")
    assemblies = await db.assemblies.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return assemblies

@api_router.post("/assemblies")
async def create_assembly(data: dict, current_user: dict = Depends(check_permission("assembly", "write"))):
    count = await db.assemblies.count_documents({})
    assembly_code = f"IC-{str(count + 1).zfill(3)}"
    doc = {
        "id": str(uuid.uuid4()),
        "assembly_code": assembly_code,
        "department": data.get("department", ""),
        "purpose": data.get("purpose", ""),
        "agendas": data.get("agendas", []),
        "general_tasks": data.get("general_tasks", []),
        "discussion_topics": data.get("discussion_topics", []),
        "deadline": data.get("deadline", ""),
        "next_assembly_date": data.get("next_assembly_date", ""),
        "decisions": data.get("decisions", []),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assemblies.insert_one(doc)
    doc.pop("_id", None)
    await _sync_assembly_tasks(doc)
    return doc

@api_router.put("/assemblies/{assembly_id}")
async def update_assembly(assembly_id: str, data: dict, current_user: dict = Depends(check_permission("assembly", "write"))):
    existing = await db.assemblies.find_one({"id": assembly_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="İclas tapılmadı")
    await assert_scope_ownership(current_user, "assembly", existing)
    update_data = {k: v for k, v in data.items() if k not in ("id", "assembly_code")}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.assemblies.update_one({"id": assembly_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="İclas tapılmadı")
    doc = await db.assemblies.find_one({"id": assembly_id}, {"_id": 0})
    await _sync_assembly_tasks(doc)
    return doc

@api_router.delete("/assemblies/{assembly_id}")
async def delete_assembly(assembly_id: str, current_user: dict = Depends(check_permission("assembly", "write"))):
    existing = await db.assemblies.find_one({"id": assembly_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="İclas tapılmadı")
    await assert_scope_ownership(current_user, "assembly", existing)
    result = await db.assemblies.delete_one({"id": assembly_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="İclas tapılmadı")
    await db.tasks.delete_many({"source": "assembly", "assembly_id": assembly_id})
    return {"message": "İclas silindi"}


# ==================== OPTIONS ====================

# ==================== MEMBERSHIP FORUM ====================

COMPANY_FORM_FIELDS = [
    # Şirkət məlumatları
    {"key": "legal_name", "label": "Hüquqi ad", "type": "text"},
    {"key": "voen", "label": "VÖEN", "type": "text"},
    {"key": "sector", "label": "Sektor", "type": "select"},
    {"key": "sub_sector", "label": "Alt sektor", "type": "select"},
    {"key": "company_size", "label": "Şirkət ölçüsü", "type": "select"},
    {"key": "employee_count", "label": "İşçi sayı", "type": "text"},
    {"key": "region", "label": "Region", "type": "text"},
    {"key": "registration_date", "label": "Şirkətin yaranma tarixi", "type": "date"},
    {"key": "address", "label": "Ünvan", "type": "textarea"},
    {"key": "company_phone", "label": "Şirkət telefonu", "type": "text"},
    {"key": "company_website", "label": "Veb sayt", "type": "text"},
    {"key": "social_links", "label": "Şirkət sosial media hesabları", "type": "array"},
    {"key": "bank_files", "label": "Bank rekvizitləri (fayl)", "type": "file"},
    {"key": "logo_url", "label": "Şirkət logosu", "type": "file"},
    # Referans
    {"key": "reference_source", "label": "Referans mənbəsi", "type": "text"},
    {"key": "reference_person_name", "label": "Referans şəxsin adı", "type": "text"},
    {"key": "reference_person_surname", "label": "Referans şəxsin soyadı", "type": "text"},
    {"key": "reference_person_position", "label": "Referans şəxsin vəzifəsi", "type": "text"},
    {"key": "reference_note", "label": "Referans qeydi", "type": "textarea"},
    # Sahibkar
    {"key": "owners", "label": "Sahibkarlar (ad, soyad, ata adı, vəzifə, telefon, email, doğum tarixi, vətəndaşlıq, təhsil, ixtisas, universitet, sosial media, uşaqlar, fəaliyyət sahələri)", "type": "owners"},
    # Əlaqədar şəxs
    {"key": "contact_first_name", "label": "Əlaqədar şəxs adı", "type": "text"},
    {"key": "contact_last_name", "label": "Əlaqədar şəxs soyadı", "type": "text"},
    {"key": "contact_position", "label": "Əlaqədar şəxs vəzifəsi", "type": "text"},
    {"key": "contact_phone", "label": "Əlaqədar şəxs telefonu", "type": "text"},
    {"key": "contact_email", "label": "Əlaqədar şəxs emaili", "type": "text"},
]

@api_router.get("/forum/fields")
async def get_forum_fields(current_user: dict = Depends(get_current_user)):
    """Get available form fields and which are enabled"""
    settings = await db.setting_lists.find_one({"key": "forum_enabled_fields"}, {"_id": 0})
    enabled = settings.get("values", []) if settings else [f["key"] for f in COMPANY_FORM_FIELDS]
    # Also get custom fields for companies
    custom_fields = await db.custom_fields.find({"module": "companies"}, {"_id": 0}).to_list(100)
    all_fields = COMPANY_FORM_FIELDS.copy()
    for cf in custom_fields:
        all_fields.append({"key": f"custom_{cf['id']}", "label": cf.get("label", cf.get("name", "")), "custom": True})
    return {"fields": all_fields, "enabled": enabled}

@api_router.put("/forum/fields")
async def update_forum_fields(data: dict, current_user: dict = Depends(check_permission("settings", "write"))):
    enabled = data.get("enabled", [])
    await db.setting_lists.update_one({"key": "forum_enabled_fields"}, {"$set": {"values": enabled}}, upsert=True)
    return {"message": "Forum sahələri yeniləndi", "enabled": enabled}


async def _get_all_options():
    """Helper: get dynamic options for forms - mirrors settings endpoints with fallbacks"""
    regions_db = await db.regions.find({}, {"_id": 0}).to_list(500)
    if not regions_db:
        regions_db = [{"name": n} for n in ["Bakı", "Sumqayıt", "Gəncə", "Lənkəran", "Mingəçevir", "Şəki", "Şirvan", "Naxçıvan", "Abşeron", "Digər"]]
    positions_db = await db.positions.find({}, {"_id": 0}).to_list(500)
    if not positions_db:
        positions_db = [{"name": n} for n in ["Direktor", "Təsisçi", "Baş direktor", "İcraçı direktor", "Kommersiya direktoru", "Maliyyə direktoru"]]
    activities_db = await db.activities.find({}, {"_id": 0}).to_list(500)
    if not activities_db:
        activities_db = [{"name": n} for n in ["Networking", "Təlim", "Sərgi", "Forum", "Mentorluq", "İş birliyi"]]
    company_sizes = await _get_setting_list("company_sizes", ["Böyük", "Orta", "Kiçik", "Mikro"])
    education_levels = await _get_setting_list("education_levels", ["Orta təhsil", "Sub bakalavr", "Bakalavr", "Magistratura", "Doktorantura"])
    return {
        "company_sizes": company_sizes,
        "regions": [r["name"] for r in regions_db],
        "positions": [p["name"] for p in positions_db],
        "education_levels": education_levels,
        "activities": [a["name"] for a in activities_db],
    }

@api_router.post("/forum/generate-link/{company_id}")
async def generate_forum_link(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    token = str(uuid.uuid4())[:12]
    await db.forum_tokens.update_one(
        {"company_id": company_id},
        {"$set": {"token": token, "company_id": company_id, "created_at": datetime.now(timezone.utc).isoformat(), "created_by": current_user.get("name", "")}},
        upsert=True
    )
    return {"token": token, "company_id": company_id}

# PUBLIC endpoints - no auth required
@api_router.get("/public/form/{token}")
async def get_public_form(token: str):
    form_token = await db.forum_tokens.find_one({"token": token}, {"_id": 0})
    if not form_token:
        raise HTTPException(status_code=404, detail="Form tapılmadı və ya vaxtı keçib")
    company = await db.companies.find_one({"id": form_token["company_id"]}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    settings = await db.setting_lists.find_one({"key": "forum_enabled_fields"}, {"_id": 0})
    enabled = settings.get("values", []) if settings else [f["key"] for f in COMPANY_FORM_FIELDS]
    fields_info = {f["key"]: {"label": f["label"], "type": f.get("type", "text")} for f in COMPANY_FORM_FIELDS}
    custom_fields = await db.custom_fields.find({"module": "companies"}, {"_id": 0}).to_list(100)
    for cf in custom_fields:
        fields_info[f"custom_{cf['id']}"] = {"label": cf.get("label", cf.get("name", "")), "type": "text"}
    enabled_fields = [{"key": k, "label": fields_info[k]["label"], "type": fields_info[k]["type"]} for k in enabled if k in fields_info]
    # Get dynamic options for selects
    sectors_db = await db.sectors.find({}, {"_id": 0}).to_list(200)
    sub_sectors_db = await db.sub_sectors.find({}, {"_id": 0}).to_list(500)
    sub_map = {}
    for s in sub_sectors_db:
        sub_map.setdefault(s.get("sector", ""), []).append(s.get("name", ""))
    form_description = await db.setting_lists.find_one({"key": "forum_description"}, {"_id": 0})
    all_options = await _get_all_options()
    return {
        "company_name": company.get("brand_name", ""),
        "owner_phone": company.get("owner_phone", ""),
        "owner_name": company.get("owner_name", ""),
        "fields": enabled_fields,
        "current_values": {k: company.get(k, "") for k in enabled},
        "description": (form_description.get("values", [""])[0] if form_description else "Zəhmət olmasa şirkət məlumatlarını doldurun"),
        "options": {
            "sectors": [s.get("name", "") for s in sectors_db] + ["Digər"],
            "sub_sectors": sub_map,
            "company_sizes": all_options.get("company_sizes", ["Böyük", "Orta", "Kiçik", "Mikro"]),
            "regions": all_options.get("regions", []),
            "positions": all_options.get("positions", []),
            "education_levels": all_options.get("education_levels", []),
            "activities": all_options.get("activities", []),
        }
    }

@api_router.post("/public/form/{token}")
async def submit_public_form(token: str, data: dict):
    form_token = await db.forum_tokens.find_one({"token": token}, {"_id": 0})
    if not form_token:
        raise HTTPException(status_code=404, detail="Form tapılmadı")
    company_id = form_token["company_id"]
    settings = await db.setting_lists.find_one({"key": "forum_enabled_fields"}, {"_id": 0})
    enabled = settings.get("values", []) if settings else [f["key"] for f in COMPANY_FORM_FIELDS]
    pending_data = {}
    for key in enabled:
        if key in data:
            pending_data[key] = data[key]
    if "owners" in data and "owners" in enabled:
        pending_data["owners"] = data["owners"]
    if pending_data:
        # Store as PENDING — admin must approve
        await db.companies.update_one({"id": company_id}, {"$set": {
            "pending_form_data": pending_data,
            "pending_form_submitted_at": datetime.now(timezone.utc).isoformat(),
            "pending_form_status": "Gözləyir",
        }})
        # Email notify admin + curator
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        curator_email = await _user_email_by_name((company or {}).get("curator", ""))
        rows = "".join(f"<tr><td style='padding:4px 8px;color:#64748b'>{k}</td><td style='padding:4px 8px;color:#0f172a;font-weight:600'>{v}</td></tr>" for k, v in pending_data.items())
        body = f"""<p><strong>{(company or {}).get('brand_name', '')}</strong> şirkəti üzvlük formunu doldurub. Admin təsdiqi gözləyir.</p>
        <table cellpadding='0' cellspacing='0' style='width:100%;border:1px solid #e2e8f0;border-radius:8px;margin-top:8px;font-size:13px'>{rows}</table>
        <p style='margin-top:12px;color:#64748b;font-size:12px'>Sistemə daxil olub Şirkət Məlumatları → həmin şirkətə klikləyin və Təsdiqlə/Rədd et seçin.</p>"""
        await _email_notify_safe(
            title="Forum dəyişikliyi təsdiq gözləyir",
            body_html=body,
            extra_recipients=[curator_email],
        )
    return {"message": "Məlumatlar uğurla göndərildi. Admin təsdiqindən sonra məlumatlar yenilənəcək."}


@api_router.post("/companies/{company_id}/approve-form")
async def approve_form_submission(company_id: str, current_user: dict = Depends(check_permission("companies", "write"))):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    await assert_scope_ownership(current_user, "companies", company)
    pending = company.get("pending_form_data") or {}
    if not pending:
        raise HTTPException(status_code=400, detail="Təsdiq olunacaq məlumat yoxdur")
    update = {**pending, "form_submitted_at": company.get("pending_form_submitted_at") or datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.companies.update_one({"id": company_id}, {
        "$set": update,
        "$unset": {"pending_form_data": "", "pending_form_status": "", "pending_form_submitted_at": ""}
    })
    return {"message": "Təsdiqləndi və məlumatlar yeniləndi"}


@api_router.post("/companies/{company_id}/reject-form")
async def reject_form_submission(company_id: str, data: Optional[dict] = None, current_user: dict = Depends(check_permission("companies", "write"))):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    await assert_scope_ownership(current_user, "companies", company)
    if not company.get("pending_form_data"):
        raise HTTPException(status_code=400, detail="Təsdiq olunacaq məlumat yoxdur")
    reject_reason = (data or {}).get("reason", "")
    await db.companies.update_one({"id": company_id}, {
        "$unset": {"pending_form_data": "", "pending_form_submitted_at": ""},
        "$set": {"pending_form_status": "Rədd edildi", "pending_form_reject_reason": reject_reason, "updated_at": datetime.now(timezone.utc).isoformat()}
    })
    return {"message": "Forma rədd edildi"}



# ==================== ROLES ====================

@api_router.get("/roles")
async def get_roles(current_user: dict = Depends(get_current_user)):
    roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    return roles

@api_router.post("/roles")
async def create_role(data: dict, current_user: dict = Depends(check_permission("settings", "write"))):
    existing = await db.roles.find_one({"name": data.get("name", "")})
    if existing:
        raise HTTPException(status_code=400, detail="Bu adda rol artıq mövcuddur")
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.get("name", ""),
        "permissions": data.get("permissions", {}),
        "scopes": data.get("scopes", {}),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.roles.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/roles/{role_id}")
async def update_role(role_id: str, data: dict, current_user: dict = Depends(check_permission("settings", "write"))):
    update_data = {k: v for k, v in data.items() if k not in ("id",)}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.roles.update_one({"id": role_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rol tapılmadı")
    doc = await db.roles.find_one({"id": role_id}, {"_id": 0})
    return doc

@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(check_permission("settings", "write"))):
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Rol tapılmadı")
    # Don't allow deleting role if users are assigned to it
    users_with_role = await db.users.count_documents({"role": role["name"]})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Bu rol {users_with_role} istifadəçiyə təyin edilib, əvvəl onların rolunu dəyişin")
    await db.roles.delete_one({"id": role_id})
    return {"message": "Rol silindi"}

@api_router.get("/my-permissions")
async def get_my_permissions(current_user: dict = Depends(get_current_user)):
    perms = await get_user_permissions(current_user)
    return {"role": current_user.get("role", ""), "permissions": perms}



async def _get_setting_list(key: str, defaults: list) -> list:
    doc = await db.setting_lists.find_one({"key": key}, {"_id": 0})
    if doc and doc.get("values"):
        return doc["values"]
    return defaults

@api_router.get("/settings/lists/{key}")
async def get_setting_list(key: str, current_user: dict = Depends(get_current_user)):
    doc = await db.setting_lists.find_one({"key": key}, {"_id": 0})
    if doc:
        return doc.get("values", [])
    return []

@api_router.put("/settings/lists/{key}")
async def update_setting_list(key: str, data: dict, current_user: dict = Depends(check_permission("settings", "write"))):
    values = data.get("values", [])
    await db.setting_lists.update_one({"key": key}, {"$set": {"key": key, "values": values, "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"key": key, "values": values}

@api_router.get("/options/all")
async def get_all_options(current_user: dict = Depends(get_current_user)):
    # Get dynamic data from database
    packages_db = await db.packages.find({}, {"_id": 0}).to_list(100)
    projects_db = await db.projects.find({}, {"_id": 0}).to_list(100)
    sectors_db = await db.sectors.find({}, {"_id": 0}).to_list(100)
    users_db = await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "role": 1, "department": 1}).to_list(500)
    sub_sectors_db = await db.sub_sectors.find({}, {"_id": 0}).to_list(500)
    positions_db = await db.positions.find({}, {"_id": 0}).to_list(200)
    activities_db = await db.activities.find({}, {"_id": 0}).to_list(200)
    regions_db = await db.regions.find({}, {"_id": 0}).to_list(200)
    marsol_companies_db = await db.marsol_companies.find({}, {"_id": 0}).to_list(100)
    
    # Use database values if exist, otherwise use defaults
    packages = [{"name": p["name"], "price": p.get("price", 0)} for p in packages_db] if packages_db else [{"name": "Premium", "price": 5000}, {"name": "Business", "price": 3000}, {"name": "Business Plus", "price": 4000}]
    projects = [p["name"] for p in projects_db] if projects_db else ["Üzvlük", "Sərgi", "Təlim/Proqram", "ICMA", "Sosial layihə"]
    sectors = [s["name"] for s in sectors_db] if sectors_db else ["İnşaat", "Təhsil", "Qida", "İKT", "Logistika", "Maliyyə", "Səhiyyə", "Turizm", "Kənd təsərrüfatı", "İstehsalat", "Pərakəndə satış", "Xidmət", "Digər"]
    marsol_representatives = [u["name"] for u in users_db if u.get("name")]
    sub_sectors = {}
    for ss in sub_sectors_db:
        sec = ss.get("sector", "")
        if sec not in sub_sectors:
            sub_sectors[sec] = []
        sub_sectors[sec].append(ss["name"])
    positions = [p["name"] for p in positions_db] if positions_db else ["Direktor", "Təsisçi", "Baş direktor", "İcraçı direktor", "Kommersiya direktoru", "Maliyyə direktoru"]
    activities = [a["name"] for a in activities_db] if activities_db else ["Networking", "Təlim", "Sərgi", "Forum", "Mentorluq", "İş birliyi"]
    regions = [r["name"] for r in regions_db] if regions_db else ["Bakı", "Sumqayıt", "Gəncə", "Lənkəran", "Mingəçevir", "Şəki", "Şirvan", "Naxçıvan", "Abşeron", "Digər"]
    marsol_companies = [m["name"] for m in marsol_companies_db] if marsol_companies_db else ["Marsol Group", "Marsol Events", "Marsol Media", "Marsol Academy"]
    
    return {
        "sectors": sectors,
        "packages": [p["name"] for p in packages],
        "packages_with_prices": packages,
        "company_sizes": ["Böyük", "Orta", "Kiçik", "Mikro"],
        "marsol_representatives": marsol_representatives,
        "projects": projects,
        "departments": ["Satış", "Marketing", "HR", "Maliyyə", "Layihə", "İT", "İdarəetmə"],
        "meeting_types": await _get_setting_list("meeting_types", ["Satış görüşü", "Daxili iclas", "Müştəri görüşü", "Partnyor görüşü", "Təqdimat"]),
        "task_statuses": ["Gözləyir", "İcrada", "Tamamlandı", "Ləğv edildi"],
        "priorities": ["Yüksək", "Orta", "Aşağı"],
        "meeting_types": ["Satış görüşü", "Daxili iclas", "Müştəri görüşü", "Partnyor görüşü", "Təqdimat"],
        "expense_categories": [
            {"name": "Əməliyyat xərcləri", "subcategories": ["Əmək haqqı", "Bonus", "Ofis icarəsi", "Kommunal", "Ofis xərcləri"]},
            {"name": "Marketinq xərcləri", "subcategories": ["Sosial Media reklamı", "Outdoor reklam", "Promo materiallar"]},
            {"name": "Layihə xərcləri", "subcategories": ["Məkan icarəsi", "Texniki avadanlıq", "Aparıcı", "Musiqi", "Çap materialları"]},
            {"name": "Texniki xərclər", "subcategories": ["Hosting", "Domen", "Proqram təminatı", "İT xidmətləri"]},
            {"name": "Satış xərcləri", "subcategories": ["Müştəri görüş xərcləri", "Hədiyyə"]},
            {"name": "Digər xərclər", "subcategories": ["Cərimələr", "Hüquqi xidmətlər"]}
        ],
        "reference_sources": ["Şirkət", "Şəxs", "Media", "Digər"],
        "statuses": ["Aktiv", "Qeyri-aktiv", "Gözləmədə"],
        "sub_sectors": sub_sectors,
        "positions": positions,
        "activities": activities,
        "regions": regions,
        "marsol_companies": marsol_companies,
        "education_levels": ["Orta təhsil", "Sub bakalavr", "Bakalavr", "Magistratura", "Doktorantura"],
        "event_types": EVENT_TYPES,
        "package_quotas": await get_package_quotas(),
        "lead_sources": await _get_setting_list("lead_sources", ["Marketing", "Referans", "Sosial media", "Veb sayt", "Sərgi", "Soyuq zəng", "Digər"]),
        "lead_statuses": ["Yeni", "Əlaqə quruldu", "Görüş təyin edildi", "Təklif göndərildi", "Danışıqda", "Üzv oldu", "Satıldı", "İmtina"],
        "sale_types": await _get_setting_list("sale_types", ["Üzvlük", "Sərgi stendi", "Tur (Daxili)", "Tur (Xarici)", "Təlim", "Digər"]),
    }

# Get companies for select dropdown (simplified)
@api_router.get("/options/companies")
async def get_companies_for_select(current_user: dict = Depends(get_current_user)):
    companies = await db.companies.find({}, {"_id": 0, "id": 1, "brand_name": 1, "owner_name": 1, "package": 1, "joined_project": 1, "sector": 1, "sub_sector": 1, "owner_phone": 1, "company_phone": 1, "status": 1}).to_list(1000)
    return companies

# ==================== PACKAGES MANAGEMENT ====================

@api_router.get("/settings/packages")
async def get_packages(current_user: dict = Depends(get_current_user)):
    packages = await db.packages.find({}, {"_id": 0}).to_list(100)
    if not packages:
        # Return default packages
        return [
            {"id": "1", "name": "Premium", "description": "Premium üzvlük paketi", "price": 5000, "invitation_count": 12},
            {"id": "2", "name": "Business", "description": "Business üzvlük paketi", "price": 3000, "invitation_count": 15},
            {"id": "3", "name": "Business Plus", "description": "Business Plus üzvlük paketi", "price": 4000, "invitation_count": 25},
            {"id": "4", "name": "Sponsor", "description": "Sponsor paketi", "price": 8000, "invitation_count": 40}
        ]
    return packages

@api_router.post("/settings/packages")
async def create_package(package_data: dict, current_user: dict = Depends(get_current_user)):
    package_id = str(uuid.uuid4())
    package_doc = {
        "id": package_id,
        "name": package_data.get("name"),
        "description": package_data.get("description", ""),
        "price": package_data.get("price", 0),
        "invitation_count": package_data.get("invitation_count", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.packages.insert_one(package_doc)
    package_doc.pop("_id", None)
    return package_doc

@api_router.put("/settings/packages/{package_id}")
async def update_package(package_id: str, package_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in package_data.items() if v is not None}
    result = await db.packages.update_one({"id": package_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paket tapılmadı")
    package = await db.packages.find_one({"id": package_id}, {"_id": 0})
    return package

@api_router.delete("/settings/packages/{package_id}")
async def delete_package(package_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.packages.delete_one({"id": package_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paket tapılmadı")
    return {"message": "Paket silindi"}

# ==================== PROJECTS MANAGEMENT ====================

@api_router.get("/settings/projects")
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects = await db.projects.find({}, {"_id": 0}).to_list(100)
    if not projects:
        # Return default projects
        return [
            {"id": "1", "name": "Üzvlük", "description": "Üzvlük layihəsi"},
            {"id": "2", "name": "Sərgi", "description": "Sərgi layihəsi"},
            {"id": "3", "name": "Təlim/Proqram", "description": "Təlim və proqramlar"},
            {"id": "4", "name": "ICMA", "description": "ICMA layihəsi"},
            {"id": "5", "name": "Sosial layihə", "description": "Sosial layihələr"}
        ]
    return projects

@api_router.post("/settings/projects")
async def create_project(project_data: dict, current_user: dict = Depends(get_current_user)):
    project_id = str(uuid.uuid4())
    project_doc = {
        "id": project_id,
        "name": project_data.get("name"),
        "description": project_data.get("description", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.projects.insert_one(project_doc)
    project_doc.pop("_id", None)
    return project_doc

@api_router.put("/settings/projects/{project_id}")
async def update_project(project_id: str, project_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in project_data.items() if v is not None}
    result = await db.projects.update_one({"id": project_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Layihə tapılmadı")
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return project

@api_router.delete("/settings/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Layihə tapılmadı")
    return {"message": "Layihə silindi"}

# ==================== FILE UPLOAD ====================

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4()}{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    url = f"/uploads/{filename}"
    return {"url": url, "filename": file.filename, "stored_name": filename}

@api_router.post("/public/upload")
async def public_upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4()}{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    url = f"/uploads/{filename}"
    return {"url": url, "filename": file.filename}

# ==================== BRANDING (LOGOLAR) ====================

DEFAULT_LOGO = "https://customer-assets.emergentagent.com/job_03e89fda-1599-48f3-846d-f1d3e818b1fa/artifacts/h0q248dw_Marsol.png"

@api_router.get("/public/branding")
async def get_public_branding():
    """Public read of branding config (used by Login page, PublicForm, etc)."""
    doc = await db.app_config.find_one({"key": "branding"}, {"_id": 0}) or {}
    return {
        "sidebar_logo_url": doc.get("sidebar_logo_url") or "",
        "main_logo_url": doc.get("main_logo_url") or DEFAULT_LOGO,
    }

@api_router.get("/settings/branding")
async def get_branding(current_user: dict = Depends(get_current_user)):
    doc = await db.app_config.find_one({"key": "branding"}, {"_id": 0}) or {}
    return {
        "sidebar_logo_url": doc.get("sidebar_logo_url") or "",
        "main_logo_url": doc.get("main_logo_url") or DEFAULT_LOGO,
    }

@api_router.put("/settings/branding")
async def update_branding(data: dict, current_user: dict = Depends(check_permission("settings", "write"))):
    update = {
        "key": "branding",
        "sidebar_logo_url": (data.get("sidebar_logo_url") or "").strip(),
        "main_logo_url": (data.get("main_logo_url") or "").strip(),
        "updated_by": current_user.get("name", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.app_config.update_one({"key": "branding"}, {"$set": update}, upsert=True)
    return {
        "sidebar_logo_url": update["sidebar_logo_url"],
        "main_logo_url": update["main_logo_url"] or DEFAULT_LOGO,
    }


# ==================== SUB-SECTORS ====================

@api_router.get("/settings/sub-sectors")
async def get_sub_sectors(sector: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if sector:
        query["sector"] = sector
    subs = await db.sub_sectors.find(query, {"_id": 0}).to_list(500)
    return subs

@api_router.post("/settings/sub-sectors")
async def create_sub_sector(data: dict, current_user: dict = Depends(get_current_user)):
    sub_id = str(uuid.uuid4())
    doc = {"id": sub_id, "name": data.get("name"), "sector": data.get("sector"), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.sub_sectors.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/settings/sub-sectors/{sub_id}")
async def update_sub_sector(sub_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    result = await db.sub_sectors.update_one({"id": sub_id}, {"$set": {k: v for k, v in data.items() if v is not None}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alt sektor tapılmadı")
    return await db.sub_sectors.find_one({"id": sub_id}, {"_id": 0})

@api_router.delete("/settings/sub-sectors/{sub_id}")
async def delete_sub_sector(sub_id: str, current_user: dict = Depends(get_current_user)):
    await db.sub_sectors.delete_one({"id": sub_id})
    return {"message": "Alt sektor silindi"}

# ==================== POSITIONS (VƏZİFƏLƏR) ====================

@api_router.get("/settings/positions")
async def get_positions(current_user: dict = Depends(get_current_user)):
    positions = await db.positions.find({}, {"_id": 0}).to_list(200)
    if not positions:
        return [{"id": str(i), "name": n} for i, n in enumerate(["Direktor", "Təsisçi", "Baş direktor", "İcraçı direktor", "Kommersiya direktoru", "Maliyyə direktoru"])]
    return positions

@api_router.post("/settings/positions")
async def create_position(data: dict, current_user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "name": data.get("name"), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.positions.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/settings/positions/{pos_id}")
async def delete_position(pos_id: str, current_user: dict = Depends(get_current_user)):
    await db.positions.delete_one({"id": pos_id})
    return {"message": "Vəzifə silindi"}

# ==================== ACTIVITIES (FƏALİYYƏTLƏR) ====================

@api_router.get("/settings/activities")
async def get_activities(current_user: dict = Depends(get_current_user)):
    acts = await db.activities.find({}, {"_id": 0}).to_list(200)
    if not acts:
        return [{"id": str(i), "name": n} for i, n in enumerate(["Networking", "Təlim", "Sərgi", "Forum", "Mentorluq", "İş birliyi"])]
    return acts

@api_router.post("/settings/activities")
async def create_activity(data: dict, current_user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "name": data.get("name"), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.activities.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/settings/activities/{act_id}")
async def delete_activity(act_id: str, current_user: dict = Depends(get_current_user)):
    await db.activities.delete_one({"id": act_id})
    return {"message": "Fəaliyyət silindi"}

# ==================== REGIONS (REGİONLAR) ====================

@api_router.get("/settings/regions")
async def get_regions(current_user: dict = Depends(get_current_user)):
    regions = await db.regions.find({}, {"_id": 0}).to_list(200)
    if not regions:
        return [{"id": str(i), "name": n} for i, n in enumerate(["Bakı", "Sumqayıt", "Gəncə", "Lənkəran", "Mingəçevir", "Şəki", "Şirvan", "Naxçıvan", "Abşeron", "Digər"])]
    return regions

@api_router.post("/settings/regions")
async def create_region(data: dict, current_user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "name": data.get("name"), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.regions.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/settings/regions/{region_id}")
async def delete_region(region_id: str, current_user: dict = Depends(get_current_user)):
    await db.regions.delete_one({"id": region_id})
    return {"message": "Region silindi"}

# ==================== MARSOL COMPANIES (MÜƏSSİSƏLƏR) ====================

@api_router.get("/settings/marsol-companies")
async def get_marsol_companies(current_user: dict = Depends(get_current_user)):
    items = await db.marsol_companies.find({}, {"_id": 0}).to_list(100)
    if not items:
        return [{"id": str(i), "name": n} for i, n in enumerate(["Marsol Group", "Marsol Events", "Marsol Media", "Marsol Academy"])]
    return items

@api_router.post("/settings/marsol-companies")
async def create_marsol_company(data: dict, current_user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "name": data.get("name"), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.marsol_companies.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/settings/marsol-companies/{item_id}")
async def delete_marsol_company(item_id: str, current_user: dict = Depends(get_current_user)):
    await db.marsol_companies.delete_one({"id": item_id})
    return {"message": "Müəssisə silindi"}

# ==================== SECTORS MANAGEMENT ====================

@api_router.get("/settings/sectors")
async def get_sectors(current_user: dict = Depends(get_current_user)):
    sectors = await db.sectors.find({}, {"_id": 0}).to_list(100)
    if not sectors:
        defaults = ["İnşaat", "Təhsil", "Qida", "İKT", "Logistika", "Maliyyə", "Səhiyyə", "Turizm", "Kənd təsərrüfatı", "İstehsalat", "Pərakəndə satış", "Xidmət", "Digər"]
        return [{"id": str(i+1), "name": s} for i, s in enumerate(defaults)]
    return sectors

@api_router.post("/settings/sectors")
async def create_sector(sector_data: dict, current_user: dict = Depends(get_current_user)):
    sector_id = str(uuid.uuid4())
    sector_doc = {
        "id": sector_id,
        "name": sector_data.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sectors.insert_one(sector_doc)
    sector_doc.pop("_id", None)
    return sector_doc

@api_router.put("/settings/sectors/{sector_id}")
async def update_sector(sector_id: str, sector_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in sector_data.items() if v is not None}
    result = await db.sectors.update_one({"id": sector_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sektor tapılmadı")
    sector = await db.sectors.find_one({"id": sector_id}, {"_id": 0})
    return sector

@api_router.delete("/settings/sectors/{sector_id}")
async def delete_sector(sector_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.sectors.delete_one({"id": sector_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sektor tapılmadı")
    return {"message": "Sektor silindi"}

# ==================== CUSTOM FIELDS ====================

@api_router.get("/settings/custom-fields")
async def get_custom_fields(module: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if module and module != "all":
        query["module"] = module
    fields = await db.custom_fields.find(query, {"_id": 0}).to_list(500)
    return fields

@api_router.post("/settings/custom-fields")
async def create_custom_field(field_data: dict, current_user: dict = Depends(get_current_user)):
    field_id = str(uuid.uuid4())
    field_doc = {
        "id": field_id,
        "module": field_data.get("module"),
        "sub_tab": field_data.get("sub_tab", ""),
        "field_name": field_data.get("field_name"),
        "field_label": field_data.get("field_label", ""),
        "field_type": field_data.get("field_type", "text"),
        "options": field_data.get("options", []),
        "required": field_data.get("required", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.custom_fields.insert_one(field_doc)
    field_doc.pop("_id", None)
    return field_doc

@api_router.put("/settings/custom-fields/{field_id}")
async def update_custom_field(field_id: str, field_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in field_data.items() if v is not None}
    result = await db.custom_fields.update_one({"id": field_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sahə tapılmadı")
    field = await db.custom_fields.find_one({"id": field_id}, {"_id": 0})
    return field

@api_router.delete("/settings/custom-fields/{field_id}")
async def delete_custom_field(field_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.custom_fields.delete_one({"id": field_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sahə tapılmadı")
    return {"message": "Sahə silindi"}

# ==================== USER MANAGEMENT ====================

@api_router.get("/settings/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(500)
    return users

@api_router.post("/settings/users")
async def create_user(user_data: dict, current_user: dict = Depends(get_current_user)):
    existing = await db.users.find_one({"email": user_data.get("email")})
    if existing:
        raise HTTPException(status_code=400, detail="Bu email artıq mövcuddur")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.get("email"),
        "name": user_data.get("name"),
        "password": hash_password(user_data.get("password", "123456")),
        "role": user_data.get("role", "user"),
        "department": user_data.get("department", ""),
        "phone": user_data.get("phone", ""),
        "status": user_data.get("status", "Aktiv"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)
    user_doc.pop("password", None)
    return user_doc

@api_router.put("/settings/users/{user_id}")
async def update_user(user_id: str, user_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {}
    for k, v in user_data.items():
        if v is not None and k != "password":
            update_data[k] = v
    if "password" in user_data and user_data["password"]:
        update_data["password"] = hash_password(user_data["password"])
    if not update_data:
        raise HTTPException(status_code=400, detail="Yenilənəcək məlumat yoxdur")
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return user

@api_router.delete("/settings/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=400, detail="Özünüzü silə bilməzsiniz")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")
    return {"message": "İstifadəçi silindi"}

# ==================== SALES (SATIŞ) ====================

@api_router.get("/sales/leads")
async def get_leads(stage: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if stage and stage != "all":
        query["stage"] = stage
    leads = await db.sales_leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return leads

@api_router.post("/sales/leads")
async def create_lead(lead_data: dict, current_user: dict = Depends(get_current_user)):
    lead_id = str(uuid.uuid4())
    lead_doc = {
        "id": lead_id,
        "company_name": lead_data.get("company_name", ""),
        "contact_person": lead_data.get("contact_person", ""),
        "phone": lead_data.get("phone", ""),
        "email": lead_data.get("email", ""),
        "source": lead_data.get("source", ""),
        "stage": lead_data.get("stage", "Yeni Lead"),
        "assigned_to": lead_data.get("assigned_to", ""),
        "expected_amount": lead_data.get("expected_amount", 0),
        "package": lead_data.get("package", ""),
        "project": lead_data.get("project", ""),
        "notes": lead_data.get("notes", ""),
        "priority": lead_data.get("priority", "Orta"),
        "next_action_date": lead_data.get("next_action_date", ""),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sales_leads.insert_one(lead_doc)
    lead_doc.pop("_id", None)
    return lead_doc

@api_router.put("/sales/leads/{lead_id}")
async def update_lead(lead_id: str, lead_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in lead_data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.sales_leads.update_one({"id": lead_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead tapılmadı")
    lead = await db.sales_leads.find_one({"id": lead_id}, {"_id": 0})
    return lead

@api_router.delete("/sales/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.sales_leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead tapılmadı")
    return {"message": "Lead silindi"}

@api_router.get("/sales/stats")
async def get_sales_stats(current_user: dict = Depends(get_current_user)):
    stages = ["Yeni Lead", "Əlaqə", "Təklif", "Danışıq", "Uğurlu", "Uğursuz"]
    stats = {}
    for stage in stages:
        count = await db.sales_leads.count_documents({"stage": stage})
        pipeline = [{"$match": {"stage": stage}}, {"$group": {"_id": None, "total": {"$sum": "$expected_amount"}}}]
        amount_data = await db.sales_leads.aggregate(pipeline).to_list(1)
        stats[stage] = {"count": count, "amount": amount_data[0]["total"] if amount_data else 0}
    return stats

# ==================== MESSAGES (MESAJLAR) ====================

@api_router.get("/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    conversations = await db.conversations.find(
        {"participants": user_id}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    return conversations

@api_router.post("/messages/conversations")
async def create_conversation(data: dict, current_user: dict = Depends(get_current_user)):
    conv_id = str(uuid.uuid4())
    participant_id = data.get("participant_id")
    # Check if conversation already exists
    existing = await db.conversations.find_one({
        "participants": {"$all": [current_user["id"], participant_id]}
    })
    if existing:
        existing.pop("_id", None)
        return existing
    
    participant = await db.users.find_one({"id": participant_id}, {"_id": 0, "password": 0})
    if not participant:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")
    
    conv_doc = {
        "id": conv_id,
        "participants": [current_user["id"], participant_id],
        "participant_names": {current_user["id"]: current_user["name"], participant_id: participant["name"]},
        "last_message": "",
        "last_message_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.conversations.insert_one(conv_doc)
    conv_doc.pop("_id", None)
    return conv_doc

@api_router.get("/messages/{conversation_id}")
async def get_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return messages

@api_router.post("/messages/{conversation_id}")
async def send_message(conversation_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    msg_id = str(uuid.uuid4())
    msg_doc = {
        "id": msg_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["name"],
        "text": data.get("text", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(msg_doc)
    msg_doc.pop("_id", None)
    
    # Update conversation last message
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message": data.get("text", ""), "last_message_at": msg_doc["created_at"]}}
    )
    return msg_doc

# ==================== PACKAGE QUOTA CONFIG ====================

DEFAULT_PACKAGE_QUOTAS = {
    "Premium": 12,
    "Business": 15,
    "Business Plus": 25,
    "Business+": 25,
    "Sponsor": 40,
}

async def get_package_quotas():
    packages = await db.packages.find({}, {"_id": 0, "name": 1, "invitation_count": 1}).to_list(100)
    if packages:
        quotas = {}
        for p in packages:
            name = p.get("name", "")
            count = p.get("invitation_count", 0)
            if name and count:
                quotas[name] = count
        if quotas:
            return quotas
    return DEFAULT_PACKAGE_QUOTAS

EVENT_TYPES = ["Breakfast", "Ofis ziyarəti", "Mafia", "Sosial fəaliyyət", "Təlim", "B2B görüş"]

# ==================== EVENTS (FƏALİYYƏTLƏR/GÖRÜŞLƏR) ====================

@api_router.get("/events")
async def get_events(event_type: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if event_type and event_type != "all":
        query["event_type"] = event_type
    if status and status != "all":
        query["status"] = status
    events = await db.events.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return events

@api_router.post("/events")
async def create_event(data: dict, current_user: dict = Depends(get_current_user)):
    event_id = str(uuid.uuid4())
    event_doc = {
        "id": event_id,
        "name": data.get("name", ""),
        "event_type": data.get("event_type", ""),
        "date": data.get("date", ""),
        "time": data.get("time", ""),
        "venue": data.get("venue", ""),
        "location_link": data.get("location_link", ""),
        "participant_limit": data.get("participant_limit", 0),
        "host_company_id": data.get("host_company_id", ""),
        "host_company_name": data.get("host_company_name", ""),
        "status": data.get("status", "Planlaşdırılır"),
        "notes": data.get("notes", ""),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    event_doc.pop("_id", None)
    return event_doc

@api_router.get("/events/{event_id}")
async def get_event(event_id: str, current_user: dict = Depends(get_current_user)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Fəaliyyət tapılmadı")
    return event

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.events.update_one({"id": event_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fəaliyyət tapılmadı")
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    return event

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fəaliyyət tapılmadı")
    await db.invitations.delete_many({"event_id": event_id})
    return {"message": "Fəaliyyət silindi"}

@api_router.get("/events/types/list")
async def get_event_types(current_user: dict = Depends(get_current_user)):
    return EVENT_TYPES

# ==================== INVITATIONS (DƏVƏTLƏR) ====================

@api_router.get("/invitations")
async def get_invitations(event_id: Optional[str] = None, company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if event_id:
        query["event_id"] = event_id
    if company_id:
        query["company_id"] = company_id
    invitations = await db.invitations.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return invitations

@api_router.post("/invitations")
async def create_invitation(data: dict, current_user: dict = Depends(get_current_user)):
    inv_id = str(uuid.uuid4())
    inv_doc = {
        "id": inv_id,
        "event_id": data.get("event_id", ""),
        "event_name": data.get("event_name", ""),
        "event_type": data.get("event_type", ""),
        "event_date": data.get("event_date", ""),
        "company_id": data.get("company_id", ""),
        "company_name": data.get("company_name", ""),
        "call_status": "Gözləyir",
        "participation_status": "",
        "obligation_deducted": False,
        "called_by": "",
        "called_at": "",
        "notes": data.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.invitations.insert_one(inv_doc)
    inv_doc.pop("_id", None)
    return inv_doc

@api_router.post("/invitations/bulk")
async def create_bulk_invitations(data: dict, current_user: dict = Depends(get_current_user)):
    event_id = data.get("event_id", "")
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Fəaliyyət tapılmadı")
    company_ids = data.get("company_ids", [])
    created = []
    for cid in company_ids:
        existing = await db.invitations.find_one({"event_id": event_id, "company_id": cid})
        if existing:
            continue
        company = await db.companies.find_one({"id": cid}, {"_id": 0, "brand_name": 1})
        inv_id = str(uuid.uuid4())
        inv_doc = {
            "id": inv_id,
            "event_id": event_id,
            "event_name": event.get("name", ""),
            "event_type": event.get("event_type", ""),
            "event_date": event.get("date", ""),
            "company_id": cid,
            "company_name": company.get("brand_name", "") if company else "",
            "call_status": "Gözləyir",
            "participation_status": "",
            "obligation_deducted": False,
            "called_by": "",
            "called_at": "",
            "notes": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.invitations.insert_one(inv_doc)
        inv_doc.pop("_id", None)
        created.append(inv_doc)
    return {"created": len(created), "invitations": created}

@api_router.put("/invitations/{inv_id}/call")
async def update_invitation_call(inv_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    call_status = data.get("call_status", "")
    participation_status = data.get("participation_status", "")
    update = {
        "call_status": call_status,
        "called_by": current_user.get("name", ""),
        "called_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if call_status == "Cavab verdi":
        update["participation_status"] = participation_status
        update["obligation_deducted"] = True
    elif call_status == "Cavab vermədi":
        update["participation_status"] = ""
        update["obligation_deducted"] = False
    result = await db.invitations.update_one({"id": inv_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dəvət tapılmadı")
    inv = await db.invitations.find_one({"id": inv_id}, {"_id": 0})
    return inv

@api_router.delete("/invitations/{inv_id}")
async def delete_invitation(inv_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.invitations.delete_one({"id": inv_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dəvət tapılmadı")
    return {"message": "Dəvət silindi"}

# ==================== OBLIGATIONS (ÖHDƏLİKLƏR) ====================

async def _get_company_obligation(company: dict, year: Optional[int] = None) -> dict:
    """Compute obligation stats. If year given, use period covering that year (current or from history) and only count invitations whose event_date is in that year."""
    quotas = await get_package_quotas()
    company_id = company.get("id", "")

    # Find the applicable period
    current = {
        "package": company.get("package", ""),
        "contract_start": company.get("contract_start_date", ""),
        "contract_end": company.get("contract_end_date", ""),
    }
    history = company.get("membership_history", []) or []
    
    def period_covers_year(period, y):
        try:
            cs = period.get("contract_start") or period.get("contract_start_date") or ""
            ce = period.get("contract_end") or period.get("contract_end_date") or ""
            cs_y = int(cs[:4]) if cs else 0
            ce_y = int(ce[:4]) if ce else 9999
            return cs_y <= y <= ce_y
        except (ValueError, TypeError):
            return False

    period = current
    if year is not None:
        # Try current first; else search history
        if not period_covers_year(current, year):
            for h in history:
                if period_covers_year(h, year):
                    period = {
                        "package": h.get("package", ""),
                        "contract_start": h.get("contract_start", ""),
                        "contract_end": h.get("contract_end", ""),
                    }
                    break
    
    package = period["package"]
    total_quota = quotas.get(package, 0)
    start_date = period["contract_start"]
    end_date = period["contract_end"]
    
    now = datetime.now(timezone.utc)
    days_remaining = 365
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            days_remaining = max((end_dt - now.replace(tzinfo=None)).days, 0)
        except (ValueError, TypeError):
            pass
    
    # Build invitation filter — by year if given, else by current period dates
    inv_filter = {"company_id": company_id, "obligation_deducted": True}
    inv_all_filter = {"company_id": company_id}
    if year is not None:
        # Match invitations whose event_date is in that calendar year
        date_re = f"^{year}-"
        inv_filter["event_date"] = {"$regex": date_re}
        inv_all_filter["event_date"] = {"$regex": date_re}
    
    used_quota = await db.invitations.count_documents(inv_filter)
    remaining = max(total_quota - used_quota, 0)
    priority_score = 0
    if days_remaining > 0 and remaining > 0:
        priority_score = remaining * (365 / max(days_remaining, 1))
    elif days_remaining == 0 and remaining > 0:
        priority_score = remaining * 1000
    total_invited = await db.invitations.count_documents(inv_all_filter)
    total_attended = await db.invitations.count_documents({**inv_all_filter, "participation_status": "Qatılır"})
    total_declined = await db.invitations.count_documents({**inv_all_filter, "participation_status": "Qatılmır"})
    total_no_answer = await db.invitations.count_documents({**inv_all_filter, "call_status": "Cavab vermədi"})
    return {
        "company_id": company_id,
        "company_name": company.get("brand_name", ""),
        "owner_name": company.get("owner_name", ""),
        "owner_phone": company.get("owner_phone", ""),
        "company_phone": company.get("company_phone", ""),
        "package": package,
        "total_quota": total_quota,
        "used_quota": used_quota,
        "remaining_quota": remaining,
        "contract_start_date": start_date,
        "contract_end_date": end_date,
        "days_remaining": days_remaining,
        "priority_score": round(priority_score, 2),
        "total_invited": total_invited,
        "total_attended": total_attended,
        "total_declined": total_declined,
        "total_no_answer": total_no_answer,
        "status": company.get("status", "Aktiv"),
    }

def _company_covers_year(company: dict, year: int) -> bool:
    """True if any membership period (current or in history) covers the given calendar year."""
    def cov(cs, ce):
        try:
            cs_y = int(cs[:4]) if cs else 0
            ce_y = int(ce[:4]) if ce else 9999
            return cs_y <= year <= ce_y
        except (ValueError, TypeError):
            return False
    if cov(company.get("contract_start_date", ""), company.get("contract_end_date", "")):
        return True
    for h in (company.get("membership_history") or []):
        if cov(h.get("contract_start", ""), h.get("contract_end", "")):
            return True
    return False

@api_router.get("/obligations/dashboard")
async def get_obligations_dashboard(year: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    companies = await db.companies.find({"status": "Aktiv"}, {"_id": 0}).to_list(2000)
    if year is not None:
        companies = [c for c in companies if _company_covers_year(c, year)]
    obligations = []
    for c in companies:
        obl = await _get_company_obligation(c, year=year)
        obligations.append(obl)
    obligations.sort(key=lambda x: x["priority_score"], reverse=True)
    total = len(obligations)
    not_invited = sum(1 for o in obligations if o["total_invited"] == 0)
    under_invited = sum(1 for o in obligations if 0 < o["total_invited"] < o["total_quota"] and o["remaining_quota"] > 0)
    fully_served = sum(1 for o in obligations if o["remaining_quota"] == 0)
    urgent = sum(1 for o in obligations if o["priority_score"] > 50)
    return {
        "obligations": obligations,
        "stats": {
            "total": total,
            "not_invited": not_invited,
            "under_invited": under_invited,
            "fully_served": fully_served,
            "urgent": urgent,
        }
    }

@api_router.get("/obligations/company/{company_id}")
async def get_company_obligation(company_id: str, year: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    obl = await _get_company_obligation(company, year=year)
    inv_filter = {"company_id": company_id}
    if year is not None:
        inv_filter["event_date"] = {"$regex": f"^{year}-"}
    invitations = await db.invitations.find(inv_filter, {"_id": 0}).sort("event_date", -1).to_list(500)
    type_breakdown = {}
    for inv in invitations:
        et = inv.get("event_type", "Digər")
        if et not in type_breakdown:
            type_breakdown[et] = {"invited": 0, "attended": 0, "declined": 0, "no_answer": 0}
        type_breakdown[et]["invited"] += 1
        if inv.get("participation_status") == "Qatılır":
            type_breakdown[et]["attended"] += 1
        elif inv.get("participation_status") == "Qatılmır":
            type_breakdown[et]["declined"] += 1
        if inv.get("call_status") == "Cavab vermədi":
            type_breakdown[et]["no_answer"] += 1
    obl["invitations"] = invitations
    obl["type_breakdown"] = type_breakdown
    return obl

# ==================== AUTO-SUGGEST (AVTO-TƏKLİF) ====================

@api_router.post("/events/{event_id}/auto-suggest")
async def auto_suggest_companies(event_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Fəaliyyət tapılmadı")
    count = data.get("count", event.get("participant_limit", 20))
    exclude_ids = data.get("exclude_ids", [])
    already_invited = await db.invitations.find({"event_id": event_id}, {"_id": 0, "company_id": 1}).to_list(5000)
    already_invited_ids = {inv["company_id"] for inv in already_invited}
    companies = await db.companies.find({"status": "Aktiv"}, {"_id": 0}).to_list(2000)
    candidates = []
    for c in companies:
        cid = c.get("id", "")
        if cid in already_invited_ids or cid in exclude_ids:
            continue
        obl = await _get_company_obligation(c)
        if obl["remaining_quota"] <= 0:
            continue
        obl["sector"] = c.get("sector", "")
        obl["sub_sector"] = c.get("sub_sector", "")
        candidates.append(obl)
    candidates.sort(key=lambda x: x["priority_score"], reverse=True)
    # Sector conflict filter: only 1 company per sub_sector (or sector if no sub_sector)
    selected = []
    used_sub_sectors = set()
    for c in candidates:
        sub = c.get("sub_sector") or ""
        sector = c.get("sector") or ""
        conflict_key = sub.strip().lower() if sub.strip() else sector.strip().lower()
        if conflict_key and conflict_key in used_sub_sectors:
            continue
        selected.append(c)
        if conflict_key:
            used_sub_sectors.add(conflict_key)
        if len(selected) >= count:
            break
    return {"suggestions": selected, "total_candidates": len(candidates)}

@api_router.post("/events/{event_id}/check-sector-conflict")
async def check_sector_conflict(event_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    company_id = data.get("company_id", "")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        return {"conflict": False}
    company_sub = (company.get("sub_sector") or "").strip().lower()
    company_sector = (company.get("sector") or "").strip().lower()
    check_key = company_sub if company_sub else company_sector
    if not check_key:
        return {"conflict": False}
    invited = await db.invitations.find({"event_id": event_id}, {"_id": 0, "company_id": 1}).to_list(500)
    for inv in invited:
        inv_company = await db.companies.find_one({"id": inv["company_id"]}, {"_id": 0, "sector": 1, "sub_sector": 1, "brand_name": 1})
        if not inv_company:
            continue
        inv_sub = (inv_company.get("sub_sector") or "").strip().lower()
        inv_sector = (inv_company.get("sector") or "").strip().lower()
        inv_key = inv_sub if inv_sub else inv_sector
        if inv_key == check_key:
            return {
                "conflict": True,
                "conflicting_company": inv_company.get("brand_name", ""),
                "conflict_type": "alt sektor" if company_sub else "sektor",
                "conflict_value": company.get("sub_sector") or company.get("sector", "")
            }
    return {"conflict": False}

# ==================== NOTIFICATIONS (BİLDİRİŞLƏR) ====================

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = []
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # 1. Overdue debts (borclu şirkətlər)
    debtors = await db.companies.find({"debt_amount": {"$gt": 0}}, {"_id": 0}).to_list(500)
    for c in debtors:
        days_overdue = 0
        if c.get("payment_due_date"):
            try:
                due = datetime.strptime(c["payment_due_date"], "%Y-%m-%d")
                diff = (now.replace(tzinfo=None) - due).days
                if diff > 0:
                    days_overdue = diff
            except (ValueError, TypeError):
                pass
        if days_overdue > 0:
            notifications.append({
                "id": f"debt-{c['id']}",
                "type": "debt_overdue",
                "severity": "high" if days_overdue > 30 else "medium",
                "title": f"Gecikmiş ödəniş: {c['brand_name']}",
                "message": f"{c['debt_amount']:,.0f} AZN borc — {days_overdue} gün gecikib",
                "company_id": c["id"],
                "date": today
            })
        elif (c.get("debt_amount") or 0) > 0:
            notifications.append({
                "id": f"debt-pending-{c['id']}",
                "type": "debt_pending",
                "severity": "low",
                "title": f"Ödənilməmiş borc: {c['brand_name']}",
                "message": f"{c['debt_amount']:,.0f} AZN borc qalıb",
                "company_id": c["id"],
                "date": today
            })

    # 2. Contract expiring soon (müqavilə xitamı yaxınlaşan)
    all_companies = await db.companies.find({"contract_end_date": {"$ne": ""}}, {"_id": 0}).to_list(500)
    for c in all_companies:
        end_str = c.get("contract_end_date")
        if not end_str:
            continue
        try:
            end_date = datetime.strptime(end_str, "%Y-%m-%d")
            diff = (end_date - now.replace(tzinfo=None)).days
            if diff < 0:
                notifications.append({
                    "id": f"contract-expired-{c['id']}",
                    "type": "contract_expired",
                    "severity": "high",
                    "title": f"Müqavilə bitib: {c.get('brand_name', '')}",
                    "message": f"Müqavilə {abs(diff)} gün əvvəl bitib ({end_str})",
                    "company_id": c["id"],
                    "date": today
                })
            elif diff <= 30:
                notifications.append({
                    "id": f"contract-expiring-{c['id']}",
                    "type": "contract_expiring",
                    "severity": "medium",
                    "title": f"Müqavilə bitir: {c.get('brand_name', '')}",
                    "message": f"{diff} gün sonra bitəcək ({end_str})",
                    "company_id": c["id"],
                    "date": today
                })
        except (ValueError, TypeError):
            pass

    # 3.5 Pending form submissions (üzvlük formu təsdiq gözləyir)
    pending_form_companies = await db.companies.find(
        {"pending_form_data": {"$exists": True, "$ne": {}}},
        {"_id": 0}
    ).to_list(500)
    for c in pending_form_companies:
        if not (c.get("pending_form_data") or {}):
            continue
        notifications.append({
            "id": f"form-pending-{c['id']}",
            "type": "form_submission",
            "severity": "medium",
            "title": f"Forum dəyişikliyi: {c.get('brand_name', '')}",
            "message": f"Üzvlük forumu doldurulub, təsdiq gözləyir.",
            "company_id": c["id"],
            "date": (c.get("pending_form_submitted_at") or "")[:10] or today
        })

    # 4. Meeting reminders (görüş xatırlatmaları)
    meeting_reminders = await db.notifications.find({"type": "reminder"}, {"_id": 0}).to_list(500)
    for r in meeting_reminders:
        severity = "low"
        rem_date = r.get("reminder_date", "")
        if rem_date:
            try:
                rd = datetime.strptime(rem_date, "%Y-%m-%d")
                diff = (rd - now.replace(tzinfo=None)).days
                if diff < 0:
                    severity = "high"
                elif diff <= 1:
                    severity = "high"
                elif diff <= 3:
                    severity = "medium"
            except (ValueError, TypeError):
                pass
        notifications.append({
            "id": r.get("id", ""),
            "type": "reminder",
            "severity": severity,
            "title": r.get("title", "Görüş xatırlatması"),
            "message": r.get("message", ""),
            "meeting_id": r.get("meeting_id", ""),
            "reminder_date": rem_date,
            "reminder_time": r.get("reminder_time", ""),
            "is_read": r.get("is_read", False),
            "date": rem_date or today
        })

    # 4. Membership expiry warnings (üzvlük bitmə xəbərdarlığı)
    warning_days_doc = await db.setting_lists.find_one({"key": "membership_warning_days"}, {"_id": 0})
    warning_days = 10
    if warning_days_doc and warning_days_doc.get("values"):
        try:
            warning_days = int(warning_days_doc["values"][0])
        except (ValueError, IndexError):
            pass
    expiring = await db.companies.find({"contract_end_date": {"$ne": ""}}, {"_id": 0, "id": 1, "brand_name": 1, "contract_end_date": 1, "curator": 1}).to_list(500)
    for c in expiring:
        end_str = c.get("contract_end_date")
        if not end_str:
            continue
        try:
            end_dt = datetime.strptime(end_str, "%Y-%m-%d")
            diff = (end_dt - now.replace(tzinfo=None)).days
            if 0 < diff <= warning_days:
                notifications.append({
                    "id": f"expiry-{c['id']}",
                    "type": "membership_expiry",
                    "severity": "high" if diff <= 3 else "medium",
                    "title": f"Üzvlük bitir: {c.get('brand_name', '')}",
                    "message": f"{diff} gün sonra bitəcək ({end_str})",
                    "company_id": c["id"],
                    "date": today
                })
            elif diff <= 0:
                notifications.append({
                    "id": f"expired-{c['id']}",
                    "type": "membership_expired",
                    "severity": "high",
                    "title": f"Üzvlük bitib: {c.get('brand_name', '')}",
                    "message": f"{abs(diff)} gün əvvəl bitib ({end_str})",
                    "company_id": c["id"],
                    "date": today
                })
        except (ValueError, TypeError):
            pass

    # Sort by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    notifications.sort(key=lambda x: severity_order.get(x["severity"], 3))
    
    return {"notifications": notifications, "count": len(notifications), "high_count": sum(1 for n in notifications if n["severity"] == "high")}


@api_router.post("/notifications/dispatch-emails")
async def dispatch_notification_emails(current_user: dict = Depends(get_current_user)):
    """Send email for any new computed notifications (idempotent by id).
    Called periodically by frontend (e.g. on dashboard load).
    Each unique notification id gets sent at most once."""
    full = await get_notifications(current_user)
    notifications = full.get("notifications", [])
    if not notifications:
        return {"sent": 0, "skipped": 0}
    # Find which ones already dispatched
    ids = [n["id"] for n in notifications]
    already = await db.notification_email_log.find({"id": {"$in": ids}}, {"_id": 0, "id": 1}).to_list(2000)
    already_ids = {a["id"] for a in already}
    sent = 0
    for n in notifications:
        if n["id"] in already_ids:
            continue
        # Resolve curator email if company-related
        curator_email = None
        if n.get("company_id"):
            comp = await db.companies.find_one({"id": n["company_id"]}, {"_id": 0, "curator": 1})
            curator_email = await _user_email_by_name((comp or {}).get("curator", ""))
        severity_label = {"high": "🔴 Yüksək", "medium": "🟡 Orta", "low": "🟢 Aşağı"}.get(n.get("severity", "low"), "")
        body = f"""<p>{severity_label} prioritetli sistem bildirişi:</p>
        <table cellpadding='6' cellspacing='0' style='width:100%;border:1px solid #e2e8f0;border-radius:8px;font-size:13px'>
          <tr><td style='color:#64748b'>Başlıq</td><td style='font-weight:600'>{n.get('title', '')}</td></tr>
          <tr><td style='color:#64748b'>Mesaj</td><td>{n.get('message', '')}</td></tr>
          <tr><td style='color:#64748b'>Tarix</td><td>{n.get('date', '')}</td></tr>
        </table>
        <p style='margin-top:12px;color:#64748b;font-size:12px'>Sistemə daxil olub aydınlaşdırın.</p>"""
        await _email_notify_safe(
            title=n.get("title", "Bildiriş"),
            body_html=body,
            extra_recipients=[curator_email],
        )
        # Log every dispatch attempt so we don't retry on subsequent fetches
        await db.notification_email_log.insert_one({
            "id": n["id"],
            "type": n.get("type", ""),
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
        sent += 1
    return {"sent": sent, "skipped": len(notifications) - sent}


# Root
@api_router.get("/")
async def root():
    return {"message": "Marsol Group Management System API"}

# ==================== TƏŞKİLATÇILIQ / FƏALİYYƏTLƏR — VENDOR MODULLARI ====================

ORG_COLLECTIONS = {
    "venues": "org_venues",
    "catering": "org_catering",
    "decor": "org_decor",
    "musicians": "org_musicians",
    "photovideo": "org_photovideo",
    "transport": "org_transport",
    "materials": "org_materials",
}

ORG_LABELS = {
    "venues": "Məkanlar",
    "catering": "Catering",
    "decor": "Dekor və texniki təchizat",
    "musicians": "Musiqiçilər və şou komandaları",
    "photovideo": "Foto / Video",
    "transport": "Nəqliyyat və logistika",
    "materials": "Tədbir materialları",
}

# ===== RATINGS (DECLARE BEFORE /organization/{module} TO AVOID ROUTE CONFLICT) =====

@api_router.get("/organization/ratings/list")
async def list_ratings(
    vendor_type: Optional[str] = None,
    vendor_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if vendor_type and vendor_type != "all":
        query["vendor_type"] = vendor_type
    if vendor_id:
        query["vendor_id"] = vendor_id
    items = await db.org_ratings.find(query, {"_id": 0}).sort("event_date", -1).to_list(5000)
    return items

@api_router.post("/organization/ratings")
async def create_rating(data: dict, current_user: dict = Depends(check_permission("organization", "write"))):
    vendor_type = data.get("vendor_type", "")
    if vendor_type not in ORG_COLLECTIONS:
        raise HTTPException(status_code=400, detail="Yanlış təchizatçı növü")
    vendor = await db[ORG_COLLECTIONS[vendor_type]].find_one({"id": data.get("vendor_id", "")}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Təchizatçı tapılmadı")
    def f(x, default=0):
        try: return float(x or default)
        except (ValueError, TypeError): return default
    doc = {
        "id": str(uuid.uuid4()),
        "vendor_type": vendor_type,
        "vendor_id": data.get("vendor_id", ""),
        "vendor_name": vendor.get("name") or vendor.get("vendor_name") or vendor.get("venue_name") or "",
        "event_name": data.get("event_name", ""),
        "event_date": data.get("event_date", ""),
        "price_score": f(data.get("price_score"), 5),
        "quality_score": f(data.get("quality_score"), 5),
        "operativity_score": f(data.get("operativity_score"), 5),
        "behavior_score": f(data.get("behavior_score"), 5),
        "flexibility_score": f(data.get("flexibility_score"), 5),
        "event_fit_score": f(data.get("event_fit_score"), 5),
        "rehire_willingness": data.get("rehire_willingness", "Bəli"),
        "comment": data.get("comment", ""),
        "rated_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.org_ratings.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/organization/ratings/{rating_id}")
async def delete_rating(rating_id: str, current_user: dict = Depends(check_permission("organization", "write"))):
    await db.org_ratings.delete_one({"id": rating_id})
    return {"message": "Reytinq silindi"}

@api_router.get("/organization/ratings/summary")
async def ratings_summary(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$group": {
            "_id": {"vendor_type": "$vendor_type", "vendor_id": "$vendor_id"},
            "vendor_name": {"$last": "$vendor_name"},
            "count": {"$sum": 1},
            "avg_price": {"$avg": "$price_score"},
            "avg_quality": {"$avg": "$quality_score"},
            "avg_operativity": {"$avg": "$operativity_score"},
            "avg_behavior": {"$avg": "$behavior_score"},
            "avg_flexibility": {"$avg": "$flexibility_score"},
            "avg_fit": {"$avg": "$event_fit_score"},
            "rehire_yes": {"$sum": {"$cond": [{"$eq": ["$rehire_willingness", "Bəli"]}, 1, 0]}},
            "last_event_date": {"$max": "$event_date"},
        }},
        {"$project": {
            "_id": 0,
            "vendor_type": "$_id.vendor_type",
            "vendor_id": "$_id.vendor_id",
            "vendor_name": 1, "count": 1,
            "avg_price": {"$round": ["$avg_price", 2]},
            "avg_quality": {"$round": ["$avg_quality", 2]},
            "avg_operativity": {"$round": ["$avg_operativity", 2]},
            "avg_behavior": {"$round": ["$avg_behavior", 2]},
            "avg_flexibility": {"$round": ["$avg_flexibility", 2]},
            "avg_fit": {"$round": ["$avg_fit", 2]},
            "overall": {"$round": [{"$divide": [{"$add": ["$avg_price", "$avg_quality", "$avg_operativity", "$avg_behavior"]}, 4]}, 2]},
            "rehire_rate": {"$round": [{"$multiply": [{"$divide": ["$rehire_yes", "$count"]}, 100]}, 1]},
            "last_event_date": 1,
        }},
        {"$sort": {"overall": -1}}
    ]
    results = await db.org_ratings.aggregate(pipeline).to_list(5000)
    for r in results:
        ov = r.get("overall") or 0
        rr = r.get("rehire_rate") or 0
        if ov >= 4.2 and rr >= 75:
            r["recommendation"] = "Tövsiyə edilir"
        elif ov >= 3.0:
            r["recommendation"] = "Şərtlə tövsiyə"
        else:
            r["recommendation"] = "Tövsiyə edilmir"
    return results

# ===== DASHBOARD (DECLARE BEFORE /organization/{module}) =====

@api_router.get("/organization/dashboard/stats")
async def org_dashboard(current_user: dict = Depends(get_current_user)):
    counts = {}
    for mod, col in ORG_COLLECTIONS.items():
        counts[mod] = await db[col].count_documents({})
    total_ratings = await db.org_ratings.count_documents({})
    pipeline = [
        {"$group": {
            "_id": {"vendor_type": "$vendor_type", "vendor_id": "$vendor_id"},
            "vendor_name": {"$last": "$vendor_name"},
            "avg_price": {"$avg": "$price_score"},
            "avg_quality": {"$avg": "$quality_score"},
            "avg_operativity": {"$avg": "$operativity_score"},
            "avg_behavior": {"$avg": "$behavior_score"},
            "count": {"$sum": 1},
        }},
        {"$project": {
            "_id": 0,
            "vendor_type": "$_id.vendor_type",
            "vendor_id": "$_id.vendor_id",
            "vendor_name": 1,
            "count": 1,
            "overall": {"$round": [{"$divide": [{"$add": ["$avg_price", "$avg_quality", "$avg_operativity", "$avg_behavior"]}, 4]}, 2]},
        }},
        {"$sort": {"overall": -1}},
        {"$limit": 5}
    ]
    top_rated = await db.org_ratings.aggregate(pipeline).to_list(5)
    recent = []
    for mod, col in ORG_COLLECTIONS.items():
        items = await db[col].find({}, {"_id": 0, "id": 1, "created_at": 1, "name": 1, "vendor_name": 1, "venue_name": 1}).sort("created_at", -1).limit(3).to_list(3)
        for i in items:
            recent.append({
                "module": mod,
                "module_label": ORG_LABELS[mod],
                "id": i.get("id"),
                "name": i.get("name") or i.get("vendor_name") or i.get("venue_name") or "—",
                "created_at": i.get("created_at")
            })
    recent.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    recent = recent[:8]
    return {"counts": counts, "total_ratings": total_ratings, "top_rated": top_rated, "recent_additions": recent}

# ===== VENDOR CRUD (parameterized — declare LAST) =====

@api_router.get("/organization/{module}")
async def get_org_vendors(module: str, current_user: dict = Depends(get_current_user)):
    if module not in ORG_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Modul tapılmadı")
    items = await db[ORG_COLLECTIONS[module]].find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    # Attach rating aggregation
    vendor_ids = [i["id"] for i in items]
    ratings_pipeline = [
        {"$match": {"vendor_type": module, "vendor_id": {"$in": vendor_ids}}},
        {"$group": {
            "_id": "$vendor_id",
            "count": {"$sum": 1},
            "avg_price": {"$avg": "$price_score"},
            "avg_quality": {"$avg": "$quality_score"},
            "avg_operativity": {"$avg": "$operativity_score"},
            "avg_behavior": {"$avg": "$behavior_score"},
            "last_used": {"$max": "$event_date"},
        }}
    ]
    ratings = {r["_id"]: r async for r in db.org_ratings.aggregate(ratings_pipeline)}
    for i in items:
        r = ratings.get(i["id"])
        if r:
            overall = round((r["avg_price"] + r["avg_quality"] + r["avg_operativity"] + r["avg_behavior"]) / 4, 2)
            i["rating_count"] = r["count"]
            i["rating_avg"] = overall
            i["rating_last_used"] = r["last_used"]
        else:
            i["rating_count"] = 0
            i["rating_avg"] = None
            i["rating_last_used"] = None
    return items

@api_router.post("/organization/{module}")
async def create_org_vendor(module: str, data: dict, current_user: dict = Depends(check_permission("organization", "write"))):
    if module not in ORG_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Modul tapılmadı")
    doc = {**data}
    doc["id"] = str(uuid.uuid4())
    doc["module"] = module
    doc["created_by"] = current_user.get("name", "")
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db[ORG_COLLECTIONS[module]].insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/organization/{module}/{item_id}")
async def update_org_vendor(module: str, item_id: str, data: dict, current_user: dict = Depends(check_permission("organization", "write"))):
    if module not in ORG_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Modul tapılmadı")
    update = {k: v for k, v in data.items() if k not in ("id", "created_at", "created_by", "module")}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db[ORG_COLLECTIONS[module]].update_one({"id": item_id}, {"$set": update})
    doc = await db[ORG_COLLECTIONS[module]].find_one({"id": item_id}, {"_id": 0})
    return doc

@api_router.delete("/organization/{module}/{item_id}")
async def delete_org_vendor(module: str, item_id: str, current_user: dict = Depends(check_permission("organization", "write"))):
    if module not in ORG_COLLECTIONS:
        raise HTTPException(status_code=404, detail="Modul tapılmadı")
    await db[ORG_COLLECTIONS[module]].delete_one({"id": item_id})
    # Also cascade delete ratings for this vendor
    await db.org_ratings.delete_many({"vendor_type": module, "vendor_id": item_id})
    return {"message": "Silindi"}

# ==================== AI DATA ANALYST (GPT-5.2 via Emergent LLM Key) ====================

AI_SCHEMA = """
MongoDB database with these collections (all documents use `id` field, `_id` is excluded in responses):

1. companies — Marsol üzvü olan şirkətlər (active members)
   top-level fields: id, brand_name, legal_name, voen, sector, sub_sector, company_size,
   registration_date, address, region, status (Aktiv/Passiv/Ləğv edilib),
   company_phone, company_website, logo_url, social_links (array),
   owner_name (LEGACY, tez-tez boş), owner_first_name, owner_last_name, owner_phone, owner_email,
   representative_name, representative_phone, representative_email,
   contact_first_name, contact_last_name, contact_phone, contact_email, contact_position,
   marsol_representative, reference_source, reference_person_name, reference_person_surname,
   reference_person_position, reference_company_name, joined_project, join_date,
   package (Premium/Business/Business+/Sponsor),
   contract_start_date, contract_end_date, contract_file, contracts (array),
   total_amount, paid_amount, debt_amount, last_payment_date, payment_due_date,
   employee_count,
   children_count (LEGACY – tez-tez 0 və ya boş), children_info (LEGACY – demək olar ki, həmişə boş array),

   **owners** (ƏSAS MƏLUMAT BURDADIR) — array of owner objects, hər elementdə:
      first_name, last_name, father_name, position, phone, email, birth_date (YYYY-MM-DD),
      citizenship, education, specialty, university, social_links (array), desired_activities (array),
      **children** — array of child objects: { name, surname, birth_date (YYYY-MM-DD), gender ("Oğlan"/"Qız") }

   co_founders (tez-tez boş)

   **VACİB**: Sahibkar(lar)ın adı və uşaqları `owners` array-dadır, köhnə `owner_name`/`children_info` sahələrinə GÜVƏNMƏ.
   Sahibkar üçün adı göstərmək üçün: $concat: ["$owners.first_name", " ", "$owners.last_name"] ya da unwind sonrası. owners boş olsa fallback owner_name istifadə et.
   Doğum günü və yaş sorğuları üçün `owners.birth_date` istifadə et.
   Uşaqlar üçün sorğular `owners.children.birth_date` üzərindən gedir.

2. employees — Marsol daxili əməkdaşlar
   fields: id, full_name, first_name, last_name, birth_date, gender, department, position,
   company_phone, personal_phone, email, contract_start_date, contract_end_date, probation_end_date,
   gross_salary, net_salary, children_count, children_birth_dates (array of YYYY-MM-DD), status, marital_status, education_level

3. meetings — görüşlər
   fields: id, date, time, employee, meeting_setter, company, contact_person, project, meeting_type,
   location, result, next_meeting, department, meeting_mode, notes

4. tasks — tapşırıqlar
   fields: id, task_name, department, assignee, responsible_person, priority, start_date, end_date,
   related_object, phase, status, task_code (T-XXX)

5. project_events — Marsol-un təşkil etdiyi tədbirlər (Sərgi, Forum, İftar, Təlim, Tur, Networking, Konfrans)
   fields: id, name, type, date, end_date, location, status (Planlaşdırılır/Aktiv/Tamamlandı)

6. event_invitations — tədbirlərə dəvət olunan qonaqlar (non-members)
   fields: id, event_id, event_name, guest_name, guest_company, guest_position, guest_phone,
   guest_email, status (Dəvət edilib/Gələcəm/Gəlməyəcəm/İştirak etdi), invited_by, converted_to_lead

7. sales_leads — satış pipeline
   fields: id, lead_code, company_name, contact_name, contact_person, phone, email, position, source,
   sale_type, stage, status, assigned_to, curator, expected_amount, package, notes

8. contact_lists — sahibkar/CEO siyahıları
   fields: id, title, description, created_by

9. contacts — contact_lists-dəki kontaktlar
   fields: id, list_id, name, surname, company, position, phone, email

10. barters — barter əməliyyatları
    fields: id, barter_code (B-XXX), partner_name, partner_contact, partner_phone,
    our_service, their_service, our_value, their_value, status (Təklif/Müzakirədə/Aktiv/Tamamlandı/Ləğv edilib),
    start_date, end_date, responsible

11. incomes — gəlirlər (şirkət ödənişləri)
    fields: id, company_id, company_name, owner_name, project, package, amount, paid_amount,
    debt_amount, currency, contract_start_date, contract_end_date

12. expenses — xərclər
    fields: id, expense_name, category, sub_category, amount, currency, date, project, department,
    responsible_person, payment_type, status

13. attendance — əməkdaş davamiyyəti (günlük)
    fields: id, employee_id, employee_name, date (YYYY-MM-DD), status (İşdə/Gəlməyib/Məzuniyyət/Xəstəlik/İcazəli/Uzaq),
    check_in, check_out

14. leave_requests — məzuniyyət sorğuları
    fields: id, employee_id, employee_name, type (Məzuniyyət/Xəstəlik/İcazə/Digər),
    start_date, end_date, reason, status (Gözləyir/Təsdiqlənib/Rədd edilib)

15. users — sistem istifadəçiləri (auth)
    fields: id, name, email, role, department

16. assemblies — iclaslar
    fields: id, title, date, time, location, agenda (array), participants, status

17. invitations — KÖHNƏ sistem: üzv şirkətlərin fəaliyyətlərə dəvətləri (Obligations modulu üçün)
    fields: id, event_id, event_name, event_type, event_date, company_id, company_name,
    call_status, participation_status, obligation_deducted

18. events — Təşkilatçılıq modulu fəaliyyətləri
    fields: id, name, date, event_type, location

Dates are stored as ISO strings (YYYY-MM-DD) or ISO datetimes. Birth dates follow YYYY-MM-DD.
Current reference date: {today}
Age calculation: if someone should be older than N years, their birth_date should be BEFORE (currentYear - N)-01-01.
For "daha böyük/yuxarı yaş" use $lt (before threshold). For "kiçik yaş" use $gt (after threshold).
"""

AI_SYSTEM_PROMPT = """You are an AI data analyst for Marsol Group B2B networking ERP system.
You receive user questions in Azerbaijani about the data in their MongoDB database.

Your job: produce a single JSON response containing a MongoDB aggregation pipeline that answers the question.

Use ONLY these MongoDB operators in $match, $project, $group, $sort, $limit, $unwind, $addFields, $lookup, $count.
NEVER use: $out, $merge, $function, $where, $accumulator, $expr with $function, $redact.

Response format (strict JSON):
{
  "title": "Qısa Azərbaycanca başlıq (cədvəl başlığı)",
  "collection": "companies|employees|meetings|...",
  "pipeline": [ ...mongodb aggregation stages... ],
  "list_mapping": {
    "name": "<column header that contains person/contact name>",
    "company": "<column header with company name, or null>",
    "phone": "<column header with phone, or null>",
    "email": "<column header with email, or null>",
    "position": "<column header with position/title, or null>",
    "notes": "<column header with extra info, or null>"
  }
}

CRITICAL RULES:
- Final $project stage MUST produce dictionary with HUMAN-READABLE Azerbaijani field names as column headers
- Always add {"_id": 0} in $project (exclude _id)
- Order $project fields logically (name/company first, then details)
- Add $sort when meaningful
- Keep results reasonable (add $limit only if user asks for top-N)
- list_mapping maps logical fields (name/company/phone/email) to YOUR OUTPUT COLUMN HEADERS so the result can be saved into contact lists
- If the result is a statistical breakdown (not contact-style), set list_mapping fields to null

SCHEMA:
""" + AI_SCHEMA + """

Examples:

Q: "3 yaşdan yuxarı uşağı olan sahibkarlar" (today is 2026-02-19, so child born before 2023-02-19)
A: {
  "title": "3 yaşdan yuxarı uşağı olan sahibkarlar",
  "collection": "companies",
  "pipeline": [
    {"$match": {"owners.children.birth_date": {"$exists": true, "$ne": "", "$lt": "2023-02-19"}}},
    {"$unwind": {"path": "$owners", "preserveNullAndEmptyArrays": false}},
    {"$match": {"owners.children": {"$elemMatch": {"birth_date": {"$lt": "2023-02-19", "$ne": ""}}}}},
    {"$project": {
      "_id": 0,
      "Sahibkar": {"$trim": {"input": {"$concat": [{"$ifNull": ["$owners.first_name", ""]}, " ", {"$ifNull": ["$owners.last_name", ""]}]}}},
      "Şirkət": "$brand_name",
      "Telefon": {"$ifNull": ["$owners.phone", "$owner_phone"]},
      "Email": {"$ifNull": ["$owners.email", "$owner_email"]},
      "Uşaqlar": {
        "$reduce": {
          "input": {"$filter": {"input": "$owners.children", "as": "c", "cond": {"$and": [{"$ne": ["$$c.birth_date", ""]}, {"$lt": ["$$c.birth_date", "2023-02-19"]}]}}},
          "initialValue": "",
          "in": {"$concat": ["$$value", {"$cond": [{"$eq": ["$$value", ""]}, "", ", "]}, {"$ifNull": ["$$this.name", ""]}, " (", {"$ifNull": ["$$this.birth_date", ""]}, ")"]}
        }
      },
      "Paket": "$package"
    }},
    {"$sort": {"Sahibkar": 1}}
  ],
  "list_mapping": {"name": "Sahibkar", "company": "Şirkət", "phone": "Telefon", "email": "Email", "position": null, "notes": "Uşaqlar"}
}

Q: "iyun ayında doğum günü olan sahibkarlar"
A: {
  "title": "İyun ayında doğum günləri (sahibkarlar)",
  "collection": "companies",
  "pipeline": [
    {"$unwind": {"path": "$owners", "preserveNullAndEmptyArrays": false}},
    {"$match": {"owners.birth_date": {"$regex": "^\\\\d{4}-06-"}}},
    {"$project": {
      "_id": 0,
      "Sahibkar": {"$trim": {"input": {"$concat": [{"$ifNull": ["$owners.first_name", ""]}, " ", {"$ifNull": ["$owners.last_name", ""]}]}}},
      "Şirkət": "$brand_name",
      "Doğum tarixi": "$owners.birth_date",
      "Telefon": "$owners.phone",
      "Email": "$owners.email"
    }},
    {"$sort": {"Doğum tarixi": 1}}
  ],
  "list_mapping": {"name": "Sahibkar", "company": "Şirkət", "phone": "Telefon", "email": "Email", "position": null, "notes": "Doğum tarixi"}
}

Q: "hansı sektordan neçə şirkət var"
A: {
  "title": "Sektorlar üzrə şirkət sayı",
  "collection": "companies",
  "pipeline": [
    {"$match": {"status": "Aktiv"}},
    {"$group": {"_id": "$sector", "count": {"$sum": 1}}},
    {"$project": {"_id": 0, "Sektor": "$_id", "Şirkət sayı": "$count"}},
    {"$sort": {"Şirkət sayı": -1}}
  ],
  "list_mapping": {"name": null, "company": null, "phone": null, "email": null, "position": null, "notes": null}
}

Q: "neçə görüş etmişik, nəticələri necə olub"
A: {
  "title": "Görüşlər nəticə bölgüsü",
  "collection": "meetings",
  "pipeline": [
    {"$group": {"_id": "$result", "count": {"$sum": 1}}},
    {"$project": {"_id": 0, "Nəticə": "$_id", "Say": "$count"}},
    {"$sort": {"Say": -1}}
  ],
  "list_mapping": {"name": null, "company": null, "phone": null, "email": null, "position": null, "notes": null}
}

Q: "aktiv üzv şirkətlər ad və telefon ilə"
A: {
  "title": "Aktiv üzv şirkətlər",
  "collection": "companies",
  "pipeline": [
    {"$match": {"status": "Aktiv"}},
    {"$project": {
      "_id": 0,
      "Şirkət": "$brand_name",
      "Sahibkar": {"$cond": [
        {"$gt": [{"$size": {"$ifNull": ["$owners", []]}}, 0]},
        {"$trim": {"input": {"$concat": [{"$ifNull": [{"$arrayElemAt": ["$owners.first_name", 0]}, ""]}, " ", {"$ifNull": [{"$arrayElemAt": ["$owners.last_name", 0]}, ""]}]}}},
        "$owner_name"
      ]},
      "Telefon": {"$ifNull": [{"$arrayElemAt": ["$owners.phone", 0]}, "$owner_phone"]},
      "Email": {"$ifNull": [{"$arrayElemAt": ["$owners.email", 0]}, "$owner_email"]},
      "Paket": "$package"
    }},
    {"$sort": {"Şirkət": 1}}
  ],
  "list_mapping": {"name": "Sahibkar", "company": "Şirkət", "phone": "Telefon", "email": "Email", "position": null, "notes": "Paket"}
}

Return ONLY the JSON object, no markdown, no commentary.
"""

AI_ALLOWED_COLLECTIONS = {
    "companies", "employees", "meetings", "tasks", "project_events", "event_invitations",
    "sales_leads", "contact_lists", "contacts", "barters", "incomes", "expenses",
    "attendance", "leave_requests", "users", "assemblies", "invitations", "events", "roles"
}

AI_FORBIDDEN_OPERATORS = {"$out", "$merge", "$function", "$where", "$accumulator", "$redact"}

def _scan_forbidden_operators(obj) -> Optional[str]:
    """Recursively scan for forbidden MongoDB operators. Returns operator name if found."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(k, str) and k in AI_FORBIDDEN_OPERATORS:
                return k
            found = _scan_forbidden_operators(v)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _scan_forbidden_operators(item)
            if found:
                return found
    return None

@api_router.post("/ai/analyze")
async def ai_analyze(data: dict, current_user: dict = Depends(get_current_user)):
    """AI Data Analyst — takes Azerbaijani prompt, generates aggregation pipeline, executes, returns table."""
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt tələb olunur")
    if len(prompt) > 2000:
        raise HTTPException(status_code=400, detail="Prompt çox uzundur (max 2000 simvol)")

    emergent_key = os.environ.get("EMERGENT_LLM_KEY")
    if not emergent_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY mövcud deyil")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        raise HTTPException(status_code=500, detail="emergentintegrations kitabxanası yüklü deyil")

    import json as _json
    session_id = f"ai-analyst-{current_user.get('id', 'unknown')}-{uuid.uuid4().hex[:8]}"
    # Model is configurable via env; defaults to Claude Sonnet 4.5 (OpenAI GPT-5.2 experiencing timeouts)
    ai_provider = os.environ.get("AI_ANALYST_PROVIDER", "anthropic")
    ai_model = os.environ.get("AI_ANALYST_MODEL", "claude-sonnet-4-5-20250929")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    system_prompt = AI_SYSTEM_PROMPT.replace("{today}", today_str)
    chat = LlmChat(api_key=emergent_key, session_id=session_id, system_message=system_prompt).with_model(ai_provider, ai_model)

    try:
        ai_text = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI cavab vermədi: {str(e)[:200]}")

    # Parse AI response
    cleaned = (ai_text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    # Find first { and last }
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace == -1 or last_brace == -1:
        raise HTTPException(status_code=422, detail="AI cavabını parse etmək mümkün olmadı")
    try:
        plan = _json.loads(cleaned[first_brace:last_brace + 1])
    except _json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"AI JSON xətası: {str(e)[:100]}")

    collection = plan.get("collection", "")
    pipeline = plan.get("pipeline", [])
    title = plan.get("title", "Nəticə")
    list_mapping = plan.get("list_mapping") or {}

    if collection not in AI_ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=403, detail=f"Icazəsiz kolleksiya: {collection}")
    if not isinstance(pipeline, list) or len(pipeline) == 0 or len(pipeline) > 20:
        raise HTTPException(status_code=422, detail="Yanlış pipeline strukturu")

    forbidden = _scan_forbidden_operators(pipeline)
    if forbidden:
        raise HTTPException(status_code=403, detail=f"Qadağan edilmiş operator: {forbidden}")

    # Validate $lookup only targets allowed collections
    for stage in pipeline:
        if isinstance(stage, dict) and "$lookup" in stage:
            lookup = stage["$lookup"]
            if isinstance(lookup, dict):
                from_col = lookup.get("from", "")
                if from_col not in AI_ALLOWED_COLLECTIONS:
                    raise HTTPException(status_code=403, detail=f"$lookup qadağan: {from_col}")

    # Execute pipeline
    try:
        docs = await db[collection].aggregate(pipeline).to_list(10000)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline icra xətası: {str(e)[:200]}")

    # Sanitize: remove any stray _id
    for d in docs:
        d.pop("_id", None)

    # Extract headers (preserve order from first doc if possible)
    headers = []
    if docs:
        headers = list(docs[0].keys())
    # Convert rows to arrays following header order
    rows = [[d.get(h, "") for h in headers] for d in docs]

    return {
        "title": title,
        "headers": headers,
        "rows": rows,
        "row_count": len(rows),
        "collection": collection,
        "list_mapping": list_mapping,
        "prompt": prompt
    }

@api_router.post("/ai/save-to-list")
async def ai_save_to_list(data: dict, current_user: dict = Depends(check_permission("sales", "write"))):
    """Save AI analysis result rows to a contact list."""
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    headers = data.get("headers") or []
    rows = data.get("rows") or []
    mapping = data.get("mapping") or {}

    if not title:
        raise HTTPException(status_code=400, detail="Siyahı başlığı tələb olunur")
    if not headers or not rows:
        raise HTTPException(status_code=400, detail="Məlumat yoxdur")

    # Create list
    list_doc = {
        "id": str(uuid.uuid4()),
        "title": title,
        "description": description or f"AI tərəfindən yaradıldı",
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.contact_lists.insert_one(list_doc)
    list_doc.pop("_id", None)

    # Column indices by header name
    def col_idx(header_name):
        if not header_name:
            return -1
        try:
            return headers.index(header_name)
        except ValueError:
            return -1

    idx_name = col_idx(mapping.get("name"))
    idx_company = col_idx(mapping.get("company"))
    idx_phone = col_idx(mapping.get("phone"))
    idx_email = col_idx(mapping.get("email"))
    idx_position = col_idx(mapping.get("position"))
    idx_notes = col_idx(mapping.get("notes"))

    def safe_get(row, i):
        if i < 0 or i >= len(row):
            return ""
        v = row[i]
        return str(v) if v is not None else ""

    contact_docs = []
    for row in rows:
        full_name = safe_get(row, idx_name)
        parts = full_name.split(" ", 1) if full_name else ["", ""]
        first = parts[0] if parts else ""
        last = parts[1] if len(parts) > 1 else ""
        contact_docs.append({
            "id": str(uuid.uuid4()),
            "list_id": list_doc["id"],
            "name": first,
            "surname": last,
            "company": safe_get(row, idx_company),
            "position": safe_get(row, idx_position),
            "phone": safe_get(row, idx_phone),
            "email": safe_get(row, idx_email),
            "notes": safe_get(row, idx_notes),
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    if contact_docs:
        await db.contacts.insert_many(contact_docs)

    return {"message": f"{len(contact_docs)} kontakt əlavə edildi", "list_id": list_doc["id"], "list_title": list_doc["title"]}

@api_router.get("/ai/examples")
async def ai_examples(current_user: dict = Depends(get_current_user)):
    """Return example prompts for the AI Data Analyst UI."""
    return {"examples": [
        "5 yaş üzəri uşağı olan sahibkarların siyahısı",
        "İyun ayında doğum günü olan sahibkarlar",
        "Hansı sektordan neçə şirkət var",
        "Aktiv üzvlər (paket və müqavilə bitmə tarixi ilə)",
        "Bu ay keçirilmiş görüşlərin say və nəticələri",
        "Bitməkdə olan müqavilələr (30 gün içində)",
        "Borcu olan şirkətlər (borc məbləğinə görə sıralanmış)",
        "Tamamlanmamış tapşırıqlar",
        "Bu ay davamiyyət statistikası",
        "Aktiv barter əməliyyatları və balans",
        "İyul ayında doğum günü olan əməkdaşlar",
        "Hər paket üzrə üzv şirkət sayı",
        "Bakıda olan premium üzvlər",
    ]}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
