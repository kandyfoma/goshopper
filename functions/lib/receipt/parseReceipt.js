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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseReceiptV2 = exports.parseReceipt = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const config_1 = require("../config");
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
// Prompt for receipt parsing - optimized for DRC market
const PARSING_PROMPT = `You are a receipt/invoice parser specialized in the Democratic Republic of Congo (DRC) market.

Analyze this receipt image and extract the following information in JSON format:

{
  "storeName": "Store/shop name",
  "storeAddress": "Store address if visible",
  "storePhone": "Phone number if visible",
  "receiptNumber": "Receipt/invoice number if visible",
  "date": "Date in YYYY-MM-DD format",
  "currency": "USD or CDF (Congolese Franc)",
  "items": [
    {
      "name": "Product name in original language",
      "quantity": 1,
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "unit": "kg/L/piece/pack/etc",
      "category": "Alimentation/Boissons/Hygiène/Ménage/Bébé/Autres"
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}

Important rules:
1. Currency detection: If prices are large numbers (thousands+), it's likely CDF. Small decimals suggest USD.
2. Common DRC stores: Shoprite, Carrefour, Peloustore, Hasson & Frères, City Market
3. Keep product names in original language (French/Lingala)
4. If quantity is not specified, assume 1
5. Calculate totalPrice = quantity × unitPrice
6. Categories: Alimentation (food), Boissons (drinks), Hygiène (personal care), Ménage (household), Bébé (baby), Autres (other)
7. If date format is unclear, use current date
8. Always return valid JSON

Respond ONLY with the JSON object, no additional text.`;
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
        'shoprite': 'shoprite',
        'carrefour': 'carrefour',
        'peloustore': 'peloustore',
        'pelou store': 'peloustore',
        'hasson': 'hasson_freres',
        'hasson & freres': 'hasson_freres',
        'hasson et freres': 'hasson_freres',
        'city market': 'city_market',
        'citymarket': 'city_market',
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
 */
async function parseWithGemini(imageBase64, mimeType) {
    const model = getGeminiAI().getGenerativeModel({ model: config_1.config.gemini.model });
    const result = await model.generateContent([
        PARSING_PROMPT,
        {
            inlineData: {
                mimeType,
                data: imageBase64,
            },
        },
    ]);
    const response = result.response;
    const text = response.text();
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    }
    // Parse JSON
    const parsed = JSON.parse(jsonStr.trim());
    // Process and validate items
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
    // Build parsed receipt
    const receipt = {
        storeName: parsed.storeName || 'Unknown Store',
        storeNameNormalized: normalizeStoreName(parsed.storeName || ''),
        storeAddress: parsed.storeAddress,
        storePhone: parsed.storePhone,
        receiptNumber: parsed.receiptNumber,
        date: parsed.date || new Date().toISOString().split('T')[0],
        currency: parsed.currency === 'CDF' ? 'CDF' : 'USD',
        items,
        subtotal: parsed.subtotal,
        tax: parsed.tax,
        total: parsed.total || items.reduce((sum, item) => sum + item.totalPrice, 0),
    };
    return receipt;
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
        // Check subscription/trial limits
        const subscriptionRef = db.doc(config_1.collections.subscription(userId));
        const subscriptionDoc = await subscriptionRef.get();
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
            await subscriptionRef.set(subscription);
        }
        // Check if user can scan
        const canScan = subscription.isSubscribed ||
            subscription.trialScansUsed < subscription.trialScansLimit;
        if (!canScan) {
            throw new functions.https.HttpsError('resource-exhausted', 'Trial limit reached. Please subscribe to continue.');
        }
        // Parse receipt with Gemini
        const parsedReceipt = await parseWithGemini(imageBase64, mimeType);
        // Create receipt document
        const receiptRef = db.collection(config_1.collections.receipts(userId)).doc();
        const now = admin.firestore.FieldValue.serverTimestamp();
        await receiptRef.set({
            ...parsedReceipt,
            id: receiptRef.id,
            userId,
            processingStatus: 'completed',
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
            receipt: parsedReceipt,
        };
    }
    catch (error) {
        console.error('Receipt parsing error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to parse receipt. Please try again.');
    }
});
/**
 * V2 version with multi-image support
 */
exports.parseReceiptV2 = functions
    .region(config_1.config.app.region)
    .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
    secrets: ['GEMINI_API_KEY'],
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = context.auth.uid;
    const { images, mimeType = 'image/jpeg' } = data;
    if (!images || !Array.isArray(images) || images.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one image is required');
    }
    try {
        // Check subscription
        const subscriptionRef = db.doc(config_1.collections.subscription(userId));
        const subscriptionDoc = await subscriptionRef.get();
        const subscription = subscriptionDoc.data();
        if (!subscription) {
            throw new functions.https.HttpsError('failed-precondition', 'Subscription not initialized');
        }
        const canScan = subscription.isSubscribed ||
            subscription.trialScansUsed < subscription.trialScansLimit;
        if (!canScan) {
            throw new functions.https.HttpsError('resource-exhausted', 'Trial limit reached');
        }
        // Parse all images and merge results
        const parsedResults = await Promise.all(images.map((img) => parseWithGemini(img, mimeType)));
        // Merge items from all pages
        const allItems = parsedResults.flatMap(r => r.items);
        // Use first page for store info, last page for totals
        const firstPage = parsedResults[0];
        const lastPage = parsedResults[parsedResults.length - 1];
        const mergedReceipt = {
            ...firstPage,
            items: allItems,
            subtotal: lastPage.subtotal || firstPage.subtotal,
            tax: lastPage.tax || firstPage.tax,
            total: lastPage.total || allItems.reduce((sum, item) => sum + item.totalPrice, 0),
        };
        // Save receipt
        const receiptRef = db.collection(config_1.collections.receipts(userId)).doc();
        const now = admin.firestore.FieldValue.serverTimestamp();
        await receiptRef.set({
            ...mergedReceipt,
            id: receiptRef.id,
            userId,
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
    }
    catch (error) {
        console.error('Multi-page receipt parsing error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to parse receipt');
    }
});
//# sourceMappingURL=parseReceipt.js.map