import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import serverless_sqlite_url, settings

# Create base class for models
Base = declarative_base()


def get_engine():
    """
    Creates the SQLAlchemy engine.
    If PostgreSQL is configured but unavailable, falls back gracefully to SQLite.
    """
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite"):
        return create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            echo=settings.DB_ECHO
        )
    
    try:
        eng = create_engine(
            db_url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            echo=settings.DB_ECHO,
            pool_pre_ping=True,
        )
        # Test connection with a short timeout
        with eng.connect() as conn:
            pass
        print(f"Connected to PostgreSQL database ({db_url})")
        return eng
    except Exception as e:
        print(f"Could not connect to PostgreSQL ({db_url}): {e}")
        print("Falling back to local SQLite database: cosmic_assistant.db")
        fallback_url = serverless_sqlite_url()
        return create_engine(
            fallback_url,
            connect_args={"check_same_thread": False},
            echo=settings.DB_ECHO
        )


# Initialize engine and session maker
engine = get_engine()
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db():
    """
    Dependency function to get database session.
    Use this in FastAPI route functions.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """
    Create all database tables defined in models.
    Called on application startup.
    """
    import app.models.orm_models  # Ensure models are registered with Base
    Base.metadata.create_all(bind=engine)
    print("All database tables created/verified successfully")


def drop_tables():
    """
    Drop all database tables (development use only).
    """
    import app.models.orm_models
    Base.metadata.drop_all(bind=engine)
    print("All database tables dropped")