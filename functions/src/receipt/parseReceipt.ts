/**
 * Receipt Parsing Cloud Function
 * Uses Gemini AI to extract structured data from receipt images
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {config, collections} from '../config';
import {ParsedReceipt, ReceiptItem} from '../types';
import sharp from 'sharp';
import phash from 'sharp-phash';

const db = admin.firestore();

// Gemini AI will be initialized lazily with the secret
let genAI: GoogleGenerativeAI | null = null;

function getGeminiAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || config.gemini.apiKey;
    if (!apiKey) {
      throw new Error('Service d\'analyse non configuré');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Validate image data before processing
 * V1 FIX: Image validation (format, size, magic bytes)
 */
function validateImageData(
  imageBase64: string,
  mimeType: string,
): {valid: boolean; error?: string} {
  // 1. Check MIME type
  const validMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];
  if (!validMimeTypes.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error:
        "Format d'image non supporté. Utilisez JPG, PNG ou WebP.",
    };
  }

  // 2. Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(imageBase64)) {
    return {valid: false, error: 'Image corrompue. Veuillez réessayer.'};
  }

  // 3. Check file size (base64 is ~33% larger than binary)
  const sizeInBytes = (imageBase64.length * 3) / 4;
  const MAX_SIZE_MB = 10;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  if (sizeInBytes > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image trop grande (max ${MAX_SIZE_MB}MB). Compressez l'image.`,
    };
  }

  const MIN_SIZE_KB = 10;
  const MIN_SIZE_BYTES = MIN_SIZE_KB * 1024;
  if (sizeInBytes < MIN_SIZE_BYTES) {
    return {valid: false, error: 'Image trop petite pour être lisible.'};
  }

  // 4. Decode and check actual image header (magic bytes)
  try {
    const buffer = Buffer.from(imageBase64, 'base64');

    // JPEG magic bytes: FF D8 FF
    // PNG magic bytes: 89 50 4E 47
    // WEBP magic bytes: 52 49 46 46 (RIFF)
    const isJPEG =
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPNG =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    const isWEBP =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46;

    if (!isJPEG && !isPNG && !isWEBP) {
      return {
        valid: false,
        error: 'Fichier invalide. Envoyez une photo de reçu.',
      };
    }
  } catch (decodeError) {
    return {
      valid: false,
      error: 'Image corrompue. Impossible de lire le fichier.',
    };
  }

  return {valid: true};
}

/**
 * Detect if image contains a receipt
 * V2 FIX: Content detection (receipt vs non-receipt)
 */
