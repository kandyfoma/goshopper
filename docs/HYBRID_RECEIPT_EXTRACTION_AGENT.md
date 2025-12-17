# Hybrid Receipt Extraction Agent - Project Roadmap

## Project Goal
Build a low-cost, high-speed, local receipt extraction system with Gemini as a highly accurate cloud fallback for unknown or complex receipts.

---

## PHASE 1: Setup & Local OCR Layer (The Fast Path)

### 1.1 Setup Project Structure
**Task Description:** Create a `receipt_processor/` directory, and add `config.py` (for API keys), `local_ocr.py`, `extractor.py`, and `main.py`.

**Technology / Libraries:** Python 3, Git

### 1.2 Base OCR Function
**Task Description:** Write a Python function `perform_ocr(image_path)` in `local_ocr.py` that uses Tesseract OCR (or PaddleOCR) to process an image file and return the raw, unformatted string of text.

**Technology / Libraries:** Pillow, pytesseract (or paddleocr)

### 1.3 Pre-processing Script
**Task Description:** Write a function `preprocess_image(image_path)` that applies basic image enhancements (like grayscale, sharpening, and contrast adjustment) to improve OCR accuracy before calling `perform_ocr`.

**Technology / Libraries:** OpenCV or Pillow

### 1.4 Rule-Based Extractor (Shop ID)
**Task Description:** In `extractor.py`, create a function `identify_shop(raw_text)` that uses regular expressions (regex) and a small, local dictionary (e.g., `SHOP_RULES = {"ShopA": ["SHOP A INC", "Avenue 123"], "ShopB": ["GRAND MARCHÉ", "TEL: 243"]}`) to identify the supermarket and return its ID (ShopA, ShopB, or Unknown).

**Technology / Libraries:** Standard Python, Regex (re module)

---

## PHASE 2: Custom Learning & Local Extraction Logic

This phase implements the "learning" that allows your app to read known local receipts without Gemini.

### 2.1 Create Schema/Template Storage
**Task Description:** Define a JSON structure in a file like `shop_templates.json` that holds the specific regex rules for item extraction (e.g., ShopA's regex for items, ShopB's regex for the total).

**Technology / Libraries:** JSON

### 2.2 Custom Item Extraction
**Task Description:** In `extractor.py`, create a function `extract_items_local(shop_id, raw_text)` that loads the appropriate template from `shop_templates.json` and applies the specific regex/rules to extract the list of items, quantities, and prices into a structured JSON list.

**Technology / Libraries:** Standard Python, Regex

### 2.3 Confidence Scoring Logic
**Task Description:** Implement a simple scoring system in `extractor.py`. The score should be high if the shop is identified AND the extraction found a minimum number of items (e.g., > 3 items) and a total. Return Extracted Data, Shop ID, and Confidence Score (0.0 to 1.0).

**Technology / Libraries:** Standard Python Logic

---

## PHASE 3: Gemini Cloud Fallback Layer (The Accurate Path)

This phase integrates the powerful Gemini API for all failure cases.

### 3.1 Gemini Setup
**Task Description:** In `config.py`, store your Gemini API Key. In a new file, `gemini_api.py`, write an initialization function for the Gemini client.

**Technology / Libraries:** google-genai SDK

### 3.2 Gemini Fallback Function
**Task Description:** Write a function `extract_items_gemini(image_path)` in `gemini_api.py`. This function will:
- a) Take the image file
- b) Use the Gemini 2.5 Pro or Flash model to ask it to extract the data into a specific JSON format (you must specify the format in the prompt)
- c) Return the extracted JSON data

**Technology / Libraries:** google-genai SDK (Multimodal/Vision capability)

### 3.3 JSON Schema for Gemini
**Task Description:** Define the exact Python structure (TypedDict or Pydantic model) that you want Gemini to return (e.g., `{"merchant": str, "items": [{"name": str, "qty": float, "price": float}], "total": float}`). Instruct Copilot to use this to build the prompt for 3.2.

**Technology / Libraries:** JSON, Pydantic (Optional but Recommended)

---

## PHASE 4: Orchestration & Agent Script (The Main Logic)

This is the central part of your application that controls the flow.

### 4.1 Main Orchestration Script
**Task Description:** In `main.py`, write the `process_receipt(image_path)` function that implements the hybrid logic: 1. Local OCR → 2. Local Extractor → 3. Check Confidence.

**Technology / Libraries:** Python, local_ocr, extractor, gemini_api

### 4.2 Conditional Fallback Logic
**Task Description:** Enhance the function in `main.py` to only call `extract_items_gemini(image_path)` if the Confidence Score from the local extraction is below your threshold (e.g., < 0.85) OR if the shop_id is Unknown.

**Technology / Libraries:** Python Conditional Logic (if/else)

### 4.3 Output Normalization
**Task Description:** Ensure that the data returned by the Local Extractor (2.2) and the Gemini Fallback (3.2) are mapped to the exact same final JSON format (the one you defined in 3.3).

**Technology / Libraries:** Python Data Mapping/Validation

### 4.4 Deployment Placeholder
**Task Description:** Add a placeholder function `deploy_to_mobile()` that outlines the final steps: bundling the local OCR/Extraction code and the `shop_templates.json` file for the mobile app (e.g., using TFLite or a Python-to-mobile wrapper like Kivy/Beeware if applicable).

**Technology / Libraries:** Documentation/Comment Block

---

## Implementation Notes

### Key Benefits of This Hybrid Approach:
- **Cost Efficiency:** Most receipts processed locally, minimal Gemini API calls
- **Speed:** Local OCR and rule-based extraction is fast
- **Accuracy:** Gemini fallback ensures high accuracy for complex cases
- **Scalability:** Easy to add new shop templates as you encounter them

### Technical Considerations:
- **Local Processing:** Keep all sensitive receipt data local when possible
- **Fallback Strategy:** Only use cloud AI when local methods fail
- **Template Management:** JSON-based templates make it easy to update extraction rules
- **Confidence Thresholds:** Tune the confidence score threshold based on testing

### Development Workflow:
1. Start with Phase 1 (Local OCR setup)
2. Test with sample receipts from known shops
3. Build templates in Phase 2
4. Integrate Gemini fallback in Phase 3
5. Implement orchestration logic in Phase 4
6. Test the complete hybrid system
7. Deploy to mobile app

This roadmap provides a clear path to building a robust, cost-effective receipt extraction system that leverages both local processing power and cloud AI capabilities.</content>
<parameter name="filePath">c:\Personal Project\goshopper\docs\HYBRID_RECEIPT_EXTRACTION_AGENT.md