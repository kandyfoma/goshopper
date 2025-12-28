/**
 * Test the spell checker OCR fix
 */

// Import the compiled spell checker
const { fixOCRErrors, initializeSpellChecker } = require('./lib/utils/spellChecker');

async function test() {
  await initializeSpellChecker();
  
  console.log('\n🧪 Testing OCR Spell Checker\n');
  console.log('='.repeat(70));
  
  const testCases = [
    // Original issue - spacing errors
    { input: 'S prite', expected: 'Sprite' },
    { input: 'C oca C ola', expected: 'Coca Cola' },
    { input: 'F anta', expected: 'Fanta' },
    { input: 'H eineken', expected: 'Heineken' },
    { input: 'Virgin Mojito', expected: 'Virgin Mojito' },
    
    // Multiple spacing issues
    { input: 'Y o g u r t', expected: 'Yogurt' },
    { input: 'B i s c u i t', expected: 'Biscuit' },
    
    // Real items from receipts
    { input: 'Castel lite e30 m l', expected: 'Castel lite e30 m l' }, // Should stay mostly the same
    { input: 'B ag a lilac xl', expected: 'bag a lilac xl' }, // Should combine bag
    { input: 'BAG ALILAC XL', expected: 'BAG ALILAC XL' }, // Already correct
    
    // Complex cases
    { input: 'B oni s election s paghetti g', expected: 'boni selection spaghetti g' },
    { input: 'S ucre blanc poudre kin ma', expected: 'Sucre blanc poudre kin ma' },
    
    // Should not change
    { input: 'Coca Cola', expected: 'Coca Cola' },
    { input: 'Sprite 330ml', expected: 'Sprite 330ml' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const result = fixOCRErrors(test.input);
    const success = result.toLowerCase() === test.expected.toLowerCase();
    
    if (success) {
      passed++;
      console.log(`\n✅ PASS: "${test.input}"`);
    } else {
      failed++;
      console.log(`\n❌ FAIL: "${test.input}"`);
    }
    console.log(`   Input:    "${test.input}"`);
    console.log(`   Result:   "${result}"`);
    console.log(`   Expected: "${test.expected}"`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
}

test().catch(console.error);
