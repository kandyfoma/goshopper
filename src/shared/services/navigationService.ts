// Navigation Service - Handle deep linking from notifications
import {createNavigationContainerRef} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {RootStackParamList} from '@/shared/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const PENDING_NAVIGATION_KEY = '@goshopperai/pending_navigation';

interface PendingNavigation {
  screen: keyof RootStackParamList;
  params: any;
  timestamp: number;
}

class NavigationService {
  /**
   * Navigate to a screen
   */
  navigate(screen: keyof RootStackParamList, params?: any) {
    if (navigationRef.isReady()) {
      navigationRef.navigate(screen as never, params as never);
    }
  }

  /**
   * Check for pending navigation from notifications
   * Call this after authentication completes
   */
  async checkPendingNavigation(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PENDING_NAVIGATION_KEY);
      if (!stored) {
        return;
      }

      const pending: PendingNavigation = JSON.parse(stored);
      
      // Check if navigation intent is still valid (within 5 minutes)
      const now = Date.now();
      const age = now - pending.timestamp;
      if (age > 5 * 60 * 1000) {
        console.log('[NavigationService] Pending navigation expired');
        await AsyncStorage.removeItem(PENDING_NAVIGATION_KEY);
        return;
      }

      // Clear the pending navigation
      await AsyncStorage.removeItem(PENDING_NAVIGATION_KEY);

      // Wait a bit for navigation to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to the target screen
      if (navigationRef.isReady()) {
        console.log('[NavigationService] Navigating to:', pending.screen, pending.params);
        this.navigate(pending.screen, pending.params);
      } else {
        console.warn('[NavigationService] Navigation not ready');
      }
    } catch (error) {
      console.error('[NavigationService] Check pending navigation error:', error);
    }
  }

  /**
   * Store pending navigation intent
   * Used when app opens from notification
   */
  async setPendingNavigation(screen: keyof RootStackParamList, params: any): Promise<void> {
    try {
      const pending: PendingNavigation = {
        screen,
        params,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(PENDING_NAVIGATION_KEY, JSON.stringify(pending));
      console.log('[NavigationService] Stored pending navigation:', screen);
    } catch (error) {
      console.error('[NavigationService] Set pending navigation error:', error);
    }
  }
}

export const navigationService = new NavigationService();