async function detectReceiptContent(
  imageBase64: string,
  mimeType: string,
): Promise<{
  isReceipt: boolean;
  confidence: number;
  reason?: string;
}> {
  const detectionPrompt = `Analyze this image and determine if it is a receipt, invoice, or bill.

Respond with ONLY this JSON:
{
  "isReceipt": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "hasText": true/false,
  "textLanguage": "fr/en/other/none"
}

A receipt must have:
- Store/vendor name
- List of items/services
- Prices
- Total amount
- Date (usually)

NOT receipts:
- Selfies, photos of people/places/things
- Screenshots of apps
- Blank/empty images
- Documents without prices
- Images with no text`;

  try {
    const model = getGeminiAI().getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    const result = await model.generateContent([
      detectionPrompt,
      {inlineData: {mimeType, data: imageBase64}},
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const detection = JSON.parse(jsonMatch[0]);
      return detection;
    }
  } catch (error) {
    console.error('Receipt detection failed:', error);
    // On error, be permissive and allow processing
    return {isReceipt: true, confidence: 0.5, reason: 'Detection unavailable'};
  }

  return {
    isReceipt: false,
    confidence: 0,
    reason: 'Could not analyze image',
  };
}

/**
 * Check image quality
 * H1 FIX: Image quality detection (blur, brightness, size)
 */
interface ImageQualityCheck {
  isAcceptable: boolean;
  warnings: string[];
  suggestions: string[];
  metrics: {
    width: number;
    height: number;
    brightness: number;
    sharpness: number;
  };
}

async function checkImageQuality(
  imageBase64: string,
): Promise<ImageQualityCheck> {
  const buffer = Buffer.from(imageBase64, 'base64');
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const stats = await image.stats();

  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check resolution
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (width < 800 || height < 600) {
    warnings.push('Image très petite - le texte peut être illisible');
    suggestions.push(
      'Rapprochez-vous du reçu ou utilisez un meilleur appareil photo',
    );
  }

  // Check brightness (average luminance across all channels)
  const avgBrightness =
    stats.channels.reduce((sum: number, ch: any) => sum + ch.mean, 0) /
    stats.channels.length;

  if (avgBrightness < 50) {
    warnings.push('Image trop sombre');
    suggestions.push('Scannez dans un endroit bien éclairé');
  } else if (avgBrightness > 230) {
    warnings.push('Image trop claire/surexposée');
    suggestions.push('Réduisez la luminosité ou évitez la lumière directe');
  }

  // Estimate sharpness using Laplacian variance (simple blur detection)
  const {data, info} = await image.greyscale().raw().toBuffer({
    resolveWithObject: true,
  });

  // Calculate Laplacian variance as blur metric
  let laplacianSum = 0;
  const stride = info.width;
  for (let y = 1; y < info.height - 1; y++) {
    for (let x = 1; x < info.width - 1; x++) {
      const idx = y * stride + x;
      const laplacian =
        4 * data[idx] -
        data[idx - 1] -
        data[idx + 1] -
        data[idx - stride] -
        data[idx + stride];
      laplacianSum += laplacian * laplacian;
    }
  }
  const sharpness = laplacianSum / ((info.width - 2) * (info.height - 2));

  if (sharpness < 100) {
    warnings.push('Image floue');
    suggestions.push('Tenez votre téléphone stable ou utilisez le flash');
  }

  const isAcceptable =
    warnings.length === 0 ||
    (width >= 800 && avgBrightness >= 50 && sharpness >= 50);

  return {
    isAcceptable,
    warnings,
    suggestions,
    metrics: {
      width,
      height,
      brightness: avgBrightness,
      sharpness,
    },
  };
}

/**
 * Detect duplicate receipts
 * H2 FIX: Duplicate receipt detection with perceptual hash
 */
async function detectDuplicateReceipt(
  userId: string,
  imageBase64: string,
  receiptData: ParsedReceipt,
): Promise<{
  isDuplicate: boolean;
  existingReceiptId?: string;
  similarity?: number;
}> {
  try {
    // 1. Calculate perceptual hash of image
    const buffer = Buffer.from(imageBase64, 'base64');
    const hash = await phash(buffer);

    // 2. Check exact matches (same hash)
    const exactMatch = await db
      .collection(collections.receipts(userId))
      .where('imageHash', '==', hash)
      .limit(1)
      .get();

    if (!exactMatch.empty) {
      return {
        isDuplicate: true,
        existingReceiptId: exactMatch.docs[0].id,
        similarity: 1.0,
      };
    }

    // 3. Check similar receipts (within last 30 days, same store, similar total)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const similarReceipts = await db
      .collection(collections.receipts(userId))
      .where('storeNameNormalized', '==', receiptData.storeNameNormalized)
      .where(
        'createdAt',
        '>=',
        admin.firestore.Timestamp.fromDate(thirtyDaysAgo),
      )
      .get();

    for (const doc of similarReceipts.docs) {
      const existing = doc.data() as ParsedReceipt & {createdAt: any};

      // Compare totals (within 5% tolerance for OCR errors)
      const totalDiff = Math.abs(existing.total - receiptData.total);
      const tolerance = receiptData.total * 0.05;

      if (totalDiff <= tolerance) {
        // Compare dates (same day or day before/after)
        const existingDate = existing.date
          ? new Date(existing.date)
          : existing.createdAt.toDate();
        const newDate = new Date(receiptData.date);
        const dayDiff = Math.abs(
          (existingDate.getTime() - newDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (dayDiff <= 1) {
          // Likely duplicate - calculate item similarity
          const itemSimilarity = calculateItemSimilarity(
            existing.items,
            receiptData.items,
          );

          if (itemSimilarity > 0.8) {
            return {
              isDuplicate: true,
              existingReceiptId: doc.id,
              similarity: itemSimilarity,
            };
          }
        }
      }
    }

    return {isDuplicate: false};
  } catch (error) {
    console.error('Duplicate detection failed:', error);
    // On error, don't block the scan
    return {isDuplicate: false};
  }
}

/**
 * Calculate similarity between two item lists (0-1)
 */
function calculateItemSimilarity(
  items1: ReceiptItem[],
  items2: ReceiptItem[],
): number {
  if (items1.length === 0 || items2.length === 0) {
    return 0;
  }

  let matchCount = 0;
  const maxLength = Math.max(items1.length, items2.length);

  for (const item1 of items1) {
    for (const item2 of items2) {
      // Compare normalized names and prices
      if (
        item1.nameNormalized === item2.nameNormalized &&
        Math.abs(item1.unitPrice - item2.unitPrice) < 0.01
      ) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / maxLength;
}

// Prompt for receipt parsing - optimized for DRC market
const PARSING_PROMPT = `You are an expert receipt/invoice OCR and data extraction system. Your task is to CAREFULLY READ and extract ALL visible text and data from the receipt image provided.

⚠️ CRITICAL RULES:
1. ONLY read MACHINE-PRINTED text (typed/printed by machine)
2. COMPLETELY IGNORE handwritten text (written by pen/marker)
3. SKIP any handwritten numbers, prices, or totals
4. Focus ONLY on printed receipts from cash registers or printers
5. If you see both printed and handwritten totals, USE ONLY THE PRINTED ONE

⚠️ CRITICAL: ITEM DELIMITERS - How to identify separate items:
6. Each item TYPICALLY appears on ONE line with product name on LEFT and price on RIGHT
7. A NEW ITEM starts when you see a NEW product name followed by a NEW price
8. LOOK FOR: Product names that are followed by numbers/prices on the same line or next line
9. SEPARATE items when you see: Different product names + different prices
10. DO NOT separate items when you see: Size info ("1lt", "500g", "18.9 L") without a new product name
11. Items are usually separated by: Blank lines, different alignment, or clear product name changes

⚠️ CRITICAL: PRICE vs SIZE DISTINCTION:
12. PRICES are usually: 500, 1000, 5000, 10000, 50000, 100000 (CDF) or 1.00, 5.00, 10.00 (USD)
13. SIZES are usually: 1lt, 500g, 18.9L, 330ml, 1kg, 2pcs
14. If a number looks like a SIZE (contains units like lt/ml/kg/g/L/pcs), it's NOT a price
15. If a number looks like a PRICE (large round numbers, currency symbols), it's a price
16. NEVER treat size numbers as separate items with their own prices

⚠️ CRITICAL: MULTI-LINE ITEMS - Items can span 2-3 lines:
6. If you see an item name on one line and size/quantity info on the next line(s), COMBINE them into ONE item
7. Example: "Crene Glace Caramel" on line 1, "1lt(lb)" on line 2 = ONE item: "Crene Glace Caramel 1lt(lb)"
8. Example: "Virgin Mojito" on line 1, "330ml" on line 2 = ONE item: "Virgin Mojito 330ml"
9. Example: "Dasani Eau de Table" on line 1, "18.9 L Recharge" on line 2 = ONE item: "Dasani Eau de Table 18.9 L Recharge"
10. Example: "Sprite" on line 1, "2L" on line 2 = ONE item: "Sprite 2L"
11. The price appears on the RIGHTMOST side, usually aligned with the last line of the item
12. DO NOT create separate items for size/quantity information - merge them with the product name above
13. Look for items where the price is on a line by itself or with minimal text
14. If a line contains only numbers and size units (like "18.9 L", "500g", "1kg"), it's probably a continuation of the previous iteme of the item
12. DO NOT create separate items for size/quantity information - merge them with the product name above
13. Look for items where the price is on a line by itself or with minimal text
14. If a line contains only numbers and size units (like "18.9 L", "500g", "1kg"), it's probably a continuation of the previous item

⚠️ CRITICAL: TEXT SPACING:
21. DO NOT add extra spaces within words
22. "BAG" should be "BAG", NOT "B AG" or "B A G"
23. "TOMATES" should be "TOMATES", NOT "TOMATE S" or "T OMATES"
24. Keep product names as continuous words WITHOUT artificial spacing
25. Only use spaces between SEPARATE words, not within a single word

⚠️ HANDLING INVISIBLE/FADED ITEMS:
26. If item name is invisible/faded BUT price is visible → Use "Unavailable name" as item name
27. If BOTH item name AND price are invisible/faded → SKIP that item entirely
28. Always ensure the total amount matches the receipt, even if some items are skipped

⚠️ CRITICAL: FINDING THE CORRECT TOTAL AMOUNT:
29. DO NOT just take the last number at the bottom of the receipt
30. LOOK FOR TEXT LABELS that indicate the total amount:
   - "TOTAL" or "Total" or "total"
   - "MONTANT A PAYER" or "Montant à payer" 
   - "TOTAL A PAYER" or "Total à payer"
   - "NET A PAYER" or "Net à payer"
   - "AMOUNT DUE" or "Amount Due"
   - "GRAND TOTAL"
31. The number next to or below these labels is the ACTUAL TOTAL
32. IGNORE other numbers at the bottom like:
   - Customer numbers
   - Transaction IDs
   - Receipt numbers
   - Payment reference numbers
   - Change given ("Monnaie")
   - Amount tendered ("Montant reçu")
33. If you see "Subtotal" and "Total", use the "Total" (which includes tax)
34. The total MUST match the sum of all item prices (within small rounding tolerance)

You MUST extract the ACTUAL machine-printed text visible in the image. DO NOT use placeholder text like "Test Store", "Item 1", "Item 2", etc.

READ THE IMAGE CAREFULLY and extract EXACTLY what you see in PRINTED text:

REQUIRED JSON RESPONSE FORMAT:
Return ONLY a valid JSON object with double quotes around all property names and string values. No markdown, no explanations, no additional text.

{
  "storeName": "ACTUAL store name from receipt (e.g., Shoprite, Carrefour, City Market)",
  "storeAddress": "ACTUAL address if visible, or null",
  "storePhone": "ACTUAL phone number if visible, or null",
  "receiptNumber": "ACTUAL receipt/invoice number if visible, or null",
  "date": "ACTUAL date in YYYY-MM-DD format from receipt",
  "currency": "USD or CDF based on currency symbols in receipt",
  "items": [
    {
      "name": "EXACT product name as ONE word or phrase WITHOUT extra spaces (e.g., BAG not B AG)",
      "quantity": ACTUAL_NUMBER,
      "unitPrice": ACTUAL_PRICE,
      "totalPrice": ACTUAL_TOTAL,
      "unit": "kg/L/pcs/etc if shown",
      "category": "Alimentation/Boissons/Hygiène/Ménage/Bébé/Autres"
    }
  ],
  "subtotal": ACTUAL_SUBTOTAL_OR_NULL,
  "tax": ACTUAL_TAX_OR_NULL,
  "total": ACTUAL_TOTAL_AMOUNT_NEXT_TO_TOTAL_LABEL,
  "totalUSD": ACTUAL_USD_TOTAL_OR_NULL,
  "totalCDF": ACTUAL_CDF_TOTAL_OR_NULL
}

EXTRACTION RULES:
1. READ EVERY LINE of the receipt image carefully
2. Extract ALL items listed - do not skip items or use placeholders
3. Use the ACTUAL product names exactly as written (French/Lingala/English)
4. Extract REAL prices - look for numbers with decimal points or currency symbols
5. Currency: $ or USD = "USD" | FC or CDF or large numbers (1000+) = "CDF"
6. If quantity not shown, assume 1
7. If both USD and CDF totals visible, extract both
8. Categories: Alimentation (food/groceries), Boissons (beverages), Hygiène (personal care), Ménage (household items), Bébé (baby products), Autres (other)
9. Common DRC stores: Shoprite, Carrefour, Peloustore, Hasson & Frères, City Market, Kin Marché
10. ⚠️ IGNORE HANDWRITTEN TEXT - Only read printed/typed text from machines
11. ⚠️ FIND TOTAL BY READING THE LABEL "TOTAL" OR "MONTANT A PAYER" - Not just the last number!

⚠️ IMPORTANT: Return ONLY the JSON object with ACTUAL data from the MACHINE-PRINTED receipt text. Use double quotes for all strings. No markdown formatting, no explanations, no placeholder data.`;

/**
 * Check if user can perform a scan based on subscription status
 */
function canUserScan(subscription: {
  isSubscribed?: boolean;
  status?: string;
  trialScansUsed?: number;
  trialScansLimit?: number;
  monthlyScansUsed?: number;
  monthlyScansLimit?: number;
}): {canScan: boolean; reason?: string} {
  // If subscribed, can always scan (subject to monthly limit if applicable)
  if (subscription.isSubscribed || subscription.status === 'active') {
    const monthlyLimit = subscription.monthlyScansLimit || -1;
    const monthlyUsed = subscription.monthlyScansUsed || 0;
    
    if (monthlyLimit === -1 || monthlyUsed < monthlyLimit) {
      return {canScan: true};
    }
    return {
      canScan: false, 
      reason: `Limite mensuelle atteinte (${monthlyUsed}/${monthlyLimit}). Attendez le renouvellement.`
    };
  }

  // Check trial limits
  const trialLimit = subscription.trialScansLimit ?? config.app.trialScanLimit;
  const trialUsed = subscription.trialScansUsed || 0;
  
  // Unlimited trial
  if (trialLimit === -1) {
    return {canScan: true};
  }

  if (trialUsed < trialLimit) {
    return {canScan: true};
  }

  return {
    canScan: false,
    reason: `Limite d'essai atteinte (${trialUsed}/${trialLimit}). Abonnez-vous pour continuer.`
  };
}

/**
 * Generate unique ID for items
 */
function generateItemId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Clean item name from OCR spacing errors
 * Fixes common AI vision issues like "B AG" -> "BAG", "TOMATE S" -> "TOMATES"
 */
function cleanItemName(name: string): string {
  if (!name) return name;
  
  let cleaned = name.trim();
  
  // === FIX 1: Remove spaces between single letter and rest of word ===
  // "B AG" -> "BAG", "S AC" -> "SAC", "R IZ" -> "RIZ"
  cleaned = cleaned.replace(/\b([A-Za-z])\s+([A-Za-z]{2,})\b/g, '$1$2');
  
  // === FIX 2: Remove spaces before last letter ===
  // "TOMATE S" -> "TOMATES", "BANANE S" -> "BANANES"
  cleaned = cleaned.replace(/\b([A-Za-z]{2,})\s+([A-Za-z])\b/g, '$1$2');
  
  // === FIX 3: Fix common split words (comprehensive list) ===
  const splitWordFixes: [RegExp, string][] = [
    // Common French words
    [/\bB\s*A\s*G\b/gi, 'BAG'],
    [/\bS\s*A\s*C\b/gi, 'SAC'],
    [/\bR\s*I\s*Z\b/gi, 'RIZ'],
    [/\bE\s*A\s*U\b/gi, 'EAU'],
    [/\bV\s*I\s*N\b/gi, 'VIN'],
    [/\bL\s*A\s*I\s*T\b/gi, 'LAIT'],
    [/\bP\s*A\s*I\s*N\b/gi, 'PAIN'],
    [/\bS\s*E\s*L\b/gi, 'SEL'],
    [/\bT\s*H\s*E\b/gi, 'THE'],
    [/\bC\s*A\s*F\s*E\b/gi, 'CAFE'],
    [/\bH\s*U\s*I\s*L\s*E\b/gi, 'HUILE'],
    [/\bS\s*U\s*C\s*R\s*E\b/gi, 'SUCRE'],
    [/\bB\s*E\s*U\s*R\s*R\s*E\b/gi, 'BEURRE'],
    [/\bF\s*R\s*O\s*M\s*A\s*G\s*E\b/gi, 'FROMAGE'],
    [/\bP\s*O\s*U\s*L\s*E\s*T\b/gi, 'POULET'],
    [/\bV\s*I\s*A\s*N\s*D\s*E\b/gi, 'VIANDE'],
    [/\bP\s*O\s*I\s*S\s*S\s*O\s*N\b/gi, 'POISSON'],
    [/\bL\s*E\s*G\s*U\s*M\s*E\s*S?\b/gi, 'LEGUMES'],
    [/\bF\s*R\s*U\s*I\s*T\s*S?\b/gi, 'FRUITS'],
    [/\bT\s*O\s*M\s*A\s*T\s*E\s*S?\b/gi, 'TOMATES'],
    [/\bB\s*A\s*N\s*A\s*N\s*E\s*S?\b/gi, 'BANANES'],
    [/\bO\s*R\s*A\s*N\s*G\s*E\s*S?\b/gi, 'ORANGES'],
    [/\bO\s*I\s*G\s*N\s*O\s*N\s*S?\b/gi, 'OIGNONS'],
    [/\bS\s*A\s*V\s*O\s*N\b/gi, 'SAVON'],
    [/\bF\s*A\s*R\s*I\s*N\s*E\b/gi, 'FARINE'],
    [/\bP\s*A\s*T\s*E\s*S?\b/gi, 'PATES'],
    [/\bS\s*P\s*R\s*I\s*T\s*E\b/gi, 'SPRITE'],
    [/\bF\s*A\s*N\s*T\s*A\b/gi, 'FANTA'],
    [/\bC\s*O\s*C\s*A\b/gi, 'COCA'],
    [/\bC\s*O\s*L\s*A\b/gi, 'COLA'],
    [/\bB\s*I\s*E\s*R\s*E\b/gi, 'BIERE'],
    [/\bY\s*A\s*O\s*U\s*R\s*T\b/gi, 'YAOURT'],
    [/\bC\s*R\s*E\s*M\s*E\b/gi, 'CREME'],
    [/\bO\s*E\s*U\s*F\s*S?\b/gi, 'OEUFS'],
    [/\bP\s*O\s*M\s*M\s*E\s*S?\b/gi, 'POMMES'],
    [/\bP\s*O\s*I\s*V\s*R\s*E\b/gi, 'POIVRE'],
    [/\bM\s*A\s*Y\s*O\b/gi, 'MAYO'],
    [/\bK\s*E\s*T\s*C\s*H\s*U\s*P\b/gi, 'KETCHUP'],
    [/\bS\s*A\s*U\s*C\s*E\b/gi, 'SAUCE'],
    [/\bJ\s*U\s*S\b/gi, 'JUS'],
    [/\bS\s*O\s*D\s*A\b/gi, 'SODA'],
    // English common words
    [/\bM\s*I\s*L\s*K\b/gi, 'MILK'],
    [/\bB\s*R\s*E\s*A\s*D\b/gi, 'BREAD'],
    [/\bR\s*I\s*C\s*E\b/gi, 'RICE'],
    [/\bO\s*I\s*L\b/gi, 'OIL'],
    [/\bS\s*A\s*L\s*T\b/gi, 'SALT'],
    [/\bS\s*U\s*G\s*A\s*R\b/gi, 'SUGAR'],
    [/\bW\s*A\s*T\s*E\s*R\b/gi, 'WATER'],
    [/\bJ\s*U\s*I\s*C\s*E\b/gi, 'JUICE'],
    [/\bB\s*E\s*E\s*R\b/gi, 'BEER'],
    [/\bC\s*H\s*E\s*E\s*S\s*E\b/gi, 'CHEESE'],
    [/\bB\s*U\s*T\s*T\s*E\s*R\b/gi, 'BUTTER'],
    [/\bC\s*H\s*I\s*C\s*K\s*E\s*N\b/gi, 'CHICKEN'],
    [/\bF\s*I\s*S\s*H\b/gi, 'FISH'],
    [/\bM\s*E\s*A\s*T\b/gi, 'MEAT'],
    [/\bS\s*O\s*A\s*P\b/gi, 'SOAP'],
    [/\bF\s*L\s*O\s*U\s*R\b/gi, 'FLOUR'],
    // Brands
    [/\bN\s*I\s*D\s*O\b/gi, 'NIDO'],
    [/\bM\s*A\s*G\s*G\s*I\b/gi, 'MAGGI'],
    [/\bN\s*E\s*S\s*T\s*L\s*E\b/gi, 'NESTLE'],
    [/\bP\s*E\s*P\s*S\s*I\b/gi, 'PEPSI'],
    [/\bP\s*R\s*I\s*M\s*U\s*S\b/gi, 'PRIMUS'],
    [/\bS\s*K\s*O\s*L\b/gi, 'SKOL'],
    [/\bT\s*E\s*M\s*B\s*O\b/gi, 'TEMBO'],
  ];
  
  for (const [pattern, replacement] of splitWordFixes) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  
  // === FIX 4: General pattern - remove single spaces between letters in ALL CAPS words ===
  // "P E L O U S T O R E" -> "PELOUSTORE"
  // But only if the result looks like a word (consecutive letters)
  cleaned = cleaned.replace(/\b([A-Z](?:\s[A-Z]){2,})\b/g, (match) => {
    return match.replace(/\s/g, '');
  });
  
  // === FIX 4.5: Aggressive fix for OCR spacing errors ===
  // Remove spaces between letters in words that are likely OCR mistakes
  // "s u c r e" -> "sucre", "b a g" -> "bag", etc.
  cleaned = cleaned.replace(/\b([A-Za-z](?:\s+[A-Za-z]){1,6})\b/g, (match) => {
    return match.replace(/\s+/g, '');
  });
  
  // === FIX 5: Clean up multiple spaces ===
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  
  // === FIX 6: Detect and fix corrupted names ===
  if (isCorruptedName(cleaned)) {
    console.warn(`🚨 Cloud Function detected corrupted item name: "${name}" → "${cleaned}", using fallback`);
    return 'Article inconnu';
  }
  
  // === FIX 7: Try to reconstruct corrupted names ===
  cleaned = reconstructCorruptedName(cleaned);
  
  return cleaned;
}

/**
 * Check if a name appears to be corrupted
 */
function isCorruptedName(name: string): boolean {
  if (!name || name.length < 2) return false;

  // Check for patterns that indicate corruption
  // 1. Spaces between every character: "S p r i t e"
  const spaceBetweenEveryChar = /\b[A-Za-z](?:\s[A-Za-z]){3,}\b/.test(name);

  // 2. Mixed letters and numbers in strange patterns: "e30", "m l"
  const strangePatterns = /\b[A-Za-z]\d+\s*[A-Za-z]\s*[A-Za-z]\b/.test(name);

  // 3. Too many spaces relative to length
  const spaceRatio = (name.match(/\s/g) || []).length / name.length;
  const tooManySpaces = spaceRatio > 0.3;

  // 4. Contains non-printable characters
  const hasNonPrintable = /[\x00-\x1F\x7F-\x9F]/.test(name);

  if (spaceBetweenEveryChar || strangePatterns || tooManySpaces || hasNonPrintable) {
    console.warn(`🚨 [Cloud Function] Detected corrupted name pattern: "${name}" (spaces: ${spaceBetweenEveryChar}, strange: ${strangePatterns}, ratio: ${spaceRatio.toFixed(2)}, nonprint: ${hasNonPrintable})`);
    return true;
  }

  return false;
}

/**
 * Try to reconstruct corrupted names like "S prite e30 m l" → "Sprite 330ml"
 */
function reconstructCorruptedName(name: string): string {
  // Handle specific corruption patterns
  const patterns = [
    {
      // Pattern: "S prite e30 m l" → "Sprite 330ml" (split word)
      regex: /^([A-Za-z])\s+([A-Za-z]{4,})\s+([a-z])(\d{2})\s+([a-z])\s+([a-z])$/i,
      reconstruct: (match: RegExpMatchArray) => {
        const [, firstLetter, word, corruptedDigit, number, unit1, unit2] = match;
        const reconstructedWord = firstLetter + word;
        // Fix common corruption: 'e' → '3', 'o' → '0', etc.
        const digitMap: Record<string, string> = { 'e': '3', 'o': '0', 'i': '1', 'l': '1' };
        const fixedDigit = digitMap[corruptedDigit] || corruptedDigit;
        const reconstructedUnit = fixedDigit + number;
        const reconstructedSize = (unit1 + unit2).toLowerCase();
        return `${reconstructedWord} ${reconstructedUnit}${reconstructedSize}`;
      }
    },
    {
      // Pattern: "Sprite e30 m l" → "Sprite 330ml" (word already reconstructed)
      regex: /^([A-Za-z]{5,})\s+([a-z])(\d{2})\s+([a-z])\s+([a-z])$/,
      reconstruct: (match: RegExpMatchArray) => {
        const [, word, corruptedDigit, number, unit1, unit2] = match;
        const digitMap: Record<string, string> = { 'e': '3', 'o': '0', 'i': '1', 'l': '1' };
        const fixedDigit = digitMap[corruptedDigit] || corruptedDigit;
        const reconstructedUnit = fixedDigit + number;
        const reconstructedSize = (unit1 + unit2).toLowerCase();
        return `${word} ${reconstructedUnit}${reconstructedSize}`;
      }
    },
    {
      // Pattern: "S prite 330 m l" → "Sprite 330ml"
      regex: /^([A-Za-z])\s+([a-z]{4,})\s+(\d{3})\s+([a-z])\s+([a-z])$/,
      reconstruct: (match: RegExpMatchArray) => {
        const [, firstLetter, word, number, unit1, unit2] = match;
        const reconstructedWord = firstLetter + word;
        const reconstructedSize = (unit1 + unit2).toLowerCase();
        return `${reconstructedWord} ${number}${reconstructedSize}`;
      }
    },
    {
      // Pattern: "Sprite 330 m l" → "Sprite 330ml"
      regex: /^([A-Za-z]{5,})\s+(\d{3})\s+([a-z])\s+([a-z])$/,
      reconstruct: (match: RegExpMatchArray) => {
        const [, word, number, unit1, unit2] = match;
        const reconstructedSize = (unit1 + unit2).toLowerCase();
        return `${word} ${number}${reconstructedSize}`;
      }
    },
    {
      // General pattern for spaced words and numbers
      regex: /^([A-Za-z])\s+([a-z]{3,})\s+(\d{2,3})\s*([a-z]{0,2})\s*([a-z]{0,2})$/,
      reconstruct: (match: RegExpMatchArray) => {
        const [, firstLetter, word, number, unit1, unit2] = match;
        const reconstructedWord = firstLetter + word;
        const reconstructedSize = ((unit1 || '') + (unit2 || '')).toLowerCase();
        if (reconstructedSize) {
          return `${reconstructedWord} ${number}${reconstructedSize}`;
        }
        return `${reconstructedWord} ${number}`;
      }
    },
    {
      // Pattern: "SPRITE330ML" → "Sprite 330ml" (concatenated product + size)
      regex: /^SPRITE(\d{3})ML$/i,
      reconstruct: (match: RegExpMatchArray) => {
        const [, size] = match;
        return `Sprite ${size}ml`;
      }
    },
    {
      // Pattern: "VIRGINMOJITO" → "Virgin Mojito" (concatenated drink name)
      regex: /^VIRGINMOJITO$/i,
      reconstruct: (match: RegExpMatchArray) => {
        return `Virgin Mojito`;
      }
    },
    {
      // Pattern: "Castel lite e30 m l" or "Castel LITE e30 m L" → "Castel Lite 330ml" (two words + corrupted size)
      regex: /^([A-Za-z]{3,})\s+([A-Za-z]{3,})\s+([a-z])(\d{2})\s+([a-z]{1,2})\s+([a-z])$/i,
      reconstruct: (match: RegExpMatchArray) => {
        const [, word1, word2, corruptedDigit, number, unit1, unit2] = match;
        const reconstructedWord = word1.charAt(0).toUpperCase() + word1.slice(1).toLowerCase() + ' ' + word2.charAt(0).toUpperCase() + word2.slice(1).toLowerCase();
        // Fix common corruption: 'e' → '3', 'o' → '0', etc.
        const digitMap: Record<string, string> = { 'e': '3', 'o': '0', 'i': '1', 'l': '1' };
        const fixedDigit = digitMap[corruptedDigit] || corruptedDigit;
        const reconstructedUnit = fixedDigit + number;
        const reconstructedSize = (unit1.toLowerCase() + unit2.toLowerCase()).replace(/ml/i, 'ml');
        return `${reconstructedWord} ${reconstructedUnit}${reconstructedSize}`;
      }
    }
  ];

  for (const { regex, reconstruct } of patterns) {
    const match = name.match(regex);
    if (match) {
      const result = reconstruct(match);
      console.log(`[Cloud Function] Reconstructed "${name}" → "${result}"`);
      return result;
    }
  }

  return name;
}

/**
 * Normalize product name for matching
 */
function normalizeProductName(name: string): string {
  let normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Fix OCR spacing errors in common words
  normalized = normalized
    .replace(/\bb\s+ag\b/gi, 'bag')       // "b ag" -> "bag"
    .replace(/\bs\s+ac\b/gi, 'sac')       // "s ac" -> "sac"
    .replace(/\br\s+iz\b/gi, 'riz')       // "r iz" -> "riz"
    .replace(/\bl\s+ait\b/gi, 'lait')     // "l ait" -> "lait"
    .replace(/\be\s+au\b/gi, 'eau')       // "e au" -> "eau"
    .replace(/\bh\s+uile\b/gi, 'huile')   // "h uile" -> "huile"
    .replace(/\bs\s+ucre\b/gi, 'sucre')   // "s ucre" -> "sucre"
    .replace(/\bp\s+ain\b/gi, 'pain')     // "p ain" -> "pain"
    .replace(/\bv\s+in\b/gi, 'vin')       // "v in" -> "vin"
    .trim();
    
  return normalized;
}

/**
 * Check if two product names are similar (fuzzy match)
 * This catches OCR errors like "Bag a lilac" vs "Bag alilac"
 */
function areProductNamesSimilar(name1: string, name2: string): boolean {
  // Normalize by removing ALL spaces for comparison
  const noSpace1 = name1.replace(/\s+/g, '');
  const noSpace2 = name2.replace(/\s+/g, '');
  
  // If they're identical without spaces, they're the same item
  if (noSpace1 === noSpace2) {
    return true;
  }
  
  // If one name is a substring of the other, they're similar
  if (name1.includes(name2) || name2.includes(name1)) {
    return true;
  }
  
  // Calculate simple character-based similarity
  const longer = noSpace1.length > noSpace2.length ? noSpace1 : noSpace2;
  const shorter = noSpace1.length > noSpace2.length ? noSpace2 : noSpace1;
  
  // If lengths differ by more than 30%, probably different items
  if (longer.length > shorter.length * 1.3) {
    return false;
  }
  
  // Count matching characters
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }
  
  // If 80%+ characters match, consider similar
  return matches / shorter.length >= 0.8;
}

/**
 * Merge multi-line items that were incorrectly split
 * Looks for size/quantity-only items and merges them with the previous item
 */
function mergeMultiLineItems(items: ReceiptItem[]): ReceiptItem[] {
  const mergedItems: ReceiptItem[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const currentItem = items[i];
    
    // Check if this item looks like a size/quantity continuation
    // Expanded patterns to catch more cases like "18.9 recharde", "1lt(lb)", "330ml", etc.
    const isSizeOnly = 
      // Standard size patterns: "1lt(lb)", "330ml", "500g", "1kg", "18.9l", etc.
      /^(\d+(\.\d+)?\s*(lt|ml|kg|g|cl|l|lb|pieces?|pcs?|recharde|recharge)\s*\(?[^)]*\)?)$/i.test(currentItem.name.trim()) ||
      // Parenthetical sizes: "(1lt)", "(330ml)", "(18.9l)", etc.
      /^(\d+(\.\d+)?\s*\([^)]*(lt|ml|kg|g|cl|l|lb|pieces?|pcs?|recharde|recharge)[^)]*\))$/i.test(currentItem.name.trim()) ||
      // Size with text: "18.9 recharde", "1 litre", "500 grammes", etc.
      /^(\d+(\.\d+)?\s*(litre|liter|gramme|gram|kilo|piece|recharde|recharge)s?\s*\(?[^)]*\)?)$/i.test(currentItem.name.trim()) ||
      // Short corrupted sizes: "18.9l", "500g", "1kg", etc.
      /^(\d+(\.\d+)?\s*[a-z]{1,3}(\s*\([^)]*\))?)$/i.test(currentItem.name.trim()) ||
      // Size indicators with numbers: "1 lt", "18.9 l", "500 gr", etc.
      /^(\d+(\.\d+)?\s+(lt|ml|kg|g|cl|l|lb|gr|recharde|recharge)(\s*\([^)]*\))?)$/i.test(currentItem.name.trim());
    
    // Additional check: very short names that look like sizes or quantities
    const isVeryShortSize = currentItem.name.trim().length <= 12 && 
                           /^\d+(\.\d+)?\s*[a-z\s\(\)]{0,8}$/i.test(currentItem.name.trim()) &&
                           !/\b(article|total|subtotal|tax|montant)\b/i.test(currentItem.name.trim());
    
    // If it's a size-only item and we have a previous item, merge them
    if ((isSizeOnly || isVeryShortSize) && mergedItems.length > 0) {
      const previousItem = mergedItems[mergedItems.length - 1];
      
      // More lenient merging: merge if prices are similar (within 10%) or if current item has reasonable price
      const priceRatio = previousItem.unitPrice > 0 ? Math.abs(previousItem.unitPrice - currentItem.unitPrice) / previousItem.unitPrice : 0;
      const pricesSimilar = priceRatio < 0.1 || Math.abs(previousItem.unitPrice - currentItem.unitPrice) < 100;
      const currentHasReasonablePrice = currentItem.unitPrice > 0 && currentItem.unitPrice < 100000; // Reasonable CDF price range
      
      if (pricesSimilar || currentHasReasonablePrice || previousItem.unitPrice === 0) {
        // Merge the size into the previous item's name
        const mergedName = `${previousItem.name} ${currentItem.name}`.trim();
        mergedItems[mergedItems.length - 1] = {
          ...previousItem,
          name: mergedName,
          nameNormalized: normalizeProductName(mergedName),
          // Keep the better price (prefer the one from the main item)
          unitPrice: previousItem.unitPrice > 0 ? previousItem.unitPrice : currentItem.unitPrice,
          totalPrice: previousItem.totalPrice > 0 ? previousItem.totalPrice : currentItem.totalPrice,
        };
        console.log(`🔗 Merged multi-line item: "${previousItem.name}" + "${currentItem.name}" → "${mergedName}"`);
        continue; // Skip adding current item separately
      }
    }
    
    // Add current item to merged list
    mergedItems.push(currentItem);
  }
  
  return mergedItems;
}

