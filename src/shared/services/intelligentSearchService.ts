/**
 * Intelligent Product Search Service
 * 
 * Advanced search system designed for multilingual, OCR-error-tolerant,
 * abbreviation-aware, and order-independent product matching.
 * 
 * Features:
 * 1. Multilingual support (French, English, Spanish, Lingala, Swahili)
 * 2. OCR error correction (1/l/i, 0/o confusion)
 * 3. Abbreviation expansion
 * 4. Phonetic matching (Soundex-like)
 * 5. N-gram tokenization for partial matches
 * 6. Word order flexibility
 * 7. Weighted scoring with configurable thresholds
 */

// ==================== TYPES ====================

export interface SearchResult {
  item: any;
  score: number;
  matchType: 'exact' | 'normalized' | 'synonym' | 'fuzzy' | 'phonetic' | 'partial' | 'abbreviation';
  matchedText: string;
  confidence: number;
}

interface ProductSynonym {
  canonical: string;
  variations: string[];
  category?: string;
}

// ==================== MULTILINGUAL DICTIONARY ====================

const MULTILINGUAL_DICTIONARY: Record<string, string[]> = {
  // ===== DAIRY =====
  'milk': ['lait', 'milk', 'milch', 'leche', 'mabele', 'maziwa'],
  'cheese': ['fromage', 'cheese', 'queso', 'käse'],
  'yogurt': ['yaourt', 'yogurt', 'yoghurt', 'yogourt', 'yog'],
  'butter': ['beurre', 'butter', 'mantequilla', 'manteca'],
  'cream': ['creme', 'cream', 'crema', 'crème'],
  'egg': ['oeuf', 'oeufs', 'œuf', 'œufs', 'egg', 'eggs', 'huevo', 'huevos', 'makei'],

  // ===== BREAD & BAKERY =====
  'bread': ['pain', 'bread', 'pan', 'brot', 'limpa', 'mkate'],
  'baguette': ['baguette', 'baguettes', 'french bread'],
  'croissant': ['croissant', 'croissants'],
  'cake': ['gateau', 'gâteau', 'cake', 'torta', 'pastel'],
  'biscuit': ['biscuit', 'biscuits', 'cookie', 'cookies', 'galleta'],

  // ===== MEAT & POULTRY =====
  'meat': ['viande', 'meat', 'carne', 'nyama', 'fleisch'],
  'chicken': ['poulet', 'chicken', 'pollo', 'kuku', 'huhn'],
  'beef': ['boeuf', 'bœuf', 'beef', 'res', 'carne de res', 'ngombe'],
  'pork': ['porc', 'pork', 'cerdo', 'cochon', 'schwein'],
  'fish': ['poisson', 'fish', 'pescado', 'samaki', 'mbisi', 'fisch'],
  'sausage': ['saucisse', 'sausage', 'salchicha', 'chorizo', 'wurst'],

  // ===== FRUITS =====
  'apple': ['pomme', 'apple', 'apples', 'pommes', 'manzana'],
  'banana': ['banane', 'banana', 'bananas', 'bananes', 'platano', 'makemba'],
  'orange': ['orange', 'oranges', 'naranja'],
  'mango': ['mangue', 'mango', 'mangues', 'mangos'],
  'pineapple': ['ananas', 'pineapple', 'piña'],
  'papaya': ['papaye', 'papaya', 'pawpaw'],
  'avocado': ['avocat', 'avocado', 'aguacate', 'pera'],
  'lemon': ['citron', 'lemon', 'limon', 'limón'],
  'grape': ['raisin', 'grape', 'grapes', 'raisins', 'uva', 'uvas'],
  'watermelon': ['pasteque', 'pastèque', 'watermelon', 'sandia'],

  // ===== VEGETABLES =====
  'tomato': ['tomate', 'tomato', 'tomatoes', 'tomates', 'jitomate', 'nyanya'],
  'onion': ['oignon', 'onion', 'onions', 'oignons', 'cebolla', 'kitunguu'],
  'carrot': ['carotte', 'carrot', 'carrots', 'carottes', 'zanahoria'],
  'potato': ['pomme de terre', 'potato', 'potatoes', 'patata', 'papa', 'viazi'],
  'cabbage': ['chou', 'cabbage', 'col', 'repollo', 'kabichi'],
  'lettuce': ['laitue', 'salade', 'lettuce', 'lechuga'],
  'cucumber': ['concombre', 'cucumber', 'pepino', 'tango'],
  'bell pepper': ['poivron', 'pepper', 'piment', 'pilipili', 'pimiento', 'bell pepper'],
  'garlic': ['ail', 'garlic', 'ajo', 'kitunguu saumu'],
  'ginger': ['gingembre', 'ginger', 'jengibre', 'tangawizi'],
  'spinach': ['epinard', 'épinard', 'spinach', 'espinaca', 'mchicha'],
  'mushroom': ['champignon', 'mushroom', 'champignons', 'hongo', 'uyoga'],
  'eggplant': ['aubergine', 'eggplant', 'berenjena', 'bilingani'],
  'corn': ['mais', 'maïs', 'corn', 'maize', 'elote', 'mahindi'],
  'beans': ['haricot', 'haricots', 'beans', 'frijoles', 'maharagwe'],
  'peas': ['petit pois', 'peas', 'guisantes', 'mbaazi'],

  // ===== GRAINS & STAPLES =====
  'rice': ['riz', 'rice', 'arroz', 'wali', 'reis'],
  'flour': ['farine', 'flour', 'harina', 'unga', 'mehl'],
  'pasta': ['pates', 'pâtes', 'pasta', 'spaghetti', 'macaroni', 'nouilles'],
  'cereal': ['cereale', 'céréale', 'cereal', 'cereales'],

  // ===== OILS & CONDIMENTS =====
  'oil': ['huile', 'oil', 'aceite', 'mafuta', 'öl'],
  'palm oil': ['huile de palme', 'palm oil', 'huile rouge', 'red oil', 'mafuta ya mawese'],
  'olive oil': ['huile olive', 'huile d\'olive', 'olive oil', 'aceite de oliva'],
  'vinegar': ['vinaigre', 'vinegar', 'vinagre', 'siki'],
  'salt': ['sel', 'salt', 'sal', 'chumvi', 'salz'],
  'sugar': ['sucre', 'sugar', 'azucar', 'azúcar', 'sukari', 'zucker'],
  'black pepper': ['poivre', 'pepper', 'pimienta', 'pilipili', 'black pepper'],
  'sauce': ['sauce', 'salsa', 'mchuzi'],
  'mayonnaise': ['mayonnaise', 'mayo', 'mayonesa'],
  'ketchup': ['ketchup', 'catsup'],
  'mustard': ['moutarde', 'mustard', 'mostaza'],

  // ===== BEVERAGES =====
  'water': ['eau', 'water', 'agua', 'maji', 'wasser'],
  'juice': ['jus', 'juice', 'jugo', 'maji ya matunda'],
  'coffee': ['cafe', 'café', 'coffee', 'kahawa', 'kaffee'],
  'tea': ['the', 'thé', 'tea', 'chai', 'tee'],
  'beer': ['biere', 'bière', 'beer', 'cerveza', 'bia', 'pombe'],
  'wine': ['vin', 'wine', 'vino', 'mvinyo', 'wein'],
  'soda': ['soda', 'soft drink', 'boisson gazeuse', 'refresco'],
  'cola': ['cola', 'coca', 'coca cola', 'cocacola', 'coke'],
  'sprite': ['sprite', 'seven up', '7up'],
  'fanta': ['fanta', 'orange soda'],

  // ===== HOUSEHOLD & HYGIENE =====
  'soap': ['savon', 'soap', 'jabon', 'jabón', 'sabuni', 'seife'],
  'detergent': ['lessive', 'detergent', 'detergente', 'sabuni ya nguo'],
  'shampoo': ['shampooing', 'shampoo', 'champú'],
  'toothpaste': ['dentifrice', 'toothpaste', 'pasta de dientes', 'dawa ya meno'],
  'toilet paper': ['papier toilette', 'toilet paper', 'papel higienico'],
  'bleach': ['eau de javel', 'javel', 'bleach', 'cloro', 'clorox'],

  // ===== LOCAL DRC/AFRICAN PRODUCTS =====
  'cassava': ['manioc', 'cassava', 'yuca', 'muhogo', 'pondu'],
  'fufu': ['fufu', 'foufou', 'ugali', 'nsima'],
  'plantain': ['plantain', 'plantains', 'banane plantain', 'matoke', 'ndizi'],
  'palm nuts': ['noix de palme', 'palm nuts', 'mbika'],
  'groundnuts': ['arachide', 'arachides', 'groundnuts', 'peanuts', 'cacahuete', 'karanga'],
  'saka saka': ['saka saka', 'pondu', 'cassava leaves', 'feuilles de manioc'],
  'kwanga': ['kwanga', 'chikwangue', 'cassava bread'],
  'fumbwa': ['fumbwa', 'wild spinach'],
  'amaranth': ['amarante', 'amaranth', 'lenga lenga', 'mchicha'],
  
  // ===== LOCAL BRANDS (DRC) =====
  'primus': ['primus', 'biere primus'],
  'turbo king': ['turbo king', 'turbo', 'tk'],
  'skol': ['skol', 'biere skol'],
  'simba': ['simba', 'biere simba'],
  'nido': ['nido', 'lait nido', 'nido milk'],
  'cowbell': ['cowbell', 'lait cowbell'],
  'peak': ['peak', 'lait peak', 'peak milk'],
  'tamu': ['tamu'],
  'royal': ['royal', 'biscuit royal'],
};

