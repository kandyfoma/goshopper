// Item Sanitization Service
// Comprehensive validation and correction of receipt items before saving
// Handles edge cases: garbage text, returns, discounts, invalid prices, Lingala names

import {ReceiptItem} from '@/shared/types';
import {ocrCorrectionService} from './ocrCorrectionService';

// Valid categories for items
export const VALID_CATEGORIES = [
  'Alimentation',
  'Boissons',
  'Produits laitiers',
  'Viandes et poissons',
  'Fruits et légumes',
  'Pain et boulangerie',
  'Épicerie',
  'Hygiène et beauté',
  'Entretien ménager',
  'Bébé et enfant',
  'Surgelés',
  'Snacks et confiserie',
  'Alcools',
  'Électronique',
  'Vêtements',
  'Maison',
  'Autres',
] as const;

export type ItemCategory = typeof VALID_CATEGORIES[number];

// Lingala product names with French equivalents (DRC common usage)
const LINGALA_TO_FRENCH: Record<string, string> = {
  // Fish & Seafood
  'mbisi': 'poisson',
  'ngolo': 'poisson chat',
  'makayabu': 'poisson salé',
  'mpiodi': 'petit poisson séché',
  'kapiteni': 'capitaine',
  'tilapia': 'tilapia',
  
  // Vegetables
  'pondu': 'feuilles de manioc',
  'saka saka': 'feuilles de manioc',
  'ngai ngai': 'oseille',
  'ndunda': 'haricots',
  'matembele': 'feuilles de patate douce',
  'biteku teku': 'amarante',
  'mfumbwa': 'gnetum',
  
  // Staples
  'fufu': 'farine de manioc',
  'kwanga': 'pain de manioc',
  'chikwangue': 'pain de manioc',
  'bukari': 'pâte de maïs',
  'loso': 'riz',
  'farini': 'farine',
  'mbala': 'patate douce',
  'makemba': 'plantain',
  
  // Meat
  'nyama': 'viande',
  'nyama ngombe': 'viande de bœuf',
  'nyama ngulu': 'viande de porc',
  'nsoso': 'poulet',
  'ntaba': 'chèvre',
  
  // Fruits
  'makondo': 'banane',
  'makofi': 'papaye',
  'manga': 'mangue',
  'limau': 'citron',
  'ananas': 'ananas',
  
  // Beverages
  'mai': 'eau',
  'masanga': 'bière',
  'malavu': 'vin de palme',
  'lotoko': 'alcool local',
  
  // Cooking
  'mafuta': 'huile',
  'mafuta ya palme': 'huile de palme',
  'mungwa': 'sel',
  'pilipili': 'piment',
  'makala': 'charbon',
  
  // Household
  'savuni': 'savon',
  'omo': 'lessive',
};

// Swahili product names (Eastern DRC)
const SWAHILI_TO_FRENCH: Record<string, string> = {
  'samaki': 'poisson',
  'nyama': 'viande',
  'kuku': 'poulet',
  'mboga': 'légumes',
  'matunda': 'fruits',
  'mchele': 'riz',
  'unga': 'farine',
  'chumvi': 'sel',
  'maji': 'eau',
  'bia': 'bière',
  'sabuni': 'savon',
  'viazi': 'pomme de terre',
  'ndizi': 'banane',
  'embe': 'mangue',
  'nyanya': 'tomate',
  'kitunguu': 'oignon',
  'maziwa': 'lait',
  'siagi': 'beurre',
  'sukari': 'sucre',
  'kahawa': 'café',
  'chai': 'thé',
};

// Discount/return keywords to filter out
const DISCOUNT_KEYWORDS = [
  'remise', 'rabais', 'discount', 'promo', 'promotion',
  'reduction', 'réduction', 'solde', 'offre', 'gratuit',
  'free', 'bonus', 'cadeau', 'gift', 'retour', 'return',
  'refund', 'refunded', 'annul', 'cancel', 'void',
  'sous-total', 'subtotal', 'sub-total', 'total partiel',
  'tva', 'taxe', 'tax', 'hors taxe', 'ttc', 'ht',
  'espèces', 'cash', 'carte', 'card', 'paiement', 'payment',
  'monnaie', 'change', 'rendu', 'merci', 'thank',
  'bienvenue', 'welcome', 'au revoir', 'goodbye',
];

