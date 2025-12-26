/**
 * Payment Success Notification System
 * Sends confirmation notifications when payments are successful
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Send payment success confirmation notification
 */
export async function sendPaymentSuccessNotification(
  userId: string,
  planId: string,
  amount: number,
  paymentMethod: string,
  transactionId?: string,
  currency: string = 'USD',
): Promise<void> {
  try {
    // Get user's FCM token and language
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    const language = userData?.language || 'fr';

    if (!fcmToken) {
      console.log(`No FCM token for user ${userId}`);
      return;
    }

    // Plan display names
    const planNames: {[key: string]: {en: string; fr: string}} = {
      freemium: {en: 'Free', fr: 'Gratuit'},
      basic: {en: 'Basic', fr: 'Basique'},
      standard: {en: 'Standard', fr: 'Standard'},
      premium: {en: 'Premium', fr: 'Premium'},
    };

    const planName = planNames[planId] || {en: planId, fr: planId};

    // Plan scan limits
    const scanLimits: {[key: string]: number} = {
      freemium: 3,
      basic: 25,
      standard: 100,
      premium: 1000,
    };

    const scans = scanLimits[planId] || 0;

    const title = 'Paiement Réussi!';
    const titleEn = 'Payment Successful!';
    const currencySymbol = currency === 'USD' ? '$' : 'FC';
    const formattedAmount = currency === 'USD' ? amount.toFixed(2) : Math.round(amount);
    const message = `Votre abonnement ${planName.fr} est maintenant actif (${scans} scans/mois). Montant payé: ${currencySymbol}${formattedAmount}`;
    const messageEn = `Your ${planName.en} subscription is now active (${scans} scans/month). Amount paid: ${currencySymbol}${formattedAmount}`;

    // Send FCM notification
    await messaging.send({
      token: fcmToken,
      notification: {
        title: language === 'fr' ? title : titleEn,
        body: language === 'fr' ? message : messageEn,
      },
      data: {
        type: 'payment_success',
        planId,
        amount: amount.toString(),
        currency,
        paymentMethod,
        transactionId: transactionId || '',
        scans: scans.toString(),
        dismissible: 'true',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'payment_confirmations',
          icon: 'ic_notification',
          color: '#10b981',
        },
        collapseKey: `payment_${transactionId}`,
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

    // Save notification to Firestore
    const notificationsRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('notifications');

    await notificationsRef.add({
      type: 'payment_success',
      title: language === 'fr' ? title : titleEn,
      titleFr: title,
      message: language === 'fr' ? message : messageEn,
      messageFr: message,
      priority: 'high',
      planId,
      amount,
      currency,
      paymentMethod,
      transactionId,
      scans,
      read: false,
      actionUrl: '/home',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `📧 Sent payment success notification to user ${userId} (${planId}, $${amount})`,
    );
  } catch (error) {
    console.error('Error sending payment success notification:', error);
  }
}

/**
 * Send payment failed notification
 */
export async function sendPaymentFailedNotification(
  userId: string,
  planId: string,
  amount: number,
  paymentMethod: string,
  errorReason?: string,
  currency: string = 'USD',
): Promise<void> {
  try {
    // Get user's FCM token and language
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    const language = userData?.language || 'fr';

    if (!fcmToken) {
      console.log(`No FCM token for user ${userId}`);
      return;
    }

    const title = 'Paiement Échoué';
    const titleEn = 'Payment Failed';
    const currencySymbol = currency === 'USD' ? '$' : 'FC';
    const formattedAmount = currency === 'USD' ? amount.toFixed(2) : Math.round(amount);
    const message = `Le paiement de ${currencySymbol}${formattedAmount} pour l'abonnement ${planId} a échoué. Veuillez réessayer.`;
    const messageEn = `Payment of ${currencySymbol}${formattedAmount} for ${planId} subscription failed. Please try again.`;

    // Send FCM notification
    await messaging.send({
      token: fcmToken,
      notification: {
        title: language === 'fr' ? title : titleEn,
        body: language === 'fr' ? message : messageEn,
      },
      data: {
        type: 'payment_failed',
        planId,
        amount: amount.toString(),
        currency,
        paymentMethod,
        errorReason: errorReason || 'Unknown error',
        dismissible: 'true',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'payment_confirmations',
          icon: 'ic_notification',
          color: '#ef4444',
        },
        collapseKey: `payment_failed_${planId}`,
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

    // Save notification to Firestore
    const notificationsRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('notifications');

    await notificationsRef.add({
      type: 'payment_failed',
      title: language === 'fr' ? title : titleEn,
      titleFr: title,
      message: language === 'fr' ? message : messageEn,
      messageFr: message,
      priority: 'high',
      planId,
      amount,
      paymentMethod,
      errorReason,
      read: false,
      actionUrl: '/subscription/payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `📧 Sent payment failed notification to user ${userId} (${planId}, $${amount})`,
    );
  } catch (error) {
    console.error('Error sending payment failed notification:', error);
  }
}

/**
 * Send auto-renewal success notification
 */
export async function sendAutoRenewalNotification(
  userId: string,
  planId: string,
  amount: number,
  nextRenewalDate: Date,
): Promise<void> {
  try {
    // Get user's FCM token and language
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;
    const language = userData?.language || 'fr';

    if (!fcmToken) {
      console.log(`No FCM token for user ${userId}`);
      return;
    }

    const renewalDateStr = nextRenewalDate.toLocaleDateString(
      language === 'fr' ? 'fr-FR' : 'en-US',
    );

    const title = 'Abonnement Renouvelé';
    const titleEn = 'Subscription Renewed';
    const message = `Votre abonnement ${planId} a été renouvelé automatiquement ($${amount}). Prochain renouvellement: ${renewalDateStr}`;
    const messageEn = `Your ${planId} subscription has been auto-renewed ($${amount}). Next renewal: ${renewalDateStr}`;

    // Send FCM notification
    await messaging.send({
      token: fcmToken,
      notification: {
        title: language === 'fr' ? title : titleEn,
        body: language === 'fr' ? message : messageEn,
      },
      data: {
        type: 'auto_renewal_success',
        planId,
        amount: amount.toString(),
        nextRenewalDate: nextRenewalDate.toISOString(),
      },
      android: {
        priority: 'normal',
        notification: {
          channelId: 'payment_confirmations',
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

    // Save notification to Firestore
    const notificationsRef = db
      .collection(`artifacts/${config.app.id}/users`)
      .doc(userId)
      .collection('notifications');

    await notificationsRef.add({
      type: 'auto_renewal_success',
      title: language === 'fr' ? title : titleEn,
      titleFr: title,
      message: language === 'fr' ? message : messageEn,
      messageFr: message,
      priority: 'normal',
      planId,
      amount,
      nextRenewalDate: admin.firestore.Timestamp.fromDate(nextRenewalDate),
      read: false,
      actionUrl: '/subscription',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `📧 Sent auto-renewal notification to user ${userId} (${planId}, $${amount})`,
    );
  } catch (error) {
    console.error('Error sending auto-renewal notification:', error);
  }
}

/**
 * Callable function to manually send payment success notification (for testing)
 */
export const sendManualPaymentNotification = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const requestingUserId = context.auth.uid;
    const {userId = requestingUserId, planId, amount, paymentMethod, transactionId} = data;

    if (userId !== requestingUserId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Can only send notifications to yourself',
      );
    }

    if (!planId || !amount || !paymentMethod) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'planId, amount, and paymentMethod are required',
      );
    }

    try {
      await sendPaymentSuccessNotification(
        userId,
        planId,
        amount,
        paymentMethod,
        transactionId,
      );

      return {
        success: true,
        message: 'Payment success notification sent',
        planId,
        amount,
      };
    } catch (error: any) {
      console.error('Manual payment notification error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send payment notification',
      );
    }
  });
