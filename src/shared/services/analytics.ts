// Analytics Service - Centralized Firebase Analytics tracking
import analytics from '@react-native-firebase/analytics';
import {UserProfile} from '@/shared/types';

class AnalyticsService {
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Enable analytics collection
      await analytics().setAnalyticsCollectionEnabled(true);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  // User Properties
  async setUserId(userId: string) {
    try {
      await analytics().setUserId(userId);
    } catch (error) {
      console.error('Failed to set user ID:', error);
    }
  }

  async setUserProperties(profile: Partial<UserProfile>) {
    try {
      const properties: {[key: string]: string} = {};

      if (profile.defaultCity) {
        properties.city = profile.defaultCity;
      }
      if (profile.preferredLanguage) {
        properties.language = profile.preferredLanguage;
      }
      if (profile.preferredCurrency) {
        properties.currency = profile.preferredCurrency;
      }
      if (profile.age) {
        properties.age_group = this.getAgeGroup(profile.age);
      }
      if (profile.sex) {
        properties.gender = profile.sex;
      }
      const budget = profile.defaultMonthlyBudget || profile.monthlyBudget;
      if (budget) {
        properties.budget_tier = this.getBudgetTier(budget);
      }

      await analytics().setUserProperties(properties);
    } catch (error) {
      console.error('Failed to set user properties:', error);
    }
  }

  private getAgeGroup(age: number): string {
    if (age < 18) {
      return 'under_18';
    }
    if (age < 25) {
      return '18_24';
    }
    if (age < 35) {
      return '25_34';
    }
    if (age < 45) {
      return '35_44';
    }
    if (age < 55) {
      return '45_54';
    }
    return '55_plus';
  }

  private getBudgetTier(budget: number): string {
    if (budget < 50000) {
      return 'low';
    }
    if (budget < 200000) {
      return 'medium';
    }
    if (budget < 500000) {
      return 'high';
    }
    return 'premium';
  }

  // Screen Tracking
  async logScreenView(screenName: string, screenClass?: string) {
    try {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.error('Failed to log screen view:', error);
    }
  }

  // Authentication Events
  async logLogin(method: 'email' | 'google' | 'anonymous' | 'apple' | 'facebook' = 'email') {
    try {
      await analytics().logLogin({method});
    } catch (error) {
      console.error('Failed to log login:', error);
    }
  }

  async logSignUp(method: 'email' | 'google' | 'facebook' = 'email') {
    try {
      await analytics().logSignUp({method});
    } catch (error) {
      console.error('Failed to log sign up:', error);
    }
  }

  // Receipt Scanning Events
  async logReceiptScan(
    scanType: 'single' | 'multi',
    itemCount: number,
    currency: string,
    storeName?: string,
  ) {
    try {
      await analytics().logEvent('receipt_scan', {
        scan_type: scanType,
        item_count: itemCount,
        currency: currency,
        store_name: storeName || 'unknown',
      });
    } catch (error) {
      console.error('Failed to log receipt scan:', error);
    }
  }

  async logReceiptScanSuccess(
    receiptId: string,
    totalAmount: number,
    currency: string,
    processingTime: number,
  ) {
    try {
      await analytics().logEvent('receipt_scan_success', {
        receipt_id: receiptId,
        total_amount: totalAmount,
        currency: currency,
        processing_time_ms: processingTime,
      });
    } catch (error) {
      console.error('Failed to log receipt scan success:', error);
    }
  }

  async logReceiptScanFailure(errorType: string, errorMessage: string) {
    try {
      await analytics().logEvent('receipt_scan_failure', {
        error_type: errorType,
        error_message: errorMessage,
      });
    } catch (error) {
      console.error('Failed to log receipt scan failure:', error);
    }
  }

  // Subscription Events
  async logSubscriptionStart(planId: string, price: number, currency: string) {
    try {
      await analytics().logEvent('begin_checkout', {
        currency: currency,
        value: price,
        items: [
          {
            item_id: planId,
            item_name: planId,
            quantity: 1,
          },
        ],
      });
    } catch (error) {
      console.error('Failed to log subscription start:', error);
    }
  }

  async logSubscriptionComplete(
    planId: string,
    price: number,
    currency: string,
    transactionId: string,
  ) {
    try {
      await analytics().logPurchase({
        currency: currency,
        value: price,
        transaction_id: transactionId,
        items: [
          {
            item_id: planId,
            item_name: planId,
            quantity: 1,
          },
        ],
      });
    } catch (error) {
      console.error('Failed to log subscription complete:', error);
    }
  }

  // Item Comparison Events
  async logItemSearch(query: string, resultCount: number) {
    try {
      await analytics().logEvent('search', {
        search_term: query,
        number_of_results: resultCount,
      });
    } catch (error) {
      console.error('Failed to log item search:', error);
    }
  }

  async logItemView(
    itemName: string,
    storeName: string,
    price: number,
    currency: string,
  ) {
    try {
      await analytics().logEvent('view_item', {
        item_name: itemName,
        store_name: storeName,
        price: price,
        currency: currency,
      });
    } catch (error) {
      console.error('Failed to log item view:', error);
    }
  }

  // Navigation Events
  async logTabSwitch(tabName: string) {
    try {
      await analytics().logEvent('tab_switch', {
        tab_name: tabName,
      });
    } catch (error) {
      console.error('Failed to log tab switch:', error);
    }
  }

  // Feature Usage Events
  async logFeatureUsage(featureName: string, context?: string) {
    try {
      await analytics().logEvent('feature_usage', {
        feature_name: featureName,
        context: context || 'unknown',
      });
    } catch (error) {
      console.error('Failed to log feature usage:', error);
    }
  }

  // Error Tracking
  async logError(errorType: string, errorMessage: string, screenName?: string) {
    try {
      await analytics().logEvent('app_error', {
        error_type: errorType,
        error_message: errorMessage,
        screen_name: screenName || 'unknown',
      });
    } catch (error) {
      console.error('Failed to log error:', error);
    }
  }

  // Performance Tracking
  async logPerformanceMetric(
    metricName: string,
    value: number,
    unit: string = 'ms',
  ) {
    try {
      await analytics().logEvent('performance_metric', {
        metric_name: metricName,
        value: value,
        unit: unit,
      });
    } catch (error) {
      console.error('Failed to log performance metric:', error);
    }
  }

  // Custom Events
  async logCustomEvent(
    eventName: string,
    parameters: {[key: string]: any} = {},
  ) {
    try {
      await analytics().logEvent(eventName, parameters);
    } catch (error) {
      console.error('Failed to log custom event:', error);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
