/**
 * Spell Checker Service for Product Names
 * 
 * Uses dictionary-based spell checking to fix OCR errors like:
 * - "S prite" → "Sprite"
 * - "Coca Co la" → "Coca Cola"
 * - "B eer" → "Beer"
 * 
 * Uses a comprehensive custom dictionary of product names, brands,
 * and common grocery words in English, French, and African languages.
 */

// ============ COMPREHENSIVE PRODUCT DICTIONARY ============
// Common product names, brands, and grocery items
// This is the master list used for spell checking

const PRODUCT_WORDS: string[] = [
  // Beverages - Sodas
  'sprite', 'fanta', 'coca', 'cola', 'pepsi', 'mirinda', 'schweppes', 'sevenup',
  'tonic', 'soda', 'limonade', 'orangina', 'oasis', 'tropicana', 'minute', 'maid',
  
  // Beverages - Beers  
  'heineken', 'castel', 'primus', 'skol', 'simba', 'tembo', 'mutzig', 'stella',
  'artois', 'budweiser', 'corona', 'amstel', 'guinness', 'guiness', 'carlsberg',
  'turbo', 'king', 'ngok', 'nkoyi', 'doppel', 'munich', 'lite', 'light',
  
  // Beverages - Wines & Spirits
  'merlot', 'cabernet', 'sauvignon', 'chardonnay', 'shiraz', 'pinot', 'grigio',
  'bordeaux', 'medoc', 'champagne', 'prosecco', 'whisky', 'whiskey', 'vodka',
  'rhum', 'rum', 'cognac', 'baileys', 'martini', 'bacardi', 'smirnoff', 'johnnie',
  'walker', 'hennessy', 'mojito', 'margarita', 'baron', 'phillipe', 'philippe',
  'virgin', 'begadanet',
  
  // Beverages - Other
  'redbull', 'monster', 'nescafe', 'nespresso', 'lipton', 'twinings',
  'ovaltine', 'milo', 'nesquik', 'tang',
  
  // Dairy
  'danone', 'activia', 'president', 'laughing', 'cow', 'philadelphia',
  'kiri', 'babybel', 'camembert', 'brie', 'emmental', 'gouda', 'cheddar',
  'mozzarella', 'parmesan', 'nido', 'peak', 'cowbell', 'dano', 'loya',
  'yogurt', 'yaourt', 'yoghurt', 'laban', 'natural', 'thick',
  
  // Snacks & Sweets
  'oreo', 'chips', 'pringles', 'lays', 'doritos', 'cheetos', 'twix',
  'snickers', 'mars', 'bounty', 'kitkat', 'milka', 'toblerone',
  'ferrero', 'rocher', 'nutella', 'cadbury', 'lindt', 'haribo', 'mentos',
  'tictac', 'orbit', 'trident', 'extra',
  
  // Biscuits & Cookies
  'biscuit', 'biscuits', 'cookie', 'cookies', 'crackers', 'digestive',
  'marie', 'petit', 'beurre', 'gaufrette', 'wafer', 'madeleine',
  
  // Cereals & Breakfast
  'kelloggs', 'kellogs', 'nestle', 'quaker', 'weetabix', 'cornflakes',
  'muesli', 'granola', 'cheerios', 'frosties', 'coco', 'pops', 'cerelac',
  
  // Condiments & Sauces
  'heinz', 'ketchup', 'mayonnaise', 'mayo', 'mustard', 'moutarde',
  'tabasco', 'maggi', 'knorr', 'royco', 'jumbo', 'bouillon', 'cube',
  'boni', 'selection',
  
  // Pasta & Rice
  'spaghetti', 'macaroni', 'penne', 'fusilli', 'tagliatelle', 'lasagne',
  'barilla', 'panzani', 'basmati', 'jasmine', 'arborio', 'uncle', 'bens',
  
  // Canned Goods
  'sardine', 'sardines', 'thon', 'tuna', 'corned', 'beef', 'spam',
  'geant', 'vert', 'bonduelle',
  
  // Oils & Fats
  'huile', 'mazola', 'sunflower', 'tournesol', 'olive', 'palm', 'palme',
  'vegetable', 'canola', 'margarine', 'flora', 'blue', 'band',
  
  // Cleaning Products
  'omo', 'ariel', 'tide', 'persil', 'skip', 'surf', 'sunlight', 'ajax',
  'cif', 'vim', 'harpic', 'domex', 'domestos', 'jik', 'dettol', 'lysol',
  'febreze', 'airwick', 'glade',
  
  // Personal Care
  'dove', 'nivea', 'lux', 'palmolive', 'safeguard', 'lifebuoy', 'imperial',
  'leather', 'colgate', 'closeup', 'signal', 'oral', 'sensodyne', 'crest',
  'gillette', 'bic', 'always', 'kotex', 'whisper', 'pampers', 'huggies',
  'molfix', 'head', 'shoulders', 'pantene', 'sunsilk', 'loreal', 'garnier',
  'vaseline', 'johnsons', 'baby', 'posay', 'roche', 'lipikar', 'baume',
  
  // African/Congolese Products
  'fufu', 'foufou', 'kwanga', 'chikwangue', 'pondu', 'saka', 'manioc',
  'cassava', 'plantain', 'makemba', 'makayabu', 'mpiodi', 'mbisi', 'ngolo',
  'kapiteni', 'tilapia', 'sambaza', 'ndakala', 'mikate', 'mandazi',
  'matembele', 'ngai', 'biteku', 'mfumbwa', 'amarante',
  
  // Store/Brand Names
  'alilac', 'aliliacenter', 'catch', 'shoprite', 'carrefour', 'casino',
  'auchan', 'lidl', 'aldi', 'metro', 'makro', 'game', 'checkers',
  'spar', 'market', 'supermarket', 'supermarche', 'marche', 'kin', 'top',
  'cave', 'bacchus', 'lcdb',
  
  // Common French grocery words
  'lait', 'fromage', 'beurre', 'oeuf', 'oeufs', 'pain', 'farine', 'sucre',
  'sel', 'poivre', 'vinaigre', 'riz', 'pate', 'pates', 'tomate', 'oignon',
  'ail', 'carotte', 'pomme', 'terre', 'salade', 'haricot', 'petit', 'pois',
  'viande', 'poulet', 'boeuf', 'porc', 'poisson', 'crevette', 'legume',
  'fruit', 'banane', 'orange', 'mangue', 'ananas', 'avocat', 'citron',
  'eau', 'minerale', 'gazeuse', 'jus', 'vin', 'biere', 'alcool', 'boisson',
  'cafe', 'the', 'chocolat', 'confiture', 'miel', 'cereale', 'conserve',
  'surgele', 'frais', 'bio', 'naturel', 'epice', 'herbe', 'aromate',
  'sachet', 'paquet', 'bouteille', 'boite', 'pot', 'tube', 'flacon',
  'bidon', 'carton', 'pack', 'lot', 'promo', 'promotion', 'blanc', 'poudre',
  'concentre', 'paste', 'gold', 'toast', 'cereals',
  
  // Common English grocery words
  'milk', 'cheese', 'butter', 'egg', 'eggs', 'bread', 'flour', 'sugar',
  'salt', 'pepper', 'vinegar', 'rice', 'pasta', 'tomato', 'onion',
  'garlic', 'carrot', 'apple', 'potato', 'salad', 'lettuce', 'beans',
  'meat', 'chicken', 'pork', 'fish', 'shrimp', 'vegetable', 'vegetables',
  'fruit', 'fruits', 'banana', 'mango', 'pineapple', 'avocado', 'lemon',
  'water', 'mineral', 'sparkling', 'juice', 'wine', 'beer', 'alcohol',
  'drink', 'drinks', 'beverage', 'coffee', 'tea', 'chocolate', 'jam',
  'honey', 'cereal', 'canned', 'frozen', 'fresh', 'organic', 'natural',
  'spice', 'spices', 'herb', 'herbs', 'seasoning', 'sachet', 'packet',
  'bottle', 'can', 'jar', 'tube', 'box', 'carton', 'pack', 'promo',
  'everyday', 'cloth', 'viscose',
  
  // Size/quantity words
  'xl', 'xxl', 'lite', 'light', 'zero', 'diet', 'max', 'plus', 'extra',
  'double', 'triple', 'mega', 'super', 'ultra', 'premium', 'gold',
  'silver', 'classic', 'original', 'regular', 'standard', 'mini', 'maxi',
  'bag', 'sac', 'red', 'white', 'green', 'blue', 'black', 'center',
];

