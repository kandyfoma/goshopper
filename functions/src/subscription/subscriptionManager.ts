/**
 * Subscription Management Cloud Functions
 * Handles subscription status, trial tracking, and plan management
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {addMonths, addDays} from 'date-fns';
import {config, collections} from '../config';
import {Subscription} from '../types';

const db = admin.firestore();

// Default exchange rate fallback (updated Dec 2025)
const DEFAULT_EXCHANGE_RATE = 2700; // 1 USD = 2,700 CDF

// Trial configuration
const TRIAL_DURATION_DAYS = 30; // 1 month
const TRIAL_EXTENSION_DAYS = 30; // 1 month extension
const GRACE_PERIOD_DAYS = 7; // 7 days to use remaining scans after expiration
const PLAN_SCAN_LIMITS: Record<string, number> = {
  freemium: 3,
  basic: 20,
  standard: 50,
  premium: 200,
};

// Get current exchange rate from global settings
async function getExchangeRate(): Promise<number> {
  try {
    const settingsRef = db.collection('artifacts').doc(config.app.id)
      .collection('public').doc('data')
      .collection('settings').doc('global');

    const settingsDoc = await settingsRef.get();
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      return data?.exchangeRates?.usdToCdf || DEFAULT_EXCHANGE_RATE;
    }
    return DEFAULT_EXCHANGE_RATE;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return DEFAULT_EXCHANGE_RATE;
  }
}

// Subscription duration options (in months)
type SubscriptionDuration = 1 | 3 | 6;

// Discount percentages for longer subscriptions
const DURATION_DISCOUNTS: Record<SubscriptionDuration, number> = {
  1: 0, // No discount for monthly
  3: 10, // 10% discount for 3 months
  6: 20, // 20% discount for 6 months
};

// Base monthly prices per plan (USD)
const BASE_PRICES: Record<string, number> = {
  freemium: 0,
  basic: 1.99,
  standard: 2.99,
  premium: 4.99,
};

/**
 * Calculate price with duration discount
 */
