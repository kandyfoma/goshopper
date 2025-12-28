/**
 * Test the fixed normalization logic
 */

// Copy of the fixed normalization function for testing
function normalizeItemName(name) {
  let normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();

  // Remove parenthetical codes
  normalized = normalized.replace(/\([^)]*\)/g, '').trim();

  // Remove product codes/SKUs
  normalized = normalized
    .replace(/\b[a-z]\d+[a-z]?\d*\b/gi, '')
    .replace(/\b[a-z]\d+x\d+\b/gi, '')
    .replace(/\b\d+[a-z]\d+\b/gi, '')
    .trim();

  // Remove size/weight/volume info
  normalized = normalized
    .replace(/\b\d+\s*(ml|cl|dl|l|litre|liter|litres|liters)\b/gi, '')
    .replace(/\b\d+\s*(g|kg|gram|grams|kilogram|kilograms)\b/gi, '')
    .replace(/\b\d+\s*(oz|lb|lbs|pound|pounds|ounce|ounces)\b/gi, '')
    .replace(/\b\d+\s*(pcs|pieces|pack|packs|sachets?|packets?)\b/gi, '')
    .replace(/\b\d+\s*x\s*\d+\s*(ml|g|cl)?\b/gi, '')
    .trim();

  // Remove noise words
  normalized = normalized
    .replace(/\b(alt\.?\s*unit|unit|pce|pcs|piece|pieces)\b/gi, '')
    .replace(/\b(medium|large|small|mini|maxi|jumbo|giant|family)\b/gi, '')
    .replace(/\b(new|nouveau|promo|promotion|special|edition)\b/gi, '')
    .trim();

  // Clean up special characters
  normalized = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Fix common OCR mistakes
  normalized = normalized
    .replace(/\bm1lk\b/g, 'milk')
    .replace(/\bmi1k\b/g, 'milk')
    .replace(/([a-z])1([a-z])/g, '$1l$2')
    .replace(/([a-z])1([a-z])/g, '$1l$2')
    .replace(/([a-z])0([a-z])/g, '$1o$2')
    .replace(/([a-z])0([a-z])/g, '$1o$2');

  // Final cleanup
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// OLD buggy synonym matching (for comparison)
function getCanonicalNameOLD(name) {
  const normalized = normalizeItemName(name);
  
  const synonyms = {
    'the': ['tea', 'te', 'the'],
    'sprite': ['sprite', 'lemon soda'],
    'biere': ['beer', 'cerveza', 'biere'],
  };

  // BUGGY: Uses substring matching
  for (const [canonical, variations] of Object.entries(synonyms)) {
    if (variations.some(v => normalized.includes(v) || v.includes(normalized))) {
      return canonical.replace(/\s+/g, '');
    }
  }

  return normalized.replace(/\s+/g, '');
}

// NEW fixed synonym matching
function getCanonicalNameNEW(name) {
  const normalized = normalizeItemName(name);
  
  const synonyms = {
    'the': ['tea', 'te', 'the'],
    'sprite': ['sprite', 'lemon soda'],
    'biere': ['beer', 'cerveza', 'biere'],
  };

  // FIXED: Only match COMPLETE WORDS, not substrings
  const normalizedWords = normalized.split(/\s+/);
  const normalizedFull = normalized.replace(/\s+/g, '');
  
  for (const [canonical, variations] of Object.entries(synonyms)) {
    for (const variation of variations) {
      const variationNoSpaces = variation.replace(/\s+/g, '');
      
      // 1. Exact match (with or without spaces)
      if (normalizedFull === variationNoSpaces) {
        return canonical.replace(/\s+/g, '');
      }
      
      // 2. Full word match
      if (normalizedWords.includes(variation)) {
        if (normalizedWords.length === 1 || 
            normalizedWords[0] === variation || 
            normalizedWords[normalizedWords.length - 1] === variation) {
          return canonical.replace(/\s+/g, '');
        }
      }
    }
  }

  return normalized.replace(/\s+/g, '');
}

// Test cases
const testCases = [
  { input: 'Castel lite e30 m l', shouldNotBe: 'the', description: 'Castel lite beer should NOT become "the"' },
  { input: 'S prite', shouldBe: 'sprite', description: 'S prite with space should become "sprite"' },
  { input: 'Sprite 330ml', shouldBe: 'sprite', description: 'Sprite 330ml should become "sprite"' },
  { input: 'Tea', shouldBe: 'the', description: 'Tea should become "the" (French)' },
  { input: 'Green Tea', shouldBe: 'the', description: 'Green Tea should become "the"' },
  { input: 'Lipton Tea Bags', shouldBe: 'the', description: 'Lipton Tea Bags should become "the"' },
  { input: 'Beer Heineken', shouldBe: 'biere', description: 'Beer should become "biere"' },
  { input: 'Sprite', shouldBe: 'sprite', description: 'Sprite alone should stay "sprite"' },
  { input: 'Castle Milk Stout', shouldNotBe: 'the', description: 'Castle Milk Stout should NOT become "the"' },
  { input: 'Amstel', shouldNotBe: 'the', description: 'Amstel should NOT become "the"' },
];

console.log('\n🧪 Testing Normalization Fix\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const normalized = normalizeItemName(test.input);
  const oldResult = getCanonicalNameOLD(test.input);
  const newResult = getCanonicalNameNEW(test.input);
  
  let testPassed = false;
  
  if (test.shouldBe) {
    testPassed = newResult === test.shouldBe;
  } else if (test.shouldNotBe) {
    testPassed = newResult !== test.shouldNotBe;
  }
  
  const status = testPassed ? '✅ PASS' : '❌ FAIL';
  if (testPassed) passed++; else failed++;
  
  console.log(`\n${status}: ${test.description}`);
  console.log(`   Input:      "${test.input}"`);
  console.log(`   Normalized: "${normalized}"`);
  console.log(`   OLD result: "${oldResult}" ${test.shouldNotBe && oldResult === test.shouldNotBe ? '⚠️ BUG!' : ''}`);
  console.log(`   NEW result: "${newResult}"`);
  if (test.shouldBe) {
    console.log(`   Expected:   "${test.shouldBe}"`);
  } else if (test.shouldNotBe) {
    console.log(`   Should NOT be: "${test.shouldNotBe}"`);
  }
}

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Some tests failed! The fix needs more work.');
  process.exit(1);
} else {
  console.log('✅ All tests passed! The fix is working correctly.');
}
