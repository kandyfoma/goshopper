// Type definitions for Subscription

export type SubscriptionPlanId = 'freemium' | 'free' | 'basic' | 'standard' | 'premium';
export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'grace'
  | 'freemium'
  | 'expired'
  | 'cancelled'
  | 'pending'
  | 'expiring_soon';
export type SubscriptionDuration = 1 | 3 | 6; // Months
export type MobileMoneyProvider = 'mpesa' | 'orange' | 'airtel' | 'afrimoney';
export type PaymentMethodType = 'mobile_money' | 'card';
export type PaymentProviderType = 'moko_afrika' | 'stripe';

export interface Subscription {
  userId: string;

  // Trial tracking (2-month free trial)
  trialScansUsed: number;
  trialScansLimit: number;
  trialStartDate?: Date;
  trialEndDate?: Date;
  trialExtended?: boolean;

  // Monthly usage tracking
  monthlyScansUsed: number;
  currentBillingPeriodStart?: Date;
  currentBillingPeriodEnd?: Date;

  // Subscription details
  isSubscribed: boolean;
  planId?: SubscriptionPlanId;
  plan?: SubscriptionPlanId; // Alias for planId
  status: SubscriptionStatus;
  durationMonths?: SubscriptionDuration; // Subscription duration in months
  gracePeriodEnd?: Date; // Grace period end date (7 days to use remaining scans)

  // Billing
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  expiryDate?: Date; // Alias for subscriptionEndDate
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  currency?: 'USD' | 'CDF';

  // Payment info
  paymentMethod?: PaymentMethodType;
  paymentProvider?: PaymentProviderType;
  mobileMoneyProvider?: MobileMoneyProvider;
  transactionId?: string;
  transactionRef?: string;
  stripePaymentIntentId?: string;
  customerPhone?: string;
  customerEmail?: string;

  // Auto-renewal
  autoRenew: boolean;

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

export interface SubscriptionState {
  subscription: Subscription | null;
  isLoading: boolean;
  canScan: boolean;
  scansRemaining: number;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  isExpiringSoon: boolean;
  daysUntilExpiration: number;
  error: string | null;
}

export interface PlanPricing {
  plan: SubscriptionPlanId;
  name: string;
  priceUSD: number;
  priceCDF: number;
  duration: string;
  scanLimit: number;
  features: string[];
  popular?: boolean;
}

// Duration-based pricing with discounts
export interface DurationPricing {
  months: SubscriptionDuration;
  label: string;
  labelFr: string;
  discountPercent: number;
  badge?: string;
  badgeFr?: string;
}

export const SUBSCRIPTION_DURATIONS: DurationPricing[] = [
  {months: 1, label: '1 Month', labelFr: '1 Mois', discountPercent: 0},
  {
    months: 3,
    label: '3 Months',
    labelFr: '3 Mois',
    discountPercent: 10,
    badge: 'Save 10%',
    badgeFr: '-10%',
  },
  {
    months: 6,
    label: '6 Months',
    labelFr: '6 Mois',
    discountPercent: 20,
    badge: 'Best Value',
    badgeFr: 'Meilleur prix',
  },
];

export const PLAN_PRICING: PlanPricing[] = [
  {
    plan: 'free',
    name: 'Essai Gratuit',
    priceUSD: 0,
    priceCDF: 0,
    duration: '1 mois',
    scanLimit: 15,
    features: [
      '1 mois gratuit',
      "15 scans pendant l'essai",
      'Toutes les fonctionnalités premium',
    ],
  },
  {
    plan: 'basic',
    name: 'Basic',
    priceUSD: 1.99,
    priceCDF: 8000,
    duration: 'mois',
    scanLimit: 25,
    features: [
      '25 scans par mois',
      'Comparaison de prix basique',
      'Historique 30 jours',
    ],
  },
  {
    plan: 'standard',
    name: 'Standard',
    priceUSD: 2.99,
    priceCDF: 12000,
    duration: 'mois',
    scanLimit: 100,
    features: [
      '100 scans par mois',
      'Rapports de dépenses',
      'Historique des prix',
      'Analyse par catégorie',
    ],
    popular: true,
  },
  {
    plan: 'premium',
    name: 'Premium',
    priceUSD: 4.99,
    priceCDF: 20000,
    duration: 'mois',
    scanLimit: -1,
    features: [
      'Scans illimités',
      'Alertes de prix',
      'Listes de courses',
      'Export des données',
      'Support prioritaire',
    ],
  },
];

export const TRIAL_SCAN_LIMIT = 5;
