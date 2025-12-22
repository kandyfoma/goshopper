/**
 * Manually trigger items aggregation
 * Call rebuildItemsAggregation Cloud Function to rebuild items collection
 */

const admin = require('../functions/node_modules/firebase-admin');
const serviceAccount = require('../functions/serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const APP_ID = 'goshopper';

async function main() {
  try {
    console.log('🔨 Manually rebuilding items aggregation...\n');

    const userId = 'D7q15AKABWVUmpt7pTFh4VRc3Oc2';

    console.log(`1️⃣ Getting all receipts for user: ${userId}\n`);
    
    const receiptsSnapshot = await db
      .collection(`artifacts/${APP_ID}/users/${userId}/receipts`)
      .get();

    console.log(`   Found ${receiptsSnapshot.size} receipts\n`);

    console.log('2️⃣ Clearing existing items collection...\n');
    
    const itemsSnapshot = await db
      .collection(`artifacts/${APP_ID}/users/${userId}/items`)
      .get();

    if (itemsSnapshot.size > 0) {
      const batch = db.batch();
      itemsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`   Deleted ${itemsSnapshot.size} old items\n`);
    }

    console.log('3️⃣ Processing receipts and aggregating items...\n');

    // Process each receipt manually
    for (const receiptDoc of receiptsSnapshot.docs) {
      const receiptData = receiptDoc.data();
      const receiptId = receiptDoc.id;

      if (!receiptData.items || receiptData.items.length === 0) {
        console.log(`   Skipping ${receiptId} - no items`);
        continue;
      }

      console.log(`   Processing ${receiptId} - ${receiptData.items.length} items`);

      const items = receiptData.items;
      const storeName = receiptData.storeName || 'Inconnu';
      const currency = receiptData.currency || 'USD';
      const receiptDate = receiptData.scannedAt || receiptData.date || admin.firestore.Timestamp.now();

      for (const item of items) {
        if (!item.name || !item.unitPrice || item.unitPrice <= 0) {
          continue;
        }

        // Skip placeholder names
        const isPlaceholderName = item.name.toLowerCase().includes('unavailable name') || 
                                   item.name.toLowerCase() === 'unavailable' ||
                                   item.name.toLowerCase() === 'unavailable name';
        
        if (isPlaceholderName) {
          console.log(`      Skipping placeholder: ${item.name}`);
          continue;
        }

        // Normalize item name
        const itemNameNormalized = normalizeItemName(item.name);
        const canonicalName = getCanonicalName(itemNameNormalized);
        
        const itemRef = db.collection(`artifacts/${APP_ID}/users/${userId}/items`).doc(canonicalName);
        const itemDoc = await itemRef.get();

        const newPrice = {
          storeName,
          price: item.unitPrice,
          currency: item.currency || currency, // Use item currency or receipt currency
          date: receiptDate,
          receiptId,
        };

        if (itemDoc.exists) {
          // Update existing item
          const existingData = itemDoc.data();
          const updatedPrices = [newPrice, ...existingData.prices].slice(0, 50);

          const prices = updatedPrices.map(p => p.price);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          const storeCount = new Set(updatedPrices.map(p => p.storeName)).size;

          await itemRef.update({
            name: item.name,
            prices: updatedPrices,
            minPrice,
            maxPrice,
            avgPrice,
            storeCount,
            totalPurchases: updatedPrices.length,
            lastPurchaseDate: receiptDate,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          // Create new item
          await itemRef.set({
            id: canonicalName,
            name: item.name,
            nameNormalized: canonicalName,
            prices: [newPrice],
            minPrice: item.unitPrice,
            maxPrice: item.unitPrice,
            avgPrice: item.unitPrice,
            storeCount: 1,
            currency: item.currency || currency,
            totalPurchases: 1,
            lastPurchaseDate: receiptDate,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    console.log('\n4️⃣ Checking results...\n');
    
    const finalItemsSnapshot = await db
      .collection(`artifacts/${APP_ID}/users/${userId}/items`)
      .get();

    console.log(`   Created ${finalItemsSnapshot.size} items\n`);

    // Show sample items
    console.log('   Sample items:');
    finalItemsSnapshot.docs.slice(0, 5).forEach((doc, i) => {
      const data = doc.data();
      console.log(`      ${i + 1}. "${data.name}" (${data.nameNormalized})`);
      console.log(`         Prices: ${data.prices.length} | Range: ${data.minPrice}-${data.maxPrice} ${data.currency}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Aggregation complete!\n');

  } catch (error) {
    console.error('❌ Error during aggregation:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Helper functions (same as Cloud Function)
function normalizeItemName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCanonicalName(name) {
  const normalized = normalizeItemName(name);

  const synonyms = {
    'lait': ['milk', 'milch', 'leche'],
    'fromage': ['cheese', 'käse', 'queso'],
    'yaourt': ['yogurt', 'yoghurt', 'yogourt', 'yog', 'yo'],
    'creme': ['cream', 'crema'],
    'beurre': ['butter', 'mantequilla'],
    'oeuf': ['egg', 'eggs', 'huevo'],
    'pain': ['bread', 'baguette', 'pan'],
    'viande': ['meat', 'carne'],
    'poulet': ['chicken', 'pollo'],
    'boeuf': ['beef', 'carne de res'],
    'porc': ['pork', 'cerdo'],
    'poisson': ['fish', 'pescado'],
    'pomme': ['apple', 'apples', 'manzana'],
    'banane': ['banana', 'bananas', 'platano'],
    'orange': ['orange', 'oranges'],
    'tomate': ['tomato', 'tomatoes', 'jitomate'],
    'carotte': ['carrot', 'carrots', 'zanahoria'],
    'eau': ['water', 'agua'],
    'cafe': ['coffee', 'cafe'],
    'the': ['tea', 'te'],
    'biere': ['beer', 'cerveza'],
    'jus': ['juice', 'jugo'],
    'savon': ['soap', 'sav', 'savonnette'],
    'shampooing': ['shampoo', 'shamp', 'champoing'],
    'dentifrice': ['toothpaste', 'dent', 'pate dentifrice'],
  };

  for (const [canonical, variations] of Object.entries(synonyms)) {
    if (variations.some(v => normalized.includes(v) || v.includes(normalized))) {
      return canonical;
    }
  }

  return normalized;
}

main();
