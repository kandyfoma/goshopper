/**
 * Item Matching Service
 * Handles intelligent product matching across different stores
 * Uses fuzzy matching, brand extraction, and semantic similarity
 */

import * as admin from 'firebase-admin';
import { collections } from '../config';
import { PricePoint } from '../types';

const db = admin.firestore();

// Common brand prefixes to extract
const BRAND_PATTERNS = [
  // Congolese/African brands
  'skol', 'primus', 'tembo', 'simba', 'turbo king', 'doppel',
  'kwanga', 'brasimba', 'bracongo',
  // International brands
  'coca cola', 'coca-cola', 'pepsi', 'fanta', 'sprite', 'nestle',
  'nescafe', 'maggi', 'knorr', 'unilever', 'colgate', 'palmolive',
  'lipton', 'heineken', 'guiness', 'amstel',
  // Food brands
  'indomie', 'golden penny', 'dangote', 'bua', 'honeywell',
];

// Common unit variations to normalize
const UNIT_VARIATIONS: Record<string, string[]> = {
  'kg': ['kilo', 'kilogram', 'kilos', 'kilogramme', 'kilogrammes'],
  'g': ['gram', 'grams', 'gramme', 'grammes', 'gr'],
  'l': ['litre', 'liter', 'litres', 'liters'],
  'ml': ['millilitre', 'milliliter', 'millilitres', 'milliliters'],
  'pcs': ['piece', 'pieces', 'pc', 'unite', 'unites', 'unit', 'units'],
  'pack': ['packet', 'packets', 'packs', 'paquet', 'paquets'],
  'doz': ['dozen', 'douzaine'],
  'box': ['boxes', 'boite', 'boites', 'carton', 'cartons'],
  'btl': ['bottle', 'bottles', 'bouteille', 'bouteilles'],
  'can': ['cans', 'tin', 'tins', 'canette', 'canettes'],
  'bag': ['bags', 'sac', 'sacs', 'sachet', 'sachets'],
};

// Common product category keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'beverage': ['soda', 'juice', 'water', 'drink', 'beer', 'wine', 'eau', 'jus', 'boisson'],
  'rice': ['riz', 'rice', 'basmati', 'jasmin'],
  'oil': ['huile', 'oil', 'palm', 'vegetable', 'olive', 'sunflower'],
  'sugar': ['sucre', 'sugar', 'sweet'],
  'flour': ['farine', 'flour', 'wheat'],
  'milk': ['lait', 'milk', 'dairy', 'cream', 'creme'],
  'bread': ['pain', 'bread', 'baguette'],
  'meat': ['viande', 'meat', 'beef', 'chicken', 'poulet', 'boeuf', 'porc', 'pork'],
  'fish': ['poisson', 'fish', 'sardine', 'tuna', 'thon'],
  'vegetable': ['legume', 'vegetable', 'tomato', 'tomate', 'onion', 'oignon', 'carrot', 'carotte'],
  'fruit': ['fruit', 'banana', 'banane', 'orange', 'apple', 'pomme', 'mango', 'mangue'],
  'cleaning': ['savon', 'soap', 'detergent', 'bleach', 'javel', 'cleaning', 'nettoyage'],
  'pasta': ['pate', 'pasta', 'spaghetti', 'macaroni', 'nouille', 'noodle'],
};

/**
 * French to English common translations
 * Used for cross-language product matching
 */
export const TRANSLATIONS: Record<string, string> = {
  'eau': 'water',
  'lait': 'milk',
  'pain': 'bread',
  'riz': 'rice',
  'huile': 'oil',
  'sucre': 'sugar',
  'sel': 'salt',
  'farine': 'flour',
  'beurre': 'butter',
  'fromage': 'cheese',
  'viande': 'meat',
  'poulet': 'chicken',
  'boeuf': 'beef',
  'poisson': 'fish',
  'legume': 'vegetable',
  'fruit': 'fruit',
  'oeuf': 'egg',
  'oeufs': 'eggs',
};

export interface MatchResult {
  matched: boolean;
  existingDoc?: admin.firestore.DocumentSnapshot;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'none';
  confidence: number;
  matchedName?: string;
}

