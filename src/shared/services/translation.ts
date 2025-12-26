// Bilingual Translation Service
// Hybrid approach: Static dictionary + MyMemory API fallback
// Allows users to search in either language and find matching items

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TranslationEntry {
  fr: string[];
  en: string[];
}

interface CachedTranslation {
  term: string;
  translations: string[];
  timestamp: number;
}

// Common food and grocery item translations
const TRANSLATION_MAP: TranslationEntry[] = [
  // Bread & Bakery
  { fr: ['pain', 'baguette'], en: ['bread', 'baguette'] },
  { fr: ['croissant', 'croissants'], en: ['croissant', 'croissants'] },
  { fr: ['gâteau', 'gateau', 'gateaux'], en: ['cake', 'cakes'] },
  { fr: ['biscuit', 'biscuits'], en: ['cookie', 'cookies', 'biscuit', 'biscuits'] },
  { fr: ['brioche', 'brioches'], en: ['brioche', 'sweet bread'] },
  
  // Dairy
  { fr: ['lait'], en: ['milk'] },
  { fr: ['fromage'], en: ['cheese'] },
  { fr: ['beurre'], en: ['butter'] },
  { fr: ['yaourt', 'yogourt', 'yoghurt'], en: ['yogurt', 'yoghurt'] },
  { fr: ['crème', 'creme'], en: ['cream'] },
  { fr: ['œuf', 'oeuf', 'oeufs'], en: ['egg', 'eggs'] },
  
  // Meat & Fish
  { fr: ['viande'], en: ['meat'] },
  { fr: ['poulet'], en: ['chicken'] },
  { fr: ['bœuf', 'boeuf'], en: ['beef'] },
  { fr: ['porc'], en: ['pork'] },
  { fr: ['poisson'], en: ['fish'] },
  { fr: ['saumon'], en: ['salmon'] },
  { fr: ['thon'], en: ['tuna'] },
  { fr: ['crevette', 'crevettes'], en: ['shrimp', 'prawns'] },
  { fr: ['jambon'], en: ['ham'] },
  { fr: ['saucisse', 'saucisses'], en: ['sausage', 'sausages'] },
  
  // Fruits
  { fr: ['pomme', 'pommes'], en: ['apple', 'apples'] },
  { fr: ['banane', 'bananes'], en: ['banana', 'bananas'] },
  { fr: ['orange', 'oranges'], en: ['orange', 'oranges'] },
  { fr: ['fraise', 'fraises'], en: ['strawberry', 'strawberries'] },
  { fr: ['raisin', 'raisins'], en: ['grape', 'grapes'] },
  { fr: ['ananas'], en: ['pineapple'] },
  { fr: ['mangue', 'mangues'], en: ['mango', 'mangoes'] },
  { fr: ['citron', 'citrons'], en: ['lemon', 'lemons'] },
  { fr: ['poire', 'poires'], en: ['pear', 'pears'] },
  { fr: ['pêche', 'peche', 'peches'], en: ['peach', 'peaches'] },
  { fr: ['melon', 'melons'], en: ['melon', 'melons'] },
  { fr: ['pastèque', 'pasteque'], en: ['watermelon'] },
  
  // Vegetables
  { fr: ['légume', 'legume', 'legumes'], en: ['vegetable', 'vegetables'] },
  { fr: ['tomate', 'tomates'], en: ['tomato', 'tomatoes'] },
  { fr: ['pomme de terre', 'pommes de terre', 'patate'], en: ['potato', 'potatoes'] },
  { fr: ['carotte', 'carottes'], en: ['carrot', 'carrots'] },
  { fr: ['oignon', 'oignons'], en: ['onion', 'onions'] },
  { fr: ['ail'], en: ['garlic'] },
  { fr: ['salade', 'laitue'], en: ['lettuce', 'salad'] },
  { fr: ['chou'], en: ['cabbage'] },
  { fr: ['épinard', 'epinard', 'epinards'], en: ['spinach'] },
  { fr: ['haricot', 'haricots'], en: ['bean', 'beans'] },
  { fr: ['petit pois', 'petits pois', 'pois'], en: ['pea', 'peas'] },
  { fr: ['concombre', 'concombres'], en: ['cucumber', 'cucumbers'] },
  { fr: ['poivron', 'poivrons'], en: ['bell pepper', 'peppers'] },
  { fr: ['aubergine', 'aubergines'], en: ['eggplant', 'eggplants', 'aubergine'] },
  { fr: ['courgette', 'courgettes'], en: ['zucchini', 'courgette'] },
  
  // Beverages
  { fr: ['eau'], en: ['water'] },
  { fr: ['jus'], en: ['juice'] },
  { fr: ['café', 'cafe'], en: ['coffee'] },
  { fr: ['thé', 'the'], en: ['tea'] },
  { fr: ['bière', 'biere'], en: ['beer'] },
  { fr: ['vin'], en: ['wine'] },
  { fr: ['soda', 'boisson gazeuse'], en: ['soda', 'soft drink'] },
  { fr: ['coca', 'coca-cola'], en: ['coke', 'coca-cola'] },
  
  // Pantry & Dry Goods
  { fr: ['riz'], en: ['rice'] },
  { fr: ['pâte', 'pate', 'pates'], en: ['pasta', 'noodles'] },
  { fr: ['farine'], en: ['flour'] },
  { fr: ['sucre'], en: ['sugar'] },
  { fr: ['sel'], en: ['salt'] },
  { fr: ['huile'], en: ['oil'] },
  { fr: ['vinaigre'], en: ['vinegar'] },
  { fr: ['moutarde'], en: ['mustard'] },
  { fr: ['ketchup'], en: ['ketchup', 'catsup'] },
  { fr: ['mayonnaise'], en: ['mayonnaise', 'mayo'] },
  { fr: ['céréale', 'cereale', 'cereales'], en: ['cereal', 'cereals'] },
  { fr: ['confiture'], en: ['jam', 'jelly'] },
  { fr: ['miel'], en: ['honey'] },
  { fr: ['chocolat'], en: ['chocolate'] },
  
  // Household & Hygiene
  { fr: ['savon'], en: ['soap'] },
  { fr: ['shampooing', 'shampoing'], en: ['shampoo'] },
  { fr: ['dentifrice'], en: ['toothpaste'] },
  { fr: ['papier toilette', 'papier hygiénique', 'papier hygienique'], en: ['toilet paper', 'tissue'] },
  { fr: ['serviette', 'serviettes'], en: ['towel', 'towels', 'napkin', 'napkins'] },
  { fr: ['détergent', 'detergent', 'lessive'], en: ['detergent', 'laundry soap'] },
  { fr: ['liquide vaisselle', 'produit vaisselle'], en: ['dish soap', 'dishwashing liquid'] },
  { fr: ['brosse à dents', 'brosse a dents'], en: ['toothbrush'] },
  
  // Baby Products
  { fr: ['couche', 'couches'], en: ['diaper', 'diapers', 'nappy', 'nappies'] },
  { fr: ['biberon', 'biberons'], en: ['baby bottle', 'bottles'] },
  { fr: ['lait bébé', 'lait bebe', 'formule'], en: ['baby formula', 'infant formula'] },
  { fr: ['lingette', 'lingettes'], en: ['wipe', 'wipes', 'baby wipes'] },
  
  // Common modifiers/adjectives
  { fr: ['frais', 'fraîche', 'fraiche'], en: ['fresh'] },
  { fr: ['congelé', 'congele', 'surgelé', 'surgele'], en: ['frozen'] },
  { fr: ['bio', 'biologique'], en: ['organic', 'bio'] },
  { fr: ['entier', 'entière', 'entiere'], en: ['whole'] },
  { fr: ['demi', 'moitié', 'moitie'], en: ['half'] },
  { fr: ['tranché', 'tranche', 'tranchés', 'tranches'], en: ['sliced'] },
  { fr: ['râpé', 'rape', 'râpés', 'rapes'], en: ['grated', 'shredded'] },
];

