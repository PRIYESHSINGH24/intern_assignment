"""
Case Management API Router
Handles CRUD operations for cases and document upload/processing.
"""

import os
import uuid
import shutil
import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from threading import Thread

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db, SessionLocal
from app.models import Case, Document, ProcessingLog, CaseSummary
from app.schemas import (
    CaseCreate, CaseUpdate, CaseResponse, CaseListResponse,
    UploadResponse, ProcessingStatusResponse, ProcessingLogResponse
)
from app.config import settings
from app.services.pipeline import pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cases", tags=["Cases"])


@router.post("/", response_model=CaseResponse, status_code=201)
def create_case(case_data: CaseCreate, db: Session = Depends(get_db)):
    """Create a new case."""
    case = Case(
        name=case_data.name,
        description=case_data.description,
        priority=case_data.priority or "normal"
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    logger.info(f"Created case: {case.name} (ID: {case.id})")
    return case


@router.get("/", response_model=CaseListResponse)
def list_cases(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List all cases with optional filtering."""
    query = db.query(Case)

    if status:
        query = query.filter(Case.status == status)
    if search:
        query = query.filter(Case.name.ilike(f"%{search}%"))

    total = query.count()
    cases = query.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()

    return CaseListResponse(cases=cases, total=total)


@router.get("/{case_id}", response_model=CaseResponse)
def get_case(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get case details."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.put("/{case_id}", response_model=CaseResponse)
def update_case(case_id: uuid.UUID, case_data: CaseUpdate, db: Session = Depends(get_db)):
    """Update case details."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if case_data.name is not None:
        case.name = case_data.name
    if case_data.description is not None:
        case.description = case_data.description
    if case_data.priority is not None:
        case.priority = case_data.priority

    db.commit()
    db.refresh(case)
    return case


@router.delete("/{case_id}")
def delete_case(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Delete a case and all associated documents."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Delete uploaded files
    case_dir = os.path.join(settings.UPLOAD_DIR, str(case_id))
    if os.path.exists(case_dir):
        shutil.rmtree(case_dir)

    db.delete(case)
    db.commit()
    logger.info(f"Deleted case: {case.name} (ID: {case_id})")
    return {"message": "Case deleted successfully"}


@router.post("/{case_id}/upload", response_model=UploadResponse)
async def upload_documents(
    case_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """Upload documents to a case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Create case upload directory
    case_dir = os.path.join(settings.UPLOAD_DIR, str(case_id))
    os.makedirs(case_dir, exist_ok=True)

    uploaded_count = 0
    skipped_count = 0
    errors = []
    document_ids = []

    for file in files:
        try:
            # Validate file extension
            ext = Path(file.filename).suffix.lower()
            if ext not in settings.ALLOWED_EXTENSIONS:
                errors.append(f"Unsupported file type: {file.filename} ({ext})")
                skipped_count += 1
                continue

            # Generate unique filename
            file_id = uuid.uuid4()
            safe_filename = f"{file_id}{ext}"
            file_path = os.path.join(case_dir, safe_filename)

            # Save file
            content = await file.read()
            file_size = len(content)

            # Check file size
            if file_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
                errors.append(f"File too large: {file.filename} ({file_size / 1024 / 1024:.1f} MB)")
                skipped_count += 1
                continue

            with open(file_path, "wb") as f:
                f.write(content)

            # Detect MIME type
            mime_type, _ = mimetypes.guess_type(file.filename)

            # Create document record
            doc = Document(
                id=file_id,
                case_id=case_id,
                filename=safe_filename,
                original_filename=file.filename,
                file_path=file_path,
                file_type=ext.strip("."),
                file_size=file_size,
                mime_type=mime_type,
                status="pending"
            )
            db.add(doc)
            document_ids.append(file_id)
            uploaded_count += 1

        except Exception as e:
            errors.append(f"Error uploading {file.filename}: {str(e)}")
            skipped_count += 1
            logger.error(f"Upload error for {file.filename}: {e}")

    # Update case document count
    case.total_documents = db.query(Document).filter(Document.case_id == case_id).count()
    db.commit()

    logger.info(f"Uploaded {uploaded_count} files to case {case_id}")
    return UploadResponse(
        case_id=case_id,
        uploaded_files=uploaded_count,
        skipped_files=skipped_count,
        errors=errors,
        document_ids=document_ids
    )


@router.post("/{case_id}/process")
def start_processing(
    case_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Start processing all pending documents in a case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if case.status == "processing":
        raise HTTPException(status_code=409, detail="Case is already being processed")

    # Check if there are pending documents
    pending = db.query(Document).filter(
        Document.case_id == case_id,
        Document.status == "pending"
    ).count()

    if pending == 0:
        raise HTTPException(status_code=400, detail="No pending documents to process")

    # Run processing in a background thread with its own DB session
    def run_pipeline():
        db_session = SessionLocal()
        try:
            pipeline.process_case(str(case_id), db_session)
        finally:
            db_session.close()

    thread = Thread(target=run_pipeline, daemon=True)
    thread.start()

    return {"message": f"Processing started for {pending} documents", "case_id": str(case_id)}


@router.post("/{case_id}/reprocess")
def reprocess_case(
    case_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Reprocess failed documents or process newly added ones."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if case.status == "processing":
        raise HTTPException(status_code=409, detail="Case is already being processed")

    # Count documents needing reprocessing
    reprocess_count = db.query(Document).filter(
        Document.case_id == case_id,
        Document.status.in_(["pending", "failed"])
    ).count()

    if reprocess_count == 0:
        raise HTTPException(status_code=400, detail="No documents need reprocessing")

    # Reset failed documents to pending
    db.query(Document).filter(
        Document.case_id == case_id,
        Document.status == "failed"
    ).update({"status": "pending", "error_message": None})
    db.commit()

    # Run pipeline in background
    def run_pipeline():
        db_session = SessionLocal()
        try:
            pipeline.process_case(str(case_id), db_session, reprocess=True)
        finally:
            db_session.close()

    thread = Thread(target=run_pipeline, daemon=True)
    thread.start()

    return {"message": f"Reprocessing started for {reprocess_count} documents", "case_id": str(case_id)}


@router.get("/{case_id}/status", response_model=ProcessingStatusResponse)
def get_processing_status(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get detailed processing status for a case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Count document statuses
    total = db.query(Document).filter(Document.case_id == case_id).count()
    completed = db.query(Document).filter(
        Document.case_id == case_id, Document.status == "completed"
    ).count()
    failed = db.query(Document).filter(
        Document.case_id == case_id, Document.status == "failed"
    ).count()
    duplicates = db.query(Document).filter(
        Document.case_id == case_id, Document.is_duplicate == True
    ).count()
    pending = db.query(Document).filter(
        Document.case_id == case_id, Document.status == "pending"
    ).count()

    done = completed + failed + duplicates
    progress = (done / total * 100) if total > 0 else 0

    # Get recent logs
    recent_logs = db.query(ProcessingLog).filter(
        ProcessingLog.case_id == case_id
    ).order_by(ProcessingLog.created_at.desc()).limit(20).all()

    return ProcessingStatusResponse(
        case_id=case_id,
        case_status=case.status,
        total_documents=total,
        processed_documents=completed,
        failed_documents=failed,
        duplicate_documents=duplicates,
        pending_documents=pending,
        progress_percentage=round(progress, 1),
        current_stage=case.status,
        recent_logs=recent_logs
    )