/**
 * Deduplicate items by similar name + same/similar price
 */
function deduplicateItems(items: ReceiptItem[]): ReceiptItem[] {
  const uniqueItems: ReceiptItem[] = [];
  
  for (const item of items) {
    let isDuplicate = false;
    
    for (let i = 0; i < uniqueItems.length; i++) {
      const existing = uniqueItems[i];
      
      // Check if prices are similar (within 1% or same)
      const priceDiff = Math.abs(existing.unitPrice - item.unitPrice);
      const pricesSimilar = priceDiff < 0.01 || 
        (existing.unitPrice > 0 && priceDiff / existing.unitPrice < 0.01);
      
      // Check if names are similar
      if (pricesSimilar && areProductNamesSimilar(existing.nameNormalized, item.nameNormalized)) {
        // Keep the longer/more complete name
        if (item.name.length > existing.name.length) {
          uniqueItems[i] = {
            ...existing,
            name: item.name,
            nameNormalized: item.nameNormalized,
          };
        }
        isDuplicate = true;
        console.log(`🔄 Merged duplicate: "${item.name}" with "${existing.name}"`);
        break;
      }
    }
    
    if (!isDuplicate) {
      uniqueItems.push(item);
    }
  }
  
  return uniqueItems;
}

/**
 * Normalize store name
 */