export interface ProductFingerprint {
  normalizedName: string;
  tokens: string[];
  brand: string | null;
  size: string | null;
  unit: string | null;
  category: string | null;
  baseProduct: string;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create a 2D array to store distances
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity ratio (0-1) based on Levenshtein distance
 */
function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Calculate Jaccard similarity between two sets of tokens
 */
function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Normalize product name for matching
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract product tokens for matching
 */
function tokenize(name: string): string[] {
  const normalized = normalizeProductName(name);
  return normalized.split(' ').filter(token => token.length > 1);
}

/**
 * Extract brand from product name
 */
function extractBrand(name: string): string | null {
  const lowerName = name.toLowerCase();
  
  for (const brand of BRAND_PATTERNS) {
    if (lowerName.includes(brand)) {
      return brand;
    }
  }
  
  return null;
}

/**
 * Extract size and unit from product name (e.g., "1.5L", "500g", "2kg")
 */
function extractSizeUnit(name: string): { size: string | null; unit: string | null } {
  // Match patterns like "1.5L", "500ml", "2kg", "250g"
  const sizePattern = /(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl|oz|lb|pcs?|pieces?|pack|doz|dozen)/i;
  const match = name.match(sizePattern);
  
  if (match) {
    const size = match[1];
    let unit = match[2].toLowerCase();
    
    // Normalize unit
    for (const [standard, variations] of Object.entries(UNIT_VARIATIONS)) {
      if (unit === standard || variations.includes(unit)) {
        unit = standard;
        break;
      }
    }
    
    return { size, unit };
  }
  
  return { size: null, unit: null };
}

/**
 * Detect product category
 */
function detectCategory(name: string): string | null {
  const lowerName = normalizeProductName(name);
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return category;
      }
    }
  }
  
  return null;
}

/**
 * Extract base product name (without brand, size, etc.)
 */
function extractBaseProduct(name: string): string {
  let base = normalizeProductName(name);
  
  // Remove brand
  for (const brand of BRAND_PATTERNS) {
    base = base.replace(brand, '');
  }
  
  // Remove size/unit patterns
  base = base.replace(/\d+(?:\.\d+)?\s*(kg|g|l|ml|cl|oz|lb|pcs?|pieces?|pack|doz|dozen)/gi, '');
  
  // Clean up extra spaces
  base = base.replace(/\s+/g, ' ').trim();
  
  return base;
}

/**
 * Create a fingerprint for a product
 */
export function createProductFingerprint(name: string): ProductFingerprint {
  const { size, unit } = extractSizeUnit(name);
  
  return {
    normalizedName: normalizeProductName(name),
    tokens: tokenize(name),
    brand: extractBrand(name),
    size,
    unit,
    category: detectCategory(name),
    baseProduct: extractBaseProduct(name),
  };
}

/**
 * Calculate overall similarity between two product names
 * Returns a score between 0 and 1
 */
export function calculateProductSimilarity(name1: string, name2: string): number {
  const fp1 = createProductFingerprint(name1);
  const fp2 = createProductFingerprint(name2);
  
  let score = 0;
  let weights = 0;
  
  // 1. Exact normalized match (highest priority)
  if (fp1.normalizedName === fp2.normalizedName) {
    return 1.0;
  }
  
  // 2. String similarity (weight: 0.3)
  const strSim = stringSimilarity(fp1.normalizedName, fp2.normalizedName);
  score += strSim * 0.3;
  weights += 0.3;
  
  // 3. Token (Jaccard) similarity (weight: 0.3)
  const tokenSim = jaccardSimilarity(fp1.tokens, fp2.tokens);
  score += tokenSim * 0.3;
  weights += 0.3;
  
  // 4. Base product similarity (weight: 0.2)
  if (fp1.baseProduct && fp2.baseProduct) {
    const baseSim = stringSimilarity(fp1.baseProduct, fp2.baseProduct);
    score += baseSim * 0.2;
    weights += 0.2;
  }
  
  // 5. Brand match bonus (weight: 0.1)
  if (fp1.brand && fp2.brand) {
    if (fp1.brand === fp2.brand) {
      score += 0.1;
    }
    weights += 0.1;
  }
  
  // 6. Category match bonus (weight: 0.1)
  if (fp1.category && fp2.category) {
    if (fp1.category === fp2.category) {
      score += 0.1;
    }
    weights += 0.1;
  }
  
  // Normalize by actual weights used
  return weights > 0 ? score / weights : 0;
}

/**
 * Find matching product in database for a given store
 */
