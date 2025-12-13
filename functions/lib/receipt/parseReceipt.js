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
const PARSING_PROMPT = `You are an expert receipt/invoice OCR and data extraction system. Your task is to CAREFULLY READ and extract ALL visible text and data from the receipt image provided.

⚠️ CRITICAL: You MUST extract the ACTUAL text visible in the image. DO NOT use placeholder text like "Test Store", "Item 1", "Item 2", etc.

READ THE IMAGE CAREFULLY and extract EXACTLY what you see:

REQUIRED JSON STRUCTURE:
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

⚠️ IMPORTANT: Return ONLY the JSON object with ACTUAL data from the receipt image. No markdown formatting, no explanations, no placeholder data.`;
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
 */
async function parseWithGemini(imageBase64, mimeType) {
    var _a, _b, _c, _d;
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
        total: parsed.total || items.reduce((sum, item) => sum + item.totalPrice, 0),
        totalUSD: (_c = parsed.totalUSD) !== null && _c !== void 0 ? _c : null,
        totalCDF: (_d = parsed.totalCDF) !== null && _d !== void 0 ? _d : null,
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
        // Check if user can scan (skip if limit is -1 for unlimited)
        const isUnlimited = config_1.config.app.trialScanLimit === -1 || subscription.trialScansLimit === -1;
        const canScan = subscription.isSubscribed ||
            isUnlimited ||
            subscription.trialScansUsed < subscription.trialScansLimit;
        if (!canScan) {
            throw new functions.https.HttpsError('resource-exhausted', 'Trial limit reached. Please subscribe to continue.');
        }
        // Parse receipt with Gemini
        const parsedReceipt = await parseWithGemini(imageBase64, mimeType);
        // Get user profile to include city
        const userProfileRef = db.doc(config_1.collections.userDoc(userId));
        const userProfileDoc = await userProfileRef.get();
        const userProfile = userProfileDoc.data();
        // Create receipt document
        const receiptRef = db.collection(config_1.collections.receipts(userId)).doc();
        const now = admin.firestore.FieldValue.serverTimestamp();
        await receiptRef.set({
            ...parsedReceipt,
            id: receiptRef.id,
            userId,
            city: (userProfile === null || userProfile === void 0 ? void 0 : userProfile.defaultCity) || null,
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
            total: lastPage.total ||
                allItems.reduce((sum, item) => sum + item.totalPrice, 0),
        };
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
            .doc('goshopperai')
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