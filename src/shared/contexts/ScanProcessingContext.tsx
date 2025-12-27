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
import {notificationActionsService} from '@/shared/services/notificationActions';

const SCAN_PROCESSING_KEY = '@goshopperai/scan_processing_state';

// Auto-cleanup processing stuck for more than 5 minutes
const STUCK_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

export type ScanStatus = 'idle' | 'processing' | 'success' | 'error';

interface ScanProcessingState {
  status: ScanStatus;
  progress: number; // 0-100
  message: string;
  receipt?: Receipt;
  receiptId?: string;
  error?: string;
  photoCount?: number;
  startedAt?: number; // Timestamp for stuck detection
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

  // Auto-cleanup stuck processing states (check every minute)
  useEffect(() => {
    if (state.status !== 'processing' || !state.startedAt) {
      return;
    }

    const checkStuck = () => {
      const elapsed = Date.now() - (state.startedAt || 0);
      if (elapsed > STUCK_PROCESSING_TIMEOUT_MS) {
        console.warn(`⚠️ Scan processing stuck for ${Math.round(elapsed / 60000)} minutes, auto-resetting`);
        setState({
          ...defaultState,
          status: 'error',
          error: 'Le traitement a pris trop de temps. Veuillez réessayer.',
          message: 'Le traitement a pris trop de temps. Veuillez réessayer.',
        });
      }
    };

    // Check every minute while processing
    const interval = setInterval(checkStuck, 60000);
    return () => clearInterval(interval);
  }, [state.status, state.startedAt]);

  const loadPersistedState = async () => {
    try {
      const stored = await AsyncStorage.getItem(SCAN_PROCESSING_KEY);
      if (stored) {
        const persistedState = JSON.parse(stored);
        // Only restore if still processing
        if (persistedState.status === 'processing') {
          // Check if processing is stuck (started more than 5 minutes ago)
          const startedAt = persistedState.startedAt || 0;
          const elapsed = Date.now() - startedAt;
          
          if (elapsed > STUCK_PROCESSING_TIMEOUT_MS) {
            // Processing is stuck - auto-cleanup
            console.warn(`⚠️ Scan processing was stuck for ${Math.round(elapsed / 60000)} minutes, cleaning up`);
            await AsyncStorage.removeItem(SCAN_PROCESSING_KEY);
            // Don't restore the stuck state
          } else {
            setState(persistedState);
            console.log('📱 Restored scan processing state');
          }
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
      startedAt: Date.now(), // Track when processing started
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
      const itemCount = receipt.items?.length || 0;
      const storeName = receipt.storeName || 'Magasin inconnu';
      const total = receipt.total || 0;
      const currency = receipt.currency || 'CDF';
      
      await notificationActionsService.displayScanNotification({
        storeName,
        itemCount,
        total,
        currency,
        date: receipt.date,
        receiptId,
      });
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
      await notificationActionsService.displayErrorNotification({
        title: '❌ Erreur d\'analyse',
        body: error,
      });
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
