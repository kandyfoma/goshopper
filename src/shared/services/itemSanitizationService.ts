// Item Sanitization Service
// Comprehensive validation and correction of receipt items before saving
// Handles edge cases: garbage text, returns, discounts, invalid prices, Lingala names

import {ReceiptItem} from '@/shared/types';

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
    }

    // 4. Clean up the item name
    const cleanedName = this.cleanItemName(sanitizedItem.name);
    if (cleanedName !== sanitizedItem.name) {
      sanitizedItem.name = cleanedName;
      modifications.push(`Cleaned name: "${item.name}" → "${cleanedName}"`);
    }

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

    return { validItems, invalidItems, modifications: allModifications };
  }

  /**
   * Check if text is garbage/noise
   */
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
    
    // Check discount keywords
    for (const keyword of DISCOUNT_KEYWORDS) {
      if (lowerText.includes(keyword)) return true;
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
    let cleaned = name;

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

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
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
