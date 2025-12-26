/**
 * General Notifications Cloud Functions
 * Handles savings tips, achievements, sync notifications, and admin broadcasts
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {config, collections} from '../config';

const db = admin.firestore();
const messaging = admin.messaging();

// Initialize Gemini for savings tips
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Send weekly savings tips to all users
 * Runs every Saturday at 10:00 AM
 */
export const sendWeeklySavingsTips = functions
  .region(config.app.region)
  .pubsub.schedule('0 10 * * 6')
  .timeZone('Africa/Kinshasa')
  .onRun(async context => {
    console.log('Sending weekly savings tips...');

    try {
      // Get all users with FCM tokens
      const usersSnapshot = await db.collectionGroup('users').get();
      const usersWithTokens: Array<{
        userId: string;
        fcmToken: string;
        language: string;
      }> = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.fcmToken) {
          usersWithTokens.push({
            userId: userDoc.id,
            fcmToken: userData.fcmToken,
            language: userData.language || 'fr', // Default to French
          });
        }
      }

      console.log(`Found ${usersWithTokens.length} users with FCM tokens`);

      // Send personalized tips to each user
      for (const user of usersWithTokens) {
        try {
          const tip = await generateSavingsTip(user.userId, user.language);
          await sendSavingsTipNotification(user.fcmToken, tip, user.language, user.userId);
          console.log(`Sent savings tip to user ${user.userId}`);
        } catch (error) {
          console.error(`Failed to send tip to user ${user.userId}:`, error);
        }
      }

      console.log('Weekly savings tips sent successfully');
      return null;
    } catch (error) {
      console.error('Weekly savings tips error:', error);
      return null;
    }
  });

/**
 * Send achievement unlocked notification
 */
export const sendAchievementNotification = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const {achievementId, achievementTitle, language = 'fr'} = data;

    if (!achievementId || !achievementTitle) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Achievement ID and title are required',
      );
    }

    const userId = context.auth.uid;

    try {
      // Get user's FCM token
      const userDoc = await db
        .doc(`artifacts/${config.app.id}/users/${userId}`)
        .get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (!fcmToken) {
        console.log(`No FCM token for user ${userId}`);
        return {success: false, message: 'No FCM token available'};
      }

      await sendAchievementNotificationToUser(
        fcmToken,
        achievementTitle,
        language,
        userId,
      );

      return {success: true, message: 'Achievement notification sent'};
    } catch (error) {
      console.error('Send achievement notification error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send achievement notification',
      );
    }
  });

/**
 * Send sync complete notification
 */
export const sendSyncCompleteNotification = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const {syncedCount, language = 'fr'} = data;
    const userId = context.auth.uid;

    try {
      // Get user's FCM token
      const userDoc = await db
        .doc(`artifacts/${config.app.id}/users/${userId}`)
        .get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (!fcmToken) {
        console.log(`No FCM token for user ${userId}`);
        return {success: false, message: 'No FCM token available'};
      }

      await sendSyncCompleteNotificationToUser(fcmToken, syncedCount, language, userId);

      return {success: true, message: 'Sync complete notification sent'};
    } catch (error) {
      console.error('Send sync notification error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send sync notification',
      );
    }
  });

/**
 * Admin function to send broadcast notifications to all users
 */