function normalizeStoreName(name: string): string {
  // Handle null/undefined/empty cases
  if (!name || name === 'null' || name === 'undefined' || name === 'Unknown Store') {
    return '';
  }
  
  const knownStores: Record<string, string> = {
    shoprite: 'shoprite',
    carrefour: 'carrefour',
    peloustore: 'peloustore',
    'pelou store': 'peloustore',
    hasson: 'hasson_freres',
    'hasson & freres': 'hasson_freres',
    'hasson et freres': 'hasson_freres',
    'city market': 'city_market',
    citymarket: 'city_market',
    'kin marche': 'kin_marche',
    'super u': 'super_u',
    'hyper psaro': 'hyper_psaro',
    psaro: 'hyper_psaro',
  };

  const normalized = name.toLowerCase().trim();

  for (const [key, value] of Object.entries(knownStores)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Validate video data before processing
 */
function validateVideoData(
  videoBase64: string,
  mimeType: string,
): {valid: boolean; error?: string} {
  // 1. Check MIME type
  const validVideoMimeTypes = [
    'video/mp4',
    'video/mpeg',
    'video/mov',
    'video/quicktime',
    'video/webm',
    'video/3gpp',
  ];
  
  if (!validVideoMimeTypes.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: "Format vidéo non supporté. Utilisez MP4, MOV ou WebM.",
    };
  }

  // 2. Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(videoBase64)) {
    return {valid: false, error: 'Vidéo corrompue. Veuillez réessayer.'};
  }

  // 3. Check file size (base64 is ~33% larger than binary)
  const sizeInBytes = (videoBase64.length * 3) / 4;
  const MAX_VIDEO_SIZE_MB = 20; // 20MB max for video
  const MAX_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

  if (sizeInBytes > MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: `Vidéo trop grande (max ${MAX_VIDEO_SIZE_MB}MB). Utilisez une vidéo plus courte.`,
    };
  }

  const MIN_SIZE_KB = 50; // Minimum 50KB for a valid video
  const MIN_SIZE_BYTES = MIN_SIZE_KB * 1024;
  if (sizeInBytes < MIN_SIZE_BYTES) {
    return {valid: false, error: 'Vidéo trop petite pour être lisible.'};
  }

  return {valid: true};
}

/**
 * Parse receipt video using Gemini AI
 * Uses video understanding to extract receipt data from a video scan
 */