// Build reverse lookup maps for fast searching
const frenchToEnglishMap = new Map<string, string[]>();
const englishToFrenchMap = new Map<string, string[]>();

// Initialize maps
TRANSLATION_MAP.forEach(entry => {
  // French -> English
  entry.fr.forEach(frTerm => {
    const normalized = frTerm.toLowerCase().trim();
    if (!frenchToEnglishMap.has(normalized)) {
      frenchToEnglishMap.set(normalized, []);
    }
    frenchToEnglishMap.get(normalized)?.push(...entry.en);
  });
  
  // English -> French
  entry.en.forEach(enTerm => {
    const normalized = enTerm.toLowerCase().trim();
    if (!englishToFrenchMap.has(normalized)) {
      englishToFrenchMap.set(normalized, []);
    }
    englishToFrenchMap.get(normalized)?.push(...entry.fr);
  });
});

/**
 * Normalize string for comparison (lowercase, remove accents)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();
}

/**
 * Get all translation variants for a search term
 * Returns both the original term and its translations
 * 
 * @param searchTerm - The term to translate
 * @returns Array of all related terms (including original)
 */
export function getTranslationVariants(searchTerm: string): string[] {
  const normalized = normalizeString(searchTerm);
  const variants = new Set<string>([searchTerm, normalized]);
  
  // Check for exact matches in translation maps
  const englishTranslations = frenchToEnglishMap.get(normalized) || [];
  const frenchTranslations = englishToFrenchMap.get(normalized) || [];
  
  englishTranslations.forEach(term => variants.add(term));
  frenchTranslations.forEach(term => variants.add(term));
  
  // Check for partial matches (words within the search term)
  const words = normalized.split(/[\s-]+/).filter(w => w.length >= 3);
  words.forEach(word => {
    const enTranslations = frenchToEnglishMap.get(word) || [];
    const frTranslations = englishToFrenchMap.get(word) || [];
    enTranslations.forEach(term => variants.add(term));
    frTranslations.forEach(term => variants.add(term));
  });
  
  return Array.from(variants);
}

