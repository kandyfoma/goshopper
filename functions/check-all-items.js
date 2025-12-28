/**
 * List all items in a city and check user's personal items
 */
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkItems() {
  try {
    const city = 'Lubumbashi';
    
    console.log(`\n🔍 Checking items for city: ${city}\n`);
    
    // Get all cityItems
    const cityItemsSnapshot = await db
      .collection('artifacts/goshopper/cityItems')
      .doc(city)
      .collection('items')
      .get();
    
    console.log('📦 CityItems:\n');
    cityItemsSnapshot.forEach(doc => {
      const data = doc.data();
      const stores = [...new Set((data.prices || []).map(p => p.storeName))];
      console.log(`   ${doc.id}: "${data.name}" - Stores: ${stores.join(', ')}`);
    });
    
    // Now check user's personal items
    console.log('\n\n👤 Checking user personal items...\n');
    
    // Get all users
    const usersSnapshot = await db
      .collection('artifacts/goshopper/users')
      .limit(10)
      .get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const itemsSnapshot = await db
        .collection(`artifacts/goshopper/users/${userId}/items`)
        .get();
      
      if (!itemsSnapshot.empty) {
        console.log(`\n👤 User: ${userId.substring(0, 12)}... (${itemsSnapshot.size} items)`);
        
        itemsSnapshot.docs.forEach(itemDoc => {
          const data = itemDoc.data();
          const stores = [...new Set((data.prices || []).map(p => p.storeName))];
          console.log(`   ${itemDoc.id}: "${data.name}" - Stores: ${stores.join(', ')}`);
        });
      }
    }
    
    console.log('\n✅ Complete\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkItems();
