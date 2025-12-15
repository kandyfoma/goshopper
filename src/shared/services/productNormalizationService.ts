// Product Normalization Service
// Implements comprehensive product name matching and normalization
// Based on the AI/ML roadmap for handling variations, abbreviations, and multilingual issues

interface MasterProduct {
  productId: string;
  normalizedName: string;
  category: string;
  unitOfMeasure?: string;
  commonNames: string[];
  languages: ('en' | 'fr')[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProductMapping {
  productId: string;
  rawText: string;
  shopId?: string;
  confidence: number;
  source: 'ocr' | 'manual' | 'user_suggestion';
  createdAt: Date;
}

interface MatchResult {
  product: MasterProduct;
  confidence: number;
  matchType: 'exact' | 'edit_distance' | 'jaccard' | 'semantic' | 'abbreviation';
  rawText: string;
}

class ProductNormalizationService {
  private masterProducts: MasterProduct[] = [];
  private productMappings: ProductMapping[] = [];

  // Common abbreviations in DRC/Congo context
  private abbreviationMap: Record<string, string> = {
    'bnn': 'banane',
    'pltn': 'plantain',
    'pv': 'poivre',
    'pvre': 'poivre',
    'sav': 'savon',
    'shamp': 'shampooing',
    'dent': 'dentifrice',
    'lait': 'lait',
    'from': 'fromage',
    'oeuf': 'œuf',
    'oeufs': 'œuf',
    'pain': 'pain',
    'viand': 'viande',
    'poiss': 'poisson',
    'caf': 'café',
    'the': 'thé',
    'biere': 'bière',
    'jus': 'jus',
    'sav less': 'savon de lessive',
    'lessive': 'savon de lessive',
    'huile palme': 'huile de palme',
    'huile rouge': 'huile de palme',
    'farine mais': 'farine de maïs',
    'mais': 'farine de maïs',
  };

  // French to English translations for common products
  private translationMap: Record<string, string> = {
    'lait': 'milk',
    'fromage': 'cheese',
    'yaourt': 'yogurt',
    'crème': 'cream',
    'beurre': 'butter',
    'œuf': 'egg',
    'œufs': 'eggs',
    'pain': 'bread',
    'viande': 'meat',
    'poulet': 'chicken',
    'bœuf': 'beef',
    'porc': 'pork',
    'poisson': 'fish',
    'pomme': 'apple',
    'banane': 'banana',
    'orange': 'orange',
    'tomate': 'tomato',
    'carotte': 'carrot',
    'eau': 'water',
    'café': 'coffee',
    'thé': 'tea',
    'bière': 'beer',
    'jus': 'juice',
    'savon': 'soap',
    'shampooing': 'shampoo',
    'dentifrice': 'toothpaste',
  };

  /**
   * Phase 1: Text Cleaning (2.1)
   */
  cleanText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim()
      // Remove common noise words
      .replace(/\b(le|la|les|un|une|des|du|de|the|a|an|and|or|but|to|of|in|on|at|by|for|with|as)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Phase 1: Expand Abbreviations (3.3)
   */
  expandAbbreviations(text: string): string {
    const words = text.split(' ');
    const expanded = words.map(word => {
      return this.abbreviationMap[word] || word;
    });
    return expanded.join(' ');
  }

  /**
   * Phase 3: Translate to English (3.1)
   */
  translateToEnglish(text: string): string {
    const words = text.split(' ');
    const translated = words.map(word => {
      return this.translationMap[word] || word;
    });
    return translated.join(' ');
  }

  /**
   * Phase 2: Levenshtein Distance (2.2)
   */
  levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Phase 2: Jaccard Similarity (2.3)
   */
  jaccardSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(' '));
    const set2 = new Set(str2.split(' '));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Check if text is an abbreviation of target
   */
  isAbbreviation(query: string, target: string): boolean {
    if (query.length < 2 || target.length < query.length) return false;

    // Check if query matches first letters of target words
    const targetWords = target.split(' ');
    const queryLetters = query.split('');

    let wordIndex = 0;
    let letterIndex = 0;

    while (wordIndex < targetWords.length && letterIndex < queryLetters.length) {
      const word = targetWords[wordIndex];
      if (word.toLowerCase()[0] === queryLetters[letterIndex].toLowerCase()) {
        letterIndex++;
      }
      wordIndex++;
    }

    return letterIndex === queryLetters.length;
  }

  /**
   * Phase 4: Final Matching Algorithm
   */
  findBestMatch(searchText: string): MatchResult | null {
    const cleanedText = this.cleanText(searchText);
    const expandedText = this.expandAbbreviations(cleanedText);
    const translatedText = this.translateToEnglish(expandedText);

    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    // Priority 1: Exact Match
    for (const mapping of this.productMappings) {
      const mappingCleaned = this.cleanText(mapping.rawText);
      if (mappingCleaned === cleanedText ||
          mappingCleaned === expandedText ||
          mappingCleaned === translatedText) {
        const product = this.masterProducts.find(p => p.productId === mapping.productId);
        if (product) {
          return {
            product,
            confidence: 1.0,
            matchType: 'exact',
            rawText: mapping.rawText
          };
        }
      }
    }

    // Priority 2: Translation Match
    for (const product of this.masterProducts) {
      const productTranslated = this.translateToEnglish(this.cleanText(product.normalizedName));
      if (productTranslated === translatedText) {
        return {
          product,
          confidence: 0.95,
          matchType: 'semantic',
          rawText: searchText
        };
      }
    }

    // Priority 3: Edit Distance & Jaccard
    for (const mapping of this.productMappings) {
      const mappingCleaned = this.cleanText(mapping.rawText);

      const editDistance = this.levenshteinDistance(cleanedText, mappingCleaned);
      const maxLength = Math.max(cleanedText.length, mappingCleaned.length);
      const editScore = maxLength > 0 ? (maxLength - editDistance) / maxLength : 0;

      const jaccardScore = this.jaccardSimilarity(cleanedText, mappingCleaned);

      // Weighted score: 60% edit distance, 40% jaccard
      const weightedScore = (0.6 * editScore) + (0.4 * jaccardScore);

      if (weightedScore > bestScore && weightedScore >= 0.6) { // Minimum threshold
        const product = this.masterProducts.find(p => p.productId === mapping.productId);
        if (product) {
          bestMatch = {
            product,
            confidence: weightedScore,
            matchType: 'edit_distance',
            rawText: mapping.rawText
          };
          bestScore = weightedScore;
        }
      }
    }

    // Priority 4: Abbreviation matching
    for (const product of this.masterProducts) {
      if (this.isAbbreviation(cleanedText, this.cleanText(product.normalizedName))) {
        return {
          product,
          confidence: 0.85,
          matchType: 'abbreviation',
          rawText: searchText
        };
      }
    }

    return bestMatch;
  }

  /**
   * Add a new master product
   */
  addMasterProduct(product: Omit<MasterProduct, 'productId' | 'createdAt' | 'updatedAt'>): string {
    const productId = `PROD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newProduct: MasterProduct = {
      ...product,
      productId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.masterProducts.push(newProduct);
    return productId;
  }

  /**
   * Add a product mapping
   */
  addProductMapping(mapping: Omit<ProductMapping, 'createdAt'>): void {
    const newMapping: ProductMapping = {
      ...mapping,
      createdAt: new Date(),
    };
    this.productMappings.push(newMapping);
  }

  /**
   * Initialize with common DRC products
   */
  initializeCommonProducts(): void {
    // Dairy
    const milkId = this.addMasterProduct({
      normalizedName: 'Lait',
      category: 'Laitier',
      unitOfMeasure: 'litre',
      commonNames: ['lait', 'milk', 'milch'],
      languages: ['fr', 'en']
    });

    const cheeseId = this.addMasterProduct({
      normalizedName: 'Fromage',
      category: 'Laitier',
      unitOfMeasure: 'kg',
      commonNames: ['fromage', 'cheese'],
      languages: ['fr', 'en']
    });

    // Add mappings for variations
    this.addProductMapping({ productId: milkId, rawText: 'lait', confidence: 1.0, source: 'manual' });
    this.addProductMapping({ productId: milkId, rawText: 'milk', confidence: 1.0, source: 'manual' });
    this.addProductMapping({ productId: cheeseId, rawText: 'fromage', confidence: 1.0, source: 'manual' });
    this.addProductMapping({ productId: cheeseId, rawText: 'cheese', confidence: 1.0, source: 'manual' });

    // Add more common products...
  }

  /**
   * Get all master products
   */
  getMasterProducts(): MasterProduct[] {
    return [...this.masterProducts];
  }

  /**
   * Get all product mappings
   */
  getProductMappings(): ProductMapping[] {
    return [...this.productMappings];
  }
}

export const productNormalizationService = new ProductNormalizationService();