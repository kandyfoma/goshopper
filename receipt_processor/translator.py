"""
Translation Module for Product Normalization
Handles French/English translation for product matching
"""

import logging
from typing import Dict, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# Translation Dictionary (French to English)
# ============================================================================

# This is a lightweight translation dictionary for common food items
# For production, you could integrate with Google Translate API or similar
FRENCH_TO_ENGLISH = {
    # Fruits
    "banane": "banana",
    "banane plantain": "plantain",
    "plantain": "plantain",
    "orange": "orange",
    "pomme": "apple",
    "mangue": "mango",
    "ananas": "pineapple",
    "papaye": "papaya",
    "avocat": "avocado",
    "citron": "lemon",
    "pastèque": "watermelon",
    "melon d'eau": "watermelon",
    "raisin": "grape",
    "poire": "pear",
    "pêche": "peach",
    "abricot": "apricot",
    "prune": "plum",
    "fraise": "strawberry",
    "framboise": "raspberry",
    "myrtille": "blueberry",
    
    # Vegetables
    "tomate": "tomato",
    "oignon": "onion",
    "ail": "garlic",
    "carotte": "carrot",
    "pomme de terre": "potato",
    "patate": "potato",
    "manioc": "cassava",
    "kwanga": "cassava",
    "chou": "cabbage",
    "épinard": "spinach",
    "poivre": "pepper",
    "piment": "chili",
    "poivron": "bell pepper",
    "aubergine": "eggplant",
    "gombo": "okra",
    "laitue": "lettuce",
    "concombre": "cucumber",
    "courgette": "zucchini",
    "haricot vert": "green bean",
    "petit pois": "pea",
    "maïs": "corn",
    
    # Proteins
    "poulet": "chicken",
    "boeuf": "beef",
    "viande": "meat",
    "viande de boeuf": "beef",
    "chèvre": "goat",
    "viande de chèvre": "goat meat",
    "porc": "pork",
    "agneau": "lamb",
    "mouton": "mutton",
    "poisson": "fish",
    "oeuf": "egg",
    "tilapia": "tilapia",
    "sardine": "sardine",
    "thon": "tuna",
    "saumon": "salmon",
    "crevette": "shrimp",
    "crabe": "crab",
    
    # Dairy
    "lait": "milk",
    "beurre": "butter",
    "fromage": "cheese",
    "yaourt": "yogurt",
    "yogourt": "yogurt",
    "crème": "cream",
    
    # Grains & Staples
    "riz": "rice",
    "farine": "flour",
    "pain": "bread",
    "pâtes": "pasta",
    "spaghetti": "spaghetti",
    "macaroni": "macaroni",
    "haricots": "beans",
    "haricot": "bean",
    "lentille": "lentil",
    "arachide": "peanut",
    "cacahuète": "peanut",
    "noix": "nut",
    
    # Oils & Condiments
    "huile": "oil",
    "huile de palme": "palm oil",
    "huile rouge": "red oil",
    "huile végétale": "vegetable oil",
    "sel": "salt",
    "sucre": "sugar",
    "miel": "honey",
    "vinaigre": "vinegar",
    "concentré de tomate": "tomato paste",
    "pâte de tomate": "tomato paste",
    "mayonnaise": "mayonnaise",
    "ketchup": "ketchup",
    "moutarde": "mustard",
    "sauce": "sauce",
    "épice": "spice",
    "cube maggi": "bouillon cube",
    "bouillon": "bouillon",
    
    # Beverages
    "eau": "water",
    "eau minérale": "mineral water",
    "soda": "soda",
    "boisson": "drink",
    "boisson gazeuse": "soda",
    "jus": "juice",
    "jus de fruit": "fruit juice",
    "bière": "beer",
    "vin": "wine",
    "café": "coffee",
    "thé": "tea",
    "lait concentré": "condensed milk",
    
    # Hygiene & Household
    "savon": "soap",
    "détergent": "detergent",
    "lessive": "laundry detergent",
    "dentifrice": "toothpaste",
    "brosse à dents": "toothbrush",
    "papier toilette": "toilet paper",
    "papier hygiénique": "toilet paper",
    "couche": "diaper",
    "shampooing": "shampoo",
    "après-shampooing": "conditioner",
    "lotion": "lotion",
    "crème": "cream",
    
    # Units & Quantities
    "kilogramme": "kilogram",
    "kilo": "kilogram",
    "gramme": "gram",
    "litre": "liter",
    "morceau": "piece",
    "paquet": "pack",
    "sachet": "sachet",
    "boîte": "box",
    "bouteille": "bottle",
    "sac": "bag",
    
    # Common adjectives
    "frais": "fresh",
    "fraîche": "fresh",
    "sec": "dry",
    "sèche": "dry",
    "entier": "whole",
    "entière": "whole",
    "moulu": "ground",
    "coupé": "cut",
    "congelé": "frozen",
    "en conserve": "canned",
}