// Common garbage patterns in OCR
const GARBAGE_PATTERNS = [
  /^[^a-zA-Z]*$/,              // No letters at all
  /^.{1,2}$/,                   // Too short (1-2 chars)
  /^[0-9\s\-\.\/,]+$/,          // Only numbers and punctuation
  /\*{3,}/,                     // Multiple asterisks
  /#{3,}/,                      // Multiple hashes
  /\.{4,}/,                     // Multiple dots
  /-{4,}/,                      // Multiple dashes
  /={4,}/,                      // Multiple equals
  /^[xX]+$/,                    // Just X's
  /^\d{8,}$/,                   // Long number (barcode)
  /^[A-Z]{2}\d{6,}$/,          // Product code pattern
  /^REF\s*:?\s*\d+$/i,         // Reference number
  /^SKU\s*:?\s*\d+$/i,         // SKU number
  /^CODE\s*:?\s*\d+$/i,        // Code number
  /^#\d+$/,                     // Hash number
];

// Reasonable price ranges by currency
const PRICE_RANGES = {
  USD: { min: 0.01, max: 10000 },     // $0.01 - $10,000
  CDF: { min: 50, max: 50000000 },    // 50 FC - 50M FC
};

// Average prices for common items (for sanity checking)
const TYPICAL_PRICES: Record<string, { USD: { min: number; max: number }; CDF: { min: number; max: number } }> = {
  'lait': { USD: { min: 0.5, max: 10 }, CDF: { min: 1000, max: 25000 } },
  'pain': { USD: { min: 0.2, max: 5 }, CDF: { min: 500, max: 10000 } },
  'eau': { USD: { min: 0.2, max: 3 }, CDF: { min: 500, max: 8000 } },
  'riz': { USD: { min: 0.5, max: 50 }, CDF: { min: 1000, max: 150000 } },
  'huile': { USD: { min: 1, max: 30 }, CDF: { min: 2500, max: 75000 } },
  'sucre': { USD: { min: 0.5, max: 20 }, CDF: { min: 1000, max: 50000 } },
  'bière': { USD: { min: 0.5, max: 5 }, CDF: { min: 1000, max: 15000 } },
  'coca': { USD: { min: 0.3, max: 3 }, CDF: { min: 800, max: 8000 } },
};

interface SanitizationResult {
  isValid: boolean;
  sanitizedItem?: ReceiptItem;
  reason?: string;
  wasModified: boolean;
  modifications: string[];
}

interface SanitizationOptions {
  currency?: 'USD' | 'CDF';
  strictMode?: boolean;      // If true, reject questionable items; if false, try to fix them
  allowReturns?: boolean;    // If true, keep negative quantities (returns)
}