export const sendAdminBroadcast = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // TODO: Add admin authentication check
    // For now, this is a placeholder - in production you'd verify admin privileges

    const {title, body, data: notificationData, targetUsers} = data;

    if (!title || !body) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Title and body are required',
      );
    }

    try {
      let usersQuery = db.collectionGroup('users');

      // If specific users targeted, filter by user IDs
      if (targetUsers && Array.isArray(targetUsers)) {
        // For specific users, we need to get each user's FCM token individually
        const notifications = [];

        for (const userId of targetUsers) {
          const userDoc = await db
            .doc(`artifacts/${config.app.id}/users/${userId}`)
            .get();
          const fcmToken = userDoc.data()?.fcmToken;

          if (fcmToken) {
            notifications.push({
              token: fcmToken,
              notification: {
                title,
                body,
              },
              data: notificationData || {},
              android: {
                priority: 'high' as const,
                notification: {
                  channelId: 'admin_broadcast',
                  icon: 'ic_notification',
                  color: '#10b981',
                },
              },
              apns: {
                payload: {
                  aps: {
                    badge: 1,
                    sound: 'default',
                  },
                },
              },
            });
          }
        }

        if (notifications.length > 0) {
          const response = await messaging.sendAll(notifications);
          console.log(`Admin broadcast sent to ${response.successCount} users`);
        }

        return {
          success: true,
          sentCount: notifications.length,
          message: `Broadcast sent to ${notifications.length} users`,
        };
      }

      // Send to all users with FCM tokens
      const usersSnapshot = await usersQuery.get();
      const notifications = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.fcmToken) {
          notifications.push({
            token: userData.fcmToken,
            notification: {
              title,
              body,
            },
            data: {
              type: 'admin_broadcast',
              ...notificationData,
            },
            android: {
              priority: 'high' as const,
              notification: {
                channelId: 'admin_broadcast',
                icon: 'ic_notification',
                color: '#10b981',
              },
            },
            apns: {
              payload: {
                aps: {
                  badge: 1,
                  sound: 'default',
                },
              },
            },
          });
        }
      }

      if (notifications.length === 0) {
        return {success: false, message: 'No users with FCM tokens found'};
      }

      // Send in batches of 500 (FCM limit)
      const batchSize = 500;
      let totalSent = 0;

      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const response = await messaging.sendAll(batch);
        totalSent += response.successCount;
        console.log(
          `Batch ${Math.floor(i / batchSize) + 1}: ${
            response.successCount
          } sent, ${response.failureCount} failed`,
        );
      }

      return {
        success: true,
        sentCount: totalSent,
        totalUsers: notifications.length,
        message: `Broadcast sent to ${totalSent} out of ${notifications.length} users`,
      };
    } catch (error) {
      console.error('Admin broadcast error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send admin broadcast',
      );
    }
  });

/**
 * Generate personalized savings tip using AI
 */
async function generateSavingsTip(
  userId: string,
  language: string = 'fr',
): Promise<string> {
  try {
    // Get user's spending data
    const spendingData = await getUserSpendingContext(userId);

    const prompt =
      language === 'fr'
        ? `Génère un conseil d'économie personnalisé basé sur ces données de dépenses. Le conseil doit être concis, actionable et en français.

Données utilisateur:
${spendingData}

Format: Une phrase courte avec un conseil spécifique.`
        : `Generate a personalized savings tip based on this spending data. The tip should be concise, actionable, and in English.

User data:
${spendingData}

Format: One short sentence with a specific tip.`;

    const model = genAI.getGenerativeModel({model: config.gemini.model});
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const tip = response.text().trim();

    return tip;
  } catch (error) {
    console.error('Generate savings tip error:', error);
    // Fallback tips
    return language === 'fr'
      ? "Comparez les prix entre différents magasins avant d'acheter."
      : 'Compare prices between different stores before buying.';
  }
}

/**
 * Get user's spending context for AI
 */
async function getUserSpendingContext(userId: string): Promise<string> {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get receipts
  const receipts = await db
    .collection(collections.receipts(userId))
    .where('date', '>=', thisMonth)
    .get();

  let totalSpent = 0;
  const categories: {[key: string]: number} = {};
  const stores: {[key: string]: number} = {};

  receipts.docs.forEach(doc => {
    const data = doc.data();
    totalSpent += data.total || 0;

    (data.items || []).forEach((item: any) => {
      const cat = item.category || 'Autres';
      categories[cat] =
        (categories[cat] || 0) + (item.unitPrice || 0) * (item.quantity || 1);
      stores[data.storeName] =
        (stores[data.storeName] || 0) +
        (item.unitPrice || 0) * (item.quantity || 1);
    });
  });

  const topCategory = Object.entries(categories).sort(
    ([, a], [, b]) => b - a,
  )[0];
  const topStore = Object.entries(stores).sort(([, a], [, b]) => b - a)[0];

  return `
Total spent this month: $${totalSpent.toFixed(2)}
Receipts: ${receipts.size}
Top category: ${
    topCategory ? `${topCategory[0]} ($${topCategory[1].toFixed(2)})` : 'None'
  }
Top store: ${topStore ? `${topStore[0]} ($${topStore[1].toFixed(2)})` : 'None'}
  `.trim();
}

/**
 * Send savings tip notification
 */