// Create a Set for fast lookup
const PRODUCT_DICTIONARY: Set<string> = new Set(PRODUCT_WORDS.map(w => w.toLowerCase()));

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Check if a word exists in our dictionary
 */
function isValidWord(word: string): boolean {
  const lowerWord = word.toLowerCase();
  
  // Check custom product dictionary
  if (PRODUCT_DICTIONARY.has(lowerWord)) {
    return true;
  }
  
  // Check if it's a number or contains mostly numbers (330ml, 500g, etc.)
  if (/^\d+$/.test(word) || /^\d+[a-z]{1,3}$/i.test(word)) {
    return true;
  }
  
  // Accept single uppercase letters followed by numbers (e30, z4, etc.) - these are product codes
  if (/^[a-z]\d+$/i.test(word)) {
    return true;
  }
  
  return false;
}

/**
 * Find the closest match in dictionary for a word
 */
function findClosestMatch(word: string, maxDistance: number = 2): string | null {
  const lowerWord = word.toLowerCase();
  let bestMatch: string | null = null;
  let bestDistance = maxDistance + 1;
  
  for (const dictWord of PRODUCT_DICTIONARY) {
    // Only compare words of similar length
    if (Math.abs(dictWord.length - lowerWord.length) > maxDistance) {
      continue;
    }
    
    const distance = levenshteinDistance(lowerWord, dictWord);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = dictWord;
    }
  }
  
  return bestMatch;
}

