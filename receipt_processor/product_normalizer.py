"""
Product Normalizer Module
Handles product name matching, normalization, and entity resolution
for the GoShopperAI receipt processing system.

This module implements a multi-layered approach to handle:
- Product name variations across shops
- Multilingual matching (French/English)
- Abbreviations and local naming conventions
- Semantic similarity matching
"""

import json
import logging
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from difflib import SequenceMatcher

# Import translation module
try:
    from translator import translator
    TRANSLATION_AVAILABLE = True
except ImportError:
    TRANSLATION_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Translation module not available. Install translator.py for multilingual support.")

# Import embeddings module
try:
    from embeddings import SemanticMatcher
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Embeddings module not available. Install embeddings.py for semantic matching.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# PHASE 1: Core Database Schema and Structures
# ============================================================================

# Master product database schema (Golden Record)
MASTER_PRODUCTS_FILE = "master_products.json"
PRODUCT_MAPPINGS_FILE = "product_mappings.json"

# Default master products structure
DEFAULT_MASTER_PRODUCTS = {
    "products": [
        # Fruits
        {"product_id": "PROD_001", "normalized_name": "plantain", "category": "Fruits", "unit_of_measure": "kg", "aliases_fr": ["banane plantain", "plantain mûr"], "aliases_en": ["plantain", "plantain banana", "cooking banana"]},
        {"product_id": "PROD_002", "normalized_name": "banana", "category": "Fruits", "unit_of_measure": "kg", "aliases_fr": ["banane", "banane douce"], "aliases_en": ["banana", "sweet banana"]},
        {"product_id": "PROD_003", "normalized_name": "orange", "category": "Fruits", "unit_of_measure": "kg", "aliases_fr": ["orange", "oranges"], "aliases_en": ["orange", "oranges"]},
        {"product_id": "PROD_004", "normalized_name": "apple", "category": "Fruits", "unit_of_measure": "kg", "aliases_fr": ["pomme", "pommes"], "aliases_en": ["apple", "apples"]},
        {"product_id": "PROD_005", "normalized_name": "mango", "category": "Fruits", "unit_of_measure": "kg", "aliases_fr": ["mangue", "mangues"], "aliases_en": ["mango", "mangoes"]},
        {"product_id": "PROD_006", "normalized_name": "pineapple", "category": "Fruits", "unit_of_measure": "piece", "aliases_fr": ["ananas"], "aliases_en": ["pineapple"]},
        {"product_id": "PROD_007", "normalized_name": "papaya", "category": "Fruits", "unit_of_measure": "kg", "aliases_fr": ["papaye", "pawpaw"], "aliases_en": ["papaya", "pawpaw"]},
        {"product_id": "PROD_008", "normalized_name": "avocado", "category": "Fruits", "unit_of_measure": "piece", "aliases_fr": ["avocat", "avocats"], "aliases_en": ["avocado", "avocados"]},
        {"product_id": "PROD_009", "normalized_name": "lemon", "category": "Fruits", "unit_of_measure": "kg", "aliases_fr": ["citron", "citrons"], "aliases_en": ["lemon", "lemons"]},
        {"product_id": "PROD_010", "normalized_name": "watermelon", "category": "Fruits", "unit_of_measure": "piece", "aliases_fr": ["pastèque", "melon d'eau"], "aliases_en": ["watermelon"]},
        
        # Vegetables
        {"product_id": "PROD_020", "normalized_name": "tomato", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["tomate", "tomates"], "aliases_en": ["tomato", "tomatoes"]},
        {"product_id": "PROD_021", "normalized_name": "onion", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["oignon", "oignons"], "aliases_en": ["onion", "onions"]},
        {"product_id": "PROD_022", "normalized_name": "garlic", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["ail"], "aliases_en": ["garlic"]},
        {"product_id": "PROD_023", "normalized_name": "carrot", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["carotte", "carottes"], "aliases_en": ["carrot", "carrots"]},
        {"product_id": "PROD_024", "normalized_name": "potato", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["pomme de terre", "patate"], "aliases_en": ["potato", "potatoes"]},
        {"product_id": "PROD_025", "normalized_name": "cassava", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["manioc", "kwanga"], "aliases_en": ["cassava", "manioc"]},
        {"product_id": "PROD_026", "normalized_name": "cabbage", "category": "Vegetables", "unit_of_measure": "piece", "aliases_fr": ["chou", "choux"], "aliases_en": ["cabbage"]},
        {"product_id": "PROD_027", "normalized_name": "spinach", "category": "Vegetables", "unit_of_measure": "bunch", "aliases_fr": ["épinard", "épinards"], "aliases_en": ["spinach"]},
        {"product_id": "PROD_028", "normalized_name": "pepper", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["poivre", "piment", "poivron"], "aliases_en": ["pepper", "bell pepper", "chili"]},
        {"product_id": "PROD_029", "normalized_name": "eggplant", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["aubergine", "aubergines"], "aliases_en": ["eggplant", "aubergine"]},
        {"product_id": "PROD_030", "normalized_name": "okra", "category": "Vegetables", "unit_of_measure": "kg", "aliases_fr": ["gombo", "gombos"], "aliases_en": ["okra", "lady finger"]},
        
        # Proteins
        {"product_id": "PROD_040", "normalized_name": "chicken", "category": "Proteins", "unit_of_measure": "kg", "aliases_fr": ["poulet", "poulets"], "aliases_en": ["chicken"]},
        {"product_id": "PROD_041", "normalized_name": "beef", "category": "Proteins", "unit_of_measure": "kg", "aliases_fr": ["boeuf", "viande de boeuf"], "aliases_en": ["beef"]},
        {"product_id": "PROD_042", "normalized_name": "goat", "category": "Proteins", "unit_of_measure": "kg", "aliases_fr": ["chèvre", "viande de chèvre"], "aliases_en": ["goat", "goat meat"]},
        {"product_id": "PROD_043", "normalized_name": "fish", "category": "Proteins", "unit_of_measure": "kg", "aliases_fr": ["poisson", "poissons"], "aliases_en": ["fish"]},
        {"product_id": "PROD_044", "normalized_name": "egg", "category": "Proteins", "unit_of_measure": "piece", "aliases_fr": ["oeuf", "oeufs"], "aliases_en": ["egg", "eggs"]},
        {"product_id": "PROD_045", "normalized_name": "tilapia", "category": "Proteins", "unit_of_measure": "kg", "aliases_fr": ["tilapia"], "aliases_en": ["tilapia"]},
        {"product_id": "PROD_046", "normalized_name": "sardine", "category": "Proteins", "unit_of_measure": "can", "aliases_fr": ["sardine", "sardines"], "aliases_en": ["sardine", "sardines"]},
        
        # Dairy
        {"product_id": "PROD_050", "normalized_name": "milk", "category": "Dairy", "unit_of_measure": "L", "aliases_fr": ["lait"], "aliases_en": ["milk"]},
        {"product_id": "PROD_051", "normalized_name": "butter", "category": "Dairy", "unit_of_measure": "g", "aliases_fr": ["beurre"], "aliases_en": ["butter"]},
        {"product_id": "PROD_052", "normalized_name": "cheese", "category": "Dairy", "unit_of_measure": "g", "aliases_fr": ["fromage"], "aliases_en": ["cheese"]},
        {"product_id": "PROD_053", "normalized_name": "yogurt", "category": "Dairy", "unit_of_measure": "piece", "aliases_fr": ["yaourt", "yogourt"], "aliases_en": ["yogurt", "yoghurt"]},
        
        # Grains & Staples
        {"product_id": "PROD_060", "normalized_name": "rice", "category": "Grains", "unit_of_measure": "kg", "aliases_fr": ["riz"], "aliases_en": ["rice"]},
        {"product_id": "PROD_061", "normalized_name": "flour", "category": "Grains", "unit_of_measure": "kg", "aliases_fr": ["farine"], "aliases_en": ["flour"]},
        {"product_id": "PROD_062", "normalized_name": "bread", "category": "Grains", "unit_of_measure": "piece", "aliases_fr": ["pain"], "aliases_en": ["bread"]},
        {"product_id": "PROD_063", "normalized_name": "pasta", "category": "Grains", "unit_of_measure": "kg", "aliases_fr": ["pâtes", "spaghetti", "macaroni"], "aliases_en": ["pasta", "spaghetti", "macaroni"]},
        {"product_id": "PROD_064", "normalized_name": "corn", "category": "Grains", "unit_of_measure": "kg", "aliases_fr": ["maïs"], "aliases_en": ["corn", "maize"]},
        {"product_id": "PROD_065", "normalized_name": "beans", "category": "Grains", "unit_of_measure": "kg", "aliases_fr": ["haricots", "haricot"], "aliases_en": ["beans", "kidney beans"]},
        {"product_id": "PROD_066", "normalized_name": "peanuts", "category": "Grains", "unit_of_measure": "kg", "aliases_fr": ["arachides", "cacahuètes"], "aliases_en": ["peanuts", "groundnuts"]},
        
        # Oils & Condiments
        {"product_id": "PROD_070", "normalized_name": "palm_oil", "category": "Oils", "unit_of_measure": "L", "aliases_fr": ["huile de palme", "huile rouge"], "aliases_en": ["palm oil", "red oil"]},
        {"product_id": "PROD_071", "normalized_name": "vegetable_oil", "category": "Oils", "unit_of_measure": "L", "aliases_fr": ["huile végétale", "huile"], "aliases_en": ["vegetable oil", "cooking oil"]},
        {"product_id": "PROD_072", "normalized_name": "salt", "category": "Condiments", "unit_of_measure": "kg", "aliases_fr": ["sel"], "aliases_en": ["salt"]},
        {"product_id": "PROD_073", "normalized_name": "sugar", "category": "Condiments", "unit_of_measure": "kg", "aliases_fr": ["sucre"], "aliases_en": ["sugar"]},
        {"product_id": "PROD_074", "normalized_name": "tomato_paste", "category": "Condiments", "unit_of_measure": "can", "aliases_fr": ["concentré de tomate", "pâte de tomate"], "aliases_en": ["tomato paste", "tomato puree"]},
        {"product_id": "PROD_075", "normalized_name": "mayonnaise", "category": "Condiments", "unit_of_measure": "piece", "aliases_fr": ["mayonnaise", "mayo"], "aliases_en": ["mayonnaise", "mayo"]},
        {"product_id": "PROD_076", "normalized_name": "maggi", "category": "Condiments", "unit_of_measure": "piece", "aliases_fr": ["maggi", "cube maggi"], "aliases_en": ["maggi", "bouillon cube"]},
        
        # Beverages
        {"product_id": "PROD_080", "normalized_name": "water", "category": "Beverages", "unit_of_measure": "L", "aliases_fr": ["eau", "eau minérale"], "aliases_en": ["water", "mineral water"]},
        {"product_id": "PROD_081", "normalized_name": "soda", "category": "Beverages", "unit_of_measure": "L", "aliases_fr": ["soda", "boisson gazeuse"], "aliases_en": ["soda", "soft drink"]},
        {"product_id": "PROD_082", "normalized_name": "juice", "category": "Beverages", "unit_of_measure": "L", "aliases_fr": ["jus", "jus de fruit"], "aliases_en": ["juice", "fruit juice"]},
        {"product_id": "PROD_083", "normalized_name": "beer", "category": "Beverages", "unit_of_measure": "piece", "aliases_fr": ["bière", "primus", "skol"], "aliases_en": ["beer"]},
        {"product_id": "PROD_084", "normalized_name": "coffee", "category": "Beverages", "unit_of_measure": "g", "aliases_fr": ["café"], "aliases_en": ["coffee"]},
        {"product_id": "PROD_085", "normalized_name": "tea", "category": "Beverages", "unit_of_measure": "g", "aliases_fr": ["thé"], "aliases_en": ["tea"]},
        
        # Hygiene & Household
        {"product_id": "PROD_090", "normalized_name": "soap", "category": "Hygiene", "unit_of_measure": "piece", "aliases_fr": ["savon"], "aliases_en": ["soap"]},
        {"product_id": "PROD_091", "normalized_name": "detergent", "category": "Hygiene", "unit_of_measure": "kg", "aliases_fr": ["détergent", "omo", "ariel"], "aliases_en": ["detergent", "washing powder"]},
        {"product_id": "PROD_092", "normalized_name": "toothpaste", "category": "Hygiene", "unit_of_measure": "piece", "aliases_fr": ["dentifrice"], "aliases_en": ["toothpaste"]},
        {"product_id": "PROD_093", "normalized_name": "toilet_paper", "category": "Hygiene", "unit_of_measure": "roll", "aliases_fr": ["papier toilette", "papier hygiénique"], "aliases_en": ["toilet paper", "toilet roll"]},
        {"product_id": "PROD_094", "normalized_name": "diapers", "category": "Baby", "unit_of_measure": "pack", "aliases_fr": ["couches", "pampers"], "aliases_en": ["diapers", "nappies", "pampers"]},
    ],
    "version": "1.0.0",
    "last_updated": "2024-12-13"
}

