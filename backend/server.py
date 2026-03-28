from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
    location: Optional[str] = ""
    result: Optional[str] = ""
    next_meeting: Optional[str] = ""
    notes: Optional[str] = ""

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
async def create_company(company_data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    company_id = str(uuid.uuid4())
    company_doc = {
        "id": company_id,
        **company_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Calculate debt
    company_doc["debt_amount"] = company_doc["total_amount"] - company_doc["paid_amount"]
    
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
async def update_company(company_id: str, company_data: CompanyUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in company_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Yenilənəcək məlumat yoxdur")
    
    # Recalculate debt if amounts changed
    if "total_amount" in update_data or "paid_amount" in update_data:
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        total = update_data.get("total_amount", company.get("total_amount", 0))
        paid = update_data.get("paid_amount", company.get("paid_amount", 0))
        update_data["debt_amount"] = total - paid
    
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
async def create_employee(employee_data: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    employee_id = str(uuid.uuid4())
    employee_doc = {
        "id": employee_id,
        **employee_data.model_dump(),
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
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if meeting_type and meeting_type != "all":
        query["meeting_type"] = meeting_type
    
    meetings = await db.meetings.find(query, {"_id": 0}).to_list(1000)
    return meetings

@api_router.post("/meetings")
async def create_meeting(meeting_data: MeetingCreate, current_user: dict = Depends(get_current_user)):
    meeting_id = str(uuid.uuid4())
    meeting_doc = {
        "id": meeting_id,
        **meeting_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.meetings.insert_one(meeting_doc)
    meeting_doc.pop("_id", None)
    return meeting_doc

@api_router.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.meetings.delete_one({"id": meeting_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Görüş tapılmadı")
    return {"message": "Görüş silindi"}

# ==================== OPTIONS ====================

@api_router.get("/options/all")
async def get_all_options(current_user: dict = Depends(get_current_user)):
    # Get dynamic packages and projects from database
    packages_db = await db.packages.find({}, {"_id": 0}).to_list(100)
    projects_db = await db.projects.find({}, {"_id": 0}).to_list(100)
    
    # Use database values if exist, otherwise use defaults
    packages = [p["name"] for p in packages_db] if packages_db else ["Premium", "Business", "Business Plus"]
    projects = [p["name"] for p in projects_db] if projects_db else ["Üzvlük", "Sərgi", "Təlim/Proqram", "ICMA", "Sosial layihə"]
    
    return {
        "sectors": ["İnşaat", "Təhsil", "Qida", "İKT", "Logistika", "Maliyyə", "Səhiyyə", "Turizm", "Kənd təsərrüfatı", "İstehsalat", "Pərakəndə satış", "Xidmət", "Digər"],
        "packages": packages,
        "company_sizes": ["Böyük", "Orta", "Kiçik", "Mikro"],
        "marsol_representatives": ["Əli Məmmədov", "Aynur Həsənova", "Rəşad Quliyev", "Leyla Əliyeva", "Tural Babayev"],
        "projects": projects,
        "departments": ["Satış", "Marketing", "HR", "Maliyyə", "Layihə", "İT", "İdarəetmə"],
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
        "reference_sources": ["Media", "Partnyor", "Referans", "Digər"],
        "statuses": ["Aktiv", "Qeyri-aktiv", "Gözləmədə"]
    }

# Get companies for select dropdown (simplified)
@api_router.get("/options/companies")
async def get_companies_for_select(current_user: dict = Depends(get_current_user)):
    companies = await db.companies.find({}, {"_id": 0, "id": 1, "brand_name": 1, "owner_name": 1, "package": 1, "joined_project": 1}).to_list(1000)
    return companies

# ==================== PACKAGES MANAGEMENT ====================

@api_router.get("/settings/packages")
async def get_packages(current_user: dict = Depends(get_current_user)):
    packages = await db.packages.find({}, {"_id": 0}).to_list(100)
    if not packages:
        # Return default packages
        return [
            {"id": "1", "name": "Premium", "description": "Premium üzvlük paketi", "price": 5000},
            {"id": "2", "name": "Business", "description": "Business üzvlük paketi", "price": 3000},
            {"id": "3", "name": "Business Plus", "description": "Business Plus üzvlük paketi", "price": 4000}
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