// ==================== ABBREVIATION DICTIONARY ====================

const ABBREVIATIONS: Record<string, string> = {
  // Common abbreviations
  'bnn': 'banane',
  'ptn': 'plantain',
  'pltn': 'plantain',
  'tom': 'tomate',
  'pom': 'pomme',
  'org': 'orange',
  'crt': 'carotte',
  'oig': 'oignon',
  'pdt': 'pomme de terre',
  'vnd': 'viande',
  'plt': 'poulet',
  'pss': 'poisson',
  'bzf': 'boeuf',
  'bf': 'boeuf',
  'bnr': 'beurre',
  'frm': 'fromage',
  'yrt': 'yaourt',
  'caf': 'cafe',
  'cfe': 'cafe',
  'eau': 'eau',
  'jus': 'jus',
  'vin': 'vin',
  'bir': 'biere',
  'sav': 'savon',
  'shmp': 'shampooing',
  'dent': 'dentifrice',
  'pap': 'papier',
  'les': 'lessive',
  'lss': 'lessive',
  'riz': 'riz',
  'far': 'farine',
  'hle': 'huile',
  'sel': 'sel',
  'scr': 'sucre',
  'suc': 'sucre',
  'pvr': 'poivre',
  'all': 'ail',
  'coc': 'coca cola',
  'spt': 'sprite',
  'fnt': 'fanta',
  'sda': 'soda',
  'mlk': 'milk',
  'lt': 'lait',
  'lt nido': 'lait nido',
  'nid': 'nido',
  'maq': 'maquereau',
  'srd': 'sardine',
  'thon': 'thon',
  'tn': 'thon',
  'crv': 'crevette',
  'crabe': 'crabe',
  'hw': 'haricot',
  'hrt': 'haricot',
  'pois': 'petit pois',
  'chmp': 'champignon',
  'sal': 'salade',
  'conc': 'concombre',
  'aubrg': 'aubergine',
  'chou': 'chou',
  'epn': 'epinard',
  'mais': 'mais',
  'pst': 'pates',
  'mcr': 'macaroni',
  'spg': 'spaghetti',
  'gat': 'gateau',
  'bisc': 'biscuit',
  'choc': 'chocolat',
  'pn': 'pain',
  'bgt': 'baguette',
  'crs': 'croissant',
};

