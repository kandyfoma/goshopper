"use strict";
/**
 * Price Service Cloud Functions
 * Handles price data aggregation and comparison
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
exports.getPriceHistory = exports.getPriceComparison = exports.savePriceData = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const db = admin.firestore();
/**
 * Normalize product name for matching
 */
function normalizeProductName(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Save price data from parsed receipt
 * Called internally after receipt parsing
 */
exports.savePriceData = functions
    .region(config_1.config.app.region)
    .firestore.document(`artifacts/${config_1.config.app.id}/users/{userId}/receipts/{receiptId}`)
    .onCreate(async (snapshot, context) => {
    const receipt = snapshot.data();
    const { userId, receiptId } = context.params;
    if (!receipt || !receipt.items || receipt.items.length === 0) {
        return null;
    }
    try {
        const batch = db.batch();
        const pricesCollection = db.collection(config_1.collections.prices);
        const now = admin.firestore.FieldValue.serverTimestamp();
        for (const item of receipt.items) {
            const pricePointRef = pricesCollection.doc();
            const pricePoint = {
                productName: item.name,
                productNameNormalized: item.nameNormalized || normalizeProductName(item.name),
                storeName: receipt.storeName,
                storeNameNormalized: receipt.storeNameNormalized,
                price: item.unitPrice,
                currency: receipt.currency,
                unit: item.unit,
                quantity: item.quantity,
                pricePerUnit: item.unitPrice,
                recordedAt: now,
                receiptId,
                userId,
            };
            batch.set(pricePointRef, pricePoint);
        }
        await batch.commit();
        console.log(`Saved ${receipt.items.length} price points for receipt ${receiptId}`);
        return null;
    }
    catch (error) {
        console.error('Save price data error:', error);
        return null;
    }
});
/**
 * Get price comparison for receipt items
 */
exports.getPriceComparison = functions
    .region(config_1.config.app.region)
    .runWith({
    timeoutSeconds: 300, // 5 minutes timeout
    memory: '1GB',
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const { receiptId, items } = data;
    if (!receiptId && (!items || !Array.isArray(items))) {
        throw new functions.https.HttpsError('invalid-argument', 'Receipt ID or items array required');
    }
    try {
        const userId = context.auth.uid;
        let receiptItems;
        let currentStoreName;
        if (receiptId) {
            // Load receipt from Firestore
            const receiptDoc = await db
                .collection(config_1.collections.receipts(userId))
                .doc(receiptId)
                .get();
            if (!receiptDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Receipt not found');
            }
            const receipt = receiptDoc.data();
            receiptItems = receipt.items;
            currentStoreName = receipt.storeNameNormalized;
        }
        else {
            receiptItems = items;
            currentStoreName = data.storeName || '';
        }
        const comparisons = [];
        // Collect all normalized product names
        const normalizedNames = receiptItems.map(item => item.nameNormalized || normalizeProductName(item.name));
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
        // Generate comparisons for each item
        for (const item of receiptItems) {
            const normalizedName = item.nameNormalized || normalizeProductName(item.name);
            const prices = priceDataMap.get(normalizedName) || [];
            if (prices.length === 0) {
                // No comparison data available
                comparisons.push({
                    productName: item.name,
                    currentPrice: item.unitPrice,
                    currentStore: currentStoreName,
                    bestPrice: item.unitPrice,
                    bestStore: currentStoreName,
                    averagePrice: item.unitPrice,
                    potentialSavings: 0,
                    savingsPercentage: 0,
                    priceCount: 1,
                });
                continue;
            }
            // Calculate statistics
            const priceValues = prices.map(p => p.price);
            const minPrice = Math.min(...priceValues);
            const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
            // Find best price and store
            const bestPriceRecord = prices.find(p => p.price === minPrice);
            // Calculate savings
            const potentialSavings = Math.max(0, item.unitPrice - minPrice) * item.quantity;
            const savingsPercentage = item.unitPrice > 0
                ? ((item.unitPrice - minPrice) / item.unitPrice) * 100
                : 0;
            comparisons.push({
                productName: item.name,
                currentPrice: item.unitPrice,
                currentStore: currentStoreName,
                bestPrice: minPrice,
                bestStore: bestPriceRecord.storeName,
                averagePrice: Math.round(avgPrice * 100) / 100,
                potentialSavings: Math.round(potentialSavings * 100) / 100,
                savingsPercentage: Math.round(savingsPercentage * 10) / 10,
                priceCount: prices.length,
            });
        }
        // Calculate total potential savings
        const totalSavings = comparisons.reduce((sum, c) => sum + c.potentialSavings, 0);
        return {
            success: true,
            comparisons,
            totalPotentialSavings: Math.round(totalSavings * 100) / 100,
            itemsCompared: comparisons.length,
        };
    }
    catch (error) {
        console.error('Get price comparison error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to get price comparison');
    }
});
/**
 * Get price history for a specific product
 */
exports.getPriceHistory = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const { productName, days = 30 } = data;
    if (!productName) {
        throw new functions.https.HttpsError('invalid-argument', 'Product name required');
    }
    try {
        const normalizedName = normalizeProductName(productName);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const priceQuery = await db
            .collection(config_1.collections.prices)
            .where('productNameNormalized', '==', normalizedName)
            .where('recordedAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
            .orderBy('recordedAt', 'desc')
            .limit(100)
            .get();
        const priceHistory = priceQuery.docs.map(doc => {
            var _a, _b;
            const data = doc.data();
            return {
                price: data.price,
                store: data.storeName,
                date: ((_b = (_a = data.recordedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(),
                currency: data.currency,
            };
        });
        // Group by store
        const byStore = {};
        for (const record of priceHistory) {
            if (!byStore[record.store]) {
                byStore[record.store] = { prices: [], latest: record.price };
            }
            byStore[record.store].prices.push(record.price);
        }
        // Calculate store averages
        const storeAverages = Object.entries(byStore).map(([store, data]) => ({
            store,
            averagePrice: data.prices.reduce((a, b) => a + b, 0) / data.prices.length,
            latestPrice: data.latest,
            priceCount: data.prices.length,
        }));
        return {
            success: true,
            productName,
            history: priceHistory,
            byStore: storeAverages,
            totalRecords: priceHistory.length,
        };
    }
    catch (error) {
        console.error('Get price history error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get price history');
    }
});
//# sourceMappingURL=priceService.js.map