class ItemSanitizationService {
  /**
   * Sanitize a single item before saving
   */
  sanitizeItem(item: ReceiptItem, options: SanitizationOptions = {}): SanitizationResult {
    const { currency = 'CDF', strictMode = false, allowReturns = false } = options;
    const modifications: string[] = [];
    let sanitizedItem = { ...item };

    // Log suspicious names for debugging
    if (item.name && (item.name.includes('prite') || item.name.includes('mijito') || item.name.match(/\s+[a-z]\d+\s+[a-z]\s+[a-z]/))) {
      console.log(`🔍 Processing suspicious item name: "${item.name}"`);
    }

    // 1. Check if name is garbage
    if (this.isGarbageText(item.name)) {
      return {
        isValid: false,
        reason: `Garbage text detected: "${item.name}"`,
        wasModified: false,
        modifications: [],
      };
    }

    // 2. Check if it's a discount/return line
    if (this.isDiscountOrReturnLine(item.name)) {
      if (!allowReturns || !item.name.toLowerCase().includes('retour')) {
        return {
          isValid: false,
          reason: `Discount/system line filtered: "${item.name}"`,
          wasModified: false,
          modifications: [],
        };
      }
    }

    // 3. Translate Lingala/Swahili if needed
    const translatedName = this.translateLocalLanguage(item.name);
    if (translatedName !== item.name) {
      sanitizedItem.name = translatedName;
      modifications.push(`Translated from local language: "${item.name}" → "${translatedName}"`);
      if (item.name.includes('prite') || translatedName.includes('prite')) {
        console.log(`🌍 Translation: "${item.name}" → "${translatedName}"`);
      }
    }

    // 4. Clean up the item name
    const cleanedName = this.cleanItemName(sanitizedItem.name);
    if (cleanedName !== sanitizedItem.name) {
      modifications.push(`Cleaned name: "${sanitizedItem.name}" → "${cleanedName}"`);
      if (sanitizedItem.name.includes('prite') || cleanedName.includes('prite')) {
        console.log(`🧹 Name cleaning: "${sanitizedItem.name}" → "${cleanedName}"`);
      }
    }
    sanitizedItem.name = cleanedName;

    // 5. Validate item name isn't too short after cleaning
    if (sanitizedItem.name.length < 2) {
      return {
        isValid: false,
        reason: `Item name too short after cleaning: "${sanitizedItem.name}"`,
        wasModified: modifications.length > 0,
        modifications,
      };
    }

    // 6. Handle negative quantities (returns)
    if ((item.quantity || 1) < 0) {
      if (allowReturns) {
        modifications.push(`Negative quantity kept (return): ${item.quantity}`);
      } else {
        sanitizedItem.quantity = Math.abs(item.quantity || 1);
        modifications.push(`Converted negative quantity to positive: ${item.quantity} → ${sanitizedItem.quantity}`);
      }
    }

    // 7. Validate price
    const priceValidation = this.validatePrice(sanitizedItem, currency);
    if (!priceValidation.isValid) {
      if (strictMode) {
        return {
          isValid: false,
          reason: priceValidation.reason,
          wasModified: modifications.length > 0,
          modifications,
        };
      }
      // In non-strict mode, try to fix
      if (priceValidation.suggestedFix) {
        sanitizedItem.unitPrice = priceValidation.suggestedFix;
        sanitizedItem.totalPrice = priceValidation.suggestedFix * (sanitizedItem.quantity || 1);
        modifications.push(`Price adjusted: ${item.unitPrice} → ${priceValidation.suggestedFix}`);
      }
    }

    // 8. Validate and normalize category
    const normalizedCategory = this.normalizeCategory(item.category);
    if (normalizedCategory !== item.category) {
      sanitizedItem.category = normalizedCategory;
      modifications.push(`Category normalized: "${item.category}" → "${normalizedCategory}"`);
    }

    // 9. Update normalized name
    sanitizedItem.nameNormalized = this.normalizeItemName(sanitizedItem.name);
    if (sanitizedItem.name.includes('prite') || sanitizedItem.nameNormalized.includes('prite')) {
      console.log(`📝 Final item name: "${item.name}" → "${sanitizedItem.name}" (normalized: "${sanitizedItem.nameNormalized}")`);
    }

    return {
      isValid: true,
      sanitizedItem,
      wasModified: modifications.length > 0,
      modifications,
    };
  }

  /**
   * Sanitize all items in a receipt
   */
  sanitizeItems(items: ReceiptItem[], options: SanitizationOptions = {}): {
    validItems: ReceiptItem[];
    invalidItems: Array<{ item: ReceiptItem; reason: string }>;
    modifications: string[];
  } {
    const validItems: ReceiptItem[] = [];
    const invalidItems: Array<{ item: ReceiptItem; reason: string }> = [];
    const allModifications: string[] = [];

    for (const item of items) {
      const result = this.sanitizeItem(item, options);
      
      if (result.isValid && result.sanitizedItem) {
        validItems.push(result.sanitizedItem);
        if (result.wasModified) {
          allModifications.push(...result.modifications.map(m => `[${item.name}] ${m}`));
        }
      } else {
        invalidItems.push({ item, reason: result.reason || 'Unknown validation error' });
      }
    }

    // Deduplicate items with same normalized name and similar prices
    const deduplicatedItems = this.deduplicateItems(validItems, allModifications);

    return { 
      validItems: deduplicatedItems, 
      invalidItems, 
      modifications: allModifications 
    };
  }

