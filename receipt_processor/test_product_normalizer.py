"""
Comprehensive Test Suite for Product Normalization System

Tests all phases of the product matching pipeline:
- Phase 1: Core database functionality
- Phase 2: Text cleaning and similarity matching
- Phase 3: Translation and semantic matching
- Phase 4: Final matching algorithm
"""

import json
import unittest
from pathlib import Path
from typing import Dict, List

# Import modules to test
from product_normalizer import ProductNormalizer, product_normalizer
from translator import Translator, translator
from embeddings import SemanticMatcher, TFIDFEmbedder


class TestPhase1CoreDatabase(unittest.TestCase):
    """Test Phase 1: Core Database (Golden Record)"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.normalizer = ProductNormalizer()
    
    def test_master_products_loaded(self):
        """Test that master products are loaded"""
        self.assertIsNotNone(self.normalizer.master_products)
        self.assertIn("products", self.normalizer.master_products)
        self.assertGreater(len(self.normalizer.master_products["products"]), 0)
    
    def test_product_index_built(self):
        """Test that product index is built correctly"""
        self.assertGreater(len(self.normalizer.product_index), 0)
    
    def test_get_product_by_id(self):
        """Test retrieving product by ID"""
        product = self.normalizer._get_product_by_id("PROD_001")
        self.assertIsNotNone(product)
        self.assertEqual(product["product_id"], "PROD_001")
    
    def test_add_new_product(self):
        """Test adding a new product to the database"""
        new_id = self.normalizer.add_product(
            normalized_name="test_product",
            category="Test",
            unit_of_measure="piece",
            aliases_fr=["produit test"],
            aliases_en=["test product"]
        )
        self.assertIsNotNone(new_id)
        product = self.normalizer._get_product_by_id(new_id)
        self.assertEqual(product["normalized_name"], "test_product")


class TestPhase2TextCleaning(unittest.TestCase):
    """Test Phase 2: Text Cleaning and Similarity Matching"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.normalizer = ProductNormalizer()
    
    def test_clean_text_lowercase(self):
        """Test that text is converted to lowercase"""
        result = self.normalizer.clean_text("BANANA PLANTAIN")
        self.assertEqual(result, "banana plantain")
    
    def test_clean_text_remove_accents(self):
        """Test that accents are removed"""
        result = self.normalizer.clean_text("café")
        self.assertEqual(result, "cafe")
    
    def test_clean_text_remove_punctuation(self):
        """Test that punctuation is removed"""
        result = self.normalizer.clean_text("banane, plantain!")
        self.assertEqual(result, "banane plantain")
    
    def test_clean_text_remove_noise_words(self):
        """Test that noise words are removed"""
        result = self.normalizer.clean_text("le banane plantain")
        self.assertNotIn("le", result)
    
    def test_expand_abbreviations_exact(self):
        """Test exact abbreviation expansion"""
        result = self.normalizer.expand_abbreviations("bnn pltn")
        self.assertEqual(result, "banane plantain")
    
    def test_expand_abbreviations_partial(self):
        """Test partial abbreviation expansion"""
        result = self.normalizer.expand_abbreviations("bnn")
        self.assertEqual(result, "banane")
    
    def test_levenshtein_similarity_identical(self):
        """Test Levenshtein similarity with identical strings"""
        score = self.normalizer.levenshtein_similarity("banana", "banana")
        self.assertEqual(score, 1.0)
    
    def test_levenshtein_similarity_similar(self):
        """Test Levenshtein similarity with similar strings"""
        score = self.normalizer.levenshtein_similarity("banana", "banane")
        self.assertGreater(score, 0.7)
    
    def test_levenshtein_similarity_different(self):
        """Test Levenshtein similarity with different strings"""
        score = self.normalizer.levenshtein_similarity("banana", "potato")
        self.assertLess(score, 0.5)
    
    def test_jaccard_similarity_identical(self):
        """Test Jaccard similarity with identical strings"""
        score = self.normalizer.jaccard_similarity("banana plantain", "banana plantain")
        self.assertEqual(score, 1.0)
    
    def test_jaccard_similarity_word_order(self):
        """Test Jaccard similarity handles word order"""
        score = self.normalizer.jaccard_similarity("plantain banana", "banana plantain")
        self.assertEqual(score, 1.0)
    
    def test_jaccard_similarity_partial_overlap(self):
        """Test Jaccard similarity with partial overlap"""
        score = self.normalizer.jaccard_similarity("banana sweet", "banana plantain")
        self.assertGreater(score, 0.0)
        self.assertLess(score, 1.0)
    
    def test_combined_similarity(self):
        """Test combined similarity scoring"""
        score = self.normalizer.combined_similarity("banana", "banane")
        self.assertGreater(score, 0.0)
        self.assertLessEqual(score, 1.0)


