// Product Search and Normalization Service
// Handles fuzzy search, synonyms, abbreviations, and multilingual product matching
// Now integrated with the comprehensive ProductNormalizationService

import {productNormalizationService} from './productNormalizationService';

interface ProductSynonym {
  canonical: string;
  variations: string[];
  languages: ('en' | 'fr')[];
  category?: string;
}

interface SearchResult {
  item: any;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'synonym' | 'abbreviation';
  matchedText: string;
}

class ProductSearchService {
  constructor() {
    // Initialize common products
    productNormalizationService.initializeCommonProducts();
  }
  private synonyms: ProductSynonym[] = [
    // Dairy products
    {
      canonical: 'lait',
      variations: ['milk', 'lait', 'milch', 'leche'],
      languages: ['fr', 'en'],
      category: 'dairy'
    },
    {
      canonical: 'fromage',
      variations: ['cheese', 'fromage', 'käse', 'queso'],
      languages: ['fr', 'en'],
      category: 'dairy'
    },
    {
      canonical: 'yaourt',
      variations: ['yogurt', 'yoghurt', 'yaourt', 'yogourt', 'yog', 'yo'],
      languages: ['fr', 'en'],
      category: 'dairy'
    },
    {
      canonical: 'crème',
      variations: ['cream', 'creme', 'crème', 'crema'],
      languages: ['fr', 'en'],
      category: 'dairy'
    },
    {
      canonical: 'beurre',
      variations: ['butter', 'beurre', 'mantequilla'],
      languages: ['fr', 'en'],
      category: 'dairy'
    },
    {
      canonical: 'œuf',
      variations: ['egg', 'eggs', 'œuf', 'oeuf', 'œufs', 'oeufs', 'huevo'],
      languages: ['fr', 'en'],
      category: 'dairy'
    },

    // Bread and bakery
    {
      canonical: 'pain',
      variations: ['bread', 'pain', 'baguette', 'baguettes', 'pan'],
      languages: ['fr', 'en'],
      category: 'bakery'
    },
    {
      canonical: 'croissant',
      variations: ['croissant', 'croissants'],
      languages: ['fr', 'en'],
      category: 'bakery'
    },

    // Meat and poultry
    {
      canonical: 'viande',
      variations: ['meat', 'viande', 'carne'],
      languages: ['fr', 'en'],
      category: 'meat'
    },
    {
      canonical: 'poulet',
      variations: ['chicken', 'poulet', 'pollo'],
      languages: ['fr', 'en'],
      category: 'meat'
    },
    {
      canonical: 'bœuf',
      variations: ['beef', 'boeuf', 'bœuf', 'carne de res'],
      languages: ['fr', 'en'],
      category: 'meat'
    },
    {
      canonical: 'porc',
      variations: ['pork', 'porc', 'cerdo'],
      languages: ['fr', 'en'],
      category: 'meat'
    },

    // Fish and seafood
    {
      canonical: 'poisson',
      variations: ['fish', 'poisson', 'pescado'],
      languages: ['fr', 'en'],
      category: 'seafood'
    },

    // Fruits and vegetables
    {
      canonical: 'pomme',
      variations: ['apple', 'apples', 'pomme', 'pommes', 'manzana'],
      languages: ['fr', 'en'],
      category: 'fruit'
    },
    {
      canonical: 'banane',
      variations: ['banana', 'bananas', 'banane', 'bananes', 'platano'],
      languages: ['fr', 'en'],
      category: 'fruit'
    },
    {
      canonical: 'orange',
      variations: ['orange', 'oranges', 'orange'],
      languages: ['fr', 'en'],
      category: 'fruit'
    },
    {
      canonical: 'tomate',
      variations: ['tomato', 'tomatoes', 'tomate', 'tomates', 'jitomate'],
      languages: ['fr', 'en'],
      category: 'vegetable'
    },
    {
      canonical: 'carotte',
      variations: ['carrot', 'carrots', 'carotte', 'carottes', 'zanahoria'],
      languages: ['fr', 'en'],
      category: 'vegetable'
    },

    // Beverages
    {
      canonical: 'eau',
      variations: ['water', 'eau', 'agua'],
      languages: ['fr', 'en'],
      category: 'beverage'
    },
    {
      canonical: 'café',
      variations: ['coffee', 'cafe', 'café', 'cafe'],
      languages: ['fr', 'en'],
      category: 'beverage'
    },
    {
      canonical: 'thé',
      variations: ['tea', 'the', 'thé', 'te'],
      languages: ['fr', 'en'],
      category: 'beverage'
    },
    {
      canonical: 'bière',
      variations: ['beer', 'biere', 'bière', 'cerveza'],
      languages: ['fr', 'en'],
      category: 'beverage'
    },
    {
      canonical: 'jus',
      variations: ['juice', 'jus', 'jugo'],
      languages: ['fr', 'en'],
      category: 'beverage'
    },

    // Common abbreviations and short forms
    {
      canonical: 'savon',
      variations: ['soap', 'savon', 'sav', 'savonnette'],
      languages: ['fr', 'en'],
      category: 'hygiene'
    },
    {
      canonical: 'shampooing',
      variations: ['shampoo', 'shampooing', 'shamp', 'champoing'],
      languages: ['fr', 'en'],
      category: 'hygiene'
    },
    {
      canonical: 'dentifrice',
      variations: ['toothpaste', 'dentifrice', 'dent', 'pate dentifrice'],
      languages: ['fr', 'en'],
      category: 'hygiene'
    },

    // Common DRC/Francophone abbreviations
    {
      canonical: 'savon de lessive',
      variations: ['savon lessive', 'lessive', 'sav less', 'detergent'],
      languages: ['fr', 'en'],
      category: 'household'
    },
    {
      canonical: 'huile de palme',
      variations: ['huile palme', 'huile rouge', 'red oil', 'palm oil'],
      languages: ['fr', 'en'],
      category: 'cooking'
    },
    {
      canonical: 'farine de maïs',
      variations: ['farine mais', 'farine', 'corn flour', 'mais'],
      languages: ['fr', 'en'],
      category: 'cooking'
    },
  ];

