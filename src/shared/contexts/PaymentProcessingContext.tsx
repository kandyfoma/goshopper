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
import {mokoPaymentService, PaymentStatus} from '@/shared/services/payment';
import firebase from '@react-native-firebase/app';
import '@react-native-firebase/functions';

export type PaymentProcessingStatus = 'idle' | 'pending' | 'success' | 'failed';

interface PaymentProcessingState {
  status: PaymentProcessingStatus;
  transactionId: string | null;
  amount: number;
  phoneNumber: string;
  planId: string;
  planName: string;
  message: string;
  error?: string;
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
  message: '',
};

const PaymentProcessingContext = createContext<PaymentProcessingContextType | undefined>(undefined);

interface PaymentProcessingProviderProps {
  children: ReactNode;
}

export function PaymentProcessingProvider({children}: PaymentProcessingProviderProps) {
  const [state, setState] = useState<PaymentProcessingState>(defaultState);
  const pollUnsubscribeRef = useRef<(() => void) | null>(null);
  
  const startPayment = useCallback((params: {
    transactionId: string;
    amount: number;
    phoneNumber: string;
    planId: string;
    planName: string;
  }) => {
    console.log('💳 Starting payment processing:', params.transactionId);
    
    setState({
      status: 'pending',
      transactionId: params.transactionId,
      amount: params.amount,
      phoneNumber: params.phoneNumber,
      planId: params.planId,
      planName: params.planName,
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
  
  const setSuccess = useCallback((message?: string) => {
    setState(prev => ({
      ...prev,
      status: 'success',
      message: message || 'Paiement réussi!',
    }));
  }, []);
  
  const setFailed = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      status: 'failed',
      message: error,
      error,
    }));
  }, []);
  
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
          // Activate subscription via Firebase
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
            
            setSuccess(`Abonnement ${state.planName} activé!`);
          } catch (error: any) {
            console.error('Error activating subscription:', error);
            // Payment succeeded but activation failed
            setFailed('Paiement reçu. Contactez le support pour activer votre abonnement.');
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