# ============================================================================
# PHASE 2: Common Abbreviations Dictionary (DRC Specific)
# ============================================================================

ABBREVIATION_MAP = {
    # French abbreviations
    "bnn": "banane",
    "bnn pltn": "banane plantain",
    "pltn": "plantain",
    "pvre": "poivre",
    "pmdt": "pomme de terre",
    "pdt": "pomme de terre",
    "tom": "tomate",
    "ogn": "oignon",
    "crt": "carotte",
    "poul": "poulet",
    "pssn": "poisson",
    "hle": "huile",
    "hle plm": "huile de palme",
    "hle vgt": "huile végétale",
    "fne": "farine",
    "scr": "sucre",
    "lt": "lait",
    "eau min": "eau minérale",
    "jus frts": "jus de fruits",
    "svn": "savon",
    "dtrgt": "détergent",
    "cch": "couches",
    "pp tlt": "papier toilette",
    "conc tom": "concentré de tomate",
    "pte tom": "pâte de tomate",
    
    # English abbreviations
    "veg oil": "vegetable oil",
    "plm oil": "palm oil",
    "tom pst": "tomato paste",
    "grndnts": "groundnuts",
    "pnts": "peanuts",
    "chkn": "chicken",
    "fsh": "fish",
    "wtr": "water",
    "min wtr": "mineral water",
    "tlt ppr": "toilet paper",
    
    # Brand names that map to products
    "primus": "bière",
    "skol": "bière",
    "fanta": "soda",
    "coca": "soda",
    "sprite": "soda",
    "omo": "détergent",
    "ariel": "détergent",
    "pampers": "couches",
    "huggies": "couches",
}

