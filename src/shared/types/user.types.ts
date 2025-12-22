// Type definitions for User and Authentication

export interface User {
  id: string; // Alias for uid
  uid: string;
  isAnonymous: boolean;
  email?: string;
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface UserProfile {
  userId: string;
  displayName?: string;
  firstName?: string;
  surname?: string;
  email?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  phoneVerified?: boolean;
  countryCode?: string;
  isInDRC?: boolean;
  verified?: boolean;
  verifiedAt?: Date;
  preferredLanguage: 'fr' | 'ln' | 'sw' | 'en';
  preferredCurrency: 'USD' | 'CDF';
  defaultCity?: string;
  profileCompleted?: boolean;
  // Additional profile fields
  name?: string;
  age?: number; // Deprecated - kept for backwards compatibility
  dateOfBirth?: string; // ISO date string (YYYY-MM-DD)
  sex?: 'male' | 'female' | 'other';
  monthlyBudget?: number; // Legacy - keep for backwards compatibility
  defaultMonthlyBudget?: number; // New: template budget for auto-copy
  notificationsEnabled: boolean;
  priceAlertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // ML & AI - User Behavior Tracking
  behaviorProfile?: UserBehaviorProfile;
  recommendationPreferences?: RecommendationPreferences;
  engagementMetrics?: UserEngagementMetrics;
}

// User Behavior Profile for ML/AI
export interface UserBehaviorProfile {
  // Shopping Patterns
  averageBasketSize?: number; // Average number of items per receipt
  averageSpendPerTrip?: number; // Average spending per shopping trip
  shoppingFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'; // How often they shop
  preferredShoppingDays?: number[]; // Days of week (0-6, Sunday-Saturday)
  preferredShoppingTime?: 'morning' | 'afternoon' | 'evening' | 'night';
  
  // Category Preferences (tracked automatically from purchases)
  topCategories?: CategoryPreference[]; // Top 5 categories by frequency and spending
  brandAffinities?: BrandAffinity[]; // Brands they buy most frequently
  
  // Product Interests (inferred from scans, views, alerts)
  frequentItems?: string[]; // Product IDs bought repeatedly
  wishlistItems?: string[]; // Items they created alerts for
  viewedItems?: string[]; // Recently viewed items (for collaborative filtering)
  
  // Price Sensitivity
  priceConsciousness?: 'budget' | 'moderate' | 'premium'; // Inferred from purchase patterns
  dealSeeker?: boolean; // True if user frequently buys discounted items
  averageDiscountTaken?: number; // Average % discount on purchases
  
  // Store Preferences
  preferredStores?: string[]; // Store IDs they visit most
  storeDistancePreference?: number; // Average distance willing to travel (km)
  
  // Engagement Patterns
  lastActiveDate?: Date;
  weeklyActiveScore?: number; // 0-100 score based on app usage
  monthlyActiveScore?: number; // 0-100 score based on app usage
  churnRiskScore?: number; // 0-100 ML-predicted churn probability
  lifetimeValue?: number; // Predicted or actual LTV
  
  // AI Model Metadata
  lastProfileUpdate?: Date;
  profileVersion?: number; // Increment when ML model updates
  dataQualityScore?: number; // 0-100 confidence in profile accuracy
}

// Category preference with engagement metrics
export interface CategoryPreference {
  category: string;
  purchaseCount: number; // How many times purchased from this category
  totalSpent: number; // Total amount spent in this category
  averagePrice: number; // Average price per item
  lastPurchaseDate?: Date;
  trend?: 'increasing' | 'stable' | 'decreasing'; // Purchase trend
  interestScore?: number; // 0-100 ML-calculated interest score
}

// Brand affinity tracking
export interface BrandAffinity {
  brand: string;
  purchaseCount: number;
  loyaltyScore?: number; // 0-100 how loyal to this brand
  lastPurchaseDate?: Date;
  switchingProbability?: number; // 0-1 probability of switching brands
}

// Recommendation Preferences
export interface RecommendationPreferences {
  // User-controlled preferences
  enablePersonalizedRecommendations?: boolean; // Default: true
  enablePriceAlertRecommendations?: boolean; // Suggest items to set alerts on
  enableBundleRecommendations?: boolean; // Suggest items often bought together
  enableSeasonalRecommendations?: boolean; // Suggest seasonal items
  
  // AI Model Preferences
  recommendationStyle?: 'conservative' | 'balanced' | 'exploratory'; // How adventurous
  maxRecommendationsPerDay?: number; // Limit push notifications
  
  // Feedback Loop (for improving recommendations)
  acceptedRecommendations?: string[]; // Product IDs user acted on
  dismissedRecommendations?: string[]; // Product IDs user dismissed
  feedbackScore?: number; // Average rating of recommendations (0-5)
}

// User Engagement Metrics (for ML training)
export interface UserEngagementMetrics {
  // App Usage
  totalSessions?: number;
  averageSessionDuration?: number; // seconds
  lastSessionDate?: Date;
  
  // Feature Usage
  scansCount?: number;
  itemViewsCount?: number;
  priceComparisonsCount?: number;
  alertsCreatedCount?: number;
  shoppingListsCreatedCount?: number;
  
  // Notification Engagement
  pushNotificationsReceived?: number;
  pushNotificationsOpened?: number;
  pushNotificationDismissed?: number;
  notificationOpenRate?: number; // 0-1
  
  // Recommendation Engagement
  recommendationsShown?: number;
  recommendationsClicked?: number;
  recommendationClickRate?: number; // 0-1
  recommendationConversionRate?: number; // 0-1 (clicked -> purchased)
  
  // Social/Community (future)
  reviewsWritten?: number;
  helpfulVotes?: number;
  sharesCount?: number;
  
  // Retention Metrics
  daysActive?: number; // Total days user opened app
  consecutiveDaysActive?: number; // Current streak
  longestStreak?: number;
  daysSinceLastActive?: number;
  
  // Conversion Metrics
  scanToReceiptRate?: number; // % of scans that become receipts
  viewToPurchaseRate?: number; // % of viewed items purchased
  alertToActionRate?: number; // % of alerts that led to purchase
}

// Monthly Budget Document
export interface MonthlyBudget {
  userId: string;
  month: string; // Format: "YYYY-MM"
  amount: number;
  currency: 'USD' | 'CDF';
  isCustom: boolean; // true if user edited, false if auto-copied from default
  createdAt: Date;
  updatedAt: Date;
}

// Budget Settings (stored in profile)
export interface BudgetSettings {
  defaultMonthlyBudget: number;
  preferredCurrency: 'USD' | 'CDF';
  enableAlerts: boolean; // Enable budget alerts at 80%
  alertThreshold: number; // Default: 80
}

export interface UserStats {
  userId: string;
  totalScans: number;
  totalSavings: number;
  savingsCurrency: 'USD' | 'CDF';
  favoriteStore?: string;
  mostPurchasedCategory?: string;
  lastScanDate?: Date;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// Verification types
export interface VerificationState {
  sessionId: string | null;
  type: 'phone' | 'email' | null;
  identifier: string | null;
  isVerifying: boolean;
  isVerified: boolean;
  verificationToken: string | null;
  error: string | null;
}

export type PaymentMethod = 'mobile_money' | 'card';
