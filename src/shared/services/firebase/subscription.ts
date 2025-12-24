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
      // Force fetch from server to get latest data (bypass cache)
      const doc = await firestore()
        .doc(COLLECTIONS.subscription(user.uid))
        .get({source: 'server'});

      console.log('📊 getStatus - fetched from server for user:', user.uid);

      if (!doc.exists) {
        // Initialize subscription for new user
        const subscription = this.getDefaultSubscription(user.uid);
        await this.initializeSubscription(user.uid, subscription);
        return subscription;
      }

      const data = doc.data()!;
      console.log('📊 getStatus - raw data:', {
        status: data.status,
        isSubscribed: data.isSubscribed,
        planId: data.planId,
      });
      
      let subscription = this.mapSubscription(data);

      // Check if trial has expired and user has no active subscription
      // If so, auto-assign freemium tier
      subscription = await this.checkAndAssignFreemium(subscription, user.uid);

      return subscription;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  }

  /**
   * Check if trial has expired and auto-assign freemium tier
   * Freemium tier resets monthly based on user's join date (trialStartDate)
   */
  private async checkAndAssignFreemium(subscription: Subscription, userId: string): Promise<Subscription> {
    const now = new Date();
    
    // If trial is still active, no need to assign freemium
    if (this.isTrialActive(subscription)) {
      return subscription;
    }
    
    // If user has an active paid subscription, no need for freemium
    if (subscription.isSubscribed && subscription.status === 'active') {
      return subscription;
    }
    
    // If already on freemium, check if monthly reset is needed
    if (subscription.status === 'freemium' || subscription.planId === 'freemium') {
      await this.checkAndResetFreemiumMonthly(subscription, userId);
      // Re-fetch after potential reset
      const doc = await firestore()
        .doc(COLLECTIONS.subscription(userId))
        .get();
      return this.mapSubscription(doc.data()!);
    }
    
    // Trial has expired and no active subscription - assign freemium
    if (subscription.status === 'trial' && subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      if (now > trialEnd) {
        console.log('📦 Trial expired, auto-assigning freemium tier for user:', userId);
        
        // Calculate billing period based on join date (trialStartDate)
        const joinDate = subscription.trialStartDate || subscription.createdAt || new Date();
        const { billingStart, billingEnd } = this.calculateFreemiumBillingPeriod(new Date(joinDate));
        
        await firestore()
          .doc(COLLECTIONS.subscription(userId))
          .update({
            status: 'freemium',
            planId: 'freemium',
            isSubscribed: false,
            monthlyScansUsed: 0,
            currentBillingPeriodStart: billingStart,
            currentBillingPeriodEnd: billingEnd,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        
        // Return updated subscription
        return {
          ...subscription,
          status: 'freemium',
          planId: 'freemium',
          isSubscribed: false,
          monthlyScansUsed: 0,
          currentBillingPeriodStart: billingStart,
          currentBillingPeriodEnd: billingEnd,
        };
      }
    }
    
    return subscription;
  }
  
  /**
   * Calculate billing period based on user's join date
   * The billing period resets on the same day of the month as the join date
   */
  private calculateFreemiumBillingPeriod(joinDate: Date): { billingStart: Date; billingEnd: Date } {
    const now = new Date();
    const joinDay = joinDate.getDate();
    
    // Find the current billing period start
    let billingStart = new Date(now.getFullYear(), now.getMonth(), joinDay);
    
    // If we've passed the join day this month, billing started this month
    // If we haven't reached the join day yet, billing started last month
    if (now.getDate() < joinDay) {
      billingStart.setMonth(billingStart.getMonth() - 1);
    }
    
    // Billing end is one month after billing start
    const billingEnd = new Date(billingStart);
    billingEnd.setMonth(billingEnd.getMonth() + 1);
    
    return { billingStart, billingEnd };
  }
  
  /**
   * Check if freemium monthly reset is needed
   */
  private async checkAndResetFreemiumMonthly(subscription: Subscription, userId: string): Promise<void> {
    const now = new Date();
    const billingEnd = subscription.currentBillingPeriodEnd;
    
    if (billingEnd && new Date(billingEnd) < now) {
      // Calculate new billing period based on join date
      const joinDate = subscription.trialStartDate || subscription.createdAt || new Date();
      const { billingStart, billingEnd: newBillingEnd } = this.calculateFreemiumBillingPeriod(new Date(joinDate));
      
      console.log('📅 Resetting freemium monthly usage - new billing period:', {
        start: billingStart.toISOString(),
        end: newBillingEnd.toISOString(),
      });
      
      await firestore()
        .doc(COLLECTIONS.subscription(userId))
        .update({
          monthlyScansUsed: 0,
          currentBillingPeriodStart: billingStart,
          currentBillingPeriodEnd: newBillingEnd,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
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
      // Check trial scan limit
      const trialLimit = PLAN_SCAN_LIMITS.free || 50;
      return (subscription.trialScansUsed || 0) < trialLimit;
    }

    // Check freemium tier (auto-assigned when trial expires)
    if (subscription.status === 'freemium' || subscription.planId === 'freemium') {
      const freemiumLimit = PLAN_SCAN_LIMITS.freemium || 3;
      return (subscription.monthlyScansUsed || 0) < freemiumLimit;
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

    // Check freemium tier
    if (subscription.status === 'freemium' || subscription.planId === 'freemium') {
      const freemiumLimit = PLAN_SCAN_LIMITS.freemium || 3;
      return Math.max(0, freemiumLimit - (subscription.monthlyScansUsed || 0));
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
   * Check if monthly billing period has ended and reset if needed
   */
  private async checkAndResetMonthlyUsage(subscription: Subscription, userId: string): Promise<void> {
    const now = new Date();
    const needsReset = subscription.currentBillingPeriodEnd 
      ? new Date(subscription.currentBillingPeriodEnd) < now
      : !subscription.currentBillingPeriodStart; // First time setup

    if (needsReset) {
      const newBillingStart = now;
      const newBillingEnd = new Date(now);
      newBillingEnd.setMonth(newBillingEnd.getMonth() + 1);

      console.log('📅 Resetting monthly usage - new billing period:', {
        start: newBillingStart.toISOString(),
        end: newBillingEnd.toISOString(),
      });

      await firestore()
        .doc(COLLECTIONS.subscription(userId))
        .update({
          trialScansUsed: 0, // Reset for trials
          monthlyScansUsed: 0, // Reset for paid users
          currentBillingPeriodStart: newBillingStart,
          currentBillingPeriodEnd: newBillingEnd,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
    }
  }

  /**
   * Record a scan usage
   */
  async recordScanUsage(): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    let subscription = await this.getStatus();
    
    // Check if subscription exists and is not inactive
    if (!subscription || subscription.status === 'inactive') {
      throw new Error('Abonnement non trouvé. Veuillez compléter votre profil ou contacter le support.');
    }

    console.log('📸 Recording scan usage for user:', user.uid);
    console.log('📸 Current subscription before check:', {
      isTrialActive: this.isTrialActive(subscription),
      trialScansUsed: subscription.trialScansUsed,
      monthlyScansUsed: subscription.monthlyScansUsed,
      planId: subscription.planId,
      status: subscription.status,
      billingPeriodEnd: subscription.currentBillingPeriodEnd,
    });

    // Check and reset monthly usage if needed (for both trial and paid)
    await this.checkAndResetMonthlyUsage(subscription, user.uid);
    
    // Reload subscription after potential reset
    subscription = await this.getStatus();

    console.log('📸 Current subscription after check:', {
      isTrialActive: this.isTrialActive(subscription),
      trialScansUsed: subscription.trialScansUsed,
      monthlyScansUsed: subscription.monthlyScansUsed,
      planId: subscription.planId,
      status: subscription.status,
      billingPeriodEnd: subscription.currentBillingPeriodEnd,
    });

    // Trial users have monthly scan limit
    if (this.isTrialActive(subscription)) {
      const trialLimit = TRIAL_SCAN_LIMIT;
      const currentUsage = subscription.trialScansUsed || 0;

      console.log('📸 Trial user - current usage:', currentUsage, '/', trialLimit);

      if (currentUsage >= trialLimit) {
        throw new Error(
          `Limite de scans mensuelle atteinte (${trialLimit} scans/mois). Attendez le début du mois prochain ou passez à Premium.`,
        );
      }

      console.log('📸 Incrementing trial scan count for user:', user.uid);
      await firestore()
        .doc(COLLECTIONS.subscription(user.uid))
        .update({
          trialScansUsed: firestore.FieldValue.increment(1),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      console.log('📸 Trial scan recorded successfully, new count:', currentUsage + 1, '/', trialLimit);
      return;
    }

    // Freemium users have 3 scans/month
    if (subscription.status === 'freemium' || subscription.planId === 'freemium') {
      const freemiumLimit = PLAN_SCAN_LIMITS.freemium || 3;
      const currentUsage = subscription.monthlyScansUsed || 0;

      console.log('📸 Freemium user - current usage:', currentUsage, '/', freemiumLimit);

      if (currentUsage >= freemiumLimit) {
        throw new Error(
          `Limite de scans gratuits atteinte (${freemiumLimit} scans/mois). Passez à un abonnement pour plus de scans.`,
        );
      }

      console.log('📸 Incrementing freemium scan count for user:', user.uid);
      await firestore()
        .doc(COLLECTIONS.subscription(user.uid))
        .update({
          monthlyScansUsed: firestore.FieldValue.increment(1),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      console.log('📸 Freemium scan recorded successfully, new count:', currentUsage + 1, '/', freemiumLimit);
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

    console.log('📊 Setting up subscription listener for user:', user.uid);
    
    return firestore()
      .doc(COLLECTIONS.subscription(user.uid))
      .onSnapshot(
        {includeMetadataChanges: true}, // Include metadata to detect cache vs server
        doc => {
          const fromCache = doc.metadata.fromCache;
          console.log(`📊 Subscription snapshot received (fromCache: ${fromCache})`);
          
          if (doc.exists) {
            const data = doc.data()!;
            console.log('📊 Raw subscription data from Firestore:', {
              status: data.status,
              isSubscribed: data.isSubscribed,
              planId: data.planId,
            });
            callback(this.mapSubscription(data));
          } else {
            console.warn('⚠️ Subscription document does not exist for user:', user.uid);
            console.warn('⚠️ User should complete onboarding or subscription needs to be created');
            // Return default subscription (which will have status 'inactive')
            callback(this.getDefaultSubscription(user.uid));
          }
        },
        error => {
          console.error('❌ Subscription snapshot error:', error);
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
    
    // Set initial billing period (monthly reset)
    const billingPeriodStart = new Date();
    const billingPeriodEnd = new Date();
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

    await firestore()
      .doc(COLLECTIONS.subscription(userId))
      .set({
        ...subscription,
        trialStartDate: trialStartDate,
        trialEndDate: trialEndDate,
        trialExtended: false,
        monthlyScansUsed: 0,
        currentBillingPeriodStart: billingPeriodStart,
        currentBillingPeriodEnd: billingPeriodEnd,
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
    const billingPeriodStart = new Date();
    const billingPeriodEnd = new Date();
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

    return {
      userId,
      trialScansUsed: 0,
      trialScansLimit: TRIAL_SCAN_LIMIT,
      trialStartDate: trialStartDate,
      trialEndDate: trialEndDate,
      trialExtended: false,
      monthlyScansUsed: 0,
      currentBillingPeriodStart: billingPeriodStart,
      currentBillingPeriodEnd: billingPeriodEnd,
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
