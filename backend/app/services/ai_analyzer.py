"""
AI Analyzer Service
Uses Google Gemini API for intelligent document analysis:
- Document type classification
- Summarization
- Entity extraction (persons, organizations, locations, monetary values)
- Important date extraction
- Red flag detection
"""

import json
import logging
import re
from typing import Dict, Any, Optional

import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)


class AIAnalyzer:
    """
    Leverages Google Gemini for document intelligence.
    All analysis is done in a single API call per document for efficiency.
    """

    def __init__(self):
        self.model = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of the Gemini model."""
        if not self._initialized:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY not configured. Set it in .env file.")
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
            self._initialized = True

    def analyze_document(self, text: str, filename: str = "") -> Dict[str, Any]:
        """
        Perform comprehensive document analysis using Gemini.
        Returns structured analysis results.
        """
        self._ensure_initialized()

        # Truncate very long texts to fit within context window
        max_chars = 30000
        truncated = False
        if len(text) > max_chars:
            text = text[:max_chars]
            truncated = True

        prompt = self._build_analysis_prompt(text, filename, truncated)

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=4096,
                    response_mime_type="application/json"
                )
            )

            result = self._parse_response(response.text)
            return result

        except Exception as e:
            logger.error(f"Gemini analysis failed for {filename}: {str(e)}")
            # Return a fallback result with whatever we can extract
            return self._fallback_analysis(text, filename)

    def generate_case_summary(
        self,
        document_summaries: list,
        entities: list,
        dates: list,
        red_flags: list,
        doc_types: dict,
        case_name: str = ""
    ) -> Dict[str, Any]:
        """
        Generate a consolidated case-level summary by combining signals
        from all processed documents.
        """
        self._ensure_initialized()

        prompt = self._build_consolidation_prompt(
            document_summaries, entities, dates, red_flags, doc_types, case_name
        )

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=8192,
                    response_mime_type="application/json"
                )
            )

            result = self._parse_response(response.text)
            return result

        except Exception as e:
            logger.error(f"Case summary generation failed: {str(e)}")
            return {
                "executive_summary": "Unable to generate case summary due to processing error.",
                "risk_assessment": {"overall_risk": "unknown", "factors": []},
                "timeline": [],
                "key_findings": []
            }

    def _build_analysis_prompt(self, text: str, filename: str, truncated: bool) -> str:
        """Build the comprehensive analysis prompt for a single document."""
        truncation_note = "\n[NOTE: Document was truncated for analysis. Analysis is based on the first portion.]" if truncated else ""

        return f"""You are an expert legal document analyst working for a legal-tech company. 
Analyze the following document thoroughly and return a structured JSON response.

Document filename: {filename}
{truncation_note}

DOCUMENT TEXT:
---
{text}
---

Return a JSON object with EXACTLY these fields:

{{
    "document_type": "<one of: contract, email, transcript, invoice, court_filing, legal_brief, correspondence, financial_document, report, memo, affidavit, deposition, settlement, complaint, motion, subpoena, warrant, evidence_log, witness_statement, other>",
    
    "summary": "<A concise 2-4 sentence summary capturing the key points, parties involved, and purpose of the document>",
    
    "key_entities": {{
        "persons": ["<list of person names mentioned>"],
        "organizations": ["<list of organization/company names>"],
        "locations": ["<list of locations/addresses>"],
        "monetary_values": ["<list of monetary amounts with context, e.g., '$50,000 settlement amount'>"],
        "case_references": ["<list of case numbers or legal references>"]
    }},
    
    "important_dates": [
        {{"date": "<date in YYYY-MM-DD format or original text if ambiguous>", "context": "<what happened or is scheduled for this date>", "significance": "<low|medium|high>"}}
    ],
    
    "red_flags": [
        {{"flag": "<brief description of the red flag>", "severity": "<low|medium|high|critical>", "detail": "<detailed explanation of why this is a concern>", "location": "<where in the document this was found>"}}
    ],
    
    "confidence_score": <float between 0.0 and 1.0 indicating confidence in the analysis>,
    
    "language": "<detected language of the document>",
    
    "tone": "<professional|informal|hostile|neutral|urgent|confidential>",
    
    "additional_metadata": {{
        "has_signatures": <boolean>,
        "has_amendments": <boolean>,
        "requires_action": <boolean>,
        "action_items": ["<list of any action items or deadlines>"]
    }}
}}

