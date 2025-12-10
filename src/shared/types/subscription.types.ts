// Type definitions for Subscription

export type SubscriptionPlanId = 'free' | 'basic' | 'standard' | 'premium';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled' | 'pending';
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

export const PLAN_PRICING: PlanPricing[] = [
  {
    plan: 'free',
    name: 'Essai Gratuit',
    priceUSD: 0,
    priceCDF: 0,
    duration: '2 mois',
    scanLimit: -1,
    features: [
      '2 mois gratuits',
      'Scans illimités pendant l\'essai',
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
