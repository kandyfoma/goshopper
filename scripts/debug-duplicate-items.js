/**
 * Debug Duplicate Items Script
 * Investigates why items appear twice in city database
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
    console.log('🔍 Investigating duplicate items in database...\n');

    // Get a test user ID (you can replace this)
    const userId = 'D7q15AKABWVUmpt7pTFh4VRc3Oc2'; // Replace with your user ID

    console.log(`1️⃣ Checking items for user: ${userId}`);
    
    const itemsSnapshot = await db
      .collection(`artifacts/${APP_ID}/users/${userId}/items`)
      .get();

    console.log(`   Found ${itemsSnapshot.size} items in personal collection\n`);

    // Group items by nameNormalized to find duplicates
    const itemsByNormalized = new Map();
    
    itemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const normalized = data.nameNormalized || 'unknown';
      
      if (!itemsByNormalized.has(normalized)) {
        itemsByNormalized.set(normalized, []);
      }
      
      itemsByNormalized.get(normalized).push({
        docId: doc.id,
        name: data.name,
        nameNormalized: normalized,
        priceCount: data.prices ? data.prices.length : 0,
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        currency: data.currency,
      });
    });

    // Find duplicates
    console.log('2️⃣ Looking for duplicate normalized names in personal items:\n');
    let foundDuplicates = false;
    
    for (const [normalized, items] of itemsByNormalized.entries()) {
      if (items.length > 1) {
        foundDuplicates = true;
        console.log(`   ⚠️ DUPLICATE: "${normalized}" has ${items.length} entries:`);
        items.forEach((item, i) => {
          console.log(`      ${i + 1}. Doc ID: ${item.docId}`);
          console.log(`         Display Name: "${item.name}"`);
          console.log(`         Normalized: "${item.nameNormalized}"`);
          console.log(`         Price Count: ${item.priceCount}`);
          console.log(`         Price Range: ${item.minPrice} - ${item.maxPrice} ${item.currency}`);
        });
        console.log('');
      }
    }

    if (!foundDuplicates) {
      console.log('   ✅ No duplicates found in personal items collection');
    }

    // Get user profile to find city
    const userDoc = await db
      .collection(`artifacts/${APP_ID}/users`)
      .doc(userId)
      .get();

    const userData = userDoc.data();
    const city = userData.defaultCity;

    if (city) {
      console.log(`\n3️⃣ Checking city items for: ${city}\n`);
      
      // Get all users in city
      const cityUsersSnapshot = await db
        .collection(`artifacts/${APP_ID}/users`)
        .where('defaultCity', '==', city)
        .get();

      console.log(`   Found ${cityUsersSnapshot.size} users in ${city}\n`);

      // Aggregate items from all users (same as getCityItems function)
      const cityItemsMap = new Map();

      for (const userDoc of cityUsersSnapshot.docs) {
        const uid = userDoc.id;
        const userItemsSnapshot = await db
          .collection(`artifacts/${APP_ID}/users/${uid}/items`)
          .get();

        userItemsSnapshot.docs.forEach(doc => {
          const itemData = doc.data();
          const itemName = itemData.nameNormalized;

          if (!itemName || !itemData.prices || !Array.isArray(itemData.prices)) {
            return;
          }

          if (!cityItemsMap.has(itemName)) {
            cityItemsMap.set(itemName, {
              id: itemName,
              name: itemData.name,
              displayNames: [itemData.name],
              users: [uid],
              prices: [],
            });
          }

          const cityItem = cityItemsMap.get(itemName);
          cityItem.prices.push(...itemData.prices.map(p => ({ ...p, userId: uid })));
          
          // Track different display names
          if (!cityItem.displayNames.includes(itemData.name)) {
            cityItem.displayNames.push(itemData.name);
          }
          
          // Track different users
          if (!cityItem.users.includes(uid)) {
            cityItem.users.push(uid);
          }
        });
      }

      console.log('4️⃣ Analyzing city aggregation results:\n');
      
      // Check for items with multiple display names
      let foundVariations = false;
      for (const [normalized, item] of cityItemsMap.entries()) {
        if (item.displayNames.length > 1) {
          foundVariations = true;
          console.log(`   📝 Item "${normalized}" has multiple display names:`);
          item.displayNames.forEach((name, i) => {
            console.log(`      ${i + 1}. "${name}"`);
          });
          console.log(`      Total prices: ${item.prices.length}`);
          console.log(`      Users: ${item.users.length}`);
          console.log('');
        }
      }

      if (!foundVariations) {
        console.log('   ✅ No variations found - all items have consistent display names');
      }

      // Show some examples
      console.log('\n5️⃣ Sample city items:\n');
      let count = 0;
      for (const [normalized, item] of cityItemsMap.entries()) {
        if (count < 5) {
          console.log(`   ${count + 1}. "${item.name}" (normalized: "${normalized}")`);
          console.log(`      Display names: [${item.displayNames.join(', ')}]`);
          console.log(`      Prices: ${item.prices.length} | Users: ${item.users.length}`);
          count++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Investigation complete!\n');

  } catch (error) {
    console.error('❌ Error during investigation:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
