// Subscription Context
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
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
    (subscription: Subscription): SubscriptionState => {
      const isTrialActive = subscriptionService.isTrialActive(subscription);
      const trialDaysRemaining =
        subscriptionService.getTrialDaysRemaining(subscription);

      let scansRemaining = 0;
      let canScan = false;

      if (isTrialActive) {
        // Trial users have unlimited scans
        scansRemaining = -1; // -1 represents unlimited
        canScan = true;
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
            scansRemaining = Math.max(
              0,
              planLimit - (subscription.monthlyScansUsed || 0),
            );
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
    if (!isAuthenticated || !user) {
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
      return;
    }

    const unsubscribe = subscriptionService.subscribeToStatus(subscription => {
      setState(calculateState(subscription));
    });

    return unsubscribe;
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
      await subscriptionService.recordScanUsage();
      await refreshSubscription();
      return true;
    } catch (error: any) {
      setState(prev => ({...prev, error: error.message}));
      return false;
    }
  }, [refreshSubscription]);

  const checkCanScan = useCallback(async (): Promise<boolean> => {
    try {
      return await subscriptionService.canScan();
    } catch {
      return false;
    }
  }, []);

  const extendTrial = useCallback(async (): Promise<boolean> => {
    try {
      await subscriptionService.extendTrial();
      await refreshSubscription();
      return true;
    } catch (error: any) {
      setState(prev => ({...prev, error: error.message}));
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