async function parseVideoWithGemini(
  videoBase64: string,
  mimeType: string,
): Promise<ParsedReceipt> {
  const MAX_RETRIES = 2; // Reduced from 3 to speed up failures
  let lastError: Error | null = null;

  // Video-specific prompt for receipt extraction - enhanced with photo prompt's total extraction rules
  const VIDEO_PARSING_PROMPT = `You are an expert receipt scanner analyzing a video of a receipt from the Democratic Republic of Congo.
The user has slowly scanned down the entire receipt. Extract ALL items visible throughout the video.

CRITICAL VIDEO SCANNING INSTRUCTIONS:
1. Watch the ENTIRE video from START to END
2. PAUSE mentally at each frame to read all text clearly
3. Pay SPECIAL attention to the LAST frames - that's where the TOTAL appears
4. Extract EVERY item, even if blurry - estimate the price if partially visible
5. Prices are on the RIGHT side of each line
6. ONLY read MACHINE-PRINTED text - IGNORE any handwritten text

⚠️ CRITICAL: ITEM DELIMITERS - How to identify separate items:
- Each item TYPICALLY appears on ONE line with product name on LEFT and price on RIGHT
- A NEW ITEM starts when you see a NEW product name followed by a NEW price
- LOOK FOR: Product names that are followed by numbers/prices on the same line or next line
- SEPARATE items when you see: Different product names + different prices
- DO NOT separate items when you see: Size info ("1lt", "500g", "18.9 L") without a new product name
- Items are usually separated by: Blank lines, different alignment, or clear product name changes

⚠️ CRITICAL: PRICE vs SIZE DISTINCTION:
- PRICES are usually: 500, 1000, 5000, 10000, 50000, 100000 (CDF) or 1.00, 5.00, 10.00 (USD)
- SIZES are usually: 1lt, 500g, 18.9L, 330ml, 1kg, 2pcs
- If a number looks like a SIZE (contains units like lt/ml/kg/g/L/pcs), it's NOT a price
- If a number looks like a PRICE (large round numbers, currency symbols), it's a price
- NEVER treat size numbers as separate items with their own prices

⚠️ CRITICAL: MULTI-LINE ITEMS - Items can span 2-3 lines:
- If you see an item name on one line and size/quantity info on the next line(s), COMBINE them into ONE item
- Example: "Crene Glace Caramel" on line 1, "1lt(lb)" on line 2 = ONE item: "Crene Glace Caramel 1lt(lb)"
- Example: "Virgin Mojito" on line 1, "330ml" on line 2 = ONE item: "Virgin Mojito 330ml"
- The price appears on the RIGHTMOST side, usually aligned with the last line of the item
- DO NOT create separate items for size/quantity information - merge them with the product name above
- Look for items where the price is on a line by itself or with minimal text

⚠️ CRITICAL: TEXT SPACING - DO NOT ADD EXTRA SPACES:
- "BAG" should be "BAG", NOT "B AG" or "B A G"
- "TOMATES" should be "TOMATES", NOT "TOMATE S" or "T OMATES"
- "RIZ" should be "RIZ", NOT "R IZ"
- Keep product names as continuous words without artificial spacing
- Only use spaces between SEPARATE words, not within a single word

⚠️ CRITICAL: FINDING THE CORRECT TOTAL AMOUNT:
- DO NOT just take the last number at the bottom of the receipt
- LOOK FOR TEXT LABELS that indicate the total amount:
  * "TOTAL" or "Total" or "total"
  * "MONTANT A PAYER" or "Montant à payer" 
  * "TOTAL A PAYER" or "Total à payer"
  * "NET A PAYER" or "Net à payer"
  * "AMOUNT DUE" or "Amount Due"
  * "GRAND TOTAL" or "TOTAL TTC"
- The number NEXT TO or BELOW these labels is the ACTUAL TOTAL
- ⚠️ IGNORE these numbers at the bottom (they are NOT the total):
  * Customer numbers
  * Transaction IDs / Receipt numbers
  * Payment reference numbers
  * Change given ("Monnaie", "Rendu")
  * Amount tendered ("Montant reçu", "Espèces")
  * Phone numbers
  * Dates/times in numeric format
- The total MUST approximately match the SUM of all item prices
- If your calculated sum of items is CLOSE to a number labeled "TOTAL", use the labeled number

STORE NAME DETECTION:
- Look at the TOP of the receipt in the FIRST frames
- Common DRC stores: Peloustore, Shoprite, Carrefour, Hasson & Frères
- Store name is usually the LARGEST text at the top

CURRENCY RULES:
- Default is CDF (Congolese Franc) - prices are usually 1000+
- Only use USD if you clearly see $ or "USD" or "dollars"
- CDF prices: 500, 1000, 5000, 10000, 50000, 100000...
- USD prices: 1.00, 5.00, 10.00, 50.00...

VALIDATION BEFORE RESPONDING:
1. Sum all item prices - does it roughly match your "total" field?
2. Is the total next to a label like "TOTAL" or "MONTANT A PAYER"?
3. Did you accidentally use a receipt number or customer ID as the total?

Return a JSON object with this EXACT structure:
{
  "storeName": "exact store name as seen or null",
  "storeAddress": "address or null",
  "storePhone": "phone or null",
  "receiptNumber": "receipt number or null",
  "date": "YYYY-MM-DD format or null",
  "currency": "CDF" or "USD",
  "items": [
    {
      "name": "item name exactly as printed",
      "quantity": 1,
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "unit": "pièce" or "kg" etc,
      "category": "category name",
      "confidence": 0.0-1.0
    }
  ],
  "subtotal": 0.00 or null,
  "tax": 0.00 or null,
  "total": 0.00,
  "rawText": "unclear text you couldn't fully parse"
}

CRITICAL OUTPUT RULES:
- Return ONLY the raw JSON object, NO markdown code blocks
- Start with { and end with }
- All prices must be numbers (not strings)
- Verify total is correct BEFORE outputting`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const model = getGeminiAI().getGenerativeModel({
        model: config.gemini.model,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192, // Reduced from 16384 - faster response
          responseMimeType: 'application/json', // Force JSON response
        },
      });

      // Reduced timeout for video processing - fail fast
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Le service met trop de temps à répondre')), 60000),
      ); // 60s timeout (reduced from 90s)

      const resultPromise = model.generateContent([
        VIDEO_PARSING_PROMPT,
        {
          inlineData: {
            mimeType,
            data: videoBase64,
          },
        },
      ]);

      const result = await Promise.race([resultPromise, timeoutPromise]);
      const response = result.response;
      const text = response.text();

      console.log('Gemini video response length:', text.length);
      console.log('Gemini video response:', text.substring(0, 500));

      // Check if response appears truncated (incomplete JSON)
      const trimmedText = text.trim();
      if (!trimmedText.endsWith('}') && !trimmedText.endsWith('```')) {
        console.error('Video response appears truncated:', text.substring(text.length - 100));
        throw new Error('Response truncated - retrying');
      }

      // Extract JSON from response
      let jsonStr = text;
      
      // Try to extract JSON from markdown code blocks first (with non-greedy match)
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (jsonMatch && jsonMatch[1].includes('{')) {
        jsonStr = jsonMatch[1];
      } else {
        // Try to find JSON object directly - find balanced braces
        const jsonStartIndex = text.indexOf('{');
        if (jsonStartIndex !== -1) {
          // Find the matching closing brace
          let braceCount = 0;
          let endIndex = -1;
          for (let i = jsonStartIndex; i < text.length; i++) {
            if (text[i] === '{') braceCount++;
            if (text[i] === '}') braceCount--;
            if (braceCount === 0) {
              endIndex = i;
              break;
            }
          }
          if (endIndex !== -1) {
            jsonStr = text.substring(jsonStartIndex, endIndex + 1);
          } else {
            // JSON is incomplete - find last closing brace
            const lastBrace = text.lastIndexOf('}');
            if (lastBrace > jsonStartIndex) {
              jsonStr = text.substring(jsonStartIndex, lastBrace + 1);
              console.warn('JSON appears truncated, using partial extraction');
            }
          }
        }
      }

      jsonStr = jsonStr.trim();

      // Check if extracted JSON is complete
      if (!jsonStr.endsWith('}')) {
        console.error('Extracted JSON is incomplete:', jsonStr.substring(Math.max(0, jsonStr.length - 100)));
        throw new Error('Incomplete JSON extracted - retrying');
      }

      // Additional validation: check for balanced braces
      const openBraces = (jsonStr.match(/{/g) || []).length;
      const closeBraces = (jsonStr.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        console.error(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
        throw new Error('Malformed JSON - unbalanced braces');
      }

      // Fix common JSON issues
      jsonStr = jsonStr
        .replace(/'/g, '"')
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}\]])/g, ':"$1"$2')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      // Fix thousand separators
      jsonStr = jsonStr.replace(
        /:\s*(\d{1,3})[\s,.](\d{3})(?=\s*[,}\]])/g,
        ':$1$2'
      );
      jsonStr = jsonStr.replace(
        /:\s*(\d{1,3})[\s,.](\d{3})[\s,.](\d{3})(?=\s*[,}\]])/g,
        ':$1$2$3'
      );

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Video JSON parse error:', parseError);
        console.error('Failed JSON string:', jsonStr.substring(0, 500));
        throw new Error('Impossible de lire la vidéo. Veuillez réessayer plus lentement.');
      }

      // Transform and validate the result
      // Handle cases where Gemini returns "null" as a string
      const storeNameRaw = parsed.storeName;
      const storeName = storeNameRaw && storeNameRaw !== 'null' && storeNameRaw !== 'undefined' 
        ? storeNameRaw 
        : 'Magasin inconnu';
      
      // Parse items first - clean OCR spacing errors
      const rawItems: ReceiptItem[] = (parsed.items || []).map((item: any, index: number) => {
        const cleanedName = cleanItemName(item.name || 'Article inconnu');
        return {
          id: `item_${index}`,
          name: cleanedName,
          nameNormalized: normalizeProductName(cleanedName),
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          totalPrice: Number(item.totalPrice) || 0,
          unit: item.unit || 'pièce',
          category: item.category,
          confidence: Number(item.confidence) || 0.8,
        };
      });
      
      // Merge multi-line items first
      const mergedItems = mergeMultiLineItems(rawItems);
      
      // Deduplicate items
      const deduplicatedItems = deduplicateItems(mergedItems);
      console.log(`📦 Video processing: ${rawItems.length} items -> ${mergedItems.length} merged -> ${deduplicatedItems.length} unique items`);
      
      const receipt: ParsedReceipt = {
        storeName: storeName,
        storeNameNormalized: normalizeStoreName(storeName),
        storeAddress: parsed.storeAddress,
        storePhone: parsed.storePhone,
        receiptNumber: parsed.receiptNumber,
        date: parsed.date || new Date().toISOString().split('T')[0],
        currency: parsed.currency === 'USD' ? 'USD' : 'CDF',
        items: deduplicatedItems,
        subtotal: parsed.subtotal ? Number(parsed.subtotal) : undefined,
        tax: parsed.tax ? Number(parsed.tax) : undefined,
        total: Number(parsed.total) || 0,
        rawText: parsed.rawText,
        isVideoScan: true, // Mark as video scan for analytics
      };

      // VIDEO TOTAL VALIDATION: Smart validation to catch wrong totals
      const calculatedTotal = receipt.items.reduce((sum, item) => {
        const itemTotal = item.totalPrice || (item.unitPrice * item.quantity);
        return sum + itemTotal;
      }, 0);
      
      console.log(`Video total validation: parsed=${receipt.total}, calculated=${calculatedTotal}, items=${receipt.items.length}`);
      
      // Case 1: Parsed total is 0 but we have items - use calculated
      if (receipt.total === 0 && calculatedTotal > 0) {
        console.log('⚠️ Video: Using calculated total (parsed was 0)');
        receipt.total = calculatedTotal;
      } 
      // Case 2: Parsed total is WAY too high (might be receipt number/customer ID)
      // A realistic total should be within 2x of calculated for small receipts, 1.5x for large
      else if (calculatedTotal > 0) {
        const tolerance = calculatedTotal > 100000 ? 1.5 : 2.0; // Stricter for large amounts
        
        if (receipt.total > calculatedTotal * 10) {
          // Parsed total is 10x higher - definitely wrong (probably receipt number)
          console.log('⚠️ Video: Parsed total is WAY too high (likely receipt number), using calculated');
          receipt.total = calculatedTotal;
        } else if (receipt.total > calculatedTotal * tolerance && receipt.total > 1000000) {
          // Large number that's much higher than items - suspicious
          console.log('⚠️ Video: Parsed total suspiciously high, using calculated');
          receipt.total = calculatedTotal;
        } else if (receipt.total < calculatedTotal * 0.5) {
          // Parsed total is less than half - might be partial or missing zeros
          console.log('⚠️ Video: Parsed total seems too low, using calculated');
          receipt.total = calculatedTotal;
        }
        // Case 3: Totals are reasonably close - keep the parsed one
        else if (Math.abs(receipt.total - calculatedTotal) / calculatedTotal < 0.15) {
          // Within 15% - totals match well, keep parsed (it includes tax, fees, etc.)
          console.log('✅ Video: Total validated - parsed and calculated match within 15%');
        }
      }

      // Validate we got meaningful data
      if (receipt.items.length === 0 && receipt.total === 0) {
        throw new Error('Aucun article détecté dans la vidéo. Scannez plus lentement.');
      }

      console.log(`Video scan extracted ${receipt.items.length} items, final total: ${receipt.total}`);
      return receipt;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Video parse attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        // Shorter backoff for faster retries
        const delay = Math.min(1000 * (attempt + 1), 3000);
        console.log(`Retrying video parse in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // Provide a more user-friendly error message
  const errorMsg = lastError?.message || 'Erreur inconnue';
  if (errorMsg.includes('truncated') || errorMsg.includes('Incomplete')) {
    throw new Error('La vidéo est trop longue ou complexe. Essayez de scanner plus lentement ou prenez une photo.');
  }
  throw lastError || new Error('Erreur lors de l\'analyse de la vidéo');
}

/**
 * Parse receipt image using Gemini AI
 * V3 FIX: Enhanced error handling with retry logic
 */
async function parseWithGemini(
  imageBase64: string,
  mimeType: string,
): Promise<ParsedReceipt> {
  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const model = getGeminiAI().getGenerativeModel({
        model: config.gemini.model,
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent output
          maxOutputTokens: 2048,
        },
      });

      // Set timeout for Gemini API call
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Le service met trop de temps à répondre')), 45000),
      ); // 45s

      const resultPromise = model.generateContent([
        PARSING_PROMPT,
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ]);

      const result = await Promise.race([resultPromise, timeoutPromise]);
      const response = result.response;
      const text = response.text();

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = text;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // Clean and validate JSON string
      jsonStr = jsonStr.trim();

      // Fix common JSON issues that Gemini might produce
      jsonStr = jsonStr
        .replace(/'/g, '"') // Replace single quotes with double quotes
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Quote unquoted property names
        .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}\]])/g, ':"$1"$2') // Quote unquoted string values
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
      
      // Fix thousand separators in numbers (e.g., "3 768" -> "3768", "1,500" -> "1500")
      // This handles space, comma, or period as thousand separators for large numbers
      jsonStr = jsonStr.replace(
        /:\s*(\d{1,3})[\s,.](\d{3})(?=\s*[,}\]])/g,
        ':$1$2'
      );
      // Handle multiple thousand separators (e.g., "1 234 567" -> "1234567")
      jsonStr = jsonStr.replace(
        /:\s*(\d{1,3})[\s,.](\d{3})[\s,.](\d{3})(?=\s*[,}\]])/g,
        ':$1$2$3'
      );

      console.log('Cleaned JSON string:', jsonStr.substring(0, 500));

      // Parse JSON with error handling
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Raw Gemini response:', text);
        console.error('Cleaned JSON:', jsonStr);

        // Log the actual parse error for debugging
        console.error('Parse error details:', 
          parseError instanceof Error ? parseError.message : String(parseError)
        );
        
        throw new Error(
          `Impossible de lire ce reçu. Veuillez réessayer avec une image plus claire.`,
        );
      }

      // Validate parsed data structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Impossible de lire ce reçu. Veuillez réessayer avec une image plus claire.');
      }

      if (!parsed.storeName && !parsed.items) {
        console.warn('Gemini response missing required fields:', parsed);
        // Try to create a minimal valid receipt
        parsed = {
          storeName: 'Unknown Store',
          date: new Date().toISOString().split('T')[0],
          currency: 'CDF',
          items: [],
          total: 0,
          ...parsed, // Merge any existing valid fields
        };
      }
      
      /**
       * Parse numeric value that might contain thousand separators
       * Handles formats: "3 768", "3,768", "3.768", 3768
       */
      const parseNumericValue = (value: any): number => {
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          // Remove thousand separators (space, comma as thousand sep)
          // But preserve decimal point
          const cleaned = value
            .replace(/\s/g, '') // Remove spaces
            .replace(/,(?=\d{3})/g, ''); // Remove comma if followed by 3 digits (thousand sep)
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };
      
      const items: ReceiptItem[] = (parsed.items || []).map(
        (item: Partial<ReceiptItem>) => {
          const quantity = parseNumericValue(item.quantity) || 1;
          const unitPrice = parseNumericValue(item.unitPrice);
          const totalPrice = parseNumericValue(item.totalPrice) || quantity * unitPrice;
          const cleanedName = cleanItemName(item.name || 'Unknown Item');
          
          return {
            id: generateItemId(),
            name: cleanedName,
            nameNormalized: normalizeProductName(cleanedName),
            quantity,
            unitPrice,
            totalPrice,
            unit: item.unit,
            category: item.category || 'Autres',
            confidence: 0.85, // Default confidence for Gemini parsing
          };
        },
      );

      // Merge multi-line items first
      const mergedItems = mergeMultiLineItems(items);

      // Deduplicate items by similar name + same price
      const deduplicatedItems = deduplicateItems(mergedItems);
      console.log(`📦 Processing: ${items.length} items -> ${mergedItems.length} merged -> ${deduplicatedItems.length} unique items`);

      // Build parsed receipt - exclude undefined fields for Firestore compatibility
      // Handle cases where Gemini returns "null" as a string
      const storeNameRaw = parsed.storeName;
      const storeName = storeNameRaw && storeNameRaw !== 'null' && storeNameRaw !== 'undefined' && storeNameRaw !== 'Unknown Store'
        ? storeNameRaw 
        : 'Magasin inconnu';
        
      const receipt: ParsedReceipt = {
        storeName: storeName,
        storeNameNormalized: normalizeStoreName(storeName),
        storeAddress: parsed.storeAddress || null,
        storePhone: parsed.storePhone || null,
        receiptNumber: parsed.receiptNumber || null,
        date: parsed.date || new Date().toISOString().split('T')[0],
        currency: parsed.currency === 'CDF' ? 'CDF' : 'USD',
        items: deduplicatedItems,
        total:
          parseNumericValue(parsed.total) ||
          deduplicatedItems.reduce((sum, item) => sum + item.totalPrice, 0),
      };
      
      // Only add optional numeric fields if they have valid values
      const subtotalValue = parseNumericValue(parsed.subtotal);
      if (subtotalValue > 0) {
        receipt.subtotal = subtotalValue;
      }
      
      const taxValue = parseNumericValue(parsed.tax);
      if (taxValue > 0) {
        receipt.tax = taxValue;
      }
      
      const totalUSDValue = parseNumericValue(parsed.totalUSD);
      if (totalUSDValue > 0) {
        receipt.totalUSD = totalUSDValue;
      }
      
      const totalCDFValue = parseNumericValue(parsed.totalCDF);
      if (totalCDFValue > 0) {
        receipt.totalCDF = totalCDFValue;
      }

      return receipt;
    } catch (error: any) {
      lastError = error;

      // Handle specific Gemini errors
      if (error.message?.includes('API_KEY_INVALID')) {
        throw new functions.https.HttpsError(
          'internal',
          'Configuration erreur. Contactez le support.',
        );
      }

      if (error.message?.includes('QUOTA_EXCEEDED')) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Service temporairement saturé. Réessayez dans 1 heure.',
        );
      }

      if (error.message?.includes('CONTENT_POLICY_VIOLATION')) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Image inappropriée détectée. Veuillez scanner un reçu valide.',
        );
      }

      if (error.message?.includes('timeout')) {
        console.warn(`Service timeout on attempt ${attempt + 1}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve =>
            setTimeout(resolve, 2000 * (attempt + 1)),
          ); // Exponential backoff
          continue;
        }
        throw new functions.https.HttpsError(
          'deadline-exceeded',
          'Le service met trop de temps à répondre. Réessayez avec une image plus petite.',
        );
      }

      // If last retry, throw
      if (attempt === MAX_RETRIES) {
        throw lastError;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw (
    lastError ||
    new functions.https.HttpsError(
      'internal',
      'Impossible de traiter ce reçu après plusieurs tentatives. Veuillez réessayer avec une photo plus claire.',
    )
  );
}

