"""
SQLAlchemy ORM Models for DocIntel.
Defines the complete database schema for document intelligence pipeline.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, BigInteger, Float,
    DateTime, Boolean, ForeignKey, Enum, JSON, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Case(Base):
    """Represents a legal case containing multiple documents."""
    __tablename__ = "cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(
        String(50),
        default="created",
        index=True
    )  # created, processing, completed, partially_completed, failed
    priority = Column(String(20), default="normal")  # low, normal, high, urgent

    total_documents = Column(Integer, default=0)
    processed_documents = Column(Integer, default=0)
    failed_documents = Column(Integer, default=0)
    duplicate_documents = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    documents = relationship("Document", back_populates="case", cascade="all, delete-orphan")
    processing_logs = relationship("ProcessingLog", back_populates="case", cascade="all, delete-orphan")
    summary = relationship("CaseSummary", back_populates="case", uselist=False, cascade="all, delete-orphan")


class Document(Base):
    """Represents an individual document within a case."""
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)

    # File info
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, txt, eml, jpg, etc.
    file_size = Column(BigInteger, default=0)  # bytes
    mime_type = Column(String(200), nullable=True)

    # Hashing for deduplication
    file_hash_sha256 = Column(String(64), nullable=True, index=True)
    simhash_value = Column(BigInteger, nullable=True)

    # Processing status
    status = Column(
        String(50),
        default="pending",
        index=True
    )  # pending, extracting, analyzing, completed, failed, duplicate, skipped
    error_message = Column(Text, nullable=True)
    processing_stage = Column(String(100), nullable=True)  # Current processing stage
    processing_progress = Column(Float, default=0.0)  # 0-100

    # Extracted content
    extracted_text = Column(Text, nullable=True)
    text_length = Column(Integer, default=0)
    page_count = Column(Integer, nullable=True)
    has_images = Column(Boolean, default=False)
    ocr_applied = Column(Boolean, default=False)

    # AI Analysis Results
    document_type = Column(String(100), nullable=True)  # contract, email, transcript, etc.
    summary = Column(Text, nullable=True)
    key_entities = Column(JSON, nullable=True)
    important_dates = Column(JSON, nullable=True)
    red_flags = Column(JSON, nullable=True)
    ai_metadata = Column(JSON, nullable=True)  # Additional AI-extracted metadata
    confidence_score = Column(Float, nullable=True)

    # Deduplication
    is_duplicate = Column(Boolean, default=False)
    duplicate_of_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    similarity_score = Column(Float, nullable=True)  # 0-1 for near-duplicates

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    case = relationship("Case", back_populates="documents")
    processing_logs = relationship("ProcessingLog", back_populates="document", cascade="all, delete-orphan")
    duplicate_of = relationship("Document", remote_side="Document.id", foreign_keys=[duplicate_of_id])

    __table_args__ = (
        Index("ix_documents_case_status", "case_id", "status"),
        Index("ix_documents_hash", "file_hash_sha256"),
    )


class ProcessingLog(Base):
    """Tracks processing stages for audit and debugging."""
    __tablename__ = "processing_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)

    stage = Column(String(100), nullable=False)  # ingestion, extraction, dedup, analysis, consolidation
    status = Column(String(50), nullable=False)  # started, completed, failed, skipped
    message = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    duration_ms = Column(Integer, nullable=True)  # Processing time in milliseconds

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    case = relationship("Case", back_populates="processing_logs")
    document = relationship("Document", back_populates="processing_logs")


class CaseSummary(Base):
    """Consolidated case-level analysis combining signals across all documents."""
    __tablename__ = "case_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Statistics
    total_documents = Column(Integer, default=0)
    processed_documents = Column(Integer, default=0)
    failed_documents = Column(Integer, default=0)
    duplicate_documents = Column(Integer, default=0)
    total_text_extracted = Column(BigInteger, default=0)  # Total chars extracted
    total_pages = Column(Integer, default=0)

    # Consolidated Analysis
    document_type_distribution = Column(JSON, nullable=True)  # {type: count}
    key_entities_consolidated = Column(JSON, nullable=True)
    important_dates_consolidated = Column(JSON, nullable=True)
    red_flags_consolidated = Column(JSON, nullable=True)
    executive_summary = Column(Text, nullable=True)
    risk_assessment = Column(JSON, nullable=True)
    timeline = Column(JSON, nullable=True)  # Chronological timeline

    # Metadata
    generated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    case = relationship("Case", back_populates="summary")
