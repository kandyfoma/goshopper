const admin = require('firebase-admin');
const {config} = require('../lib/config'); // Correct path to config

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'goshopperai' // Set project ID explicitly
  });
}

const db = admin.firestore();

async function countCityItems() {
  try {
    console.log('Counting city items...');
    console.log('Config app ID:', config.app.id);
    
    // Get all city collections
    const artifactsRef = db.collection(`artifacts/${config.app.id}/cityItems`);
    const citiesSnapshot = await artifactsRef.get();
    
    console.log(`Found ${citiesSnapshot.size} cities`);
    
    let totalItems = 0;
    const cityStats = {};
    
    // Count items in each city
    for (const cityDoc of citiesSnapshot.docs) {
      const cityName = cityDoc.id;
      const cityItemsRef = cityDoc.ref.collection('items');
      const itemsSnapshot = await cityItemsRef.get();
      
      const itemCount = itemsSnapshot.size;
      cityStats[cityName] = itemCount;
      totalItems += itemCount;
      
      console.log(`${cityName}: ${itemCount} items`);
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total cities: ${citiesSnapshot.size}`);
    console.log(`Total items across all cities: ${totalItems}`);
    
    console.log('\nItems by city (sorted by count):');
    Object.entries(cityStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([city, count]) => {
        console.log(`  ${city}: ${count} items`);
      });
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error counting city items:', error);
    process.exit(1);
  }
}

countCityItems();