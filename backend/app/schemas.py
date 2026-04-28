"""
Pydantic Schemas for API request/response validation.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


# ============ Case Schemas ============

class CaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=500, description="Case name")
    description: Optional[str] = Field(None, description="Case description")
    priority: Optional[str] = Field("normal", description="Priority level")


class CaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None


class CaseResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: str
    priority: str
    total_documents: int
    processed_documents: int
    failed_documents: int
    duplicate_documents: int
    created_at: datetime
    updated_at: datetime
    processing_started_at: Optional[datetime]
    processing_completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class CaseListResponse(BaseModel):
    cases: List[CaseResponse]
    total: int


# ============ Document Schemas ============

class DocumentResponse(BaseModel):
    id: UUID
    case_id: UUID
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    mime_type: Optional[str]
    file_hash_sha256: Optional[str]
    status: str
    error_message: Optional[str]
    processing_stage: Optional[str]
    processing_progress: float
    extracted_text: Optional[str]
    text_length: int
    page_count: Optional[int]
    has_images: bool
    ocr_applied: bool
    document_type: Optional[str]
    summary: Optional[str]
    key_entities: Optional[Dict[str, Any]]
    important_dates: Optional[List[Dict[str, Any]]]
    red_flags: Optional[List[Dict[str, Any]]]
    ai_metadata: Optional[Dict[str, Any]]
    confidence_score: Optional[float]
    is_duplicate: bool
    duplicate_of_id: Optional[UUID]
    similarity_score: Optional[float]
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime]

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


class DocumentBriefResponse(BaseModel):
    """Lightweight document info for lists."""
    id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    processing_progress: float
    document_type: Optional[str]
    summary: Optional[str]
    is_duplicate: bool
    red_flags: Optional[List[Dict[str, Any]]]
    created_at: datetime
    processed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============ Processing Schemas ============

class ProcessingLogResponse(BaseModel):
    id: UUID
    case_id: UUID
    document_id: Optional[UUID]
    stage: str
    status: str
    message: Optional[str]
    details: Optional[Dict[str, Any]]
    duration_ms: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingStatusResponse(BaseModel):
    case_id: UUID
    case_status: str
    total_documents: int
    processed_documents: int
    failed_documents: int
    duplicate_documents: int
    pending_documents: int
    progress_percentage: float
    current_stage: Optional[str]
    recent_logs: List[ProcessingLogResponse]


# ============ Case Summary Schemas ============

class CaseSummaryResponse(BaseModel):
    id: UUID
    case_id: UUID
    total_documents: int
    processed_documents: int
    failed_documents: int
    duplicate_documents: int
    total_text_extracted: int
    total_pages: int
    document_type_distribution: Optional[Dict[str, int]]
    key_entities_consolidated: Optional[Dict[str, Any]]
    important_dates_consolidated: Optional[List[Dict[str, Any]]]
    red_flags_consolidated: Optional[List[Dict[str, Any]]]
    executive_summary: Optional[str]
    risk_assessment: Optional[Dict[str, Any]]
    timeline: Optional[List[Dict[str, Any]]]
    generated_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Dashboard Schemas ============

class DashboardStats(BaseModel):
    total_cases: int
    total_documents: int
    total_processed: int
    total_failed: int
    total_duplicates: int
    total_red_flags: int
    storage_used_bytes: int
    recent_cases: List[CaseResponse]
    processing_active: bool
    document_type_distribution: Dict[str, int]


# ============ Upload Response ============

class UploadResponse(BaseModel):
    case_id: UUID
    uploaded_files: int
    skipped_files: int
    errors: List[str]
    document_ids: List[UUID]
