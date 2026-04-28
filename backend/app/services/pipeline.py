"""
Document Processing Pipeline
Orchestrates the complete document processing workflow:
1. File ingestion & hashing
2. Text extraction
3. Duplicate detection
4. AI analysis
5. Case-level consolidation
"""

import os
import uuid
import time
import logging
import traceback
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Case, Document, ProcessingLog, CaseSummary
from app.services.text_extractor import text_extractor
from app.services.duplicate_detector import duplicate_detector
from app.services.ai_analyzer import ai_analyzer

logger = logging.getLogger(__name__)


class ProcessingPipeline:
    """
    Orchestrates the end-to-end document processing pipeline.
    Handles concurrent processing, error recovery, and incremental updates.
    """

    def __init__(self, max_workers: int = None):
        self.max_workers = max_workers or settings.MAX_CONCURRENT_WORKERS
        self._active_jobs = {}

    def process_case(self, case_id: str, db: Session, reprocess: bool = False):
        """
        Process all documents in a case.
        This is the main entry point called as a background task.
        """
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            logger.error(f"Case {case_id} not found")
            return

        logger.info(f"Starting pipeline for case: {case.name} (ID: {case_id})")

        # Update case status
        case.status = "processing"
        case.processing_started_at = datetime.now(timezone.utc)
        db.commit()

        self._log(db, case_id, None, "pipeline", "started",
                  f"Starting processing for case '{case.name}'")

        try:
            # Step 1: Get documents to process
            if reprocess:
                documents = db.query(Document).filter(
                    Document.case_id == case_id,
                    Document.status.in_(["pending", "failed"])
                ).all()
            else:
                documents = db.query(Document).filter(
                    Document.case_id == case_id,
                    Document.status == "pending"
                ).all()

            if not documents:
                logger.info(f"No documents to process for case {case_id}")
                case.status = "completed"
                case.processing_completed_at = datetime.now(timezone.utc)
                db.commit()
                return

            total = len(documents)
            logger.info(f"Processing {total} documents for case {case_id}")

            # Step 2: Build existing hash maps for deduplication
            existing_docs = db.query(Document).filter(
                Document.case_id == case_id,
                Document.status == "completed",
                Document.is_duplicate == False
            ).all()

            existing_hashes = {
                doc.file_hash_sha256: str(doc.id)
                for doc in existing_docs if doc.file_hash_sha256
            }
            existing_simhashes = {
                doc.simhash_value: str(doc.id)
                for doc in existing_docs if doc.simhash_value
            }

            # Step 3: Process documents sequentially (reliable with remote DB)
            processed = 0
            failed = 0
            duplicates = 0

            for i, doc in enumerate(documents):
                logger.info(f"Processing document {i+1}/{total}: {doc.original_filename}")
                try:
                    result = self._process_single_document(
                        str(doc.id), str(case_id),
                        doc.file_path, doc.original_filename, doc.file_type,
                        dict(existing_hashes), dict(existing_simhashes)
                    )

                    # Refresh and update document
                    db.refresh(doc)
                    self._update_document_from_result(db, doc, result)

                    if result.get("is_duplicate"):
                        duplicates += 1
                    else:
                        processed += 1
                        if result.get("file_hash"):
                            existing_hashes[result["file_hash"]] = str(doc.id)
                        if result.get("simhash"):
                            existing_simhashes[result["simhash"]] = str(doc.id)

                except Exception as e:
                    failed += 1
                    logger.error(f"Document {doc.id} failed: {e}")
                    try:
                        db.refresh(doc)
                        doc.status = "failed"
                        doc.error_message = str(e)[:1000]
                    except Exception:
                        pass
                    self._log(db, case_id, str(doc.id), "processing", "failed",
                              f"Error: {str(e)[:500]}")

                # Update case progress
                case.processed_documents = processed
                case.failed_documents = failed
                case.duplicate_documents = duplicates
                try:
                    db.commit()
                except Exception:
                    db.rollback()

            # Step 4: Generate case-level consolidation
            self._log(db, case_id, None, "consolidation", "started",
                      "Generating case-level summary")
            try:
                self._generate_case_summary(db, case_id)
                self._log(db, case_id, None, "consolidation", "completed",
                          "Case summary generated successfully")
            except Exception as e:
                logger.error(f"Case consolidation failed: {e}")
                self._log(db, case_id, None, "consolidation", "failed",
                          f"Error: {str(e)[:500]}")

            # Step 5: Finalize case status
            if failed > 0 and processed > 0:
                case.status = "partially_completed"
            elif failed > 0 and processed == 0:
                case.status = "failed"
            else:
                case.status = "completed"

            case.processing_completed_at = datetime.now(timezone.utc)
            db.commit()

            self._log(db, case_id, None, "pipeline", "completed",
                      f"Pipeline completed: {processed} processed, {duplicates} duplicates, {failed} failed")

            logger.info(f"Pipeline completed for case {case_id}: "
                        f"{processed} processed, {duplicates} duplicates, {failed} failed")

        except Exception as e:
            logger.error(f"Pipeline failed for case {case_id}: {traceback.format_exc()}")
            case.status = "failed"
            db.commit()
            self._log(db, case_id, None, "pipeline", "failed", f"Pipeline error: {str(e)[:500]}")

    def _process_single_document(
        self,
        doc_id: str,
        case_id: str,
        file_path: str,
        filename: str,
        file_type: str,
        existing_hashes: dict,
        existing_simhashes: dict
    ) -> dict:
        """
        Process a single document through the full pipeline.
        This runs in a thread pool worker.
        Returns a result dict with all extracted data.
        """
        result = {
            "status": "completed",
            "error_message": None,
            "file_hash": None,
            "simhash": None,
            "is_duplicate": False,
            "duplicate_of_id": None,
            "similarity_score": None,
            "extracted_text": None,
            "text_length": 0,
            "page_count": None,
            "has_images": False,
            "ocr_applied": False,
            "document_type": None,
            "summary": None,
            "key_entities": None,
            "important_dates": None,
            "red_flags": None,
            "ai_metadata": None,
            "confidence_score": None,
        }

        start_time = time.time()

        try:
            # Stage 1: Compute file hash
            logger.info(f"[{doc_id}] Computing file hash for {filename}")
            result["file_hash"] = duplicate_detector.compute_file_hash(file_path)

            # Stage 2: Check exact duplicate
            exact_dup = duplicate_detector.check_exact_duplicate(
                result["file_hash"], existing_hashes
            )
            if exact_dup:
                logger.info(f"[{doc_id}] Exact duplicate of {exact_dup}")
                result["is_duplicate"] = True
                result["duplicate_of_id"] = exact_dup
                result["similarity_score"] = 1.0
                result["status"] = "duplicate"
                return result

            # Stage 3: Extract text
            logger.info(f"[{doc_id}] Extracting text from {filename} (type: {file_type})")
            text, metadata = text_extractor.extract(file_path, file_type)
            result["extracted_text"] = text
            result["text_length"] = len(text)
            result["page_count"] = metadata.get("page_count")
            result["has_images"] = metadata.get("has_images", False)
            result["ocr_applied"] = metadata.get("ocr_applied", False)

            # Stage 4: Compute SimHash for near-duplicate detection
            if text and len(text.strip()) > 50:
                result["simhash"] = duplicate_detector.compute_simhash(text)

                near_dup = duplicate_detector.check_near_duplicate(
                    result["simhash"], existing_simhashes
                )
                if near_dup:
                    logger.info(f"[{doc_id}] Near-duplicate of {near_dup[0]} "
                                f"(similarity: {near_dup[1]:.2f})")
                    result["is_duplicate"] = True
                    result["duplicate_of_id"] = near_dup[0]
                    result["similarity_score"] = near_dup[1]
                    result["status"] = "duplicate"
                    # Still store the extracted text for near-duplicates
                    return result

            # Stage 5: AI Analysis
            if text and len(text.strip()) > 20:
                logger.info(f"[{doc_id}] Running AI analysis on {filename}")
                try:
                    analysis = ai_analyzer.analyze_document(text, filename)

                    result["document_type"] = analysis.get("document_type", "other")
                    result["summary"] = analysis.get("summary", "")
                    result["key_entities"] = analysis.get("key_entities", {})
                    result["important_dates"] = analysis.get("important_dates", [])
                    result["red_flags"] = analysis.get("red_flags", [])
                    result["confidence_score"] = analysis.get("confidence_score", 0.5)
                    result["ai_metadata"] = {
                        "language": analysis.get("language", "en"),
                        "tone": analysis.get("tone", "neutral"),
                        "additional": analysis.get("additional_metadata", {})
                    }
                except Exception as e:
                    logger.warning(f"[{doc_id}] AI analysis failed: {e}, using fallback")
                    # Don't fail the whole document, just skip AI analysis
                    result["document_type"] = "other"
                    result["summary"] = f"Text extracted ({result['text_length']} chars). AI analysis unavailable."
                    result["confidence_score"] = 0.2
            else:
                result["document_type"] = "other"
                result["summary"] = "Document contains minimal or no extractable text."
                result["confidence_score"] = 0.1

            elapsed = time.time() - start_time
            logger.info(f"[{doc_id}] Processing completed in {elapsed:.1f}s")

        except Exception as e:
            logger.error(f"[{doc_id}] Processing error: {traceback.format_exc()}")
            result["status"] = "failed"
            result["error_message"] = str(e)[:1000]

        return result

    def _update_document_from_result(self, db: Session, doc: Document, result: dict):
        """Update a document record with processing results."""
        doc.status = result["status"]
        doc.error_message = result.get("error_message")
        doc.file_hash_sha256 = result.get("file_hash")
        doc.simhash_value = result.get("simhash")
        doc.extracted_text = result.get("extracted_text")
        doc.text_length = result.get("text_length", 0)
        doc.page_count = result.get("page_count")
        doc.has_images = result.get("has_images", False)
        doc.ocr_applied = result.get("ocr_applied", False)
        doc.document_type = result.get("document_type")
        doc.summary = result.get("summary")
        doc.key_entities = result.get("key_entities")
        doc.important_dates = result.get("important_dates")
        doc.red_flags = result.get("red_flags")
        doc.ai_metadata = result.get("ai_metadata")
        doc.confidence_score = result.get("confidence_score")
        doc.is_duplicate = result.get("is_duplicate", False)
        doc.similarity_score = result.get("similarity_score")
        doc.processed_at = datetime.now(timezone.utc)

        if result.get("duplicate_of_id"):
            try:
                doc.duplicate_of_id = uuid.UUID(result["duplicate_of_id"])
            except (ValueError, TypeError):
                pass

        # Log the processing stage
        stage = "duplicate_detection" if doc.is_duplicate else "analysis"
        status = "completed" if doc.status in ("completed", "duplicate") else "failed"
        self._log(db, str(doc.case_id), str(doc.id), stage, status,
                  f"{doc.original_filename}: {doc.status}")

    def _generate_case_summary(self, db: Session, case_id: str):
        """Generate consolidated case-level summary."""
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            return

        # Gather all processed documents
        completed_docs = db.query(Document).filter(
            Document.case_id == case_id,
            Document.status == "completed"
        ).all()

        if not completed_docs:
            return

        # Collect data for consolidation
        summaries = []
        all_entities = []
        all_dates = []
        all_red_flags = []
        doc_type_dist = {}
        total_text = 0
        total_pages = 0

        for doc in completed_docs:
            if doc.summary:
                summaries.append({
                    "filename": doc.original_filename,
                    "type": doc.document_type,
                    "summary": doc.summary
                })

            if doc.key_entities:
                all_entities.append({
                    "source": doc.original_filename,
                    "entities": doc.key_entities
                })

            if doc.important_dates:
                for date_item in doc.important_dates:
                    date_item["source_document"] = doc.original_filename
                    all_dates.append(date_item)

            if doc.red_flags:
                for flag in doc.red_flags:
                    flag["source_document"] = doc.original_filename
                    all_red_flags.append(flag)

            if doc.document_type:
                doc_type_dist[doc.document_type] = doc_type_dist.get(doc.document_type, 0) + 1

            total_text += doc.text_length or 0
            total_pages += doc.page_count or 0

        # Generate AI-powered case summary
        try:
            consolidated = ai_analyzer.generate_case_summary(
                summaries, all_entities, all_dates, all_red_flags,
                doc_type_dist, case.name
            )
        except Exception as e:
            logger.error(f"AI consolidation failed: {e}")
            consolidated = {
                "executive_summary": f"Case contains {len(completed_docs)} processed documents. Manual review recommended.",
                "risk_assessment": {"overall_risk": "unknown", "factors": []},
                "timeline": [],
                "key_findings": []
            }

        # Count stats
        all_docs = db.query(Document).filter(Document.case_id == case_id).all()
        failed_count = sum(1 for d in all_docs if d.status == "failed")
        dup_count = sum(1 for d in all_docs if d.is_duplicate)

        # Create or update case summary
        existing_summary = db.query(CaseSummary).filter(
            CaseSummary.case_id == case_id
        ).first()

        if existing_summary:
            summary = existing_summary
        else:
            summary = CaseSummary(case_id=case_id)
            db.add(summary)

        summary.total_documents = len(all_docs)
        summary.processed_documents = len(completed_docs)
        summary.failed_documents = failed_count
        summary.duplicate_documents = dup_count
        summary.total_text_extracted = total_text
        summary.total_pages = total_pages
        summary.document_type_distribution = doc_type_dist
        summary.key_entities_consolidated = self._consolidate_entities(all_entities)
        summary.important_dates_consolidated = all_dates
        summary.red_flags_consolidated = all_red_flags
        summary.executive_summary = consolidated.get("executive_summary", "")
        summary.risk_assessment = consolidated.get("risk_assessment", {})
        summary.timeline = consolidated.get("timeline", [])
        summary.generated_at = datetime.now(timezone.utc)

        db.commit()

    def _consolidate_entities(self, entity_list: list) -> dict:
        """Merge entities from multiple documents, deduplicating."""
        consolidated = {
            "persons": {},
            "organizations": {},
            "locations": {},
            "monetary_values": [],
            "case_references": []
        }

        for item in entity_list:
            entities = item.get("entities", {})
            source = item.get("source", "unknown")

            for person in entities.get("persons", []):
                if person:
                    key = person.strip().lower()
                    if key not in consolidated["persons"]:
                        consolidated["persons"][key] = {
                            "name": person.strip(),
                            "sources": []
                        }
                    consolidated["persons"][key]["sources"].append(source)

            for org in entities.get("organizations", []):
                if org:
                    key = org.strip().lower()
                    if key not in consolidated["organizations"]:
                        consolidated["organizations"][key] = {
                            "name": org.strip(),
                            "sources": []
                        }
                    consolidated["organizations"][key]["sources"].append(source)

            for loc in entities.get("locations", []):
                if loc:
                    key = loc.strip().lower()
                    if key not in consolidated["locations"]:
                        consolidated["locations"][key] = {
                            "name": loc.strip(),
                            "sources": []
                        }
                    consolidated["locations"][key]["sources"].append(source)

            for val in entities.get("monetary_values", []):
                if val:
                    consolidated["monetary_values"].append({
                        "value": val,
                        "source": source
                    })

            for ref in entities.get("case_references", []):
                if ref:
                    consolidated["case_references"].append({
                        "reference": ref,
                        "source": source
                    })

        # Convert dicts to lists for JSON serialization
        result = {
            "persons": list(consolidated["persons"].values()),
            "organizations": list(consolidated["organizations"].values()),
            "locations": list(consolidated["locations"].values()),
            "monetary_values": consolidated["monetary_values"],
            "case_references": consolidated["case_references"]
        }

        return result

    def _log(self, db: Session, case_id: str, doc_id: Optional[str],
             stage: str, status: str, message: str, details: dict = None):
        """Create a processing log entry."""
        log = ProcessingLog(
            case_id=case_id,
            document_id=doc_id,
            stage=stage,
            status=status,
            message=message,
            details=details
        )
        db.add(log)
        try:
            db.commit()
        except Exception:
            db.rollback()


# Singleton instance
pipeline = ProcessingPipeline()
