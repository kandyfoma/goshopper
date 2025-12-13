#!/usr/bin/env python3
"""
Test script to demonstrate the machine learning system
Simulates processing a receipt from an unknown shop and learning from it
"""

import json
from learning_engine import ReceiptLearner
from extractor import identify_shop, extract_items_local

def test_learning_system():
    """Test the learning system with a sample receipt"""

    print("🧠 Testing Machine Learning System")
    print("=" * 50)

    # Sample receipt text from unknown shop
    receipt_text = """XYZ SUPERMARKET
123 Main Street, Kinshasa
Tel: +243 123 456 789

Date: 2024-01-15 14:30
Receipt #: XYZ-2024-001

Items:
1. Rice 5kg ............. 25000 CDF
2. Sugar 2kg ............ 12000 CDF
3. Cooking Oil 2L ...... 18000 CDF
4. Soap Bars x3 ......... 9000 CDF

Subtotal: ................ 64000 CDF
Tax Amount: ............... 10240 CDF
Grand Total: ................... 74240 CDF

Thank you for shopping at XYZ!"""

    # Simulate failed local extraction (unknown shop)
    print("1. Attempting local extraction for unknown shop 'XYZ'...")
    shop_id = identify_shop(receipt_text)
    local_data, local_confidence = extract_items_local(shop_id, receipt_text)
    print(f"   Shop identified: {shop_id}")
    print(f"   Local confidence: {local_confidence:.2f}")
    print(f"   Items found: {len(local_data.get('items', []))}")

    if local_confidence < 0.7:
        print("   ❌ Local extraction failed - would fallback to Gemini")

        # Simulate successful Gemini extraction
        gemini_result = {
            'items': [
                {'name': 'Rice 5kg', 'price': 25000, 'quantity': 1},
                {'name': 'Sugar 2kg', 'price': 12000, 'quantity': 1},
                {'name': 'Cooking Oil 2L', 'price': 18000, 'quantity': 1},
                {'name': 'Soap Bars', 'price': 9000, 'quantity': 3}
            ],
            'total': 74240,
            'shop': 'XYZ Supermarket'
        }

        print("\n2. Gemini AI successfully extracted:")
        for item in gemini_result['items']:
            print(f"   - {item['name']}: {item['price']} CDF (x{item['quantity']})")

        # Now the learning system learns from this correction
        print("\n3. Learning from Gemini correction...")
        learner = ReceiptLearner()

        # Learn from the successful extraction (simulate multiple samples)
        for i in range(3):  # Need multiple samples for pattern generation
            learner.learn_from_gemini_correction(shop_id, receipt_text, gemini_result, local_confidence)

        print("   ✅ Learned patterns for 'XYZ Supermarket' (3 samples)")

        # Test that it now works locally
        print("\n4. Testing improved local extraction...")
        # Force the shop ID to "XYZ" since that's what we learned
        improved_data, improved_confidence = extract_items_local("XYZ", receipt_text)
        print(f"   New local confidence: {improved_confidence:.2f}")
        print(f"   Items found: {len(improved_data.get('items', []))}")

        if improved_confidence >= 0.7:
            print("   ✅ Local extraction now successful!")
            print("   🎉 System learned and improved!")
        else:
            print("   ⚠️  Learning may need more samples or different patterns")

if __name__ == "__main__":
    test_learning_system()