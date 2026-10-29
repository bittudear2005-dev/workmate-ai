from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List
import os
import json


def serverless_sqlite_url(async_driver: bool = False) -> str:
    driver = "sqlite+aiosqlite" if async_driver else "sqlite"
    if os.getenv("VERCEL"):
        return f"{driver}:////tmp/workmate.db"
    return f"{driver}:///./workmate.db"


class Settings(BaseSettings):
    # App Configuration
    APP_NAME: str = Field(default="Cosmic Assistant", alias="app_name")
    DEBUG: bool = Field(default=True, alias="debug")
    ENVIRONMENT: str = Field(default="development", alias="environment")
    API_VERSION: str = Field(default="v1")
    
    # PostgreSQL Database Configuration
    DATABASE_URL: str = Field(
        default_factory=lambda: serverless_sqlite_url(),
        alias="database_url"
    )
    ASYNC_DATABASE_URL: str = Field(
        default_factory=lambda: serverless_sqlite_url(async_driver=True),
        alias="async_database_url"
    )
    
    # Database Pool Settings
    DB_POOL_SIZE: int = Field(default=5)
    DB_MAX_OVERFLOW: int = Field(default=10)
    DB_ECHO: bool = Field(default=False)
    
    # JWT Configuration
    SECRET_KEY: str = Field(
        default="your-super-secret-jwt-key-change-this-in-production-min-32-chars"
    )
    ALGORITHM: str = Field(default="HS256", alias="algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30)
    
    # AI API Keys
    GROQ_API_KEY: str = Field(default="", alias="groq_api_key")
    GEMINI_API_KEY: str = Field(default="", alias="gemini_api_key")
    OPENAI_API_KEY: str = Field(default="", alias="openai_api_key")
    
    # AI Models Configuration
    GROQ_MODEL: str = Field(default="llama-3.3-70b-versatile", alias="groq_model")
    GEMINI_MODEL: str = Field(default="gemini-2.0-flash-exp", alias="gemini_model")
    OPENAI_MODEL: str = Field(default="gpt-4o-mini", alias="openai_model")

    # AI Generation Parameters
    AI_TEMPERATURE: float = Field(default=0.7)
    AI_MAX_TOKENS: int = Field(default=2048)
    AI_TOP_P: float = Field(default=0.9)
    
    # File Upload Configuration
    MAX_UPLOAD_SIZE: int = Field(default=10485760, alias="max_upload_size")
    ALLOWED_FILE_TYPES: str = Field(
        default="pdf,png,jpg,jpeg,txt,doc,docx,xls,xlsx,csv,md",
        alias="allowed_file_types"
    )
    UPLOAD_DIR: str = Field(default="uploads")
    
    # Redis Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379", alias="redis_url")
    CACHE_ENABLED: bool = Field(default=False)
    CACHE_TTL: int = Field(default=3600)
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = Field(default=True)
    RATE_LIMIT_REQUESTS: int = Field(default=100)
    RATE_LIMIT_WINDOW: int = Field(default=60)
    
    # CORS Origins - âœ… Updated to parse from .env
    CORS_ORIGINS: List[str] = Field(default=["*"])
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            try:
                # Try to parse as JSON
                return json.loads(v)
            except json.JSONDecodeError:
                # If not JSON, split by comma
                return [origin.strip() for origin in v.split(',')]
        return v
    
    # AI Features Flags
    ENABLE_GROQ: bool = Field(default=True)
    ENABLE_GEMINI: bool = Field(default=True)
    ENABLE_OPENAI: bool = Field(default=False)
    
    # Advanced AI Features
    ENABLE_IMAGE_ANALYSIS: bool = Field(default=True)
    ENABLE_DOCUMENT_ANALYSIS: bool = Field(default=True)
    ENABLE_CODE_GENERATION: bool = Field(default=True)
    ENABLE_VOICE_TRANSCRIPTION: bool = Field(default=False)
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


# Create settings instance
settings = Settings()