  /**
   * Normalize product name for consistent matching
   */
  normalizeProductName(name: string): string {
    return productNormalizationService.cleanText(name);
  }

  /**
   * Get canonical form of a product name
   */
  getCanonicalName(name: string): string {
    const match = productNormalizationService.findBestMatch(name);
    return match ? match.product.normalizedName : this.normalizeProductName(name);
  }

  /**
   * Get all variations of a product name
   */
  getAllVariations(name: string): string[] {
    const match = productNormalizationService.findBestMatch(name);
    if (match) {
      return [match.product.normalizedName, ...match.product.commonNames];
    }
    return [this.normalizeProductName(name)];
  }

  /**
   * Calculate similarity score between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
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
   * Check if query is an abbreviation of target
   */
  private isAbbreviation(query: string, target: string): boolean {
    if (query.length < 2 || target.length < query.length) return false;

    // Check if query matches first letters of target words
    const targetWords = target.split(' ');
    const queryLetters = query.toLowerCase().split('');

    let wordIndex = 0;
    let letterIndex = 0;

    while (wordIndex < targetWords.length && letterIndex < queryLetters.length) {
      const word = targetWords[wordIndex].toLowerCase();
      if (word[0] === queryLetters[letterIndex]) {
        letterIndex++;
      }
      wordIndex++;
    }

    return letterIndex === queryLetters.length;
  }

  /**
   * Search items with fuzzy matching, synonyms, and abbreviations
   */
  /**
   * Search items with comprehensive normalization and matching
   */
  searchItems(items: any[], query: string): SearchResult[] {
    if (!query.trim()) return items.map(item => ({ item, score: 1, matchType: 'exact' as const, matchedText: item.name }));

    const results: SearchResult[] = [];

    // First try the comprehensive normalization matching
    const bestMatch = productNormalizationService.findBestMatch(query);

    if (bestMatch && bestMatch.confidence >= 0.6) {
      // Find items that match this normalized product
      const matchingItems = items.filter(item => {
        const itemMatch = productNormalizationService.findBestMatch(item.name);
        return itemMatch && itemMatch.product.productId === bestMatch.product.productId;
      });

      matchingItems.forEach(item => {
        results.push({
          item,
          score: bestMatch.confidence,
          matchType: bestMatch.matchType as any,
          matchedText: `${item.name} → ${bestMatch.product.normalizedName}`
        });
      });
    }

    // Fallback to the original fuzzy matching for items not in the master database
    if (results.length === 0) {
      const normalizedQuery = this.normalizeProductName(query);

      for (const item of items) {
        const itemName = item.name || '';
        const normalizedItemName = this.normalizeProductName(itemName);
        let bestScore = 0;
        let bestMatchType: SearchResult['matchType'] = 'exact';
        let matchedText = itemName;

        // 1. Exact match
        if (normalizedItemName.includes(normalizedQuery) || itemName.toLowerCase().includes(query.toLowerCase())) {
          bestScore = 1.0;
          bestMatchType = 'exact';
        }

        // 2. Synonym matching
        if (bestScore === 0) {
          const queryCanonical = this.getCanonicalName(query);
          const itemCanonical = this.getCanonicalName(itemName);

          if (queryCanonical === itemCanonical && queryCanonical !== normalizedQuery) {
            bestScore = 0.95;
            bestMatchType = 'synonym';
            matchedText = `${itemName} (synonym of ${queryCanonical})`;
          }
        }

        // 3. Abbreviation matching
        if (bestScore === 0) {
          if (this.isAbbreviation(normalizedQuery, normalizedItemName)) {
            bestScore = 0.85;
            bestMatchType = 'abbreviation';
            matchedText = `${itemName} (abbrev.)`;
          }
        }

        // 4. Fuzzy matching (lowest priority)
        if (bestScore === 0) {
          const similarity = this.calculateSimilarity(normalizedQuery, normalizedItemName);
          if (similarity >= 0.6) { // Minimum similarity threshold
            bestScore = similarity * 0.7; // Scale down fuzzy matches
            bestMatchType = 'fuzzy';
            matchedText = `${itemName} (~${Math.round(similarity * 100)}%)`;
          }
        }

        if (bestScore > 0) {
          results.push({
            item,
            score: bestScore,
            matchType: bestMatchType,
            matchedText
          });
        }
      }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Add custom synonym mapping
   */
  addSynonym(canonical: string, variations: string[], languages: ('en' | 'fr')[] = ['fr', 'en'], category?: string): void {
    this.synonyms.push({
      canonical: this.normalizeProductName(canonical),
      variations: variations.map(v => this.normalizeProductName(v)),
      languages,
      category
    });
  }

  /**
   * Get all synonyms for debugging
   */
  getSynonyms(): ProductSynonym[] {
    return [...this.synonyms];
  }
}

export const productSearchService = new ProductSearchService();