async function sendSavingsTipNotification(
  fcmToken: string,
  tip: string,
  language: string,
  userId?: string,
): Promise<void> {
  const title = language === 'fr' ? "Conseil d'Économie" : 'Savings Tip';

  await messaging.send({
    token: fcmToken,
    notification: {
      title,
      body: tip,
    },
    data: {
      type: 'savings_tip',
      tip,
    },
    android: {
      priority: 'normal',
      notification: {
        channelId: 'savings_tips',
        icon: 'ic_notification',
        color: '#10b981',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
    },
  });

  // Save notification to Firestore if userId provided
  if (userId) {
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        title,
        body: tip,
        type: 'savings_tip',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
  }
}

/**
 * Send achievement notification
 */
async function sendAchievementNotificationToUser(
  fcmToken: string,
  achievementTitle: string,
  language: string,
  userId?: string,
): Promise<void> {
  const title =
    language === 'fr' ? 'Achievement Débloqué!' : 'Achievement Unlocked!';
  const body =
    language === 'fr'
      ? `Félicitations! Vous avez débloqué: ${achievementTitle}`
      : `Congratulations! You unlocked: ${achievementTitle}`;

  await messaging.send({
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: {
      type: 'achievement',
      achievementTitle,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'achievements',
        icon: 'ic_notification',
        color: '#f59e0b',
      },
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: 'default',
        },
      },
    },
  });

  // Save notification to Firestore if userId provided
  if (userId) {
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        title,
        body,
        type: 'achievement',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        data: {achievementTitle},
      });
  }
}

/**
 * Send sync complete notification
 */
async function sendSyncCompleteNotificationToUser(
  fcmToken: string,
  syncedCount: number,
  language: string,
  userId?: string,
): Promise<void> {
  const title =
    language === 'fr' ? 'Synchronisation Terminée' : 'Sync Complete';
  const body =
    language === 'fr'
      ? `${syncedCount} facture(s) synchronisée(s) avec succès!`
      : `${syncedCount} receipt(s) synced successfully!`;

  await messaging.send({
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: {
      type: 'sync_complete',
      syncedCount: syncedCount.toString(),
    },
    android: {
      priority: 'normal',
      notification: {
        channelId: 'sync_notifications',
        icon: 'ic_notification',
        color: '#10b981',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
    },
  });

  // Save notification to Firestore if userId provided
  if (userId) {
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        title,
        body,
        type: 'sync_complete',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        data: {syncedCount},
      });
  }
}

/**
 * Check subscriptions expiring soon and send notifications
 * Runs daily at 9:00 AM - notifies users 7 days before expiration
 */
