// Subscription Service
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import {addDays} from 'date-fns';
import {Subscription, SubscriptionState} from '@/shared/types';
import {COLLECTIONS, APP_ID} from './config';
import {authService} from './auth';
import {
  TRIAL_DURATION_DAYS,
  TRIAL_EXTENSION_DAYS,
  TRIAL_SCAN_LIMIT,
  PLAN_SCAN_LIMITS,
} from '@/shared/utils/constants';

class SubscriptionService {
  /**
   * Get current subscription status
   */
  async getStatus(): Promise<Subscription> {
    const user = authService.getCurrentUser();
    if (!user) {
      return this.getDefaultSubscription('');
    }

    try {
      const doc = await firestore()
        .doc(COLLECTIONS.subscription(user.uid))
        .get();

      if (!doc.exists) {
        // Initialize subscription for new user
        const subscription = this.getDefaultSubscription(user.uid);
        await this.initializeSubscription(user.uid, subscription);
        return subscription;
      }

      const data = doc.data()!;
      return this.mapSubscription(data);
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  }

  /**
   * Check if user's trial is active (time-based, 2 months)
   */
  isTrialActive(subscription: Subscription): boolean {
    if (!subscription.trialStartDate || !subscription.trialEndDate) {
      return false;
    }

    const now = new Date();
    const trialEnd = new Date(subscription.trialEndDate);
    return now < trialEnd && subscription.status === 'trial';
  }

  /**
   * Get remaining trial days
   */
  getTrialDaysRemaining(subscription: Subscription): number {
    if (!subscription.trialEndDate) {
      return 0;
    }

    const now = new Date();
    const trialEnd = new Date(subscription.trialEndDate);
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Check if user can scan (trial active, has plan scans, or is premium)
   */
  async canScan(): Promise<boolean> {
    const subscription = await this.getStatus();

    // Check if trial is active (time-based)
    if (this.isTrialActive(subscription)) {
      return true; // Unlimited scans during trial
    }

    // Check active subscription (including cancelled but not expired)
    if (subscription.isSubscribed && (subscription.status === 'active' || subscription.status === 'cancelled')) {
      // Check if subscription hasn't expired
      if (subscription.subscriptionEndDate) {
        const isValid = new Date(subscription.subscriptionEndDate) > new Date();
        if (!isValid) {
          return false;
        }
      }

      // Premium users have unlimited scans
      if (subscription.planId === 'premium') {
        return true;
      }

      // Basic/Standard users have limited monthly scans
      const planLimit =
        PLAN_SCAN_LIMITS[
          subscription.planId as keyof typeof PLAN_SCAN_LIMITS
        ] || 0;
      if (planLimit === -1) {
        return true;
      } // Unlimited

      return (subscription.monthlyScansUsed || 0) < planLimit;
    }

    return false;
  }

  /**
   * Get remaining scans based on plan
   */
  async getScansRemaining(): Promise<number> {
    const subscription = await this.getStatus();

    // Trial users have unlimited scans
    if (this.isTrialActive(subscription)) {
      return Infinity;
    }

    // Check active subscription (including cancelled but not expired)
    if (subscription.isSubscribed && (subscription.status === 'active' || subscription.status === 'cancelled')) {
      // Premium users have unlimited scans
      if (subscription.planId === 'premium') {
        return Infinity;
      }

      const planLimit =
        PLAN_SCAN_LIMITS[
          subscription.planId as keyof typeof PLAN_SCAN_LIMITS
        ] || 0;
      if (planLimit === -1) {
        return Infinity;
      }

      return Math.max(0, planLimit - (subscription.monthlyScansUsed || 0));
    }

    return 0;
  }

  /**
   * Record a scan usage
   */
  async recordScanUsage(): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const subscription = await this.getStatus();

    // Trial users don't consume monthly scans
    if (this.isTrialActive(subscription)) {
      // Just increment trial usage counter for analytics
      await firestore()
        .doc(COLLECTIONS.subscription(user.uid))
        .update({
          trialScansUsed: firestore.FieldValue.increment(1),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      return;
    }

    // Premium users have unlimited scans (including cancelled)
    if (subscription.planId === 'premium' && (subscription.status === 'active' || subscription.status === 'cancelled')) {
      return;
    }

    // Basic/Standard users have limited scans (including cancelled)
    if (subscription.isSubscribed && (subscription.status === 'active' || subscription.status === 'cancelled')) {
      const planLimit =
        PLAN_SCAN_LIMITS[
          subscription.planId as keyof typeof PLAN_SCAN_LIMITS
        ] || 0;

      if (
        planLimit !== -1 &&
        (subscription.monthlyScansUsed || 0) >= planLimit
      ) {
        throw new Error(
          'Limite de scans atteinte. Passez à Premium pour des scans illimités.',
        );
      }

      await firestore()
        .doc(COLLECTIONS.subscription(user.uid))
        .update({
          monthlyScansUsed: firestore.FieldValue.increment(1),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      return;
    }

    throw new Error('Abonnement requis. Veuillez souscrire pour continuer.');
  }

  /**
   * Extend trial by 1 month (one-time offer)
   */
  async extendTrial(): Promise<boolean> {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const subscription = await this.getStatus();

    // Can only extend if not already extended
    if (subscription.trialExtended) {
      throw new Error("L'essai a déjà été prolongé une fois.");
    }

    // Can only extend if trial ended within 7 days
    if (subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      const now = new Date();
      const daysSinceExpiry = Math.ceil(
        (now.getTime() - trialEnd.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceExpiry > 7) {
        throw new Error('La période de prolongation est expirée.');
      }
    }

    // Extend trial by TRIAL_EXTENSION_DAYS using date-fns
    const newTrialEnd = addDays(new Date(), TRIAL_EXTENSION_DAYS);

    await firestore().doc(COLLECTIONS.subscription(user.uid)).update({
      trialEndDate: newTrialEnd,
      trialExtended: true,
      status: 'trial',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return true;
  }

  /**
   * Subscribe to subscription status changes
   */
  subscribeToStatus(
    callback: (subscription: Subscription) => void,
  ): () => void {
    const user = authService.getCurrentUser();
    if (!user) {
      callback(this.getDefaultSubscription(''));
      return () => {};
    }

    return firestore()
      .doc(COLLECTIONS.subscription(user.uid))
      .onSnapshot(
        doc => {
          if (doc.exists) {
            callback(this.mapSubscription(doc.data()!));
          } else {
            callback(this.getDefaultSubscription(user.uid));
          }
        },
        error => {
          console.error('Subscription snapshot error:', error);
        },
      );
  }

  /**
   * Verify payment with backend
   */
  async verifyPayment(transactionRef: string): Promise<boolean> {
    try {
      const verifyPayment = functions().httpsCallable('verifyMokoPayment');
      const result = await verifyPayment({transactionRef});
      return (result.data as {verified: boolean}).verified;
    } catch (error) {
      console.error('Payment verification failed:', error);
      return false;
    }
  }

  /**
   * Initialize subscription for new user
   */
  private async initializeSubscription(
    userId: string,
    subscription: Subscription,
  ): Promise<void> {
    // Calculate trial end date (2 months from now) using date-fns
    const trialStartDate = new Date();
    const trialEndDate = addDays(trialStartDate, TRIAL_DURATION_DAYS);

    await firestore()
      .doc(COLLECTIONS.subscription(userId))
      .set({
        ...subscription,
        trialStartDate: trialStartDate,
        trialEndDate: trialEndDate,
        trialExtended: false,
        monthlyScansUsed: 0,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Get default subscription for new users
   */
  private getDefaultSubscription(userId: string): Subscription {
    const trialStartDate = new Date();
    const trialEndDate = addDays(trialStartDate, TRIAL_DURATION_DAYS);

    return {
      userId,
      trialScansUsed: 0,
      trialScansLimit: TRIAL_SCAN_LIMIT, // -1 for unlimited during trial
      trialStartDate: trialStartDate,
      trialEndDate: trialEndDate,
      trialExtended: false,
      monthlyScansUsed: 0,
      isSubscribed: false,
      status: 'trial',
      autoRenew: false,
    };
  }

  /**
   * Map Firestore data to Subscription type
   */
  private mapSubscription(data: any): Subscription {
    return {
      userId: data.userId,
      trialScansUsed: data.trialScansUsed || 0,
      trialScansLimit: data.trialScansLimit || TRIAL_SCAN_LIMIT,
      trialStartDate: data.trialStartDate?.toDate?.() || data.trialStartDate,
      trialEndDate: data.trialEndDate?.toDate?.() || data.trialEndDate,
      trialExtended: data.trialExtended || false,
      monthlyScansUsed: data.monthlyScansUsed || 0,
      currentBillingPeriodStart:
        data.currentBillingPeriodStart?.toDate?.() ||
        data.currentBillingPeriodStart,
      currentBillingPeriodEnd:
        data.currentBillingPeriodEnd?.toDate?.() ||
        data.currentBillingPeriodEnd,
      isSubscribed: data.isSubscribed || false,
      planId: data.planId || data.plan,
      plan: data.plan || data.planId,
      status: data.status || 'trial',
      subscriptionStartDate:
        data.subscriptionStartDate?.toDate?.() || data.subscriptionStartDate,
      subscriptionEndDate:
        data.subscriptionEndDate?.toDate?.() || data.subscriptionEndDate,
      expiryDate:
        data.expiryDate?.toDate?.() ||
        data.subscriptionEndDate?.toDate?.() ||
        data.expiryDate,
      lastPaymentDate: data.lastPaymentDate?.toDate?.() || data.lastPaymentDate,
      lastPaymentAmount: data.lastPaymentAmount,
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      paymentProvider: data.paymentProvider,
      mobileMoneyProvider: data.mobileMoneyProvider,
      transactionId: data.transactionId,
      transactionRef: data.transactionRef,
      customerPhone: data.customerPhone,
      autoRenew: data.autoRenew || false,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
    };
  }
}

export const subscriptionService = new SubscriptionService();