function calculateSubscriptionPrice(
  planId: string,
  durationMonths: SubscriptionDuration,
): {total: number; monthly: number; savings: number; discountPercent: number} {
  const basePrice = BASE_PRICES[planId] || BASE_PRICES.standard;
  const discountPercent = DURATION_DISCOUNTS[durationMonths] || 0;
  const originalTotal = basePrice * durationMonths;
  const discountAmount = originalTotal * (discountPercent / 100);
  const total = originalTotal - discountAmount;
  const monthly = total / durationMonths;

  return {
    total: Math.round(total * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    savings: Math.round(discountAmount * 100) / 100,
    discountPercent,
  };
}

/**
 * Check if trial is active (time-based)
 */
function isTrialActive(subscription: Subscription): boolean {
  if (!subscription.trialEndDate) return false;

  const trialEnd =
    subscription.trialEndDate instanceof admin.firestore.Timestamp
      ? subscription.trialEndDate.toDate()
      : new Date(subscription.trialEndDate);

  return trialEnd > new Date() && subscription.status === 'trial';
}

/**
 * Get remaining trial days
 */
function getTrialDaysRemaining(subscription: Subscription): number {
  if (!subscription.trialEndDate) return 0;

  const trialEnd =
    subscription.trialEndDate instanceof admin.firestore.Timestamp
      ? subscription.trialEndDate.toDate()
      : new Date(subscription.trialEndDate);

  const diffTime = trialEnd.getTime() - Date.now();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Get current subscription status
 * Creates initial subscription if not exists
 */
export const getSubscriptionStatus = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;

    try {
      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();

      if (!subscriptionDoc.exists) {
        // Initialize new user subscription with 2-month trial
        const now = new Date();
        const trialEndDate = addDays(now, TRIAL_DURATION_DAYS);

        const initialSubscription: Partial<Subscription> = {
          userId,
          trialScansUsed: 0,
          trialScansLimit: 15, // Limited scans during trial
          trialStartDate: now,
          trialEndDate: trialEndDate,
          trialExtended: false,
          monthlyScansUsed: 0,
          isSubscribed: false,
          planId: 'free',
          status: 'trial',
          autoRenew: false,
          createdAt: now,
          updatedAt: now,
        };

        await subscriptionRef.set({
          ...initialSubscription,
          trialStartDate: admin.firestore.Timestamp.fromDate(now),
          trialEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          ...initialSubscription,
          canScan: true,
          scansRemaining: 15, // Trial limit
          isTrialActive: true,
          trialDaysRemaining: TRIAL_DURATION_DAYS,
        };
      }

      const subscription = subscriptionDoc.data() as Subscription;

      // Check if subscription has expired
      if (subscription.isSubscribed && subscription.subscriptionEndDate) {
        const endDate =
          subscription.subscriptionEndDate instanceof admin.firestore.Timestamp
            ? subscription.subscriptionEndDate.toDate()
            : new Date(subscription.subscriptionEndDate);
        
        const now = new Date();

        if (endDate < now) {
          // Calculate grace period end date
          const gracePeriodEnd = addDays(endDate, GRACE_PERIOD_DAYS);

          if (now < gracePeriodEnd) {
            // Within grace period - keep remaining scans
            if (subscription.status !== 'grace') {
              await subscriptionRef.update({
                isSubscribed: false,
                status: 'grace',
                gracePeriodEnd: admin.firestore.Timestamp.fromDate(gracePeriodEnd),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              subscription.isSubscribed = false;
              subscription.status = 'grace';
              subscription.gracePeriodEnd = gracePeriodEnd;
            }
          } else {
            // Grace period over - move to freemium and reset scans
            await subscriptionRef.update({
              isSubscribed: false,
              status: 'freemium',
              planId: 'freemium',
              monthlyScansUsed: 0,
              gracePeriodEnd: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            subscription.isSubscribed = false;
            subscription.status = 'freemium';
            subscription.planId = 'freemium';
            subscription.monthlyScansUsed = 0;
            subscription.gracePeriodEnd = undefined;
          }
        }
      }

      // Check if trial expired - move to freemium
      const trialActive = isTrialActive(subscription);
      if (!trialActive && !subscription.isSubscribed && subscription.status === 'trial') {
        await subscriptionRef.update({
          status: 'freemium',
          planId: 'freemium',
          monthlyScansUsed: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        subscription.status = 'freemium';
        subscription.planId = 'freemium';
        subscription.monthlyScansUsed = 0;
      }

      // Calculate scan availability
      const trialDaysRemaining = getTrialDaysRemaining(subscription);

      let canScan = false;
      let scansRemaining = 0;

      if (trialActive) {
        const trialLimit = subscription.trialScansLimit || 15;
        const trialUsed = subscription.trialScansUsed || 0;
        scansRemaining = Math.max(0, trialLimit - trialUsed);
        canScan = scansRemaining > 0;
      } else if (subscription.status === 'grace') {
        // Grace period - keep using remaining scans from expired plan
        const planLimit =
          PLAN_SCAN_LIMITS[subscription.planId || 'basic'] || 25;
        const monthlyUsed = subscription.monthlyScansUsed || 0;
        scansRemaining = Math.max(0, planLimit - monthlyUsed);
        canScan = scansRemaining > 0;
      } else if (
        subscription.isSubscribed &&
        subscription.status === 'active'
      ) {
        const planLimit =
          PLAN_SCAN_LIMITS[subscription.planId || 'basic'] || 25;
        const monthlyUsed = subscription.monthlyScansUsed || 0;
        scansRemaining = Math.max(0, planLimit - monthlyUsed);
        canScan = scansRemaining > 0;
      } else if (subscription.status === 'freemium' || !subscription.isSubscribed) {
        // Freemium users get 3 scans per month
        const freemiumLimit = PLAN_SCAN_LIMITS.freemium || 3;
        const monthlyUsed = subscription.monthlyScansUsed || 0;
        scansRemaining = Math.max(0, freemiumLimit - monthlyUsed);
        canScan = scansRemaining > 0;
      }

      return {
        ...subscription,
        canScan,
        scansRemaining,
        isTrialActive: trialActive,
        trialDaysRemaining,
      };
    } catch (error) {
      console.error('Get subscription error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get subscription status',
      );
    }
  });

/**
 * Record scan usage
 * Handles trial, basic, standard, and premium plans
 */
export const recordScanUsage = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;

    try {
      const subscriptionRef = db.doc(collections.subscription(userId));

      return await db.runTransaction(async transaction => {
        const subscriptionDoc = await transaction.get(subscriptionRef);

        if (!subscriptionDoc.exists) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Subscription not initialized',
          );
        }

        const subscription = subscriptionDoc.data() as Subscription;

        // Check trial status
        if (isTrialActive(subscription)) {
          // Trial users have unlimited scans - just track usage
          transaction.update(subscriptionRef, {
            trialScansUsed: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return {
            success: true,
            canScan: true,
            scansRemaining: -1,
            isTrialActive: true,
          };
        }

        // Check subscription status (allow cancelled but not expired)
        if (!subscription.isSubscribed || 
            (subscription.status !== 'active' && subscription.status !== 'cancelled')) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            'No active subscription. Please subscribe to continue.',
          );
        }

        // Check if subscription has expired (even if status is active/cancelled)
        if (subscription.subscriptionEndDate) {
          const endDate = subscription.subscriptionEndDate instanceof admin.firestore.Timestamp
            ? subscription.subscriptionEndDate.toDate()
            : new Date(subscription.subscriptionEndDate);
          
          if (endDate < new Date()) {
            throw new functions.https.HttpsError(
              'resource-exhausted',
              'Subscription has expired. Please renew to continue.',
            );
          }
        }

        // All plans (including Premium) have monthly limits now
        const planLimit =
          PLAN_SCAN_LIMITS[subscription.planId || 'basic'] || 25;
        const currentUsage = subscription.monthlyScansUsed || 0;

        if (currentUsage >= planLimit) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            'Monthly scan limit reached. Please contact support for higher limits.',
          );
        }

        // Increment scan count
        transaction.update(subscriptionRef, {
          monthlyScansUsed: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const newUsage = currentUsage + 1;
        const scansRemaining = planLimit - newUsage;

        return {
          success: true,
          canScan: scansRemaining > 0,
          scansRemaining,
          scansUsed: newUsage,
        };
      });
    } catch (error) {
      console.error('Record scan usage error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to record scan usage',
      );
    }
  });

/**
 * Extend trial by 1 month (one-time offer)
 */
export const extendTrial = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;

    try {
      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();

      if (!subscriptionDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Subscription not found',
        );
      }

      const subscription = subscriptionDoc.data() as Subscription;

      if (subscription.trialExtended) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Trial can only be extended once',
        );
      }

      // Prevent extending trial if user already has paid subscription
      if (subscription.isSubscribed) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Cannot extend trial for users with active subscription',
        );
      }

      // Check if extension is within 7 days of trial end
      if (subscription.trialEndDate) {
        const trialEnd =
          subscription.trialEndDate instanceof admin.firestore.Timestamp
            ? subscription.trialEndDate.toDate()
            : new Date(subscription.trialEndDate);

        const daysSinceExpiry = Math.ceil(
          (Date.now() - trialEnd.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceExpiry > 7) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Extension period has expired',
          );
        }
      }

      // Extend trial
      const newTrialEnd = addDays(new Date(), TRIAL_EXTENSION_DAYS);

      await subscriptionRef.update({
        trialEndDate: admin.firestore.Timestamp.fromDate(newTrialEnd),
        trialExtended: true,
        status: 'trial',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        newTrialEndDate: newTrialEnd.toISOString(),
        extensionDays: TRIAL_EXTENSION_DAYS,
      };
    } catch (error) {
      console.error('Extend trial error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to extend trial',
      );
    }
  });