# English to French (reverse mapping)
ENGLISH_TO_FRENCH = {v: k for k, v in FRENCH_TO_ENGLISH.items()}


class Translator:
    """
    Simple translation class for French/English product names.
    
    This uses a pre-built dictionary for common food items.
    For production, you could integrate with:
    - Google Cloud Translation API
    - DeepL API
    - Or a lightweight ML model like MarianMT
    """
    
    def __init__(self):
        self.fr_to_en = FRENCH_TO_ENGLISH
        self.en_to_fr = ENGLISH_TO_FRENCH
        logger.info(f"Translator initialized with {len(self.fr_to_en)} French-English mappings")
    
    def translate_to_english(self, text: str) -> str:
        """
        Translate French text to English.
        
        Args:
            text: Input text in French
            
        Returns:
            Translated text in English (or original if no translation found)
        """
        if not text:
            return ""
        
        # Convert to lowercase for matching
        text_lower = text.lower().strip()
        
        # Try exact match first
        if text_lower in self.fr_to_en:
            return self.fr_to_en[text_lower]
        
        # Try word-by-word translation
        words = text_lower.split()
        translated_words = []
        
        i = 0
        while i < len(words):
            # Try multi-word phrases (2-4 words)
            translated = False
            for n in range(4, 0, -1):
                if i + n <= len(words):
                    phrase = ' '.join(words[i:i+n])
                    if phrase in self.fr_to_en:
                        translated_words.append(self.fr_to_en[phrase])
                        i += n
                        translated = True
                        break
            
            if not translated:
                # Keep original word
                translated_words.append(words[i])
                i += 1
        
        return ' '.join(translated_words)
    
    def translate_to_french(self, text: str) -> str:
        """
        Translate English text to French.
        
        Args:
            text: Input text in English
            
        Returns:
            Translated text in French (or original if no translation found)
        """
        if not text:
            return ""
        
        text_lower = text.lower().strip()
        
        # Try exact match
        if text_lower in self.en_to_fr:
            return self.en_to_fr[text_lower]
        
        # Try word-by-word translation
        words = text_lower.split()
        translated_words = []
        
        i = 0
        while i < len(words):
            translated = False
            for n in range(4, 0, -1):
                if i + n <= len(words):
                    phrase = ' '.join(words[i:i+n])
                    if phrase in self.en_to_fr:
                        translated_words.append(self.en_to_fr[phrase])
                        i += n
                        translated = True
                        break
            
            if not translated:
                translated_words.append(words[i])
                i += 1
        
        return ' '.join(translated_words)
    
    def detect_language(self, text: str) -> str:
        """
        Simple language detection based on dictionary lookup.
        
        Args:
            text: Input text
            
        Returns:
            'fr', 'en', or 'unknown'
        """
        if not text:
            return 'unknown'
        
        text_lower = text.lower().strip()
        words = text_lower.split()
        
        fr_count = 0
        en_count = 0
        
        for word in words:
            if word in self.fr_to_en:
                fr_count += 1
            if word in self.en_to_fr:
                en_count += 1
        
        if fr_count > en_count:
            return 'fr'
        elif en_count > fr_count:
            return 'en'
        else:
            return 'unknown'
    
    def normalize_to_pivot(self, text: str, pivot_language: str = 'en') -> str:
        """
        Normalize text to a pivot language (default: English).
        This ensures consistent matching regardless of input language.
        
        Args:
            text: Input text in any language
            pivot_language: Target pivot language ('en' or 'fr')
            
        Returns:
            Text normalized to pivot language
        """
        if not text:
            return ""
        
        detected_lang = self.detect_language(text)
        
        if pivot_language == 'en':
            if detected_lang == 'fr':
                return self.translate_to_english(text)
            else:
                return text.lower()
        elif pivot_language == 'fr':
            if detected_lang == 'en':
                return self.translate_to_french(text)
            else:
                return text.lower()
        else:
            return text.lower()
    
    def add_translation(self, french: str, english: str) -> None:
        """
        Add a new translation pair to the dictionary.
        
        Args:
            french: French term
            english: English term
        """
        self.fr_to_en[french.lower()] = english.lower()
        self.en_to_fr[english.lower()] = french.lower()
        logger.info(f"Added translation: {french} <-> {english}")
    
    def get_all_variants(self, text: str) -> list[str]:
        """
        Get all language variants of a text.
        
        Args:
            text: Input text
            
        Returns:
            List of variants (original, French, English)
        """
        variants = [text.lower()]
        
        # Add English variant
        en_variant = self.translate_to_english(text)
        if en_variant != text.lower():
            variants.append(en_variant)
        
        # Add French variant
        fr_variant = self.translate_to_french(text)
        if fr_variant != text.lower():
            variants.append(fr_variant)
        
        return list(set(variants))  # Remove duplicates


