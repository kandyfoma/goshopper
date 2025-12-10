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
  rawText?: string;
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
  planId?: 'free' | 'basic' | 'standard' | 'premium';
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'pending';
  
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
  currency: 'USD' | 'CDF';
  unit?: string;
  quantity?: number;
  pricePerUnit?: number;
  recordedAt: Date;
  receiptId: string;
  userId: string;
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
}