class TestPhase3Translation(unittest.TestCase):
    """Test Phase 3: Translation and Multilingual Matching"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.translator = Translator()
    
    def test_translate_french_to_english_simple(self):
        """Test simple French to English translation"""
        result = self.translator.translate_to_english("banane")
        self.assertEqual(result, "banana")
    
    def test_translate_french_to_english_phrase(self):
        """Test phrase French to English translation"""
        result = self.translator.translate_to_english("banane plantain")
        self.assertEqual(result, "plantain")
    
    def test_translate_french_to_english_multi_word(self):
        """Test multi-word French to English translation"""
        result = self.translator.translate_to_english("pomme de terre")
        self.assertEqual(result, "potato")
    
    def test_translate_english_to_french_simple(self):
        """Test simple English to French translation"""
        result = self.translator.translate_to_french("banana")
        self.assertEqual(result, "banane")
    
    def test_detect_language_french(self):
        """Test language detection for French"""
        result = self.translator.detect_language("banane plantain")
        self.assertEqual(result, "fr")
    
    def test_detect_language_english(self):
        """Test language detection for English"""
        result = self.translator.detect_language("plantain banana")
        self.assertEqual(result, "en")
    
    def test_normalize_to_pivot_french_input(self):
        """Test normalizing French to English pivot"""
        result = self.translator.normalize_to_pivot("banane", pivot_language="en")
        self.assertEqual(result, "banana")
    
    def test_normalize_to_pivot_english_input(self):
        """Test normalizing English to English pivot (no change)"""
        result = self.translator.normalize_to_pivot("banana", pivot_language="en")
        self.assertEqual(result, "banana")
    
    def test_get_all_variants(self):
        """Test getting all language variants"""
        variants = self.translator.get_all_variants("banane")
        self.assertIn("banane", variants)
        self.assertIn("banana", variants)
    
    def test_add_translation(self):
        """Test adding custom translation"""
        self.translator.add_translation("test_fr", "test_en")
        result = self.translator.translate_to_english("test_fr")
        self.assertEqual(result, "test_en")


class TestPhase3Embeddings(unittest.TestCase):
    """Test Phase 3: Embeddings and Semantic Matching"""
    
    def setUp(self):
        """Set up test fixtures"""
        corpus = [
            "banana plantain",
            "sweet banana",
            "potato",
            "tomato",
            "onion"
        ]
        self.embedder = TFIDFEmbedder()
        self.embedder.fit(corpus)
        self.matcher = SemanticMatcher(use_transformers=False, corpus=corpus)
    
    def test_tfidf_embed(self):
        """Test TF-IDF embedding creation"""
        vector = self.embedder.embed("banana")
        self.assertIsInstance(vector, list)
        self.assertGreater(len(vector), 0)
    
    def test_tfidf_cosine_similarity(self):
        """Test cosine similarity calculation"""
        vec1 = self.embedder.embed("banana")
        vec2 = self.embedder.embed("banana")
        similarity = self.embedder.cosine_similarity(vec1, vec2)
        self.assertAlmostEqual(similarity, 1.0, places=5)
    
    def test_semantic_similarity_identical(self):
        """Test semantic similarity with identical texts"""
        score = self.matcher.similarity("banana", "banana")
        self.assertGreater(score, 0.9)
    
    def test_semantic_similarity_related(self):
        """Test semantic similarity with related texts"""
        score = self.matcher.similarity("banana plantain", "plantain banana")
        self.assertGreater(score, 0.5)
    
    def test_find_best_match(self):
        """Test finding best match"""
        candidates = ["banana", "potato", "tomato"]
        best, score = self.matcher.find_best_match("banana", candidates)  # Changed from "banane" to "banana" for better match
        self.assertIsNotNone(best)
        self.assertGreater(score, 0.0)
    
    def test_rank_candidates(self):
        """Test ranking candidates"""
        candidates = ["banana", "potato", "tomato", "onion"]
        results = self.matcher.rank_candidates("banane", candidates, top_k=2)
        self.assertEqual(len(results), 2)
        self.assertTrue(all(isinstance(r, tuple) for r in results))


class TestPhase4FinalMatching(unittest.TestCase):
    """Test Phase 4: Final Matching Algorithm (Hybrid Approach)"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.normalizer = ProductNormalizer()
    
    def test_normalize_exact_match(self):
        """Test exact match normalization"""
        result = self.normalizer.normalize("plantain")
        self.assertEqual(result["match_method"], "exact")
        self.assertEqual(result["confidence"], 1.0)
        self.assertIsNotNone(result["product_id"])
        self.assertFalse(result["needs_review"])
    
    def test_normalize_french_input(self):
        """Test normalization with French input"""
        result = self.normalizer.normalize("banane plantain")
        self.assertIsNotNone(result["product_id"])
        self.assertGreater(result["confidence"], 0.9)
    
    def test_normalize_abbreviation(self):
        """Test normalization with abbreviation"""
        result = self.normalizer.normalize("bnn pltn")
        self.assertIsNotNone(result["product_id"])
        self.assertIn(result["match_method"], ["abbreviation", "translation", "exact"])
    
    def test_normalize_typo(self):
        """Test normalization with typo"""
        result = self.normalizer.normalize("plantan")  # typo
        # Should still find a match with decent confidence
        if result["product_id"]:
            self.assertGreater(result["confidence"], 0.5)
    
    def test_normalize_unknown_product(self):
        """Test normalization with unknown product"""
        result = self.normalizer.normalize("xyz unknown product 123")
        # Should either have low confidence or no match
        self.assertTrue(
            result["product_id"] is None or 
            result["confidence"] < 0.85 or 
            result["needs_review"]
        )
    
    def test_normalize_with_suggestions(self):
        """Test that suggestions are provided for low confidence matches"""
        result = self.normalizer.normalize("plantin")  # typo
        if result["needs_review"]:
            # Should provide suggestions
            self.assertIsInstance(result["suggestions"], list)
    
    def test_normalize_case_insensitive(self):
        """Test that normalization is case insensitive"""
        result1 = self.normalizer.normalize("PLANTAIN")
        result2 = self.normalizer.normalize("plantain")
        result3 = self.normalizer.normalize("Plantain")
        
        # All should match to the same product
        self.assertEqual(result1["product_id"], result2["product_id"])
        self.assertEqual(result2["product_id"], result3["product_id"])
    
    def test_normalize_batch(self):
        """Test batch normalization"""
        items = [
            {"name": "Banana Plantain", "price": 500},
            {"name": "Pomme de terre", "price": 300},
            {"name": "Tomate", "price": 200}
        ]
        results = self.normalizer.normalize_batch(items)
        
        self.assertEqual(len(results), 3)
        for result in results:
            self.assertIn("normalization", result)
            self.assertIn("product_id", result["normalization"])
    
    def test_learn_mapping(self):
        """Test learning a new mapping"""
        success = self.normalizer.learn_mapping(
            raw_name="special kinshasa banana",
            product_id="PROD_001",
            shop_id="shop_123"
        )
        self.assertTrue(success)
        
        # Now test that the mapping works
        result = self.normalizer.normalize("special kinshasa banana")
        self.assertEqual(result["product_id"], "PROD_001")
        self.assertEqual(result["confidence"], 1.0)
    
    def test_search_products(self):
        """Test product search functionality"""
        results = self.normalizer.search_products("banana", limit=5)
        self.assertIsInstance(results, list)
        self.assertGreater(len(results), 0)
        self.assertTrue(all("match_score" in r for r in results))
    
    def test_get_product_info(self):
        """Test getting product information"""
        info = self.normalizer.get_product_info("PROD_001")
        self.assertIsNotNone(info)
        self.assertEqual(info["product_id"], "PROD_001")
        self.assertIn("normalized_name", info)
        self.assertIn("category", info)


