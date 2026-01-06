/**
 * Budget Warning System
 * Sends notifications when users approach their monthly budget limits
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();
const messaging = admin.messaging();

// Budget warning thresholds
const BUDGET_THRESHOLDS = {
  WARNING_80: 80, // 80% of budget used
  WARNING_90: 90, // 90% of budget used
  LIMIT_REACHED: 100, // 100% of budget used
};

/**
 * Calculate current month spending for a user
 */
async function calculateCurrentMonthSpending(userId: string): Promise<{totalSpent: number, currency: 'USD' | 'CDF'}> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Get receipts for this month
  const receiptsSnapshot = await db
    .collection(`artifacts/${config.app.id}/users/${userId}/receipts`)
    .where('date', '>=', admin.firestore.Timestamp.fromDate(monthStart))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(monthEnd))
    .get();

  let totalSpent = 0;
  let currency: 'USD' | 'CDF' = 'USD';

  receiptsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    totalSpent += data.total || 0;
    if (data.currency) {
      currency = data.currency;
    }
  });

  return {totalSpent, currency};
}

/**
 * Get current month budget for a user
 */
async function getCurrentMonthBudget(userId: string): Promise<{amount: number, currency: 'USD' | 'CDF'}> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const budgetDoc = await db
    .doc(`artifacts/${config.app.id}/users/${userId}/budgets/${monthKey}`)
    .get();

  if (budgetDoc.exists) {
    const data = budgetDoc.data();
    return {
      amount: data?.amount || 0,
      currency: data?.currency || 'USD',
    };
  }

  // Check user profile for default budget
  const userDoc = await db
    .doc(`artifacts/${config.app.id}/users/${userId}`)
    .get();

  const userData = userDoc.data();
  const defaultBudget = userData?.defaultMonthlyBudget || userData?.monthlyBudget || 0;

  return {
    amount: defaultBudget,
    currency: userData?.preferredCurrency || 'USD',
  };
}

/**
 * Send budget warning notification
 */
async function sendBudgetWarning(
  userId: string,
  spent: number,
  budget: number,
  percentUsed: number,
  currency: 'USD' | 'CDF',
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

    // Format currency
    const formatCurrency = (amount: number) => {
      if (currency === 'CDF') {
        return `${Math.round(amount).toLocaleString('fr-CD')} FC`;
      }
      return `$${amount.toFixed(2)}`;
    };

    const spentFormatted = formatCurrency(spent);
    const budgetFormatted = formatCurrency(budget);
    const remaining = budget - spent;
    const remainingFormatted = formatCurrency(Math.max(0, remaining));

    let title: string;
    let body: string;

    if (language === 'fr') {
      if (percentUsed >= 100) {
        title = 'Budget mensuel atteint';
        body = `Vous avez dépensé ${spentFormatted} sur ${budgetFormatted}. Budget épuisé !`;
      } else if (percentUsed >= 90) {
        title = 'Budget presque épuisé';
        body = `Vous avez dépensé ${spentFormatted} sur ${budgetFormatted} (${percentUsed.toFixed(0)}%). Il reste ${remainingFormatted}.`;
      } else {
        title = 'Alerte budget';
        body = `Vous avez dépensé ${spentFormatted} sur ${budgetFormatted} (${percentUsed.toFixed(0)}%). Il reste ${remainingFormatted}.`;
      }
    } else {
      // English fallback
      if (percentUsed >= 100) {
        title = 'Monthly budget reached';
        body = `You've spent ${spentFormatted} of ${budgetFormatted}. Budget exhausted!`;
      } else if (percentUsed >= 90) {
        title = 'Budget almost exhausted';
        body = `You've spent ${spentFormatted} of ${budgetFormatted} (${percentUsed.toFixed(0)}%). ${remainingFormatted} remaining.`;
      } else {
        title = 'Budget alert';
        body = `You've spent ${spentFormatted} of ${budgetFormatted} (${percentUsed.toFixed(0)}%). ${remainingFormatted} remaining.`;
      }
    }

    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        type: 'budget_warning',
        spent: spent.toString(),
        budget: budget.toString(),
        percentUsed: percentUsed.toString(),
        currency,
      },
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'budget_alerts',
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
    console.log(`Budget warning sent to user ${userId}: ${percentUsed.toFixed(1)}% used`);
  } catch (error) {
    console.error('Error sending budget warning:', error);
  }
}

/**
 * Check if budget warning should be sent and send if needed
 */
async function checkAndSendBudgetWarning(userId: string): Promise<void> {
  try {
    // Get current spending and budget
    const [spending, budget] = await Promise.all([
      calculateCurrentMonthSpending(userId),
      getCurrentMonthBudget(userId),
    ]);

    // Skip if no budget set
    if (budget.amount <= 0) {
      return;
    }

    // Calculate percentage used
    const percentUsed = (spending.totalSpent / budget.amount) * 100;

    // Check if we should send a warning
    let shouldSendWarning = false;
    if (percentUsed >= BUDGET_THRESHOLDS.LIMIT_REACHED) {
      shouldSendWarning = true;
    } else if (percentUsed >= BUDGET_THRESHOLDS.WARNING_90) {
      shouldSendWarning = true;
    } else if (percentUsed >= BUDGET_THRESHOLDS.WARNING_80) {
      shouldSendWarning = true;
    }

    if (shouldSendWarning) {
      // Check if we already sent a warning for this threshold this month
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const thresholdKey = percentUsed >= BUDGET_THRESHOLDS.LIMIT_REACHED ? '100' :
                          percentUsed >= BUDGET_THRESHOLDS.WARNING_90 ? '90' : '80';

      const warningDocRef = db.doc(`artifacts/${config.app.id}/users/${userId}/budgetWarnings/${monthKey}_${thresholdKey}`);
      const warningDoc = await warningDocRef.get();

      if (!warningDoc.exists) {
        // Send warning and mark as sent
        await sendBudgetWarning(userId, spending.totalSpent, budget.amount, percentUsed, budget.currency);
        await warningDocRef.set({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          percentUsed,
          spent: spending.totalSpent,
          budget: budget.amount,
          currency: budget.currency,
        });
      }
    }
  } catch (error) {
    console.error('Error checking budget warning:', error);
  }
}

/**
 * Cloud function triggered when a receipt is created
 * Checks if budget warning should be sent
 */
export const onReceiptCreatedForBudget = functions.firestore
  .document('artifacts/{appId}/users/{userId}/receipts/{receiptId}')
  .onCreate(async (snapshot, context) => {
    const userId = context.params.userId;

    // Check budget warning
    await checkAndSendBudgetWarning(userId);
  });

/**
 * Manual function to send budget warning to a user
 */
export const sendManualBudgetWarning = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;

  await checkAndSendBudgetWarning(userId);

  return {success: true};
});

/**
 * Reset budget warnings for current month (for testing)
 */
export const resetBudgetWarnings = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Delete all warning docs for this month
  const warningsRef = db.collection(`artifacts/${config.app.id}/users/${userId}/budgetWarnings`);
  const warnings = await warningsRef.where('month', '==', monthKey).get();

  const deletePromises = warnings.docs.map(doc => doc.ref.delete());
  await Promise.all(deletePromises);

  return {success: true, deleted: warnings.docs.length};
});