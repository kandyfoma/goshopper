/**
 * Monthly Upgrade Proposal Notifications
 * Sends upgrade offers to Basic and Standard users on the 30th of each month
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();
const messaging = admin.messaging();

// Plan pricing (monthly in USD)
const PLAN_PRICES = {
  standard: 2.99,
  premium: 4.99,
};

/**
 * Send upgrade notification to Basic users
 */
async function sendBasicToStandardUpgrade(
  userId: string,
  fcmToken: string,
  language: string = 'fr',
): Promise<boolean> {
  try {
    const content =
      language === 'en'
        ? {
            title: '⭐ Upgrade to Standard Plan!',
            body: `Get Standard for $${PLAN_PRICES.standard}/month. More scans, priority support. Pay easily with Mobile Money. T&C apply.`,
          }
        : {
            title: '⭐ Passez au Plan Standard!',
            body: `Obtenez Standard à ${PLAN_PRICES.standard}$/mois. Plus de scans, support prioritaire. Paiement facile avec Mobile Money. Conditions générales applicables.`,
          };

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: content.title,
        body: content.body,
      },
      data: {
        type: 'upgrade_offer',
        fromPlan: 'basic',
        toPlan: 'standard',
        price: PLAN_PRICES.standard.toString(),
        route: 'Subscription',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'promotions',
          priority: 'high',
          icon: 'ic_notification',
          color: '#F59E0B',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    await messaging.send(message);
    console.log(`✅ Basic→Standard upgrade sent to user ${userId}`);

    // Log notification
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        type: 'upgrade_offer',
        title: content.title,
        body: content.body,
        fromPlan: 'basic',
        toPlan: 'standard',
        price: PLAN_PRICES.standard,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return true;
  } catch (error) {
    console.error(`Error sending upgrade to ${userId}:`, error);
    return false;
  }
}

/**
 * Send upgrade notification to Standard users
 */
async function sendStandardToPremiumUpgrade(
  userId: string,
  fcmToken: string,
  language: string = 'fr',
): Promise<boolean> {
  try {
    const content =
      language === 'en'
        ? {
            title: '🌟 Upgrade to Premium Plan!',
            body: `Get Premium for $${PLAN_PRICES.premium}/month. Unlimited scans, advanced analytics, priority support. Pay easily with Mobile Money. T&C apply.`,
          }
        : {
            title: '🌟 Passez au Plan Premium!',
            body: `Obtenez Premium à ${PLAN_PRICES.premium}$/mois. Scans illimités, analyses avancées, support prioritaire. Paiement facile avec Mobile Money. Conditions générales applicables.`,
          };

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: content.title,
        body: content.body,
      },
      data: {
        type: 'upgrade_offer',
        fromPlan: 'standard',
        toPlan: 'premium',
        price: PLAN_PRICES.premium.toString(),
        route: 'Subscription',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'promotions',
          priority: 'high',
          icon: 'ic_notification',
          color: '#8B5CF6',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    await messaging.send(message);
    console.log(`✅ Standard→Premium upgrade sent to user ${userId}`);

    // Log notification
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        type: 'upgrade_offer',
        title: content.title,
        body: content.body,
        fromPlan: 'standard',
        toPlan: 'premium',
        price: PLAN_PRICES.premium,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return true;
  } catch (error) {
    console.error(`Error sending upgrade to ${userId}:`, error);
    return false;
  }
}

/**
 * Scheduled function: Send monthly upgrade offers on the 30th
 * Runs on the 30th of each month at 10:00 AM
 */
export const sendMonthlyUpgradeOffers = functions
  .region(config.app.region)
  .pubsub.schedule('0 10 30 * *') // 10:00 AM on the 30th of every month
  .timeZone('Africa/Kinshasa')
  .onRun(async context => {
    console.log('🎯 Starting monthly upgrade offers job...');

    try {
      // Get all users with FCM tokens
      const usersSnapshot = await db
        .collectionGroup('profile')
        .where('fcmToken', '!=', null)
        .get();

      console.log(`Found ${usersSnapshot.size} users with FCM tokens`);

      let basicCount = 0;
      let standardCount = 0;
      let otherCount = 0;
      let sentCount = 0;
      let failedCount = 0;

      // Process each user
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Get subscription status
        const subscriptionDoc = await db
          .doc(
            `artifacts/${config.app.id}/users/${userId}/subscription/current`,
          )
          .get();

        if (!subscriptionDoc.exists) {
          otherCount++;
          continue;
        }

        const subscription = subscriptionDoc.data();
        const planId = subscription?.planId;
        const expiresAt = subscription?.expiresAt?.toMillis();

        // Check if subscription is active
        if (
          !planId ||
          subscription?.status !== 'active' ||
          !expiresAt ||
          expiresAt < Date.now()
        ) {
          otherCount++;
          continue;
        }

        let success = false;

        // Send appropriate upgrade based on current plan
        if (planId === 'basic') {
          basicCount++;
          success = await sendBasicToStandardUpgrade(
            userId,
            userData.fcmToken,
            userData.language || 'fr',
          );
        } else if (planId === 'standard') {
          standardCount++;
          success = await sendStandardToPremiumUpgrade(
            userId,
            userData.fcmToken,
            userData.language || 'fr',
          );
        } else {
          // Free, essai, trial, or premium users don't get these offers
          otherCount++;
          continue;
        }

        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      console.log(
        `📊 Plan distribution: Basic=${basicCount}, Standard=${standardCount}, Other=${otherCount}`,
      );
      console.log(
        `✅ Monthly upgrade offers completed: ${sentCount} sent, ${failedCount} failed`,
      );

      return {
        success: true,
        basicUsers: basicCount,
        standardUsers: standardCount,
        notificationsSent: sentCount,
        notificationsFailed: failedCount,
      };
    } catch (error) {
      console.error('Error in monthly upgrade offers job:', error);
      throw error;
    }
  });

/**
 * Manual trigger for testing upgrade offers
 */
export const sendUpgradeOfferToUser = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated',
      );
    }

    const userId = data.userId || context.auth.uid;

    // Get user data
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}/profile`)
      .get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    if (!userData?.fcmToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User does not have FCM token',
      );
    }

    // Get subscription
    const subscriptionDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}/subscription/current`)
      .get();

    if (!subscriptionDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'No subscription found',
      );
    }

    const subscription = subscriptionDoc.data();
    const planId = subscription?.planId;

    let success = false;
    let targetPlan = '';

    if (planId === 'basic') {
      success = await sendBasicToStandardUpgrade(
        userId,
        userData.fcmToken,
        userData.language || 'fr',
      );
      targetPlan = 'standard';
    } else if (planId === 'standard') {
      success = await sendStandardToPremiumUpgrade(
        userId,
        userData.fcmToken,
        userData.language || 'fr',
      );
      targetPlan = 'premium';
    } else {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot send upgrade offer for plan: ${planId}`,
      );
    }

    return {
      success,
      userId,
      currentPlan: planId,
      targetPlan,
    };
  });
