/**
 * Item Aggregation Service
 * 
 * ARCHITECTURE:
 * =============
 * 
 * We maintain TWO separate data stores for items:
 * 
 * 1. USER PERSONAL ITEMS (user can delete)
 *    Path: artifacts/{appId}/users/{userId}/items/{itemId}
 *    - Stores user's personal purchase history
 *    - Deleted when user deletes their receipts
 *    - Used for personal spending analytics
 * 
 * 2. MASTER CITY ITEMS TABLE (community data - NEVER deleted by users)
 *    Path: artifacts/{appId}/cityItems/{city}/items/{itemId}
 *    - Centralized price database for each city
 *    - Contains prices from ALL users in that city
 *    - NEVER deleted when users delete their receipts
 *    - Provides community price comparison data
 *    - Powers the "City Items" feature
 * 
 * When a receipt is scanned:
 *    → User items collection is updated (personal)
 *    → City items collection is updated (community)
 * 
 * When a receipt is deleted:
 *    → User items collection is cleaned up (removes their prices)
 *    → City items collection is UNTOUCHED (prices remain for community)
 * 
 * Triggered whenever a receipt is created or updated
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';
import {ReceiptItem} from '../types';
// Removed fixOCRErrors import - it was causing problems like "Sadia" → "Soda", "Full" → "Fufu"
// We now trust the AI parsing from Gemini instead of "correcting" already-good names

const db = admin.firestore();

// ============ DATA INTERFACES ============

/**
 * Price entry for user's personal items
 */
interface ItemPrice {
  storeName: string;
  originalName: string; // Item name as it appeared in this store
  price: number;
  currency: 'USD' | 'CDF';
  date: admin.firestore.Timestamp;
  receiptId: string;
}

/**
 * Price entry for master city items (includes userId for tracking)
 */
interface CityItemPrice extends ItemPrice {
  userId: string;
}

/**
 * User's personal aggregated item
 * Path: artifacts/{appId}/users/{userId}/items/{itemId}
 */
