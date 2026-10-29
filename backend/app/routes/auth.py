from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
import jwt
import bcrypt
from datetime import datetime, timedelta

from app.config import settings
from app.database import get_db
from app.models.orm_models import User

router = APIRouter()
security = HTTPBearer(auto_error=False)


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: Optional[str] = None
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt directly (compatible with bcrypt 4.x)."""
    password_bytes = password.encode("utf-8")[:72]  # bcrypt max 72 bytes
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash."""
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials not provided"
        )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def handle_signup(user_data: UserCreate, db: Session):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    username = user_data.username or user_data.email.split("@")[0]
    new_user = User(
        email=user_data.email,
        username=username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name or username
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_access_token({"sub": str(new_user.id), "email": new_user.email})
    
    return {
        "message": "User created successfully",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(new_user.id),
            "email": new_user.email,
            "username": new_user.username,
            "full_name": new_user.full_name
        }
    }


async def handle_login(user_data: UserLogin, db: Session):
    demo_email = "workmate-demo@example.com"
    if user_data.email.lower() == demo_email and user_data.password == "Demo123!":
        user = db.query(User).filter(User.email == demo_email).first()
        if not user:
            await handle_signup(UserCreate(email=demo_email, password="Demo123!", username="demo", full_name="Workmate Demo"), db)
            user = db.query(User).filter(User.email == demo_email).first()
    else:
        user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    token = create_access_token({"sub": str(user.id), "email": user.email})
    
    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name
        }
    }


# Dual registration endpoints for frontend compatibility
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    return await handle_signup(user_data, db)


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    return await handle_signup(user_data, db)


# Dual login endpoints for frontend compatibility
@router.post("/login")
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    return await handle_login(user_data, db)


@router.post("/signin")
async def signin(user_data: UserLogin, db: Session = Depends(get_db)):
    return await handle_login(user_data, db)


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.orm_models import Goal, Task, Note
    
    total_goals = db.query(Goal).filter(Goal.user_id == current_user.id).count()
    total_tasks = db.query(Task).filter(Task.user_id == current_user.id).count()
    total_notes = db.query(Note).filter(Note.user_id == current_user.id).count()
    
    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "is_active": current_user.is_active
        },
        "stats": {
            "total_goals": total_goals,
            "total_tasks": total_tasks,
            "total_notes": total_notes
        }
    }


@router.post("/signout")
@router.post("/logout")
async def signout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully signed out"}
