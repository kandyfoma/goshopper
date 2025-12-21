"use strict";
/**
 * Receipt Parsing Cloud Function
 * Uses Gemini AI to extract structured data from receipt images
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseReceiptV2 = exports.parseReceipt = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const config_1 = require("../config");
const sharp_1 = __importDefault(require("sharp"));
const sharp_phash_1 = __importDefault(require("sharp-phash"));
const db = admin.firestore();
// Gemini AI will be initialized lazily with the secret
let genAI = null;
function getGeminiAI() {
    if (!genAI) {
        const apiKey = process.env.GEMINI_API_KEY || config_1.config.gemini.apiKey;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }
        genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    return genAI;
}
/**
 * Validate image data before processing
 * V1 FIX: Image validation (format, size, magic bytes)
 */
function validateImageData(imageBase64, mimeType) {
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
            error: "Format d'image non supporté. Utilisez JPG, PNG ou WebP.",
        };
    }
    // 2. Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(imageBase64)) {
        return { valid: false, error: 'Image corrompue. Veuillez réessayer.' };
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
        return { valid: false, error: 'Image trop petite pour être lisible.' };
    }
    // 4. Decode and check actual image header (magic bytes)
    try {
        const buffer = Buffer.from(imageBase64, 'base64');
        // JPEG magic bytes: FF D8 FF
        // PNG magic bytes: 89 50 4E 47
        // WEBP magic bytes: 52 49 46 46 (RIFF)
        const isJPEG = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        const isPNG = buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47;
        const isWEBP = buffer[0] === 0x52 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x46;
        if (!isJPEG && !isPNG && !isWEBP) {
            return {
                valid: false,
                error: 'Fichier invalide. Envoyez une photo de reçu.',
            };
        }
    }
    catch (decodeError) {
        return {
            valid: false,
            error: 'Image corrompue. Impossible de lire le fichier.',
        };
    }
    return { valid: true };
}
/**
 * Detect if image contains a receipt
 * V2 FIX: Content detection (receipt vs non-receipt)
 */