/**
 * Callable function to parse receipt
 * Called from mobile app with image base64
 */
export const parseReceipt = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to parse receipts',
      );
    }

    const userId = context.auth.uid;
    const {imageBase64, mimeType = 'image/jpeg'} = data;

    if (!imageBase64) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Image data is required',
      );
    }

    try {
      // V1 FIX: Validate image data before processing
      const validation = validateImageData(imageBase64, mimeType);
      if (!validation.valid) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          validation.error!,
        );
      }

      // V2 FIX: Detect if image contains a receipt
      const detection = await detectReceiptContent(imageBase64, mimeType);
      if (!detection.isReceipt || detection.confidence < 0.7) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Cette image ne semble pas être un reçu. ${detection.reason || 'Veuillez scanner un reçu valide.'}`,
        );
      }

      // H1 FIX: Check image quality - only reject VERY poor quality images
      // Be lenient here - let Gemini try to parse, and validate results after
      const qualityCheck = await checkImageQuality(imageBase64);
      if (!qualityCheck.isAcceptable) {
        // Only reject extremely poor quality (sharpness < 20 or brightness < 20)
        // These are truly unreadable - pitch black or motion blur
        if (qualityCheck.metrics.sharpness < 20 || qualityCheck.metrics.brightness < 20) {
          const warningMsg = qualityCheck.suggestions.join(' ');
          throw new functions.https.HttpsError(
            'invalid-argument',
            `La qualité de l'image est insuffisante. ${warningMsg}`,
          );
        }
        // Log warnings but let Gemini try - it's often better at reading blurry text than expected
        console.warn(`Image quality issues (proceeding anyway): ${qualityCheck.warnings.join('. ')}. Metrics: sharpness=${qualityCheck.metrics.sharpness}, brightness=${qualityCheck.metrics.brightness}`);
      }

      // V5 FIX: Atomic subscription check and increment with transaction
      const subscriptionRef = db.doc(collections.subscription(userId));

      await db.runTransaction(async transaction => {
        const subscriptionDoc = await transaction.get(subscriptionRef);
        let subscription = subscriptionDoc.data();

        if (!subscription) {
          // Initialize subscription for new user
          subscription = {
            userId,
            trialScansUsed: 0,
            trialScansLimit: config.app.trialScanLimit,
            isSubscribed: false,
            status: 'trial',
            autoRenew: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          transaction.set(subscriptionRef, subscription);
        }

        // Check if user can scan (skip if limit is -1 for unlimited)
        const isUnlimited =
          config.app.trialScanLimit === -1 ||
          subscription.trialScansLimit === -1;
        const canScan =
          subscription.isSubscribed ||
          isUnlimited ||
          subscription.trialScansUsed < subscription.trialScansLimit;

        if (!canScan) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            `Limite d'essai atteinte (${subscription.trialScansUsed}/${subscription.trialScansLimit}). Abonnez-vous pour continuer.`,
          );
        }

        // Atomically increment scan count within transaction
        transaction.update(subscriptionRef, {
          trialScansUsed: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Now parse receipt - scan limit already reserved
      const parsedReceipt = await parseWithGemini(imageBase64, mimeType);

      // QUALITY CHECK: Validate that the receipt was actually readable
      const hasStoreName = parsedReceipt.storeName && parsedReceipt.storeName !== 'Unknown Store';
      const hasItems = parsedReceipt.items && parsedReceipt.items.length > 0;
      const hasTotal = parsedReceipt.total > 0;
      const hasValidItems = parsedReceipt.items.some(
        item => item.name && item.name !== 'Unknown Item' && item.name !== 'Unavailable name' && item.unitPrice > 0
      );
      
      // If receipt is unreadable, reject it
      if (!hasItems || (!hasValidItems && !hasTotal)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'La qualité de l\'image est insuffisante pour lire le reçu. Veuillez reprendre la photo avec un meilleur éclairage et en vous rapprochant du reçu.',
        );
      }
      
      // If store name is unknown but we have items, warn but continue
      if (!hasStoreName && hasItems) {
        console.warn('Receipt parsed but store name could not be determined');
      }
      
      // If no items have valid prices, reject
      if (parsedReceipt.items.every(item => item.unitPrice === 0)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Impossible de lire les prix sur ce reçu. L\'image est peut-être floue ou trop sombre. Veuillez reprendre la photo.',
        );
      }

      // H2 FIX: Check for duplicate receipts
      const duplicateCheck = await detectDuplicateReceipt(
        userId,
        imageBase64,
        parsedReceipt,
      );

      if (duplicateCheck.isDuplicate) {
        throw new functions.https.HttpsError(
          'already-exists',
          `Ce reçu a déjà été scanné. Scan ID: ${duplicateCheck.existingReceiptId}`,
        );
      }

      // Get user profile to include city
      const userProfileRef = db.doc(collections.userDoc(userId));
      const userProfileDoc = await userProfileRef.get();
      const userProfile = userProfileDoc.data();

      // Calculate perceptual hash for storage
      const buffer = Buffer.from(imageBase64, 'base64');
      const imageHash = await phash(buffer);

      // Create receipt document
      const receiptRef = db.collection(collections.receipts(userId)).doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      await receiptRef.set({
        ...parsedReceipt,
        imageHash, // Store hash for duplicate detection
        id: receiptRef.id,
        userId,
        city: userProfile?.defaultCity || null,
        processingStatus: 'completed',
        createdAt: now,
        updatedAt: now,
        scannedAt: now,
      });

      // Scan count already incremented atomically in transaction above
      // No need to increment again

      // Update user stats for achievements
      await updateUserStats(userId, parsedReceipt);

      // Log suspicious items before returning
      const suspiciousItems = parsedReceipt.items?.filter(item => 
        item.name && (item.name.includes('prite') || item.name.match(/\s+[a-z]\d+\s+[a-z]\s+[a-z]/))
      );
      if (suspiciousItems && suspiciousItems.length > 0) {
        console.log('[Cloud Function] Suspicious items being returned:', suspiciousItems.map(item => item.name));
      }

      return {
        success: true,
        receiptId: receiptRef.id,
        receipt: parsedReceipt,
      };
    } catch (error) {
      console.error('Receipt parsing error:', error);
      console.error('Error name:', (error as Error).name);
      console.error('Error message:', (error as Error).message);
      console.error('Error stack:', (error as Error).stack);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Return user-friendly error message without exposing internal details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for common error patterns and provide helpful messages
      if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        throw new functions.https.HttpsError(
          'internal',
          'Le reçu est difficile à lire. Veuillez réessayer avec une image plus claire et un meilleur éclairage.',
        );
      }
      
      if (errorMessage.includes('timeout') || errorMessage.includes('trop de temps')) {
        throw new functions.https.HttpsError(
          'deadline-exceeded',
          'Le traitement a pris trop de temps. Réessayez avec une image plus petite.',
        );
      }
      
      // Generic error for all other cases
      throw new functions.https.HttpsError(
        'internal',
        'Impossible de traiter ce reçu. Veuillez réessayer avec une photo plus claire.',
      );
    }
  });

