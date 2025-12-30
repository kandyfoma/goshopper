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
      if (!doc.exists || !doc.data()) {
        console.warn('📦 Document missing after freemium reset, returning original subscription');
        return subscription;
      }
      return this.mapSubscription(doc.data());
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
   * Handles edge case where join day doesn't exist in current month (e.g., 31st)
   */
  private calculateFreemiumBillingPeriod(joinDate: Date): { billingStart: Date; billingEnd: Date } {
    const now = new Date();
    const joinDay = joinDate.getDate();
    
    // Get the last day of the current and previous month
    const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    
    // Use the join day or the last day of month if join day doesn't exist
    const effectiveJoinDayThisMonth = Math.min(joinDay, lastDayOfCurrentMonth);
    const effectiveJoinDayPrevMonth = Math.min(joinDay, lastDayOfPrevMonth);
    
    // Find the current billing period start
    let billingStart: Date;
    
    // If we've passed the join day this month, billing started this month
    // If we haven't reached the join day yet, billing started last month
    if (now.getDate() >= effectiveJoinDayThisMonth) {
      billingStart = new Date(now.getFullYear(), now.getMonth(), effectiveJoinDayThisMonth);
    } else {
      billingStart = new Date(now.getFullYear(), now.getMonth() - 1, effectiveJoinDayPrevMonth);
    }
    
    // Billing end is one month after billing start
    // Handle end-of-month edge cases
    const nextMonth = new Date(billingStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const billingEndDay = Math.min(joinDay, lastDayOfNextMonth);
    const billingEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), billingEndDay);
    
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
   * Record a scan usage - calls Cloud Function for security
   */
  async recordScanUsage(): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    console.log('📸 Recording scan usage for user:', user.uid);

    try {
      // Call Cloud Function to record scan usage (handles all validation and updates)
      const recordScanUsageFunction = functions().httpsCallable('recordScanUsage');
      const result = await recordScanUsageFunction({});
      const data = result.data as { success: boolean; error?: string };

      console.log('📸 Scan recorded via Cloud Function:', data);

      if (!data.success) {
        throw new Error(data.error || 'Échec de l\'enregistrement du scan');
      }
    } catch (error: any) {
      console.error('📸 Error recording scan:', error);
      
      // Handle specific Cloud Function errors
      if (error.code === 'functions/resource-exhausted') {
        throw new Error('Limite de scans atteinte. Passez à un plan supérieur pour plus de scans.');
      }
      if (error.code === 'functions/failed-precondition') {
        throw new Error('Abonnement non initialisé. Veuillez contacter le support.');
      }
      if (error.code === 'functions/unauthenticated') {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      throw error;
    }
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
    onError?: (error: Error) => void,
  ): () => void {
    const user = authService.getCurrentUser();
    if (!user) {
      callback(this.getDefaultSubscription(''));
      return () => {};
    }
    
    return firestore()
      .doc(COLLECTIONS.subscription(user.uid))
      .onSnapshot(
        {includeMetadataChanges: true}, // Include metadata to detect cache vs server
        async doc => {
          const fromCache = doc.metadata.fromCache;
          
          if (doc.exists) {
            const data = doc.data()!;
            callback(this.mapSubscription(data));
          } else {
            console.log('📋 Subscription document does not exist for user:', user.uid);
            console.log('📋 Auto-creating trial subscription...');
            // Auto-create subscription for new user
            const subscription = this.getDefaultSubscription(user.uid);
            try {
              await this.initializeSubscription(user.uid, subscription);
              console.log('✅ Trial subscription created for user:', user.uid);
            } catch (initError) {
              console.error('❌ Failed to create subscription:', initError);
            }
            // Return default subscription immediately (snapshot will update when doc is created)
            callback(subscription);
          }
        },
        error => {
          console.error('❌ Subscription snapshot error:', error);
          // Notify caller of error
          if (onError) {
            onError(error);
          }
          // Provide fallback subscription to prevent UI from being stuck
          callback(this.getDefaultSubscription(user.uid));
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
      bonusScans: data.bonusScans || 0,
      bonusScansCarriedOver: data.bonusScansCarriedOver || 0,
      emergencyScansUsed: data.emergencyScansUsed || 0,
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