/**
 * Try to fix OCR spacing errors by combining adjacent fragments
 * "S prite" → "Sprite", "Coca Co la" → "Coca Cola"
 */
function tryFixSpacing(words: string[]): string[] {
  if (words.length <= 1) return words;
  
  // Common unit patterns that should NOT be combined (e.g., "m l" should become "ml", not "xl")
  const unitPatterns = ['ml', 'cl', 'dl', 'kg', 'mg', 'lb', 'oz', 'pc', 'pcs'];
  
  const result: string[] = [];
  let i = 0;
  
  while (i < words.length) {
    const currentWord = words[i];
    
    // Check if this looks like a unit pattern (single letters that form common units)
    if (currentWord.length === 1 && i + 1 < words.length && words[i+1].length === 1) {
      const possibleUnit = (currentWord + words[i+1]).toLowerCase();
      if (unitPatterns.includes(possibleUnit)) {
        // Keep as unit, just combine
        console.log(`  🔧 Unit fix: "${currentWord} ${words[i+1]}" → "${possibleUnit}"`);
        result.push(possibleUnit);
        i += 2;
        continue;
      }
    }
    
    // If current word is valid and length > 1, keep it
    if (currentWord.length > 1 && isValidWord(currentWord)) {
      result.push(currentWord);
      i++;
      continue;
    }
    
    // Try combining with next word(s)
    let combined = currentWord;
    let j = i + 1;
    let foundMatch = false;
    
    // Try combining up to 4 fragments
    while (j < words.length && j - i < 5) {
      combined += words[j];
      
      // Check if combined word is in dictionary
      if (isValidWord(combined)) {
        console.log(`  🔧 Combined: "${words.slice(i, j+1).join(' ')}" → "${combined}"`);
        result.push(combined);
        i = j + 1;
        foundMatch = true;
        break;
      }
      
      // Check if combined word is close to a dictionary word
      const closestMatch = findClosestMatch(combined, 1);
      if (closestMatch && levenshteinDistance(combined.toLowerCase(), closestMatch) <= 1) {
        console.log(`  🔧 Fuzzy match: "${words.slice(i, j+1).join(' ')}" → "${closestMatch}"`);
        result.push(closestMatch);
        i = j + 1;
        foundMatch = true;
        break;
      }
      
      j++;
    }
    
    // If no combination worked
    if (!foundMatch) {
      // For single characters, try to combine with just the next word
      if (currentWord.length === 1 && i + 1 < words.length) {
        const twoWordCombined = currentWord + words[i + 1];
        const match = findClosestMatch(twoWordCombined, 2);
        if (match) {
          console.log(`  🔧 Single char fix: "${currentWord} ${words[i+1]}" → "${match}"`);
          result.push(match);
          i += 2;
          continue;
        }
      }
      
      // Check if the word itself is close to a dictionary word
      if (currentWord.length >= 3) {
        const match = findClosestMatch(currentWord, 1);
        if (match) {
          result.push(match);
        } else {
          result.push(currentWord);
        }
      } else {
        result.push(currentWord);
      }
      i++;
    }
  }
  
  return result;
}