// ==================== OCR ERROR PATTERNS ====================

const OCR_CORRECTIONS: Array<[RegExp, string]> = [
  // 1/l/i confusion
  [/\bm1lk\b/gi, 'milk'],
  [/\bmi1k\b/gi, 'milk'],
  [/\bm11k\b/gi, 'milk'],
  [/\bo11\b/gi, 'oil'],
  [/\bo1l\b/gi, 'oil'],
  [/\boi1\b/gi, 'oil'],
  [/\b0il\b/gi, 'oil'],
  [/\b011\b/gi, 'oil'],
  [/\b0live\b/gi, 'olive'],
  [/\b01ive\b/gi, 'olive'],
  [/\bwa1er\b/gi, 'water'],
  [/\bwaler\b/gi, 'water'],
  [/\bsuga1\b/gi, 'sugar'],
  [/\bsa1t\b/gi, 'salt'],
  [/\bf1our\b/gi, 'flour'],
  [/\bri1e\b/gi, 'rice'],
  [/\brlce\b/gi, 'rice'],
  [/\br1ce\b/gi, 'rice'],
  [/\bju1ce\b/gi, 'juice'],
  [/\bjulce\b/gi, 'juice'],
  [/\bspr1te\b/gi, 'sprite'],
  [/\bsprlte\b/gi, 'sprite'],
  [/\bcoca co1a\b/gi, 'coca cola'],
  [/\bfan1a\b/gi, 'fanta'],
  [/\bfanla\b/gi, 'fanta'],
  [/\bchoco1ate\b/gi, 'chocolate'],
  [/\bchocolale\b/gi, 'chocolate'],
  [/\bbut1er\b/gi, 'butter'],
  [/\bbuller\b/gi, 'butter'],
  [/\byogur1\b/gi, 'yogurt'],
  [/\byogurl\b/gi, 'yogurt'],
  [/\bla1t\b/gi, 'lait'],
  [/\blail\b/gi, 'lait'],
  [/\bfar1ne\b/gi, 'farine'],
  [/\bfarlne\b/gi, 'farine'],
  [/\bv1ande\b/gi, 'viande'],
  [/\bvlande\b/gi, 'viande'],
  [/\bpo1sson\b/gi, 'poisson'],
  [/\bpolsson\b/gi, 'poisson'],
  [/\bpou1et\b/gi, 'poulet'],
  [/\bpoulet\b/gi, 'poulet'],
  [/\bfr0mage\b/gi, 'fromage'],
  [/\bfromage\b/gi, 'fromage'],
  [/\bbegu1ne\b/gi, 'beguine'],
  // Generic patterns (apply last)
  [/([a-z])1([a-z])/gi, '$1l$2'],
  [/([a-z])0([a-z])/gi, '$1o$2'],
  [/1ng\b/gi, 'ing'],
  [/1on\b/gi, 'ion'],
  [/1e\b/gi, 'le'],
  [/\b1n/gi, 'in'],
  [/\b0n/gi, 'on'],
];

