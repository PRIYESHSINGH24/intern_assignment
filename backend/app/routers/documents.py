"""
Document Management API Router
Handles document-level operations and queries.
"""

import uuid
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Document, ProcessingLog
from app.schemas import DocumentResponse, DocumentListResponse, DocumentBriefResponse, ProcessingLogResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Documents"])


@router.get("/cases/{case_id}/documents", response_model=DocumentListResponse)
def list_documents(
    case_id: uuid.UUID,
    status: Optional[str] = None,
    document_type: Optional[str] = None,
    search: Optional[str] = None,
    has_red_flags: Optional[bool] = None,
    is_duplicate: Optional[bool] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: Optional[str] = "desc",
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all documents in a case with filtering and sorting."""
    query = db.query(Document).filter(Document.case_id == case_id)

    if status:
        query = query.filter(Document.status == status)
    if document_type:
        query = query.filter(Document.document_type == document_type)
    if search:
        query = query.filter(Document.original_filename.ilike(f"%{search}%"))
    if is_duplicate is not None:
        query = query.filter(Document.is_duplicate == is_duplicate)
    if has_red_flags is True:
        query = query.filter(Document.red_flags != None, Document.red_flags != '[]')

    # Sorting
    sort_column = getattr(Document, sort_by, Document.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    total = query.count()
    documents = query.offset(skip).limit(limit).all()

    return DocumentListResponse(documents=documents, total=total)


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get full document details including analysis results."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/documents/{doc_id}/text")
def get_document_text(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get the extracted text content of a document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "document_id": str(doc.id),
        "filename": doc.original_filename,
        "text": doc.extracted_text or "",
        "text_length": doc.text_length,
        "ocr_applied": doc.ocr_applied
    }


@router.get("/documents/{doc_id}/logs", response_model=List[ProcessingLogResponse])
def get_document_logs(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get processing logs for a specific document."""
    logs = db.query(ProcessingLog).filter(
        ProcessingLog.document_id == doc_id
    ).order_by(ProcessingLog.created_at.desc()).all()
    return logs


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    """Delete a document from a case."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    case_id = doc.case_id

    # Delete the file
    import os
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    db.delete(doc)

    # Update case document count
    from app.models import Case
    case = db.query(Case).filter(Case.id == case_id).first()
    if case:
        case.total_documents = db.query(Document).filter(
            Document.case_id == case_id
        ).count() - 1  # -1 for the one being deleted

    db.commit()

    return {"message": "Document deleted successfully"}
