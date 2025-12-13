"""
Configuration file for the Hybrid Receipt Extraction Agent
Contains API keys, settings, and configuration constants
"""

import os
from typing import Optional

# API Keys
GEMINI_API_KEY: Optional[str] = os.getenv('GEMINI_API_KEY')
GOOGLE_CLOUD_PROJECT: Optional[str] = os.getenv('GOOGLE_CLOUD_PROJECT')

# OCR Configuration
TESSERACT_CONFIG = '--oem 3 --psm 6'  # OCR Engine Mode and Page Segmentation Mode
PADDLEOCR_USE_GPU = False  # Set to True if GPU is available

# Image Processing Settings
IMAGE_MAX_WIDTH = 2000
IMAGE_MAX_HEIGHT = 2500
IMAGE_QUALITY = 95

# Confidence Thresholds
MIN_CONFIDENCE_THRESHOLD = 0.85  # Minimum confidence to skip Gemini fallback
MIN_ITEMS_THRESHOLD = 3  # Minimum items required for high confidence

# Shop Template Settings
SHOP_TEMPLATES_FILE = 'shop_templates.json'

# Output Schema
RECEIPT_SCHEMA = {
    "merchant": str,
    "date": str,
    "items": [
        {
            "name": str,
            "qty": float,
            "price": float,
            "total": float
        }
    ],
    "subtotal": float,
    "tax": float,
    "total": float,
    "currency": str
}

# Gemini Configuration
GEMINI_MODEL = "gemini-2.0-flash-exp"  # or "gemini-pro-vision"
GEMINI_TEMPERATURE = 0.1  # Low temperature for consistent extraction
GEMINI_MAX_TOKENS = 4096

# Logging
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# File Paths
DATA_DIR = "data"
TEMPLATES_DIR = "templates"
LOGS_DIR = "logs"

# Currency Settings
DEFAULT_CURRENCY = "CDF"
SUPPORTED_CURRENCIES = ["CDF", "USD"]

# Rate limiting (requests per minute)
GEMINI_RATE_LIMIT = 60

def validate_config() -> bool:
    """Validate that all required configuration is present"""
    # For Phase 1-2, Gemini API key is optional
    # It will be required when implementing Phase 3
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY not set - Gemini fallback will not be available")
        print("This is OK for Phase 1-2 development")

    if not GOOGLE_CLOUD_PROJECT:
        print("WARNING: GOOGLE_CLOUD_PROJECT not set")

    return True

# Validate configuration on import
if not validate_config():
    raise ValueError("Configuration validation failed. Please check your environment variables.")