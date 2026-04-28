"""
DocIntel - Large-Scale Document Intelligence Pipeline
FastAPI Application Entry Point

This system processes legal documents at scale, extracting text, detecting
duplicates, and generating AI-powered analysis using Google Gemini.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import cases, documents, analytics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("=" * 60)
    logger.info(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"  Document Intelligence Pipeline")
    logger.info("=" * 60)

    # Initialize database tables
    init_db()
    logger.info("Database tables initialized")

    # Verify upload directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info(f"Upload directory: {settings.UPLOAD_DIR}")

    # Check Gemini API key
    if settings.GEMINI_API_KEY:
        logger.info("Gemini API key configured ✓")
    else:
        logger.warning("GEMINI_API_KEY not set! AI analysis will use fallback mode.")

    yield

    logger.info("Shutting down DocIntel...")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Large-Scale Document Intelligence Pipeline for Legal Tech",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(cases.router)
app.include_router(documents.router)
app.include_router(analytics.router)


@app.get("/")
def root():
    """Root endpoint - API info."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "Large-Scale Document Intelligence Pipeline",
        "docs": "/docs",
        "status": "operational"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": settings.APP_VERSION}

# Mount frontend if it exists (for unified Docker deployment)
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_path):
    logger.info(f"Mounting frontend from {frontend_path}")
    from fastapi.responses import FileResponse
    
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")
    app.mount("/vite.svg", StaticFiles(directory=frontend_path, html=True), name="vite_svg")
    
    # Catch-all route for React Router (must be added last)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Prevent API routes from being swallowed
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("redoc"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
            
        file_path = os.path.join(frontend_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(frontend_path, "index.html"))