IMPORTANT RULES:
1. Be thorough but precise in entity extraction
2. Flag genuinely concerning items as red flags (inconsistencies, unusual clauses, missing information, compliance issues)
3. If the document appears to be corrupted, garbled, or nonsensical, set document_type to "other" and note it in the summary
4. Dates should be in ISO format when possible
5. Be conservative with red flag severity - only mark as "critical" for genuinely serious issues
6. Return ONLY valid JSON, no markdown formatting or explanation"""

    def _build_consolidation_prompt(
        self, summaries, entities, dates, red_flags, doc_types, case_name
    ) -> str:
        """Build prompt for case-level consolidation."""
        # Truncate inputs if too long
        summaries_text = json.dumps(summaries[:50], indent=1)[:8000]
        entities_text = json.dumps(entities[:30], indent=1)[:4000]
        dates_text = json.dumps(dates[:50], indent=1)[:3000]
        red_flags_text = json.dumps(red_flags[:30], indent=1)[:4000]
        doc_types_text = json.dumps(doc_types, indent=1)[:1000]

        return f"""You are a senior legal analyst. Based on the following analysis of multiple documents 
from case "{case_name}", produce a comprehensive case-level consolidated report.

DOCUMENT TYPE DISTRIBUTION:
{doc_types_text}

DOCUMENT SUMMARIES (from individual documents):
{summaries_text}

KEY ENTITIES FOUND ACROSS DOCUMENTS:
{entities_text}

IMPORTANT DATES:
{dates_text}

RED FLAGS IDENTIFIED:
{red_flags_text}

Generate a consolidated JSON report:

{{
    "executive_summary": "<A comprehensive 3-5 paragraph executive summary of the entire case, covering key parties, timeline of events, major findings, and overall assessment>",
    
    "risk_assessment": {{
        "overall_risk": "<low|medium|high|critical>",
        "risk_score": <integer 1-100>,
        "factors": [
            {{"factor": "<risk factor>", "severity": "<low|medium|high|critical>", "description": "<explanation>"}}
        ]
    }},
    
    "timeline": [
        {{"date": "<date>", "event": "<what happened>", "significance": "<low|medium|high>", "source_documents": ["<which documents mention this>"]}}
    ],
    
    "key_findings": [
        {{"finding": "<key finding>", "supporting_evidence": "<which documents support this>", "importance": "<low|medium|high>"}}
    ],
    
    "entity_network": {{
        "primary_parties": ["<main parties involved>"],
        "relationships": ["<key relationships between parties>"],
        "organizations_involved": ["<all organizations>"]
    }},
    
    "recommendations": [
        "<specific recommendations for the legal review team>"
    ],
    
    "gaps_and_concerns": [
        "<any gaps in documentation or unresolved concerns>"
    ]
}}

Be thorough, analytical, and precise. Cross-reference information across documents.
Return ONLY valid JSON."""

    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse the JSON response from Gemini, handling potential formatting issues."""
        # Try direct JSON parsing first
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON from markdown code blocks
        json_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try finding JSON object in the response
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        logger.warning(f"Failed to parse Gemini response as JSON: {response_text[:200]}")
        return {"error": "Failed to parse AI response", "raw": response_text[:500]}

    def _fallback_analysis(self, text: str, filename: str) -> Dict[str, Any]:
        """
        Provide basic analysis when AI service is unavailable.
        Uses simple heuristics and regex patterns.
        """
        # Detect document type from filename
        doc_type = "other"
        filename_lower = filename.lower()
        if any(kw in filename_lower for kw in ["contract", "agreement", "terms"]):
            doc_type = "contract"
        elif any(kw in filename_lower for kw in ["email", "mail", "message"]):
            doc_type = "email"
        elif any(kw in filename_lower for kw in ["transcript", "deposition"]):
            doc_type = "transcript"
        elif any(kw in filename_lower for kw in ["invoice", "receipt", "bill"]):
            doc_type = "invoice"
        elif any(kw in filename_lower for kw in ["report", "analysis"]):
            doc_type = "report"

        # Extract dates using regex
        date_patterns = [
            r"\b\d{4}-\d{2}-\d{2}\b",
            r"\b\d{2}/\d{2}/\d{4}\b",
            r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b"
        ]
        dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, text[:5000], re.IGNORECASE)
            for match in matches[:5]:
                dates.append({"date": match, "context": "Found in document", "significance": "medium"})

        # Extract monetary values
        money_pattern = r"\$[\d,]+(?:\.\d{2})?"
        monetary_values = re.findall(money_pattern, text[:5000])

        # Simple summary
        sentences = text.split(".")[:3]
        summary = ". ".join(s.strip() for s in sentences if s.strip())
        if len(summary) > 300:
            summary = summary[:300] + "..."

        return {
            "document_type": doc_type,
            "summary": summary or "Unable to generate summary.",
            "key_entities": {
                "persons": [],
                "organizations": [],
                "locations": [],
                "monetary_values": monetary_values[:5],
                "case_references": []
            },
            "important_dates": dates,
            "red_flags": [],
            "confidence_score": 0.3,
            "language": "en",
            "tone": "neutral",
            "additional_metadata": {
                "has_signatures": False,
                "has_amendments": False,
                "requires_action": False,
                "action_items": []
            }
        }


# Singleton instance
ai_analyzer = AIAnalyzer()
