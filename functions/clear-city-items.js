/**
 * Script to delete all cityItems from Firestore
 * Run with: cd functions && node clear-city-items.js
 * 
 * This will delete ALL documents in all city collections under cityItems/
 * Use with caution!
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

try {
  // Check if already initialized
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath)),
    });
  }
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('\nMake sure you have serviceAccountKey.json in the functions/ folder');
  console.log('Download it from: Firebase Console > Project Settings > Service Accounts > Generate New Private Key');
  process.exit(1);
}

const db = admin.firestore();

// Known cities in DRC
const CITIES = [
  'Kinshasa',
  'Lubumbashi', 
  'Mbuji-Mayi',
  'Kananga',
  'Kisangani',
  'Bukavu',
  'Goma',
  'Kolwezi',
  'Likasi',
  'Tshikapa',
];

async function deleteCollection(collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);
  
  let totalDeleted = 0;
  
  while (true) {
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      break;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`  Deleted ${totalDeleted} documents from ${collectionPath}...`);
    
    // Small delay to avoid overwhelming Firestore
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return totalDeleted;
}

async function clearAllCityItems() {
  console.log('\n🗑️  Starting cityItems cleanup...\n');
  console.log('=' .repeat(50));
  
  let grandTotal = 0;
  
  for (const city of CITIES) {
    console.log(`\n📍 Processing city: ${city}`);
    
    // Delete items subcollection
    const itemsPath = `cityItems/${city}/items`;
    try {
      const deleted = await deleteCollection(itemsPath);
      grandTotal += deleted;
      
      if (deleted > 0) {
        console.log(`  ✅ Deleted ${deleted} items from ${city}`);
      } else {
        console.log(`  ⚪ No items found in ${city}`);
      }
    } catch (error) {
      console.error(`  ❌ Error deleting from ${city}:`, error.message);
    }
  }
  
  // Also check for any other cities that might exist
  console.log('\n🔍 Checking for other city collections...');
  try {
    const cityItemsRef = db.collection('cityItems');
    const cityDocs = await cityItemsRef.listDocuments();
    
    for (const cityDoc of cityDocs) {
      const cityName = cityDoc.id;
      if (!CITIES.includes(cityName)) {
        console.log(`\n📍 Found additional city: ${cityName}`);
        const itemsPath = `cityItems/${cityName}/items`;
        const deleted = await deleteCollection(itemsPath);
        grandTotal += deleted;
        console.log(`  ✅ Deleted ${deleted} items from ${cityName}`);
      }
    }
  } catch (error) {
    console.error('Error checking additional cities:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`\n✅ CLEANUP COMPLETE!`);
  console.log(`📊 Total documents deleted: ${grandTotal}`);
  console.log('\nYou can now scan new receipts to rebuild the cityItems with clean data.\n');
}

// Confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n⚠️  WARNING: This will DELETE ALL cityItems data!');
console.log('This action cannot be undone.\n');

rl.question('Type "DELETE" to confirm: ', async (answer) => {
  if (answer === 'DELETE') {
    await clearAllCityItems();
  } else {
    console.log('\n❌ Aborted. No data was deleted.\n');
  }
  rl.close();
  process.exit(0);
});
