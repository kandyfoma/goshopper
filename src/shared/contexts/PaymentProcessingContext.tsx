// Payment Processing Context - Manages background payment processing
// Similar to Facebook/Instagram upload experience
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {mokoPaymentService, PaymentStatus} from '@/shared/services/payment';
import firebase from '@react-native-firebase/app';
import '@react-native-firebase/functions';
import {subscriptionService} from '@/shared/services/firebase';
import {notificationActionsService} from '@/shared/services/notificationActions';
import {formatCurrency} from '@/shared/utils/helpers';

const PAYMENT_PROCESSING_KEY = '@goshopperai/payment_processing_state';

export type PaymentProcessingStatus = 'idle' | 'pending' | 'success' | 'failed';

interface PaymentProcessingState {
  status: PaymentProcessingStatus;
  transactionId: string | null;
  amount: number;
  phoneNumber: string;
  planId: string;
  planName: string;
  currency: string;
  message: string;
  error?: string;
  isScanPack?: boolean;
  scanPackId?: string;
}

interface PaymentProcessingContextType {
  state: PaymentProcessingState;
  
  // Start payment processing
  startPayment: (params: {
    transactionId: string;
    amount: number;
    phoneNumber: string;
    planId: string;
    planName: string;
    currency: string;
    isScanPack?: boolean;
    scanPackId?: string;
  }) => void;
  
  // Update status
  updateStatus: (status: PaymentProcessingStatus, message: string) => void;
  
  // Set success
  setSuccess: (message?: string) => void;
  
  // Set failed
  setFailed: (error: string) => void;
  
  // Dismiss/reset
  dismiss: () => void;
  
  // Check if payment is pending
  isPending: boolean;
  
  // Check if should show banner
  isVisible: boolean;
}

const defaultState: PaymentProcessingState = {
  status: 'idle',
  transactionId: null,
  amount: 0,
  phoneNumber: '',
  planId: '',
  planName: '',
  currency: 'USD',
  message: '',
};

const PaymentProcessingContext = createContext<PaymentProcessingContextType | undefined>(undefined);

interface PaymentProcessingProviderProps {
  children: ReactNode;
}