# Noise words to remove (French and English)
NOISE_WORDS = {
    # French articles and prepositions
    "le", "la", "les", "un", "une", "des", "du", "de", "à", "au", "aux",
    # English articles and prepositions
    "the", "a", "an", "of", "to", "for", "with",
    # Common non-informative words
    "pack", "paquet", "sachet", "boîte", "box", "piece", "pcs", "kg", "g", "ml", "l"
}


class ProductNormalizer:
    """
    Main class for product name normalization and matching.
    
    This implements a multi-layered approach:
    1. Exact match lookup
    2. Abbreviation expansion
    3. Edit distance (Levenshtein) matching
    4. Token/Jaccard similarity matching
    5. Combined weighted scoring
    """

    def __init__(self, data_dir: Optional[Path] = None):
        """
        Initialize the ProductNormalizer.
        
        Args:
            data_dir: Directory containing product data files. Defaults to current directory.
        """
        self.data_dir = data_dir or Path(__file__).parent
        self.master_products: Dict[str, Any] = {}
        self.product_mappings: Dict[str, str] = {}  # raw_text -> product_id
        self.product_index: Dict[str, str] = {}  # normalized_text -> product_id
        self.semantic_matcher: Optional[Any] = None  # Will be initialized if embeddings available
        
        # Load data
        self._load_master_products()
        self._load_product_mappings()
        self._build_product_index()
        self._init_semantic_matcher()
        
        logger.info(f"ProductNormalizer initialized with {len(self.master_products.get('products', []))} products")

    # ========================================================================
    # Data Loading Methods
    # ========================================================================

    def _load_master_products(self) -> None:
        """Load master products from JSON file or create default"""
        products_path = self.data_dir / MASTER_PRODUCTS_FILE
        
        if products_path.exists():
            try:
                with open(products_path, 'r', encoding='utf-8') as f:
                    self.master_products = json.load(f)
                logger.info(f"Loaded master products from {products_path}")
            except Exception as e:
                logger.error(f"Failed to load master products: {e}")
                self.master_products = DEFAULT_MASTER_PRODUCTS
        else:
            self.master_products = DEFAULT_MASTER_PRODUCTS
            self._save_master_products()
            logger.info("Created default master products database")

    def _save_master_products(self) -> None:
        """Save master products to JSON file"""
        products_path = self.data_dir / MASTER_PRODUCTS_FILE
        try:
            with open(products_path, 'w', encoding='utf-8') as f:
                json.dump(self.master_products, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved master products to {products_path}")
        except Exception as e:
            logger.error(f"Failed to save master products: {e}")

    def _load_product_mappings(self) -> None:
        """Load product mappings (raw text -> product_id) from JSON file"""
        mappings_path = self.data_dir / PRODUCT_MAPPINGS_FILE
        
        if mappings_path.exists():
            try:
                with open(mappings_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.product_mappings = data.get("mappings", {})
                logger.info(f"Loaded {len(self.product_mappings)} product mappings")
            except Exception as e:
                logger.error(f"Failed to load product mappings: {e}")
                self.product_mappings = {}
        else:
            self.product_mappings = {}
            self._save_product_mappings()

    def _save_product_mappings(self) -> None:
        """Save product mappings to JSON file"""
        mappings_path = self.data_dir / PRODUCT_MAPPINGS_FILE
        try:
            data = {
                "mappings": self.product_mappings,
                "version": "1.0.0",
                "last_updated": "2024-12-13"
            }
            with open(mappings_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved product mappings to {mappings_path}")
        except Exception as e:
            logger.error(f"Failed to save product mappings: {e}")

    def _build_product_index(self) -> None:
        """Build searchable index from master products"""
        self.product_index = {}
        
        for product in self.master_products.get("products", []):
            product_id = product["product_id"]
            normalized_name = product["normalized_name"]
            
            # Index normalized name
            cleaned = self.clean_text(normalized_name)
            self.product_index[cleaned] = product_id
            
            # Index all French aliases
            for alias in product.get("aliases_fr", []):
                cleaned = self.clean_text(alias)
                self.product_index[cleaned] = product_id
            
            # Index all English aliases
            for alias in product.get("aliases_en", []):
                cleaned = self.clean_text(alias)
                self.product_index[cleaned] = product_id
        
        # Also index saved mappings
        for raw_text, product_id in self.product_mappings.items():
            cleaned = self.clean_text(raw_text)
            self.product_index[cleaned] = product_id
        
        logger.info(f"Built product index with {len(self.product_index)} entries")

    def _init_semantic_matcher(self) -> None:
        """Initialize semantic matcher with product corpus"""
        if not EMBEDDINGS_AVAILABLE:
            logger.info("Semantic matching not available (embeddings module not found)")
            return
        
        try:
            # Build corpus from all product names and aliases
            corpus = []
            for product in self.master_products.get("products", []):
                corpus.append(product["normalized_name"])
                corpus.extend(product.get("aliases_fr", []))
                corpus.extend(product.get("aliases_en", []))
            
            # Also add cleaned versions
            corpus_cleaned = [self.clean_text(text) for text in corpus]
            corpus_all = list(set(corpus + corpus_cleaned))
            
            # Initialize matcher
            self.semantic_matcher = SemanticMatcher(use_transformers=False, corpus=corpus_all)
            logger.info(f"Initialized semantic matcher with corpus of {len(corpus_all)} items")
        except Exception as e:
            logger.warning(f"Failed to initialize semantic matcher: {e}")
            self.semantic_matcher = None

    # ========================================================================
    # PHASE 2: Text Cleaning and Preprocessing
    # ========================================================================

    def clean_text(self, text: str) -> str:
        """
        Clean and normalize text for matching.
        
        Steps:
        1. Convert to lowercase
        2. Remove accents/diacritics
        3. Remove punctuation
        4. Remove extra whitespace
        5. Remove noise words
        
        Args:
            text: Raw input text
            
        Returns:
            Cleaned text string
        """
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove accents/diacritics (normalize NFD and remove combining characters)
        text = unicodedata.normalize('NFD', text)
        text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')
        
        # Remove punctuation except spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Remove numbers (optional - keep for quantities)
        # text = re.sub(r'\d+', '', text)
        
        # Split into words, remove noise words, rejoin
        words = text.split()
        words = [w for w in words if w not in NOISE_WORDS and len(w) > 1]
        
        # Remove extra whitespace and join
        return ' '.join(words).strip()

    def expand_abbreviations(self, text: str) -> str:
        """
        Expand common abbreviations to full form.
        
        Args:
            text: Text that may contain abbreviations
            
        Returns:
            Text with abbreviations expanded
        """
        cleaned = self.clean_text(text)
        
        # Check for exact abbreviation match
        if cleaned in ABBREVIATION_MAP:
            return ABBREVIATION_MAP[cleaned]
        
        # Try to expand individual words
        words = cleaned.split()
        expanded_words = []
        
        i = 0
        while i < len(words):
            # Try two-word abbreviations first
            if i < len(words) - 1:
                two_word = f"{words[i]} {words[i+1]}"
                if two_word in ABBREVIATION_MAP:
                    expanded_words.append(ABBREVIATION_MAP[two_word])
                    i += 2
                    continue
            
            # Try single word abbreviation
            if words[i] in ABBREVIATION_MAP:
                expanded_words.append(ABBREVIATION_MAP[words[i]])
            else:
                expanded_words.append(words[i])
            i += 1
        
        return ' '.join(expanded_words)

    # ========================================================================
    # PHASE 2: Similarity Matching Functions
    # ========================================================================

    def levenshtein_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate Levenshtein (edit distance) similarity between two strings.
        
        Uses SequenceMatcher which provides a ratio between 0 and 1.
        Higher values mean more similar.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        if not s1 or not s2:
            return 0.0
        
        return SequenceMatcher(None, s1, s2).ratio()

    def jaccard_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate Jaccard similarity between two strings based on tokens.
        
        Jaccard = |intersection| / |union|
        Good for matching when word order differs.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        if not s1 or not s2:
            return 0.0
        
        set1 = set(s1.split())
        set2 = set(s2.split())
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        if union == 0:
            return 0.0
        
        return intersection / union

    def combined_similarity(self, s1: str, s2: str, 
                          levenshtein_weight: float = 0.6,
                          jaccard_weight: float = 0.4) -> float:
        """
        Calculate combined weighted similarity score.
        
        Args:
            s1: First string
            s2: Second string
            levenshtein_weight: Weight for Levenshtein similarity (default 0.6)
            jaccard_weight: Weight for Jaccard similarity (default 0.4)
            
        Returns:
            Combined similarity score between 0.0 and 1.0
        """
        lev_score = self.levenshtein_similarity(s1, s2)
        jac_score = self.jaccard_similarity(s1, s2)
        
        return (levenshtein_weight * lev_score) + (jaccard_weight * jac_score)

    # ========================================================================
    # PHASE 4: Main Matching Algorithm (Hybrid Approach)
    # ========================================================================

    def normalize(self, raw_name: str, shop_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Main normalization function that finds the best product match.
        
        Implements the hybrid matching approach:
        1. Priority 1: Exact match lookup
        2. Priority 2: Translation + exact match (NEW - Phase 3.1)
        3. Priority 3: Abbreviation expansion + exact match
        4. Priority 4: Combined similarity scoring
        5. Priority 5: Flag for manual review if confidence too low
        
        Args:
            raw_name: Raw product name from receipt
            shop_id: Optional shop ID for context-aware matching
            
        Returns:
            Dictionary with:
            - product_id: Matched product ID or None
            - normalized_name: Normalized product name
            - confidence: Confidence score (0.0 to 1.0)
            - match_method: Method used for matching
            - needs_review: Boolean indicating if manual review needed
            - suggestions: List of possible matches if no confident match found
        """
        if not raw_name:
            return {
                "product_id": None,
                "normalized_name": None,
                "confidence": 0.0,
                "match_method": "none",
                "needs_review": True,
                "suggestions": []
            }
        
        cleaned = self.clean_text(raw_name)
        expanded = self.expand_abbreviations(raw_name)
        
        # Priority 1: Exact match lookup (cleaned text)
        if cleaned in self.product_index:
            product_id = self.product_index[cleaned]
            product = self._get_product_by_id(product_id)
            return {
                "product_id": product_id,
                "normalized_name": product["normalized_name"] if product else cleaned,
                "confidence": 1.0,
                "match_method": "exact",
                "needs_review": False,
                "suggestions": []
            }
        
        # Priority 2: Translation + exact match (Phase 3.1)
        if TRANSLATION_AVAILABLE:
            # Try translating to English (pivot language)
            translated = translator.normalize_to_pivot(raw_name, pivot_language='en')
            translated_cleaned = self.clean_text(translated)
            
            if translated_cleaned != cleaned and translated_cleaned in self.product_index:
                product_id = self.product_index[translated_cleaned]
                product = self._get_product_by_id(product_id)
                return {
                    "product_id": product_id,
                    "normalized_name": product["normalized_name"] if product else translated_cleaned,
                    "confidence": 0.98,
                    "match_method": "translation",
                    "needs_review": False,
                    "suggestions": []
                }
            
            # Try all language variants
            variants = translator.get_all_variants(raw_name)
            for variant in variants:
                variant_cleaned = self.clean_text(variant)
                if variant_cleaned in self.product_index:
                    product_id = self.product_index[variant_cleaned]
                    product = self._get_product_by_id(product_id)
                    return {
                        "product_id": product_id,
                        "normalized_name": product["normalized_name"] if product else variant_cleaned,
                        "confidence": 0.96,
                        "match_method": "translation_variant",
                        "needs_review": False,
                        "suggestions": []
                    }
        
        # Priority 3: Abbreviation expansion + exact match
        if expanded != cleaned:
            expanded_cleaned = self.clean_text(expanded)
            if expanded_cleaned in self.product_index:
                product_id = self.product_index[expanded_cleaned]
                product = self._get_product_by_id(product_id)
                return {
                    "product_id": product_id,
                    "normalized_name": product["normalized_name"] if product else expanded_cleaned,
                    "confidence": 0.95,
                    "match_method": "abbreviation",
                    "needs_review": False,
                    "suggestions": []
                }
        
        # Priority 4: Combined similarity scoring
        best_match = None
        best_score = 0.0
        suggestions = []
        
        # Prepare search variants (original + translated)
        search_variants = [cleaned]
        if TRANSLATION_AVAILABLE:
            for variant in translator.get_all_variants(raw_name):
                variant_cleaned = self.clean_text(variant)
                if variant_cleaned not in search_variants:
                    search_variants.append(variant_cleaned)
        
        # Search against all indexed products using all variants
        for search_text in search_variants:
            for indexed_text, product_id in self.product_index.items():
                score = self.combined_similarity(search_text, indexed_text)
                
                if score > best_score:
                    best_score = score
                    best_match = (product_id, indexed_text)
                
                # Collect suggestions for scores above 0.5
                if score > 0.5:
                    product = self._get_product_by_id(product_id)
                    # Avoid duplicate suggestions
                    existing_ids = [s["product_id"] for s in suggestions]
                    if product_id not in existing_ids:
                        suggestions.append({
                            "product_id": product_id,
                            "normalized_name": product["normalized_name"] if product else indexed_text,
                            "score": round(score, 3)
                        })
        
        # Phase 3.2: Try semantic/embedding-based matching if enabled
        if self.semantic_matcher and best_score < 0.9:
            # Try semantic matching against all indexed texts
            for indexed_text, product_id in self.product_index.items():
                for search_text in search_variants:
                    try:
                        semantic_score = self.semantic_matcher.similarity(search_text, indexed_text)
                        # Weight semantic score slightly lower than text similarity
                        weighted_score = semantic_score * 0.9
                        
                        if weighted_score > best_score:
                            best_score = weighted_score
                            best_match = (product_id, indexed_text)
                        
                        if semantic_score > 0.5:
                            product = self._get_product_by_id(product_id)
                            existing_ids = [s["product_id"] for s in suggestions]
                            if product_id not in existing_ids:
                                suggestions.append({
                                    "product_id": product_id,
                                    "normalized_name": product["normalized_name"] if product else indexed_text,
                                    "score": round(semantic_score, 3),
                                    "method": "semantic"
                                })
                    except Exception as e:
                        logger.debug(f"Semantic matching error: {e}")
        
        # Sort suggestions by score
        suggestions.sort(key=lambda x: x["score"], reverse=True)
        suggestions = suggestions[:5]  # Top 5 suggestions
        
        # Priority 5: Check confidence threshold
        if best_score >= 0.85 and best_match:
            product_id, matched_text = best_match
            product = self._get_product_by_id(product_id)
            return {
                "product_id": product_id,
                "normalized_name": product["normalized_name"] if product else matched_text,
                "confidence": round(best_score, 3),
                "match_method": "similarity",
                "needs_review": False,
                "suggestions": []
            }
        elif best_score >= 0.6 and best_match:
            product_id, matched_text = best_match
            product = self._get_product_by_id(product_id)
            return {
                "product_id": product_id,
                "normalized_name": product["normalized_name"] if product else matched_text,
                "confidence": round(best_score, 3),
                "match_method": "similarity_low",
                "needs_review": True,
                "suggestions": suggestions
            }
        else:
            return {
                "product_id": None,
                "normalized_name": cleaned,
                "confidence": round(best_score, 3) if best_score > 0 else 0.0,
                "match_method": "none",
                "needs_review": True,
                "suggestions": suggestions
            }

    def _get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Get product details by ID"""
        for product in self.master_products.get("products", []):
            if product["product_id"] == product_id:
                return product
        return None

    # ========================================================================
    # Learning & Feedback Methods
    # ========================================================================

    def learn_mapping(self, raw_name: str, product_id: str, shop_id: Optional[str] = None) -> bool:
        """
        Add a new mapping from raw text to product ID.
        This is the Human-in-the-Loop learning step.
        
        Args:
            raw_name: Raw product name from receipt
            product_id: Validated product ID
            shop_id: Optional shop ID for context
            
        Returns:
            True if mapping was added successfully
        """
        cleaned = self.clean_text(raw_name)
        
        if not cleaned or not product_id:
            return False
        
        # Add to mappings
        key = f"{cleaned}|{shop_id}" if shop_id else cleaned
        self.product_mappings[key] = product_id
        
        # Update index
        self.product_index[cleaned] = product_id
        
        # Save to file
        self._save_product_mappings()
        
        logger.info(f"Learned mapping: '{raw_name}' -> {product_id}")
        return True

    def add_product(self, normalized_name: str, category: str, 
                   unit_of_measure: str = "piece",
                   aliases_fr: List[str] = None,
                   aliases_en: List[str] = None) -> str:
        """
        Add a new product to the master database.
        
        Args:
            normalized_name: Normalized product name (lowercase, no accents)
            category: Product category
            unit_of_measure: Default unit of measure
            aliases_fr: French aliases
            aliases_en: English aliases
            
        Returns:
            New product ID
        """
        # Generate new product ID
        existing_ids = [p["product_id"] for p in self.master_products.get("products", [])]
        max_num = 0
        for pid in existing_ids:
            try:
                num = int(pid.split("_")[1])
                max_num = max(max_num, num)
            except:
                pass
        
        new_id = f"PROD_{max_num + 1:03d}"
        
        # Create new product entry
        new_product = {
            "product_id": new_id,
            "normalized_name": normalized_name.lower(),
            "category": category,
            "unit_of_measure": unit_of_measure,
            "aliases_fr": aliases_fr or [],
            "aliases_en": aliases_en or []
        }
        
        # Add to master products
        if "products" not in self.master_products:
            self.master_products["products"] = []
        self.master_products["products"].append(new_product)
        
        # Save and rebuild index
        self._save_master_products()
        self._build_product_index()
        
        logger.info(f"Added new product: {new_id} - {normalized_name}")
        return new_id

    # ========================================================================
    # Batch Processing Methods
    # ========================================================================

    def normalize_batch(self, items: List[Dict[str, Any]], shop_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Normalize a batch of items (e.g., from a receipt).
        
        Args:
            items: List of items with 'name' field
            shop_id: Optional shop ID for context
            
        Returns:
            List of items with normalization results added
        """
        results = []
        
        for item in items:
            raw_name = item.get("name", "")
            normalization = self.normalize(raw_name, shop_id)
            
            result = {
                **item,
                "normalization": normalization
            }
            results.append(result)
        
        return results

    def get_product_info(self, product_id: str) -> Optional[Dict[str, Any]]:
        """
        Get full product information by ID.
        
        Args:
            product_id: Product ID to look up
            
        Returns:
            Product dictionary or None
        """
        return self._get_product_by_id(product_id)

    def search_products(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for products matching a query.
        
        Args:
            query: Search query
            limit: Maximum results to return
            
        Returns:
            List of matching products with scores
        """
        cleaned_query = self.clean_text(query)
        results = []
        
        for product in self.master_products.get("products", []):
            best_score = 0.0
            
            # Check normalized name
            score = self.combined_similarity(cleaned_query, self.clean_text(product["normalized_name"]))
            best_score = max(best_score, score)
            
            # Check aliases
            for alias in product.get("aliases_fr", []) + product.get("aliases_en", []):
                score = self.combined_similarity(cleaned_query, self.clean_text(alias))
                best_score = max(best_score, score)
            
            if best_score > 0.3:
                results.append({
                    **product,
                    "match_score": round(best_score, 3)
                })
        
        # Sort by score and return top results
        results.sort(key=lambda x: x["match_score"], reverse=True)
        return results[:limit]


# ============================================================================
# Global Instance
# ============================================================================

# Create a global instance for easy import
product_normalizer = ProductNormalizer()


# ============================================================================
# Utility Functions
# ============================================================================

def create_normalizer() -> ProductNormalizer:
    """Factory function to create a ProductNormalizer instance"""
    return ProductNormalizer()


# ============================================================================
# Main Entry Point (for testing)
# ============================================================================

if __name__ == "__main__":
    # Test the normalizer
    normalizer = ProductNormalizer()
    
    # Test cases
    test_names = [
        "Banane Plantain",
        "plantain",
        "BNN PLTN",
        "Pomme de terre",
        "PDT",
        "TOMATES FRAICHES",
        "Huile végétale",
        "HLE VGT",
        "Poulet entier",
        "CHKN",
        "Coca Cola",
        "Primus",
        "Unknown Product XYZ"
    ]
    
    print("=" * 80)
    print("Product Normalization Test Results")
    print("=" * 80)
    
    for name in test_names:
        result = normalizer.normalize(name)
        print(f"\nInput: '{name}'")
        print(f"  → Product ID: {result['product_id']}")
        print(f"  → Normalized: {result['normalized_name']}")
        print(f"  → Confidence: {result['confidence']}")
        print(f"  → Method: {result['match_method']}")
        print(f"  → Needs Review: {result['needs_review']}")
        if result['suggestions']:
            print(f"  → Suggestions: {result['suggestions'][:3]}")
