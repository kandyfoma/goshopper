// Quick Actions Service
// Handles app icon shortcuts (3D Touch / Long Press)

import QuickActions, {ShortcutItem} from 'react-native-quick-actions';
import {Platform} from 'react-native';

// Define quick action types
export type QuickActionType = 'scan' | 'shopping' | 'history';

export interface QuickAction {
  type: QuickActionType;
  title: string;
  subtitle?: string;
  icon?: string;
  userInfo?: {url?: string};
}

// Quick action definitions
const QUICK_ACTIONS: ShortcutItem[] = [
  {
    type: 'com.goshopperai.scan',
    title: 'Scanner',
    subtitle: 'Scanner un ticket',
    icon: Platform.OS === 'ios' ? 'Compose' : 'ic_shortcut_camera',
    userInfo: {url: 'goshopperai://scan'},
  },
  {
    type: 'com.goshopperai.shopping',
    title: 'Liste de courses',
    subtitle: 'Voir ma liste',
    icon: Platform.OS === 'ios' ? 'Search' : 'ic_shortcut_cart',
    userInfo: {url: 'goshopperai://shopping'},
  },
  {
    type: 'com.goshopperai.history',
    title: 'Historique',
    subtitle: 'Mes tickets',
    icon: Platform.OS === 'ios' ? 'Time' : 'ic_shortcut_history',
    userInfo: {url: 'goshopperai://history'},
  },
];

// Callback for when quick action is triggered
type QuickActionCallback = (action: QuickAction | null) => void;
let quickActionCallback: QuickActionCallback | null = null;

export const quickActionsService = {
  /**
   * Initialize quick actions - call on app start
   */
  initialize(): void {
    try {
      // Set up the quick actions
      QuickActions.setShortcutItems(QUICK_ACTIONS);
    } catch (error) {
      console.error('Error initializing quick actions:', error);
    }
  },

  /**
   * Set callback for handling quick action navigation
   */
  setCallback(callback: QuickActionCallback): void {
    quickActionCallback = callback;
  },

  /**
   * Check for initial quick action (app launched from shortcut)
   */
  async getInitialAction(): Promise<QuickAction | null> {
    try {
      const data = await QuickActions.popInitialAction();
      if (data) {
        return this.parseQuickAction(data);
      }
      return null;
    } catch (error) {
      console.error('Error getting initial quick action:', error);
      return null;
    }
  },

  /**
   * Parse quick action data to our format
   */
  parseQuickAction(data: ShortcutItem): QuickAction | null {
    if (!data?.type) return null;

    // Extract action type from full type string
    const typeMap: Record<string, QuickActionType> = {
      'com.goshopperai.scan': 'scan',
      'com.goshopperai.shopping': 'shopping',
      'com.goshopperai.history': 'history',
    };

    const actionType = typeMap[data.type];
    if (!actionType) return null;

    return {
      type: actionType,
      title: data.title || '',
      subtitle: data.subtitle,
      userInfo: data.userInfo,
    };
  },

  /**
   * Get screen name for navigation based on action type
   */
  getScreenForAction(actionType: QuickActionType): string {
    const screenMap: Record<QuickActionType, string> = {
      scan: 'Scanner',
      shopping: 'ShoppingLists',
      history: 'History',
    };

    return screenMap[actionType] || 'Home';
  },

  /**
   * Clear quick actions (for logout)
   */
  clearActions(): void {
    try {
      QuickActions.clearShortcutItems();
    } catch (error) {
      console.error('Error clearing quick actions:', error);
    }
  },
};

export default quickActionsService;