  /**
   * Deduplicate items with same normalized name and similar prices
   */
  private deduplicateItems(items: ReceiptItem[], modifications: string[]): ReceiptItem[] {
    const groups: { [key: string]: ReceiptItem[] } = {};

    // Group items by normalized name
    for (const item of items) {
      const key = item.nameNormalized || this.normalizeItemName(item.name);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }

    const deduplicated: ReceiptItem[] = [];

    for (const [normalizedName, groupItems] of Object.entries(groups)) {
      if (groupItems.length === 1) {
        // No duplicates for this item
        deduplicated.push(groupItems[0]);
        continue;
      }

      // Multiple items with same normalized name - check if they can be merged
      const merged = this.mergeSimilarItems(groupItems, modifications);
      deduplicated.push(...merged);
    }

    return deduplicated;
  }

  /**
   * Merge items that are likely the same product
   */
  private mergeSimilarItems(items: ReceiptItem[], modifications: string[]): ReceiptItem[] {
    if (items.length <= 1) return items;

    // Sort by price to group similar prices together
    const sortedItems = [...items].sort((a, b) => a.unitPrice - b.unitPrice);
    const merged: ReceiptItem[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < sortedItems.length; i++) {
      if (processed.has(i)) continue;

      const current = sortedItems[i];
      const similar: ReceiptItem[] = [current];
      processed.add(i);

      // Find items with similar prices (within 10% or $1 difference)
      for (let j = i + 1; j < sortedItems.length; j++) {
        if (processed.has(j)) continue;

        const other = sortedItems[j];
        const priceDiff = Math.abs(current.unitPrice - other.unitPrice);
        const priceThreshold = Math.max(current.unitPrice * 0.1, 1); // 10% or $1 minimum

        if (priceDiff <= priceThreshold) {
          similar.push(other);
          processed.add(j);
        }
      }

      if (similar.length === 1) {
        // No similar items found
        merged.push(current);
      } else {
        // Merge similar items
        const totalQuantity = similar.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const avgPrice = similar.reduce((sum, item) => sum + item.unitPrice, 0) / similar.length;

        // Use the best name (prefer the one with spaces and proper capitalization)
        const bestName = this.selectBestItemName(similar);

        const mergedItem: ReceiptItem = {
          ...current,
          name: bestName,
          quantity: totalQuantity,
          unitPrice: avgPrice,
          totalPrice: avgPrice * totalQuantity,
        };

        merged.push(mergedItem);

        // Log the merge
        const originalNames = similar.map(item => `"${item.name}"`).join(', ');
        modifications.push(`Merged ${similar.length} duplicate items (${originalNames}) into "${bestName}" (qty: ${totalQuantity})`);
      }
    }

    return merged;
  }

  /**
   * Select the best item name from similar items
   */
  private selectBestItemName(items: ReceiptItem[]): string {
    // Prefer names with spaces (not concatenated)
    const withSpaces = items.filter(item => item.name.includes(' '));
    if (withSpaces.length > 0) {
      return withSpaces[0].name;
    }

    // Otherwise, prefer the first one
    return items[0].name;
  }