/**
 * Initialize the spell checker (no-op now, kept for API compatibility)
 */
export async function initializeSpellChecker(): Promise<void> {
  console.log('✅ Spell checker initialized with product dictionary');
}

/**
 * Fix OCR number-letter confusion in measurements and quantities
 * Common OCR mistakes:
 * - "3" → "e" or "E"
 * - "5" → "s" or "S"  
 * - "0" → "o" or "O"
 * - "1" → "l" or "i" or "I"
 * - "8" → "B"
 * - "6" → "b" or "G"
 * - "4" → "A" or "a"
 * - "9" → "g" or "q"
 * 
 * Examples:
 * - "e30 m l" → "330ml"
 * - "s00 g" → "500g"
 * - "l0 pc" → "10pc"
 * - "7s cl" → "75cl"
 * - "a00 m l" → "400ml"
 */
function fixNumberLetterConfusion(text: string): string {
  let fixed = text;
  
  // STEP 0: First, fix spaced units - "m l" → "ml", "c l" → "cl", "k g" → "kg"
  // This must happen before number-letter fixes so patterns can match properly
  fixed = fixed.replace(/\bm\s+l\b/gi, 'ml');
  fixed = fixed.replace(/\bc\s+l\b/gi, 'cl');
  fixed = fixed.replace(/\bd\s+l\b/gi, 'dl');
  fixed = fixed.replace(/\bk\s+g\b/gi, 'kg');
  fixed = fixed.replace(/\bg\s+r\b/gi, 'gr');
  fixed = fixed.replace(/\bm\s+g\b/gi, 'mg');
  fixed = fixed.replace(/\bo\s+z\b/gi, 'oz');
  fixed = fixed.replace(/\bl\s+b\b/gi, 'lb');
  fixed = fixed.replace(/\bp\s+c\s*s?\b/gi, (m) => m.includes('s') ? 'pcs' : 'pc');
  
  // Also fix spaced numbers before units: "33 0 ml" → "330ml", "5 0 0 g" → "500g"
  fixed = fixed.replace(/(\d)\s+(\d)\s+(\d)\s*(ml|cl|dl|kg|g|mg|oz|lb|pc|pcs|l)\b/gi, '$1$2$3$4');
  fixed = fixed.replace(/(\d)\s+(\d)\s*(ml|cl|dl|kg|g|mg|oz|lb|pc|pcs|l)\b/gi, '$1$2$3');
  
  // Letter to number mapping
  const letterToNumber: Record<string, string> = {
    'e': '3', 'E': '3',
    's': '5', 'S': '5',
    'o': '0', 'O': '0',
    'l': '1', 'L': '1', 'i': '1', 'I': '1',
    'b': '6', 'B': '8',
    'a': '4', 'A': '4',
    'g': '9', 'q': '9', 'G': '6', 'Q': '9',
    'z': '2', 'Z': '2',
  };
  
  // Common unit suffixes
  const units = ['ml', 'cl', 'dl', 'l', 'kg', 'g', 'mg', 'oz', 'lb', 'pc', 'pcs', 'gr'];
  
  for (const unit of units) {
    // Pattern 1: [letter][digits][unit] - e.g., "e30ml", "s00g" (letter at start)
    const pattern1 = new RegExp(
      `\\b([eEsSoOlLiIbBaAgGqQzZ])(\\d{1,3})\\s*${unit}\\b`,
      'gi'
    );
    fixed = fixed.replace(pattern1, (match, letter, digits) => {
      const num = letterToNumber[letter] || letter;
      const result = `${num}${digits}${unit}`;
      if (result !== match.replace(/\s+/g, '')) {
        console.log(`  🔢 Number fix: "${match}" → "${result}"`);
      }
      return result;
    });
    
    // Pattern 2: [digits][letter][digits?][unit] - e.g., "3o0ml" → "300ml"
    const pattern2 = new RegExp(
      `\\b(\\d)([oOsSbBgGeE])(\\d?)\\s*${unit}\\b`,
      'gi'
    );
    fixed = fixed.replace(pattern2, (match, d1, letter, d2) => {
      const num = letterToNumber[letter] || letter;
      const result = `${d1}${num}${d2 || ''}${unit}`;
      if (result !== match.replace(/\s+/g, '')) {
        console.log(`  🔢 Number fix: "${match}" → "${result}"`);
      }
      return result;
    });
    
    // Pattern 3: [letter][letter][digits][unit] - e.g., "le00ml" → "1300ml"
    const pattern3 = new RegExp(
      `\\b([lLiI])([eEoOsS])(\\d{1,2})\\s*${unit}\\b`,
      'gi'
    );
    fixed = fixed.replace(pattern3, (match, l1, l2, digits) => {
      const n1 = letterToNumber[l1] || l1;
      const n2 = letterToNumber[l2] || l2;
      const result = `${n1}${n2}${digits}${unit}`;
      console.log(`  🔢 Number fix: "${match}" → "${result}"`);
      return result;
    });
    
    // Pattern 4: [digit][letter][unit] - e.g., "7scl" → "75cl"
    const pattern4 = new RegExp(
      `\\b(\\d)([sSoObBeEgG])\\s*${unit}\\b`,
      'gi'
    );
    fixed = fixed.replace(pattern4, (match, d, letter) => {
      const num = letterToNumber[letter] || letter;
      const result = `${d}${num}${unit}`;
      if (result !== match.replace(/\s+/g, '')) {
        console.log(`  🔢 Number fix: "${match}" → "${result}"`);
      }
      return result;
    });
    
    // Pattern 5: [letter] [digits] [unit] with space - "e 30 ml" → "330ml"
    const pattern5 = new RegExp(
      `\\b([eEsSoOlLiI])\\s+(\\d{1,3})\\s*${unit}\\b`,
      'gi'
    );
    fixed = fixed.replace(pattern5, (match, letter, digits) => {
      const num = letterToNumber[letter] || letter;
      const result = `${num}${digits}${unit}`;
      console.log(`  🔢 Number fix: "${match}" → "${result}"`);
      return result;
    });
  }
  
  // Fix standalone quantity patterns without explicit unit nearby
  // Pattern: "(letter##)" like "(e6)" "(z4)" "(l4)" - often product codes
  fixed = fixed.replace(/\(([eEsSoOlLiIzZ])(\d{1,2})\)/gi, (match, letter, digits) => {
    const num = letterToNumber[letter];
    if (num) {
      const result = `(${num}${digits})`;
      console.log(`  🔢 Code fix: "${match}" → "${result}"`);
      return result;
    }
    return match;
  });
  
  // Fix any remaining number+spaced unit: "330 ml" → "330ml"
  fixed = fixed.replace(/\b(\d+)\s+(ml|cl|dl|kg|g|mg|oz|lb|pc|pcs|l|gr)\b/gi, '$1$2');
  
  return fixed;
}