export async function findMatchingProduct(
  productName: string,
  storeName: string,
  storeNameNormalized: string
): Promise<MatchResult> {
  const normalizedProduct = normalizeProductName(productName);
  const productFp = createProductFingerprint(productName);
  
  // Step 1: Try exact match first
  const exactQuery = await db
    .collection(collections.prices)
    .where('storeNameNormalized', '==', storeNameNormalized)
    .where('productNameNormalized', '==', normalizedProduct)
    .orderBy('recordedAt', 'desc')
    .limit(1)
    .get();
  
  if (!exactQuery.empty) {
    return {
      matched: true,
      existingDoc: exactQuery.docs[0],
      matchType: 'exact',
      confidence: 1.0,
      matchedName: exactQuery.docs[0].data().productName,
    };
  }
  
  // Step 2: Get recent products from this store for fuzzy matching
  // We limit to last 500 unique products to keep it performant
  const storeProductsQuery = await db
    .collection(collections.prices)
    .where('storeNameNormalized', '==', storeNameNormalized)
    .orderBy('recordedAt', 'desc')
    .limit(500)
    .get();
  
  if (storeProductsQuery.empty) {
    return {
      matched: false,
      matchType: 'none',
      confidence: 0,
    };
  }
  
  // Deduplicate by normalized name and keep the most recent
  const productMap = new Map<string, admin.firestore.DocumentSnapshot>();
  for (const doc of storeProductsQuery.docs) {
    const data = doc.data();
    const normName = data.productNameNormalized;
    if (!productMap.has(normName)) {
      productMap.set(normName, doc);
    }
  }
  
  // Step 3: Calculate similarity with all products
  let bestMatch: {
    doc: admin.firestore.DocumentSnapshot;
    similarity: number;
    name: string;
  } | null = null;
  
  for (const [normName, doc] of productMap.entries()) {
    const existingName = doc.data()?.productName || normName;
    const similarity = calculateProductSimilarity(productName, existingName);
    
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = {
        doc,
        similarity,
        name: existingName,
      };
    }
  }
  
  // Step 4: Determine if match is good enough
  if (bestMatch) {
    // Fuzzy match threshold: 85%
    if (bestMatch.similarity >= 0.85) {
      return {
        matched: true,
        existingDoc: bestMatch.doc,
        matchType: 'fuzzy',
        confidence: bestMatch.similarity,
        matchedName: bestMatch.name,
      };
    }
    
    // Semantic match threshold: 70% + same category
    if (bestMatch.similarity >= 0.70 && productFp.category) {
      const existingFp = createProductFingerprint(bestMatch.name);
      if (existingFp.category === productFp.category) {
        return {
          matched: true,
          existingDoc: bestMatch.doc,
          matchType: 'semantic',
          confidence: bestMatch.similarity,
          matchedName: bestMatch.name,
        };
      }
    }
  }
  
  return {
    matched: false,
    matchType: 'none',
    confidence: bestMatch?.similarity || 0,
  };
}

/**
 * Smart upsert logic for price data
 * - Same shop + same price = skip (no update needed)
 * - Same shop + different price = update price
 * - No match = create new entry
 */
export async function smartUpsertPriceData(
  item: {
    name: string;
    nameNormalized?: string;
    unitPrice: number;
    unit?: string;
    quantity?: number;
  },
  receipt: {
    storeName: string;
    storeNameNormalized: string;
    currency: string;
    receiptId: string;
    userId: string;
  }
): Promise<{
  action: 'created' | 'updated' | 'skipped';
  pricePointId: string | null;
  matchedName?: string;
}> {
  const normalizedProduct = item.nameNormalized || normalizeProductName(item.name);
  
  // Find matching product in this store
  const matchResult = await findMatchingProduct(
    item.name,
    receipt.storeName,
    receipt.storeNameNormalized
  );
  
  const now = admin.firestore.FieldValue.serverTimestamp();
  
  if (matchResult.matched && matchResult.existingDoc) {
    const existingData = matchResult.existingDoc.data() as PricePoint;
    
    // Check if price is the same (within small tolerance for rounding)
    const priceDiff = Math.abs(existingData.price - item.unitPrice);
    const priceThreshold = 0.01; // 1 cent tolerance
    
    if (priceDiff <= priceThreshold) {
      // Same price, no need to update - just skip
      console.log(`Skipping ${item.name} - same price at ${receipt.storeName}`);
      return {
        action: 'skipped',
        pricePointId: matchResult.existingDoc.id,
        matchedName: matchResult.matchedName,
      };
    }
    
    // Different price - create new price point to track history
    // We create instead of update to maintain price history
    const newPriceRef = db.collection(collections.prices).doc();
    
    const newPricePoint: Partial<PricePoint> = {
      productName: existingData.productName, // Keep canonical name
      productNameNormalized: existingData.productNameNormalized,
      storeName: receipt.storeName,
      storeNameNormalized: receipt.storeNameNormalized,
      price: item.unitPrice,
      previousPrice: existingData.price, // Track price change
      currency: receipt.currency as 'USD' | 'CDF',
      unit: item.unit || existingData.unit,
      quantity: item.quantity || 1,
      pricePerUnit: item.unitPrice,
      recordedAt: now as unknown as Date,
      receiptId: receipt.receiptId,
      userId: receipt.userId,
      matchConfidence: matchResult.confidence,
      matchType: matchResult.matchType === 'none' ? undefined : matchResult.matchType,
    };
    
    await newPriceRef.set(newPricePoint);
    
    console.log(`Updated price for ${item.name} (matched: ${matchResult.matchedName}) at ${receipt.storeName}: ${existingData.price} -> ${item.unitPrice}`);
    return {
      action: 'updated',
      pricePointId: newPriceRef.id,
      matchedName: matchResult.matchedName,
    };
  }
  
  // No match found - create new entry
  const newPriceRef = db.collection(collections.prices).doc();
  
  const newPricePoint: Partial<PricePoint> = {
    productName: item.name,
    productNameNormalized: normalizedProduct,
    storeName: receipt.storeName,
    storeNameNormalized: receipt.storeNameNormalized,
    price: item.unitPrice,
    currency: receipt.currency as 'USD' | 'CDF',
    unit: item.unit,
    quantity: item.quantity || 1,
    pricePerUnit: item.unitPrice,
    recordedAt: now as unknown as Date,
    receiptId: receipt.receiptId,
    userId: receipt.userId,
    matchConfidence: 1.0, // New entry, perfect confidence
    matchType: 'exact',
  };
  
  await newPriceRef.set(newPricePoint);
  
  console.log(`Created new price point for ${item.name} at ${receipt.storeName}: ${item.unitPrice}`);
  return {
    action: 'created',
    pricePointId: newPriceRef.id,
  };
}

