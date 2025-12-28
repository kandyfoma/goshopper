/**
 * List all cities with cityItems data
 */
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listCities() {
  try {
    console.log('\n🔍 Listing all cities with cityItems data...\n');
    
    // Get all documents under cityItems
    const cityItemsRef = db.collection('artifacts/goshopper/cityItems');
    const snapshot = await cityItemsRef.listDocuments();
    
    console.log(`Found ${snapshot.length} cities:\n`);
    
    for (const cityDoc of snapshot) {
      const cityName = cityDoc.id;
      const itemsSnapshot = await cityDoc.collection('items').count().get();
      const itemCount = itemsSnapshot.data().count;
      
      console.log(`📍 ${cityName}: ${itemCount} items`);
      
      // Check if sprite exists in this city
      const spriteDoc = await cityDoc.collection('items').doc('sprite').get();
      if (spriteDoc.exists) {
        const data = spriteDoc.data();
        const stores = [...new Set((data.prices || []).map(p => p.storeName))];
        console.log(`   ✨ Has sprite! Stores: ${stores.join(', ')}`);
      }
    }
    
    console.log('\n✅ Complete\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

listCities();
