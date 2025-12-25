// Scan Processing Context - Manages background receipt scanning
// Similar to Facebook/Instagram post upload experience
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
import {ReceiptScanResult, Receipt} from '@/shared/types';
import {pushNotificationService} from '@/shared/services/firebase';
import notifee from '@notifee/react-native';
import {Platform} from 'react-native';

const SCAN_PROCESSING_KEY = '@goshopperai/scan_processing_state';

export type ScanStatus = 'idle' | 'processing' | 'success' | 'error';

interface ScanProcessingState {
  status: ScanStatus;
  progress: number; // 0-100
  message: string;
  receipt?: Receipt;
  receiptId?: string;
  error?: string;
  photoCount?: number;
}

interface ScanProcessingContextType {
  state: ScanProcessingState;
  
  // Start background processing
  startProcessing: (photoCount: number) => void;
  
  // Update progress
  updateProgress: (progress: number, message: string) => void;
  
  // Set success with receipt data (pending user confirmation)
  setSuccess: (receipt: Receipt, receiptId: string) => void;
  
  // Set error
  setError: (error: string) => void;
  
  // User confirmed - now save to DB
  confirmAndSave: () => Promise<void>;
  
  // User cancelled or dismissed
  dismiss: () => void;
  
  // Reset to idle
  reset: () => void;
  
  // Check if processing is active
  isProcessing: boolean;
  
  // Check if awaiting user confirmation
  isAwaitingConfirmation: boolean;
}

const defaultState: ScanProcessingState = {
  status: 'idle',
  progress: 0,
  message: '',
};

const ScanProcessingContext = createContext<ScanProcessingContextType | undefined>(undefined);

interface ScanProcessingProviderProps {
  children: ReactNode;
}

export function ScanProcessingProvider({children}: ScanProcessingProviderProps) {
  const [state, setState] = useState<ScanProcessingState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Callback ref for saving receipt (set by the scanner screen)
  const saveReceiptCallbackRef = useRef<(() => Promise<void>) | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, []);

  // Save state to AsyncStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      saveState();
    }
  }, [state, isLoaded]);

  const loadPersistedState = async () => {
    try {
      const stored = await AsyncStorage.getItem(SCAN_PROCESSING_KEY);
      if (stored) {
        const persistedState = JSON.parse(stored);
        // Only restore if still processing
        if (persistedState.status === 'processing') {
          setState(persistedState);
          console.log('📱 Restored scan processing state');
        }
      }
    } catch (error) {
      console.error('Error loading scan processing state:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveState = async () => {
    try {
      if (state.status === 'processing') {
        await AsyncStorage.setItem(SCAN_PROCESSING_KEY, JSON.stringify(state));
      } else {
        await AsyncStorage.removeItem(SCAN_PROCESSING_KEY);
      }
    } catch (error) {
      console.error('Error saving scan processing state:', error);
    }
  };
  
  const startProcessing = useCallback((photoCount: number) => {
    setState({
      status: 'processing',
      progress: 0,
      message: 'Préparation de l\'analyse...',
      photoCount,
    });
  }, []);
  
  const updateProgress = useCallback((progress: number, message: string) => {
    setState(prev => ({
      ...prev,
      progress: Math.min(progress, 99), // Don't show 100% until actually done
      message,
    }));
  }, []);
  
  const setSuccess = useCallback(async (receipt: Receipt, receiptId: string) => {
    setState(prev => ({
      ...prev,
      status: 'success',
      progress: 100,
      message: 'Analyse terminée!',
      receipt,
      receiptId,
    }));

    // Send local push notification with receipt details
    try {
      if (Platform.OS === 'android') {
        const itemCount = receipt.items?.length || 0;
        const storeName = receipt.storeName || 'Magasin inconnu';
        const total = receipt.total || 0;
        const currency = receipt.currency || 'CDF';
        
        // Format the total nicely
        const formattedTotal = total.toLocaleString('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        
        await notifee.displayNotification({
          title: `✅ ${storeName}`,
          body: `${itemCount} article${itemCount > 1 ? 's' : ''} • Total: ${formattedTotal} ${currency}`,
          android: {
            channelId: 'scan-completion',
            pressAction: {
              id: 'default',
            },
            style: {
              type: 1, // BigTextStyle
              text: `Reçu analysé avec succès!\n\n📍 Magasin: ${storeName}\n📦 Articles: ${itemCount}\n💰 Total: ${formattedTotal} ${currency}${receipt.date ? `\n📅 Date: ${receipt.date}` : ''}`,
            },
          },
        });
      }
    } catch (error) {
      console.error('Error sending scan completion notification:', error);
    }
  }, []);
  
  const setError = useCallback(async (error: string) => {
    setState(prev => ({
      ...prev,
      status: 'error',
      progress: 0,
      message: error,
      error,
    }));

    // Send local push notification for error
    try {
      if (Platform.OS === 'android') {
        await notifee.displayNotification({
          title: '❌ Erreur d\'analyse',
          body: error,
          android: {
            channelId: 'scan-completion',
            pressAction: {
              id: 'default',
            },
          },
        });
      }
    } catch (notifError) {
      console.error('Error sending scan error notification:', notifError);
    }

    // Auto-dismiss error banner after 5 seconds
    setTimeout(() => {
      setState(prev => {
        // Only dismiss if still in error state
        if (prev.status === 'error') {
          return defaultState;
        }
        return prev;
      });
    }, 5000);
  }, []);
  
  const confirmAndSave = useCallback(async () => {
    if (saveReceiptCallbackRef.current) {
      await saveReceiptCallbackRef.current();
    }
    setState(defaultState);
  }, []);
  
  const dismiss = useCallback(() => {
    setState(defaultState);
  }, []);
  
  const reset = useCallback(() => {
    setState(defaultState);
  }, []);
  
  const isProcessing = state.status === 'processing';
  const isAwaitingConfirmation = state.status === 'success' && !!state.receipt;
  
  return (
    <ScanProcessingContext.Provider
      value={{
        state,
        startProcessing,
        updateProgress,
        setSuccess,
        setError,
        confirmAndSave,
        dismiss,
        reset,
        isProcessing,
        isAwaitingConfirmation,
      }}>
      {children}
    </ScanProcessingContext.Provider>
  );
}

export function useScanProcessing() {
  const context = useContext(ScanProcessingContext);
  if (!context) {
    throw new Error('useScanProcessing must be used within a ScanProcessingProvider');
  }
  return context;
}

export default ScanProcessingContext;
