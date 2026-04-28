# DocIntel — Large-Scale Document Intelligence Pipeline

A production-grade document processing system built for legal-tech, designed to ingest, analyze, and derive intelligence from large volumes of heterogeneous case documents.

![Python](https://img.shields.io/badge/Python-3.12+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green) ![React](https://img.shields.io/badge/React-19-61DAFB) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791) ![Gemini](https://img.shields.io/badge/Gemini_AI-2.0_Flash-FF6F00)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                         │
│   Dashboard │ Cases │ Documents │ Analytics │ Red Flags      │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│                   FastAPI Backend                            │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Cases    │  │ Documents │  │Analytics │  │ Processing│  │
│  │  Router   │  │  Router   │  │ Router   │  │  Pipeline │  │
│  └──────────┘  └───────────┘  └──────────┘  └─────┬─────┘  │
│                                                    │        │
│  ┌─────────────────────────────────────────────────▼─────┐  │
│  │              Processing Pipeline (Threaded)            │  │
│  │  ┌─────────┐ ┌─────────┐ ┌──────┐ ┌────────────────┐ │  │
│  │  │ Text    │→│ Dedup   │→│ AI   │→│ Consolidation  │ │  │
│  │  │Extract  │ │Detector │ │Gemini│ │ Case Summary   │ │  │
│  │  └─────────┘ └─────────┘ └──────┘ └────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │       PostgreSQL 15          │
        │  Cases│Docs│Logs│Summaries   │
        └─────────────────────────────┘
```

## Key Features

### Document Processing
- **Multi-format support**: PDF, DOCX, TXT, EML, XLSX, PPTX, CSV, HTML, images
- **OCR integration**: Tesseract for scanned PDFs and images
- **Concurrent processing**: ThreadPoolExecutor for parallel document handling
- **Graceful error handling**: Failed files don't block the pipeline

### Intelligence & Analysis (Gemini AI)
- **Document classification**: Automatically categorizes into 20+ legal document types
- **Smart summarization**: Concise 2-4 sentence summaries per document
- **Entity extraction**: Persons, organizations, locations, monetary values, case references
- **Date detection**: Important dates with context and significance levels
- **Red flag identification**: Suspicious patterns, inconsistencies, compliance issues
- **Confidence scoring**: Each analysis includes a confidence score

### Deduplication
- **Exact duplicates**: SHA-256 hash matching (byte-identical files)
- **Near-duplicates**: SimHash with configurable Hamming distance threshold
- **Avoids repeated work**: Processed content is cached and reused

### Case-Level Intelligence
- **Executive summary**: AI-generated consolidated case overview
- **Risk assessment**: Overall risk score with contributing factors
- **Entity network**: Cross-document entity correlation
- **Timeline**: Chronological reconstruction from all documents
- **Red flag aggregation**: Severity-sorted flags across all documents

### Incremental Processing
- **Add new documents**: Upload additional files anytime
- **Reprocess failed**: Retry failed documents without reprocessing completed ones
- **Status tracking**: File-level and case-level progress monitoring

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 15
- Tesseract OCR (`brew install tesseract`)
- Google Gemini API Key

### 1. Clone & Setup Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
# Edit backend/.env
DATABASE_URL=postgresql://docintel_user:docintel_pass@localhost:5432/docintel
GEMINI_API_KEY=your_key_here
```

### 3. Setup Database
```bash
psql postgres -c "CREATE DATABASE docintel;"
psql postgres -c "CREATE USER docintel_user WITH PASSWORD 'docintel_pass';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE docintel TO docintel_user;"
psql postgres -c "ALTER DATABASE docintel OWNER TO docintel_user;"
```

### 4. Generate Mock Data
```bash
cd backend
python generate_mock_data.py
```

### 5. Start Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Setup & Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 7. Open Application
Visit `http://localhost:5173`

---

## Docker Deployment

```bash
# Set your Gemini API key
export GEMINI_API_KEY=your_key_here

# Build and run
docker-compose up --build -d

# Access at http://localhost
```

---

## API Documentation

Interactive API docs available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cases/` | Create new case |
| GET | `/api/cases/` | List all cases |
| POST | `/api/cases/{id}/upload` | Upload documents |
| POST | `/api/cases/{id}/process` | Start processing |
| POST | `/api/cases/{id}/reprocess` | Reprocess failed docs |
| GET | `/api/cases/{id}/status` | Processing status |
| GET | `/api/cases/{id}/summary` | Case-level summary |
| GET | `/api/cases/{id}/red-flags` | All red flags |
| GET | `/api/cases/{id}/timeline` | Event timeline |
| GET | `/api/dashboard/stats` | Dashboard statistics |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.12, FastAPI |
| Frontend | React 19, Vite, Recharts |
| Database | PostgreSQL 15 |
| AI/NLP | Google Gemini 2.0 Flash |
| OCR | Tesseract |
| Text Extraction | pdfplumber, python-docx, openpyxl |
| Deduplication | SHA-256 + SimHash |
| Deployment | Docker, Docker Compose |

---

## Design Decisions

1. **ThreadPoolExecutor over Celery**: Simpler deployment for demo, still provides concurrent processing. Production upgrade path to Celery is straightforward.

2. **SimHash for near-duplicates**: O(1) comparison, space-efficient, configurable similarity threshold via Hamming distance.

3. **Single Gemini call per document**: Combines classification, summarization, entity extraction, date detection, and red flag identification in one API call for efficiency.

4. **Fallback analysis**: When AI is unavailable, regex-based extraction ensures the pipeline never fully fails.

5. **Background thread processing**: Non-blocking API—upload and process requests return immediately while work continues in background.

---

## License
MIT