export const checkSubscriptionExpiration = functions
  .region(config.app.region)
  .pubsub.schedule('0 9 * * *')
  .timeZone('Africa/Kinshasa')
  .onRun(async () => {
    console.log('Checking subscription expirations...');

    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const threeDaysFromNow = new Date(now);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const oneDayFromNow = new Date(now);
      oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

      // Find subscriptions expiring within 7 days
      const expiringQuery = await db
        .collectionGroup('subscription')
        .where('isSubscribed', '==', true)
        .where('status', '==', 'active')
        .where(
          'subscriptionEndDate',
          '<=',
          admin.firestore.Timestamp.fromDate(sevenDaysFromNow),
        )
        .where('subscriptionEndDate', '>', admin.firestore.Timestamp.now())
        .get();

      console.log(
        `Found ${expiringQuery.docs.length} subscriptions expiring soon`,
      );

      for (const doc of expiringQuery.docs) {
        const subscription = doc.data();
        const userId = subscription.userId;

        // Get user data for FCM token and language
        const userDoc = await db
          .doc(`artifacts/${config.app.id}/users/${userId}`)
          .get();
        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken;
        const language = userData?.language || 'fr';

        if (!fcmToken) {
          console.log(`No FCM token for user ${userId}`);
          continue;
        }

        // Calculate days until expiration
        const endDate =
          subscription.subscriptionEndDate instanceof admin.firestore.Timestamp
            ? subscription.subscriptionEndDate.toDate()
            : new Date(subscription.subscriptionEndDate);

        const daysUntilExpiration = Math.ceil(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Send appropriate notification based on days remaining
        await sendSubscriptionExpirationNotification(
          fcmToken,
          daysUntilExpiration,
          subscription.planId || 'standard',
          language,
        );

        // Save notification to Firestore
        let title: string;
        let body: string;
        if (daysUntilExpiration <= 1) {
          title = language === 'fr' ? 'Abonnement Expire Demain!' : 'Subscription Expires Tomorrow!';
          body = language === 'fr' ? "Renouvelez maintenant pour ne pas perdre vos fonctionnalités premium." : 'Renew now to keep your premium features.';
        } else if (daysUntilExpiration <= 3) {
          title = language === 'fr' ? `${daysUntilExpiration} Jours Restants!` : `${daysUntilExpiration} Days Left!`;
          body = language === 'fr' ? 'Votre abonnement expire bientôt.' : 'Your subscription expires soon.';
        } else {
          title = language === 'fr' ? "Rappel d'Abonnement" : 'Subscription Reminder';
          body = language === 'fr' ? `Votre abonnement expire dans ${daysUntilExpiration} jours.` : `Your subscription expires in ${daysUntilExpiration} days.`;
        }
        await saveSubscriptionNotification(userId, title, body, daysUntilExpiration, subscription.planId || 'standard');

        // Update subscription status
        await doc.ref.update({
          expirationNotificationSent: true,
          expirationNotificationDate:
            admin.firestore.FieldValue.serverTimestamp(),
          daysUntilExpiration,
          status: daysUntilExpiration <= 3 ? 'expiring_soon' : 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `Sent expiration notification to user ${userId} - ${daysUntilExpiration} days remaining`,
        );
      }

      // Also check trials expiring soon
      const expiringTrialsQuery = await db
        .collectionGroup('subscription')
        .where('status', '==', 'trial')
        .where(
          'trialEndDate',
          '<=',
          admin.firestore.Timestamp.fromDate(sevenDaysFromNow),
        )
        .where('trialEndDate', '>', admin.firestore.Timestamp.now())
        .get();

      console.log(
        `Found ${expiringTrialsQuery.docs.length} trials expiring soon`,
      );

      for (const doc of expiringTrialsQuery.docs) {
        const subscription = doc.data();
        const userId = subscription.userId;

        const userDoc = await db
          .doc(`artifacts/${config.app.id}/users/${userId}`)
          .get();
        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken;
        const language = userData?.language || 'fr';

        if (!fcmToken) continue;

        const endDate =
          subscription.trialEndDate instanceof admin.firestore.Timestamp
            ? subscription.trialEndDate.toDate()
            : new Date(subscription.trialEndDate);

        const daysUntilExpiration = Math.ceil(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        await sendTrialExpirationNotification(
          fcmToken,
          daysUntilExpiration,
          language,
        );

        // Save notification to Firestore
        let title: string;
        let body: string;
        if (daysUntilExpiration <= 1) {
          title = language === 'fr' ? 'Essai Gratuit Termine Demain!' : 'Free Trial Ends Tomorrow!';
          body = language === 'fr' ? 'Passez à un abonnement premium pour continuer.' : 'Upgrade to premium to continue.';
        } else if (daysUntilExpiration <= 3) {
          title = language === 'fr' ? `${daysUntilExpiration} Jours d'Essai Restants` : `${daysUntilExpiration} Trial Days Left`;
          body = language === 'fr' ? 'Votre essai gratuit se termine bientôt.' : 'Your free trial ends soon.';
        } else {
          title = language === 'fr' ? 'Rappel Essai Gratuit' : 'Trial Reminder';
          body = language === 'fr' ? `Plus que ${daysUntilExpiration} jours d'essai gratuit.` : `${daysUntilExpiration} days left in your free trial.`;
        }
        await saveTrialNotification(userId, title, body, daysUntilExpiration);

        await doc.ref.update({
          expirationNotificationSent: true,
          expirationNotificationDate:
            admin.firestore.FieldValue.serverTimestamp(),
          daysUntilExpiration,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `Sent trial expiration notification to user ${userId} - ${daysUntilExpiration} days remaining`,
        );
      }

      console.log('Subscription expiration check completed');
      return null;
    } catch (error) {
      console.error('Subscription expiration check error:', error);
      return null;
    }
  });

/**
 * Send subscription expiration notification
 */
async function sendSubscriptionExpirationNotification(
  fcmToken: string,
  daysRemaining: number,
  planId: string,
  language: string,
): Promise<void> {
  let title: string;
  let body: string;
  let urgency: 'high' | 'normal' = 'normal';

  if (daysRemaining <= 1) {
    urgency = 'high';
    title =
      language === 'fr'
        ? 'Abonnement Expire Demain!'
        : 'Subscription Expires Tomorrow!';
    body =
      language === 'fr'
        ? "Renouvelez maintenant pour ne pas perdre vos fonctionnalités premium. Profitez de -30% sur l'abonnement annuel!"
        : 'Renew now to keep your premium features. Get 30% off on annual subscription!';
  } else if (daysRemaining <= 3) {
    urgency = 'high';
    title =
      language === 'fr'
        ? `${daysRemaining} Jours Restants!`
        : `${daysRemaining} Days Left!`;
    body =
      language === 'fr'
        ? 'Votre abonnement expire bientôt. Renouvelez maintenant pour profiter de nos offres exclusives!'
        : 'Your subscription expires soon. Renew now for exclusive offers!';
  } else {
    title =
      language === 'fr' ? "Rappel d'Abonnement" : 'Subscription Reminder';
    body =
      language === 'fr'
        ? `Votre abonnement expire dans ${daysRemaining} jours. Économisez jusqu'à 30% avec nos offres longue durée!`
        : `Your subscription expires in ${daysRemaining} days. Save up to 30% with long-term plans!`;
  }

  await messaging.send({
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: {
      type: 'subscription_expiring',
      daysRemaining: daysRemaining.toString(),
      planId,
      action: 'renew',
    },
    android: {
      priority: urgency,
      notification: {
        channelId: 'subscription_alerts',
        icon: 'ic_notification',
        color: daysRemaining <= 3 ? '#ef4444' : '#f59e0b',
      },
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: 'default',
        },
      },
    },
  });
}

/**
 * Save subscription expiration notification to Firestore
 */
async function saveSubscriptionNotification(
  userId: string,
  title: string,
  body: string,
  daysRemaining: number,
  planId: string,
): Promise<void> {
  try {
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        title,
        body,
        type: 'subscription_expiring',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        data: {daysRemaining, planId, action: 'renew'},
      });
  } catch (error) {
    console.error('Error saving subscription notification:', error);
  }
}

