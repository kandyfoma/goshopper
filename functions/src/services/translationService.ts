/**
 * Translation Service for Multilingual Search
 * 
 * Uses Google Cloud Translation API (free tier: 500k chars/month)
 * Falls back to a simple dictionary for common grocery terms
 * 
 * This enables searching "poulet" and finding "chicken" items, and vice versa.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
let geminiAI: GoogleGenerativeAI | null = null;

function getGeminiAI(): GoogleGenerativeAI {
  if (!geminiAI) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    geminiAI = new GoogleGenerativeAI(apiKey);
  }
  return geminiAI;
}

// Cache translations to avoid repeated API calls
const translationCache = new Map<string, { fr: string; en: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Common grocery translations (instant, no API call needed)
const INSTANT_TRANSLATIONS: Record<string, { fr: string; en: string }> = {
  // Meat & Poultry
  'poulet': { fr: 'poulet', en: 'chicken' },
  'chicken': { fr: 'poulet', en: 'chicken' },
  'boeuf': { fr: 'boeuf', en: 'beef' },
  'beef': { fr: 'boeuf', en: 'beef' },
  'viande': { fr: 'viande', en: 'meat' },
  'meat': { fr: 'viande', en: 'meat' },
  'poisson': { fr: 'poisson', en: 'fish' },
  'fish': { fr: 'poisson', en: 'fish' },
  'porc': { fr: 'porc', en: 'pork' },
  'pork': { fr: 'porc', en: 'pork' },
  
  // Dairy
  'lait': { fr: 'lait', en: 'milk' },
  'milk': { fr: 'lait', en: 'milk' },
  'oeuf': { fr: 'oeuf', en: 'egg' },
  'oeufs': { fr: 'oeufs', en: 'eggs' },
  'egg': { fr: 'oeuf', en: 'egg' },
  'eggs': { fr: 'oeufs', en: 'eggs' },
  'fromage': { fr: 'fromage', en: 'cheese' },
  'cheese': { fr: 'fromage', en: 'cheese' },
  'beurre': { fr: 'beurre', en: 'butter' },
  'butter': { fr: 'beurre', en: 'butter' },
  'yaourt': { fr: 'yaourt', en: 'yogurt' },
  'yogurt': { fr: 'yaourt', en: 'yogurt' },
  
  // Staples
  'riz': { fr: 'riz', en: 'rice' },
  'rice': { fr: 'riz', en: 'rice' },
  'pain': { fr: 'pain', en: 'bread' },
  'bread': { fr: 'pain', en: 'bread' },
  'farine': { fr: 'farine', en: 'flour' },
  'flour': { fr: 'farine', en: 'flour' },
  'huile': { fr: 'huile', en: 'oil' },
  'oil': { fr: 'huile', en: 'oil' },
  'sucre': { fr: 'sucre', en: 'sugar' },
  'sugar': { fr: 'sucre', en: 'sugar' },
  'sel': { fr: 'sel', en: 'salt' },
  'salt': { fr: 'sel', en: 'salt' },
  
  // Fruits
  'pomme': { fr: 'pomme', en: 'apple' },
  'apple': { fr: 'pomme', en: 'apple' },
  'banane': { fr: 'banane', en: 'banana' },
  'banana': { fr: 'banane', en: 'banana' },
  'orange': { fr: 'orange', en: 'orange' },
  'mangue': { fr: 'mangue', en: 'mango' },
  'mango': { fr: 'mangue', en: 'mango' },
  'ananas': { fr: 'ananas', en: 'pineapple' },
  'pineapple': { fr: 'ananas', en: 'pineapple' },
  'citron': { fr: 'citron', en: 'lemon' },
  'lemon': { fr: 'citron', en: 'lemon' },
  'raisin': { fr: 'raisin', en: 'grape' },
  'grape': { fr: 'raisin', en: 'grape' },
  
  // Vegetables
  'tomate': { fr: 'tomate', en: 'tomato' },
  'tomato': { fr: 'tomate', en: 'tomato' },
  'oignon': { fr: 'oignon', en: 'onion' },
  'onion': { fr: 'oignon', en: 'onion' },
  'carotte': { fr: 'carotte', en: 'carrot' },
  'carrot': { fr: 'carotte', en: 'carrot' },
  'pomme de terre': { fr: 'pomme de terre', en: 'potato' },
  'potato': { fr: 'pomme de terre', en: 'potato' },
  'chou': { fr: 'chou', en: 'cabbage' },
  'cabbage': { fr: 'chou', en: 'cabbage' },
  'salade': { fr: 'salade', en: 'lettuce' },
  'lettuce': { fr: 'salade', en: 'lettuce' },
  'concombre': { fr: 'concombre', en: 'cucumber' },
  'cucumber': { fr: 'concombre', en: 'cucumber' },
  'ail': { fr: 'ail', en: 'garlic' },
  'garlic': { fr: 'ail', en: 'garlic' },
  'haricot': { fr: 'haricot', en: 'bean' },
  'bean': { fr: 'haricot', en: 'bean' },
  'legume': { fr: 'légume', en: 'vegetable' },
  'vegetable': { fr: 'légume', en: 'vegetable' },
  'fruit': { fr: 'fruit', en: 'fruit' },
  
  // Beverages
  'eau': { fr: 'eau', en: 'water' },
  'water': { fr: 'eau', en: 'water' },
  'jus': { fr: 'jus', en: 'juice' },
  'juice': { fr: 'jus', en: 'juice' },
  'biere': { fr: 'bière', en: 'beer' },
  'beer': { fr: 'bière', en: 'beer' },
  'vin': { fr: 'vin', en: 'wine' },
  'wine': { fr: 'vin', en: 'wine' },
  'soda': { fr: 'soda', en: 'soda' },
  'boisson': { fr: 'boisson', en: 'drink' },
  'drink': { fr: 'boisson', en: 'drink' },
  
  // Hygiene & Household
  'savon': { fr: 'savon', en: 'soap' },
  'soap': { fr: 'savon', en: 'soap' },
  'detergent': { fr: 'détergent', en: 'detergent' },
  'lessive': { fr: 'lessive', en: 'laundry detergent' },
  'shampooing': { fr: 'shampooing', en: 'shampoo' },
  'shampoo': { fr: 'shampooing', en: 'shampoo' },
  'dentifrice': { fr: 'dentifrice', en: 'toothpaste' },
  'toothpaste': { fr: 'dentifrice', en: 'toothpaste' },
  'papier toilette': { fr: 'papier toilette', en: 'toilet paper' },
  'toilet paper': { fr: 'papier toilette', en: 'toilet paper' },
  'couche': { fr: 'couche', en: 'diaper' },
  'diaper': { fr: 'couche', en: 'diaper' },
  
  // Common Lingala/Swahili (DRC)
  'nyama': { fr: 'viande', en: 'meat' },
  'mbisi': { fr: 'poisson', en: 'fish' },
  'mafuta': { fr: 'huile', en: 'oil' },
  'maziwa': { fr: 'lait', en: 'milk' },
  'mkate': { fr: 'pain', en: 'bread' },
  'kuku': { fr: 'poulet', en: 'chicken' },
  'nyanya': { fr: 'tomate', en: 'tomato' },
  'viazi': { fr: 'pomme de terre', en: 'potato' },
  'mahindi': { fr: 'maïs', en: 'corn' },
  'wali': { fr: 'riz', en: 'rice' },
  'samaki': { fr: 'poisson', en: 'fish' },
  'mungwa': { fr: 'sel', en: 'salt' },
};

/**
 * Get instant translation from cache or dictionary
 */
