/**
 * Test the EXACT items from user's receipts
 */

// Full normalization function
function normalizeItemName(name) {
  let normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  normalized = normalized.replace(/\([^)]*\)/g, '').trim();
  normalized = normalized
    .replace(/\b[a-z]\d+[a-z]?\d*\b/gi, '')
    .replace(/\b[a-z]\d+x\d+\b/gi, '')
    .replace(/\b\d+[a-z]\d+\b/gi, '')
    .trim();
  normalized = normalized
    .replace(/\b\d+\s*(ml|cl|dl|l|litre|liter|litres|liters)\b/gi, '')
    .replace(/\b\d+\s*(g|kg|gram|grams|kilogram|kilograms)\b/gi, '')
    .replace(/\b\d+\s*(oz|lb|lbs|pound|pounds|ounce|ounces)\b/gi, '')
    .replace(/\b\d+\s*(pcs|pieces|pack|packs|sachets?|packets?)\b/gi, '')
    .replace(/\b\d+\s*x\s*\d+\s*(ml|g|cl)?\b/gi, '')
    .trim();
  normalized = normalized
    .replace(/\b(alt\.?\s*unit|unit|pce|pcs|piece|pieces)\b/gi, '')
    .replace(/\b(medium|large|small|mini|maxi|jumbo|giant|family)\b/gi, '')
    .replace(/\b(new|nouveau|promo|promotion|special|edition)\b/gi, '')
    .trim();
  normalized = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // OCR fixes
  normalized = normalized
    .replace(/\b([a-z](?:\s+[a-z]){1,6})\b/g, (match) => match.replace(/\s+/g, ''));

  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

// Trace what happens step by step
function traceNormalization(name) {
  console.log(`\n📝 Tracing: "${name}"`);
  
  let step = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  console.log(`   1. Lowercase & remove accents: "${step}"`);
  
  step = step.replace(/\([^)]*\)/g, '').trim();
  console.log(`   2. Remove parentheses: "${step}"`);
  
  step = step.replace(/\b[a-z]\d+[a-z]?\d*\b/gi, '').replace(/\b[a-z]\d+x\d+\b/gi, '').replace(/\b\d+[a-z]\d+\b/gi, '').trim();
  console.log(`   3. Remove product codes: "${step}"`);
  
  step = step.replace(/\b\d+\s*(ml|cl|dl|l|litre|liter|litres|liters)\b/gi, '')
             .replace(/\b\d+\s*(g|kg|gram|grams|kilogram|kilograms)\b/gi, '')
             .replace(/\b\d+\s*(oz|lb|lbs|pound|pounds|ounce|ounces)\b/gi, '')
             .replace(/\b\d+\s*(pcs|pieces|pack|packs|sachets?|packets?)\b/gi, '')
             .replace(/\b\d+\s*x\s*\d+\s*(ml|g|cl)?\b/gi, '').trim();
  console.log(`   4. Remove size/weight: "${step}"`);
  
  step = step.replace(/\b(alt\.?\s*unit|unit|pce|pcs|piece|pieces)\b/gi, '')
             .replace(/\b(medium|large|small|mini|maxi|jumbo|giant|family)\b/gi, '')
             .replace(/\b(new|nouveau|promo|promotion|special|edition)\b/gi, '').trim();
  console.log(`   5. Remove noise words: "${step}"`);
  
  step = step.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`   6. Clean special chars: "${step}"`);
  
  // Step 9 - aggressive OCR space fix
  step = step.replace(/\b([a-z](?:\s+[a-z]){1,6})\b/g, (match) => {
    const result = match.replace(/\s+/g, '');
    if (result !== match.replace(/\s+/g, '')) {
      console.log(`   9. OCR space fix: "${match}" → "${result}"`);
    }
    return result;
  });
  
  step = step.replace(/\s+/g, ' ').trim();
  console.log(`   FINAL normalized: "${step}"`);
  
  return step;
}

console.log('\n🔬 EXACT ITEM TRACE FROM YOUR RECEIPTS\n');
console.log('='.repeat(70));

// Items from your database
const exactItems = [
  'Castel lite e30 m l',   // From Alilac Center - incorrectly became "the"
  'S prite',               // Sprite with OCR space issue
  'Virgin Mojito',         // From Catch
  'B ag a lilac xl',       // Bag with spaces
  'BAG ALILAC XL',         // Same bag uppercase
];

for (const item of exactItems) {
  traceNormalization(item);
}

console.log('\n' + '='.repeat(70));
console.log('\n✨ Key Question: Does "Castel lite e30 m l" still become "the"?\n');

// Now test with the full getCanonicalName function
const synonyms = {
  'the': ['tea', 'te', 'the'],
  'sprite': ['sprite', 'lemon soda'],
};

function getCanonicalNameNEW(name) {
  const normalized = normalizeItemName(name);
  const normalizedWords = normalized.split(/\s+/);
  const normalizedFull = normalized.replace(/\s+/g, '');
  
  console.log(`   Words: [${normalizedWords.map(w => `"${w}"`).join(', ')}]`);
  
  for (const [canonical, variations] of Object.entries(synonyms)) {
    for (const variation of variations) {
      const variationNoSpaces = variation.replace(/\s+/g, '');
      
      if (normalizedFull === variationNoSpaces) {
        console.log(`   ✓ Exact match: "${normalizedFull}" === "${variationNoSpaces}" → "${canonical}"`);
        return canonical.replace(/\s+/g, '');
      }
      
      if (normalizedWords.includes(variation)) {
        if (normalizedWords.length === 1 || 
            normalizedWords[0] === variation || 
            normalizedWords[normalizedWords.length - 1] === variation) {
          console.log(`   ✓ Word match: "${variation}" is first/last word → "${canonical}"`);
          return canonical.replace(/\s+/g, '');
        } else {
          console.log(`   ✗ Word "${variation}" is in middle, skipping`);
        }
      }
    }
  }

  console.log(`   No synonym match, using: "${normalizedFull}"`);
  return normalizedFull;
}

console.log('\nFinal canonical names:');
for (const item of exactItems) {
  console.log(`\n"${item}":`);
  const result = getCanonicalNameNEW(item);
  console.log(`   → "${result}"`);
}