/**
 * Batch process items with smart matching
 */
export async function batchSmartUpsertPriceData(
  items: Array<{
    name: string;
    nameNormalized?: string;
    unitPrice: number;
    unit?: string;
    quantity?: number;
  }>,
  receipt: {
    storeName: string;
    storeNameNormalized: string;
    currency: string;
    receiptId: string;
    userId: string;
  }
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  results: Array<{
    itemName: string;
    action: 'created' | 'updated' | 'skipped';
    matchedName?: string;
  }>;
}> {
  const results: Array<{
    itemName: string;
    action: 'created' | 'updated' | 'skipped';
    matchedName?: string;
  }> = [];
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  // Process items sequentially to avoid race conditions
  for (const item of items) {
    try {
      const result = await smartUpsertPriceData(item, receipt);
      
      results.push({
        itemName: item.name,
        action: result.action,
        matchedName: result.matchedName,
      });
      
      switch (result.action) {
        case 'created':
          created++;
          break;
        case 'updated':
          updated++;
          break;
        case 'skipped':
          skipped++;
          break;
      }
    } catch (error) {
      console.error(`Error processing item ${item.name}:`, error);
      // Continue with other items
    }
  }
  
  return {
    created,
    updated,
    skipped,
    results,
  };
}

/**
 * Find similar products across all stores (for price comparison)
 */
export async function findSimilarProductsAcrossStores(
  productName: string,
  excludeStore?: string
): Promise<Array<{
  productName: string;
  storeName: string;
  price: number;
  currency: string;
  similarity: number;
  recordedAt: Date;
}>> {
  const productFp = createProductFingerprint(productName);
  
  // Get tokens for search
  const searchTokens = productFp.tokens.slice(0, 3); // Use first 3 meaningful tokens
  
  if (searchTokens.length === 0) {
    return [];
  }
  
  // Query products that might match (using first token as filter)
  // This is a compromise between accuracy and performance
  const query = db
    .collection(collections.prices)
    .orderBy('recordedAt', 'desc')
    .limit(1000);
  
  const snapshot = await query.get();
  
  const matches: Array<{
    productName: string;
    storeName: string;
    price: number;
    currency: string;
    similarity: number;
    recordedAt: Date;
  }> = [];
  
  // Track best match per store
  const storeMatches = new Map<string, typeof matches[0]>();
  
  // Get normalized exclude store name for comparison
  const excludeStoreNormalized = excludeStore ? normalizeProductName(excludeStore) : null;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Skip excluded store
    if (excludeStoreNormalized && data.storeNameNormalized === excludeStoreNormalized) {
      continue;
    }
    
    const similarity = calculateProductSimilarity(productName, data.productName);
    
    // Only include if similarity is above threshold
    if (similarity >= 0.70) {
      const match = {
        productName: data.productName,
        storeName: data.storeName,
        price: data.price,
        currency: data.currency,
        similarity,
        recordedAt: data.recordedAt?.toDate?.() || new Date(),
      };
      
      const storeKey = data.storeNameNormalized;
      const existing = storeMatches.get(storeKey);
      
      // Keep best match per store (highest similarity, then most recent)
      if (!existing || 
          similarity > existing.similarity || 
          (similarity === existing.similarity && match.recordedAt > existing.recordedAt)) {
        storeMatches.set(storeKey, match);
      }
    }
  }
  
  return Array.from(storeMatches.values())
    .sort((a, b) => a.price - b.price); // Sort by price ascending
}