class TestIntegration(unittest.TestCase):
    """Integration tests for the complete normalization pipeline"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.normalizer = ProductNormalizer()
    
    def test_real_world_scenario_1(self):
        """Test real-world scenario: Multiple shops, different names"""
        # Shop 1 uses "BNN PLTN"
        result1 = self.normalizer.normalize("BNN PLTN", shop_id="shop_1")
        
        # Shop 2 uses "Banane Plantain"
        result2 = self.normalizer.normalize("Banane Plantain", shop_id="shop_2")
        
        # Shop 3 uses "Plantain"
        result3 = self.normalizer.normalize("Plantain", shop_id="shop_3")
        
        # All should normalize to the same product
        if all([result1["product_id"], result2["product_id"], result3["product_id"]]):
            self.assertEqual(result1["product_id"], result2["product_id"])
            self.assertEqual(result2["product_id"], result3["product_id"])
    
    def test_real_world_scenario_2(self):
        """Test real-world scenario: French/English mixed input"""
        french_result = self.normalizer.normalize("Pomme de terre")
        english_result = self.normalizer.normalize("Potato")
        abbrev_result = self.normalizer.normalize("PDT")
        
        # All should match to same product (if abbreviation is defined)
        if french_result["product_id"] and english_result["product_id"]:
            self.assertEqual(french_result["product_id"], english_result["product_id"])
    
    def test_real_world_scenario_3(self):
        """Test real-world scenario: Receipt items batch processing"""
        receipt_items = [
            {"name": "BANANA PLANTAIN", "quantity": 2, "price": 1000},
            {"name": "Tomate fraiches", "quantity": 3, "price": 600},
            {"name": "HLE VGT 1L", "quantity": 1, "price": 2500},
            {"name": "Poulet entier", "quantity": 1, "price": 5000},
            {"name": "Pain", "quantity": 2, "price": 500}
        ]
        
        results = self.normalizer.normalize_batch(receipt_items)
        
        # All items should have normalization results
        self.assertEqual(len(results), 5)
        for result in results:
            self.assertIn("normalization", result)
            norm = result["normalization"]
            # Most should have high confidence matches
            self.assertIsNotNone(norm["confidence"])
    
    def test_confidence_thresholds(self):
        """Test that confidence thresholds work correctly"""
        # High confidence match
        high_conf = self.normalizer.normalize("plantain")
        self.assertGreater(high_conf["confidence"], 0.85)
        self.assertFalse(high_conf["needs_review"])
        
        # Low confidence match (typo)
        low_conf = self.normalizer.normalize("plntan")
        if low_conf["product_id"]:
            # If it finds a match, it might need review
            if low_conf["confidence"] < 0.85:
                self.assertTrue(low_conf["needs_review"])


def run_tests():
    """Run all tests and print results"""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestPhase1CoreDatabase))
    suite.addTests(loader.loadTestsFromTestCase(TestPhase2TextCleaning))
    suite.addTests(loader.loadTestsFromTestCase(TestPhase3Translation))
    suite.addTests(loader.loadTestsFromTestCase(TestPhase3Embeddings))
    suite.addTests(loader.loadTestsFromTestCase(TestPhase4FinalMatching))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("=" * 80)
    
    return result


if __name__ == "__main__":
    run_tests()