/**
 * Upgrade subscription (called after successful payment)
 */
export const upgradeSubscription = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {planId, transactionId, paymentDetails, durationMonths = 1} = data;

    if (!planId || !transactionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Plan ID and transaction ID are required',
      );
    }

    const validPlans = ['basic', 'standard', 'premium'];
    if (!validPlans.includes(planId)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid plan');
    }

    const validDurations = [1, 3, 6, 12];
    const duration = validDurations.includes(durationMonths)
      ? durationMonths
      : 1;

    try {
      // Idempotency check - prevent processing same transaction twice
      const existingTransaction = await db
        .collectionGroup('subscription')
        .where('transactionId', '==', transactionId)
        .limit(1)
        .get();

      if (!existingTransaction.empty) {
        const existingData = existingTransaction.docs[0].data() as Subscription;
        // Transaction already processed - return existing result
        return {
          success: true,
          planId: existingData.planId,
          durationMonths: existingData.durationMonths || duration,
          scanLimit: PLAN_SCAN_LIMITS[existingData.planId || planId] || 25,
          expiresAt: existingData.subscriptionEndDate,
          message: 'Transaction already processed (idempotent)',
        };
      }

      const subscriptionRef = db.doc(collections.subscription(userId));
      const now = new Date();

      // Check for existing subscription
      const existingSubscription = await subscriptionRef.get();
      const existingData = existingSubscription.exists
        ? (existingSubscription.data() as Subscription)
        : null;

      // Calculate subscription end date
      let endDate: Date;
      let subscriptionStartDate = now;

      if (
        existingData?.isSubscribed &&
        existingData?.subscriptionEndDate &&
        existingData.status === 'active'
      ) {
        // User is upgrading with active subscription
        // Preserve remaining time by extending from current end date
        const currentEndDate =
          existingData.subscriptionEndDate instanceof admin.firestore.Timestamp
            ? existingData.subscriptionEndDate.toDate()
            : new Date(existingData.subscriptionEndDate);

        if (currentEndDate > now) {
          // Add new duration to existing end date (user keeps remaining time)
          endDate = addMonths(currentEndDate, duration);
          console.log(
            `Upgrading with active subscription. Extended from ${currentEndDate.toISOString()} to ${endDate.toISOString()}`,
          );
        } else {
          // Old subscription expired, start fresh
          endDate = addMonths(now, duration);
        }
      } else {
        // No active subscription, start fresh
        endDate = addMonths(now, duration);
      }

      // Reset billing period start (monthly billing cycle for scan reset)
      const billingPeriodStart = new Date(now);
      const billingPeriodEnd = addMonths(now, 1);

      // Calculate pricing
      const pricing = calculateSubscriptionPrice(
        planId,
        duration as SubscriptionDuration,
      );

      await subscriptionRef.set(
        {
          userId,
          isSubscribed: true,
          planId,
          status: 'active',
          durationMonths: duration,
          monthlyScansUsed: 0, // Reset monthly usage on upgrade
          currentBillingPeriodStart:
            admin.firestore.Timestamp.fromDate(billingPeriodStart),
          currentBillingPeriodEnd:
            admin.firestore.Timestamp.fromDate(billingPeriodEnd),
          subscriptionStartDate:
            admin.firestore.Timestamp.fromDate(subscriptionStartDate),
          subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
          lastPaymentDate: admin.firestore.Timestamp.fromDate(now),
          lastPaymentAmount: pricing.total,
          transactionId,
          autoRenew: true,
          expirationNotificationSent: false,
          ...paymentDetails,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );

      return {
        success: true,
        planId,
        durationMonths: duration,
        scanLimit: PLAN_SCAN_LIMITS[planId] || 25,
        expiresAt: endDate.toISOString(),
        pricing,
      };
    } catch (error) {
      console.error('Upgrade subscription error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to upgrade subscription',
      );
    }
  });