  /**
   * Check if a name appears to be corrupted
   */
  private isCorruptedName(name: string): boolean {
    if (!name || name.length < 2) return false;

    // Exception: Product size codes like "a00gr", "s00ml", "400gr", "500ml" are valid
    const hasSizeCode = /\b[a-z]?\d{2,3}\s*(gr|g|ml|l|kg|oz|cl)\b/i.test(name);
    if (hasSizeCode) {
      // This is a legitimate product with size info, don't mark as corrupted
      return false;
    }

    // Check for patterns that indicate corruption
    // 1. Spaces between every character: "S p r i t e" (require 5+ consecutive spaced letters)
    const spaceBetweenEveryChar = /\b[A-Za-z](?:\s[A-Za-z]){4,}\b/.test(name);

    // 2. Mixed letters and numbers in TRULY strange patterns (not size codes)
    // Exclude patterns like "a00gr", "s00ml" which are OCR errors for "400gr", "500ml"
    // Only flag patterns like "e30 m l" where there's spaces between unit letters
    const strangePatterns = /\b[A-Za-z]\d+\s+[A-Za-z]\s+[A-Za-z]\b/.test(name);

    // 3. Too many spaces relative to length (increased threshold)
    const spaceRatio = (name.match(/\s/g) || []).length / name.length;
    const tooManySpaces = spaceRatio > 0.4; // Increased from 0.3 to 0.4

    // 4. Contains non-printable characters
    const hasNonPrintable = /[\x00-\x1F\x7F-\x9F]/.test(name);

    // 5. Exception: Allow some spaced patterns that might be legitimate OCR
    const legitimateSpacedPattern = /\b[A-Z]\s+[A-Z]{1,3}\s+[a-z]/.test(name); // Like "B AG a"

    if ((spaceBetweenEveryChar || strangePatterns || tooManySpaces || hasNonPrintable) && !legitimateSpacedPattern) {
      console.warn(`🚨 Detected corrupted name pattern: "${name}" (spaces: ${spaceBetweenEveryChar}, strange: ${strangePatterns}, ratio: ${spaceRatio.toFixed(2)}, nonprint: ${hasNonPrintable}, exception: ${legitimateSpacedPattern})`);
      return true;
    }

    return false;
  }
  private isGarbageText(text: string): boolean {
    if (!text || typeof text !== 'string') return true;
    
    const trimmed = text.trim();
    if (trimmed.length === 0) return true;

    // Check against garbage patterns
    for (const pattern of GARBAGE_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }

    // Check if mostly non-alphabetic characters
    const letterCount = (trimmed.match(/[a-zA-ZàâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g) || []).length;
    if (letterCount < 2 || letterCount / trimmed.length < 0.3) return true;

    return false;
  }

  /**
   * Check if line is a discount, return, or system line
   */
  private isDiscountOrReturnLine(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // First check if this looks like a legitimate product name
    // Products with sizes like "s00MI", "a00gr", "Uht", "Long Life" are not discount lines
    const hasProductSizeCode = /\b[a-z]?\d{2,3}\s*(gr|g|ml|l|kg|oz|cl|mi)\b/i.test(text);
    const hasUHT = /\buht\b/i.test(text);  // UHT milk products
    const hasLongLife = /long\s*life/i.test(text);  // Long life products
    const hasCream = /\bcream\b/i.test(text);  // Cream products
    const hasMushroom = /\bmushroom\b/i.test(text);  // Mushroom products
    
    // If it looks like a product, don't filter it as a discount line
    if (hasProductSizeCode || hasUHT || hasLongLife || hasCream || hasMushroom) {
      return false;
    }
    
    // Check discount keywords - use word boundaries to avoid matching inside words
    // For example, don't match "ht" inside "Uht"
    for (const keyword of DISCOUNT_KEYWORDS) {
      // Use word boundary check for short keywords that might appear inside product names
      if (keyword.length <= 3) {
        // For short keywords like "ht", "tva", "ttc", use word boundary
        const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (wordBoundaryRegex.test(lowerText)) return true;
      } else {
        // For longer keywords, includes() is fine
        if (lowerText.includes(keyword)) return true;
      }
    }

    // Check for percentage patterns (e.g., "10%", "-15%")
    if (/-?\d+\s*%/.test(text)) return true;

    // Check for negative at start (return indicator)
    if (/^-\s*\d/.test(text.trim())) return true;

    return false;
  }

  /**
   * Translate Lingala/Swahili to French
   */
  private translateLocalLanguage(name: string): string {
    const lowerName = name.toLowerCase().trim();
    
    // Check Lingala
    for (const [lingala, french] of Object.entries(LINGALA_TO_FRENCH)) {
      if (lowerName === lingala || lowerName.startsWith(lingala + ' ')) {
        return name.replace(new RegExp(lingala, 'i'), french);
      }
    }

    // Check Swahili
    for (const [swahili, french] of Object.entries(SWAHILI_TO_FRENCH)) {
      if (lowerName === swahili || lowerName.startsWith(swahili + ' ')) {
        return name.replace(new RegExp(swahili, 'i'), french);
      }
    }

    return name;
  }

  /**
   * Clean up item name
   */
  private cleanItemName(name: string): string {
    if (!name || typeof name !== 'string') {
      return 'Article inconnu';
    }

    let cleaned = name.trim();

    // Log original name for debugging
    if (cleaned.includes('prite') || cleaned.includes('mijito')) {
      console.log(`🧹 Cleaning item name: "${name}"`);
    }

    // Remove product codes at start/end
    cleaned = cleaned
      .replace(/^\s*[A-Z]{1,3}\d{3,}\s*/i, '')  // "ABC123 Product" → "Product"
      .replace(/\s*[A-Z]{1,3}\d{3,}\s*$/i, '')  // "Product ABC123" → "Product"
      .replace(/^\s*\d{8,}\s*/g, '')             // Barcodes at start
      .replace(/\s*\d{8,}\s*$/g, '');            // Barcodes at end

    // Remove size/weight info (keep product name only)
    cleaned = cleaned
      .replace(/\s+\d+\s*(ml|cl|l|g|kg|oz|lb)\b/gi, '')
      .replace(/\s+\d+x\d+\s*(ml|cl|l|g|kg)?\b/gi, '');

    // Remove excessive whitespace and trim
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .trim();

    // Try OCR correction BEFORE capitalization (to preserve corruption patterns)
    let ocrCorrected = ocrCorrectionService.cleanItemName(cleaned);
    if (ocrCorrected !== cleaned) {
      console.log(`🔧 OCR corrected before capitalization: "${cleaned}" → "${ocrCorrected}"`);
      cleaned = ocrCorrected;
    }

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    }

    // Always try reconstruction as a final step (for cases like "bAGALILACXL" that don't look corrupted)
    const reconstructed = ocrCorrectionService.reconstructCorruptedName(cleaned);
    if (reconstructed !== cleaned) {
      console.log(`🔧 Final reconstruction: "${cleaned}" → "${reconstructed}"`);
      cleaned = reconstructed;
    }

    // Validate the result - if it still looks corrupted after OCR correction, try reconstruction alone
    if (this.isCorruptedName(cleaned)) {
      // Try reconstruction alone as fallback
      const reconstructed = ocrCorrectionService.reconstructCorruptedName(cleaned);
      if (reconstructed !== cleaned && !this.isCorruptedName(reconstructed)) {
        console.log(`🔧 Reconstructed corrupted name: "${cleaned}" → "${reconstructed}"`);
        cleaned = reconstructed;
        
        if (name !== cleaned && (cleaned.includes('prite') || cleaned.includes('mijito'))) {
          console.log(`🧹 Final cleaned item name: "${name}" → "${cleaned}"`);
        }
        return cleaned;
      }
      
      // If all attempts failed, use fallback
      console.warn(`🚨 Detected corrupted item name: "${name}" → "${cleaned}", using fallback`);
      return 'Article inconnu';
    }

    if (name !== cleaned && (cleaned.includes('prite') || cleaned.includes('mijito'))) {
      console.log(`🧹 Cleaned item name: "${name}" → "${cleaned}"`);
    }

    return cleaned;
  }

