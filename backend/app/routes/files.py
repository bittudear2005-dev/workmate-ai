import os
import uuid
import shutil
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.routes.auth import get_current_user
from app.models.orm_models import User, FileModel
from app.config import settings

router = APIRouter()

UPLOAD_DIR = (
    os.path.join("/tmp", "workmate", "uploads")
    if os.environ.get("VERCEL")
    else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def format_file_size(size_in_bytes: int) -> str:
    if size_in_bytes < 1024:
        return f"{size_in_bytes} B"
    elif size_in_bytes < 1024 * 1024:
        return f"{(size_in_bytes / 1024):.1f} KB"
    else:
        return f"{(size_in_bytes / (1024 * 1024)):.2f} MB"


def detect_file_type(filename: str, content_type: Optional[str] = None) -> str:
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    if ext in ("pdf",):
        return "pdf"
    if ext in ("jpg", "jpeg", "png", "gif", "webp", "svg"):
        return "image"
    if ext in ("mp4", "webm", "avi", "mov", "mkv"):
        return "video"
    if ext in ("mp3", "wav", "ogg", "flac"):
        return "audio"
    if ext in ("doc", "docx", "txt", "md", "rtf"):
        return "doc"
    if ext in ("xls", "xlsx", "csv"):
        return "spreadsheet"
    return "file"


def format_file(f: FileModel):
    return {
        "id": str(f.id),
        "name": f.original_filename or f.filename,
        "filename": f.filename,
        "original_filename": f.original_filename,
        "type": f.file_type or "file",
        "size": format_file_size(f.file_size or 0),
        "file_size": f.file_size or 0,
        "category": f.category or "Documents",
        "mime_type": f.mime_type,
        "uploadedAt": f.created_at.strftime("%Y-%m-%d") if f.created_at else datetime.now().strftime("%Y-%m-%d"),
        "created_at": f.created_at.isoformat() if f.created_at else None
    }


@router.get("")
@router.get("/")
async def get_files(
    category: Optional[str] = None,
    file_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(FileModel).filter(FileModel.user_id == current_user.id)
    if category:
        query = query.filter(FileModel.category == category)
    if file_type:
        query = query.filter(FileModel.file_type == file_type)
    if search:
        query = query.filter(FileModel.original_filename.ilike(f"%{search}%"))
    
    files = query.order_by(FileModel.created_at.desc()).all()
    return [format_file(f) for f in files]


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    category: Optional[str] = "Documents",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        user_upload_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
        os.makedirs(user_upload_dir, exist_ok=True)
        
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        saved_path = os.path.join(user_upload_dir, unique_filename)
        
        # Write to disk
        file_size = 0
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            file_size = os.path.getsize(saved_path)
        
        file_type = detect_file_type(file.filename, file.content_type)
        
        db_file = FileModel(
            user_id=current_user.id,
            filename=unique_filename,
            original_filename=file.filename,
            file_path=saved_path,
            file_type=file_type,
            file_size=file_size,
            category=category or "Documents",
            mime_type=file.content_type
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        return format_file(db_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.user_id == current_user.id
    ).first()
    
    if not db_file or not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=db_file.file_path,
        filename=db_file.original_filename or db_file.filename,
        media_type=db_file.mime_type or "application/octet-stream"
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.user_id == current_user.id
    ).first()
    
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Try deleting the file from disk if it exists
    if os.path.exists(db_file.file_path):
        try:
            os.remove(db_file.file_path)
        except Exception:
            pass
    
    db.delete(db_file)
    db.commit()
    return {"message": "File deleted successfully"}