/**
 * Downgrade subscription plan
 * User downgrades to a lower tier, keeps current subscription period
 * Change takes effect immediately with prorated credit (optional)
 */
export const downgradeSubscription = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {newPlanId, immediate = true} = data;

    if (!newPlanId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'New plan ID is required',
      );
    }

    const validPlans = ['basic', 'standard', 'premium'];
    if (!validPlans.includes(newPlanId)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid plan');
    }

    try {
      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();

      if (!subscriptionDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Subscription not found',
        );
      }

      const subscription = subscriptionDoc.data() as Subscription;

      if (!subscription.isSubscribed || !subscription.planId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No active subscription to downgrade',
        );
      }

      // Validate downgrade (can't "downgrade" to a higher plan)
      const planHierarchy: Record<string, number> = {
        basic: 1,
        standard: 2,
        premium: 3,
      };

      const currentPlanLevel = planHierarchy[subscription.planId];
      const newPlanLevel = planHierarchy[newPlanId];

      if (newPlanLevel >= currentPlanLevel) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Cannot downgrade from ${subscription.planId} to ${newPlanId}. Use upgradeSubscription instead.`,
        );
      }

      const now = new Date();
      const subscriptionEnd =
        subscription.subscriptionEndDate instanceof admin.firestore.Timestamp
          ? subscription.subscriptionEndDate.toDate()
          : new Date(subscription.subscriptionEndDate!);

      // Calculate remaining days
      const daysRemaining = Math.max(
        0,
        Math.ceil((subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      );

      // Calculate prorated credit (optional - for future refund feature)
      const currentPlanPrice = BASE_PRICES[subscription.planId];
      const newPlanPrice = BASE_PRICES[newPlanId];
      const daysInPeriod =
        subscription.durationMonths === 1
          ? 30
          : subscription.durationMonths! * 30;
      const creditPerDay = (currentPlanPrice - newPlanPrice) / daysInPeriod;
      const proratedCredit = Math.round(creditPerDay * daysRemaining * 100) / 100;

      if (immediate) {
        // Immediate downgrade - applies now
        // Reset monthly scans if new plan has lower limit
        const newScanLimit = PLAN_SCAN_LIMITS[newPlanId];
        const currentMonthlyScans = subscription.monthlyScansUsed || 0;

        const updates: Partial<Subscription> = {
          planId: newPlanId as 'basic' | 'standard' | 'premium',
          updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
        };

        // If user has exceeded new plan's limit, cap their usage
        if (currentMonthlyScans > newScanLimit) {
          updates.monthlyScansUsed = newScanLimit;
        }

        await subscriptionRef.update(updates);

        return {
          success: true,
          newPlanId,
          scanLimit: newScanLimit,
          monthlyScansRemaining:
            newScanLimit === -1
              ? -1
              : Math.max(0, newScanLimit - (updates.monthlyScansUsed || currentMonthlyScans)),
          proratedCredit, // For future refund feature
          message: 'Plan downgraded immediately',
          effectiveDate: now.toISOString(),
        };
      } else {
        // Scheduled downgrade - takes effect at end of current period
        await subscriptionRef.update({
          pendingDowngradePlanId: newPlanId,
          pendingDowngradeEffectiveDate:
            admin.firestore.Timestamp.fromDate(subscriptionEnd),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          newPlanId,
          scanLimit: PLAN_SCAN_LIMITS[newPlanId],
          message: `Plan will downgrade to ${newPlanId} on ${subscriptionEnd.toISOString()}`,
          effectiveDate: subscriptionEnd.toISOString(),
        };
      }
    } catch (error) {
      console.error('Downgrade subscription error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to downgrade subscription',
      );
    }
  });

/**
 * Renew/Resubscribe before expiration
 * Allows users to renew early - extends from current end date
 */
export const renewSubscription = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {planId, transactionId, paymentDetails, durationMonths = 1} = data;

    if (!planId || !transactionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Plan ID and transaction ID are required',
      );
    }

    const validPlans = ['basic', 'standard', 'premium'];
    if (!validPlans.includes(planId)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid plan');
    }

    const validDurations = [1, 3, 6, 12];
    const duration = validDurations.includes(durationMonths)
      ? durationMonths
      : 1;

    try {
      // Idempotency check - prevent processing same renewal twice
      const existingTransaction = await db
        .collectionGroup('subscription')
        .where('transactionId', '==', transactionId)
        .limit(1)
        .get();

      if (!existingTransaction.empty) {
        const existingData = existingTransaction.docs[0].data() as Subscription;
        return {
          success: true,
          planId: existingData.planId,
          durationMonths: existingData.durationMonths || duration,
          scanLimit: PLAN_SCAN_LIMITS[existingData.planId || planId] || 25,
          expiresAt: existingData.subscriptionEndDate,
          message: 'Renewal already processed (idempotent)',
        };
      }

      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();

      const now = new Date();
      let startDate = now;

      // If subscription exists and is still active, extend from current end date
      if (subscriptionDoc.exists) {
        const currentSubscription = subscriptionDoc.data() as Subscription;

        if (
          currentSubscription.isSubscribed &&
          currentSubscription.subscriptionEndDate
        ) {
          const currentEndDate =
            currentSubscription.subscriptionEndDate instanceof
            admin.firestore.Timestamp
              ? currentSubscription.subscriptionEndDate.toDate()
              : new Date(currentSubscription.subscriptionEndDate);

          // If current subscription hasn't expired yet, extend from that date
          if (currentEndDate > now) {
            startDate = currentEndDate;
          }
        }
      }

      // Calculate new end date from the start date (using date-fns)
      const endDate = addMonths(startDate, duration);

      // Calculate pricing
      const pricing = calculateSubscriptionPrice(
        planId,
        duration as SubscriptionDuration,
      );

      await subscriptionRef.set(
        {
          userId,
          isSubscribed: true,
          planId,
          status: 'active',
          durationMonths: duration,
          monthlyScansUsed: 0,
          subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
          subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
          lastPaymentDate: admin.firestore.Timestamp.fromDate(now),
          lastPaymentAmount: pricing.total,
          transactionId,
          autoRenew: true,
          expirationNotificationSent: false,
          expirationNotificationDate: null,
          daysUntilExpiration: null,
          ...paymentDetails,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );

      return {
        success: true,
        planId,
        durationMonths: duration,
        scanLimit: PLAN_SCAN_LIMITS[planId] || 25,
        expiresAt: endDate.toISOString(),
        renewedFrom: startDate.toISOString(),
        pricing,
        message:
          startDate > now
            ? `Subscription extended to ${endDate.toLocaleDateString()}`
            : `Subscription renewed until ${endDate.toLocaleDateString()}`,
      };
    } catch (error) {
      console.error('Renew subscription error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to renew subscription',
      );
    }
  });

/**
 * Get subscription pricing for all durations
 */
export const getSubscriptionPricing = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    const {planId = 'standard'} = data;

    const validPlans = ['basic', 'standard', 'premium'];
    if (!validPlans.includes(planId)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid plan');
    }

    const durations: SubscriptionDuration[] = [1, 3, 6];
    const pricing = durations.map(duration => ({
      duration,
      label:
        duration === 1
          ? '1 Month'
          : `${duration} Months`,
      labelFr:
        duration === 1
          ? '1 Mois'
          : `${duration} Mois`,
      ...calculateSubscriptionPrice(planId, duration),
    }));

    return {
      planId,
      baseMonthlyPrice: BASE_PRICES[planId],
      scanLimit: PLAN_SCAN_LIMITS[planId],
      pricing,
    };
  });

/**
 * Cancel subscription
 */
export const cancelSubscription = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;

    try {
      const subscriptionRef = db.doc(collections.subscription(userId));
      const subscriptionDoc = await subscriptionRef.get();

      if (!subscriptionDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Subscription not found',
        );
      }

      const subscription = subscriptionDoc.data() as Subscription;

      if (!subscription.isSubscribed) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No active subscription to cancel',
        );
      }

      // Don't immediately cancel - disable auto-renew
      // User keeps access until subscription end date
      await subscriptionRef.update({
        autoRenew: false,
        status: 'cancelled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: 'Subscription will not renew. Access continues until expiry.',
        expiresAt: subscription.subscriptionEndDate,
      };
    } catch (error) {
      console.error('Cancel subscription error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to cancel subscription',
      );
    }
  });

/**
 * Scheduled function to check and expire subscriptions
 * Also resets monthly scan counts and expires trials
 * Runs daily at midnight
 */
export const checkExpiredSubscriptions = functions
  .region(config.app.region)
  .pubsub.schedule('0 0 * * *')
  .timeZone('Africa/Kinshasa')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    try {
      // 1. Find and expire active subscriptions that have ended
      const expiredQuery = await db
        .collectionGroup('subscription')
        .where('isSubscribed', '==', true)
        .where('subscriptionEndDate', '<', now)
        .get();

      let expiredCount = 0;
      const expiredBatch = db.batch();

      expiredQuery.docs.forEach(doc => {
        console.log(`Expiring subscription for user, moving to freemium plan`);
        
        // Move to freemium plan instead of just marking as expired
        const billingStart = new Date();
        const billingEnd = addMonths(billingStart, 1);
        
        expiredBatch.update(doc.ref, {
          planId: 'freemium',
          isSubscribed: false,
          status: 'freemium',
          expiresAt: admin.firestore.FieldValue.delete(),
          subscriptionEndDate: admin.firestore.FieldValue.delete(),
          monthlyScansUsed: 0,
          currentBillingPeriodStart: admin.firestore.Timestamp.fromDate(billingStart),
          currentBillingPeriodEnd: admin.firestore.Timestamp.fromDate(billingEnd),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        expiredCount++;
      });

      if (expiredCount > 0) {
        await expiredBatch.commit();
        console.log(`Expired ${expiredCount} subscriptions and moved to freemium plan`);
      }

      // 2. Expire trials that have ended
      const expiredTrialsQuery = await db
        .collectionGroup('subscription')
        .where('status', '==', 'trial')
        .where('trialEndDate', '<', now)
        .get();

      let trialExpiredCount = 0;
      const trialBatch = db.batch();

      expiredTrialsQuery.docs.forEach(doc => {
        console.log(`Trial expired for user, moving to freemium plan`);
        
        // Move to freemium plan when trial expires
        const billingStart = new Date();
        const billingEnd = addMonths(billingStart, 1);
        
        trialBatch.update(doc.ref, {
          planId: 'freemium',
          status: 'freemium',
          isSubscribed: false,
          expiresAt: admin.firestore.FieldValue.delete(),
          trialEndDate: admin.firestore.FieldValue.delete(),
          monthlyScansUsed: 0,
          currentBillingPeriodStart: admin.firestore.Timestamp.fromDate(billingStart),
          currentBillingPeriodEnd: admin.firestore.Timestamp.fromDate(billingEnd),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        trialExpiredCount++;
      });

      if (trialExpiredCount > 0) {
        await trialBatch.commit();
        console.log(`Expired ${trialExpiredCount} trials and moved to freemium plan`);
      }

      // 3. Apply pending downgrades that have reached their effective date
      const pendingDowngradesQuery = await db
        .collectionGroup('subscription')
        .where('pendingDowngradePlanId', '!=', null)
        .where('pendingDowngradeEffectiveDate', '<=', now)
        .get();

      let downgradeCount = 0;
      const downgradeBatch = db.batch();

      pendingDowngradesQuery.docs.forEach(doc => {
        const subscription = doc.data() as Subscription;
        const newPlanId = subscription.pendingDowngradePlanId!;

        downgradeBatch.update(doc.ref, {
          planId: newPlanId,
          pendingDowngradePlanId: admin.firestore.FieldValue.delete(),
          pendingDowngradeEffectiveDate: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        downgradeCount++;
      });

      if (downgradeCount > 0) {
        await downgradeBatch.commit();
        console.log(`Applied ${downgradeCount} pending downgrades`);
      }

      // 4. Reset monthly scans for subscriptions starting a new billing period
      const resetScansQuery = await db
        .collectionGroup('subscription')
        .where('isSubscribed', '==', true)
        .where('currentBillingPeriodEnd', '<', now)
        .get();

      let resetCount = 0;

      // Use batch writes for better performance and atomicity
      const resetBatch = db.batch();
      
      for (const doc of resetScansQuery.docs) {
        // Calculate new billing period using date-fns
        const newBillingStart = new Date();
        const newBillingEnd = addMonths(newBillingStart, 1);

        resetBatch.update(doc.ref, {
          monthlyScansUsed: 0,
          currentBillingPeriodStart:
            admin.firestore.Timestamp.fromDate(newBillingStart),
          currentBillingPeriodEnd:
            admin.firestore.Timestamp.fromDate(newBillingEnd),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        resetCount++;
      }

      if (resetCount > 0) {
        await resetBatch.commit();
      }

      if (resetCount > 0) {
        console.log(`Reset monthly scans for ${resetCount} subscriptions`);
      }

      return null;
    } catch (error) {
      console.error('Check expired subscriptions error:', error);
      return null;
    }
  });

export const getUserStats = functions
  .region(config.app.region)
  .runWith({
    enforceAppCheck: false,
    timeoutSeconds: 60,
  })
  .https.onCall(async (data, context) => {
    try {
      // Check authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated to get stats',
        );
      }

      const userId = context.auth.uid;
      const db = admin.firestore();

      console.log(`Getting stats for user: ${userId}`);

      // Get user's receipts - try both possible paths
      let receiptsSnapshot;
      try {
        const receiptsRef = db
          .collection(`artifacts/${config.app.id}/users`)
          .doc(userId)
          .collection('receipts');
        receiptsSnapshot = await receiptsRef.get();
        console.log(`Found ${receiptsSnapshot.size} receipts`);
      } catch (receiptError) {
        console.log('No receipts collection found, returning zeros');
        receiptsSnapshot = {docs: [], size: 0, forEach: () => {}};
      }

      let totalReceipts = 0;
      let totalSavings = 0;
      let totalSpent = 0;

      // Process receipts sequentially to handle async operations
      for (const doc of receiptsSnapshot.docs) {
        const receipt = doc.data();
        totalReceipts++;

        // Calculate total spent from items using totalPrice
        if (receipt.items && Array.isArray(receipt.items)) {
          receipt.items.forEach((item: any) => {
            if (item.totalPrice && typeof item.totalPrice === 'number') {
              totalSpent += item.totalPrice;
            }
          });
        }

        // Use total amount if available (preferring USD, then CDF, then calculated)
        if (receipt.totalUSD && typeof receipt.totalUSD === 'number') {
          totalSpent = receipt.totalUSD;
        } else if (receipt.totalCDF && typeof receipt.totalCDF === 'number') {
          // Convert CDF to USD using configurable exchange rate
          const exchangeRate = await getExchangeRate();
          totalSpent = receipt.totalCDF / exchangeRate;
        } else if (receipt.total && typeof receipt.total === 'number') {
          totalSpent = receipt.total;
        }
      }

      // Get subscription status using the correct collection path
      let subscriptionStatus = 'free';
      let monthlyScansUsed = 0;
      let monthlyScansLimit = 5; // Default free tier

      try {
        const subscriptionRef = db.doc(collections.subscription(userId));
        const subscriptionDoc = await subscriptionRef.get();

        if (subscriptionDoc.exists) {
          const subscription = subscriptionDoc.data() as Subscription;
          subscriptionStatus = subscription.status || 'free';
          monthlyScansUsed = subscription.monthlyScansUsed || 0;
          monthlyScansLimit =
            PLAN_SCAN_LIMITS[subscription.planId || 'free'] || 5;
        }
      } catch (subError) {
        console.log('No subscription found, using defaults');
      }

      console.log(`Stats: receipts=${totalReceipts}, spent=${totalSpent}`);

      return {
        totalReceipts,
        totalSavings, // This will be 0 for now since we don't have savings calculation
        totalSpent,
        subscriptionStatus,
        monthlyScansUsed,
        monthlyScansLimit,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (error) {
      console.error('Get user stats error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get user statistics',
      );
    }
  });
