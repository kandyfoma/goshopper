import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

export const countCityItems = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    try {
      console.log('Counting city items...');
      console.log('Config app ID:', config.app.id);
      
      // Get all city collections
      const artifactsRef = db.collection(`artifacts/${config.app.id}/cityItems`);
      const citiesSnapshot = await artifactsRef.get();
      
      console.log(`Found ${citiesSnapshot.size} cities`);
      
      let totalItems = 0;
      const cityStats: Record<string, number> = {};
      
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
      
      // Sort cities by item count
      const sortedCities = Object.entries(cityStats)
        .sort((a, b) => b[1] - a[1]);
      
      return {
        success: true,
        totalCities: citiesSnapshot.size,
        totalItems,
        cityStats: sortedCities.map(([city, count]) => ({ city, count })),
        summary: {
          totalCities: citiesSnapshot.size,
          totalItems,
          topCities: sortedCities.slice(0, 10)
        }
      };
      
    } catch (error) {
      console.error('Error counting city items:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Error counting city items',
        error
      );
    }
  });