export function PaymentProcessingProvider({children}: PaymentProcessingProviderProps) {
  const [state, setState] = useState<PaymentProcessingState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  const pollUnsubscribeRef = useRef<(() => void) | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (isLoaded) {
      saveState();
    }
  }, [state, isLoaded]);

  const loadPersistedState = async () => {
    try {
      const stored = await AsyncStorage.getItem(PAYMENT_PROCESSING_KEY);
      if (stored) {
        const persistedState = JSON.parse(stored);
        // Only restore if still pending
        if (persistedState.status === 'pending') {
          setState(persistedState);
          console.log('💳 Restored payment processing state');
          // Resume polling for this payment
          if (persistedState.transactionId) {
            startPolling(persistedState.transactionId, persistedState.planId, persistedState.scanPackId);
          }
        }
      }
    } catch (error) {
      console.error('Error loading payment processing state:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveState = async () => {
    try {
      if (state.status === 'pending') {
        await AsyncStorage.setItem(PAYMENT_PROCESSING_KEY, JSON.stringify(state));
      } else {
        await AsyncStorage.removeItem(PAYMENT_PROCESSING_KEY);
      }
    } catch (error) {
      console.error('Error saving payment processing state:', error);
    }
  };
  
  const startPayment = useCallback((params: {
    transactionId: string;
    amount: number;
    phoneNumber: string;
    planId: string;
    planName: string;
    currency: string;
    isScanPack?: boolean;
    scanPackId?: string;
  }) => {
    console.log('💳 Starting payment processing:', params.transactionId);
    
    setState({
      status: 'pending',
      transactionId: params.transactionId,
      amount: params.amount,
      phoneNumber: params.phoneNumber,
      planId: params.planId,
      planName: params.planName,
      currency: params.currency,
      isScanPack: params.isScanPack,
      scanPackId: params.scanPackId,
      message: 'Demande envoyée à l\'opérateur...',
    });
  }, []);
  
  const updateStatus = useCallback((status: PaymentProcessingStatus, message: string) => {
    setState(prev => ({
      ...prev,
      status,
      message,
    }));
  }, []);
  
  const setSuccess = useCallback(async (message?: string) => {
    // Get state values before updating
    const currentPlanName = state.planName;
    const currentAmount = state.amount;
    const currentCurrency = state.currency;
    const currentIsScanPack = state.isScanPack;
    
    const successMessage = message || 'Paiement réussi!';
    setState(prev => ({
      ...prev,
      status: 'success',
      message: successMessage,
    }));

    // Send local push notification with subscription details
    try {
      // Format amount with user's currency
      const formattedAmount = formatCurrency(currentAmount, currentCurrency);
      
      let notifTitle = '✅ Paiement réussi';
      let notifBody = successMessage;
      
      if (currentIsScanPack) {
        notifTitle = '✅ Scans bonus ajoutés!';
        notifBody = `${currentPlanName} • ${formattedAmount}`;
      } else if (currentPlanName) {
        notifTitle = `✅ Abonnement ${currentPlanName}`;
        notifBody = `Activé • ${formattedAmount}`;
      }
      
      await notificationActionsService.displayPaymentNotification({
        title: notifTitle,
        body: notifBody,
        transactionId: state.transactionId || undefined,
      });
    } catch (error) {
      console.error('Error sending payment success notification:', error);
    }
  }, [state.planName, state.amount, state.currency, state.isScanPack, state.transactionId]);
  
  const setFailed = useCallback(async (error: string) => {
    // Get state values before updating
    const currentPlanName = state.planName;
    const currentAmount = state.amount;
    const currentCurrency = state.currency;
    
    setState(prev => ({
      ...prev,
      status: 'failed',
      message: error,
      error,
    }));

    // Send local push notification for failure with details
    try {
      const formattedAmount = formatCurrency(currentAmount, currentCurrency);
      
      await notificationActionsService.displayPaymentNotification({
        title: '❌ Paiement échoué',
        body: currentPlanName ? `${currentPlanName} • ${formattedAmount}` : error,
        transactionId: state.transactionId || undefined,
      });
    } catch (notifError) {
      console.error('Error sending payment failure notification:', notifError);
    }
  }, [state.planName, state.amount, state.currency, state.transactionId]);
  
  const dismiss = useCallback(() => {
    // Clean up polling
    if (pollUnsubscribeRef.current) {
      pollUnsubscribeRef.current();
      pollUnsubscribeRef.current = null;
    }
    setState(defaultState);
  }, []);
  
  // Start polling when transactionId is set
  useEffect(() => {
    if (!state.transactionId || state.status !== 'pending') {
      return;
    }
    
    console.log('🔄 Starting payment status polling for:', state.transactionId);
    
    const unsubscribe = mokoPaymentService.subscribeToPaymentStatus(
      state.transactionId,
      async (status: PaymentStatus, details?: any) => {
        console.log('💳 Payment status update:', status, details);
        
        if (status === 'SUCCESS') {
          // Check if this is a scan pack purchase
          if (state.isScanPack && state.scanPackId) {
            try {
              console.log('✅ Payment successful, adding bonus scans...');
              updateStatus('pending', 'Ajout des scans bonus...');
              
              console.log('📦 Calling purchaseScanPack with:', {
                packId: state.scanPackId,
                transactionId: state.transactionId,
                amount: state.amount,
                phoneNumber: state.phoneNumber,
              });
              
              // Call the function in europe-west1 region
              const functionsInstance = firebase.app().functions('europe-west1');
              const purchasePack = functionsInstance.httpsCallable('purchaseScanPack');
              
              await purchasePack({
                packId: state.scanPackId,
                transactionId: state.transactionId,
                amount: state.amount,
                phoneNumber: state.phoneNumber,
                currency: 'USD',
              });
              
              // Force refresh subscription status
              console.log('🔄 Refreshing subscription status after scan pack purchase...');
              try {
                await subscriptionService.getStatus();
              } catch (refreshError) {
                console.warn('Failed to refresh subscription, but pack purchase succeeded:', refreshError);
              }
              
              setSuccess('Scans bonus ajoutés avec succès!');
            } catch (error: any) {
              console.error('Error purchasing scan pack:', error);
              setFailed('Paiement reçu. Contactez le support pour activer vos scans.');
            }
          } else {
            // Regular subscription activation
            try {
              console.log('✅ Payment successful, activating subscription...');
              updateStatus('pending', 'Activation de l\'abonnement...');
              
              console.log('📞 Calling activateSubscriptionFromRailway with:', {
                planId: state.planId,
                transactionId: state.transactionId,
                amount: state.amount,
                phoneNumber: state.phoneNumber,
              });
              
              // Call the function in europe-west1 region
              const functionsInstance = firebase.app().functions('europe-west1');
              const activateSubscription = functionsInstance.httpsCallable('activateSubscriptionFromRailway');
              
              await activateSubscription({
                planId: state.planId,
                transactionId: state.transactionId,
                amount: state.amount,
                phoneNumber: state.phoneNumber,
                currency: 'USD',
              });
              
              // Force refresh subscription status from Firestore
              // This ensures the UI updates immediately after activation
              console.log('🔄 Refreshing subscription status after activation...');
              try {
                await subscriptionService.getStatus(); // This will trigger Firestore listener
              } catch (refreshError) {
                console.warn('Failed to refresh subscription, but activation succeeded:', refreshError);
              }
              
              setSuccess(`Abonnement ${state.planName} activé!`);
            } catch (error: any) {
              console.error('Error activating subscription:', error);
              // Payment succeeded but activation failed
              setFailed('Paiement reçu. Contactez le support pour activer votre abonnement.');
            }
          }
        } else if (status === 'FAILED') {
          setFailed('Le paiement a échoué. Veuillez réessayer.');
        }
      },
      // Progress update callback for real-time banner updates
      (message: string, _pollCount: number) => {
        setState(prev => ({
          ...prev,
          message,
        }));
      }
    );
    
    pollUnsubscribeRef.current = unsubscribe;
    
    return () => {
      if (pollUnsubscribeRef.current) {
        pollUnsubscribeRef.current();
        pollUnsubscribeRef.current = null;
      }
    };
  }, [state.transactionId, state.status, state.planId, state.planName, state.amount, state.phoneNumber, updateStatus, setSuccess, setFailed]);
  
  // Auto-dismiss success after 5 seconds
  useEffect(() => {
    if (state.status === 'success') {
      const timer = setTimeout(() => {
        dismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.status, dismiss]);
  
  // Auto-dismiss failed after 8 seconds
  useEffect(() => {
    if (state.status === 'failed') {
      const timer = setTimeout(() => {
        dismiss();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [state.status, dismiss]);
  
  const value: PaymentProcessingContextType = {
    state,
    startPayment,
    updateStatus,
    setSuccess,
    setFailed,
    dismiss,
    isPending: state.status === 'pending',
    isVisible: state.status !== 'idle',
  };
  
  return (
    <PaymentProcessingContext.Provider value={value}>
      {children}
    </PaymentProcessingContext.Provider>
  );
}

export function usePaymentProcessing() {
  const context = useContext(PaymentProcessingContext);
  if (!context) {
    throw new Error('usePaymentProcessing must be used within a PaymentProcessingProvider');
  }
  return context;
}
