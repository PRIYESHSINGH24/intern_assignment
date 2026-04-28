"""
Application Configuration
Centralized settings management using pydantic-settings.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "DocIntel"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://docintel_user:docintel_pass@localhost:5432/docintel"

    # Google Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # File Storage
    UPLOAD_DIR: str = str(Path(__file__).parent.parent / "uploads")
    MAX_FILE_SIZE_MB: int = 500  # Max file size in MB
    ALLOWED_EXTENSIONS: list = [
        ".pdf", ".docx", ".doc", ".txt", ".eml", ".msg",
        ".xlsx", ".xls", ".pptx", ".ppt",
        ".jpg", ".jpeg", ".png", ".tiff", ".bmp",
        ".csv", ".json", ".html", ".htm", ".rtf"
    ]

    # Processing
    MAX_CONCURRENT_WORKERS: int = 4
    OCR_ENABLED: bool = True
    SIMHASH_THRESHOLD: int = 3  # Hamming distance threshold for near-duplicates

    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
