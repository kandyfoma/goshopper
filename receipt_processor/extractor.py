"""
Receipt Extractor Module
Contains rule-based extraction logic for identifying shops and extracting receipt data
"""

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

from config import SHOP_TEMPLATES_FILE, MIN_ITEMS_THRESHOLD
from product_normalizer import product_normalizer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Shop identification rules
SHOP_RULES = {
    "ShopA": [
        "SHOP A INC",
        "Avenue 123",
        "SHOP A SUPERMARKET"
    ],
    "ShopB": [
        "GRAND MARCHÉ",
        "TEL: 243",
        "GRAND MARCHE",
        "GRAND MARKET"
    ],
    "ShopC": [
        "CARREFOUR",
        "CARREFOUR MARKET",
        "CARREFOUR EXPRESS"
    ],
    "ShopD": [
        "SHOPRITE",
        "SHOPRITE SUPERMARKET",
        "SHOPRITE STORES"
    ],
    "KinMart": [
        "KINMART",
        "KIN MART",
        "KINMART SUPERMARKET",
        "KINMART EXPRESS"
    ],
    "CongoMarket": [
        "CONGO MARKET",
        "CONGO MARCHÉ",
        "CONGO SUPERMARKET"
    ],
    "TotalEnergies": [
        "TOTAL ENERGIES",
        "TOTAL",
        "STATION TOTAL",
        "TOTAL STATION"
    ],
    "Engen": [
        "ENGEN",
        "ENGEN STATION",
        "ENGEN SERVICE STATION"
    ]
}