# ============================================================================
# Global Instance
# ============================================================================

translator = Translator()


# ============================================================================
# Utility Functions
# ============================================================================

def translate_fr_to_en(text: str) -> str:
    """Quick function to translate French to English"""
    return translator.translate_to_english(text)


def translate_en_to_fr(text: str) -> str:
    """Quick function to translate English to French"""
    return translator.translate_to_french(text)


def detect_language(text: str) -> str:
    """Quick function to detect language"""
    return translator.detect_language(text)


# ============================================================================
# Main Entry Point (for testing)
# ============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print("Translation Module Test")
    print("=" * 80)
    
    test_cases = [
        # French to English
        ("Banane plantain", "fr->en"),
        ("Pomme de terre", "fr->en"),
        ("Huile végétale", "fr->en"),
        ("Poulet entier", "fr->en"),
        ("Eau minérale", "fr->en"),
        
        # English to French
        ("Plantain", "en->fr"),
        ("Potato", "en->fr"),
        ("Vegetable oil", "en->fr"),
        ("Chicken", "en->fr"),
        ("Mineral water", "en->fr"),
        
        # Detection
        ("Tomate", "detect"),
        ("Tomato", "detect"),
        ("BNN PLTN", "detect"),
    ]
    
    for text, test_type in test_cases:
        if test_type == "fr->en":
            result = translator.translate_to_english(text)
            print(f"\nFR→EN: '{text}' → '{result}'")
        elif test_type == "en->fr":
            result = translator.translate_to_french(text)
            print(f"\nEN→FR: '{text}' → '{result}'")
        elif test_type == "detect":
            lang = translator.detect_language(text)
            variants = translator.get_all_variants(text)
            print(f"\nDetect: '{text}' → Language: {lang}")
            print(f"  Variants: {variants}")
    
    print("\n" + "=" * 80)
    print("Translation module is ready for integration!")
    print("=" * 80)
