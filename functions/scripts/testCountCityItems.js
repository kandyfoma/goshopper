const admin = require('firebase-admin');

// Initialize Firebase Admin with explicit project ID
admin.initializeApp({
  projectId: 'goshopperai'
});

async function callCountCityItems() {
  try {
    // Create a fake auth context for testing
    const testContext = {
      auth: { uid: 'admin-test-user' }
    };
    
    // Import the function
    const { countCityItems } = require('../lib/admin/countCityItems');
    
    // Call the function
    const result = await countCityItems({}, testContext);
    
    console.log('=== CITY ITEMS COUNT ===');
    console.log('Total cities:', result.totalCities);
    console.log('Total items:', result.totalItems);
    console.log('\nTop cities by item count:');
    
    result.cityStats.slice(0, 15).forEach(({ city, count }) => {
      console.log(`  ${city}: ${count} items`);
    });
    
    if (result.cityStats.length > 15) {
      console.log(`  ... and ${result.cityStats.length - 15} more cities`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error calling countCityItems:', error);
    process.exit(1);
  }
}

callCountCityItems();