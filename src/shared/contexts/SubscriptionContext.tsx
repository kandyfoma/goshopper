// Subscription Context
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {Subscription, SubscriptionState} from '@/shared/types';
import {subscriptionService} from '@/shared/services/firebase';
import {useAuth} from './AuthContext';
import {PLAN_SCAN_LIMITS} from '@/shared/utils/constants';

interface SubscriptionContextType extends SubscriptionState {
  refreshSubscription: () => Promise<void>;
  recordScan: () => Promise<boolean>;
  checkCanScan: () => Promise<boolean>;
  extendTrial: () => Promise<boolean>;
  trialScansUsed: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({children}: SubscriptionProviderProps) {
  const {user, isAuthenticated} = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscription: null,
    isLoading: true,
    canScan: false,
    scansRemaining: 0,
    isTrialActive: false,
    trialDaysRemaining: 0,
    isExpiringSoon: false,
    daysUntilExpiration: 0,
    error: null,
  });

  // Helper to calculate subscription state
  const calculateState = useCallback(
    (subscription: Subscription | null): SubscriptionState => {
      // If no subscription or inactive status, user cannot scan
      if (!subscription || subscription.status === 'inactive') {
        console.warn('⚠️ No active subscription found - user cannot scan');
        return {
          subscription: subscription || null,
          isLoading: false,
          canScan: false,
          scansRemaining: 0,
          isTrialActive: false,
          trialDaysRemaining: 0,
          isExpiringSoon: false,
          daysUntilExpiration: 0,
          error: subscription ? null : 'Abonnement non trouvé. Veuillez compléter votre profil.',
        };
      }

      const isTrialActive = subscriptionService.isTrialActive(subscription);
      const trialDaysRemaining =
        subscriptionService.getTrialDaysRemaining(subscription);

      let scansRemaining = 0;
      let canScan = false;
      const EMERGENCY_SCANS_LIMIT = 3;

      // Helper to calculate available scans with bonus and emergency scans
      const calculateScansWithBonus = (planLimit: number, monthlyUsed: number): number => {
        const bonusScans = subscription.bonusScans || 0;
        const emergencyUsed = subscription.emergencyScansUsed || 0;
        
        // First, check plan scans
        const planRemaining = planLimit - monthlyUsed;
        if (planRemaining > 0) {
          return planRemaining + bonusScans; // Plan scans + bonus
        }
        
        // Plan depleted, use bonus scans
        if (bonusScans > 0) {
          return bonusScans;
        }
        
        // Bonus depleted, offer emergency scans
        const emergencyRemaining = EMERGENCY_SCANS_LIMIT - emergencyUsed;
        return emergencyRemaining;
      };

      if (isTrialActive) {
        // Trial users have limited scans
        const trialLimit = PLAN_SCAN_LIMITS.free || 10;
        scansRemaining = calculateScansWithBonus(trialLimit, subscription.trialScansUsed || 0);
        canScan = scansRemaining > 0;
      } else if (subscription.status === 'freemium' || subscription.planId === 'freemium') {
        // Freemium tier - auto-assigned when no active subscription
        const freemiumLimit = PLAN_SCAN_LIMITS.freemium || 3;
        scansRemaining = calculateScansWithBonus(freemiumLimit, subscription.monthlyScansUsed || 0);
        canScan = scansRemaining > 0;
      } else if (subscription.status === 'grace') {
        // Grace period - keep using remaining scans from expired plan
        const planLimit =
          PLAN_SCAN_LIMITS[
            subscription.planId as keyof typeof PLAN_SCAN_LIMITS
          ] || 0;
        scansRemaining = calculateScansWithBonus(planLimit, subscription.monthlyScansUsed || 0);
        canScan = scansRemaining > 0;
      } else if (subscription.status === 'cancelled') {
        // Cancelled but still within paid period - allow scanning until end date
        if (subscription.subscriptionEndDate && new Date(subscription.subscriptionEndDate) > new Date()) {
          if (subscription.planId === 'premium') {
            scansRemaining = -1;
            canScan = true;
          } else {
            const planLimit = PLAN_SCAN_LIMITS[subscription.planId as keyof typeof PLAN_SCAN_LIMITS] || 0;
            if (planLimit === -1) {
              scansRemaining = -1;
              canScan = true;
            } else {
              scansRemaining = calculateScansWithBonus(planLimit, subscription.monthlyScansUsed || 0);
              canScan = scansRemaining > 0;
            }
          }
        } else {
          // Cancelled and expired - treat as freemium
          scansRemaining = 0;
          canScan = false;
        }
      } else if (subscription.status === 'expired') {
        // Expired subscription - no scans allowed, prompt to renew
        scansRemaining = 0;
        canScan = false;
      } else if (subscription.status === 'pending') {
        // Payment pending - allow limited access
        scansRemaining = 0;
        canScan = false;
      } else if (
        subscription.isSubscribed &&
        subscription.status === 'active'
      ) {
        // Check plan limits
        if (subscription.planId === 'premium') {
          scansRemaining = -1; // Unlimited
          canScan = true;
        } else {
          const planLimit =
            PLAN_SCAN_LIMITS[
              subscription.planId as keyof typeof PLAN_SCAN_LIMITS
            ] || 0;
          if (planLimit === -1) {
            scansRemaining = -1;
            canScan = true;
          } else {
            scansRemaining = calculateScansWithBonus(planLimit, subscription.monthlyScansUsed || 0);
            canScan = scansRemaining > 0;
          }
        }
      }

      const now = new Date();
      const daysUntilExpiration = subscription.subscriptionEndDate
        ? Math.ceil(
            (subscription.subscriptionEndDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;
      const isExpiringSoon =
        daysUntilExpiration > 0 && daysUntilExpiration <= 7;

      return {
        subscription,
        isLoading: false,
        canScan,
        scansRemaining,
        isTrialActive,
        trialDaysRemaining,
        isExpiringSoon,
        daysUntilExpiration,
        error: null,
      };
    },
    [],
  );

  // Subscribe to subscription changes
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    if (!isAuthenticated || !user) {
      // Don't immediately clear state - wait a bit in case auth is just refreshing
      const timeout = setTimeout(() => {
        if (isMounted) {
          setState({
            subscription: null,
            isLoading: false,
            canScan: false,
            scansRemaining: 0,
            isTrialActive: false,
            trialDaysRemaining: 0,
            isExpiringSoon: false,
            daysUntilExpiration: 0,
            error: null,
          });
        }
      }, 500); // Wait 500ms before clearing state
      
      return () => {
        isMounted = false;
        clearTimeout(timeout);
      };
    }

    console.log('📊 Subscribing to subscription status for user:', user.uid);
    unsubscribe = subscriptionService.subscribeToStatus(subscription => {
      if (isMounted) {
        setState(calculateState(subscription));
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isAuthenticated, user, calculateState]);

  const refreshSubscription = useCallback(async () => {
    setState(prev => ({...prev, isLoading: true}));
    try {
      const subscription = await subscriptionService.getStatus();
      setState(calculateState(subscription));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    }
  }, [calculateState]);

  const recordScan = useCallback(async (): Promise<boolean> => {
    try {
      // Check network connectivity first
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        console.warn('📡 SubscriptionContext: No network connection, cannot record scan');
        setState(prev => ({...prev, error: 'No internet connection. Please try again when connected.'}));
        return false;
      }

      console.log('📸 SubscriptionContext: Calling recordScanUsage...');
      await subscriptionService.recordScanUsage();
      console.log('📸 SubscriptionContext: Refreshing subscription...');
      await refreshSubscription();
      console.log('📸 SubscriptionContext: Scan recorded successfully');
      return true;
    } catch (error: any) {
      console.error('❌ SubscriptionContext: Error recording scan:', error);
      // Provide user-friendly error messages
      const errorMessage = error.code === 'unavailable' 
        ? 'Server unavailable. Please check your connection.'
        : error.message;
      setState(prev => ({...prev, error: errorMessage}));
      return false;
    }
  }, [refreshSubscription]);

  const checkCanScan = useCallback(async (): Promise<boolean> => {
    try {
      // Check network connectivity first
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        console.warn('📡 SubscriptionContext: No network connection for checkCanScan');
        return false;
      }
      return await subscriptionService.canScan();
    } catch {
      return false;
    }
  }, []);

  const extendTrial = useCallback(async (): Promise<boolean> => {
    try {
      // Check network connectivity first
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        setState(prev => ({...prev, error: 'No internet connection. Please try again when connected.'}));
        return false;
      }

      await subscriptionService.extendTrial();
      await refreshSubscription();
      return true;
    } catch (error: any) {
      const errorMessage = error.code === 'unavailable' 
        ? 'Server unavailable. Please check your connection.'
        : error.message;
      setState(prev => ({...prev, error: errorMessage}));
      return false;
    }
  }, [refreshSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        ...state,
        refreshSubscription,
        recordScan,
        checkCanScan,
        extendTrial,
        trialScansUsed: state.subscription?.trialScansUsed || 0,
      }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider',
    );
  }
  return context;
}
