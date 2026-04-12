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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'marsol-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Static files for uploads
UPLOAD_DIR = Path("/app/backend/uploads")
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
    status: Optional[str] = "Ödənilib"

# Task Model
class TaskCreate(BaseModel):
    task_name: str
    department: Optional[str] = ""
    assignee: str
    responsible_person: str
    priority: str  # Yüksək, Orta, Aşağı
    start_date: str
    end_date: str
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
ROLE_PERMISSIONS = {
    "admin": ["*"],
    "manager": ["read", "write", "delete_own"],
    "user": ["read", "write_own"],
    "viewer": ["read"]
}

def require_role(*allowed_roles):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role", "viewer")
        if user_role not in allowed_roles and "admin" not in [user_role]:
            raise HTTPException(status_code=403, detail="Bu əməliyyat üçün icazəniz yoxdur")
        return current_user
    return role_checker

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
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}
    )

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
    
    companies = await db.companies.find(query, {"_id": 0}).to_list(1000)
    return companies

@api_router.post("/companies")
async def create_company(company_data: dict, current_user: dict = Depends(get_current_user)):
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
async def update_company(company_id: str, company_data: dict, current_user: dict = Depends(get_current_user)):
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
async def update_company_finance(company_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {}
    for key in ["finance_note", "paid_amount", "total_amount", "last_payment_date"]:
        if key in data:
            update_data[key] = data[key]
    
    if "total_amount" in update_data or "paid_amount" in update_data:
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        if not company:
            raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
        total = update_data.get("total_amount", company.get("total_amount", 0))
        paid = update_data.get("paid_amount", company.get("paid_amount", 0))
        update_data["debt_amount"] = total - paid
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Yenilənəcək məlumat yoxdur")
    
    result = await db.companies.update_one({"id": company_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return company

@api_router.delete("/companies/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
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
async def create_employee(employee_data: dict, current_user: dict = Depends(get_current_user)):
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
async def update_employee(employee_id: str, employee_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in employee_data.items() if v is not None}
    result = await db.employees.update_one({"id": employee_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Əməkdaş tapılmadı")
    employee = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    return employee

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Əməkdaş tapılmadı")
    return {"message": "Əməkdaş silindi"}

# ==================== FINANCE (MALİYYƏ) ====================

@api_router.get("/finance/incomes")
async def get_incomes(current_user: dict = Depends(get_current_user)):
    incomes = await db.incomes.find({}, {"_id": 0}).to_list(1000)
    return incomes

@api_router.post("/finance/incomes")
async def create_income(income_data: IncomeCreate, current_user: dict = Depends(get_current_user)):
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
async def update_income(income_id: str, income_data: dict, current_user: dict = Depends(get_current_user)):
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
async def delete_income(income_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.incomes.delete_one({"id": income_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gəlir tapılmadı")
    return {"message": "Gəlir silindi"}

@api_router.get("/finance/expenses")
async def get_expenses(current_user: dict = Depends(get_current_user)):
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
    return expenses

@api_router.post("/finance/expenses")
async def create_expense(expense_data: ExpenseCreate, current_user: dict = Depends(get_current_user)):
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
async def update_expense(expense_id: str, expense_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in expense_data.items() if v is not None}
    result = await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Xərc tapılmadı")
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    return expense

@api_router.delete("/finance/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Xərc tapılmadı")
    return {"message": "Xərc silindi"}

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
        query["assignee"] = assignee
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)
    return tasks

@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, current_user: dict = Depends(get_current_user)):
    task_id = str(uuid.uuid4())
    task_doc = {
        "id": task_id,
        **task_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(task_doc)
    task_doc.pop("_id", None)
    return task_doc

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task_data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in task_data.items() if v is not None}
    result = await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tapşırıq tapılmadı")
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
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
    
    meetings = await db.meetings.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return meetings

@api_router.post("/meetings")
async def create_meeting(data: dict, current_user: dict = Depends(get_current_user)):
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
    return meeting_doc

@api_router.put("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, data: dict, current_user: dict = Depends(get_current_user)):
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
async def delete_meeting(meeting_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.meetings.delete_one({"id": meeting_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Görüş tapılmadı")
    await db.notifications.delete_many({"meeting_id": meeting_id, "type": "reminder"})
    return {"message": "Görüş silindi"}

# ==================== ASSEMBLIES (İCLAS) ====================

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
    if date_from:
        query.setdefault("deadline", {})["$gte"] = date_from
    if date_to:
        query.setdefault("deadline", {})["$lte"] = date_to
    assemblies = await db.assemblies.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return assemblies

@api_router.post("/assemblies")
async def create_assembly(data: dict, current_user: dict = Depends(get_current_user)):
    count = await db.assemblies.count_documents({})
    assembly_id = f"IC-{str(count + 1).zfill(3)}"
    doc = {
        "id": str(uuid.uuid4()),
        "assembly_code": assembly_id,
        "department": data.get("department", ""),
        "purpose": data.get("purpose", ""),
        "agendas": data.get("agendas", []),
        "discussion_topics": data.get("discussion_topics", []),
        "tasks": data.get("tasks", []),
        "responsible_persons": data.get("responsible_persons", []),
        "deadline": data.get("deadline", ""),
        "next_assembly_date": data.get("next_assembly_date", ""),
        "decisions": data.get("decisions", []),
        "created_by": current_user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assemblies.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/assemblies/{assembly_id}")
async def update_assembly(assembly_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.items() if k not in ("id", "assembly_code")}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.assemblies.update_one({"id": assembly_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="İclas tapılmadı")
    doc = await db.assemblies.find_one({"id": assembly_id}, {"_id": 0})
    return doc

@api_router.delete("/assemblies/{assembly_id}")
async def delete_assembly(assembly_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.assemblies.delete_one({"id": assembly_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="İclas tapılmadı")
    return {"message": "İclas silindi"}


# ==================== OPTIONS ====================

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
async def update_setting_list(key: str, data: dict, current_user: dict = Depends(get_current_user)):
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

async def _get_company_obligation(company: dict) -> dict:
    package = company.get("package", "")
    quotas = await get_package_quotas()
    total_quota = quotas.get(package, 0)
    company_id = company.get("id", "")
    start_date = company.get("contract_start_date", "")
    end_date = company.get("contract_end_date", "")
    now = datetime.now(timezone.utc)
    days_remaining = 365
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            days_remaining = max((end_dt - now.replace(tzinfo=None)).days, 0)
        except (ValueError, TypeError):
            pass
    used_quota = await db.invitations.count_documents({
        "company_id": company_id,
        "obligation_deducted": True
    })
    remaining = max(total_quota - used_quota, 0)
    priority_score = 0
    if days_remaining > 0 and remaining > 0:
        priority_score = remaining * (365 / max(days_remaining, 1))
    elif days_remaining == 0 and remaining > 0:
        priority_score = remaining * 1000
    total_invited = await db.invitations.count_documents({"company_id": company_id})
    total_attended = await db.invitations.count_documents({"company_id": company_id, "participation_status": "Qatılır"})
    total_declined = await db.invitations.count_documents({"company_id": company_id, "participation_status": "Qatılmır"})
    total_no_answer = await db.invitations.count_documents({"company_id": company_id, "call_status": "Cavab vermədi"})
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

@api_router.get("/obligations/dashboard")
async def get_obligations_dashboard(current_user: dict = Depends(get_current_user)):
    companies = await db.companies.find({"status": "Aktiv"}, {"_id": 0}).to_list(2000)
    obligations = []
    for c in companies:
        obl = await _get_company_obligation(c)
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
async def get_company_obligation(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Şirkət tapılmadı")
    obl = await _get_company_obligation(company)
    invitations = await db.invitations.find({"company_id": company_id}, {"_id": 0}).sort("event_date", -1).to_list(500)
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
        try:
            end_date = datetime.strptime(c["contract_end_date"], "%Y-%m-%d")
            diff = (end_date - now.replace(tzinfo=None)).days
            if diff < 0:
                notifications.append({
                    "id": f"contract-expired-{c['id']}",
                    "type": "contract_expired",
                    "severity": "high",
                    "title": f"Müqavilə bitib: {c['brand_name']}",
                    "message": f"Müqavilə {abs(diff)} gün əvvəl bitib ({c['contract_end_date']})",
                    "company_id": c["id"],
                    "date": today
                })
            elif diff <= 30:
                notifications.append({
                    "id": f"contract-expiring-{c['id']}",
                    "type": "contract_expiring",
                    "severity": "medium",
                    "title": f"Müqavilə bitir: {c['brand_name']}",
                    "message": f"{diff} gün sonra bitəcək ({c['contract_end_date']})",
                    "company_id": c["id"],
                    "date": today
                })
        except (ValueError, TypeError):
            pass

    # 3. Meeting reminders (görüş xatırlatmaları)
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

    # Sort by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    notifications.sort(key=lambda x: severity_order.get(x["severity"], 3))
    
    return {"notifications": notifications, "count": len(notifications), "high_count": sum(1 for n in notifications if n["severity"] == "high")}

# Root
@api_router.get("/")
async def root():
    return {"message": "Marsol Group Management System API"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
