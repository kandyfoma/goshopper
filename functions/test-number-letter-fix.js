// Test the number-letter OCR confusion fix
const { fixOCRErrors } = require('./lib/utils/spellChecker');

console.log('\n=== Testing Number-Letter OCR Confusion Fix ===\n');

const testCases = [
  // Original issue: "e30 m l" should be "330ml"
  { input: 'Castel lite e30 m l', expected: 'Castel lite 330ml' },
  { input: 'e30 m l', expected: '330ml' },
  { input: 'e30ml', expected: '330ml' },
  
  // Other number-letter confusions
  { input: 's00 g', expected: '500g' },        // s → 5
  { input: 'l0 pc', expected: '10pc' },         // l → 1
  { input: 'o50 ml', expected: '050ml' },       // o → 0
  { input: 'B00 g', expected: '800g' },         // B → 8
  { input: 'b00 ml', expected: '600ml' },       // b → 6
  
  // Mixed patterns
  { input: '7s cl', expected: '75cl' },         // s → 5
  { input: 'le00 ml', expected: '1300ml' },     // l → 1, e → 3
  { input: 'soda e30 c l', expected: 'soda 330cl' },  // e → 3, c l → cl
  
  // Unit spacing
  { input: '330 m l', expected: '330ml' },
  { input: '500 g r', expected: '500gr' },
  { input: '2 5 cl', expected: '25cl' },
  
  // Product codes like "(e6)" which might be "(36)"
  { input: 'Item (e6)', expected: 'Item (36)' },
  // Note: standalone "s5" without unit is NOT changed to avoid false positives
  { input: 'Product code s5', expected: 'Product code s5' },
  
  // Should NOT change normal text
  { input: 'Orange juice', expected: 'Orange juice' },
  { input: 'Beer 330ml', expected: 'Beer 330ml' },  // Already correct
  { input: 'Sprite 1.5L', expected: 'Sprite 1.5L' }, // Already correct
  
  // Combined with spacing issues
  { input: 'S prite e30 m l', expected: 'Sprite 330ml' },
  { input: 'C oca C ola s00 ml', expected: 'Coca Cola 500ml' },
];

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected }) => {
  const result = fixOCRErrors(input);
  const status = result === expected ? '✅' : '❌';
  
  if (result === expected) {
    passed++;
    console.log(`${status} "${input}" → "${result}"`);
  } else {
    failed++;
    console.log(`${status} "${input}"`);
    console.log(`   Expected: "${expected}"`);
    console.log(`   Got:      "${result}"`);
  }
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