class ReceiptExtractor:
    """Main class for receipt extraction logic"""

    def __init__(self):
        self.shop_templates = {}
        self.load_shop_templates()

    def load_shop_templates(self) -> None:
        """Load shop templates from JSON file"""
        try:
            template_path = Path(__file__).parent / SHOP_TEMPLATES_FILE
            if template_path.exists():
                with open(template_path, 'r', encoding='utf-8') as f:
                    self.shop_templates = json.load(f)
                logger.info(f"Loaded {len(self.shop_templates)} shop templates")
            else:
                logger.warning(f"Shop templates file not found: {template_path}")
                self.shop_templates = {}
        except Exception as e:
            logger.error(f"Failed to load shop templates: {e}")
            self.shop_templates = {}

    def identify_shop(self, raw_text: str) -> str:
        """
        Identify the shop from raw OCR text using regex and keyword matching

        Args:
            raw_text: Raw text extracted from receipt image

        Returns:
            Shop ID (e.g., "ShopA", "ShopB") or "Unknown"
        """
        if not raw_text:
            return "Unknown"

        # Convert to uppercase for case-insensitive matching
        text_upper = raw_text.upper()

        # Check each shop's keywords
        for shop_id, keywords in SHOP_RULES.items():
            for keyword in keywords:
                # Use regex for flexible matching
                pattern = re.compile(r'\b' + re.escape(keyword.upper()) + r'\b')
                if pattern.search(text_upper):
                    logger.info(f"Shop identified as: {shop_id} (matched: {keyword})")
                    return shop_id

        # Additional pattern matching for common receipt formats
        # Look for phone numbers, addresses, or other identifying patterns
        phone_patterns = [
            r'TEL[:\s]*[\+]?243[\s\-\.]*\d{3}[\s\-\.]*\d{3}[\s\-\.]*\d{3}',
            r'PHONE[:\s]*[\+]?243[\s\-\.]*\d{3}[\s\-\.]*\d{3}[\s\-\.]*\d{3}',
            r'TÉL[:\s]*[\+]?243[\s\-\.]*\d{3}[\s\-\.]*\d{3}[\s\-\.]*\d{3}'
        ]

        for pattern in phone_patterns:
            if re.search(pattern, text_upper, re.IGNORECASE):
                # DRC phone number found - likely a local shop
                logger.info("DRC phone number detected - local shop")
                return "LocalShop"

        # Look for common Congolese city names
        congolese_cities = [
            "KINSHASA", "KINSHASA", "LUBUMBASHI", "KANANGA", "KISANGANI",
            "GOMA", "BUKAVU", "MBUJI-MAYI", "TSHIKAPA", "KOLWEZI"
        ]

        for city in congolese_cities:
            if city in text_upper:
                logger.info(f"Congolese city detected: {city} - local shop")
                return "LocalShop"

        logger.info("Shop could not be identified")
        return "Unknown"

    def extract_items_local(self, shop_id: str, raw_text: str) -> Dict[str, Any]:
        """
        Extract items from receipt text using shop-specific templates

        Args:
            shop_id: Identified shop ID
            raw_text: Raw OCR text

        Returns:
            Dictionary containing extracted data
        """
        if shop_id not in self.shop_templates:
            logger.warning(f"No template found for shop: {shop_id}")
            return self._extract_generic(raw_text)

        template = self.shop_templates[shop_id]
        logger.info(f"Using template for shop: {shop_id}")

        try:
            # Extract items using template regex patterns
            items = self._extract_items_with_template(raw_text, template)

            # Extract totals and other fields
            total = self._extract_total(raw_text, template)
            subtotal = self._extract_subtotal(raw_text, template)
            tax = self._extract_tax(raw_text, template)
            date = self._extract_date(raw_text, template)

            result = {
                "merchant": shop_id,
                "date": date,
                "items": items,
                "subtotal": subtotal,
                "tax": tax,
                "total": total,
                "currency": "CDF"  # Default to CDF, can be enhanced
            }

            return result

        except Exception as e:
            logger.error(f"Error extracting with template: {e}")
            return self._extract_generic(raw_text)

    def _extract_items_with_template(self, raw_text: str, template: Dict) -> List[Dict]:
        """Extract items using shop-specific regex patterns"""
        items = []

        # Get item pattern from template
        item_pattern = template.get("item_pattern")
        if not item_pattern:
            return items

        try:
            # Find all matches for items
            matches = re.findall(item_pattern, raw_text, re.MULTILINE | re.IGNORECASE)
            logger.info(f"Found {len(matches)} potential item matches")

            for match in matches:
                if isinstance(match, tuple):
                    # Multiple capture groups
                    if len(match) >= 3:
                        name = match[0].strip()
                        qty_str = match[1].strip()
                        price_str = match[2].strip()

                        try:
                            qty = float(qty_str) if qty_str else 1.0
                            price = self._parse_price(price_str)
                            total = qty * price

                            # Normalize the product name
                            normalized = product_normalizer.normalize(name)
                            
                            items.append({
                                "name": name,
                                "normalized_name": normalized.get("normalized_name", name.lower()),
                                "product_id": normalized.get("product_id"),
                                "category": normalized.get("category"),
                                "qty": qty,
                                "price": price,
                                "total": total,
                                "match_confidence": normalized.get("confidence", 0.0)
                            })
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Failed to parse item: {match} - {e}")
                            continue
                else:
                    # Single match - try to parse manually
                    logger.warning(f"Complex item pattern not implemented for: {match}")

        except Exception as e:
            logger.error(f"Error in item extraction: {e}")

        return items

    def _extract_total(self, raw_text: str, template: Dict) -> float:
        """Extract total amount"""
        total_pattern = template.get("total_pattern", r'TOTAL[:\s]*([0-9,\.]+)')
        match = re.search(total_pattern, raw_text, re.IGNORECASE)
        if match:
            return self._parse_price(match.group(1))
        return 0.0

    def _extract_subtotal(self, raw_text: str, template: Dict) -> Optional[float]:
        """Extract subtotal amount"""
        subtotal_pattern = template.get("subtotal_pattern", r'SUBTOTAL[:\s]*([0-9,\.]+)')
        match = re.search(subtotal_pattern, raw_text, re.IGNORECASE)
        if match:
            return self._parse_price(match.group(1))
        return None

    def _extract_tax(self, raw_text: str, template: Dict) -> Optional[float]:
        """Extract tax amount"""
        tax_pattern = template.get("tax_pattern", r'TAX[:\s]*([0-9,\.]+)')
        match = re.search(tax_pattern, raw_text, re.IGNORECASE)
        if match:
            return self._parse_price(match.group(1))
        return None

    def _extract_date(self, raw_text: str, template: Dict) -> Optional[str]:
        """Extract receipt date"""
        date_pattern = template.get("date_pattern", r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})')
        match = re.search(date_pattern, raw_text)
        if match:
            return match.group(1)
        return None

    def _parse_price(self, price_str: str) -> float:
        """Parse price string to float"""
        try:
            # Remove currency symbols and extra spaces
            cleaned = re.sub(r'[^\d,\.]', '', price_str)
            # Handle comma as decimal separator (European style)
            if ',' in cleaned and '.' in cleaned:
                # If both comma and dot, assume comma is decimal
                cleaned = cleaned.replace('.', '').replace(',', '.')
            elif ',' in cleaned:
                # Only comma, assume it's decimal separator
                cleaned = cleaned.replace(',', '.')
            # Remove any remaining commas (thousands separators)
            cleaned = cleaned.replace(',', '')
            return float(cleaned)
        except (ValueError, AttributeError):
            logger.warning(f"Could not parse price: {price_str}")
            return 0.0

    def _extract_generic(self, raw_text: str) -> Dict[str, Any]:
        """Fallback extraction when no template is available"""
        logger.info("Using generic extraction fallback")

        # Simple pattern matching for common receipt formats
        lines = raw_text.split('\n')
        items = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Look for lines that might be items (contain numbers and text)
            # Pattern: Item name followed by quantity and price
            item_match = re.match(r'^(.+?)\s+(\d+(?:\.\d+)?)?\s*[xX*]\s*([0-9,\.]+)$', line)
            if item_match:
                name = item_match.group(1).strip()
                qty = float(item_match.group(2)) if item_match.group(2) else 1.0
                price = self._parse_price(item_match.group(3))

                # Normalize the product name
                normalized = product_normalizer.normalize(name)

                items.append({
                    "name": name,
                    "normalized_name": normalized.get("normalized_name", name.lower()),
                    "product_id": normalized.get("product_id"),
                    "category": normalized.get("category"),
                    "qty": qty,
                    "price": price,
                    "total": qty * price,
                    "match_confidence": normalized.get("confidence", 0.0)
                })

        # Try to find total
        total = 0.0
        for line in lines:
            total_match = re.search(r'TOTAL[:\s]*([0-9,\.]+)', line, re.IGNORECASE)
            if total_match:
                total = self._parse_price(total_match.group(1))
                break

        return {
            "merchant": "Unknown",
            "date": None,
            "items": items,
            "subtotal": None,
            "tax": None,
            "total": total,
            "currency": "CDF"
        }

    def calculate_confidence_score(self, extracted_data: Dict) -> float:
        """
        Calculate confidence score for extracted data

        Args:
            extracted_data: The extracted receipt data

        Returns:
            Confidence score between 0.0 and 1.0
        """
        score = 0.0
        factors = 0

        # Factor 1: Shop identification
        if extracted_data.get("merchant") != "Unknown":
            score += 0.3
        factors += 0.3

        # Factor 2: Minimum items threshold
        items = extracted_data.get("items", [])
        if len(items) >= MIN_ITEMS_THRESHOLD:
            score += 0.3
        elif len(items) > 0:
            score += 0.15  # Partial credit for some items
        factors += 0.3

        # Factor 3: Total amount found
        if extracted_data.get("total", 0) > 0:
            score += 0.2
        factors += 0.2

        # Factor 4: Item details completeness
        if items:
            complete_items = sum(1 for item in items
                               if item.get("name") and item.get("price", 0) > 0)
            completeness_ratio = complete_items / len(items)
            score += 0.2 * completeness_ratio
        factors += 0.2

        # Normalize score
        confidence = score / factors if factors > 0 else 0.0

        logger.info(f"Confidence score: {confidence:.2f} (raw: {score:.2f}/{factors:.2f})")
        return confidence

# Global extractor instance
extractor = ReceiptExtractor()

def identify_shop(raw_text: str) -> str:
    """Convenience function for shop identification"""
    return extractor.identify_shop(raw_text)

def extract_items_local(shop_id: str, raw_text: str) -> Tuple[Dict[str, Any], float]:
    """
    Convenience function for local item extraction

    Returns:
        Tuple of (extracted_data, confidence_score)
    """
    data = extractor.extract_items_local(shop_id, raw_text)
    confidence = extractor.calculate_confidence_score(data)
    return data, confidence