async function detectReceiptContent(imageBase64, mimeType) {
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
            { inlineData: { mimeType, data: imageBase64 } },
        ]);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const detection = JSON.parse(jsonMatch[0]);
            return detection;
        }
    }
    catch (error) {
        console.error('Receipt detection failed:', error);
        // On error, be permissive and allow processing
        return { isReceipt: true, confidence: 0.5, reason: 'Detection unavailable' };
    }
    return {
        isReceipt: false,
        confidence: 0,
        reason: 'Could not analyze image',
    };
}
async function checkImageQuality(imageBase64) {
    const buffer = Buffer.from(imageBase64, 'base64');
    const image = (0, sharp_1.default)(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();
    const warnings = [];
    const suggestions = [];
    // Check resolution
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (width < 800 || height < 600) {
        warnings.push('Image très petite - le texte peut être illisible');
        suggestions.push('Rapprochez-vous du reçu ou utilisez un meilleur appareil photo');
    }
    // Check brightness (average luminance across all channels)
    const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) /
        stats.channels.length;
    if (avgBrightness < 50) {
        warnings.push('Image trop sombre');
        suggestions.push('Scannez dans un endroit bien éclairé');
    }
    else if (avgBrightness > 230) {
        warnings.push('Image trop claire/surexposée');
        suggestions.push('Réduisez la luminosité ou évitez la lumière directe');
    }
    // Estimate sharpness using Laplacian variance (simple blur detection)
    const { data, info } = await image.greyscale().raw().toBuffer({
        resolveWithObject: true,
    });
    // Calculate Laplacian variance as blur metric
    let laplacianSum = 0;
    const stride = info.width;
    for (let y = 1; y < info.height - 1; y++) {
        for (let x = 1; x < info.width - 1; x++) {
            const idx = y * stride + x;
            const laplacian = 4 * data[idx] -
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
    const isAcceptable = warnings.length === 0 ||
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
async function detectDuplicateReceipt(userId, imageBase64, receiptData) {
    try {
        // 1. Calculate perceptual hash of image
        const buffer = Buffer.from(imageBase64, 'base64');
        const hash = await (0, sharp_phash_1.default)(buffer);
        // 2. Check exact matches (same hash)
        const exactMatch = await db
            .collection(config_1.collections.receipts(userId))
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
            .collection(config_1.collections.receipts(userId))
            .where('storeNameNormalized', '==', receiptData.storeNameNormalized)
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .get();
        for (const doc of similarReceipts.docs) {
            const existing = doc.data();
            // Compare totals (within 5% tolerance for OCR errors)
            const totalDiff = Math.abs(existing.total - receiptData.total);
            const tolerance = receiptData.total * 0.05;
            if (totalDiff <= tolerance) {
                // Compare dates (same day or day before/after)
                const existingDate = existing.date
                    ? new Date(existing.date)
                    : existing.createdAt.toDate();
                const newDate = new Date(receiptData.date);
                const dayDiff = Math.abs((existingDate.getTime() - newDate.getTime()) / (1000 * 60 * 60 * 24));
                if (dayDiff <= 1) {
                    // Likely duplicate - calculate item similarity
                    const itemSimilarity = calculateItemSimilarity(existing.items, receiptData.items);
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
        return { isDuplicate: false };
    }
    catch (error) {
        console.error('Duplicate detection failed:', error);
        // On error, don't block the scan
        return { isDuplicate: false };
    }
}
/**
 * Calculate similarity between two item lists (0-1)
 */
function calculateItemSimilarity(items1, items2) {
    if (items1.length === 0 || items2.length === 0) {
        return 0;
    }
    let matchCount = 0;
    const maxLength = Math.max(items1.length, items2.length);
    for (const item1 of items1) {
        for (const item2 of items2) {
            // Compare normalized names and prices
            if (item1.nameNormalized === item2.nameNormalized &&
                Math.abs(item1.unitPrice - item2.unitPrice) < 0.01) {
                matchCount++;
                break;
            }
        }
    }
    return matchCount / maxLength;
}
// Prompt for receipt parsing - optimized for DRC market
const PARSING_PROMPT = `You are an expert receipt/invoice OCR and data extraction system. Your task is to CAREFULLY READ and extract ALL visible text and data from the receipt image provided.

⚠️ CRITICAL: You MUST extract the ACTUAL text visible in the image. DO NOT use placeholder text like "Test Store", "Item 1", "Item 2", etc.

READ THE IMAGE CAREFULLY and extract EXACTLY what you see:

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
      "name": "EXACT product name as written on receipt",
      "quantity": ACTUAL_NUMBER,
      "unitPrice": ACTUAL_PRICE,
      "totalPrice": ACTUAL_TOTAL,
      "unit": "kg/L/pcs/etc if shown",
      "category": "Alimentation/Boissons/Hygiène/Ménage/Bébé/Autres"
    }
  ],
  "subtotal": ACTUAL_SUBTOTAL_OR_NULL,
  "tax": ACTUAL_TAX_OR_NULL,
  "total": ACTUAL_TOTAL_AMOUNT,
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
10. For handwritten receipts, do your best to interpret the text

⚠️ IMPORTANT: Return ONLY the JSON object with ACTUAL data from the receipt image. Use double quotes for all strings. No markdown formatting, no explanations, no placeholder data.`;
/**
 * Generate unique ID for items
 */
function generateItemId() {
    return Math.random().toString(36).substring(2, 15);
}
/**
 * Normalize product name for matching
 */
function normalizeProductName(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s]/g, '') // Remove special chars
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
}
/**
 * Normalize store name
 */
function normalizeStoreName(name) {
    const knownStores = {
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
 * Parse receipt image using Gemini AI
 * V3 FIX: Enhanced error handling with retry logic
 */
async function parseWithGemini(imageBase64, mimeType) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const MAX_RETRIES = 2;
    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const model = getGeminiAI().getGenerativeModel({
                model: config_1.config.gemini.model,
                generationConfig: {
                    temperature: 0.1, // Low temperature for consistent output
                    maxOutputTokens: 2048,
                },
            });
            // Set timeout for Gemini API call
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini API timeout')), 45000)); // 45s
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
            console.log('Cleaned JSON string:', jsonStr.substring(0, 500));
            // Parse JSON with error handling
            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            }
            catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Raw Gemini response:', text);
                console.error('Cleaned JSON:', jsonStr);
                // Try to extract partial data or provide fallback
                const errorMessage = parseError instanceof Error
                    ? parseError.message
                    : String(parseError);
                throw new Error(`Failed to parse Gemini response as JSON: ${errorMessage}. Raw response: ${text.substring(0, 200)}`);
            }
            // Validate parsed data structure
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('Gemini response is not a valid object');
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
            const items = (parsed.items || []).map((item) => ({
                id: generateItemId(),
                name: item.name || 'Unknown Item',
                nameNormalized: normalizeProductName(item.name || ''),
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                totalPrice: item.totalPrice || (item.quantity || 1) * (item.unitPrice || 0),
                unit: item.unit,
                category: item.category || 'Autres',
                confidence: 0.85, // Default confidence for Gemini parsing
            }));
            // Build parsed receipt - use null instead of undefined for optional fields
            const receipt = {
                storeName: parsed.storeName || 'Unknown Store',
                storeNameNormalized: normalizeStoreName(parsed.storeName || ''),
                storeAddress: parsed.storeAddress || null,
                storePhone: parsed.storePhone || null,
                receiptNumber: parsed.receiptNumber || null,
                date: parsed.date || new Date().toISOString().split('T')[0],
                currency: parsed.currency === 'CDF' ? 'CDF' : 'USD',
                items,
                subtotal: (_a = parsed.subtotal) !== null && _a !== void 0 ? _a : null,
                tax: (_b = parsed.tax) !== null && _b !== void 0 ? _b : null,
                total: parsed.total ||
                    items.reduce((sum, item) => sum + item.totalPrice, 0),
                totalUSD: (_c = parsed.totalUSD) !== null && _c !== void 0 ? _c : null,
                totalCDF: (_d = parsed.totalCDF) !== null && _d !== void 0 ? _d : null,
            };
            return receipt;
        }
        catch (error) {
            lastError = error;
            // Handle specific Gemini errors
            if ((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes('API_KEY_INVALID')) {
                throw new functions.https.HttpsError('internal', 'Configuration erreur. Contactez le support.');
            }
            if ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes('QUOTA_EXCEEDED')) {
                throw new functions.https.HttpsError('resource-exhausted', 'Service temporairement saturé. Réessayez dans 1 heure.');
            }
            if ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('CONTENT_POLICY_VIOLATION')) {
                throw new functions.https.HttpsError('invalid-argument', 'Image inappropriée détectée. Veuillez scanner un reçu valide.');
            }
            if ((_h = error.message) === null || _h === void 0 ? void 0 : _h.includes('timeout')) {
                console.warn(`Gemini timeout on attempt ${attempt + 1}`);
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); // Exponential backoff
                    continue;
                }
                throw new functions.https.HttpsError('deadline-exceeded', 'Le service met trop de temps à répondre. Réessayez avec une image plus petite.');
            }
            // If last retry, throw
            if (attempt === MAX_RETRIES) {
                throw lastError;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
    throw (lastError ||
        new functions.https.HttpsError('internal', 'Failed to parse receipt after retries'));
}
/**
 * Callable function to parse receipt
 * Called from mobile app with image base64
 */
exports.parseReceipt = functions
    .region(config_1.config.app.region)
    .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
    secrets: ['GEMINI_API_KEY'],
})
    .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to parse receipts');
    }
    const userId = context.auth.uid;
    const { imageBase64, mimeType = 'image/jpeg' } = data;
    if (!imageBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'Image data is required');
    }
    try {
        // V1 FIX: Validate image data before processing
        const validation = validateImageData(imageBase64, mimeType);
        if (!validation.valid) {
            throw new functions.https.HttpsError('invalid-argument', validation.error);
        }
        // V2 FIX: Detect if image contains a receipt
        const detection = await detectReceiptContent(imageBase64, mimeType);
        if (!detection.isReceipt || detection.confidence < 0.7) {
            throw new functions.https.HttpsError('invalid-argument', `Cette image ne semble pas être un reçu. ${detection.reason || 'Veuillez scanner un reçu valide.'}`);
        }
        // H1 FIX: Check image quality
        const qualityCheck = await checkImageQuality(imageBase64);
        if (!qualityCheck.isAcceptable) {
            const warningMsg = qualityCheck.warnings.join('. ') +
                '. ' +
                qualityCheck.suggestions.join('. ');
            console.warn(`Image quality issues: ${warningMsg}`);
            // Log but don't block - let user proceed with warning
            // In production, you might want to return this as a warning field
        }
        // V5 FIX: Atomic subscription check and increment with transaction
        const subscriptionRef = db.doc(config_1.collections.subscription(userId));
        await db.runTransaction(async (transaction) => {
            const subscriptionDoc = await transaction.get(subscriptionRef);
            let subscription = subscriptionDoc.data();
            if (!subscription) {
                // Initialize subscription for new user
                subscription = {
                    userId,
                    trialScansUsed: 0,
                    trialScansLimit: config_1.config.app.trialScanLimit,
                    isSubscribed: false,
                    status: 'trial',
                    autoRenew: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                transaction.set(subscriptionRef, subscription);
            }
            // Check if user can scan (skip if limit is -1 for unlimited)
            const isUnlimited = config_1.config.app.trialScanLimit === -1 ||
                subscription.trialScansLimit === -1;
            const canScan = subscription.isSubscribed ||
                isUnlimited ||
                subscription.trialScansUsed < subscription.trialScansLimit;
            if (!canScan) {
                throw new functions.https.HttpsError('resource-exhausted', `Limite d'essai atteinte (${subscription.trialScansUsed}/${subscription.trialScansLimit}). Abonnez-vous pour continuer.`);
            }
            // Atomically increment scan count within transaction
            transaction.update(subscriptionRef, {
                trialScansUsed: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        // Now parse receipt - scan limit already reserved
        const parsedReceipt = await parseWithGemini(imageBase64, mimeType);
        // H2 FIX: Check for duplicate receipts
        const duplicateCheck = await detectDuplicateReceipt(userId, imageBase64, parsedReceipt);
        if (duplicateCheck.isDuplicate) {
            throw new functions.https.HttpsError('already-exists', `Ce reçu a déjà été scanné. Scan ID: ${duplicateCheck.existingReceiptId}`);
        }
        // Get user profile to include city
        const userProfileRef = db.doc(config_1.collections.userDoc(userId));
        const userProfileDoc = await userProfileRef.get();
        const userProfile = userProfileDoc.data();
        // Calculate perceptual hash for storage
        const buffer = Buffer.from(imageBase64, 'base64');
        const imageHash = await (0, sharp_phash_1.default)(buffer);
        // Create receipt document
        const receiptRef = db.collection(config_1.collections.receipts(userId)).doc();
        const now = admin.firestore.FieldValue.serverTimestamp();
        await receiptRef.set({
            ...parsedReceipt,
            imageHash, // Store hash for duplicate detection
            id: receiptRef.id,
            userId,
            city: (userProfile === null || userProfile === void 0 ? void 0 : userProfile.defaultCity) || null,
            processingStatus: 'completed',
            createdAt: now,
            updatedAt: now,
            scannedAt: now,
        });
        // Scan count already incremented atomically in transaction above
        // No need to increment again
        // Update user stats for achievements
        await updateUserStats(userId, parsedReceipt);
        return {
            success: true,
            receiptId: receiptRef.id,
            receipt: parsedReceipt,
        };
    }
    catch (error) {
        console.error('Receipt parsing error:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        // Return more detailed error for debugging
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new functions.https.HttpsError('internal', `Failed to parse receipt: ${errorMessage}`);
    }
});
/**
 * Merge multi-page receipt with validation
 * H3 FIX: Multi-page receipt validation and merging
 */
async function mergeMultiPageReceipt(parsedResults, images) {
    // 1. Validate all pages are from same receipt
    const storeNames = parsedResults
        .map(r => r.storeNameNormalized)
        .filter(Boolean);
    const uniqueStores = new Set(storeNames);
    if (uniqueStores.size > 1) {
        throw new Error(`Plusieurs reçus détectés: ${Array.from(uniqueStores).join(', ')}. Scannez un seul reçu à la fois.`);
    }
    // 2. Detect duplicate pages using perceptual hashing
    const hashes = await Promise.all(images.map(async (img) => {
        const buffer = Buffer.from(img, 'base64');
        return await (0, sharp_phash_1.default)(buffer);
    }));
    const duplicates = hashes.filter((hash, index) => hashes.indexOf(hash) !== index);
    if (duplicates.length > 0) {
        throw new Error('Pages dupliquées détectées. Supprimez les images en double.');
    }
    // 3. Find page with store header
    const headerPage = parsedResults.find(p => p.storeName && p.storeName !== 'Unknown Store') ||
        parsedResults[0];
    // 4. Find page with total (usually last)
    const totalPage = parsedResults
        .slice()
        .reverse()
        .find(p => p.total > 0) || parsedResults[parsedResults.length - 1];
    // 5. Collect all unique items (deduplication by name + price)
    const itemMap = new Map();
    for (const page of parsedResults) {
        for (const item of page.items) {
            const key = `${item.nameNormalized}-${item.unitPrice}`;
            if (itemMap.has(key)) {
                // Same item appears on multiple pages - add quantities
                const existing = itemMap.get(key);
                existing.quantity += item.quantity;
                existing.totalPrice += item.totalPrice;
            }
            else {
                itemMap.set(key, { ...item });
            }
        }
    }
    const allItems = Array.from(itemMap.values());
    // 6. Validate total matches item sum
    const itemsTotal = allItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const declaredTotal = totalPage.total || 0;
    const tolerance = declaredTotal * 0.1; // 10% tolerance
    if (Math.abs(itemsTotal - declaredTotal) > tolerance && declaredTotal > 0) {
        console.warn(`Total mismatch: Items sum to ${itemsTotal} but receipt says ${declaredTotal}`);
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
exports.parseReceiptV2 = functions
    .region(config_1.config.app.region)
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
    }
    catch (error) {
        console.error('Token verification failed:', error);
        res.status(401).send('Unauthorized: Invalid token');
        return;
    }
    const userId = decodedToken.uid;
    const { data } = req.body;
    const { images, mimeType = 'image/jpeg' } = data || req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
        res.status(400).send('At least one image is required');
        return;
    }
    try {
        // Check subscription
        const subscriptionRef = db.doc(config_1.collections.subscription(userId));
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
        const parsedResults = await Promise.all(images.map((img) => parseWithGemini(img, mimeType)));
        // H3 FIX: Use improved multi-page merging with validation
        const mergedReceipt = await mergeMultiPageReceipt(parsedResults, images);
        // Get user profile to include city
        const userProfileRef = db.doc(config_1.collections.userDoc(userId));
        const userProfileDoc = await userProfileRef.get();
        const userProfile = userProfileDoc.data();
        // Save receipt
        const receiptRef = db.collection(config_1.collections.receipts(userId)).doc();
        const now = admin.firestore.FieldValue.serverTimestamp();
        await receiptRef.set({
            ...mergedReceipt,
            id: receiptRef.id,
            userId,
            city: (userProfile === null || userProfile === void 0 ? void 0 : userProfile.defaultCity) || null,
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
    }
    catch (error) {
        console.error('Multi-page receipt parsing error:', error);
        res.status(500).send('Failed to parse receipt');
    }
});
/**
 * Calculate actual savings for a receipt by comparing prices against best available prices
 */
async function calculateReceiptSavings(userId, receipt) {
    if (!receipt.items || receipt.items.length === 0) {
        return 0;
    }
    try {
        // Normalize product names for matching
        const normalizeProductName = (name) => {
            return name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        };
        // Collect all normalized product names
        const normalizedNames = receipt.items.map(item => item.nameNormalized || normalizeProductName(item.name));
        // Remove duplicates to avoid unnecessary queries
        const uniqueNormalizedNames = [...new Set(normalizedNames)];
        // Query all price data for these products in batches (Firestore 'in' limit is 10)
        const batchSize = 10;
        const priceDataMap = new Map();
        for (let i = 0; i < uniqueNormalizedNames.length; i += batchSize) {
            const batch = uniqueNormalizedNames.slice(i, i + batchSize);
            const priceQuery = await db
                .collection(config_1.collections.prices)
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
                priceDataMap.get(key).push(pricePoint);
            });
        }
        let totalSavings = 0;
        // Calculate savings for each item
        for (const item of receipt.items) {
            const normalizedName = item.nameNormalized || normalizeProductName(item.name);
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
    }
    catch (error) {
        console.error('Error calculating receipt savings:', error);
        return 0; // Return 0 on error to avoid breaking the flow
    }
}
/**
 * Update user stats for achievements
 */
async function updateUserStats(userId, receipt) {
    var _a, _b, _c;
    try {
        const userRef = db
            .collection('artifacts')
            .doc(config_1.config.app.id)
            .collection('users')
            .doc(userId);
        // Get current stats
        const userDoc = await userRef.get();
        let stats = userDoc.exists && ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.stats)
            ? userDoc.data().stats
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
            (stats.itemsScanned || 0) + (((_b = receipt.items) === null || _b === void 0 ? void 0 : _b.length) || 0);
        // Calculate XP
        const xpEarned = 10 + Math.min(((_c = receipt.items) === null || _c === void 0 ? void 0 : _c.length) || 0, 10); // Base XP + items bonus
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
        await userRef.set({ stats }, { merge: true });
        console.log(`[Stats] Updated stats for user ${userId}: ${stats.totalScans} scans, level ${stats.level}`);
    }
    catch (error) {
        console.error('[Stats] Failed to update user stats:', error);
    }
}
//# sourceMappingURL=parseReceipt.js.map