// ==================== INTELLIGENT SEARCH SERVICE ====================

class IntelligentSearchService {
  
  // ===== TEXT NORMALIZATION =====
  
  /**
   * Normalize text: lowercase, remove accents, clean special characters
   */
  normalize(text: string): string {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, ' ')    // Replace special chars
      .replace(/\s+/g, ' ')            // Normalize spaces
      .trim();
  }

  /**
   * Fix common OCR errors
   */
  fixOCRErrors(text: string): string {
    let fixed = text.toLowerCase();
    
    for (const [pattern, replacement] of OCR_CORRECTIONS) {
      fixed = fixed.replace(pattern, replacement);
    }
    
    return fixed;
  }

  /**
   * Expand abbreviations
   */
  expandAbbreviations(text: string): string {
    const words = text.split(' ');
    return words.map(word => ABBREVIATIONS[word] || word).join(' ');
  }

  /**
   * Full text preprocessing pipeline
   */
  preprocess(text: string): string {
    let processed = this.normalize(text);
    processed = this.fixOCRErrors(processed);
    processed = this.expandAbbreviations(processed);
    return processed;
  }

  // ===== SIMILARITY ALGORITHMS =====

  /**
   * Levenshtein distance (edit distance)
   */
  levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate similarity score (0-1) based on Levenshtein distance
   */
  levenshteinSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return (maxLen - distance) / maxLen;
  }

  /**
   * Jaccard similarity (word-based)
   */
  jaccardSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(' ').filter(w => w.length > 0));
    const set2 = new Set(str2.split(' ').filter(w => w.length > 0));
    
    if (set1.size === 0 && set2.size === 0) return 1;
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * N-gram similarity for partial word matching
   */
  ngramSimilarity(str1: string, str2: string, n: number = 2): number {
    const getNgrams = (s: string, size: number): Set<string> => {
      const ngrams = new Set<string>();
      const padded = ' '.repeat(size - 1) + s + ' '.repeat(size - 1);
      for (let i = 0; i <= padded.length - size; i++) {
        ngrams.add(padded.substring(i, i + size));
      }
      return ngrams;
    };

    const ngrams1 = getNgrams(str1, n);
    const ngrams2 = getNgrams(str2, n);
    
    if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return intersection.size / union.size;
  }

  /**
   * Simplified Soundex for French/English phonetic matching
   */
  soundex(text: string): string {
    if (!text) return '';
    
    const word = text.toUpperCase().replace(/[^A-Z]/g, '');
    if (word.length === 0) return '';

    const firstLetter = word[0];
    
    // French-aware phonetic encoding
    const encoded = word
      .substring(1)
      .replace(/[AEIOUYHW]/g, '0')
      .replace(/[BFPV]/g, '1')
      .replace(/[CGJKQSXZ]/g, '2')
      .replace(/[DT]/g, '3')
      .replace(/[L]/g, '4')
      .replace(/[MN]/g, '5')
      .replace(/[R]/g, '6');

    // Remove consecutive duplicates and zeros
    let result = firstLetter;
    let prev = '';
    for (const char of encoded) {
      if (char !== prev && char !== '0') {
        result += char;
        prev = char;
      }
    }

    // Pad or truncate to 4 characters
    return (result + '000').substring(0, 4);
  }

  /**
   * Phonetic similarity score
   */
  phoneticSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ').filter(w => w.length > 1);
    const words2 = str2.split(' ').filter(w => w.length > 1);

    if (words1.length === 0 || words2.length === 0) return 0;

    let matches = 0;
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (this.soundex(w1) === this.soundex(w2)) {
          matches++;
          break;
        }
      }
    }

    return matches / Math.max(words1.length, words2.length);
  }

  // ===== SYNONYM MATCHING =====

  /**
   * Find canonical form from multilingual dictionary
   */
  findCanonical(text: string): string | null {
    const normalized = this.normalize(text);
    
    for (const [canonical, variations] of Object.entries(MULTILINGUAL_DICTIONARY)) {
      for (const variation of variations) {
        const normalizedVariation = this.normalize(variation);
        if (normalizedVariation === normalized ||
            normalized.includes(normalizedVariation) ||
            normalizedVariation.includes(normalized)) {
          return canonical;
        }
      }
    }
    
    return null;
  }

  /**
   * Check if two texts are synonyms
   */
  areSynonyms(text1: string, text2: string): boolean {
    const canonical1 = this.findCanonical(text1);
    const canonical2 = this.findCanonical(text2);
    
    if (canonical1 && canonical2 && canonical1 === canonical2) {
      return true;
    }
    
    return false;
  }

  /**
   * Get all variations of a product name
   */
  getAllVariations(text: string): string[] {
    const canonical = this.findCanonical(text);
    if (canonical && MULTILINGUAL_DICTIONARY[canonical]) {
      return [canonical, ...MULTILINGUAL_DICTIONARY[canonical]];
    }
    return [text];
  }

  // ===== WORD ORDER FLEXIBILITY =====

  /**
   * Check if words match regardless of order
   * "huile olive" should match "olive huile" or "olive oil"
   */
  orderIndependentMatch(query: string, target: string): number {
    const queryWords = new Set(query.split(' ').filter(w => w.length > 1));
    const targetWords = new Set(target.split(' ').filter(w => w.length > 1));

    if (queryWords.size === 0 || targetWords.size === 0) return 0;

    let matchedWords = 0;
    for (const qWord of queryWords) {
      for (const tWord of targetWords) {
        // Direct match
        if (qWord === tWord) {
          matchedWords++;
          break;
        }
        // Fuzzy match for each word pair
        if (this.levenshteinSimilarity(qWord, tWord) > 0.75) {
          matchedWords += 0.8;
          break;
        }
        // Synonym match
        if (this.areSynonyms(qWord, tWord)) {
          matchedWords += 0.9;
          break;
        }
      }
    }

    return matchedWords / queryWords.size;
  }

  // ===== MAIN SEARCH FUNCTION =====

  /**
   * Calculate comprehensive match score between query and item name
   */
  calculateMatchScore(query: string, itemName: string): {
    score: number;
    matchType: SearchResult['matchType'];
    confidence: number;
  } {
    // Preprocess both strings
    const processedQuery = this.preprocess(query);
    const processedItem = this.preprocess(itemName);
    
    // Also keep original normalized versions
    const normalizedQuery = this.normalize(query);
    const normalizedItem = this.normalize(itemName);

    // 1. EXACT MATCH (highest priority)
    if (processedQuery === processedItem || normalizedQuery === normalizedItem) {
      return { score: 1.0, matchType: 'exact', confidence: 1.0 };
    }

    // 2. CONTAINS MATCH
    if (processedItem.includes(processedQuery) || processedQuery.includes(processedItem)) {
      const containScore = Math.min(processedQuery.length, processedItem.length) / 
                          Math.max(processedQuery.length, processedItem.length);
      return { score: 0.95 * containScore, matchType: 'normalized', confidence: 0.95 };
    }

    // 3. SYNONYM MATCH (multilingual)
    if (this.areSynonyms(processedQuery, processedItem)) {
      return { score: 0.92, matchType: 'synonym', confidence: 0.92 };
    }

    // 4. ORDER-INDEPENDENT WORD MATCH
    const orderScore = this.orderIndependentMatch(processedQuery, processedItem);
    if (orderScore >= 0.8) {
      return { score: 0.88 * orderScore, matchType: 'normalized', confidence: 0.88 };
    }

    // 5. COMBINED FUZZY SCORING
    // Weight: Levenshtein (40%) + Jaccard (25%) + N-gram (20%) + Phonetic (15%)
    const levenScore = this.levenshteinSimilarity(processedQuery, processedItem);
    const jaccardScore = this.jaccardSimilarity(processedQuery, processedItem);
    const ngramScore = this.ngramSimilarity(processedQuery, processedItem, 2);
    const phoneticScore = this.phoneticSimilarity(processedQuery, processedItem);

    const combinedScore = (
      levenScore * 0.40 +
      jaccardScore * 0.25 +
      ngramScore * 0.20 +
      phoneticScore * 0.15
    );

    // Determine match type based on which algorithm contributed most
    let matchType: SearchResult['matchType'] = 'fuzzy';
    if (phoneticScore > 0.7 && phoneticScore > levenScore) {
      matchType = 'phonetic';
    } else if (ngramScore > 0.6 && ngramScore > levenScore) {
      matchType = 'partial';
    }

    return { 
      score: combinedScore, 
      matchType, 
      confidence: combinedScore 
    };
  }

  /**
   * Main search function - search items with intelligent matching
   */
  searchItems(items: any[], query: string, options?: {
    minScore?: number;
    maxResults?: number;
    includeMatchDetails?: boolean;
  }): SearchResult[] {
    if (!query || !query.trim()) {
      return items.map(item => ({
        item,
        score: 1,
        matchType: 'exact' as const,
        matchedText: item.name || '',
        confidence: 1
      }));
    }

    const minScore = options?.minScore ?? 0.35; // Lower threshold for more results
    const maxResults = options?.maxResults ?? items.length;

    const results: SearchResult[] = [];

    for (const item of items) {
      const itemName = item.name || item.displayName || '';
      if (!itemName) continue;

      // First: Calculate score for query -> item name (normal direction)
      const forwardMatch = this.calculateMatchScore(query, itemName);
      
      // Second: Calculate score for item name -> query (reverse direction)
      // This handles cases where user types normalized form (e.g., "tomatoes")
      // and item has local name (e.g., "tomate")
      const reverseMatch = this.calculateMatchScore(itemName, query);
      
      // Take the better score of the two directions
      const bestScore = Math.max(forwardMatch.score, reverseMatch.score);
      const bestMatch = forwardMatch.score >= reverseMatch.score ? forwardMatch : reverseMatch;

      if (bestScore >= minScore) {
        results.push({
          item,
          score: bestScore,
          matchType: bestMatch.matchType,
          matchedText: itemName,
          confidence: bestMatch.confidence
        });
      }
    }

    // Sort by score (highest first) and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Quick check if query matches any item (for autocomplete)
   */
  hasMatch(items: any[], query: string, threshold: number = 0.5): boolean {
    const processedQuery = this.preprocess(query);
    
    for (const item of items) {
      const itemName = item.name || item.displayName || '';
      if (!itemName) continue;

      const processedItem = this.preprocess(itemName);
      
      // Quick checks first
      if (processedItem.includes(processedQuery)) return true;
      if (this.areSynonyms(processedQuery, processedItem)) return true;
      
      // Full score calculation only if quick checks fail
      const { score } = this.calculateMatchScore(query, itemName);
      if (score >= threshold) return true;
    }

    return false;
  }

  /**
   * Get search suggestions for autocomplete
   */
  getSuggestions(items: any[], query: string, limit: number = 5): string[] {
    if (!query || query.length < 2) return [];

    const results = this.searchItems(items, query, { 
      minScore: 0.4, 
      maxResults: limit * 2 
    });

    // Return unique item names
    const seen = new Set<string>();
    return results
      .map(r => r.item.name || r.item.displayName)
      .filter(name => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .slice(0, limit);
  }
}

// Export singleton instance
export const intelligentSearchService = new IntelligentSearchService();

// Also export class for testing
export { IntelligentSearchService };