/**
 * Main function: Fix OCR errors in product name
 * 
 * @param name - Raw product name from OCR
 * @returns Corrected product name
 */
export function fixOCRErrors(name: string): string {
  if (!name || typeof name !== 'string') {
    return name;
  }
  
  // Keep original case for first letter, normalize rest
  const originalName = name.trim();
  
  // Normalize: remove accents for processing
  let fixed = originalName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // STEP 1: Fix number-letter confusion in measurements (e30 ml → 330ml)
  fixed = fixNumberLetterConfusion(fixed);
  
  // STEP 2: Apply common regex fixes for brand names
  // Common OCR spacing patterns
  const spacingFixes: [RegExp, string][] = [
    // Known brand fixes (case insensitive)
    [/\bc\s*o\s*c\s*a\s*c\s*o\s*l\s*a\b/gi, 'Coca Cola'],
    [/\bc\s*o\s*c\s*a\s+c\s*o\s*l\s*a\b/gi, 'Coca Cola'],
    [/\bs\s*p\s*r\s*i\s*t\s*e\b/gi, 'Sprite'],
    [/\bf\s*a\s*n\s*t\s*a\b/gi, 'Fanta'],
    [/\bp\s*e\s*p\s*s\s*i\b/gi, 'Pepsi'],
    [/\bh\s*e\s*i\s*n\s*e\s*k\s*e\s*n\b/gi, 'Heineken'],
    [/\bc\s*a\s*s\s*t\s*e\s*l\b/gi, 'Castel'],
    [/\bn\s*e\s*s\s*c\s*a\s*f\s*e\b/gi, 'Nescafe'],
    [/\bn\s*u\s*t\s*e\s*l\s*l\s*a\b/gi, 'Nutella'],
    [/\bv\s*i\s*r\s*g\s*i\s*n\b/gi, 'Virgin'],
    [/\bm\s*o\s*j\s*i\s*t\s*o\b/gi, 'Mojito'],
    [/\by\s*o\s*g\s*u\s*r\s*t\b/gi, 'Yogurt'],
    [/\by\s*a\s*o\s*u\s*r\s*t\b/gi, 'Yaourt'],
    
    // Common grocery words
    [/\bb\s*i\s*s\s*c\s*u\s*i\s*t\b/gi, 'Biscuit'],
    [/\bc\s*h\s*o\s*c\s*o\s*l\s*a\s*t\b/gi, 'Chocolat'],
    [/\bs\s*p\s*a\s*g\s*h\s*e\s*t\s*t\s*i\b/gi, 'Spaghetti'],
  ];
  
  for (const [pattern, replacement] of spacingFixes) {
    if (pattern.test(fixed)) {
      const before = fixed;
      fixed = fixed.replace(pattern, replacement);
      if (before !== fixed) {
        console.log(`📝 Regex fix: "${before}" → "${fixed}"`);
      }
    }
  }
  
  // Split into words and try to fix spacing
  const words = fixed.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length > 1) {
    // Check if we have obvious spacing issues (single chars or very short fragments)
    const hasSpacingIssue = words.some(w => w.length === 1) || 
                           words.filter(w => w.length <= 2).length >= words.length / 2;
    
    if (hasSpacingIssue) {
      console.log(`📝 Checking spacing for: "${fixed}" → [${words.join(', ')}]`);
      const fixedWords = tryFixSpacing(words);
      fixed = fixedWords.join(' ');
    }
  }
  
  // If we made changes, log them
  if (fixed.toLowerCase() !== originalName.toLowerCase()) {
    console.log(`📝 OCR Fix: "${originalName}" → "${fixed}"`);
  }
  
  return fixed;
}

/**
 * Quick check without full spell checking (for performance)
 * Just applies common regex fixes
 */
export function quickFixOCR(name: string): string {
  if (!name) return name;
  
  let fixed = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  // Quick single-letter-at-start fix
  // "S prite" → "Sprite" (only if result is a known word)
  const match = fixed.match(/^([A-Za-z])\s+([a-z]{3,})$/i);
  if (match) {
    const combined = match[1] + match[2];
    if (PRODUCT_DICTIONARY.has(combined.toLowerCase())) {
      return combined;
    }
  }
  
  return fixed;
}

// Export the product dictionary for use elsewhere
export { PRODUCT_DICTIONARY };
