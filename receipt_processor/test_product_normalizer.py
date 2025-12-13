"""
Test script for Product Normalizer
Tests all phases of the product normalization system
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from product_normalizer import ProductNormalizer, create_normalizer


def test_text_cleaning():
    """Test text cleaning function"""
    print("\n" + "=" * 60)
    print("TEST: Text Cleaning")
    print("=" * 60)
    
    normalizer = create_normalizer()
    
    test_cases = [
        ("BANANE PLANTAIN", "banane plantain"),
        ("  Pomme  de  Terre  ", "pomme terre"),  # 'de' is noise word
        ("L'Orange Fraîche!!!", "orange fraiche"),
        ("Café Moulu", "cafe moulu"),
        ("THE BEST TOMATOES", "best tomatoes"),
    ]
    
    passed = 0
    for input_text, expected in test_cases:
        result = normalizer.clean_text(input_text)
        status = "✓" if result == expected else "✗"
        if result == expected:
            passed += 1
        print(f"  {status} '{input_text}' → '{result}' (expected: '{expected}')")
    
    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_abbreviation_expansion():
    """Test abbreviation expansion"""
    print("\n" + "=" * 60)
    print("TEST: Abbreviation Expansion")
    print("=" * 60)
    
    normalizer = create_normalizer()
    
    test_cases = [
        ("BNN PLTN", "banane plantain"),
        ("PDT", "pomme de terre"),
        ("HLE PLM", "huile de palme"),
        ("CHKN", "chicken"),
        ("TOM PST", "tomato paste"),
        ("Banane", "banane"),  # No abbreviation, should stay the same
    ]
    
    passed = 0
    for input_text, expected in test_cases:
        result = normalizer.expand_abbreviations(input_text)
        status = "✓" if result == expected else "✗"
        if result == expected:
            passed += 1
        print(f"  {status} '{input_text}' → '{result}' (expected: '{expected}')")
    
    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_similarity_functions():
    """Test similarity calculation functions"""
    print("\n" + "=" * 60)
    print("TEST: Similarity Functions")
    print("=" * 60)
    
    normalizer = create_normalizer()
    
    # Levenshtein tests
    print("\n  Levenshtein Similarity:")
    lev_tests = [
        ("banana", "banana", 1.0),
        ("banana", "banane", 0.8),  # Close match
        ("tomato", "potato", 0.5),  # Some letters match
        ("apple", "orange", 0.0),  # Different words
    ]
    
    for s1, s2, expected_min in lev_tests:
        score = normalizer.levenshtein_similarity(s1, s2)
        status = "✓" if score >= expected_min - 0.1 else "✗"
        print(f"    {status} '{s1}' vs '{s2}' = {score:.3f} (expected ≥ {expected_min - 0.1})")
    
    # Jaccard tests
    print("\n  Jaccard Similarity:")
    jac_tests = [
        ("banane plantain", "plantain banane", 1.0),  # Same tokens, different order
        ("huile de palme", "palm oil", 0.0),  # Different languages
        ("tomato paste fresh", "fresh tomato paste", 1.0),  # Same tokens
    ]
    
    for s1, s2, expected_min in jac_tests:
        score = normalizer.jaccard_similarity(s1, s2)
        status = "✓" if score >= expected_min - 0.1 else "✗"
        print(f"    {status} '{s1}' vs '{s2}' = {score:.3f} (expected ≥ {expected_min - 0.1})")
    
    return True


def test_normalization():
    """Test the main normalization function"""
    print("\n" + "=" * 60)
    print("TEST: Product Normalization (Hybrid Algorithm)")
    print("=" * 60)
    
    normalizer = create_normalizer()
    
    test_cases = [
        # (input, expected_product_id, expected_method, min_confidence)
        ("Banane Plantain", "PROD_001", "exact", 1.0),
        ("plantain", "PROD_001", "exact", 1.0),
        ("BNN PLTN", "PROD_001", "abbreviation", 0.9),
        ("Tomate", "PROD_020", "exact", 1.0),
        ("Tomato", "PROD_020", "exact", 1.0),
        ("Poulet", "PROD_040", "exact", 1.0),
        ("Chicken", "PROD_040", "exact", 1.0),
        ("Riz", "PROD_060", "exact", 1.0),
        ("Rice", "PROD_060", "exact", 1.0),
    ]
    
    passed = 0
    for input_text, expected_id, expected_method, min_conf in test_cases:
        result = normalizer.normalize(input_text)
        
        id_match = result['product_id'] == expected_id
        conf_match = result['confidence'] >= min_conf
        
        status = "✓" if id_match and conf_match else "✗"
        if id_match and conf_match:
            passed += 1
        
        print(f"\n  {status} Input: '{input_text}'")
        print(f"      Product ID: {result['product_id']} (expected: {expected_id})")
        print(f"      Normalized: {result['normalized_name']}")
        print(f"      Confidence: {result['confidence']} (expected ≥ {min_conf})")
        print(f"      Method: {result['match_method']} (expected: {expected_method})")
    
    print(f"\n\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_learning():
    """Test the learning/feedback mechanism"""
    print("\n" + "=" * 60)
    print("TEST: Learning Mechanism")
    print("=" * 60)
    
    normalizer = create_normalizer()
    
    # Test learning a new mapping
    new_raw_name = "SPECIAL KINSHASA BANANA"
    product_id = "PROD_001"  # Map to plantain
    
    # Before learning
    result_before = normalizer.normalize(new_raw_name)
    print(f"\n  Before learning:")
    print(f"    Input: '{new_raw_name}'")
    print(f"    Match: {result_before['product_id']} ({result_before['match_method']})")
    print(f"    Confidence: {result_before['confidence']}")
    
    # Learn the mapping
    success = normalizer.learn_mapping(new_raw_name, product_id)
    print(f"\n  Learning: '{new_raw_name}' → {product_id}")
    print(f"    Success: {success}")
    
    # After learning
    result_after = normalizer.normalize(new_raw_name)
    print(f"\n  After learning:")
    print(f"    Input: '{new_raw_name}'")
    print(f"    Match: {result_after['product_id']} ({result_after['match_method']})")
    print(f"    Confidence: {result_after['confidence']}")
    
    passed = result_after['product_id'] == product_id and result_after['confidence'] == 1.0
    print(f"\n  Test {'PASSED' if passed else 'FAILED'}")
    
    return passed


def test_batch_processing():
    """Test batch processing of items"""
    print("\n" + "=" * 60)
    print("TEST: Batch Processing")
    print("=" * 60)
    
    normalizer = create_normalizer()
    
    # Simulate items from a receipt
    items = [
        {"name": "Banane Plantain", "price": 2.50, "quantity": 2},
        {"name": "Tomates", "price": 1.00, "quantity": 3},
        {"name": "Poulet", "price": 8.00, "quantity": 1},
        {"name": "Riz", "price": 5.00, "quantity": 1},
        {"name": "Unknown Item XYZ", "price": 3.00, "quantity": 1},
    ]
    
    results = normalizer.normalize_batch(items, shop_id="TestShop")
    
    print(f"\n  Processed {len(results)} items:")
    
    for item in results:
        norm = item['normalization']
        status = "✓" if norm['product_id'] else "?"
        print(f"\n    {status} {item['name']}")
        print(f"        → {norm['normalized_name']} ({norm['product_id']})")
        print(f"        → Confidence: {norm['confidence']}, Method: {norm['match_method']}")
        if norm['needs_review']:
            print(f"        → NEEDS REVIEW")
    
    return True


def test_search():
    """Test product search functionality"""
    print("\n" + "=" * 60)
    print("TEST: Product Search")
    print("=" * 60)
    
    normalizer = create_normalizer()
    
    queries = ["banana", "oil", "chicken"]
    
    for query in queries:
        print(f"\n  Search: '{query}'")
        results = normalizer.search_products(query, limit=3)
        
        for i, product in enumerate(results):
            print(f"    {i+1}. {product['normalized_name']} ({product['product_id']}) - Score: {product['match_score']}")
    
    return True


def run_all_tests():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("PRODUCT NORMALIZER TEST SUITE")
    print("=" * 60)
    
    tests = [
        ("Text Cleaning", test_text_cleaning),
        ("Abbreviation Expansion", test_abbreviation_expansion),
        ("Similarity Functions", test_similarity_functions),
        ("Product Normalization", test_normalization),
        ("Learning Mechanism", test_learning),
        ("Batch Processing", test_batch_processing),
        ("Product Search", test_search),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n  ERROR in {name}: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\nTotal: {passed_count}/{total_count} tests passed")
    
    return passed_count == total_count


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
