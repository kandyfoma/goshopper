// In-App Review Service
// Prompts users to rate the app at strategic moments

import InAppReview from 'react-native-in-app-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  LAST_REVIEW_PROMPT: '@inAppReview:lastPrompt',
  SCAN_COUNT: '@inAppReview:scanCount',
  HAS_REVIEWED: '@inAppReview:hasReviewed',
  FIRST_LAUNCH: '@inAppReview:firstLaunch',
};

// Minimum days between review prompts
const MIN_DAYS_BETWEEN_PROMPTS = 30;
// Minimum scans before first prompt
const MIN_SCANS_FOR_REVIEW = 5;
// Days of usage before first prompt
const MIN_DAYS_FOR_REVIEW = 7;

export const inAppReviewService = {
  /**
   * Initialize the service - call on app start
   */
  async initialize(): Promise<void> {
    try {
      const firstLaunch = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH);
      if (!firstLaunch) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.FIRST_LAUNCH,
          new Date().toISOString(),
        );
      }
    } catch (error) {
      console.error('Error initializing in-app review:', error);
    }
  },

  /**
   * Check if in-app review is available on this device
   */
  isAvailable(): boolean {
    return InAppReview.isAvailable();
  },

  /**
   * Increment scan count - call after each successful scan
   */
  async incrementScanCount(): Promise<number> {
    try {
      const currentCount = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_COUNT);
      const newCount = (parseInt(currentCount || '0', 10) || 0) + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.SCAN_COUNT, newCount.toString());
      return newCount;
    } catch (error) {
      console.error('Error incrementing scan count:', error);
      return 0;
    }
  },

  /**
   * Get current scan count
   */
  async getScanCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_COUNT);
      return parseInt(count || '0', 10) || 0;
    } catch (error) {
      console.error('Error getting scan count:', error);
      return 0;
    }
  },

  /**
   * Check if user has already reviewed
   */
  async hasReviewed(): Promise<boolean> {
    try {
      const reviewed = await AsyncStorage.getItem(STORAGE_KEYS.HAS_REVIEWED);
      return reviewed === 'true';
    } catch (error) {
      return false;
    }
  },

  /**
   * Mark that user has been prompted for review
   */
  async markReviewed(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAS_REVIEWED, 'true');
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_REVIEW_PROMPT,
        new Date().toISOString(),
      );
    } catch (error) {
      console.error('Error marking reviewed:', error);
    }
  },

  /**
   * Check if enough time has passed since last prompt
   */
  async canPromptAgain(): Promise<boolean> {
    try {
      const lastPrompt = await AsyncStorage.getItem(STORAGE_KEYS.LAST_REVIEW_PROMPT);
      if (!lastPrompt) {
        return true;
      }

      const lastPromptDate = new Date(lastPrompt);
      const daysSinceLastPrompt = Math.floor(
        (Date.now() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return daysSinceLastPrompt >= MIN_DAYS_BETWEEN_PROMPTS;
    } catch (error) {
      return false;
    }
  },

  /**
   * Check if user has been using the app long enough
   */
  async hasUsedAppLongEnough(): Promise<boolean> {
    try {
      const firstLaunch = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH);
      if (!firstLaunch) {
        return false;
      }

      const firstLaunchDate = new Date(firstLaunch);
      const daysSinceFirstLaunch = Math.floor(
        (Date.now() - firstLaunchDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return daysSinceFirstLaunch >= MIN_DAYS_FOR_REVIEW;
    } catch (error) {
      return false;
    }
  },

  /**
   * Check all conditions and request review if appropriate
   * Call this after successful scans or achievements
   */
  async requestReviewIfAppropriate(): Promise<boolean> {
    try {
      // Check if available on device
      if (!this.isAvailable()) {
        console.log('In-app review not available on this device');
        return false;
      }

      // Check if already reviewed
      if (await this.hasReviewed()) {
        console.log('User has already reviewed');
        return false;
      }

      // Check if enough time has passed
      if (!(await this.canPromptAgain())) {
        console.log('Not enough time since last prompt');
        return false;
      }

      // Check scan count
      const scanCount = await this.getScanCount();
      if (scanCount < MIN_SCANS_FOR_REVIEW) {
        console.log(`Not enough scans: ${scanCount}/${MIN_SCANS_FOR_REVIEW}`);
        return false;
      }

      // Check usage time
      if (!(await this.hasUsedAppLongEnough())) {
        console.log('User has not used app long enough');
        return false;
      }

      // All conditions met - request review
      console.log('Requesting in-app review');
      const wasShown = await InAppReview.RequestInAppReview();

      if (wasShown) {
        await this.markReviewed();
        console.log('Review dialog was shown');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error requesting in-app review:', error);
      return false;
    }
  },

  /**
   * Force show review dialog (use sparingly)
   * For testing or after significant positive events like first achievement
   */
  async forceRequestReview(): Promise<boolean> {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      const wasShown = await InAppReview.RequestInAppReview();
      if (wasShown) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.LAST_REVIEW_PROMPT,
          new Date().toISOString(),
        );
      }
      return wasShown;
    } catch (error) {
      console.error('Error forcing review:', error);
      return false;
    }
  },

  /**
   * Reset all review data (for testing)
   */
  async reset(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.LAST_REVIEW_PROMPT,
        STORAGE_KEYS.SCAN_COUNT,
        STORAGE_KEYS.HAS_REVIEWED,
        STORAGE_KEYS.FIRST_LAUNCH,
      ]);
    } catch (error) {
      console.error('Error resetting review data:', error);
    }
  },
};

export default inAppReviewService;
