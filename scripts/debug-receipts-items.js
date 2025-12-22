/**
 * Debug Receipts and Items Script
 * Checks receipts for items and whether aggregation is working
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
    console.log('🔍 Investigating receipts and items...\n');

    const userId = 'D7q15AKABWVUmpt7pTFh4VRc3Oc2'; // Replace with your user ID

    console.log(`1️⃣ Checking receipts for user: ${userId}\n`);
    
    const receiptsSnapshot = await db
      .collection(`artifacts/${APP_ID}/users/${userId}/receipts`)
      .orderBy('scannedAt', 'desc')
      .limit(10)
      .get();

    console.log(`   Found ${receiptsSnapshot.size} recent receipts\n`);

    receiptsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   ${index + 1}. Receipt: ${doc.id}`);
      console.log(`      Store: ${data.storeName || 'Unknown'}`);
      console.log(`      Date: ${data.scannedAt?.toDate?.() || data.date || 'N/A'}`);
      console.log(`      Total: ${data.totalUSD || data.totalCDF || 0}`);
      console.log(`      Items count: ${data.items ? data.items.length : 0}`);
      
      if (data.items && data.items.length > 0) {
        console.log(`      Sample items:`);
        data.items.slice(0, 3).forEach((item, i) => {
          console.log(`         ${i + 1}. "${item.name}" - ${item.unitPrice} ${item.currency}`);
        });
      }
      console.log('');
    });

    console.log('\n2️⃣ Checking items collection:\n');
    
    const itemsSnapshot = await db
      .collection(`artifacts/${APP_ID}/users/${userId}/items`)
      .get();

    console.log(`   Found ${itemsSnapshot.size} items\n`);

    if (itemsSnapshot.size > 0) {
      // Show all items with details
      itemsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   ${index + 1}. Item Doc ID: ${doc.id}`);
        console.log(`      Display Name: "${data.name}"`);
        console.log(`      Normalized: "${data.nameNormalized}"`);
        console.log(`      Price Count: ${data.prices ? data.prices.length : 0}`);
        console.log(`      Price Range: ${data.minPrice} - ${data.maxPrice} ${data.currency}`);
        
        if (data.prices && data.prices.length > 0) {
          console.log(`      Recent prices:`);
          data.prices.slice(0, 3).forEach((p, i) => {
            console.log(`         ${i + 1}. ${p.price} ${p.currency} at ${p.storeName} (Receipt: ${p.receiptId.substring(0, 8)}...)`);
          });
        }
        console.log('');
      });
    } else {
      console.log('   ⚠️ Items collection is EMPTY!');
      console.log('   This means the Cloud Function aggregateItemsOnReceipt is not running.');
      console.log('   Possible causes:');
      console.log('   - Cloud Function not deployed');
      console.log('   - Cloud Function failing (check Firebase Console logs)');
      console.log('   - Receipts were scanned before the function was deployed');
    }

    // Check if there are any items at all in the city
    const userDoc = await db
      .collection(`artifacts/${APP_ID}/users`)
      .doc(userId)
      .get();

    const userData = userDoc.data();
    const city = userData.defaultCity;

    if (city) {
      console.log(`\n3️⃣ Checking all items in ${city}:\n`);
      
      const cityUsersSnapshot = await db
        .collection(`artifacts/${APP_ID}/users`)
        .where('defaultCity', '==', city)
        .get();

      console.log(`   Found ${cityUsersSnapshot.size} users in ${city}\n`);

      let totalItems = 0;
      for (const userDoc of cityUsersSnapshot.docs) {
        const uid = userDoc.id;
        const userItemsSnapshot = await db
          .collection(`artifacts/${APP_ID}/users/${uid}/items`)
          .get();

        if (userItemsSnapshot.size > 0) {
          console.log(`   User ${uid}: ${userItemsSnapshot.size} items`);
          
          // Show first few items
          userItemsSnapshot.docs.slice(0, 3).forEach((doc, i) => {
            const data = doc.data();
            console.log(`      ${i + 1}. "${data.name}" (${data.nameNormalized})`);
          });
        }
        totalItems += userItemsSnapshot.size;
      }

      console.log(`\n   Total items in ${city}: ${totalItems}`);
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