/**
 * Send trial expiration notification
 */
async function sendTrialExpirationNotification(
  fcmToken: string,
  daysRemaining: number,
  language: string,
): Promise<void> {
  let title: string;
  let body: string;

  if (daysRemaining <= 1) {
    title =
      language === 'fr'
        ? 'Essai Gratuit Termine Demain!'
        : 'Free Trial Ends Tomorrow!';
    body =
      language === 'fr'
        ? "Passez à un abonnement premium pour continuer à profiter de toutes les fonctionnalités. -30% sur l'annuel!"
        : 'Upgrade to premium to keep all features. Get 30% off annual plans!';
  } else if (daysRemaining <= 3) {
    title =
      language === 'fr'
        ? `${daysRemaining} Jours d'Essai Restants`
        : `${daysRemaining} Trial Days Left`;
    body =
      language === 'fr'
        ? 'Votre essai gratuit se termine bientôt. Choisissez un plan qui vous convient!'
        : 'Your free trial ends soon. Choose a plan that works for you!';
  } else {
    title = language === 'fr' ? 'Rappel Essai Gratuit' : 'Trial Reminder';
    body =
      language === 'fr'
        ? `Plus que ${daysRemaining} jours d'essai gratuit. Explorez toutes nos fonctionnalités!`
        : `${daysRemaining} days left in your free trial. Explore all our features!`;
  }

  await messaging.send({
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: {
      type: 'trial_expiring',
      daysRemaining: daysRemaining.toString(),
      action: 'subscribe',
    },
    android: {
      priority: daysRemaining <= 3 ? 'high' : 'normal',
      notification: {
        channelId: 'subscription_alerts',
        icon: 'ic_notification',
        color: daysRemaining <= 3 ? '#ef4444' : '#10b981',
      },
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: 'default',
        },
      },
    },
  });
}

/**
 * Save trial expiration notification to Firestore
 */
async function saveTrialNotification(
  userId: string,
  title: string,
  body: string,
  daysRemaining: number,
): Promise<void> {
  try {
    await db
      .collection(`artifacts/${config.app.id}/users/${userId}/notifications`)
      .add({
        title,
        body,
        type: 'trial_expiring',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        data: {daysRemaining, action: 'subscribe'},
      });
  } catch (error) {
    console.error('Error saving trial notification:', error);
  }
}