/**
 * Check if an item name matches a search query using bilingual matching
 * This enhances the existing search to support cross-language queries
 * 
 * @param itemName - The name of the item to check
 * @param searchQuery - The user's search query
 * @returns true if the item matches the query in either language
 */
export function bilingualMatch(itemName: string, searchQuery: string): boolean {
  const normalizedItem = normalizeString(itemName);
  const normalizedQuery = normalizeString(searchQuery);
  
  // Direct match
  if (normalizedItem.includes(normalizedQuery)) {
    return true;
  }
  
  // Get all translation variants of the search query
  const variants = getTranslationVariants(searchQuery);
  
  // Check if any variant matches the item name
  for (const variant of variants) {
    const normalizedVariant = normalizeString(variant);
    if (normalizedItem.includes(normalizedVariant)) {
      return true;
    }
    
    // Also check word-by-word matching
    const variantWords = normalizedVariant.split(/[\s-]+/).filter(w => w.length >= 2);
    const itemWords = normalizedItem.split(/[\s-]+/).filter(w => w.length >= 2);
    
    for (const vWord of variantWords) {
      for (const iWord of itemWords) {
        if (iWord.includes(vWord) || vWord.includes(iWord)) {
          return true;
        }
        if (iWord.startsWith(vWord) || vWord.startsWith(iWord)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Cache configuration
const CACHE_PREFIX = 'translation_cache_';
const CACHE_EXPIRY_DAYS = 30; // Cache translations for 30 days
const API_TIMEOUT_MS = 2000; // 2 second timeout for API calls

// In-memory cache for this session
const sessionCache = new Map<string, string[]>();

/**
 * Fetch translation from MyMemory API
 * Free tier: 5000 requests/day, no API key needed
 */
async function fetchFromAPI(text: string, sourceLang: string, targetLang: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translation = data.responseData.translatedText.toLowerCase().trim();
      return translation ? [translation] : [];
    }
    
    return [];
  } catch (error) {
    // Silent fail - network errors, timeouts, etc.
    console.log('Translation API call failed:', error);
    return [];
  }
}

/**
 * Load cached translations from AsyncStorage
 */
async function loadCachedTranslation(term: string): Promise<string[] | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_PREFIX + term);
    if (!cached) return null;

    const data: CachedTranslation = JSON.parse(cached);
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (now - data.timestamp > expiryTime) {
      // Expired, remove from cache
      await AsyncStorage.removeItem(CACHE_PREFIX + term);
      return null;
    }

    return data.translations;
  } catch (error) {
    return null;
  }
}

/**
 * Save translation to cache
 */
async function saveCachedTranslation(term: string, translations: string[]): Promise<void> {
  try {
    const data: CachedTranslation = {
      term,
      translations,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_PREFIX + term, JSON.stringify(data));
  } catch (error) {
    // Silent fail - cache save is not critical
  }
}

/**
 * Get translations using hybrid approach
 * 1. Check static dictionary
 * 2. Check session cache
 * 3. Check AsyncStorage cache
 * 4. Fallback to API (if online)
 */