/**
 * Merge multi-page receipt with validation
 * H3 FIX: Multi-page receipt validation and merging
 */
async function mergeMultiPageReceipt(
  parsedResults: ParsedReceipt[],
  images: string[],
): Promise<ParsedReceipt> {
  // 1. Validate all pages are from same receipt
  // Filter out empty/null/unknown store names - middle pages of long receipts may not have visible store name
  const storeNames = parsedResults
    .map(r => r.storeNameNormalized)
    .filter(name => name && name !== '' && name !== 'null' && name !== 'unknown_store');
  const uniqueStores = new Set(storeNames);

  // Only reject if we have 2+ DIFFERENT actual store names (not when some pages have no store)
  if (uniqueStores.size > 1) {
    throw new Error(
      `Plusieurs reçus détectés: ${Array.from(uniqueStores).join(', ')}. Scannez un seul reçu à la fois.`,
    );
  }

  // 2. Detect duplicate pages using perceptual hashing
  const hashes = await Promise.all(
    images.map(async img => {
      const buffer = Buffer.from(img, 'base64');
      return await phash(buffer);
    }),
  );

  const duplicates = hashes.filter(
    (hash: string, index: number) => hashes.indexOf(hash) !== index,
  );

  if (duplicates.length > 0) {
    throw new Error(
      'Pages dupliquées détectées. Supprimez les images en double.',
    );
  }

  // 3. Find page with store header
  const headerPage =
    parsedResults.find(p => p.storeName && p.storeName !== 'Unknown Store') ||
    parsedResults[0];

  // 4. Find page with total (usually last)
  const totalPage =
    parsedResults
      .slice()
      .reverse()
      .find(p => p.total > 0) || parsedResults[parsedResults.length - 1];

  // 5. Collect all unique items (SMART deduplication by name similarity + price)
  const itemMap = new Map<string, ReceiptItem>();

  /**
   * Check if two product names are similar (fuzzy match)
   * This catches OCR errors like "Yog" vs "Yogurt"
   */
  function areNamesSimilar(name1: string, name2: string): boolean {
    // If one name is a substring of the other, they're similar
    if (name1.includes(name2) || name2.includes(name1)) {
      return true;
    }
    
    // Calculate simple Levenshtein-like similarity
    const longer = name1.length > name2.length ? name1 : name2;
    const shorter = name1.length > name2.length ? name2 : name1;
    
    // If lengths differ by more than 50%, probably different items
    if (longer.length > shorter.length * 1.5) {
      return false;
    }
    
    // Count matching characters in order
    let matches = 0;
    let j = 0;
    for (let i = 0; i < shorter.length && j < longer.length; i++) {
      if (shorter[i] === longer[j]) {
        matches++;
        j++;
      } else {
        j++;
      }
    }
    
    // If 70%+ characters match, consider similar
    return matches / shorter.length >= 0.7;
  }

  for (const page of parsedResults) {
    for (const item of page.items) {
      let foundSimilar = false;

      // Check if there's already a similar item with the same price
      for (const [, existingItem] of itemMap.entries()) {
        // Same price AND similar name = likely duplicate with OCR correction
        if (
          existingItem.unitPrice === item.unitPrice &&
          areNamesSimilar(existingItem.nameNormalized, item.nameNormalized)
        ) {
          // Merge items - keep the LONGER/more complete name (likely the corrected one)
          if (item.name.length > existingItem.name.length) {
            existingItem.name = item.name;
            existingItem.nameNormalized = item.nameNormalized;
          }
          existingItem.quantity += item.quantity;
          existingItem.totalPrice += item.totalPrice;
          foundSimilar = true;
          break;
        }
      }

      if (!foundSimilar) {
        // New unique item
        const key = `${item.nameNormalized}-${item.unitPrice}`;
        itemMap.set(key, {...item});
      }
    }
  }

  const allItems = Array.from(itemMap.values());

  // 6. Validate total matches item sum
  const itemsTotal = allItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const declaredTotal = totalPage.total || 0;
  const tolerance = declaredTotal * 0.1; // 10% tolerance

  if (Math.abs(itemsTotal - declaredTotal) > tolerance && declaredTotal > 0) {
    console.warn(
      `Total mismatch: Items sum to ${itemsTotal} but receipt says ${declaredTotal}`,
    );
  }

  return {
    ...headerPage,
    items: allItems,
    subtotal: totalPage.subtotal,
    tax: totalPage.tax,
    total: totalPage.total || itemsTotal,
    totalUSD: totalPage.totalUSD,
    totalCDF: totalPage.totalCDF,
  };
}

/**
 * V2 version with multi-image support - HTTP endpoint
 */
