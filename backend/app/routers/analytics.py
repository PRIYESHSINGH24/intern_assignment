"""
Analytics & Dashboard API Router
Provides dashboard statistics and case-level analytics.
"""

import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Case, Document, CaseSummary, ProcessingLog
from app.schemas import CaseSummaryResponse, DashboardStats

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Analytics"])


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get overall dashboard statistics."""
    total_cases = db.query(Case).count()
    total_documents = db.query(Document).count()
    total_processed = db.query(Document).filter(Document.status == "completed").count()
    total_failed = db.query(Document).filter(Document.status == "failed").count()
    total_duplicates = db.query(Document).filter(Document.is_duplicate == True).count()

    # Count red flags across all documents without pulling full objects into memory
    docs_with_flags = db.query(Document.red_flags).filter(
        Document.red_flags != None
    ).all()
    total_red_flags = 0
    for (flags,) in docs_with_flags:
        if flags and isinstance(flags, list):
            total_red_flags += len(flags)

    # Calculate storage used
    storage_result = db.query(func.sum(Document.file_size)).scalar()
    storage_used = storage_result or 0

    # Recent cases
    recent_cases = db.query(Case.id, Case.name, Case.status, Case.created_at).order_by(Case.created_at.desc()).limit(5).all()
    recent_cases_dicts = [{"id": str(c.id), "name": c.name, "status": c.status, "created_at": c.created_at} for c in recent_cases]

    # Check if any case is currently processing
    processing_active = db.query(Case).filter(Case.status == "processing").count() > 0

    # Document type distribution
    doc_types = db.query(
        Document.document_type, func.count(Document.id)
    ).filter(
        Document.document_type != None
    ).group_by(Document.document_type).all()
    doc_type_dist = {dt: count for dt, count in doc_types}

    return DashboardStats(
        total_cases=total_cases,
        total_documents=total_documents,
        total_processed=total_processed,
        total_failed=total_failed,
        total_duplicates=total_duplicates,
        total_red_flags=total_red_flags,
        storage_used_bytes=storage_used,
        recent_cases=recent_cases_dicts,
        processing_active=processing_active,
        document_type_distribution=doc_type_dist
    )


@router.get("/cases/{case_id}/summary", response_model=CaseSummaryResponse)
def get_case_summary(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get the consolidated case-level summary."""
    summary = db.query(CaseSummary).filter(CaseSummary.case_id == case_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Case summary not yet generated. Process the case first.")
    return summary


@router.get("/cases/{case_id}/entities")
def get_case_entities(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get consolidated entities across all documents in a case."""
    summary = db.query(CaseSummary).filter(CaseSummary.case_id == case_id).first()
    if summary and summary.key_entities_consolidated:
        return summary.key_entities_consolidated
    
    # Fallback: aggregate from individual documents
    documents = db.query(Document).filter(
        Document.case_id == case_id,
        Document.key_entities != None
    ).all()

    all_persons = set()
    all_orgs = set()
    all_locations = set()
    all_monetary = []

    for doc in documents:
        entities = doc.key_entities or {}
        for p in entities.get("persons", []):
            all_persons.add(p)
        for o in entities.get("organizations", []):
            all_orgs.add(o)
        for l in entities.get("locations", []):
            all_locations.add(l)
        all_monetary.extend(entities.get("monetary_values", []))

    return {
        "persons": list(all_persons),
        "organizations": list(all_orgs),
        "locations": list(all_locations),
        "monetary_values": all_monetary
    }


@router.get("/cases/{case_id}/red-flags")
def get_case_red_flags(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get all red flags across documents in a case."""
    documents = db.query(Document).filter(
        Document.case_id == case_id,
        Document.red_flags != None
    ).all()

    all_flags = []
    for doc in documents:
        if doc.red_flags and isinstance(doc.red_flags, list):
            for flag in doc.red_flags:
                flag["source_document"] = doc.original_filename
                flag["document_id"] = str(doc.id)
                all_flags.append(flag)

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    all_flags.sort(key=lambda x: severity_order.get(x.get("severity", "low"), 4))

    return {
        "total": len(all_flags),
        "critical": sum(1 for f in all_flags if f.get("severity") == "critical"),
        "high": sum(1 for f in all_flags if f.get("severity") == "high"),
        "medium": sum(1 for f in all_flags if f.get("severity") == "medium"),
        "low": sum(1 for f in all_flags if f.get("severity") == "low"),
        "flags": all_flags
    }


@router.get("/cases/{case_id}/timeline")
def get_case_timeline(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get a chronological timeline of important dates across case documents."""
    documents = db.query(Document).filter(
        Document.case_id == case_id,
        Document.important_dates != None
    ).all()

    timeline = []
    for doc in documents:
        if doc.important_dates and isinstance(doc.important_dates, list):
            for date_item in doc.important_dates:
                timeline.append({
                    "date": date_item.get("date", ""),
                    "context": date_item.get("context", ""),
                    "significance": date_item.get("significance", "medium"),
                    "source_document": doc.original_filename,
                    "document_id": str(doc.id)
                })

    # Sort by date
    timeline.sort(key=lambda x: x.get("date", ""))

    return {"timeline": timeline, "total_events": len(timeline)}


@router.get("/cases/{case_id}/document-types")
def get_document_type_distribution(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get document type distribution for a case."""
    doc_types = db.query(
        Document.document_type, func.count(Document.id)
    ).filter(
        Document.case_id == case_id,
        Document.document_type != None
    ).group_by(Document.document_type).all()

    return {
        "distribution": {dt: count for dt, count in doc_types},
        "total": sum(count for _, count in doc_types)
    }
