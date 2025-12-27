/**
 * Offline Mode Context
 * 
 * Provides offline mode state and actions throughout the app.
 * Handles:
 * - Real-time sync status
 * - Pending receipt count
 * - Offline mode feature access
 */

import React, {createContext, useContext, useEffect, useState, useCallback, ReactNode} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {offlineModeService, SyncStatus} from '@/shared/services/offlineModeService';
import {useSubscription} from './SubscriptionContext';
import {useToast} from './ToastContext';

interface OfflineModeContextType {
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  hasOfflineAccess: boolean;
  syncNow: () => Promise<void>;
  retryReceipt: (receiptId: string) => Promise<boolean>;
  removeFromQueue: (receiptId: string) => Promise<void>;
}

const OfflineModeContext = createContext<OfflineModeContextType | undefined>(undefined);

interface OfflineModeProviderProps {
  children: ReactNode;
}

export function OfflineModeProvider({children}: OfflineModeProviderProps): React.JSX.Element {
  const {subscription} = useSubscription();
  const {showToast} = useToast();
  
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    lastSyncTime: null,
    isSyncing: false,
    hasOfflineAccess: false,
  });

  // Initialize offline mode service
  useEffect(() => {
    offlineModeService.initialize();

    // Subscribe to status updates
    const unsubscribe = offlineModeService.subscribe(setStatus);

    return () => {
      unsubscribe();
      offlineModeService.cleanup();
    };
  }, []);

  // Update subscription in service when it changes
  useEffect(() => {
    offlineModeService.updateSubscription(subscription);
  }, [subscription]);

  // Handle app state changes - sync when coming to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && status.hasOfflineAccess && status.pendingCount > 0) {
        const result = await offlineModeService.syncPendingScans();
        if (result.processed > 0) {
          showToast(
            `${result.processed} reçu${result.processed > 1 ? 's' : ''} synchronisé${result.processed > 1 ? 's' : ''}`,
            'success',
            3000,
          );
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [status.hasOfflineAccess, status.pendingCount, showToast]);

  // Show toast when coming back online with pending items
  useEffect(() => {
    let wasOffline = false;

    const unsubscribe = offlineModeService.subscribe((newStatus) => {
      if (wasOffline && newStatus.isOnline && newStatus.pendingCount > 0) {
        showToast(
          `De retour en ligne. Synchronisation de ${newStatus.pendingCount} reçu${newStatus.pendingCount > 1 ? 's' : ''}...`,
          'info',
          3000,
        );
      }
      wasOffline = !newStatus.isOnline;
    });

    return unsubscribe;
  }, [showToast]);

  const syncNow = useCallback(async () => {
    if (!status.isOnline) {
      showToast('Pas de connexion internet', 'error', 3000);
      return;
    }

    if (status.pendingCount === 0) {
      showToast('Aucun reçu à synchroniser', 'info', 3000);
      return;
    }

    const result = await offlineModeService.syncPendingScans();
    
    if (result.processed > 0) {
      showToast(
        `${result.processed} reçu${result.processed > 1 ? 's' : ''} synchronisé${result.processed > 1 ? 's' : ''}`,
        'success',
        3000,
      );
    }

    if (result.failed > 0) {
      showToast(
        `${result.failed} reçu${result.failed > 1 ? 's ont' : ' a'} échoué`,
        'error',
        3000,
      );
    }
  }, [status.isOnline, status.pendingCount, showToast]);

  const retryReceipt = useCallback(async (receiptId: string): Promise<boolean> => {
    const success = await offlineModeService.retryReceipt(receiptId);
    if (success) {
      showToast('Nouvelle tentative en cours...', 'info', 2000);
    }
    return success;
  }, [showToast]);

  const removeFromQueue = useCallback(async (receiptId: string): Promise<void> => {
    await offlineModeService.removeFromQueue(receiptId);
    showToast('Reçu supprimé de la file d\'attente', 'info', 2000);
  }, [showToast]);

  const value: OfflineModeContextType = {
    isOnline: status.isOnline,
    pendingCount: status.pendingCount,
    lastSyncTime: status.lastSyncTime,
    isSyncing: status.isSyncing,
    hasOfflineAccess: status.hasOfflineAccess,
    syncNow,
    retryReceipt,
    removeFromQueue,
  };

  return (
    <OfflineModeContext.Provider value={value}>
      {children}
    </OfflineModeContext.Provider>
  );
}

export function useOfflineMode(): OfflineModeContextType {
  const context = useContext(OfflineModeContext);
  if (context === undefined) {
    throw new Error('useOfflineMode must be used within an OfflineModeProvider');
  }
  return context;
}