export const parseReceiptV2 = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    // Verify authentication via Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).send('Unauthorized: Missing or invalid Authorization header');
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).send('Unauthorized: Invalid token');
      return;
    }

    const userId = decodedToken.uid;
    const {data} = req.body;
    const {images, mimeType = 'image/jpeg'} = data || req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).send('At least one image is required');
      return;
    }

    try {
      // Check subscription
      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();
      const subscription = subscriptionDoc.data();

      if (!subscription) {
        res.status(403).send('Subscription not initialized');
        return;
      }

      // Temporarily bypass subscription check for testing
      // const canScan =
      //   subscription.isSubscribed ||
      //   subscription.trialScansUsed < subscription.trialScansLimit;

      // if (!canScan) {
      //   res.status(403).send('Trial limit reached');
      //   return;
      // }

      // Parse all images and merge results
      const parsedResults = await Promise.all(
        images.map((img: string) => parseWithGemini(img, mimeType)),
      );

      // H3 FIX: Use improved multi-page merging with validation
      const mergedReceipt = await mergeMultiPageReceipt(
        parsedResults,
        images,
      );

      // Get user profile to include city
      const userProfileRef = db.doc(collections.userDoc(userId));
      const userProfileDoc = await userProfileRef.get();
      const userProfile = userProfileDoc.data();

      // Save receipt
      const receiptRef = db.collection(collections.receipts(userId)).doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      await receiptRef.set({
        ...mergedReceipt,
        id: receiptRef.id,
        userId,
        city: userProfile?.defaultCity || null,
        processingStatus: 'completed',
        pageCount: images.length,
        createdAt: now,
        updatedAt: now,
        scannedAt: now,
      });

      // Update scan count
      await subscriptionRef.update({
        trialScansUsed: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });

      res.json({
        success: true,
        receiptId: receiptRef.id,
        receipt: mergedReceipt,
        pageCount: images.length,
      });
    } catch (error) {
      console.error('Multi-page receipt parsing error:', error);
      res.status(500).send('Impossible de traiter ce reçu. Veuillez réessayer.');
    }
  });

/**
 * V2 Callable version - Multi-image support via callable function
 * Use this from mobile apps instead of the HTTP endpoint
 */
export const parseReceiptMulti = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to parse receipts',
      );
    }

    const userId = context.auth.uid;
    const {images, mimeType = 'image/jpeg'} = data;

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'At least one image is required',
      );
    }

    try {
      // Check subscription
      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();
      const subscription = subscriptionDoc.data();

      if (!subscription) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Subscription not initialized',
        );
      }

      // Parse all images and merge results
      const parsedResults = await Promise.all(
        images.map((img: string) => parseWithGemini(img, mimeType)),
      );

      // Use improved multi-page merging with validation
      const mergedReceipt = await mergeMultiPageReceipt(
        parsedResults,
        images,
      );

      // Get user profile to include city
      const userProfileRef = db.doc(collections.userDoc(userId));
      const userProfileDoc = await userProfileRef.get();
      const userProfile = userProfileDoc.data();

      // Save receipt
      const receiptRef = db.collection(collections.receipts(userId)).doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      await receiptRef.set({
        ...mergedReceipt,
        id: receiptRef.id,
        userId,
        city: userProfile?.defaultCity || null,
        processingStatus: 'completed',
        pageCount: images.length,
        createdAt: now,
        updatedAt: now,
        scannedAt: now,
      });

      // Update scan count
      await subscriptionRef.update({
        trialScansUsed: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });

      return {
        success: true,
        receiptId: receiptRef.id,
        receipt: mergedReceipt,
        pageCount: images.length,
      };
    } catch (error: any) {
      console.error('Multi-page receipt parsing error:', error);
      
      // Re-throw as HttpsError if not already
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      // User-friendly error message
      const errorMsg = error.message || '';
      if (errorMsg.includes('JSON') || errorMsg.includes('parse')) {
        throw new functions.https.HttpsError(
          'internal',
          'Le reçu est difficile à lire. Veuillez réessayer avec une image plus claire.',
        );
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'Impossible de traiter ce reçu. Veuillez réessayer avec une photo plus claire.',
      );
    }
  });

/**
 * Parse receipt from video scan
 * Ideal for long receipts - user scans slowly down the receipt
 */
export const parseReceiptVideo = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 300, // 5 minutes for video processing
    memory: '2GB', // More memory for video
    secrets: ['GEMINI_API_KEY'],
  })
  .https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      // Verify Firebase Auth token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({error: 'Non autorisé. Token manquant.'});
        return;
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      // Parse request body
      const data = req.body.data || req.body;
      const {videoBase64, mimeType = 'video/mp4'} = data || {};

      if (!videoBase64) {
        res.status(400).json({error: 'Vidéo requise.'});
        return;
      }

      // Validate video data
      const validation = validateVideoData(videoBase64, mimeType);
      if (!validation.valid) {
        res.status(400).json({error: validation.error});
        return;
      }

      // Check subscription and scan limits
      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();

      if (!subscriptionDoc.exists) {
        res.status(403).json({error: 'Abonnement non initialisé.'});
        return;
      }

      const subscription = subscriptionDoc.data()!;
      const canScanResult = canUserScan(subscription);

      if (!canScanResult.canScan) {
        res.status(403).json({
          error: canScanResult.reason,
          subscriptionStatus: subscription.status,
          scansUsed: subscription.trialScansUsed || subscription.monthlyScansUsed || 0,
        });
        return;
      }

      console.log(`[Video] Processing video scan for user ${userId}`);

      // Parse video with Gemini
      const parsedReceipt = await parseVideoWithGemini(videoBase64, mimeType);

      // Get user profile for city
      const userProfileRef = db.doc(collections.userDoc(userId));
      const userProfileDoc = await userProfileRef.get();
      const userProfile = userProfileDoc.data();

      // Save receipt
      const receiptRef = db.collection(collections.receipts(userId)).doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      await receiptRef.set({
        ...parsedReceipt,
        id: receiptRef.id,
        userId,
        city: userProfile?.defaultCity || null,
        processingStatus: 'completed',
        isVideoScan: true,
        createdAt: now,
        updatedAt: now,
        scannedAt: now,
      });

      // Update scan count
      await subscriptionRef.update({
        trialScansUsed: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      });

      // Update user stats
      try {
        await updateUserStats(userId, parsedReceipt);
      } catch (statsError) {
        console.warn('Failed to update user stats:', statsError);
      }

      console.log(`[Video] Successfully parsed video scan: ${receiptRef.id}, ${parsedReceipt.items.length} items`);

      res.json({
        success: true,
        receiptId: receiptRef.id,
        receipt: parsedReceipt,
        isVideoScan: true,
        itemCount: parsedReceipt.items.length,
      });

    } catch (error: any) {
      console.error('Video receipt parsing error:', error);
      res.status(500).json({
        error: error.message || 'Erreur lors de l\'analyse de la vidéo',
      });
    }
  });

/**
 * Calculate actual savings for a receipt by comparing prices against best available prices
 */
async function calculateReceiptSavings(
  userId: string,
  receipt: ParsedReceipt,
): Promise<number> {
  if (!receipt.items || receipt.items.length === 0) {
    return 0;
  }

  try {
    // Normalize product names for matching
    const normalizeProductName = (name: string): string => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Collect all normalized product names
    const normalizedNames = receipt.items.map(
      item => item.nameNormalized || normalizeProductName(item.name),
    );

    // Remove duplicates to avoid unnecessary queries
    const uniqueNormalizedNames = [...new Set(normalizedNames)];

    // Query all price data for these products in batches (Firestore 'in' limit is 10)
    const batchSize = 10;
    const priceDataMap = new Map<string, any[]>();

    for (let i = 0; i < uniqueNormalizedNames.length; i += batchSize) {
      const batch = uniqueNormalizedNames.slice(i, i + batchSize);

      const priceQuery = await db
        .collection(collections.prices)
        .where('productNameNormalized', 'in', batch)
        .orderBy('recordedAt', 'desc')
        .get();

      // Group prices by normalized name
      priceQuery.docs.forEach(doc => {
        const pricePoint = doc.data();
        const key = pricePoint.productNameNormalized;

        if (!priceDataMap.has(key)) {
          priceDataMap.set(key, []);
        }
        priceDataMap.get(key)!.push(pricePoint);
      });
    }

    let totalSavings = 0;

    // Calculate savings for each item
    for (const item of receipt.items) {
      const normalizedName =
        item.nameNormalized || normalizeProductName(item.name);
      const prices = priceDataMap.get(normalizedName) || [];

      if (prices.length > 0) {
        // Find the best price for this item
        const priceValues = prices.map(p => p.price);
        const bestPrice = Math.min(...priceValues);

        // Calculate savings if user paid more than the best price
        if (item.unitPrice > bestPrice) {
          const itemSavings = (item.unitPrice - bestPrice) * item.quantity;
          totalSavings += itemSavings;
        }
      }
    }

    return Math.round(totalSavings * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Error calculating receipt savings:', error);
    return 0; // Return 0 on error to avoid breaking the flow
  }
}

/**
 * Update user stats for achievements
 */
async function updateUserStats(
  userId: string,
  receipt: ParsedReceipt,
): Promise<void> {
  try {
    const userRef = db
      .collection('artifacts')
      .doc(config.app.id)
      .collection('users')
      .doc(userId);

    // Get current stats
    const userDoc = await userRef.get();
    let stats =
      userDoc.exists && userDoc.data()?.stats
        ? userDoc.data()!.stats
        : {
            totalScans: 0,
            totalSpent: 0,
            totalSavings: 0,
            currentStreak: 0,
            longestStreak: 0,
            level: 1,
            xp: 0,
            xpToNextLevel: 100,
            shopsVisited: new Set(),
            itemsScanned: 0,
            bestPricesFound: 0,
          };

    // Update stats
    stats.totalScans = (stats.totalScans || 0) + 1;
    stats.totalSpent = (stats.totalSpent || 0) + (receipt.total || 0);

    // Calculate actual savings from price comparisons
    const actualSavings = await calculateReceiptSavings(userId, receipt);
    stats.totalSavings = (stats.totalSavings || 0) + actualSavings;

    stats.itemsScanned =
      (stats.itemsScanned || 0) + (receipt.items?.length || 0);

    // Calculate XP
    const xpEarned = 10 + Math.min(receipt.items?.length || 0, 10); // Base XP + items bonus
    stats.xp = (stats.xp || 0) + xpEarned;

    // Level up logic
    while (stats.xp >= stats.xpToNextLevel) {
      stats.xp -= stats.xpToNextLevel;
      stats.level = (stats.level || 1) + 1;
      stats.xpToNextLevel = Math.floor(100 * Math.pow(1.5, stats.level - 1));
    }

    // Convert Set to array for Firestore
    if (stats.shopsVisited instanceof Set) {
      stats.shopsVisited = Array.from(stats.shopsVisited);
    }
    if (!Array.isArray(stats.shopsVisited)) {
      stats.shopsVisited = [];
    }
    if (receipt.storeName && !stats.shopsVisited.includes(receipt.storeName)) {
      stats.shopsVisited.push(receipt.storeName);
    }

    // Save updated stats
    await userRef.set({stats}, {merge: true});

    console.log(
      `[Stats] Updated stats for user ${userId}: ${stats.totalScans} scans, level ${stats.level}`,
    );
  } catch (error) {
    console.error('[Stats] Failed to update user stats:', error);
  }
}
