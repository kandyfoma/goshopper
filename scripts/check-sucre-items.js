/**
 * Diagnostic Script: Check how "Sucre" items are stored in Firebase
 * 
 * This script queries the city items collection to see if items with different
 * sizes are being stored separately or grouped together.
 * 
 * Run from project root: node scripts/check-sucre-items.js
 * Or from functions: cd functions && node ../scripts/check-sucre-items.js
 */

// Try to load from functions node_modules or current directory
let admin;
try {
  admin = require('../functions/node_modules/firebase-admin');
} catch (e) {
  admin = require('firebase-admin');
}

const path = require('path');
const fs = require('fs');

// Find credentials.json - should be in project root
const credentialsPath = path.join(__dirname, '..', 'credentials.json');

if (!fs.existsSync(credentialsPath)) {
  console.error('❌ Could not find credentials.json at:', credentialsPath);
  process.exit(1);
}

console.log('📁 Using credentials from:', credentialsPath);
const serviceAccount = require(credentialsPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkSucreItems() {
  console.log('🔍 Checking how "Sucre" items are stored in database...\n');

  // Configuration
  const appId = 'goshopper';
  const cities = ['Kinshasa', 'Lubumbashi', 'Goma', 'Bukavu']; // Add your cities

  for (const city of cities) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 City: ${city}`);
    console.log('='.repeat(60));

    const cityItemsPath = `artifacts/${appId}/cityItems/${city}/items`;
    
    try {
      // Query for all items that contain "sucre" in their document ID
      const snapshot = await db.collection(cityItemsPath)
        .where(admin.firestore.FieldPath.documentId(), '>=', 'sucre')
        .where(admin.firestore.FieldPath.documentId(), '<', 'sucrf') // Next letter after 'sucre'
        .get();

      if (snapshot.empty) {
        console.log(`  ❌ No "sucre" items found in ${city}`);
        continue;
      }

      console.log(`  ✅ Found ${snapshot.size} "sucre" item(s)\n`);

      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  📦 Document ID: "${doc.id}"`);
        console.log(`     Display Name: "${data.name || 'N/A'}"`);
        console.log(`     Normalized Name: "${data.nameNormalized || 'N/A'}"`);
        console.log(`     Price Range: ${data.minPrice} - ${data.maxPrice} ${data.currency}`);
        console.log(`     Store Count: ${data.storeCount || 0}`);
        console.log(`     Total Prices: ${data.prices?.length || 0}`);
        
        // Show sample of original names from different stores
        if (data.prices && data.prices.length > 0) {
          console.log(`     Original Names:`);
          const uniqueOriginalNames = [...new Set(data.prices.map(p => p.originalName))];
          uniqueOriginalNames.slice(0, 5).forEach(name => {
            console.log(`       - "${name}"`);
          });
          if (uniqueOriginalNames.length > 5) {
            console.log(`       ... and ${uniqueOriginalNames.length - 5} more variations`);
          }
        }
        console.log('');
      });

    } catch (error) {
      console.error(`  ❌ Error querying ${city}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔍 Diagnosis Complete!');
  console.log('='.repeat(60));
  console.log('\n📋 What to look for:');
  console.log('  ✅ CORRECT: Separate document IDs like "sucre_1kg" and "sucre_5kg"');
  console.log('  ❌ PROBLEM: Single document ID "sucre" with mixed sizes in originalName');
  console.log('  ℹ️  Original Names show what was actually on receipts');
  console.log('');
}

// Run the diagnostic
checkSucreItems()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