function getInstantTranslation(term: string): { fr: string; en: string } | null {
  const normalized = term.toLowerCase().trim();
  
  // Check instant dictionary
  if (INSTANT_TRANSLATIONS[normalized]) {
    return INSTANT_TRANSLATIONS[normalized];
  }
  
  // Check cache
  const cached = translationCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { fr: cached.fr, en: cached.en };
  }
  
  return null;
}

/**
 * Translate a term using Gemini AI (for terms not in dictionary)
 * Returns both French and English translations
 */
async function translateWithGemini(term: string): Promise<{ fr: string; en: string }> {
  try {
    const model = getGeminiAI().getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 100,
      },
    });

    const prompt = `Translate this grocery/food term to both French and English. 
Term: "${term}"

Return ONLY a JSON object like: {"fr": "french translation", "en": "english translation"}
If the term is already in French, return it as-is for "fr" and translate to English for "en".
If the term is already in English, return it as-is for "en" and translate to French for "fr".
If the term is in another language (Lingala, Swahili), translate to both French and English.
For brand names (Sadia, Clover, etc), keep the brand name and add the product type.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.fr && parsed.en) {
        // Cache the result
        translationCache.set(term.toLowerCase().trim(), {
          fr: parsed.fr.toLowerCase(),
          en: parsed.en.toLowerCase(),
          timestamp: Date.now(),
        });
        return { fr: parsed.fr.toLowerCase(), en: parsed.en.toLowerCase() };
      }
    }
    
    // Fallback: return original term
    return { fr: term.toLowerCase(), en: term.toLowerCase() };
  } catch (error) {
    console.error('Translation error:', error);
    return { fr: term.toLowerCase(), en: term.toLowerCase() };
  }
}

/**
 * Get translations for a search term
 * First checks instant dictionary, then uses Gemini AI
 */
export async function getSearchTranslations(term: string): Promise<{ 
  original: string;
  fr: string; 
  en: string;
  searchTerms: string[];
}> {
  const normalized = term.toLowerCase().trim();
  
  // Try instant translation first (no API call)
  const instant = getInstantTranslation(normalized);
  if (instant) {
    const searchTerms = new Set([normalized, instant.fr, instant.en]);
    return {
      original: normalized,
      fr: instant.fr,
      en: instant.en,
      searchTerms: Array.from(searchTerms),
    };
  }
  
  // Use Gemini for unknown terms
  const translated = await translateWithGemini(normalized);
  const searchTerms = new Set([normalized, translated.fr, translated.en]);
  
  return {
    original: normalized,
    fr: translated.fr,
    en: translated.en,
    searchTerms: Array.from(searchTerms),
  };
}

/**
 * Batch translate multiple terms (for efficiency)
 */
export async function batchTranslate(terms: string[]): Promise<Map<string, { fr: string; en: string }>> {
  const results = new Map<string, { fr: string; en: string }>();
  const needsTranslation: string[] = [];
  
  // Check instant translations first
  for (const term of terms) {
    const instant = getInstantTranslation(term);
    if (instant) {
      results.set(term.toLowerCase(), instant);
    } else {
      needsTranslation.push(term);
    }
  }
  
  // Batch translate remaining terms with Gemini
  if (needsTranslation.length > 0) {
    try {
      const model = getGeminiAI().getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 500,
        },
      });

      const prompt = `Translate these grocery terms to both French and English.
Terms: ${JSON.stringify(needsTranslation)}

Return a JSON array like: [{"term": "original", "fr": "french", "en": "english"}, ...]`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const item of parsed) {
          if (item.term && item.fr && item.en) {
            results.set(item.term.toLowerCase(), { 
              fr: item.fr.toLowerCase(), 
              en: item.en.toLowerCase() 
            });
            // Cache it
            translationCache.set(item.term.toLowerCase(), {
              fr: item.fr.toLowerCase(),
              en: item.en.toLowerCase(),
              timestamp: Date.now(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Batch translation error:', error);
      // Fallback: use original terms
      for (const term of needsTranslation) {
        results.set(term.toLowerCase(), { fr: term.toLowerCase(), en: term.toLowerCase() });
      }
    }
  }
  
  return results;
}

/**
 * Clear translation cache (for testing)
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}
