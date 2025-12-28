/**
 * Check sprite cityItem to see what items are being incorrectly matched
 */
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkSpriteCityItem() {
  try {
    const city = process.argv[2] || 'Kinshasa'; // Default to Kinshasa or pass city as argument
    
    console.log(`\n🔍 Checking sprite cityItem for city: ${city}\n`);
    
    // Query the sprite document in cityItems
    const spriteDoc = await db
      .collection('artifacts/goshopper/cityItems')
      .doc(city)
      .collection('items')
      .doc('sprite')
      .get();
    
    if (!spriteDoc.exists) {
      console.log('❌ No sprite document found in cityItems');
      return;
    }
    
    const data = spriteDoc.data();
    
    console.log('📦 Sprite Document Data:');
    console.log('Name:', data.name);
    console.log('Name Normalized:', data.nameNormalized);
    console.log('Category:', data.category);
    console.log('Search Keywords:', data.searchKeywords);
    console.log('\n💰 Prices from different stores:\n');
    
    // Group prices by store
    const pricesByStore = {};
    
    for (const price of data.prices || []) {
      const store = price.storeName;
      if (!pricesByStore[store]) {
        pricesByStore[store] = [];
      }
      pricesByStore[store].push({
        price: price.price,
        currency: price.currency,
        date: price.date?.toDate ? price.date.toDate() : price.date,
        userId: price.userId,
        receiptId: price.receiptId
      });
    }
    
    // Display prices grouped by store
    for (const [store, prices] of Object.entries(pricesByStore)) {
      console.log(`\n🏪 Store: ${store}`);
      console.log(`   Entries: ${prices.length}`);
      prices.slice(0, 3).forEach((p, i) => {
        console.log(`   [${i+1}] ${p.price} ${p.currency} - User: ${p.userId.substring(0, 8)}... - Receipt: ${p.receiptId.substring(0, 8)}...`);
      });
      if (prices.length > 3) {
        console.log(`   ... and ${prices.length - 3} more`);
      }
    }
    
    console.log('\n\n🔍 Now checking user items to find original names...\n');
    
    // For each unique userId, check their personal items collection to see what they called "sprite"
    const userIds = [...new Set((data.prices || []).map(p => p.userId))];
    
    for (const userId of userIds.slice(0, 5)) { // Check first 5 users
      try {
        const userItemDoc = await db
          .collection('artifacts/goshopper/users')
          .doc(userId)
          .collection('items')
          .doc('sprite')
          .get();
        
        if (userItemDoc.exists) {
          const userData = userItemDoc.data();
          console.log(`\n👤 User ${userId.substring(0, 8)}...`);
          console.log(`   Original Name: "${userData.name}"`);
          console.log(`   Normalized: "${userData.nameNormalized}"`);
          console.log(`   Stores: ${userData.prices.map(p => p.storeName).join(', ')}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Could not fetch user item: ${err.message}`);
      }
    }
    
    console.log('\n✅ Check complete\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSpriteCityItem();