async function getTranslationsHybrid(searchTerm: string): Promise<string[]> {
  const normalized = normalizeString(searchTerm);
  
  // 1. Check static dictionary (instant)
  const staticTranslations: string[] = [];
  const englishTranslations = frenchToEnglishMap.get(normalized) || [];
  const frenchTranslations = englishToFrenchMap.get(normalized) || [];
  staticTranslations.push(...englishTranslations, ...frenchTranslations);
  
  if (staticTranslations.length > 0) {
    return staticTranslations;
  }

  // 2. Check session cache (instant)
  if (sessionCache.has(normalized)) {
    return sessionCache.get(normalized) || [];
  }

  // 3. Check AsyncStorage cache (fast)
  const cachedTranslations = await loadCachedTranslation(normalized);
  if (cachedTranslations && cachedTranslations.length > 0) {
    sessionCache.set(normalized, cachedTranslations);
    return cachedTranslations;
  }

  // 4. Fallback to API (slower, requires internet)
  try {
    const allTranslations: string[] = [];
    
    // Try French to English
    const frToEn = await fetchFromAPI(searchTerm, 'fr', 'en');
    allTranslations.push(...frToEn);
    
    // Try English to French
    const enToFr = await fetchFromAPI(searchTerm, 'en', 'fr');
    allTranslations.push(...enToFr);

    if (allTranslations.length > 0) {
      // Cache the results
      sessionCache.set(normalized, allTranslations);
      await saveCachedTranslation(normalized, allTranslations);
      return allTranslations;
    }
  } catch (error) {
    // API failed, continue without translations
  }

  return [];
}

/**
 * Enhanced getTranslationVariants with hybrid API fallback
 * Returns both the original term and its translations
 */
async function getTranslationVariantsAsync(searchTerm: string): Promise<string[]> {
  const normalized = normalizeString(searchTerm);
  const variants = new Set<string>([searchTerm, normalized]);
  
  // Get translations (static + cached + API)
  const translations = await getTranslationsHybrid(searchTerm);
  translations.forEach(term => variants.add(term));
  
  // Check for partial matches in static dictionary (words within the search term)
  const words = normalized.split(/[\s-]+/).filter(w => w.length >= 3);
  for (const word of words) {
    const enTranslations = frenchToEnglishMap.get(word) || [];
    const frTranslations = englishToFrenchMap.get(word) || [];
    enTranslations.forEach(term => variants.add(term));
    frTranslations.forEach(term => variants.add(term));
  }
  
  return Array.from(variants);
}

/**
 * Enhanced bilingual match with hybrid API support
 * Now async to support API calls
 */
export async function bilingualMatchAsync(itemName: string, searchQuery: string): Promise<boolean> {
  const normalizedItem = normalizeString(itemName);
  const normalizedQuery = normalizeString(searchQuery);
  
  // Direct match
  if (normalizedItem.includes(normalizedQuery)) {
    return true;
  }
  
  // Get all translation variants (including API results)
  const variants = await getTranslationVariantsAsync(searchQuery);
  
  // Check if any variant matches the item name
  for (const variant of variants) {
    const normalizedVariant = normalizeString(variant);
    if (normalizedItem.includes(normalizedVariant)) {
      return true;
    }
    
    // Also check word-by-word matching
    const variantWords = normalizedVariant.split(/[\s-]+/).filter(w => w.length >= 2);
    const itemWords = normalizedItem.split(/[\s-]+/).filter(w => w.length >= 2);
    
    for (const vWord of variantWords) {
      for (const iWord of itemWords) {
        if (iWord.includes(vWord) || vWord.includes(iWord)) {
          return true;
        }
        if (iWord.startsWith(vWord) || vWord.startsWith(iWord)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Pre-translate common search terms to build cache
 * Can be called in background during app initialization
 */
export async function preTranslateCommonTerms(terms: string[]): Promise<void> {
  for (const term of terms) {
    await getTranslationsHybrid(term);
  }
}

/**
 * Clear translation cache (for debugging or settings)
 */
export async function clearTranslationCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const translationKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(translationKeys);
    sessionCache.clear();
  } catch (error) {
    console.error('Failed to clear translation cache:', error);
  }
}

/**
 * Enhanced bilingual search that can be used as a drop-in replacement
 * for existing search functions
 */
export const translationService = {
  getTranslationVariants, // Sync version (static only)
  getTranslationVariantsAsync, // Async version (hybrid)
  bilingualMatch, // Sync version (static only)
  bilingualMatchAsync, // Async version (hybrid)
  normalizeString,
  preTranslateCommonTerms,
  clearTranslationCache,
};