  /**
   * Validate price reasonableness
   */
  private validatePrice(
    item: ReceiptItem,
    currency: 'USD' | 'CDF'
  ): { isValid: boolean; reason?: string; suggestedFix?: number } {
    const price = item.unitPrice || 0;
    const range = PRICE_RANGES[currency];

    // Check absolute bounds
    if (price <= 0) {
      return { isValid: false, reason: 'Price must be positive' };
    }

    if (price < range.min) {
      return { 
        isValid: false, 
        reason: `Price ${price} ${currency} too low (min: ${range.min})`,
        suggestedFix: range.min,
      };
    }

    if (price > range.max) {
      return { 
        isValid: false, 
        reason: `Price ${price} ${currency} too high (max: ${range.max})`,
      };
    }

    // Check for typical prices if we have reference data
    const normalizedName = this.normalizeItemName(item.name);
    for (const [productKey, priceRange] of Object.entries(TYPICAL_PRICES)) {
      if (normalizedName.includes(productKey)) {
        const typicalRange = priceRange[currency];
        if (price < typicalRange.min * 0.1 || price > typicalRange.max * 10) {
          console.warn(`Unusual price for ${productKey}: ${price} ${currency} (typical: ${typicalRange.min}-${typicalRange.max})`);
          // Don't reject, just warn
        }
        break;
      }
    }

    return { isValid: true };
  }

