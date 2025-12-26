/**
 * Welcome Notifications for New Users
 * Sends welcome messages and upgrade proposals to new users
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Send welcome notification immediately after registration
 * Called from completeRegistration function
 */
export async function sendWelcomeNotification(
  userId: string,
  fcmToken: string,
  language: string = 'fr',
): Promise<boolean> {
  try {
    const content =
      language === 'en'
        ? {
            title: '🎉 Welcome to GoShopper!',
            body: 'Start scanning receipts to track your spending and save money!',
          }
        : {
            title: '🎉 Bienvenue sur GoShopper!',
            body: 'Commencez à scanner vos reçus pour suivre vos dépenses et économiser!',
          };

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: content.title,
        body: content.body,
      },
      data: {
        type: 'welcome',
        route: 'Home',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'general',
          priority: 'high',
          icon: 'ic_notification',
          color: '#6366F1',
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
    console.log(`✅ Welcome notification sent to user ${userId}`);

    // Log notification
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        type: 'welcome',
        title: content.title,
        body: content.body,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return true;
  } catch (error) {
    console.error(`Error sending welcome notification to ${userId}:`, error);
    return false;
  }
}

/**
 * Send trial plan notification
 */
export async function sendTrialPlanNotification(
  userId: string,
  fcmToken: string,
  language: string = 'fr',
): Promise<boolean> {
  try {
    const content =
      language === 'en'
        ? {
            title: '🎁 Free Trial Activated!',
            body: 'You received a 7-day Essai plan as a welcome gift. Enjoy unlimited features!',
          }
        : {
            title: '🎁 Essai Gratuit Activé!',
            body: "Vous avez reçu 7 jours d'Essai gratuit en cadeau de bienvenue. Profitez de toutes les fonctionnalités!",
          };

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: content.title,
        body: content.body,
      },
      data: {
        type: 'trial_activated',
        route: 'Subscription',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'subscription',
          priority: 'high',
          icon: 'ic_notification',
          color: '#10B981',
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
    console.log(`✅ Trial plan notification sent to user ${userId}`);

    // Log notification
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        type: 'trial_activated',
        title: content.title,
        body: content.body,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return true;
  } catch (error) {
    console.error(`Error sending trial notification to ${userId}:`, error);
    return false;
  }
}

/**
 * Send upgrade proposal notification (after 2 days)
 */
export async function sendUpgradeProposalNotification(
  userId: string,
  fcmToken: string,
  language: string = 'fr',
): Promise<boolean> {
  try {
    const content =
      language === 'en'
        ? {
            title: '⭐ Special Offer: Upgrade to Standard!',
            body: 'Get Standard plan for only $1.99! More scans, priority support, and advanced features.',
          }
        : {
            title: '⭐ Offre Spéciale: Passez à Standard!',
            body: "Plan Standard à seulement 1,99$! Plus de scans, support prioritaire et fonctionnalités avancées.",
          };

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: content.title,
        body: content.body,
      },
      data: {
        type: 'upgrade_proposal',
        planId: 'standard',
        specialPrice: '1.99',
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
    console.log(`✅ Upgrade proposal sent to user ${userId}`);

    // Log notification
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        type: 'upgrade_proposal',
        title: content.title,
        body: content.body,
        planId: 'standard',
        specialPrice: '1.99',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return true;
  } catch (error) {
    console.error(`Error sending upgrade proposal to ${userId}:`, error);
    return false;
  }
}

/**
 * Scheduled function: Check users registered 2 days ago and send upgrade proposals
 * Runs daily at 11:00 AM
 */
export const sendUpgradeProposals = functions
  .region(config.app.region)
  .pubsub.schedule('0 11 * * *')
  .timeZone('Africa/Kinshasa')
  .onRun(async context => {
    console.log('🔍 Checking for users eligible for upgrade proposals...');

    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0); // Start of day

      const twoDaysAgoEnd = new Date(twoDaysAgo);
      twoDaysAgoEnd.setHours(23, 59, 59, 999); // End of day

      // Find users registered exactly 2 days ago who haven't received the proposal yet
      const usersSnapshot = await db
        .collectionGroup('profile')
        .where('registrationDate', '>=', admin.firestore.Timestamp.fromDate(twoDaysAgo))
        .where('registrationDate', '<=', admin.firestore.Timestamp.fromDate(twoDaysAgoEnd))
        .where('upgradeProposalSent', '==', false)
        .get();

      console.log(`Found ${usersSnapshot.size} users registered 2 days ago`);

      let sentCount = 0;
      let skippedCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Check if user still has FCM token
        if (!userData.fcmToken) {
          console.log(`Skipping user ${userId}: No FCM token`);
          skippedCount++;
          continue;
        }

        // Check subscription status - only send if still on trial/essai
        const subscriptionDoc = await db
          .doc(`artifacts/${config.app.id}/users/${userId}/subscription/current`)
          .get();

        if (!subscriptionDoc.exists) {
          console.log(`Skipping user ${userId}: No subscription document`);
          skippedCount++;
          continue;
        }

        const subscription = subscriptionDoc.data();

        // Only send if user is on essai/trial plan
        if (subscription?.planId !== 'essai' && subscription?.planId !== 'trial') {
          console.log(`Skipping user ${userId}: Already upgraded (${subscription?.planId})`);
          skippedCount++;
          
          // Mark as sent to avoid checking again
          await userDoc.ref.set({upgradeProposalSent: true}, {merge: true});
          continue;
        }

        // Check if subscription is still active
        const expiresAt = subscription.expiresAt?.toMillis();
        if (!expiresAt || expiresAt < Date.now()) {
          console.log(`Skipping user ${userId}: Trial expired`);
          skippedCount++;
          continue;
        }

        // Send upgrade proposal
        const success = await sendUpgradeProposalNotification(
          userId,
          userData.fcmToken,
          userData.language || 'fr',
        );

        if (success) {
          // Mark as sent
          await userDoc.ref.set({upgradeProposalSent: true}, {merge: true});
          sentCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(
        `✅ Upgrade proposal job completed: ${sentCount} sent, ${skippedCount} skipped`,
      );

      return {
        success: true,
        proposalsSent: sentCount,
        skipped: skippedCount,
      };
    } catch (error) {
      console.error('Error in upgrade proposals job:', error);
      throw error;
    }
  });

/**
 * Manual trigger for sending upgrade proposal (testing)
 */
export const sendUpgradeProposalToUser = functions
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

    const success = await sendUpgradeProposalNotification(
      userId,
      userData.fcmToken,
      userData.language || 'fr',
    );

    return {
      success,
      userId,
    };
  });
