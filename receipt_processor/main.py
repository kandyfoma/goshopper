"""
Main Orchestration Script for Hybrid Receipt Extraction Agent
Combines local OCR, rule-based extraction, and Gemini fallback
"""

import logging
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

from config import MIN_CONFIDENCE_THRESHOLD
from local_ocr import extract_text_from_image
from extractor import identify_shop, extract_items_local
from learning_engine import receipt_learner
from product_normalizer import product_normalizer

# Try to import Gemini API (will be implemented in Phase 3)
try:
    from gemini_api import extract_items_gemini
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("WARNING: Gemini API not available yet. Implement gemini_api.py for Phase 3")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ReceiptProcessor:
    """Main receipt processing orchestrator"""

    def __init__(self):
        self.processing_stats = {
            "total_processed": 0,
            "local_success": 0,
            "gemini_fallback": 0,
            "failed": 0
        }

    def process_receipt(self, image_path: str) -> Dict[str, Any]:
        """
        Main processing function implementing the hybrid logic:
        1. Local OCR → 2. Local Extractor → 3. Check Confidence

        Args:
            image_path: Path to receipt image file

        Returns:
            Extracted receipt data with metadata
        """
        start_time = time.time()
        self.processing_stats["total_processed"] += 1

        logger.info(f"Processing receipt: {image_path}")

        try:
            # Phase 1: Local OCR
            logger.info("Phase 1: Performing local OCR...")
            raw_text = extract_text_from_image(image_path)
            logger.info(f"OCR extracted {len(raw_text)} characters")

            if not raw_text.strip():
                raise ValueError("OCR failed to extract any text")

            # Phase 2: Local Extraction
            logger.info("Phase 2: Performing local extraction...")

            # Step 2.1: Identify shop
            shop_id = identify_shop(raw_text)
            logger.info(f"Identified shop: {shop_id}")

            # Step 2.2: Extract items locally
            extracted_data, confidence = extract_items_local(shop_id, raw_text)
            logger.info(f"Local extraction confidence: {confidence:.2f}")

            # Phase 3: Check Confidence & Conditional Fallback
            logger.info("Phase 3: Evaluating confidence and fallback...")

            final_data = extracted_data
            processing_method = "local"

            # Check if we need Gemini fallback
            needs_fallback = (
                confidence < MIN_CONFIDENCE_THRESHOLD or
                shop_id == "Unknown"
            )

            if needs_fallback and GEMINI_AVAILABLE:
                logger.info("Confidence below threshold, using Gemini fallback...")
                try:
                    gemini_data, gemini_confidence = extract_items_gemini(image_path, raw_text)
                    if gemini_data and gemini_data.get("success", False):
                        final_data = gemini_data
                        processing_method = "gemini"
                        confidence = gemini_confidence
                        self.processing_stats["gemini_fallback"] += 1

                        # 🔄 MACHINE LEARNING: Learn from Gemini correction
                        learning_success = receipt_learner.learn_from_gemini_correction(
                            shop_id, raw_text, gemini_data, confidence
                        )
                        if learning_success:
                            logger.info("✅ Successfully learned from Gemini correction!")

                        logger.info("Gemini fallback successful")
                    else:
                        logger.warning("Gemini fallback returned no valid data")
                except Exception as e:
                    logger.error(f"Gemini fallback failed: {e}")
                    # Continue with local extraction results
            elif needs_fallback and not GEMINI_AVAILABLE:
                logger.warning("Gemini not available but confidence is low")
                self.processing_stats["local_success"] += 1  # Still count as local success
            else:
                logger.info("Local extraction successful, no fallback needed")
                self.processing_stats["local_success"] += 1

            # Phase 4: Output Normalization
            logger.info("Phase 4: Normalizing output...")
            normalized_data = self._normalize_output(final_data, processing_method, confidence, raw_text)

            processing_time = time.time() - start_time
            logger.info(f"Receipt processing completed in {processing_time:.2f}s")

            return normalized_data

        except Exception as e:
            self.processing_stats["failed"] += 1
            logger.error(f"Receipt processing failed: {e}")

            # Return error result
            return {
                "success": False,
                "error": str(e),
                "processing_method": "failed",
                "confidence": 0.0,
                "processing_time": time.time() - start_time
            }

    def _normalize_output(self, data: Dict[str, Any], method: str, confidence: float, raw_text: str = "") -> Dict[str, Any]:
        """
        Normalize output to ensure consistent format

        Args:
            data: Raw extracted data
            method: Processing method used ("local" or "gemini")
            confidence: Confidence score
            raw_text: Raw OCR text for quality assessment

        Returns:
            Normalized receipt data
        """
        # Ensure all required fields are present
        normalized = {
            "success": True,
            "merchant": data.get("merchant", "Unknown"),
            "date": data.get("date"),
            "items": data.get("items", []),
            "subtotal": data.get("subtotal"),
            "tax": data.get("tax"),
            "total": data.get("total", 0.0),
            "currency": data.get("currency", "CDF"),
            "processing_method": method,
            "confidence": confidence,
            "rawText": raw_text,  # Include raw OCR text for validation
            "processing_time": None  # Will be set by caller
        }

        # Validate and clean items
        cleaned_items = []
        for item in normalized["items"]:
            if isinstance(item, dict):
                cleaned_item = {
                    "name": str(item.get("name", "")).strip(),
                    "qty": float(item.get("qty", 1.0)),
                    "price": float(item.get("price", 0.0)),
                    "total": float(item.get("total", 0.0))
                }
                # Recalculate total if not provided or inconsistent
                if cleaned_item["total"] == 0.0 or abs(cleaned_item["total"] - (cleaned_item["qty"] * cleaned_item["price"])) > 0.01:
                    cleaned_item["total"] = cleaned_item["qty"] * cleaned_item["price"]

                if cleaned_item["name"] and cleaned_item["price"] > 0:
                    cleaned_items.append(cleaned_item)

        normalized["items"] = cleaned_items

        # Validate totals
        if normalized["total"] == 0.0 and cleaned_items:
            # Calculate total from items if not provided
            normalized["total"] = sum(item["total"] for item in cleaned_items)

        return normalized

    def get_processing_stats(self) -> Dict[str, int]:
        """Get processing statistics"""
        return self.processing_stats.copy()

    def get_learning_stats(self) -> Dict[str, Any]:
        """Get machine learning statistics"""
        return receipt_learner.get_learning_stats()

    def reset_learning(self) -> None:
        """Reset machine learning data"""
        receipt_learner.reset_learning()
        logger.info("Machine learning data reset")

