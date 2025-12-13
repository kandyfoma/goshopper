"""
Gemini AI Integration Module for Receipt Extraction
Handles API communication with Google's Gemini AI for complex receipt processing
"""

import logging
import json
import time
from typing import Dict, List, Any, Optional, Tuple
import requests

from config import GEMINI_API_KEY, GOOGLE_CLOUD_PROJECT, GEMINI_MODEL, GEMINI_MAX_TOKENS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeminiAPIClient:
    """Client for interacting with Google's Gemini AI API"""

    def __init__(self):
        self.api_key = GEMINI_API_KEY
        self.project_id = GOOGLE_CLOUD_PROJECT
        self.model = GEMINI_MODEL or "gemini-1.5-flash"
        self.max_tokens = GEMINI_MAX_TOKENS or 2048
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

        # Rate limiting
        self.last_request_time = 0
        self.min_request_interval = 1.0  # Minimum 1 second between requests

        # Validate configuration
        self._validate_config()

    def _validate_config(self) -> None:
        """Validate API configuration"""
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not set. Gemini API will not be available.")
            logger.warning("Set GEMINI_API_KEY environment variable to enable AI fallback.")
        if not self.project_id:
            logger.warning("GOOGLE_CLOUD_PROJECT not set. Some features may not work.")

    def _rate_limit_wait(self) -> None:
        """Implement rate limiting"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time

        if time_since_last < self.min_request_interval:
            wait_time = self.min_request_interval - time_since_last
            logger.debug(f"Rate limiting: waiting {wait_time:.2f} seconds")
            time.sleep(wait_time)

        self.last_request_time = time.time()

    def _make_request(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make a request to the Gemini API

        Args:
            endpoint: API endpoint
            payload: Request payload

        Returns:
            API response as dictionary

        Raises:
            Exception: If API request fails
        """
        self._rate_limit_wait()

        url = f"{self.base_url}/{endpoint}?key={self.api_key}"

        headers = {
            "Content-Type": "application/json",
        }

        try:
            logger.info(f"Making Gemini API request to {endpoint}")
            response = requests.post(url, headers=headers, json=payload, timeout=30)

            if response.status_code == 200:
                return response.json()
            else:
                error_msg = f"Gemini API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)

        except requests.exceptions.RequestException as e:
            error_msg = f"Network error calling Gemini API: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def extract_receipt_data(self, image_path: str, ocr_text: str) -> Dict[str, Any]:
        """
        Extract receipt data using Gemini AI

        Args:
            image_path: Path to receipt image
            ocr_text: Pre-extracted OCR text

        Returns:
            Extracted receipt data
        """
        # Read image as base64
        import base64

        try:
            with open(image_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            raise Exception(f"Failed to read image file: {str(e)}")

        # Create prompt for receipt extraction
        prompt = self._create_extraction_prompt(ocr_text)

        # Prepare request payload
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_data
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "topK": 1,
                "topP": 1,
                "maxOutputTokens": self.max_tokens,
                "stopSequences": []
            },
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        }

        # Make API request
        endpoint = f"models/{self.model}:generateContent"
        response = self._make_request(endpoint, payload)

        # Parse response
        return self._parse_gemini_response(response)

    def _create_extraction_prompt(self, ocr_text: str) -> str:
        """
        Create the extraction prompt for Gemini

        Args:
            ocr_text: Pre-extracted OCR text

        Returns:
            Formatted prompt string
        """
        return f"""You are an expert receipt analysis AI. Extract structured data from this receipt image and OCR text.

OCR TEXT:
{ocr_text}

INSTRUCTIONS:
1. Extract all items with their names, prices, and quantities
2. Identify the merchant/store name
3. Find the total amount
4. Extract date and time if available
5. Identify currency (CDF, USD, etc.)

Return the data in this exact JSON format:
{{
    "merchant": "Store Name",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "currency": "CDF",
    "items": [
        {{
            "name": "Item name",
            "price": 123.45,
            "quantity": 1
        }}
    ],
    "subtotal": 123.45,
    "tax": 12.34,
    "total": 135.79,
    "success": true
}}

IMPORTANT:
- Be precise with numbers and item names
- If uncertain about any field, use null or empty values
- Ensure prices are numeric (not strings)
- Quantities should be integers
- Return valid JSON only"""

    def _parse_gemini_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse Gemini API response into structured receipt data

        Args:
            response: Raw API response

        Returns:
            Structured receipt data
        """
        try:
            # Extract text from response
            if 'candidates' in response and len(response['candidates']) > 0:
                candidate = response['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    text_content = candidate['content']['parts'][0]['text']

                    # Try to parse JSON from response
                    # Remove markdown code blocks if present
                    text_content = text_content.strip()
                    if text_content.startswith('```json'):
                        text_content = text_content[7:]
                    if text_content.endswith('```'):
                        text_content = text_content[:-3]
                    text_content = text_content.strip()

                    # Parse JSON
                    extracted_data = json.loads(text_content)

                    # Validate and normalize the data
                    return self._normalize_extracted_data(extracted_data)
                else:
                    raise Exception("No content parts in Gemini response")
            else:
                raise Exception("No candidates in Gemini response")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {text_content}")
            raise Exception(f"Invalid JSON response from Gemini: {str(e)}")
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {str(e)}")
            raise Exception(f"Failed to parse Gemini response: {str(e)}")

    def _normalize_extracted_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize and validate extracted receipt data

        Args:
            data: Raw extracted data from Gemini

        Returns:
            Normalized receipt data
        """
        normalized = {
            "success": data.get("success", True),
            "merchant": data.get("merchant", "").strip(),
            "date": data.get("date"),
            "time": data.get("time"),
            "currency": data.get("currency", "CDF"),
            "items": [],
            "subtotal": data.get("subtotal"),
            "tax": data.get("tax"),
            "total": data.get("total"),
            "confidence": 0.9  # High confidence for AI extraction
        }

        # Normalize items
        if "items" in data and isinstance(data["items"], list):
            for item in data["items"]:
                if isinstance(item, dict):
                    normalized_item = {
                        "name": item.get("name", "").strip(),
                        "price": float(item.get("price", 0)) if item.get("price") else 0.0,
                        "quantity": int(item.get("quantity", 1)) if item.get("quantity") else 1
                    }
                    if normalized_item["name"] and normalized_item["price"] > 0:
                        normalized["items"].append(normalized_item)

        # Ensure we have a total
        if not normalized["total"] and normalized["items"]:
            normalized["total"] = sum(item["price"] * item["quantity"] for item in normalized["items"])

        return normalized

# Global Gemini client instance (only created if API key is available)
gemini_client = None
try:
    gemini_client = GeminiAPIClient()
    GEMINI_AVAILABLE = True
except Exception as e:
    logger.warning(f"Failed to initialize Gemini client: {e}")
    GEMINI_AVAILABLE = False

def extract_items_gemini(image_path: str, ocr_text: str) -> Tuple[Dict[str, Any], float]:
    """
    Extract receipt items using Gemini AI

    Args:
        image_path: Path to receipt image
        ocr_text: Pre-extracted OCR text

    Returns:
        Tuple of (extracted_data, confidence_score)
    """
    if not gemini_client or not GEMINI_AVAILABLE:
        logger.warning("Gemini API not available - check API key configuration")
        return {
            "success": False,
            "error": "Gemini API not configured",
            "items": [],
            "total": 0,
            "merchant": "Unknown"
        }, 0.0

    try:
        result = gemini_client.extract_receipt_data(image_path, ocr_text)
        confidence = result.get("confidence", 0.9)
        return result, confidence
    except Exception as e:
        logger.error(f"Gemini extraction failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "items": [],
            "total": 0,
            "merchant": "Unknown"
        }, 0.0