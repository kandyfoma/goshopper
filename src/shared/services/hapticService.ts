// Haptic Feedback Service
// Provides tactile feedback for a premium app feel

import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';
import {Platform} from 'react-native';

// Options for haptic feedback
const defaultOptions = {
  enableVibrateFallback: true, // Use vibration on devices without haptic
  ignoreAndroidSystemSettings: false, // Respect user's vibration settings
};

/**
 * Haptic feedback types explained:
 * - selection: Light tap for selections (toggles, pickers)
 * - impactLight: Light tap for button presses
 * - impactMedium: Medium tap for confirmations
 * - impactHeavy: Strong tap for important actions
 * - notificationSuccess: Success pattern
 * - notificationWarning: Warning pattern  
 * - notificationError: Error pattern
 */

export const hapticService = {
  /**
   * Light tap - Use for button presses, selections
   */
  light: () => {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'impactLight' : 'impactLight',
      defaultOptions,
    );
  },

  /**
   * Medium tap - Use for confirmations, toggles
   */
  medium: () => {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'impactMedium' : 'impactMedium',
      defaultOptions,
    );
  },

  /**
   * Heavy tap - Use for important actions, deletions
   */
  heavy: () => {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'impactHeavy' : 'impactHeavy',
      defaultOptions,
    );
  },

  /**
   * Selection change - Use for picker changes, segment controls
   */
  selection: () => {
    ReactNativeHapticFeedback.trigger('selection', defaultOptions);
  },

  /**
   * Success feedback - Use after successful operations
   */
  success: () => {
    ReactNativeHapticFeedback.trigger('notificationSuccess', defaultOptions);
  },

  /**
   * Warning feedback - Use for warnings, confirmations needed
   */
  warning: () => {
    ReactNativeHapticFeedback.trigger('notificationWarning', defaultOptions);
  },

  /**
   * Error feedback - Use for errors, failed operations
   */
  error: () => {
    ReactNativeHapticFeedback.trigger('notificationError', defaultOptions);
  },

  /**
   * Custom trigger - For specific haptic types
   */
  trigger: (type: HapticFeedbackTypes) => {
    ReactNativeHapticFeedback.trigger(type, defaultOptions);
  },
};

export default hapticService;