def process_receipt(image_path: str) -> Dict[str, Any]:
    """
    Convenience function for single receipt processing

    Args:
        image_path: Path to receipt image

    Returns:
        Processed receipt data
    """
    processor = ReceiptProcessor()
    return processor.process_receipt(image_path)

def batch_process_receipts(image_paths: list) -> list:
    """
    Process multiple receipts in batch

    Args:
        image_paths: List of paths to receipt images

    Returns:
        List of processed receipt data
    """
    processor = ReceiptProcessor()
    results = []

    for image_path in image_paths:
        try:
            result = processor.process_receipt(image_path)
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to process {image_path}: {e}")
            results.append({
                "success": False,
                "error": str(e),
                "image_path": image_path
            })

    return results

def deploy_to_mobile() -> None:
    """
    Placeholder function for mobile deployment
    Outlines the steps to bundle the receipt processing for mobile app
    """
    print("=== Mobile Deployment Plan ===")
    print("1. Bundle local_ocr.py and extractor.py as Python modules")
    print("2. Include shop_templates.json in app assets")
    print("3. Set up Python runtime in React Native (using python-for-android/Kivy)")
    print("4. Configure Gemini API calls through existing Firebase Functions")
    print("5. Test OCR accuracy on mobile device cameras")
    print("6. Implement offline processing for known shop templates")
    print("7. Add receipt image compression before processing")
    print("8. Set up error handling and fallback UI states")
    print()
    print("Note: This is a complex deployment requiring:")
    print("- Python runtime integration with React Native")
    print("- OCR library compilation for mobile platforms")
    print("- Optimized image processing for mobile hardware")
    print("- Offline template storage and sync")

if __name__ == "__main__":
    # Example usage
    import sys

    if len(sys.argv) < 2:
        print("Usage: python main.py <image_path>")
        print("Or run: python main.py --deploy-plan")
        print("Or run: python main.py --learning-stats")
        print("Or run: python main.py --reset-learning")
        sys.exit(1)

    if sys.argv[1] == "--deploy-plan":
        deploy_to_mobile()
        sys.exit(0)

    if sys.argv[1] == "--learning-stats":
        processor = ReceiptProcessor()
        stats = processor.get_learning_stats()
        print("\n=== Machine Learning Statistics ===")
        print(f"Total Learning Samples: {stats['total_samples']}")
        print(f"Shops Learned: {stats['shops_learned']}")
        print(f"Average Local Confidence: {stats['average_local_confidence']:.2f}")
        print(f"Learning Success Rate: {stats['learning_success_rate']:.2f}")
        sys.exit(0)

    if sys.argv[1] == "--reset-learning":
        processor = ReceiptProcessor()
        processor.reset_learning()
        print("Machine learning data has been reset.")
        sys.exit(0)

    image_path = sys.argv[1]
    if not Path(image_path).exists():
        print(f"Error: Image file not found: {image_path}")
        sys.exit(1)

    print(f"Processing receipt: {image_path}")
    result = process_receipt(image_path)

    print("\n=== Processing Result ===")
    print(f"Success: {result.get('success', False)}")
    print(f"Method: {result.get('processing_method', 'unknown')}")
    print(f"Confidence: {result.get('confidence', 0):.2f}")
    print(f"Merchant: {result.get('merchant', 'Unknown')}")
    print(f"Items: {len(result.get('items', []))}")
    print(f"Total: {result.get('total', 0):.2f} {result.get('currency', 'CDF')}")

    if result.get("error"):
        print(f"Error: {result['error']}")

    # Show sample items
    items = result.get('items', [])
    if items:
        print("\nSample Items:")
        for i, item in enumerate(items[:3]):  # Show first 3 items
            print(f"  {i+1}. {item['name']} - {item['qty']} x {item['price']} = {item['total']}")