/**
 * Fuzzy String Matching Utilities
 * Used for matching shop names when OCR isn't perfect
 */

/**
 * Calculate Levenshtein distance between two strings
 * (number of single-character edits needed to transform one string to another)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1, // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0 to 1)
 * 1 = perfect match, 0 = completely different
 */
export function similarityScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLength;
}

/**
 * Normalize a string for comparison
 * Removes accents, special characters, extra spaces
 */
export function normalizeForComparison(str: string): string {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Check if string contains common OCR errors and get possible corrections
 */
export function getOCRVariants(str: string): string[] {
  const variants: string[] = [str];
  const normalized = normalizeForComparison(str);
  
  // Common OCR substitutions
  const ocrSubstitutions: [string, string][] = [
    ['0', 'o'],
    ['o', '0'],
    ['1', 'l'],
    ['l', '1'],
    ['1', 'i'],
    ['i', '1'],
    ['5', 's'],
    ['s', '5'],
    ['8', 'b'],
    ['b', '8'],
    ['6', 'g'],
    ['g', '6'],
    ['rn', 'm'],
    ['m', 'rn'],
    ['vv', 'w'],
    ['w', 'vv'],
    ['cl', 'd'],
    ['d', 'cl'],
    ['ii', 'u'],
    ['u', 'ii'],
  ];

  // Generate variants with common substitutions
  for (const [from, to] of ocrSubstitutions) {
    if (normalized.includes(from)) {
      variants.push(normalized.replace(new RegExp(from, 'g'), to));
    }
  }

  return [...new Set(variants)]; // Remove duplicates
}

export interface FuzzyMatchResult {
  match: string;
  originalName: string;
  score: number;
  isExactMatch: boolean;
}

/**
 * Find the best matching string from a list of candidates
 * @param target The string to match
 * @param candidates List of possible matches
 * @param threshold Minimum similarity score to consider a match (0-1)
 * @returns Best match result or null if no good match found
 */
export function findBestMatch(
  target: string,
  candidates: Array<{normalized: string; original: string}>,
  threshold: number = 0.7,
): FuzzyMatchResult | null {
  if (!target || candidates.length === 0) return null;

  const normalizedTarget = normalizeForComparison(target);
  const targetVariants = getOCRVariants(normalizedTarget);

  let bestMatch: FuzzyMatchResult | null = null;
  let highestScore = 0;

  for (const candidate of candidates) {
    const candidateNormalized = normalizeForComparison(candidate.normalized);
    
    // Check exact match first
    if (normalizedTarget === candidateNormalized) {
      return {
        match: candidate.normalized,
        originalName: candidate.original,
        score: 1,
        isExactMatch: true,
      };
    }

    // Check variants for exact match
    for (const variant of targetVariants) {
      if (variant === candidateNormalized) {
        return {
          match: candidate.normalized,
          originalName: candidate.original,
          score: 0.95, // Very high score for OCR-corrected exact match
          isExactMatch: false,
        };
      }
    }

    // Calculate similarity scores
    for (const variant of targetVariants) {
      const score = similarityScore(variant, candidateNormalized);
      
      // Also check if one contains the other (partial match bonus)
      const containsBonus = 
        candidateNormalized.includes(normalizedTarget) || 
        normalizedTarget.includes(candidateNormalized) 
          ? 0.1 
          : 0;

      const totalScore = Math.min(score + containsBonus, 1);

      if (totalScore > highestScore && totalScore >= threshold) {
        highestScore = totalScore;
        bestMatch = {
          match: candidate.normalized,
          originalName: candidate.original,
          score: totalScore,
          isExactMatch: false,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Common store name patterns to help with matching
 */
export const COMMON_STORE_PATTERNS: {[key: string]: string[]} = {
  // Supermarkets
  peloustore: ['pelou', 'pelo', 'peloustore', 'pelou store'],
  shoprite: ['shoprite', 'shop rite', 'shoprit'],
  carrefour: ['carrefour', 'carefour', 'carfour', 'carrefor'],
  citymarket: ['city market', 'citymarket', 'city marke'],
  casino: ['casino', 'casno', 'casin0'],
  
  // DRC specific stores
  hasson: ['hasson', 'hason', 'hassn', 'hassan'],
  rawbank: ['rawbank', 'raw bank', 'rawbanque'],
  vodacom: ['vodacom', 'voda', 'vodac0m'],
  airtel: ['airtel', 'airte1', 'airtell'],
  orange: ['orange', '0range', 'orang'],
};

/**
 * Match store name against common patterns
 */
export function matchCommonPattern(storeName: string): string | null {
  const normalized = normalizeForComparison(storeName);
  
  for (const [canonical, patterns] of Object.entries(COMMON_STORE_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        return canonical;
      }
      // Check similarity
      if (similarityScore(normalized, pattern) >= 0.8) {
        return canonical;
      }
    }
  }
  
  return null;
}

/**
 * Clean and normalize item name from OCR
 * Removes extra spaces, standardizes formatting, fixes common OCR errors
 */
export function cleanItemName(itemName: string): string {
  if (!itemName || typeof itemName !== 'string') {
    return itemName;
  }

  let cleaned = itemName;

  // Remove multiple spaces (common in OCR)
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Trim whitespace
  cleaned = cleaned.trim();

  // Fix common OCR formatting issues
  // Remove spaces before/after common separators
  cleaned = cleaned.replace(/\s*-\s*/g, '-');
  cleaned = cleaned.replace(/\s*\/\s*/g, '/');
  cleaned = cleaned.replace(/\s*\(\s*/g, ' (');
  cleaned = cleaned.replace(/\s*\)\s*/g, ') ');

  // Standardize unit formatting (e.g., "500 g" -> "500g")
  cleaned = cleaned.replace(/(\d+)\s*(kg|g|mg|l|ml|cl)\b/gi, (match, num, unit) => {
    return `${num}${unit.toLowerCase()}`;
  });

  // Title case for better readability (first letter of each word capitalized)
  cleaned = cleaned.replace(/\b\w+/g, (word) => {
    // Keep all-caps words (like "USA") and lowercase units (like "ml", "kg")
    if (word === word.toUpperCase() && word.length > 1) return word;
    if (/^(ml|kg|g|mg|l|cl)$/i.test(word)) return word.toLowerCase();
    // Title case
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  // Final trim
  cleaned = cleaned.trim();

  return cleaned;
}
