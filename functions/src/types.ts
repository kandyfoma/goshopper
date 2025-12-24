/**
 * Shared TypeScript types for Cloud Functions
 */

// Use Date for types, will be converted to Timestamp by Firestore
export interface ReceiptItem {
  id: string;
  name: string;
  nameNormalized: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit?: string;
  category?: string;
  confidence: number;
}

export interface ParsedReceipt {
  storeName: string;
  storeNameNormalized: string;
  storeAddress?: string;
  storePhone?: string;
  receiptNumber?: string;
  date: string;
  currency: 'USD' | 'CDF';
  items: ReceiptItem[];
  subtotal?: number;
  tax?: number;
  total: number;
  totalUSD?: number;
  totalCDF?: number;
  rawText?: string;
  isVideoScan?: boolean; // True if receipt was scanned via video
}

export interface Receipt extends ParsedReceipt {
  id: string;
  userId: string;
  imageUrl?: string;
  imageUrls?: string[];
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  scannedAt: Date;
}

export interface Subscription {
  userId: string;

  // Trial tracking (2-month free trial)
  trialScansUsed: number;
  trialScansLimit: number;
  trialStartDate?: Date;
  trialEndDate?: Date;
  trialExtended?: boolean;

  // Monthly usage tracking
  monthlyScansUsed?: number;
  currentBillingPeriodStart?: Date;
  currentBillingPeriodEnd?: Date;

  // Subscription details
  isSubscribed: boolean;
  planId?: 'freemium' | 'free' | 'basic' | 'standard' | 'premium';
  status:
    | 'trial'
    | 'active'
    | 'expired'
    | 'cancelled'
    | 'pending'
    | 'expiring_soon'
    | 'grace'
    | 'freemium';
  durationMonths?: 1 | 3 | 6;
  gracePeriodEnd?: Date;

  // Billing
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  currency?: 'USD' | 'CDF';

  // Payment info
  paymentMethod?: 'mobile_money' | 'card';
  paymentProvider?: 'moko_afrika' | 'stripe';
  mobileMoneyProvider?: 'mpesa' | 'orange' | 'airtel' | 'afrimoney';
  transactionId?: string;
  stripePaymentIntentId?: string;
  customerPhone?: string;
  customerEmail?: string;

  // Auto-renewal
  autoRenew: boolean;
  autoRenewFailureCount?: number;
  lastRenewalAttemptDate?: Date;
  lastRenewalFailureReason?: string;
  autoRenewDisabledReason?: string;
  autoRenewDisabledAt?: Date;

  // Downgrade scheduling (for end-of-period downgrades)
  pendingDowngradePlanId?: 'basic' | 'standard' | 'premium';
  pendingDowngradeEffectiveDate?: Date;

  // Expiration notifications
  expirationNotificationSent?: boolean;
  expirationNotificationDate?: Date;
  daysUntilExpiration?: number;

  // Grace period notifications
  graceNotificationDay?: number; // Last day notified (7, 5, 3, 1)
  graceNotificationSent?: boolean;
  graceNotificationDate?: Date;

  // Scan limit warnings
  scan80PercentWarningSent?: boolean;
  scan80PercentWarningDate?: Date;
  scan90PercentWarningSent?: boolean;
  scan90PercentWarningDate?: Date;
  scanLimitReachedNotificationSent?: boolean;
  scanLimitReachedDate?: Date;

  // Remaining scans (for grace period)
  scansRemaining?: number;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PricePoint {
  productName: string;
  productNameNormalized: string;
  storeName: string;
  storeNameNormalized: string;
  price: number;
  previousPrice?: number; // Track price changes
  currency: 'USD' | 'CDF';
  unit?: string;
  quantity?: number;
  pricePerUnit?: number;
  recordedAt: Date;
  receiptId: string;
  // Removed userId for privacy - data is now anonymous
  // Matching metadata
  matchConfidence?: number;
  matchType?: 'exact' | 'fuzzy' | 'semantic';
}

export interface PriceComparison {
  productName: string;
  currentPrice: number;
  currentStore: string;
  bestPrice: number;
  bestStore: string;
  averagePrice: number;
  potentialSavings: number;
  savingsPercentage: number;
  priceCount: number;
}

export interface MokoPaymentRequest {
  amount: number;
  currency: 'USD' | 'CDF';
  phoneNumber: string;
  provider: 'mpesa' | 'orange' | 'airtel' | 'afrimoney';
  planId: 'basic' | 'standard' | 'premium';
  description?: string;
}

export interface MokoPaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  message?: string;
  error?: string;
}

export interface PaymentRecord {
  userId: string;
  transactionId: string;
  amount: number;
  currency: 'USD' | 'CDF';
  provider: string;
  phoneNumber: string;
  planId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  mokoReference?: string;
  stripePaymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// User verification types
export interface VerificationRecord {
  sessionId: string;
  identifier: string;
  type: 'phone' | 'email';
  countryCode: string;
  codeHash: string;
  attempts: number;
  verified: boolean;
  verifiedAt?: Date;
  verificationToken?: string;
  tokenExpiresAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

// User profile with location
export interface UserProfileData {
  userId: string;
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
  phoneVerified?: boolean;
  countryCode?: string;
  isInDRC?: boolean;
  verified?: boolean;
  verifiedAt?: Date;
  preferredLanguage: 'fr' | 'en';
  preferredCurrency: 'USD' | 'CDF';
  notificationsEnabled: boolean;
  priceAlertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  // ML & AI fields
  behaviorProfile?: any; // UserBehaviorProfile
  recommendationPreferences?: any; // RecommendationPreferences
  engagementMetrics?: any; // UserEngagementMetrics
}
