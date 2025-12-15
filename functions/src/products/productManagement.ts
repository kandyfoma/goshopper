/**
 * Product Management Cloud Functions
 * Handles master product database and normalization
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

// @ts-expect-error - Interface defined for future use
interface MasterProduct {
  productId: string;
  normalizedName: string;
  category: string;
  unitOfMeasure?: string;
  commonNames: string[];
  languages: string[];
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// @ts-expect-error - Interface defined for future use
interface ProductMapping {
  productId: string;
  rawText: string;
  shopId?: string;
  confidence: number;
  source: 'ocr' | 'manual' | 'user_suggestion';
  createdAt: admin.firestore.Timestamp;
}

/**
 * Initialize master products database with common DRC products
 */
export const initializeMasterProducts = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    try {
      const batch = db.batch();

      // Common DRC products
      const masterProducts = [
        {
          productId: 'PROD_LAIT',
          normalizedName: 'Lait',
          category: 'Laitier',
          unitOfMeasure: 'litre',
          commonNames: ['lait', 'milk', 'milch'],
          languages: ['fr', 'en'],
        },
        {
          productId: 'PROD_FROMAGE',
          normalizedName: 'Fromage',
          category: 'Laitier',
          unitOfMeasure: 'kg',
          commonNames: ['fromage', 'cheese'],
          languages: ['fr', 'en'],
        },
        {
          productId: 'PROD_YAOURT',
          normalizedName: 'Yaourt',
          category: 'Laitier',
          unitOfMeasure: 'kg',
          commonNames: ['yaourt', 'yogurt', 'yoghurt', 'yog', 'yo'],
          languages: ['fr', 'en'],
        },
        {
          productId: 'PROD_PAIN',
          normalizedName: 'Pain',
          category: 'Boulangerie',
          unitOfMeasure: 'kg',
          commonNames: ['pain', 'bread', 'baguette'],
          languages: ['fr', 'en'],
        },
        {
          productId: 'PROD_BANANE',
          normalizedName: 'Banane',
          category: 'Fruits',
          unitOfMeasure: 'kg',
          commonNames: ['banane', 'banana', 'bananes', 'plantain'],
          languages: ['fr', 'en'],
        },
        {
          productId: 'PROD_SAVON',
          normalizedName: 'Savon',
          category: 'Hygiène',
          unitOfMeasure: 'pièce',
          commonNames: ['savon', 'soap', 'savonnette'],
          languages: ['fr', 'en'],
        },
        {
          productId: 'PROD_HUILE_PALME',
          normalizedName: 'Huile de Palme',
          category: 'Épicerie',
          unitOfMeasure: 'litre',
          commonNames: ['huile de palme', 'huile palme', 'huile rouge', 'red oil', 'palm oil'],
          languages: ['fr', 'en'],
        },
        {
          productId: 'PROD_FARINE_MAIS',
          normalizedName: 'Farine de Maïs',
          category: 'Épicerie',
          unitOfMeasure: 'kg',
          commonNames: ['farine de maïs', 'farine mais', 'farine', 'corn flour'],
          languages: ['fr', 'en'],
        },
      ];

      // Add master products
      for (const product of masterProducts) {
        const productRef = db.collection('masterProducts').doc(product.productId);
        batch.set(productRef, {
          ...product,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Add mappings for each common name
        for (const commonName of product.commonNames) {
          const mappingId = `${product.productId}_${commonName.replace(/\s+/g, '_')}`;
          const mappingRef = db.collection('productMappings').doc(mappingId);
          batch.set(mappingRef, {
            productId: product.productId,
            rawText: commonName,
            confidence: 1.0,
            source: 'manual',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      await batch.commit();

      return {
        success: true,
        message: `Initialized ${masterProducts.length} master products`,
      };
    } catch (error) {
      console.error('Error initializing master products:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to initialize master products',
      );
    }
  });

/**
 * Add a new product mapping from user suggestion
 */
export const addProductMapping = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    const { rawText, productId, shopId } = data;

    if (!rawText || !productId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'rawText and productId are required',
      );
    }

    try {
      // Check if mapping already exists
      const existingMapping = await db
        .collection('productMappings')
        .where('rawText', '==', rawText.toLowerCase())
        .where('productId', '==', productId)
        .get();

      if (!existingMapping.empty) {
        return {
          success: true,
          message: 'Mapping already exists',
        };
      }

      // Add new mapping
      const mappingId = `${productId}_${rawText.replace(/\s+/g, '_').toLowerCase()}`;
      await db.collection('productMappings').doc(mappingId).set({
        productId,
        rawText: rawText.toLowerCase(),
        shopId: shopId || null,
        confidence: 0.8, // Lower confidence for user suggestions
        source: 'user_suggestion',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: 'Product mapping added',
      };
    } catch (error) {
      console.error('Error adding product mapping:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to add product mapping',
      );
    }
  });

/**
 * Search master products with normalization
 */
export const searchMasterProducts = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated',
      );
    }

    const { query, limit = 10 } = data;

    if (!query || typeof query !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Query parameter is required and must be a string',
      );
    }

    try {
      // Clean and normalize the query
      const cleanQuery = query.toLowerCase().trim();

      // Search in product mappings first
      const mappingResults = await db
        .collection('productMappings')
        .where('rawText', '>=', cleanQuery)
        .where('rawText', '<=', cleanQuery + '\uf8ff')
        .limit(limit * 2)
        .get();

      const productIds = new Set<string>();
      const mappings: any[] = [];

      mappingResults.docs.forEach(doc => {
        const mapping = doc.data();
        productIds.add(mapping.productId);
        mappings.push(mapping);
      });

      // Get the actual products
      const productPromises = Array.from(productIds).map(productId =>
        db.collection('masterProducts').doc(productId).get()
      );

      const productDocs = await Promise.all(productPromises);
      const products = productDocs
        .filter(doc => doc.exists)
        .map(doc => ({ id: doc.id, ...doc.data() }));

      return {
        success: true,
        products,
        mappings: mappings.slice(0, limit),
      };
    } catch (error) {
      console.error('Error searching master products:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to search master products',
      );
    }
  });