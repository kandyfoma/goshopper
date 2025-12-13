"""
Local OCR Module for Receipt Text Extraction
Uses Tesseract OCR or PaddleOCR for fast, local text extraction
"""

import logging
from pathlib import Path
from typing import Optional, Union
import cv2
import numpy as np

# Try to import OCR libraries
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("WARNING: pytesseract not available. Install with: pip install pytesseract")

try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False
    print("WARNING: paddleocr not available. Install with: pip install paddlepaddle paddleocr")

from config import (
    TESSERACT_CONFIG,
    PADDLEOCR_USE_GPU,
    IMAGE_MAX_WIDTH,
    IMAGE_MAX_HEIGHT,
    IMAGE_QUALITY
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OCREngine:
    """Base class for OCR engines"""

    def __init__(self, engine_name: str):
        self.engine_name = engine_name
        self.initialized = False

    def initialize(self) -> bool:
        """Initialize the OCR engine"""
        raise NotImplementedError

    def extract_text(self, image_path: Union[str, Path]) -> str:
        """Extract text from image"""
        raise NotImplementedError

class TesseractOCR(OCREngine):
    """Tesseract OCR Engine"""

    def __init__(self):
        super().__init__("Tesseract")
        self.config = TESSERACT_CONFIG

    def initialize(self) -> bool:
        """Initialize Tesseract"""
        if not TESSERACT_AVAILABLE:
            logger.error("Tesseract not available")
            return False

        try:
            # Test Tesseract installation
            version = pytesseract.get_tesseract_version()
            logger.info(f"Tesseract version: {version}")
            self.initialized = True
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Tesseract: {e}")
            return False

    def extract_text(self, image_path: Union[str, Path]) -> str:
        """Extract text using Tesseract"""
        if not self.initialized:
            raise RuntimeError("Tesseract not initialized")

        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(f"Image file not found: {image_path}")

            # Read image
            image = cv2.imread(str(image_path))
            if image is None:
                raise ValueError(f"Could not read image: {image_path}")

            # Extract text
            text = pytesseract.image_to_string(image, config=self.config)

            logger.info(f"Extracted {len(text)} characters using Tesseract")
            return text.strip()

        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
            raise

class PaddleOCREngine(OCREngine):
    """PaddleOCR Engine"""

    def __init__(self):
        super().__init__("PaddleOCR")
        self.ocr = None

    def initialize(self) -> bool:
        """Initialize PaddleOCR"""
        if not PADDLEOCR_AVAILABLE:
            logger.error("PaddleOCR not available")
            return False

        try:
            # Initialize PaddleOCR
            self.ocr = PaddleOCR(
                use_gpu=PADDLEOCR_USE_GPU,
                lang='en',  # Can be extended for multi-language support
                show_log=False
            )
            self.initialized = True
            logger.info("PaddleOCR initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            return False

    def extract_text(self, image_path: Union[str, Path]) -> str:
        """Extract text using PaddleOCR"""
        if not self.initialized or self.ocr is None:
            raise RuntimeError("PaddleOCR not initialized")

        try:
            image_path = Path(image_path)
            if not image_path.exists():
                raise FileNotFoundError(f"Image file not found: {image_path}")

            # PaddleOCR expects numpy array
            image = cv2.imread(str(image_path))
            if image is None:
                raise ValueError(f"Could not read image: {image_path}")

            # Extract text
            results = self.ocr.ocr(image, cls=True)

            # Combine all detected text
            text_lines = []
            for line in results[0]:
                if line:
                    text_lines.append(line[1][0])  # Text content

            text = '\n'.join(text_lines)

            logger.info(f"Extracted {len(text)} characters using PaddleOCR")
            return text.strip()

        except Exception as e:
            logger.error(f"PaddleOCR extraction failed: {e}")
            raise

def preprocess_image(image_path: Union[str, Path]) -> Optional[str]:
    """
    Preprocess image for better OCR accuracy
    Returns path to processed image or None if processing fails
    """
    try:
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")

        # Read image
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError(f"Could not read image: {image_path}")

        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Apply adaptive thresholding for better contrast
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )

        # Apply morphological operations to clean up the image
        kernel = np.ones((1, 1), np.uint8)
        processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        processed = cv2.morphologyEx(processed, cv2.MORPH_OPEN, kernel)

        # Resize if too large
        height, width = processed.shape
        if width > IMAGE_MAX_WIDTH or height > IMAGE_MAX_HEIGHT:
            scale = min(IMAGE_MAX_WIDTH / width, IMAGE_MAX_HEIGHT / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            processed = cv2.resize(processed, (new_width, new_height))

        # Save processed image
        processed_path = image_path.parent / f"{image_path.stem}_processed{image_path.suffix}"
        cv2.imwrite(str(processed_path), processed, [cv2.IMWRITE_JPEG_QUALITY, IMAGE_QUALITY])

        logger.info(f"Image preprocessed and saved to: {processed_path}")
        return str(processed_path)

    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        return None

def perform_ocr(image_path: Union[str, Path], use_paddle: bool = False) -> str:
    """
    Main OCR function that performs text extraction from receipt images

    Args:
        image_path: Path to the image file
        use_paddle: Whether to use PaddleOCR instead of Tesseract

    Returns:
        Extracted text as string
    """
    logger.info(f"Starting OCR on image: {image_path}")

    # Preprocess image
    processed_path = preprocess_image(image_path)
    if processed_path:
        ocr_image_path = processed_path
    else:
        logger.warning("Preprocessing failed, using original image")
        ocr_image_path = str(image_path)

    try:
        # Choose OCR engine
        if use_paddle and PADDLEOCR_AVAILABLE:
            ocr_engine = PaddleOCREngine()
        elif TESSERACT_AVAILABLE:
            ocr_engine = TesseractOCR()
        else:
            raise RuntimeError("No OCR engine available. Install pytesseract or paddleocr")

        # Initialize engine
        if not ocr_engine.initialize():
            raise RuntimeError(f"Failed to initialize {ocr_engine.engine_name}")

        # Extract text
        text = ocr_engine.extract_text(ocr_image_path)

        # Clean up processed image if it was created
        if processed_path and Path(processed_path).exists():
            Path(processed_path).unlink()

        logger.info(f"OCR completed successfully using {ocr_engine.engine_name}")
        return text

    except Exception as e:
        # Clean up processed image if it was created
        if processed_path and Path(processed_path).exists():
            Path(processed_path).unlink()

        logger.error(f"OCR failed: {e}")
        raise

# Global OCR function for easy access
def extract_text_from_image(image_path: Union[str, Path]) -> str:
    """
    Convenience function to extract text from image
    Tries Tesseract first, falls back to PaddleOCR if available
    """
    try:
        return perform_ocr(image_path, use_paddle=False)
    except Exception as e:
        logger.warning(f"Tesseract failed, trying PaddleOCR: {e}")
        try:
            return perform_ocr(image_path, use_paddle=True)
        except Exception as e2:
            logger.error(f"Both OCR engines failed: {e2}")
            raise RuntimeError("All OCR engines failed") from e2