  /**
   * Normalize category to valid enum value
   */
  private normalizeCategory(category?: string): ItemCategory {
    if (!category) return 'Autres';

    const lowerCategory = category.toLowerCase().trim();

    // Direct match check
    for (const validCat of VALID_CATEGORIES) {
      if (validCat.toLowerCase() === lowerCategory) {
        return validCat;
      }
    }

    // Fuzzy matching
    const categoryMappings: Record<string, ItemCategory> = {
      // Alimentation
      'food': 'Alimentation',
      'nourriture': 'Alimentation',
      'alimentaire': 'Alimentation',
      'grocery': 'Alimentation',
      'groceries': 'Alimentation',
      
      // Boissons
      'drinks': 'Boissons',
      'beverages': 'Boissons',
      'boisson': 'Boissons',
      
      // Produits laitiers
      'dairy': 'Produits laitiers',
      'laitier': 'Produits laitiers',
      'milk': 'Produits laitiers',
      
      // Viandes et poissons
      'meat': 'Viandes et poissons',
      'fish': 'Viandes et poissons',
      'seafood': 'Viandes et poissons',
      'viande': 'Viandes et poissons',
      'poisson': 'Viandes et poissons',
      
      // Fruits et légumes
      'fruits': 'Fruits et légumes',
      'vegetables': 'Fruits et légumes',
      'légumes': 'Fruits et légumes',
      'legumes': 'Fruits et légumes',
      'produce': 'Fruits et légumes',
      
      // Pain et boulangerie
      'bread': 'Pain et boulangerie',
      'bakery': 'Pain et boulangerie',
      'boulangerie': 'Pain et boulangerie',
      
      // Épicerie
      'epicerie': 'Épicerie',
      'pantry': 'Épicerie',
      
      // Hygiène et beauté
      'hygiene': 'Hygiène et beauté',
      'beauty': 'Hygiène et beauté',
      'personal care': 'Hygiène et beauté',
      'toiletries': 'Hygiène et beauté',
      
      // Entretien ménager
      'cleaning': 'Entretien ménager',
      'household': 'Entretien ménager',
      'menager': 'Entretien ménager',
      
      // Bébé et enfant
      'baby': 'Bébé et enfant',
      'kids': 'Bébé et enfant',
      'enfant': 'Bébé et enfant',
      
      // Surgelés
      'frozen': 'Surgelés',
      'surgele': 'Surgelés',
      
      // Snacks et confiserie
      'snacks': 'Snacks et confiserie',
      'candy': 'Snacks et confiserie',
      'confiserie': 'Snacks et confiserie',
      'sweets': 'Snacks et confiserie',
      
      // Alcools
      'alcohol': 'Alcools',
      'alcool': 'Alcools',
      'beer': 'Alcools',
      'wine': 'Alcools',
      'spirits': 'Alcools',
      
      // Électronique
      'electronics': 'Électronique',
      'electronique': 'Électronique',
      
      // Vêtements
      'clothing': 'Vêtements',
      'vetements': 'Vêtements',
      'clothes': 'Vêtements',
      
      // Maison
      'home': 'Maison',
      'house': 'Maison',
    };

    return categoryMappings[lowerCategory] || 'Autres';
  }

  /**
   * Normalize item name for matching
   */
  private normalizeItemName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, ' ')    // Remove special chars
      .replace(/\s+/g, ' ')            // Normalize spaces
      .trim();
  }

  /**
   * Sanitize store name
   */
  sanitizeStoreName(storeName: string): string {
    if (!storeName) return 'Magasin inconnu';

    let cleaned = storeName;

    // Remove common receipt header/footer noise
    const noisePatterns = [
      /^(reçu|receipt|facture|invoice|ticket)\s*:?\s*/i,
      /^(bienvenue|welcome)\s*(à|chez|at)?\s*/i,
      /\s*(merci|thank you|au revoir|goodbye)\s*$/i,
      /\s*www\..+$/i,
      /\s*http.+$/i,
      /\s*tel\s*:?\s*[\d\s\-\+]+$/i,
      /\s*tél\s*:?\s*[\d\s\-\+]+$/i,
      /\s*phone\s*:?\s*[\d\s\-\+]+$/i,
      /^\s*\d{8,}\s*/,           // Barcodes
      /\s*\d{8,}\s*$/,           // Barcodes
      /^\s*[#\*=\-]{3,}\s*/,     // Decorative lines
      /\s*[#\*=\-]{3,}\s*$/,     // Decorative lines
    ];

    for (const pattern of noisePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // If cleaned to nothing, return unknown
    if (cleaned.length < 2 || this.isGarbageText(cleaned)) {
      return 'Magasin inconnu';
    }

    // Proper case
    cleaned = cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return cleaned;
  }
}

export const itemSanitizationService = new ItemSanitizationService();