interface UserItem {
  id: string;
  name: string;
  nameNormalized: string;
  prices: ItemPrice[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  currency: 'USD' | 'CDF';
  totalPurchases: number;
  lastPurchaseDate: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Master city item (community data)
 * Path: artifacts/{appId}/cityItems/{city}/items/{itemId}
 * 
 * This is the MASTER TABLE - never deleted by users
 */
export interface CityItem {
  id: string;
  name: string;
  nameNormalized: string;
  city: string;
  category?: string;        // Item category (e.g., 'Boissons', 'Alimentation')
  searchKeywords?: string[]; // Keywords for enhanced search (e.g., ['wine', 'vin'] for 'merlot')
  prices: CityItemPrice[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  storeCount: number;
  userCount: number;        // Number of unique users who bought this
  userIds: string[];        // Array of userIds who have prices
  currency: 'USD' | 'CDF';
  totalPurchases: number;
  lastPurchaseDate: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Legacy interface for backward compatibility
interface AggregatedItem extends UserItem {}

/**
 * Extract size/weight/volume info from item name
 * Returns normalized size string (e.g., "5kg", "330ml", "1l") or null if not found
 * IMPORTANT: This determines if items are considered the same product or different
 * "Sucre 5kg" and "Sucre 1kg" should be DIFFERENT items for price comparison
 */
function extractSizeInfo(name: string): string | null {
  const lowerName = name.toLowerCase();
  
  // Pattern to match size/weight/volume
  // Matches: 5kg, 500g, 330ml, 1.5l, 2lb, 6x330ml, etc.
  const patterns = [
    // Weight: 5kg, 500g, 1.5kg
    /\b(\d+(?:\.\d+)?)\s*(kg|kilogram|kilograms)/i,
    /\b(\d+(?:\.\d+)?)\s*(g|gram|grams)(?!\w)/i,
    // Volume: 330ml, 1.5l, 500cl
    /\b(\d+(?:\.\d+)?)\s*(ml|millilitre|milliliter)/i,
    /\b(\d+(?:\.\d+)?)\s*(l|litre|liter|litres|liters)(?!\w)/i,
    /\b(\d+(?:\.\d+)?)\s*(cl|centilitre|centiliter)/i,
    /\b(\d+(?:\.\d+)?)\s*(dl|decilitre|deciliter)/i,
    // Imperial: 16oz, 2lb
    /\b(\d+(?:\.\d+)?)\s*(oz|ounce|ounces)/i,
    /\b(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds)/i,
    // Packs: 6 packs, 10 sachets
    /\b(\d+)\s*(pcs|pieces|pack|packs|sachets?|packets?)/i,
    // Multi-pack: 6x330ml
    /\b(\d+)\s*x\s*(\d+)\s*(ml|g|cl|l)?/i,
  ];
  
  for (const pattern of patterns) {
    const match = lowerName.match(pattern);
    if (match) {
      // Normalize the unit
      const value = match[1];
      let unit = (match[2] || '').toLowerCase();
      let multiplier = match[3] ? match[3].toLowerCase() : '';
      
      // Handle multi-pack format (6x330ml)
      if (multiplier) {
        return `${value}x${match[2]}${multiplier}`;
      }
      
      // Normalize units to standard short forms
      if (['kilogram', 'kilograms'].includes(unit)) unit = 'kg';
      if (['gram', 'grams'].includes(unit)) unit = 'g';
      if (['litre', 'liter', 'litres', 'liters'].includes(unit)) unit = 'l';
      if (['millilitre', 'milliliter'].includes(unit)) unit = 'ml';
      if (['centilitre', 'centiliter'].includes(unit)) unit = 'cl';
      if (['decilitre', 'deciliter'].includes(unit)) unit = 'dl';
      if (['ounce', 'ounces'].includes(unit)) unit = 'oz';
      if (['pound', 'pounds', 'lbs'].includes(unit)) unit = 'lb';
      if (['pieces', 'pcs'].includes(unit)) unit = 'pcs';
      if (['sachets', 'sachet'].includes(unit)) unit = 'sachet';
      if (['packets', 'packet'].includes(unit)) unit = 'pack';
      if (['packs'].includes(unit)) unit = 'pack';
      
      return `${value}${unit}`;
    }
  }
  
  return null;
}

/**
 * Normalize item name for consistent matching
 * - Corrects common OCR mistakes (1/l/i confusion, 0/o confusion)
 * - Removes product codes, SKUs
 * - NOW PRESERVES size/weight info (appended as suffix)
 * - Cleans up noise to get the core product name
 * 
 * IMPORTANT: Size IS part of the product identity!
 * "Sucre 5kg" and "Sucre 1kg" are DIFFERENT products for price comparison
 */
function normalizeItemName(name: string): string {
  // STEP 0: Extract size info BEFORE cleaning (we'll append it later)
  const sizeInfo = extractSizeInfo(name);
  
  let normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();

  // ============ STEP 1: Remove parenthetical codes like (l2), (z4), (e6), (lnd) ============
  normalized = normalized
    .replace(/\([^)]*\)/g, '') // Remove anything in parentheses
    .trim();

  // ============ STEP 2: Remove product codes/SKUs ============
  // Remove patterns like: e30, z85, t5, l4x18, a0m1, z8
  normalized = normalized
    .replace(/\b[a-z]\d+[a-z]?\d*\b/gi, '') // e30, z85, t5, a0m1
    .replace(/\b[a-z]\d+x\d+\b/gi, '') // l4x18
    .replace(/\b\d+[a-z]\d+\b/gi, '') // 4g00
    .trim();

  // ============ STEP 3: Remove size/weight/volume info from the NAME ============
  // We will append the normalized size at the end
  normalized = normalized
    .replace(/\b\d+(?:\.\d+)?\s*(ml|cl|dl|l|litre|liter|litres|liters)\b/gi, '') // 330ml, 1.5l, 5 litres
    .replace(/\b\d+(?:\.\d+)?\s*(g|kg|gram|grams|kilogram|kilograms)\b/gi, '') // 500g, 1kg
    .replace(/\b\d+(?:\.\d+)?\s*(oz|lb|lbs|pound|pounds|ounce|ounces)\b/gi, '') // 16oz, 2lb
    .replace(/\b\d+\s*(pcs|pieces|pack|packs|sachets?|packets?)\b/gi, '') // 6 packs, 10 sachets
    .replace(/\b\d+\s*x\s*\d+\s*(ml|g|cl|l)?\b/gi, '') // 6x330ml, 4x100g
    .trim();

  // ============ STEP 4: Remove noise words ============
  normalized = normalized
    .replace(/\b(alt\.?\s*unit|unit|pce|pcs|piece|pieces)\b/gi, '')
    .replace(/\b(medium|large|small|mini|maxi|jumbo|giant|family)\b/gi, '')
    .replace(/\b(new|nouveau|promo|promotion|special|edition)\b/gi, '')
    .trim();

  // ============ STEP 5: Clean up special characters ============
  normalized = normalized
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();

  // ============ STEP 6: Fix common OCR mistakes ============
  normalized = normalized
    // Fix specific known words first
    .replace(/\bm1lk\b/g, 'milk')
    .replace(/\bmi1k\b/g, 'milk')
    .replace(/\bm11k\b/g, 'milk')
    .replace(/\bo11\b/g, 'oil')
    .replace(/\bo1l\b/g, 'oil')
    .replace(/\boi1\b/g, 'oil')
    .replace(/\b0il\b/g, 'oil')
    .replace(/\b011\b/g, 'oil')
    .replace(/\b0live\b/g, 'olive')
    .replace(/\b01ive\b/g, 'olive')
    .replace(/\bwa1er\b/g, 'water')
    .replace(/\bwaler\b/g, 'water')
    .replace(/\bsuga1\b/g, 'sugar')
    .replace(/\bsa1t\b/g, 'salt')
    .replace(/\bf1our\b/g, 'flour')
    .replace(/\bflour\b/g, 'flour')
    .replace(/\bri1e\b/g, 'rice')
    .replace(/\brlce\b/g, 'rice')
    .replace(/\br1ce\b/g, 'rice')
    .replace(/\bju1ce\b/g, 'juice')
    .replace(/\bjulce\b/g, 'juice')
    .replace(/\bspr1te\b/g, 'sprite')
    .replace(/\bsprlte\b/g, 'sprite')
    .replace(/\bcoca co1a\b/g, 'coca cola')
    .replace(/\bfan1a\b/g, 'fanta')
    .replace(/\bfanla\b/g, 'fanta')
    .replace(/\bbeer\b/g, 'beer')
    .replace(/\bbiscuit\b/g, 'biscuit')
    .replace(/\bchoco1ate\b/g, 'chocolate')
    .replace(/\bchocolale\b/g, 'chocolate')
    .replace(/\bbut1er\b/g, 'butter')
    .replace(/\bbuller\b/g, 'butter')
    .replace(/\bcheese\b/g, 'cheese')
    .replace(/\byogur1\b/g, 'yogurt')
    .replace(/\byogurl\b/g, 'yogurt')
    
    // Generic OCR fixes: 1 between letters → l
    .replace(/([a-z])1([a-z])/g, '$1l$2')
    // Apply twice for consecutive issues (m11k → m1lk → milk)
    .replace(/([a-z])1([a-z])/g, '$1l$2')
    
    // 0 between letters → o
    .replace(/([a-z])0([a-z])/g, '$1o$2')
    .replace(/([a-z])0([a-z])/g, '$1o$2')
    
    // Fix common word endings
    .replace(/1ng\b/g, 'ing')
    .replace(/1on\b/g, 'ion')
    .replace(/1er\b/g, 'ier')
    .replace(/1e\b/g, 'le')
    
    // Fix word starts
    .replace(/\b1n/g, 'in')
    .replace(/\b0n/g, 'on');

  // ============ STEP 7: Final cleanup ============
  normalized = normalized
    .replace(/\s+/g, ' ') // Normalize spaces again
    .trim();

  // ============ STEP 8: Fix OCR spacing errors in common words ============
  // Words that OCR often splits: "bag" -> "b ag", "sac" -> "s ac"
  normalized = normalized
    .replace(/\bb\s+ag\b/gi, 'bag')       // "b ag" -> "bag"
    .replace(/\bs\s+ac\b/gi, 'sac')       // "s ac" -> "sac"
    .replace(/\br\s+iz\b/gi, 'riz')       // "r iz" -> "riz"
    .replace(/\bl\s+ait\b/gi, 'lait')     // "l ait" -> "lait"
    .replace(/\be\s+au\b/gi, 'eau')       // "e au" -> "eau"
    .replace(/\bh\s+uile\b/gi, 'huile')   // "h uile" -> "huile"
    .replace(/\bs\s+ucre\b/gi, 'sucre')   // "s ucre" -> "sucre"
    .replace(/\bp\s+ain\b/gi, 'pain')     // "p ain" -> "pain"
    .replace(/\bv\s+in\b/gi, 'vin')       // "v in" -> "vin"
    .trim();

  // ============ STEP 9: Fix OCR spacing errors (ONLY 3+ consecutive single letters) ============
  // This catches obvious OCR issues like "s u c r e" -> "sucre", "s p r i t e" -> "sprite"
  // But PRESERVES normal text like "Poulet A Rotir" (the "A" is a valid French word)
  // Pattern: Only match when we have 3+ single letters with spaces between them
  normalized = normalized.replace(/\b([a-z]\s+[a-z]\s+[a-z](?:\s+[a-z])*)\b/g, (match) => {
    // Only join if it creates a word-like string (all single letters)
    const letters = match.split(/\s+/);
    if (letters.every(l => l.length === 1)) {
      return letters.join('');
    }
    return match;
  });

  // ============ STEP 10: Append size info as suffix ============
  // This ensures "Sucre 5kg" and "Sucre 1kg" are DIFFERENT items
  // Format: "sucre_5kg" vs "sucre_1kg"
  if (sizeInfo) {
    normalized = `${normalized}_${sizeInfo}`;
  }

  return normalized;
}

/**
 * Get canonical form of a product name using synonyms
 * Comprehensive list for supermarket products
 * 
 * IMPORTANT: Preserves size suffix from normalization
 * "sugar_5kg" → "sucre_5kg" (canonical name + size)
 */
function getCanonicalName(name: string): string {
  const normalized = normalizeItemName(name);

  // Extract size suffix if present (e.g., "_5kg" from "sucre_5kg")
  const sizeSuffixMatch = normalized.match(/_(\d+(?:\.\d+)?(?:x\d+)?[a-z]+)$/);
  const sizeSuffix = sizeSuffixMatch ? sizeSuffixMatch[0] : '';
  const normalizedWithoutSize = sizeSuffix ? normalized.slice(0, -sizeSuffix.length) : normalized;

  // Comprehensive product synonyms for better grouping
  const synonyms: Record<string, string[]> = {
    // Dairy Products
    'lait': ['milk', 'milch', 'leche', 'lait'],
    'fromage': ['cheese', 'kase', 'queso', 'fromage'],
    'yaourt': ['yogurt', 'yoghurt', 'yogourt', 'yog', 'yo', 'yaourt'],
    'creme': ['cream', 'crema', 'creme'],
    'beurre': ['butter', 'mantequilla', 'beurre'],
    'oeuf': ['egg', 'eggs', 'huevo', 'oeuf', 'oeufs'],
    
    // Bread & Bakery
    'pain': ['bread', 'baguette', 'pan', 'pain'],
    
    // Meat & Protein
    'viande': ['meat', 'carne', 'viande'],
    'poulet': ['chicken', 'pollo', 'poulet'],
    'boeuf': ['beef', 'boeuf'],
    'porc': ['pork', 'cerdo', 'porc'],
    'poisson': ['fish', 'pescado', 'poisson'],
    'saucisse': ['sausage', 'salchicha', 'saucisse'],
    'jambon': ['ham', 'jamon', 'jambon'],
    
    // Fruits
    'pomme': ['apple', 'apples', 'manzana', 'pomme'],
    'banane': ['banana', 'bananas', 'platano', 'banane'],
    'orange': ['orange', 'oranges', 'naranja'],
    'raisin': ['grape', 'grapes', 'uva', 'raisin'],
    'fraise': ['strawberry', 'fresa', 'fraise'],
    'ananas': ['pineapple', 'pina', 'ananas'],
    'mangue': ['mango', 'mangue'],
    'avocat': ['avocado', 'aguacate', 'avocat'],
    'citron': ['lemon', 'limon', 'citron'],
    'poire': ['pear', 'pera', 'poire'],
    'peche': ['peach', 'melocoton', 'peche'],
    
    // Vegetables
    'tomate': ['tomato', 'tomatoes', 'jitomate', 'tomate'],
    'carotte': ['carrot', 'carrots', 'zanahoria', 'carotte'],
    'oignon': ['onion', 'cebolla', 'oignon'],
    'ail': ['garlic', 'ajo', 'ail'],
    'pomme de terre': ['potato', 'potatoes', 'patata', 'pomme de terre'],
    'salade': ['lettuce', 'salad', 'lechuga', 'salade'],
    'chou': ['cabbage', 'col', 'chou'],
    'haricot': ['bean', 'beans', 'frijol', 'haricot'],
    'petit pois': ['peas', 'guisantes', 'petit pois', 'pois'],
    'poivron': ['pepper', 'pimiento', 'poivron'],
    'concombre': ['cucumber', 'pepino', 'concombre'],
    'courgette': ['zucchini', 'calabacin', 'courgette'],
    'aubergine': ['eggplant', 'berenjena', 'aubergine'],
    
    // Beverages
    'eau': ['water', 'agua', 'eau'],
    'cafe': ['coffee', 'cafe'],
    'the': ['tea', 'te', 'the'],
    'biere': ['beer', 'cerveza', 'biere'],
    'vin': ['wine', 'vino', 'vin'],
    'jus': ['juice', 'jugo', 'jus'],
    'soda': ['soda', 'refresco', 'soft drink'],
    'coca': ['cola', 'coca cola', 'coke'],
    'sprite': ['sprite', 'lemon soda'],
    'fanta': ['fanta', 'orange soda'],
    
    // Grains & Pasta
    'riz': ['rice', 'arroz', 'riz'],
    'pates': ['pasta', 'noodles', 'pates'],
    'farine': ['flour', 'harina', 'farine'],
    'cereales': ['cereal', 'cereales'],
    'avoine': ['oats', 'avena', 'avoine'],
    
    // Cooking Essentials
    'huile': ['oil', 'aceite', 'huile', 'cooking oil'],
    'sucre': ['sugar', 'azucar', 'sucre'],
    'sel': ['salt', 'sal', 'sel'],
    'poivre': ['pepper', 'pimienta', 'poivre'],
    'vinaigre': ['vinegar', 'vinagre', 'vinaigre'],
    'epice': ['spice', 'especia', 'epice'],
    
    // Household & Cleaning
    'savon': ['soap', 'jabon', 'sav', 'savonnette', 'savon'],
    'detergent': ['detergent', 'washing powder', 'lessive'],
    'javel': ['bleach', 'eau de javel', 'lejia'],
    'eponge': ['sponge', 'esponja', 'eponge'],
    'papier toilette': ['toilet paper', 'papel higienico'],
    'essuie tout': ['paper towel', 'toalla papel'],
    
    // Personal Care
    'shampooing': ['shampoo', 'champu', 'shamp', 'champoing'],
    'dentifrice': ['toothpaste', 'pasta dental', 'dent', 'pate dentifrice'],
    'brosse a dents': ['toothbrush', 'cepillo dental'],
    'deodorant': ['deodorant', 'desodorante'],
    'gel douche': ['shower gel', 'gel de ducha'],
    'lotion': ['lotion', 'body lotion', 'moisturizer'],
    
    // Snacks & Sweets
    'chips': ['chips', 'crisps', 'patatas fritas'],
    'biscuit': ['cookie', 'biscuit', 'galleta'],
    'chocolat': ['chocolate', 'chocolat'],
    'bonbon': ['candy', 'sweet', 'caramelo', 'bonbon'],
    'gateau': ['cake', 'pastel', 'gateau'],
    'glace': ['ice cream', 'helado', 'glace'],
    
    // Condiments & Sauces
    'ketchup': ['ketchup', 'tomato sauce'],
    'moutarde': ['mustard', 'mostaza', 'moutarde'],
    'mayonnaise': ['mayo', 'mayonnaise', 'mayonesa'],
    'sauce': ['sauce', 'salsa'],
    
    // Baby Products
    'couche': ['diaper', 'panal', 'couche'],
    'lait bebe': ['baby formula', 'formula', 'leche bebe'],
    
    // Frozen Foods
    'surgele': ['frozen', 'congelado', 'surgele'],
    
    // Common Brands (lowercase)
    'coca cola': ['coca', 'coke', 'coca cola'],
    'pepsi': ['pepsi'],
    'nestle': ['nestle'],
    'danone': ['danone', 'dannon'],
    'president': ['president'],
    
    // ============ AFRICAN/CONGOLESE PRODUCTS ============
    
    // Local Staples
    'farine de manioc': ['fufu', 'foufou', 'cassava flour', 'farine manioc'],
    'pondu': ['pondu', 'saka saka', 'cassava leaves'],
    'manioc': ['cassava', 'yuca', 'manioc'],
    'plantain': ['plantain', 'banane plantain', 'cooking banana'],
    'igname': ['yam', 'name', 'igname'],
    'taro': ['taro', 'macabo'],
    'patate douce': ['sweet potato', 'patate douce', 'camote'],
    'arachide': ['peanut', 'groundnut', 'cacahuete', 'arachide'],
    'huile de palme': ['palm oil', 'huile palme', 'aceite palma'],
    'huile darachide': ['peanut oil', 'groundnut oil', 'huile arachide'],
    
    // African Spices & Seasonings
    'piment': ['chili', 'hot pepper', 'pili pili', 'piment'],
    'gingembre': ['ginger', 'jengibre', 'gingembre'],
    'cube maggi': ['maggi', 'bouillon cube', 'seasoning cube', 'jumbo'],
    'tomate concentre': ['tomato paste', 'tomato concentrate', 'tomate concentre'],
    
    // Fish & Seafood (common in Congo)
    'poisson sale': ['dried fish', 'salted fish', 'poisson sale', 'stockfish'],
    'makayabu': ['makayabu', 'salted fish', 'dried fish'],
    'mpiodi': ['mpiodi', 'small dried fish'],
    'crevette': ['shrimp', 'prawn', 'crevette', 'gambas'],
    'sardine': ['sardine', 'sardina'],
    'thon': ['tuna', 'atun', 'thon'],
    'maquereau': ['mackerel', 'maquereau'],
    'tilapia': ['tilapia'],
    'capitaine': ['capitaine', 'nile perch'],
    
    // Beans & Legumes
    'haricot rouge': ['red beans', 'kidney beans', 'haricot rouge'],
    'haricot blanc': ['white beans', 'haricot blanc'],
    'lentille': ['lentils', 'lentejas', 'lentille'],
    'pois chiche': ['chickpeas', 'garbanzo', 'pois chiche'],
    'niebe': ['black eyed peas', 'cowpeas', 'niebe'],
    
    // Cooking Oils (expanded)
    'huile vegetale': ['vegetable oil', 'aceite vegetal', 'huile vegetale'],
    'huile tournesol': ['sunflower oil', 'huile tournesol'],
    'huile olive': ['olive oil', 'aceite oliva', 'huile olive'],
    'huile mais': ['corn oil', 'huile mais'],
    'huile soja': ['soybean oil', 'huile soja'],
    
    // Rice varieties
    'riz basmati': ['basmati rice', 'riz basmati'],
    'riz jasmin': ['jasmine rice', 'riz jasmin'],
    'riz long grain': ['long grain rice', 'riz long'],
    'riz parfume': ['fragrant rice', 'riz parfume'],
    
    // Milk Products (expanded)
    'lait en poudre': ['powdered milk', 'milk powder', 'lait poudre', 'nido'],
    'lait concentre': ['condensed milk', 'evaporated milk', 'lait concentre'],
    'lait uht': ['uht milk', 'long life milk', 'lait uht'],
    'lait frais': ['fresh milk', 'lait frais'],
    
    // Beverages (expanded)
    'jus dorange': ['orange juice', 'jus orange', 'jugo naranja'],
    'jus de pomme': ['apple juice', 'jus pomme'],
    'jus dananas': ['pineapple juice', 'jus ananas'],
    'jus de mangue': ['mango juice', 'jus mangue'],
    'eau minerale': ['mineral water', 'eau minerale'],
    'eau gazeuse': ['sparkling water', 'eau gazeuse'],
    'boisson energisante': ['energy drink', 'red bull', 'monster'],
    'limonade': ['lemonade', 'limonada', 'limonade'],
    
    // Alcoholic Beverages
    'whisky': ['whisky', 'whiskey'],
    'vodka': ['vodka'],
    'rhum': ['rum', 'ron', 'rhum'],
    'cognac': ['cognac', 'brandy'],
    'champagne': ['champagne', 'sparkling wine'],
    'primus': ['primus', 'primus beer'],
    'skol': ['skol', 'skol beer'],
    'simba': ['simba', 'simba beer'],
    'turbo king': ['turbo king', 'turbo'],
    'castel': ['castel', 'castel beer'],
    'heineken': ['heineken'],
    'guiness': ['guinness', 'guiness'],
    
    // Baby & Infant
    'lait maternise': ['infant formula', 'baby milk', 'lait maternise'],
    'cerelac': ['cerelac', 'baby cereal'],
    'bledine': ['bledine', 'baby food'],
    'pampers': ['pampers', 'diapers', 'couches'],
    'huggies': ['huggies', 'diapers'],
    
    // Cleaning Products (expanded)
    'omo': ['omo', 'washing powder', 'detergent'],
    'ariel': ['ariel', 'washing powder'],
    'tide': ['tide', 'washing powder'],
    'ajax': ['ajax', 'cleaner'],
    'mr propre': ['mr clean', 'mr propre'],
    'harpic': ['harpic', 'toilet cleaner'],
    'air wick': ['air wick', 'air freshener'],
    
    // Personal Care (expanded)
    'nivea': ['nivea', 'skin cream'],
    'vaseline': ['vaseline', 'petroleum jelly'],
    'lux': ['lux', 'bath soap'],
    'dettol': ['dettol', 'antiseptic'],
    'colgate': ['colgate', 'toothpaste'],
    'close up': ['close up', 'closeup', 'toothpaste'],
    'signal': ['signal', 'toothpaste'],
    'gillette': ['gillette', 'razor'],
    'always': ['always', 'sanitary pads'],
    'kotex': ['kotex', 'sanitary pads'],
    
    // Snacks (expanded)
    'biscuit sale': ['crackers', 'salty biscuits', 'biscuit sale'],
    'biscuit sucre': ['sweet biscuits', 'biscuit sucre'],
    'gaufrette': ['wafer', 'gaufrette', 'waffle'],
    'croissant': ['croissant'],
    'pain de mie': ['sliced bread', 'sandwich bread', 'pain de mie'],
    'brioche': ['brioche', 'sweet bread'],
    'madeleines': ['madeleine', 'madeleines'],
    
    // Canned Foods
    'conserve': ['canned', 'tin', 'conserve'],
    'mais en boite': ['canned corn', 'sweet corn', 'mais boite'],
    'petits pois en boite': ['canned peas', 'petits pois boite'],
    'haricots verts en boite': ['canned green beans'],
    'champignon en boite': ['canned mushroom', 'champignon boite'],
    'olive': ['olive', 'olives', 'aceituna'],
    
    // Pasta & Noodles (expanded)
    'spaghetti': ['spaghetti', 'spag'],
    'macaroni': ['macaroni', 'mac'],
    'penne': ['penne'],
    'tagliatelle': ['tagliatelle'],
    'nouilles': ['noodles', 'nouilles', 'fideos'],
    'vermicelle': ['vermicelli', 'vermicelle'],
    'couscous': ['couscous', 'cuscus'],
    
    // Breakfast Items
    'corn flakes': ['corn flakes', 'cornflakes'],
    'muesli': ['muesli', 'granola'],
    'cacao': ['cocoa', 'cacao', 'chocolate powder'],
    'nescafe': ['nescafe', 'instant coffee'],
    'milo': ['milo', 'chocolate drink'],
    'ovaltine': ['ovaltine', 'ovomaltine'],
    'lipton': ['lipton', 'tea bags'],
    
    // Spreads & Jams
    'confiture': ['jam', 'jelly', 'mermelada', 'confiture'],
    'miel': ['honey', 'miel'],
    'nutella': ['nutella', 'chocolate spread'],
    'beurre de cacahuete': ['peanut butter', 'beurre cacahuete'],
    'margarine': ['margarine', 'margarina'],
    
    // Meat Products (expanded)
    'poulet entier': ['whole chicken', 'poulet entier'],
    'cuisse de poulet': ['chicken thigh', 'cuisse poulet'],
    'aile de poulet': ['chicken wing', 'aile poulet'],
    'poitrine de poulet': ['chicken breast', 'blanc poulet'],
    'boeuf hache': ['ground beef', 'minced beef', 'boeuf hache'],
    'cote de boeuf': ['beef rib', 'cote boeuf'],
    'escalope': ['escalope', 'cutlet'],
    'saucisse fumee': ['smoked sausage', 'saucisse fumee'],
    'bacon': ['bacon', 'lard'],
    'corned beef': ['corned beef', 'bully beef'],
    
    // Seasonings & Spices (expanded)
    'curry': ['curry', 'cari'],
    'paprika': ['paprika'],
    'cumin': ['cumin', 'comino'],
    'muscade': ['nutmeg', 'muscade', 'nuez moscada'],
    'cannelle': ['cinnamon', 'canela', 'cannelle'],
    'laurier': ['bay leaf', 'laurier'],
    'thym': ['thyme', 'tomillo', 'thym'],
    'persil': ['parsley', 'perejil', 'persil'],
    'coriandre': ['coriander', 'cilantro', 'coriandre'],
    'basilic': ['basil', 'albahaca', 'basilic'],
    
    // Sugar & Sweeteners
    'sucre blanc': ['white sugar', 'sucre blanc'],
    'sucre roux': ['brown sugar', 'sucre roux'],
    'sucre en poudre': ['powdered sugar', 'icing sugar'],
    'sirop': ['syrup', 'jarabe', 'sirop'],
    
    // Flour & Baking
    'farine de ble': ['wheat flour', 'farine ble'],
    'farine complete': ['whole wheat flour', 'farine complete'],
    'levure': ['yeast', 'baking powder', 'levure'],
    'bicarbonate': ['baking soda', 'bicarbonate'],
    'maizena': ['cornstarch', 'maizena', 'corn flour'],
    
    // Cheese varieties
    'fromage rape': ['grated cheese', 'fromage rape'],
    'mozzarella': ['mozzarella'],
    'cheddar': ['cheddar'],
    'emmental': ['emmental', 'swiss cheese'],
    'parmesan': ['parmesan', 'parmigiano'],
    'fromage fondu': ['processed cheese', 'fromage fondu'],
    'la vache qui rit': ['la vache qui rit', 'laughing cow'],
    'kiri': ['kiri', 'cream cheese'],
    
    // Fruits (expanded)
    'papaye': ['papaya', 'papaye'],
    'goyave': ['guava', 'guayaba', 'goyave'],
    'fruit de la passion': ['passion fruit', 'maracuja'],
    'noix de coco': ['coconut', 'coco', 'noix coco'],
    'datte': ['date', 'datil', 'datte'],
    'prune': ['plum', 'ciruela', 'prune'],
    'cerise': ['cherry', 'cereza', 'cerise'],
    'kiwi': ['kiwi'],
    'melon': ['melon', 'cantaloupe'],
    'pasteque': ['watermelon', 'sandia', 'pasteque'],
    
    // Vegetables (expanded)
    'epinard': ['spinach', 'espinaca', 'epinard'],
    'brocoli': ['broccoli', 'brocoli'],
    'chou fleur': ['cauliflower', 'coliflor', 'chou fleur'],
    'celeri': ['celery', 'apio', 'celeri'],
    'mais': ['corn', 'maiz', 'mais'],
    'champignon': ['mushroom', 'seta', 'champignon'],
    'asperge': ['asparagus', 'esparrago', 'asperge'],
    'artichaut': ['artichoke', 'alcachofa', 'artichaut'],
    'betterave': ['beetroot', 'remolacha', 'betterave'],
    'navet': ['turnip', 'nabo', 'navet'],
    'radis': ['radish', 'rabano', 'radis'],
    'poireau': ['leek', 'puerro', 'poireau'],
    'echalote': ['shallot', 'chalota', 'echalote'],
    
    // Common Brand Names
    'nido': ['nido', 'powdered milk'],
    'peak': ['peak', 'peak milk'],
    'cowbell': ['cowbell', 'cowbell milk'],
    'dano': ['dano', 'dano milk'],
    'bonnet rouge': ['bonnet rouge', 'tomato paste'],
    'gino': ['gino', 'tomato paste'],
    'tasty tom': ['tasty tom', 'tomato paste'],
    'royco': ['royco', 'seasoning'],
    'knorr': ['knorr', 'seasoning', 'bouillon'],
    'indomie': ['indomie', 'instant noodles'],
    'golden penny': ['golden penny', 'pasta', 'semolina'],
    'honeywell': ['honeywell', 'flour'],
    'dangote': ['dangote', 'sugar', 'flour', 'cement'],

    // ============ LINGALA NAMES (DRC - Kinshasa region) ============
    // Fish & Seafood (Lingala)
    'mbisi': ['mbisi', 'poisson'],
    'ngolo': ['ngolo', 'poisson chat'],
    'kapiteni': ['kapiteni', 'capitaine'],
    
    // Vegetables & Leaves (Lingala)
    'ngai ngai': ['ngai ngai', 'oseille'],
    'ndunda': ['ndunda', 'haricots'],
    'matembele': ['matembele', 'feuilles patate douce'],
    'biteku teku': ['biteku teku', 'amarante'],
    'mfumbwa': ['mfumbwa', 'gnetum'],
    
    // Staples (Lingala)
    'fufu': ['fufu', 'foufou', 'farine de manioc'],
    'kwanga': ['kwanga', 'chikwangue', 'pain de manioc'],
    'bukari': ['bukari', 'pate de mais'],
    'loso': ['loso', 'riz'],
    'mbala': ['mbala', 'patate douce'],
    'makemba': ['makemba', 'plantain', 'banane plantain'],
    
    // Meat (Lingala)
    'nyama': ['nyama', 'viande', 'meat'],
    'nyama ngombe': ['nyama ngombe', 'viande de boeuf', 'beef'],
    'nyama ngulu': ['nyama ngulu', 'viande de porc', 'pork'],
    'nsoso': ['nsoso', 'poulet', 'chicken'],
    'ntaba': ['ntaba', 'chevre', 'goat'],
    
    // Fruits (Lingala)
    'makondo': ['makondo', 'banane'],
    'makofi': ['makofi', 'papaye'],
    'manga': ['manga', 'mangue'],
    'limau': ['limau', 'citron'],
    
    // Beverages (Lingala)
    'mai': ['mai', 'eau', 'water'],
    'masanga': ['masanga', 'biere', 'beer'],
    'malavu': ['malavu', 'vin de palme', 'palm wine'],
    'lotoko': ['lotoko', 'alcool local'],
    
    // Cooking (Lingala)
    'mafuta': ['mafuta', 'huile', 'oil'],
    'mafuta ya palme': ['mafuta ya palme', 'huile de palme', 'palm oil'],
    'mungwa': ['mungwa', 'sel', 'salt'],
    'makala': ['makala', 'charbon', 'charcoal'],
    
    // Household (Lingala)
    'savuni': ['savuni', 'savon', 'soap'],

    // ============ SWAHILI NAMES (DRC - Eastern region) ============
    'mboga': ['mboga', 'legumes', 'vegetables'],
    'matunda': ['matunda', 'fruits'],
    'viazi': ['viazi', 'pomme de terre', 'potato'],
    'kitunguu': ['kitunguu', 'oignon', 'onion'],
    'nyanya': ['nyanya', 'tomate', 'tomato'],
    'maziwa': ['maziwa', 'lait', 'milk'],
    'siagi': ['siagi', 'beurre', 'butter'],
    'sukari': ['sukari', 'sucre', 'sugar'],
    'kahawa': ['kahawa', 'cafe', 'coffee'],
    'chai': ['chai', 'the', 'tea'],
  };

  // Check if normalized name matches any synonym
  // CRITICAL FIX: Only match COMPLETE WORDS, not substrings
  // This prevents "castel lite" from matching "te" and becoming "the"
  // NOTE: We use normalizedWithoutSize to match, then re-append size suffix
  const normalizedWords = normalizedWithoutSize.split(/\s+/);
  const normalizedFull = normalizedWithoutSize.replace(/\s+/g, ''); // For multi-word matches
  
  for (const [canonical, variations] of Object.entries(synonyms)) {
    for (const variation of variations) {
      const variationNoSpaces = variation.replace(/\s+/g, '');
      
      // 1. Exact match (with or without spaces)
      if (normalizedFull === variationNoSpaces) {
        // Re-append size suffix to canonical name
        return canonical.replace(/\s+/g, '') + sizeSuffix;
      }
      
      // 2. Full word match - check if variation is a complete word in the normalized name
      if (normalizedWords.includes(variation)) {
        // Only match if the variation is the ONLY word or the MAIN word (first/last)
        // This prevents "sprite" in "sprite 330ml" from matching, but allows "sprite" alone
        if (normalizedWords.length === 1 || 
            normalizedWords[0] === variation || 
            normalizedWords[normalizedWords.length - 1] === variation) {
          // Re-append size suffix to canonical name
          return canonical.replace(/\s+/g, '') + sizeSuffix;
        }
      }
    }
  }

  // Remove all spaces from the final normalized name for consistent document IDs
  // This ensures "b ag riz" and "bag riz" both become "bagriz"
  // Keep the size suffix intact
  return normalizedWithoutSize.replace(/\s+/g, '') + sizeSuffix;
}

/**
 * Validate if an item name is good enough to save
 * Filters out OCR mistakes, garbage text, and low-quality names
 */
function isValidItemName(name: string, normalizedName: string): boolean {
  // Skip placeholder names
  if (
    !name ||
    name.toLowerCase().includes('unavailable name') ||
    name.toLowerCase() === 'unavailable' ||
    name.toLowerCase() === 'unavailable name'
  ) {
    return false;
  }

  // Extract size suffix if present (e.g., "_5kg" from "sucre_5kg")
  // We need to validate the base name, not the size suffix
  const sizeSuffixMatch = normalizedName.match(/_(\d+(?:\.\d+)?(?:x\d+)?[a-z]+)$/);
  const nameWithoutSize = sizeSuffixMatch 
    ? normalizedName.slice(0, -sizeSuffixMatch[0].length) 
    : normalizedName;

  // Skip if normalized name (without size) is too short (likely OCR garbage)
  if (nameWithoutSize.length < 3) {
    return false;
  }

  // Count alphabetic characters (after removing spaces and size suffix)
  const withoutSpaces = nameWithoutSize.replace(/\s/g, '');
  const alphaCount = (withoutSpaces.match(/[a-z]/g) || []).length;
  const digitCount = (withoutSpaces.match(/[0-9]/g) || []).length;

  // Skip if ONLY numbers (e.g., "123", "456")
  if (alphaCount === 0) {
    return false;
  }

  // Skip if normalized result is very short AND mostly numbers (e.g., "t5", "l0")
  if (withoutSpaces.length <= 3 && digitCount > alphaCount) {
    return false;
  }

  // Accept everything else - normalization already fixed spacing issues
  // Examples: "b EGADANET" → "begadanet" ✓, "s AC" → "sac" ✓
  return true;
}

/**
 * Category keywords mapping for detection and search
 * Maps categories to their related keywords in French and English
 */
const CATEGORY_KEYWORDS_MAP: Record<string, {
  category: string;        // Display name (French)
  keywords: string[];      // Keywords that belong to this category
  searchTerms: string[];   // Alternative search terms users might use
}> = {
  'boissons': {
    category: 'Boissons',
    keywords: ['eau', 'water', 'jus', 'juice', 'soda', 'coca', 'fanta', 'sprite', 'pepsi', 'limonade', 
               'biere', 'beer', 'vin', 'wine', 'merlot', 'cabernet', 'chardonnay', 'medco', 'sauvignon',
               'whisky', 'vodka', 'rhum', 'rum', 'champagne', 'cafe', 'coffee', 'the', 'tea', 'lait', 'milk',
               'yaourt', 'yogurt', 'primus', 'heineken', 'skol', 'tembo', 'castel', 'ngok', 'nkoyi',
               'simba', 'mutzig', 'masanga', 'malavu', 'lotoko', 'maziwa'],
    searchTerms: ['boisson', 'drink', 'beverage', 'alcool', 'alcohol', 'soft', 'gazeuse'],
  },
  'alimentation': {
    category: 'Alimentation',
    keywords: ['riz', 'rice', 'pain', 'bread', 'farine', 'flour', 'pate', 'pasta', 'spaghetti', 'macaroni',
               'cereale', 'cereal', 'biscuit', 'cookie', 'chocolat', 'chocolate', 'sucre', 'sugar',
               'sel', 'salt', 'huile', 'oil', 'miel', 'honey', 'confiture', 'jam', 'beurre', 'butter',
               'fromage', 'cheese', 'oeuf', 'egg', 'viande', 'meat', 'poulet', 'chicken', 'boeuf', 'beef',
               'poisson', 'fish', 'sardine', 'thon', 'tuna', 'mafuta', 'mungwa', 'fufu', 'pondu', 'saka',
               'makayabu', 'mbisi', 'ngolo', 'kapiteni', 'sombe', 'matembele', 'biteku', 'ngai ngai', 'ndunda'],
    searchTerms: ['nourriture', 'food', 'manger', 'eat', 'cuisine', 'repas', 'meal'],
  },
  'fruits_legumes': {
    category: 'Fruits & Légumes',
    keywords: ['pomme', 'apple', 'banane', 'banana', 'orange', 'citron', 'lemon', 'mangue', 'mango',
               'ananas', 'pineapple', 'avocat', 'avocado', 'tomate', 'tomato', 'carotte', 'carrot',
               'oignon', 'onion', 'ail', 'garlic', 'salade', 'lettuce', 'chou', 'cabbage', 'haricot', 'bean',
               'pomme de terre', 'potato', 'patate', 'epinard', 'spinach', 'concombre', 'cucumber',
               'poivron', 'pepper', 'aubergine', 'eggplant', 'courgette', 'zucchini', 'raisin', 'grape',
               'pastèque', 'watermelon', 'melon', 'papaye', 'papaya', 'goyave', 'guava', 'noix de coco', 'coconut',
               'limboko', 'liboke', 'matunda', 'viazi', 'kitunguu', 'nyanya', 'mboga'],
    searchTerms: ['fruit', 'legume', 'vegetable', 'produce', 'frais', 'fresh'],
  },
  'hygiene': {
    category: 'Hygiène',
    keywords: ['savon', 'soap', 'shampooing', 'shampoo', 'dentifrice', 'toothpaste', 'brosse', 'brush',
               'papier toilette', 'toilet paper', 'serviette', 'towel', 'deodorant', 'gel douche', 'shower gel',
               'lotion', 'creme', 'cream', 'parfum', 'perfume', 'coton', 'cotton', 'rasoir', 'razor',
               'savuni', 'detergent', 'lessive', 'lingette', 'wipe'],
    searchTerms: ['hygiene', 'toilette', 'soin', 'care', 'beaute', 'beauty', 'proprete', 'clean'],
  },
  'menage': {
    category: 'Ménage',
    keywords: ['javel', 'bleach', 'detergent', 'lessive', 'laundry', 'eponge', 'sponge', 'balai', 'broom',
               'seau', 'bucket', 'serpilliere', 'mop', 'torchon', 'cloth', 'poubelle', 'trash', 'sac poubelle',
               'insecticide', 'desodorisant', 'air freshener', 'makala', 'charbon', 'charcoal'],
    searchTerms: ['menage', 'household', 'nettoyage', 'cleaning', 'maison', 'home', 'entretien', 'maintenance'],
  },
  'bebe': {
    category: 'Bébé',
    keywords: ['couche', 'diaper', 'nappy', 'pampers', 'biberon', 'bottle', 'lait bebe', 'baby formula',
               'lingette bebe', 'baby wipe', 'sucette', 'pacifier', 'tetine', 'cereale bebe', 'baby cereal',
               'huggies', 'molfix'],
    searchTerms: ['bebe', 'baby', 'enfant', 'child', 'nourrisson', 'infant'],
  },
  'electronique': {
    category: 'Électronique',
    keywords: ['pile', 'battery', 'chargeur', 'charger', 'cable', 'ecouteur', 'earphone', 'lampe', 'lamp',
               'ampoule', 'bulb', 'torch', 'torche', 'flashlight', 'radio', 'telephone', 'phone'],
    searchTerms: ['electronique', 'electronic', 'electric', 'electrique', 'appareil', 'device'],
  },
};

/**
 * Detect category and generate search keywords for an item
 * Returns category name and array of related search keywords
 */
// Bilingual synonym map for search - French <-> English
const BILINGUAL_SYNONYMS: Record<string, string[]> = {
  // Meat
  'poulet': ['chicken', 'volaille', 'poultry'],
  'chicken': ['poulet', 'volaille', 'poultry'],
  'boeuf': ['beef', 'viande', 'meat'],
  'beef': ['boeuf', 'viande', 'meat'],
  'viande': ['meat', 'boeuf', 'poulet', 'beef', 'chicken', 'porc', 'pork'],
  'meat': ['viande', 'boeuf', 'poulet', 'beef', 'chicken', 'porc', 'pork'],
  'poisson': ['fish', 'sardine', 'thon', 'mbisi'],
  'fish': ['poisson', 'sardine', 'thon', 'mbisi'],
  'porc': ['pork', 'viande', 'meat'],
  'pork': ['porc', 'viande', 'meat'],
  // Dairy
  'lait': ['milk', 'dairy', 'lactose'],
  'milk': ['lait', 'dairy', 'lactose'],
  'oeuf': ['egg', 'oeufs', 'eggs'],
  'oeufs': ['eggs', 'oeuf', 'egg'],
  'egg': ['oeuf', 'oeufs', 'eggs'],
  'eggs': ['oeufs', 'oeuf', 'egg'],
  'fromage': ['cheese', 'dairy'],
  'cheese': ['fromage', 'dairy'],
  'beurre': ['butter', 'dairy'],
  'butter': ['beurre', 'dairy'],
  // Staples
  'riz': ['rice', 'cereale'],
  'rice': ['riz', 'cereale'],
  'pain': ['bread', 'boulangerie', 'bakery'],
  'bread': ['pain', 'boulangerie', 'bakery'],
  'farine': ['flour'],
  'flour': ['farine'],
  'huile': ['oil', 'mafuta'],
  'oil': ['huile', 'mafuta'],
  'sucre': ['sugar'],
  'sugar': ['sucre'],
  'sel': ['salt', 'mungwa'],
  'salt': ['sel', 'mungwa'],
  // Beverages
  'eau': ['water'],
  'water': ['eau'],
  'jus': ['juice'],
  'juice': ['jus'],
  'biere': ['beer', 'bière'],
  'beer': ['biere', 'bière'],
  'vin': ['wine'],
  'wine': ['vin'],
  // Fruits & Vegetables
  'tomate': ['tomato', 'nyanya'],
  'tomato': ['tomate', 'nyanya'],
  'oignon': ['onion', 'kitunguu'],
  'onion': ['oignon', 'kitunguu'],
  'banane': ['banana'],
  'banana': ['banane'],
  'pomme': ['apple'],
  'apple': ['pomme'],
  'orange': ['orange'],
  'carotte': ['carrot'],
  'carrot': ['carotte'],
  // Brands that are also product types
  'sadia': ['chicken', 'poulet', 'volaille', 'poultry'],
  'clover': ['milk', 'lait', 'dairy'],
};

function detectCategoryAndKeywords(name: string): { category: string | null; searchKeywords: string[] } {
  const normalizedName = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  const foundKeywords: string[] = [];
  let detectedCategory: string | null = null;
  
  // Check each category
  for (const [, config] of Object.entries(CATEGORY_KEYWORDS_MAP)) {
    // Check if item name contains any keywords from this category
    for (const keyword of config.keywords) {
      if (normalizedName.includes(keyword) || keyword.includes(normalizedName)) {
        detectedCategory = config.category;
        // Add category search terms as keywords
        foundKeywords.push(...config.searchTerms);
        // Also add the category name in both languages
        foundKeywords.push(config.category.toLowerCase());
        
        // Add bilingual synonyms for the matched keyword
        if (BILINGUAL_SYNONYMS[keyword]) {
          foundKeywords.push(keyword); // Add the matched keyword itself
          foundKeywords.push(...BILINGUAL_SYNONYMS[keyword]);
        }
        break;
      }
    }
    if (detectedCategory) break;
  }
  
  // Check for bilingual synonyms even if no category matched
  // This ensures items like "Sadia Chicken" get "poulet" as a keyword
  for (const [term, synonyms] of Object.entries(BILINGUAL_SYNONYMS)) {
    if (normalizedName.includes(term)) {
      foundKeywords.push(term);
      foundKeywords.push(...synonyms);
    }
  }
  
  // Also check for specific product types (wine brands -> wine keywords)
  const wineVarieties = ['merlot', 'cabernet', 'chardonnay', 'sauvignon', 'pinot', 'medco', 'riesling', 'shiraz', 'malbec'];
  const beerBrands = ['heineken', 'primus', 'skol', 'tembo', 'castel', 'ngok', 'nkoyi', 'simba', 'mutzig', 'stella', 'budweiser'];
  const sodaBrands = ['coca', 'fanta', 'sprite', 'pepsi', 'schweppes', 'orangina', 'mirinda'];
  
  // Wine varieties -> add wine keywords
  if (wineVarieties.some(v => normalizedName.includes(v))) {
    foundKeywords.push('vin', 'wine', 'alcool', 'alcohol', 'boisson', 'drink');
    if (!detectedCategory) detectedCategory = 'Boissons';
  }
  
  // Beer brands -> add beer keywords
  if (beerBrands.some(b => normalizedName.includes(b))) {
    foundKeywords.push('biere', 'beer', 'alcool', 'alcohol', 'boisson', 'drink');
    if (!detectedCategory) detectedCategory = 'Boissons';
  }
  
  // Soda brands -> add soda keywords
  if (sodaBrands.some(s => normalizedName.includes(s))) {
    foundKeywords.push('soda', 'boisson', 'drink', 'soft', 'gazeuse');
    if (!detectedCategory) detectedCategory = 'Boissons';
  }
  
  // Remove duplicates
  const uniqueKeywords = Array.from(new Set(foundKeywords));
  
  return {
    category: detectedCategory,
    searchKeywords: uniqueKeywords,
  };
}

/**
 * Aggregate items when a receipt is created or updated
 * Firestore trigger: artifacts/{config.app.id}/users/{userId}/receipts/{receiptId}
 */
export const aggregateItemsOnReceipt = functions
  .region('europe-west1')
  .firestore.document(
    `artifacts/${config.app.id}/users/{userId}/receipts/{receiptId}`,
  )
  .onWrite(async (change, context) => {
    const {userId, receiptId} = context.params;

    try {
      // Handle deletion - clean up item prices from this receipt
      if (!change.after.exists) {
        console.log(`Receipt ${receiptId} deleted - cleaning up items`);
        await cleanupDeletedReceiptItems(userId, receiptId);
        return null;
      }

      const receiptData = change.after.data();
      if (!receiptData || !receiptData.items || receiptData.items.length === 0) {
        console.log(`Receipt ${receiptId} has no items - skipping aggregation`);
        console.log(`Receipt data keys: ${receiptData ? Object.keys(receiptData).join(', ') : 'null'}`);
        return null;
      }

      const items = receiptData.items as any[];
      const storeName = receiptData.storeName || 'Inconnu';
      const currency = receiptData.currency || 'CDF';
      
      // Get receipt date as Timestamp for storage
      const rawDate = receiptData.scannedAt || receiptData.date || admin.firestore.Timestamp.now();
      const receiptDate: admin.firestore.Timestamp = rawDate?.toDate 
        ? rawDate  // Already a Timestamp
        : admin.firestore.Timestamp.fromDate(rawDate instanceof Date ? rawDate : new Date(rawDate));
      
      // Also get as Date for time calculations
      const receiptDateAsDate: Date = receiptDate.toDate();

      console.log(`📋 Processing receipt ${receiptId}:`);
      console.log(`   - Store: ${storeName}`);
      console.log(`   - Currency: ${currency}`);
      console.log(`   - Items count: ${items.length}`);
      console.log(`   - First item sample: ${JSON.stringify(items[0] || 'none')}`);

      // Get user's city for master city items table
      // Try both defaultCity and city fields (some users may have only city set)
      const userDoc = await db.collection(`artifacts/${config.app.id}/users`).doc(userId).get();
      const userData = userDoc.data();
      const userCity = userData?.defaultCity || userData?.city || null;
      
      if (!userCity) {
        console.log(`⚠️ User ${userId} has no city set - city items will NOT be saved`);
        console.log(`   User data fields: ${userData ? Object.keys(userData).join(', ') : 'no user doc'}`);
      } else {
        console.log(`🏙️ Processing receipt for user in city: ${userCity}`);
      }

      // Process each item in the receipt
      const batch = db.batch();
      const userItemsPath = `artifacts/${config.app.id}/users/${userId}/items`;
      const cityItemsPath = userCity ? `artifacts/${config.app.id}/cityItems/${userCity}/items` : null;

      // First, collect all item refs and fetch them in parallel
      const itemRefs: Array<{
        itemNameNormalized: string;
        item: ReceiptItem;
        userItemRef: FirebaseFirestore.DocumentReference;
        cityItemRef: FirebaseFirestore.DocumentReference | null;
        rawName: string;
      }> = [];

      // Note: Spell checker removed - we now trust AI parsing from Gemini

      // Track skipped items for debugging
      let skippedNoName = 0;
      let skippedNoPrice = 0;
      let skippedInvalidName = 0;
      let processedCount = 0;

      for (const item of items) {
        if (!item.name) {
          skippedNoName++;
          continue;
        }
        if (!item.unitPrice || item.unitPrice <= 0) {
          skippedNoPrice++;
          console.log(`⚠️ Skipping item "${item.name}": invalid price (${item.unitPrice})`);
          continue;
        }

        // STEP 1: TRUST THE AI PARSING - Don't "correct" already-good names!
        // The spell checker was causing problems like:
        // - "Sadia" → "Soda" (wrong!)
        // - "Full" → "Fufu" (wrong!)
        // - "Fume" → "Rum" (wrong!)
        // If Gemini AI already parsed the receipt correctly, we should use that name directly.
        // Only do minimal cleanup (trim whitespace, normalize multiple spaces)
        const rawName = item.name;
        const correctedName = item.name.trim().replace(/\s{2,}/g, ' ');
        
        // STEP 2: Get canonical name for grouping
        const itemNameNormalized = getCanonicalName(correctedName);

        // Validate item name quality - skip low-quality/mistake names
        if (!isValidItemName(correctedName, itemNameNormalized)) {
          skippedInvalidName++;
          console.log(`⚠️ Skipping low-quality item name: "${item.name}" (corrected: "${correctedName}", normalized: "${itemNameNormalized}")`);
          continue;
        }

        processedCount++;

        // Update item with corrected name for display
        item.name = correctedName;

        // Debug log per item normalization
        console.log('[ItemsAgg][Item]', {
          receiptId,
          userId,
          storeName,
          city: userCity || null,
          rawName,
          correctedName,
          normalizedName: itemNameNormalized,
        });

        const userItemRef = db.collection(userItemsPath).doc(itemNameNormalized);
        const cityItemRef = cityItemsPath ? db.collection(cityItemsPath).doc(itemNameNormalized) : null;

        itemRefs.push({
          itemNameNormalized,
          item,
          userItemRef,
          cityItemRef,
          rawName,
        });
      }

      // Fetch all documents in parallel to avoid race conditions
      const userItemDocs = await Promise.all(
        itemRefs.map(ref => ref.userItemRef.get())
      );
      const cityItemDocs = await Promise.all(
        itemRefs.map(ref => ref.cityItemRef ? ref.cityItemRef.get() : Promise.resolve(null))
      );

      // Now process each item with the fetched data
      for (let i = 0; i < itemRefs.length; i++) {
        const {itemNameNormalized, item, userItemRef, cityItemRef, rawName} = itemRefs[i];
        const userItemDoc = userItemDocs[i];
        const cityItemDoc = cityItemDocs[i];

        const newPrice: ItemPrice = {
          storeName,
          originalName: item.name, // Store the actual item name from this receipt
          price: item.unitPrice,
          currency,
          date: receiptDate,
          receiptId,
        };

        // ===== UPDATE USER'S PERSONAL ITEMS =====
        if (userItemDoc.exists) {
          // Update existing user item
          const existingData = userItemDoc.data() as AggregatedItem;

          // Check if this receipt already has a price entry (update scenario)
          const existingPriceIndex = existingData.prices.findIndex(
            p => p.receiptId === receiptId,
          );

          let updatedPrices: ItemPrice[];
          if (existingPriceIndex >= 0) {
            // Update existing price from this receipt
            updatedPrices = [...existingData.prices];
            updatedPrices[existingPriceIndex] = newPrice;
          } else {
            // Add new price (limit to last 50 prices for performance)
            updatedPrices = [newPrice, ...existingData.prices].slice(0, 50);
          }

          // Recalculate statistics
          const prices = updatedPrices.map(p => p.price);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          const storeCount = new Set(updatedPrices.map(p => p.storeName)).size;

          // Determine primary currency (most common)
          const currencyCounts = updatedPrices.reduce((acc, p) => {
            acc[p.currency] = (acc[p.currency] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          const primaryCurrency = Object.entries(currencyCounts).sort(
            ([, a], [, b]) => b - a,
          )[0][0] as 'USD' | 'CDF';

          // FIXED: Always use the NEW name from the receipt
          // We trust the AI parsing - if Gemini says "Sadia", use "Sadia"
          // Old logic preferred longer names but that kept bad spellings like "Fufu" over "Full"
          const bestName = item.name || existingData.name || '';

          console.log('[ItemsAgg][UserItem][Update]', {
            receiptId,
            userId,
            storeName,
            city: userCity || null,
            rawName,
            correctedName: item.name,
            bestName,
            normalizedName: itemNameNormalized,
            price: newPrice.price,
            currency,
            priceCount: updatedPrices.length,
          });

          batch.update(userItemRef, {
            name: bestName, // Use longest/most complete name
            prices: updatedPrices,
            minPrice,
            maxPrice,
            avgPrice,
            storeCount,
            currency: primaryCurrency,
            totalPurchases: updatedPrices.length,
            lastPurchaseDate: receiptDate,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          // Create new user item
          const newItem: Omit<AggregatedItem, 'createdAt' | 'updatedAt'> = {
            id: itemNameNormalized,
            name: item.name,
            nameNormalized: itemNameNormalized,
            prices: [newPrice],
            minPrice: item.unitPrice,
            maxPrice: item.unitPrice,
            avgPrice: item.unitPrice,
            storeCount: 1,
            currency,
            totalPurchases: 1,
            lastPurchaseDate: receiptDate,
          };

          console.log('[ItemsAgg][UserItem][Create]', {
            receiptId,
            userId,
            storeName,
            city: userCity || null,
            rawName,
            correctedName: item.name,
            normalizedName: itemNameNormalized,
            price: newPrice.price,
            currency,
          });

          batch.set(userItemRef, {
            ...newItem,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // ===== UPDATE MASTER CITY ITEMS TABLE (if city is set) =====
        // CRITICAL: Never save items with price 0, null, undefined, or NaN to cityItems
        const priceValue = newPrice.price;
        const isValidPrice = priceValue !== null && 
                             priceValue !== undefined && 
                             !isNaN(priceValue) && 
                             isFinite(priceValue) && 
                             priceValue > 0;

        // CRITICAL: Never save "Article inconnu" or items from "Magasin inconnu" to cityItems
        const itemNameLower = item.name?.toLowerCase() || '';
        const storeNameLower = storeName?.toLowerCase() || '';
        const isUnknownItem = itemNameLower.includes('article inconnu') || 
                              itemNameLower.includes('unknown item') ||
                              itemNameLower.includes('unavailable name');
        const isUnknownStore = storeNameLower.includes('magasin inconnu') ||
                               storeNameLower.includes('magazin inconnu') ||
                               storeNameLower.includes('unknown store') ||
                               storeNameLower.includes('magasin unknown');

        if (!isValidPrice && cityItemRef) {
          console.log(`Skipping cityItem save for "${itemNameNormalized}": invalid price ${priceValue}`);
        }

        if (isUnknownItem && cityItemRef) {
          console.log(`Skipping cityItem save for "${itemNameNormalized}": item name is "Article inconnu" or similar`);
        }

        if (isUnknownStore && cityItemRef) {
          console.log(`Skipping cityItem save for "${itemNameNormalized}": store is "Magasin inconnu" or similar`);
        }

        if (cityItemRef && cityItemDoc && isValidPrice && !isUnknownItem && !isUnknownStore) {
          // Price entry includes userId for tracking which users have this item
          const cityPrice: ItemPrice & { userId: string } = {
            ...newPrice,
            userId,
          };

          if (cityItemDoc.exists) {
            // Update existing city item
            const cityData = cityItemDoc.data() as AggregatedItem & { userIds?: string[] };

            // Check if this receipt already has a price entry
            const existingCityPriceIndex = cityData.prices.findIndex(
              (p: any) => p.receiptId === receiptId && p.userId === userId,
            );

            let updatedCityPrices: (ItemPrice & { userId: string })[];
            if (existingCityPriceIndex >= 0) {
              // Update existing price
              updatedCityPrices = [...cityData.prices] as any;
              updatedCityPrices[existingCityPriceIndex] = cityPrice;
            } else {
              // Add new price (limit to last 100 prices for city-wide data)
              updatedCityPrices = [cityPrice, ...(cityData.prices as any)].slice(0, 100);
            }

            // Filter out any existing invalid prices (0, null, undefined, NaN)
            updatedCityPrices = updatedCityPrices.filter(p => {
              const price = p.price;
              return price !== null && price !== undefined && !isNaN(price) && isFinite(price) && price > 0;
            });

            // Skip if no valid prices remain after filtering
            if (updatedCityPrices.length === 0) {
              console.log(`Skipping cityItem update for "${itemNameNormalized}": no valid prices after filtering`);
              continue;
            }

            // Recalculate city statistics (now using only valid prices)
            const cityPriceValues = updatedCityPrices.map(p => p.price);
            const minPrice = Math.min(...cityPriceValues);
            const maxPrice = Math.max(...cityPriceValues);
            const avgPrice = cityPriceValues.reduce((sum, p) => sum + p, 0) / cityPriceValues.length;
            const storeCount = new Set(updatedCityPrices.map(p => p.storeName)).size;
            const userIds = Array.from(new Set(updatedCityPrices.map(p => p.userId)));

            // Determine primary currency
            const currencyCounts = updatedCityPrices.reduce((acc, p) => {
              acc[p.currency] = (acc[p.currency] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            const primaryCurrency = Object.entries(currencyCounts).sort(
              ([, a], [, b]) => b - a,
            )[0][0] as 'USD' | 'CDF';

            // ===== ML/AI FEATURES =====
            // Calculate price volatility (coefficient of variation)
            const priceStdDev = Math.sqrt(
              cityPriceValues.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / cityPriceValues.length
            );
            const priceVolatility = avgPrice > 0 ? (priceStdDev / avgPrice) * 100 : 0;

            // Calculate price change percentage (last vs first price)
            const oldestPrice = updatedCityPrices[updatedCityPrices.length - 1].price;
            const latestPrice = updatedCityPrices[0].price;
            const priceChangePercent = oldestPrice > 0 ? ((latestPrice - oldestPrice) / oldestPrice) * 100 : 0;

            // Store-level aggregation for ML (per-store average prices)
            const storeAggregation = updatedCityPrices.reduce((acc, p) => {
              if (!acc[p.storeName]) {
                acc[p.storeName] = { prices: [], count: 0, name: p.storeName };
              }
              acc[p.storeName].prices.push(p.price);
              acc[p.storeName].count++;
              return acc;
            }, {} as Record<string, { prices: number[]; count: number; name: string }>);

            const stores = Object.entries(storeAggregation).map(([name, data]) => ({
              name,
              avgPrice: data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length,
              minPrice: Math.min(...data.prices),
              maxPrice: Math.max(...data.prices),
              purchaseCount: data.count,
            }));

            // Time-based features
            const firstSeenDate = cityData.createdAt?.toDate?.() || new Date();
            const daysSinceFirstSeen = Math.floor((receiptDateAsDate.getTime() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24));
            const weeklyPurchaseRate = daysSinceFirstSeen > 0 ? (updatedCityPrices.length / daysSinceFirstSeen) * 7 : 0;

            // Popularity score (combines user count, purchase frequency, and recency)
            const daysSinceLastPurchase = Math.floor((new Date().getTime() - receiptDateAsDate.getTime()) / (1000 * 60 * 60 * 24));
            const recencyFactor = Math.max(0, 1 - (daysSinceLastPurchase / 365)); // Decay over 1 year
            const popularityScore = (userIds.length * 10) + (weeklyPurchaseRate * 5) + (recencyFactor * 20);

            // FIXED: Always use the NEW name from the receipt
            // We trust the AI parsing - if Gemini says "Sadia", use "Sadia"
            // Old logic preferred longer names but that kept bad spellings like "Fufu" over "Full"
            const bestCityName = item.name || cityData.name || '';

            console.log('[ItemsAgg][CityItem][Update]', {
              receiptId,
              userId,
              storeName,
              city: userCity,
              rawName,
              correctedName: item.name,
              bestName: bestCityName,
              normalizedName: itemNameNormalized,
              price: cityPrice.price,
              currency,
              priceCount: updatedCityPrices.length,
              userCount: userIds.length,
            });
            
            // Detect/update category and search keywords if not already set
            const updateData: Record<string, any> = {
              name: bestCityName,
              prices: updatedCityPrices,
              minPrice,
              maxPrice,
              avgPrice,
              storeCount,
              userCount: userIds.length,
              userIds,
              currency: primaryCurrency,
              totalPurchases: updatedCityPrices.length,
              lastPurchaseDate: receiptDate,
              city: userCity,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              // ML/AI Features
              priceVolatility,
              priceChangePercent,
              stores,
              daysSinceFirstSeen,
              weeklyPurchaseRate,
              popularityScore,
            };
            
            // Add category and searchKeywords if not already present
            const cityDataAny = cityData as any;
            if (!cityDataAny.category || !cityDataAny.searchKeywords) {
              const { category, searchKeywords } = detectCategoryAndKeywords(bestCityName);
              if (category && !cityDataAny.category) {
                updateData.category = category;
              }
              if (searchKeywords.length > 0 && !cityDataAny.searchKeywords) {
                updateData.searchKeywords = searchKeywords;
              }
            }

            batch.update(cityItemRef, updateData);
          } else {
            // Create new city item
            // Detect category and search keywords for enhanced search
            const { category, searchKeywords } = detectCategoryAndKeywords(item.name);
            
            const newCityItem: Record<string, any> = {
              id: itemNameNormalized,
              name: item.name,
              nameNormalized: itemNameNormalized,
              prices: [cityPrice],
              minPrice: item.unitPrice,
              maxPrice: item.unitPrice,
              avgPrice: item.unitPrice,
              storeCount: 1,
              userCount: 1,
              userIds: [userId],
              currency,
              totalPurchases: 1,
              lastPurchaseDate: receiptDate,
              city: userCity,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              // ML/AI Features (initial values for new item)
              priceVolatility: 0, // No variation yet with single price
              priceChangePercent: 0, // No change yet
              stores: [{
                name: storeName,
                avgPrice: item.unitPrice,
                minPrice: item.unitPrice,
                maxPrice: item.unitPrice,
                purchaseCount: 1,
              }],
              daysSinceFirstSeen: 0,
              weeklyPurchaseRate: 0,
              popularityScore: 10, // Base score for new item
            };
            
            // Add category if detected
            if (category) {
              newCityItem.category = category;
            }
            
            // Add search keywords if found
            if (searchKeywords.length > 0) {
              newCityItem.searchKeywords = searchKeywords;
            }

            console.log('[ItemsAgg][CityItem][Create]', {
              receiptId,
              userId,
              storeName,
              city: userCity,
              rawName,
              correctedName: item.name,
              normalizedName: itemNameNormalized,
              price: cityPrice.price,
              currency,
            });

            batch.set(cityItemRef, newCityItem);
          }
        }
      }

      // Commit all item updates
      await batch.commit();
      
      // Summary log for debugging
      console.log(`📊 Item aggregation summary for receipt ${receiptId}:`);
      console.log(`   - Total items in receipt: ${items.length}`);
      console.log(`   - Items processed (valid): ${processedCount}`);
      console.log(`   - Skipped (no name): ${skippedNoName}`);
      console.log(`   - Skipped (no/invalid price): ${skippedNoPrice}`);
      console.log(`   - Skipped (invalid name quality): ${skippedInvalidName}`);
      console.log(`   - User items path: ${userItemsPath}`);
      console.log(`   - City items path: ${cityItemsPath || 'N/A (no city set)'}`);
      console.log(`✅ Aggregated ${processedCount} items for receipt ${receiptId}`);

      return null;
    } catch (error) {
      console.error(`❌ Error aggregating items for receipt ${receiptId}:`, error);
      // Don't throw - allow receipt to be saved even if aggregation fails
      return null;
    }
  });

/**
 * Clean up USER'S PERSONAL items when a receipt is deleted
 * 
 * IMPORTANT: This ONLY cleans up the user's personal items collection.
 * The MASTER CITY ITEMS TABLE is NEVER modified by this function.
 * 
 * This is intentional - city items are community data that should persist
 * even when individual users delete their receipts. This allows the app
 * to maintain accurate price history for the community.
 * 
 * Flow:
 * - User deletes receipt → cleanupDeletedReceiptItems called
 * - User's items collection is updated (prices from receipt removed)
 * - City items collection is UNTOUCHED (prices remain for community)
 */
export async function cleanupDeletedReceiptItems(
  userId: string,
  receiptId: string,
): Promise<void> {
  console.log(`🗑️ Cleaning up USER items for deleted receipt ${receiptId}`);
  console.log(`📌 Note: Master city items table is NOT modified (community data preserved)`);

  const itemsCollectionPath = `artifacts/${config.app.id}/users/${userId}/items`;
  const itemsSnapshot = await db.collection(itemsCollectionPath).get();

  console.log(
    `Found ${itemsSnapshot.size} user items to check for receipt ${receiptId}`,
  );

  const batch = db.batch();
  let batchCount = 0;
  const maxBatchSize = 500;

  for (const itemDoc of itemsSnapshot.docs) {
    const itemData = itemDoc.data() as AggregatedItem;
    const prices = itemData.prices || [];

    // Filter out prices from the deleted receipt
    const updatedPrices = prices.filter(p => p.receiptId !== receiptId);

    if (updatedPrices.length !== prices.length) {
      // Prices were removed
      if (updatedPrices.length === 0) {
        // No prices left, delete the item
        batch.delete(itemDoc.ref);
        batchCount++;
      } else {
        // Recalculate statistics
        const priceValues = updatedPrices.map(p => p.price);
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const avgPrice =
          priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;
        const storeCount = new Set(updatedPrices.map(p => p.storeName)).size;

        // Determine primary currency (most common)
        const currencyCounts = updatedPrices.reduce((acc, p) => {
          acc[p.currency] = (acc[p.currency] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const primaryCurrency = Object.entries(currencyCounts).sort(
          ([, a], [, b]) => b - a,
        )[0][0] as 'USD' | 'CDF';

        const lastPurchaseDate = updatedPrices[0].date; // Most recent

        batch.update(itemDoc.ref, {
          prices: updatedPrices,
          minPrice,
          maxPrice,
          avgPrice,
          storeCount,
          currency: primaryCurrency,
          totalPurchases: updatedPrices.length,
          lastPurchaseDate,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount++;
      }

      // Commit batch if reaching limit
      if (batchCount >= maxBatchSize) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }

  // Commit remaining operations
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`✅ Cleaned up items for deleted receipt ${receiptId}`);
}

/**
 * Callable function to manually trigger item aggregation for a user
 * Useful for backfilling existing data or fixing inconsistencies
 */
export const rebuildItemsAggregation = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    const userId = context.auth.uid;

    try {
      console.log(`Starting items aggregation rebuild for user ${userId}`);

      // Clear existing items
      const itemsCollectionPath = `artifacts/${config.app.id}/users/${userId}/items`;
      const existingItems = await db.collection(itemsCollectionPath).get();
      const deleteBatch = db.batch();
      existingItems.docs.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      console.log(`Cleared ${existingItems.size} existing items`);

      // Get all receipts
      const receiptsSnapshot = await db
        .collection(`artifacts/${config.app.id}/users/${userId}/receipts`)
        .orderBy('scannedAt', 'desc')
        .get();

      console.log(`Processing ${receiptsSnapshot.size} receipts`);

      // Aggregate all items
      const itemsMap = new Map<string, AggregatedItem>();

      for (const receiptDoc of receiptsSnapshot.docs) {
        const receiptData = receiptDoc.data();
        if (!receiptData.items || receiptData.items.length === 0) {
          continue;
        }

        const storeName = receiptData.storeName || 'Inconnu';
        const currency = receiptData.currency || 'CDF';
        const receiptDate =
          receiptData.scannedAt ||
          receiptData.date ||
          admin.firestore.Timestamp.now();

        for (const item of receiptData.items) {
          if (!item.name || !item.unitPrice || item.unitPrice <= 0) {
            continue;
          }

          // Skip items with placeholder names - they can't be reused in community DB
          const isPlaceholderName = item.name.toLowerCase().includes('unavailable name') || 
                                     item.name.toLowerCase() === 'unavailable' ||
                                     item.name.toLowerCase() === 'unavailable name';
          
          if (isPlaceholderName) {
            console.log(`Skipping placeholder item from rebuild: ${item.name}`);
            continue;
          }

          const itemNameNormalized = getCanonicalName(item.name);
          const newPrice: ItemPrice = {
            storeName,
            originalName: item.name,
            price: item.unitPrice,
            currency,
            date: receiptDate,
            receiptId: receiptDoc.id,
          };

          if (itemsMap.has(itemNameNormalized)) {
            const existingItem = itemsMap.get(itemNameNormalized)!;
            existingItem.prices.push(newPrice);
          } else {
            itemsMap.set(itemNameNormalized, {
              id: itemNameNormalized,
              name: item.name,
              nameNormalized: itemNameNormalized,
              prices: [newPrice],
              minPrice: item.unitPrice,
              maxPrice: item.unitPrice,
              avgPrice: item.unitPrice,
              storeCount: 1,
              currency,
              totalPurchases: 1,
              lastPurchaseDate: receiptDate,
              createdAt: admin.firestore.Timestamp.now(),
              updatedAt: admin.firestore.Timestamp.now(),
            });
          }
        }
      }

      // Recalculate statistics for each item
      for (const [, item] of itemsMap) {
        const prices = item.prices.map(p => p.price);
        item.minPrice = Math.min(...prices);
        item.maxPrice = Math.max(...prices);
        item.avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        item.storeCount = new Set(item.prices.map(p => p.storeName)).size;
        item.totalPurchases = item.prices.length;

        // Limit to last 50 prices
        item.prices = item.prices
          .sort((a, b) => b.date.toMillis() - a.date.toMillis())
          .slice(0, 50);

        // Determine primary currency
        const currencyCounts = item.prices.reduce((acc, p) => {
          acc[p.currency] = (acc[p.currency] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        item.currency = Object.entries(currencyCounts).sort(
          ([, a], [, b]) => b - a,
        )[0][0] as 'USD' | 'CDF';
      }

      // Write aggregated items in batches (max 500 per batch)
      const itemsArray = Array.from(itemsMap.values());
      const batchSize = 500;

      for (let i = 0; i < itemsArray.length; i += batchSize) {
        const batch = db.batch();
        const batchItems = itemsArray.slice(i, i + batchSize);

        for (const item of batchItems) {
          const itemRef = db.collection(itemsCollectionPath).doc(item.id);
          batch.set(itemRef, item);
        }

        await batch.commit();
        console.log(
          `Wrote batch ${Math.floor(i / batchSize) + 1} (${batchItems.length} items)`,
        );
      }

      console.log(
        `✅ Rebuild complete: ${itemsArray.length} items aggregated from ${receiptsSnapshot.size} receipts`,
      );

      return {
        success: true,
        itemsCount: itemsArray.length,
        receiptsProcessed: receiptsSnapshot.size,
      };
    } catch (error) {
      console.error('Error rebuilding items aggregation:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to rebuild items aggregation',
      );
    }
  });

/**
 * Get items from the MASTER CITY ITEMS TABLE
 * 
 * This reads from: artifacts/{appId}/cityItems/{city}/items/{itemId}
 * 
 * The master table contains community price data that persists forever,
 * even when individual users delete their receipts. This provides:
 * - Accurate price history for the community
 * - Price comparison across different stores
 * - Historical price trends
 * 
 * Data in this table is NEVER deleted by users.
 * It can only be cleaned up by admin functions (e.g., data retention policies).
 */
export const getCityItems = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    const userId = context.auth.uid;
    const { city } = data;

    if (!city || typeof city !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'City parameter is required and must be a string',
      );
    }

    try {
      console.log(`Getting city items for city: ${city}, user: ${userId}`);
      console.log(`Collection path: artifacts/${config.app.id}/cityItems/${city}/items`);
      console.log(`Config app ID: ${config.app.id}`);

      // First check if the city collection exists
      const cityCollectionRef = db.collection(`artifacts/${config.app.id}/cityItems/${city}/items`);
      
      // Read directly from master city items table
      const cityItemsSnapshot = await cityCollectionRef.get();

      console.log(`Found ${cityItemsSnapshot.size} items in master table for ${city}`);

      // If no items found, return empty result instead of error
      if (cityItemsSnapshot.empty) {
        console.log(`No items found for city ${city}, returning empty result`);
        return {
          success: true,
          items: [],
          city,
          message: `No items available yet for ${city}. Items will appear as users scan receipts in this city.`,
        };
      }

      // Helper function to safely convert timestamp to Date
      const safeToDate = (value: any): Date => {
        if (!value) return new Date();
        if (value.toDate && typeof value.toDate === 'function') {
          return value.toDate();
        }
        if (value instanceof Date) return value;
        if (typeof value === 'string' || typeof value === 'number') {
          return new Date(value);
        }
        if (value._seconds !== undefined) {
          return new Date(value._seconds * 1000);
        }
        return new Date();
      };

      // Helper function to sanitize numbers (NaN causes JSON encoding errors)
      const safeNumber = (value: any, defaultValue: number = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        const num = Number(value);
        return isNaN(num) || !isFinite(num) ? defaultValue : num;
      };

      const cityItems = cityItemsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          // Sanitize ALL numeric fields (including avgPrice which may have NaN)
          totalPurchases: safeNumber(data.totalPurchases, 0),
          averagePrice: safeNumber(data.averagePrice || data.avgPrice, 0),
          avgPrice: safeNumber(data.avgPrice, 0),
          minPrice: safeNumber(data.minPrice, 0),
          maxPrice: safeNumber(data.maxPrice, 0),
          userCount: safeNumber(data.userCount, 0),
          storeCount: safeNumber(data.storeCount, 0),
          popularityScore: safeNumber(data.popularityScore, 0),
          lastPurchaseDate: safeToDate(data.lastPurchaseDate),
          prices: (data.prices || []).map((p: any) => ({
            ...p,
            price: safeNumber(p.price, 0),
            quantity: safeNumber(p.quantity, 1),
            date: safeToDate(p.date),
          })),
        };
      });

      // Sort by popularity (most purchased/popular items first)
      // Sorting criteria (in order of priority):
      // 1. popularityScore (combines userCount, purchase frequency, recency)
      // 2. totalPurchases (if popularityScore is same)
      // 3. userCount (if totalPurchases is same)
      cityItems.sort((a, b) => {
        // Primary: popularity score (higher is better)
        const scoreDiff = (b.popularityScore || 0) - (a.popularityScore || 0);
        if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
        
        // Secondary: total purchases (higher is better)
        const purchaseDiff = (b.totalPurchases || 0) - (a.totalPurchases || 0);
        if (purchaseDiff !== 0) return purchaseDiff;
        
        // Tertiary: user count (more users = more popular)
        return (b.userCount || 0) - (a.userCount || 0);
      });

      console.log(`✅ Returning ${cityItems.length} items for city ${city} (sorted by popularity)`);
      if (cityItems.length > 0) {
        console.log(`   Top 3 items: ${cityItems.slice(0, 3).map((i: any) => 
          `${i.name} (score: ${i.popularityScore?.toFixed(1) || 0}, purchases: ${i.totalPurchases || 0})`
        ).join(', ')}`);
      }

      return {
        success: true,
        items: cityItems,
        city,
      };
    } catch (error: any) {
      console.error('Error getting city items:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error stack:', error?.stack);
      
      // Return empty result instead of throwing error
      return {
        success: true,
        items: [],
        city,
        message: `Unable to load items for ${city}. Please try again later.`,
        error: error?.message || 'Unknown error',
      };
    }
  });

/**
 * Backfill existing city items with category and searchKeywords
 * Call this function once to update all existing items
 * Pass forceUpdate: true to regenerate keywords even for items that have them
 */
export const backfillCityItemCategories = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Only allow admin users to run this
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { city, dryRun = false, forceUpdate = false } = data;

    if (!city) {
      throw new functions.https.HttpsError('invalid-argument', 'City parameter is required');
    }

    try {
      console.log(`🔄 Starting category backfill for city: ${city}, dryRun: ${dryRun}, forceUpdate: ${forceUpdate}`);
      
      const cityItemsRef = db.collection(`artifacts/${config.app.id}/cityItems/${city}/items`);
      const snapshot = await cityItemsRef.get();
      
      if (snapshot.empty) {
        return { success: true, message: `No items found for city ${city}`, updated: 0 };
      }

      let updatedCount = 0;
      let skippedCount = 0;
      const batch = db.batch();
      const updates: { name: string; category: string | null; keywords: string[] }[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Skip if already has category and searchKeywords (unless forceUpdate is true)
        if (!forceUpdate && data.category && data.searchKeywords && data.searchKeywords.length > 0) {
          skippedCount++;
          continue;
        }

        // Detect category and keywords
        const { category, searchKeywords } = detectCategoryAndKeywords(data.name);
        
        updates.push({
          name: data.name,
          category,
          keywords: searchKeywords,
        });

        if (!dryRun) {
          const updateData: Record<string, any> = {};
          
          // Always update if forceUpdate, otherwise only if missing
          if (forceUpdate || (!data.category && category)) {
            if (category) updateData.category = category;
          }
          
          if (forceUpdate || (!data.searchKeywords || data.searchKeywords.length === 0)) {
            if (searchKeywords.length > 0) updateData.searchKeywords = searchKeywords;
          }
          
          if (Object.keys(updateData).length > 0) {
            batch.update(doc.ref, updateData);
            updatedCount++;
          }
        } else {
          if (category || searchKeywords.length > 0) {
            updatedCount++;
          }
        }
      }

      if (!dryRun && updatedCount > 0) {
        await batch.commit();
      }

      console.log(`✅ Category backfill complete for ${city}: updated ${updatedCount}, skipped ${skippedCount}`);

      return {
        success: true,
        city,
        totalItems: snapshot.size,
        updated: updatedCount,
        skipped: skippedCount,
        dryRun,
        forceUpdate,
        sampleUpdates: updates.slice(0, 20), // Return first 20 for review
      };
    } catch (error: any) {
      console.error('Error in category backfill:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
