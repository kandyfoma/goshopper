/**
 * Scan Pack Purchase Handler
 * Allows users to buy additional scan packs when they run out
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {collections} from '../config';

const db = admin.firestore();

export interface ScanPackPurchase {
  packId: 'small' | 'medium' | 'large';
  scans: number;
  amount: number;
  currency: string;
  transactionId: string;
  phoneNumber: string;
}

const SCAN_PACKS = {
  small: {scans: 5, price: 0.49, priceCDF: 2000},
  medium: {scans: 10, price: 0.99, priceCDF: 4000},
  large: {scans: 25, price: 1.99, priceCDF: 8000},
};

/**
 * Purchase scan pack from Railway Payment Hub
 * Called after payment is confirmed
 */
export const purchaseScanPack = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    console.log('📦 purchaseScanPack called');
    console.log('🔐 Auth context:', context.auth ? `User: ${context.auth.uid}` : 'NOT AUTHENTICATED');

    // Verify user is authenticated
    if (!context.auth) {
      console.error('❌ No auth context provided');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;
    const {packId, transactionId, amount, phoneNumber, currency = 'USD'} = data;

    if (!packId || !transactionId || !amount || !phoneNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: packId, transactionId, amount, phoneNumber'
      );
    }

    // Validate pack ID
    if (!['small', 'medium', 'large'].includes(packId)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid pack ID. Must be "small", "medium", or "large"'
      );
    }

    const pack = SCAN_PACKS[packId as keyof typeof SCAN_PACKS];

    try {
      console.log(`🎯 Adding ${pack.scans} bonus scans for user ${userId}`);

      const now = new Date();
      const subscriptionRef = db.doc(collections.subscription(userId));

      // Add bonus scans atomically
      await db.runTransaction(async (transaction) => {
        const subscriptionDoc = await transaction.get(subscriptionRef);
        
        if (!subscriptionDoc.exists) {
          throw new functions.https.HttpsError(
            'not-found',
            'Subscription not found. Please complete onboarding.'
          );
        }

        const currentBonusScans = subscriptionDoc.data()?.bonusScans || 0;
        const newBonusScans = currentBonusScans + pack.scans;

        transaction.update(subscriptionRef, {
          bonusScans: newBonusScans,
          lastScanPackPurchase: {
            packId,
            scans: pack.scans,
            amount,
            transactionId,
            purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Bonus scans updated: ${currentBonusScans} → ${newBonusScans}`);
      });

      // Store payment record
      const paymentRef = db.collection('scanPackPurchases').doc(transactionId);
      await paymentRef.set({
        userId,
        packId,
        scans: pack.scans,
        amount,
        currency,
        phoneNumber,
        transactionId,
        provider: 'freshpay',
        status: 'completed',
        completedAt: admin.firestore.Timestamp.fromDate(now),
        createdAt: admin.firestore.Timestamp.fromDate(now),
      });

      console.log(`✅ Scan pack purchased successfully for user ${userId}`);

      return {
        success: true,
        message: `${pack.scans} scans ajoutés avec succès!`,
        packId,
        scans: pack.scans,
        transactionId,
      };
    } catch (error: any) {
      console.error('Scan pack purchase error:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to purchase scan pack'
      );
    }
  });
