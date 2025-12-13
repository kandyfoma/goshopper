"""
Machine Learning Module for Receipt Extraction
Implements learning from Gemini corrections to improve local extraction over time
"""

import json
import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import difflib

from config import SHOP_TEMPLATES_FILE

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReceiptLearner:
    """Machine learning system that learns from Gemini corrections"""

    def __init__(self):
        self.templates_file = Path(__file__).parent / SHOP_TEMPLATES_FILE
        self.learning_history = []
        self.min_learning_samples = 3  # Minimum samples before creating patterns
        self.load_learning_history()

    def load_learning_history(self) -> None:
        """Load previous learning history"""
        try:
            history_file = Path(__file__).parent / "learning_history.json"
            if history_file.exists():
                with open(history_file, 'r', encoding='utf-8') as f:
                    self.learning_history = json.load(f)
                logger.info(f"Loaded {len(self.learning_history)} learning samples")
        except Exception as e:
            logger.warning(f"Failed to load learning history: {e}")
            self.learning_history = []

    def save_learning_history(self) -> None:
        """Save learning history to disk"""
        try:
            history_file = Path(__file__).parent / "learning_history.json"
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(self.learning_history, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save learning history: {e}")

    def learn_from_gemini_correction(
        self,
        shop_id: str,
        raw_text: str,
        gemini_result: Dict[str, Any],
        local_confidence: float
    ) -> bool:
        """
        Learn from a successful Gemini correction

        Args:
            shop_id: Identified shop ID
            raw_text: Original OCR text
            gemini_result: Successful Gemini extraction result
            local_confidence: Confidence score of local extraction

        Returns:
            True if learning was successful
        """
        if local_confidence >= 0.8:
            # Don't learn if local extraction was already good
            return False

        if not gemini_result.get('success', False):
            return False

        # Create learning sample
        learning_sample = {
            'shop_id': shop_id,
            'raw_text': raw_text,
            'gemini_data': gemini_result,
            'local_confidence': local_confidence,
            'learned_at': str(Path(__file__).stat().st_mtime),  # Use file modification time as timestamp
            'text_patterns': self._extract_text_patterns(raw_text),
            'item_patterns': self._analyze_item_patterns(gemini_result.get('items', []))
        }

        # Add to history
        self.learning_history.append(learning_sample)

        # Try to generate new template if we have enough samples
        if self._should_generate_template(shop_id):
            success = self._generate_shop_template(shop_id)
            if success:
                logger.info(f"Successfully generated new template for shop: {shop_id}")
                self.save_learning_history()
                return True

        self.save_learning_history()
        return False

    def _extract_text_patterns(self, raw_text: str) -> Dict[str, Any]:
        """Extract structural patterns from raw text"""
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]

        patterns = {
            'total_lines': [],
            'item_lines': [],
            'header_lines': [],
            'footer_lines': []
        }

        for i, line in enumerate(lines):
            line_lower = line.lower()

            # Look for total patterns
            if any(keyword in line_lower for keyword in ['total', 'montant', 'somme', 'totaal']):
                patterns['total_lines'].append({
                    'line': line,
                    'position': i,
                    'ratio': i / len(lines) if lines else 0
                })

            # Look for item patterns (lines with numbers and text)
            if re.search(r'[a-zA-Z]{3,}.*\d', line):
                patterns['item_lines'].append({
                    'line': line,
                    'position': i,
                    'has_quantity': bool(re.search(r'\d+\s*[xX*]', line)),
                    'has_price': bool(re.search(r'\d+[,.]\d{2}', line))
                })

            # Header patterns (usually first few lines)
            if i < len(lines) * 0.3:
                patterns['header_lines'].append(line)

            # Footer patterns (usually last few lines)
            if i > len(lines) * 0.7:
                patterns['footer_lines'].append(line)

        return patterns

    def _analyze_item_patterns(self, items: List[Dict]) -> Dict[str, Any]:
        """Analyze patterns in extracted items"""
        if not items:
            return {}

        patterns = {
            'quantity_formats': [],
            'price_formats': [],
            'name_patterns': [],
            'separators': []
        }

        for item in items:
            name = item.get('name', '')
            qty = item.get('qty', 1)
            price = item.get('price', 0)

            # Analyze quantity formats
            if qty != 1:
                qty_str = str(qty)
                if qty_str not in patterns['quantity_formats']:
                    patterns['quantity_formats'].append(qty_str)

            # Analyze price formats
            if price > 0:
                price_str = f"{price:.2f}"
                if price_str not in patterns['price_formats']:
                    patterns['price_formats'].append(price_str)

            # Analyze name patterns
            if name:
                # Look for common separators
                separators = re.findall(r'[^\w\s]', name)
                for sep in separators:
                    if sep not in patterns['separators']:
                        patterns['separators'].append(sep)

        return patterns

    def _should_generate_template(self, shop_id: str) -> bool:
        """Check if we have enough samples to generate a template"""
        shop_samples = [s for s in self.learning_history if s['shop_id'] == shop_id]
        return len(shop_samples) >= self.min_learning_samples

    def _generate_shop_template(self, shop_id: str) -> bool:
        """Generate a new shop template from learning samples"""
        try:
            # Get all samples for this shop
            shop_samples = [s for s in self.learning_history if s['shop_id'] == shop_id]

            if len(shop_samples) < self.min_learning_samples:
                return False

            # Analyze patterns across samples
            template = self._synthesize_template_from_samples(shop_samples)

            if template:
                # Load existing templates
                existing_templates = {}
                if self.templates_file.exists():
                    with open(self.templates_file, 'r', encoding='utf-8') as f:
                        existing_templates = json.load(f)

                # Add or update template
                existing_templates[shop_id] = template

                # Save updated templates
                with open(self.templates_file, 'w', encoding='utf-8') as f:
                    json.dump(existing_templates, f, indent=2, ensure_ascii=False)

                logger.info(f"Generated new template for shop: {shop_id}")
                return True

        except Exception as e:
            logger.error(f"Failed to generate template for {shop_id}: {e}")

        return False

    def _synthesize_template_from_samples(self, samples: List[Dict]) -> Optional[Dict]:
        """Synthesize a template from multiple learning samples"""
        if not samples:
            return None

        try:
            # Analyze successful Gemini extractions
            gemini_results = [s['gemini_data'] for s in samples]

            # Find common patterns
            item_patterns = []
            total_patterns = []
            subtotal_patterns = []
            tax_patterns = []
            date_patterns = []

            for result in gemini_results:
                items = result.get('items', [])

                # Analyze item patterns
                for item in items[:3]:  # Analyze first few items
                    name = item.get('name', '')
                    if name:
                        # Create flexible regex pattern for this item
                        pattern = self._create_item_regex_pattern(name, item)
                        if pattern:
                            item_patterns.append(pattern)

                # Collect patterns from successful extractions
                if result.get('total'):
                    total_patterns.append(r'TOTAL[:\s]*([0-9,\\.]+)')
                    total_patterns.append(r'MONTANT[:\s]*([0-9,\\.]+)')
                    total_patterns.append(r'SOMME[:\s]*([0-9,\\.]+)')

                if result.get('subtotal'):
                    subtotal_patterns.append(r'SOUS.?TOTAL[:\s]*([0-9,\\.]+)')
                    subtotal_patterns.append(r'SUBTOTAL[:\s]*([0-9,\\.]+)')

                if result.get('tax'):
                    tax_patterns.append(r'TVA[:\s]*([0-9,\\.]+)')
                    tax_patterns.append(r'TAXE[:\s]*([0-9,\\.]+)')

                if result.get('date'):
                    date_patterns.append(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})')
                    date_patterns.append(r'(\d{2}/\d{2}/\d{4})')

            # Create template from most common patterns
            template = {
                'item_pattern': self._select_best_pattern(item_patterns) if item_patterns else None,
                'total_pattern': self._select_best_pattern(total_patterns) if total_patterns else r'TOTAL[:\s]*([0-9,\\.]+)',
                'subtotal_pattern': self._select_best_pattern(subtotal_patterns) if subtotal_patterns else None,
                'tax_pattern': self._select_best_pattern(tax_patterns) if tax_patterns else None,
                'date_pattern': self._select_best_pattern(date_patterns) if date_patterns else r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
                'currency': self._detect_currency_from_samples(gemini_results),
                'learned_from_samples': len(samples),
                'confidence_threshold': 0.7  # Lower threshold for learned templates
            }

            # Remove None values
            template = {k: v for k, v in template.items() if v is not None}

            return template

        except Exception as e:
            logger.error(f"Failed to synthesize template: {e}")
            return None

    def _create_item_regex_pattern(self, item_name: str, item_data: Dict) -> Optional[str]:
        """Create a regex pattern for item extraction based on successful parsing"""
        try:
            name = item_name.strip()
            qty = item_data.get('qty', 1)
            price = item_data.get('price', 0)

            # Escape special regex characters in name
            escaped_name = re.escape(name)

            # Create pattern based on structure
            if qty > 1:
                # Pattern: Name quantity x price
                pattern = f"{escaped_name}\\s+{qty}\\s*[xX*]\\s*{price:.2f}"
            else:
                # Pattern: Name price
                pattern = f"{escaped_name}\\s+{price:.2f}"

            # Make it more flexible
            pattern = pattern.replace(str(qty), r'(\d+(?:\.\d+)?)')
            pattern = pattern.replace(f"{price:.2f}", r'([0-9,\\.]+)')

            return f"({escaped_name}.*?)\\s+(\\d+(?:\\.\\d+)?)?\\s*[xX*]\\s*([0-9,\\.]+)"

        except Exception as e:
            logger.warning(f"Failed to create item pattern for {item_name}: {e}")
            return None

    def _select_best_pattern(self, patterns: List[str]) -> str:
        """Select the most common pattern"""
        if not patterns:
            return ""

        # Count occurrences
        pattern_counts = {}
        for pattern in patterns:
            pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1

        # Return most common
        return max(pattern_counts, key=pattern_counts.get)

    def _detect_currency_from_samples(self, samples: List[Dict]) -> str:
        """Detect currency from successful extractions"""
        currencies = []
        for sample in samples:
            currency = sample.get('currency', 'CDF')
            currencies.append(currency)

        # Return most common currency
        if currencies:
            return max(set(currencies), key=currencies.count)

        return 'CDF'

    def get_learning_stats(self) -> Dict[str, Any]:
        """Get statistics about the learning system"""
        stats = {
            'total_samples': len(self.learning_history),
            'shops_learned': len(set(s['shop_id'] for s in self.learning_history)),
            'average_local_confidence': 0.0,
            'learning_success_rate': 0.0
        }

        if self.learning_history:
            confidences = [s['local_confidence'] for s in self.learning_history]
            stats['average_local_confidence'] = sum(confidences) / len(confidences)

            # Calculate success rate (samples that led to template generation)
            successful_learnings = 0
            for sample in self.learning_history:
                shop_id = sample['shop_id']
                shop_samples = [s for s in self.learning_history if s['shop_id'] == shop_id]
                if len(shop_samples) >= self.min_learning_samples:
                    successful_learnings += 1

            stats['learning_success_rate'] = successful_learnings / len(self.learning_history)

        return stats

    def reset_learning(self) -> None:
        """Reset all learning data"""
        self.learning_history = []
        self.save_learning_history()
        logger.info("Learning data reset")

# Global learner instance
receipt_learner = ReceiptLearner()