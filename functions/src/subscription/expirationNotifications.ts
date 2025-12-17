/**
 * Subscription Expiration Notification System
 * Sends timely alerts to users before their subscription expires
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {differenceInDays} from 'date-fns';
import {config} from '../config';
import {Subscription} from '../types';

const db = admin.firestore();

// Notification thresholds (days before expiration)
const NOTIFICATION_THRESHOLDS = [7, 3, 1];

/**
 * Send expiration warning notification
 */
async function sendExpirationWarning(
  userId: string,
  subscription: Subscription,
  daysUntilExpiration: number,
): Promise<void> {
  try {
    const notificationsRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('notifications');

    const planName = subscription.planId || 'subscription';
    const expiryDate =
      subscription.subscriptionEndDate instanceof admin.firestore.Timestamp
        ? subscription.subscriptionEndDate.toDate()
        : new Date(subscription.subscriptionEndDate!);

    // Different messages based on days remaining
    let title: string;
    let titleFr: string;
    let message: string;
    let messageFr: string;
    let priority: 'low' | 'medium' | 'high';

    if (daysUntilExpiration === 7) {
      title = 'Subscription Expiring Soon';
      titleFr = 'Abonnement bientôt expiré';
      message = `Your ${planName} subscription expires in 7 days (${expiryDate.toLocaleDateString()}). ${
        subscription.autoRenew
          ? 'Auto-renewal is enabled.'
          : 'Renew now to continue enjoying unlimited scans.'
      }`;
      messageFr = `Votre abonnement ${planName} expire dans 7 jours (${expiryDate.toLocaleDateString()}). ${
        subscription.autoRenew
          ? 'Le renouvellement automatique est activé.'
          : 'Renouvelez maintenant pour continuer à profiter des scans illimités.'
      }`;
      priority = 'medium';
    } else if (daysUntilExpiration === 3) {
      title = 'Subscription Expires in 3 Days';
      titleFr = 'Abonnement expire dans 3 jours';
      message = `Your ${planName} subscription expires on ${expiryDate.toLocaleDateString()}. ${
        subscription.autoRenew
          ? "We'll automatically renew it for you."
          : 'Renew now to avoid losing access to premium features.'
      }`;
      messageFr = `Votre abonnement ${planName} expire le ${expiryDate.toLocaleDateString()}. ${
        subscription.autoRenew
          ? 'Nous le renouvellerons automatiquement pour vous.'
          : "Renouvelez maintenant pour éviter de perdre l'accès aux fonctionnalités premium."
      }`;
      priority = 'high';
    } else if (daysUntilExpiration === 1) {
      title = 'Subscription Expires Tomorrow';
      titleFr = 'Abonnement expire demain';
      message = `Your ${planName} subscription expires tomorrow (${expiryDate.toLocaleDateString()}). ${
        subscription.autoRenew
          ? 'Auto-renewal will process tonight.'
          : 'This is your last chance to renew!'
      }`;
      messageFr = `Votre abonnement ${planName} expire demain (${expiryDate.toLocaleDateString()}). ${
        subscription.autoRenew
          ? 'Le renouvellement automatique sera effectué ce soir.'
          : 'C\'est votre dernière chance de renouveler!'
      }`;
      priority = 'high';
    } else {
      title = 'Subscription Expiring';
      titleFr = 'Abonnement expire';
      message = `Your ${planName} subscription expires in ${daysUntilExpiration} days.`;
      messageFr = `Votre abonnement ${planName} expire dans ${daysUntilExpiration} jours.`;
      priority = 'medium';
    }

    await notificationsRef.add({
      type: 'subscription_expiring',
      title,
      titleFr,
      message,
      messageFr,
      priority,
      daysUntilExpiration,
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      autoRenewEnabled: subscription.autoRenew,
      read: false,
      actionUrl: subscription.autoRenew ? '/subscription' : '/subscription/renew',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `📧 Sent ${daysUntilExpiration}-day expiration warning to user ${userId}`,
    );
  } catch (error) {
    console.error('Error sending expiration warning:', error);
  }
}

/**
 * Send expiration notification (subscription has expired)
 */
async function sendExpiredNotification(
  userId: string,
  subscription: Subscription,
): Promise<void> {
  try {
    const notificationsRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('notifications');

    const planName = subscription.planId || 'subscription';

    await notificationsRef.add({
      type: 'subscription_expired',
      title: 'Subscription Expired',
      titleFr: 'Abonnement expiré',
      message: `Your ${planName} subscription has expired. You now have limited access (5 scans/month). Renew to restore full access.`,
      messageFr: `Votre abonnement ${planName} a expiré. Vous avez maintenant un accès limité (5 scans/mois). Renouvelez pour restaurer l'accès complet.`,
      priority: 'high',
      read: false,
      actionUrl: '/subscription/renew',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📧 Sent expiration notification to user ${userId}`);
  } catch (error) {
    console.error('Error sending expired notification:', error);
  }
}

/**
 * Scheduled function to check and send expiration warnings
 * Runs daily at 9 AM Africa/Kinshasa time (user-friendly hour)
 */
export const checkExpirationWarnings = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '512MB',
  })
  .pubsub.schedule('0 9 * * *')
  .timeZone('Africa/Kinshasa')
  .onRun(async context => {
    try {
      const now = new Date();
      console.log(
        `🔔 Starting expiration warning check at ${now.toISOString()}`,
      );

      let totalNotificationsSent = 0;
      let totalExpiredNotificationsSent = 0;

      // Process each notification threshold
      for (const days of NOTIFICATION_THRESHOLDS) {
        // Calculate target date (today + days)
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + days);
        targetDate.setHours(0, 0, 0, 0);

        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        console.log(
          `\n📅 Checking for subscriptions expiring in ${days} day(s)...`,
        );

        // Find subscriptions expiring on target date
        const expiringSubscriptions = await db
          .collectionGroup('subscription')
          .where('isSubscribed', '==', true)
          .where(
            'subscriptionEndDate',
            '>=',
            admin.firestore.Timestamp.fromDate(targetDate),
          )
          .where(
            'subscriptionEndDate',
            '<',
            admin.firestore.Timestamp.fromDate(nextDay),
          )
          .get();

        console.log(`   Found ${expiringSubscriptions.size} subscription(s)`);

        for (const doc of expiringSubscriptions.docs) {
          const subscription = doc.data() as Subscription;
          const userId = subscription.userId;

          // Check if we've already sent this notification
          const lastNotificationDays = subscription.daysUntilExpiration;
          if (lastNotificationDays === days) {
            console.log(
              `   ⏭️ Skipping user ${userId} - notification already sent for ${days} day(s)`,
            );
            continue;
          }

          // Send notification
          await sendExpirationWarning(userId, subscription, days);

          // Update subscription with notification tracking
          await doc.ref.update({
            daysUntilExpiration: days,
            expirationNotificationSent: true,
            expirationNotificationDate:
              admin.firestore.FieldValue.serverTimestamp(),
            status: days <= 3 ? 'expiring_soon' : subscription.status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          totalNotificationsSent++;
        }
      }

      // Also check for subscriptions that have just expired (today)
      console.log('\n⏰ Checking for newly expired subscriptions...');

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const expiredToday = await db
        .collectionGroup('subscription')
        .where('isSubscribed', '==', true)
        .where('status', '!=', 'expired')
        .where(
          'subscriptionEndDate',
          '<',
          admin.firestore.Timestamp.fromDate(todayStart),
        )
        .get();

      console.log(`   Found ${expiredToday.size} expired subscription(s)`);

      for (const doc of expiredToday.docs) {
        const subscription = doc.data() as Subscription;
        const userId = subscription.userId;

        // Send expiration notification
        await sendExpiredNotification(userId, subscription);

        // This is handled by checkExpiredSubscriptions, but we send notification here
        totalExpiredNotificationsSent++;
      }

      console.log(`\n✅ Expiration warning check complete:`);
      console.log(`   Warning notifications sent: ${totalNotificationsSent}`);
      console.log(
        `   Expired notifications sent: ${totalExpiredNotificationsSent}`,
      );

      return null;
    } catch (error) {
      console.error('Expiration warning check error:', error);
      return null;
    }
  });

/**
 * Manually send expiration warning to a specific user
 */
export const sendManualExpirationWarning = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    // Authentication required
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const requestingUserId = context.auth.uid;
    const {userId = requestingUserId} = data;

    // Users can only send to themselves (unless admin - TODO: add admin check)
    if (userId !== requestingUserId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Can only send notifications to yourself',
      );
    }

    try {
      const subscriptionRef = db.doc(
        `artifacts/${config.app.id}/users/${userId}/subscription/${userId}`,
      );
      const subscriptionDoc = await subscriptionRef.get();

      if (!subscriptionDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Subscription not found',
        );
      }

      const subscription = subscriptionDoc.data() as Subscription;

      if (!subscription.isSubscribed || !subscription.subscriptionEndDate) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No active subscription found',
        );
      }

      const now = new Date();
      const expiryDate =
        subscription.subscriptionEndDate instanceof admin.firestore.Timestamp
          ? subscription.subscriptionEndDate.toDate()
          : new Date(subscription.subscriptionEndDate);

      const daysUntilExpiration = differenceInDays(expiryDate, now);

      if (daysUntilExpiration < 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Subscription has already expired',
        );
      }

      // Send notification
      await sendExpirationWarning(userId, subscription, daysUntilExpiration);

      // Update tracking
      await subscriptionRef.update({
        daysUntilExpiration,
        expirationNotificationSent: true,
        expirationNotificationDate:
          admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: `Expiration warning sent (${daysUntilExpiration} days remaining)`,
        daysUntilExpiration,
        expiryDate: expiryDate.toISOString(),
      };
    } catch (error: any) {
      console.error('Manual expiration warning error:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send expiration warning',
      );
    }
  });
