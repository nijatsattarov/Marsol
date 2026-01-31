from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
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
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

security = HTTPBearer()

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class DashboardStats(BaseModel):
    events: dict
    members: dict
    sectors: dict
    payments: dict
    financials: dict

# Member Models
class MemberCreate(BaseModel):
    company_name: str
    sector: str
    package: str
    curator: str
    business_size: str  # Böyük, Orta, Kiçik
    director_name: str
    director_phone: str
    contact_person: str
    contact_phone: str
    company_email: str
    projects: List[str] = []

class MemberUpdate(BaseModel):
    company_name: Optional[str] = None
    sector: Optional[str] = None
    package: Optional[str] = None
    curator: Optional[str] = None
    business_size: Optional[str] = None
    director_name: Optional[str] = None
    director_phone: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    company_email: Optional[str] = None
    projects: Optional[List[str]] = None

class Member(BaseModel):
    id: str
    company_name: str
    sector: str
    package: str
    curator: str
    business_size: str
    director_name: str
    director_phone: str
    contact_person: str
    contact_phone: str
    company_email: str
    projects: List[str]
    created_at: str

# Auth functions
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

# Auth Routes
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

# Dashboard Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Events statistics
    events = {
        "total": 45,
        "breakdown": [
            {"name": "İşgüzar səhər yeməyi", "count": 12, "color": "#3D4F6F"},
            {"name": "Ofis-istehsalat ziyarəti", "count": 8, "color": "#9ACD32"},
            {"name": "Daxili səfər", "count": 6, "color": "#64748B"},
            {"name": "Sosial fəaliyyət", "count": 10, "color": "#94A3B8"},
            {"name": "Xarici səfər", "count": 4, "color": "#CBD5E1"},
            {"name": "Dövlət qurumu ilə görüş", "count": 5, "color": "#2A364C"}
        ]
    }
    
    # Members statistics
    members = {
        "total": 156,
        "breakdown": [
            {"name": "Premium paket", "count": 32, "color": "#3D4F6F"},
            {"name": "Business paket", "count": 78, "color": "#9ACD32"},
            {"name": "Business Plus paket", "count": 46, "color": "#64748B"}
        ]
    }
    
    # Sectors statistics
    sectors = {
        "total": 8,
        "breakdown": [
            {"name": "İnşaat", "count": 24, "color": "#3D4F6F"},
            {"name": "Təhsil", "count": 18, "color": "#9ACD32"},
            {"name": "Qida", "count": 22, "color": "#64748B"},
            {"name": "İKT", "count": 35, "color": "#94A3B8"},
            {"name": "Logistika", "count": 28, "color": "#CBD5E1"},
            {"name": "Maliyyə", "count": 15, "color": "#2A364C"},
            {"name": "Səhiyyə", "count": 8, "color": "#475569"},
            {"name": "Digər", "count": 6, "color": "#334155"}
        ]
    }
    
    # Payment statistics
    payments = {
        "total": 245000,
        "paid": 198000,
        "remaining": 47000,
        "currency": "AZN"
    }
    
    # Financial statistics (monthly)
    financials = {
        "income": 320000,
        "expenses": 185000,
        "profit": 135000,
        "currency": "AZN",
        "monthly": [
            {"month": "Yan", "income": 25000, "expenses": 15000},
            {"month": "Fev", "income": 28000, "expenses": 16000},
            {"month": "Mar", "income": 32000, "expenses": 18000},
            {"month": "Apr", "income": 27000, "expenses": 14000},
            {"month": "May", "income": 35000, "expenses": 20000},
            {"month": "İyn", "income": 30000, "expenses": 17000},
            {"month": "İyl", "income": 29000, "expenses": 15000},
            {"month": "Avq", "income": 26000, "expenses": 14000},
            {"month": "Sen", "income": 31000, "expenses": 18000},
            {"month": "Okt", "income": 28000, "expenses": 16000},
            {"month": "Noy", "income": 15000, "expenses": 12000},
            {"month": "Dek", "income": 14000, "expenses": 10000}
        ]
    }
    
    return {
        "events": events,
        "members": members,
        "sectors": sectors,
        "payments": payments,
        "financials": financials
    }

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Marsol Group Management System API"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
