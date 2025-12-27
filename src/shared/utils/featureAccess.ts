/**
 * Feature Access Control System
 * Controls which features are available based on subscription tier
 */

import {Subscription} from '../types';
import {Alert} from 'react-native';

export type FeatureName =
  | 'stats'
  | 'analytics'
  | 'priceComparison'
  | 'priceHistory'
  | 'priceAlerts'
  | 'categoryAnalysis'
  | 'dataExport'
  | 'offlineMode'
  | 'shoppingLists'
  | 'multipleShoppingLists';

/**
 * Feature availability by plan
 */
const FEATURE_ACCESS: Record<FeatureName, string[]> = {
  // Stats/Analytics - Premium only
  stats: ['premium'],
  analytics: ['premium'],
  
  // Price features - Standard+
  priceComparison: ['standard', 'premium'],
  priceHistory: ['standard', 'premium'],
  priceAlerts: ['premium'],
  
  // Analysis - Standard+
  categoryAnalysis: ['standard', 'premium'],
  
  // Data management - Premium
  dataExport: ['premium'],
  
  // Offline - Standard+
  offlineMode: ['standard', 'premium'],
  
  // Shopping Lists - Basic+ (freemium gets 1 list only)
  shoppingLists: ['basic', 'standard', 'premium'],
  multipleShoppingLists: ['basic', 'standard', 'premium'],
};

/**
 * Feature descriptions for upgrade prompts
 */
const FEATURE_DESCRIPTIONS: Record<FeatureName, {
  name: string;
  description: string;
  minPlan: string;
}> = {
  stats: {
    name: 'Statistiques',
    description: 'Visualisez vos dépenses mensuelles et tendances',
    minPlan: 'Premium',
  },
  analytics: {
    name: 'Analytics Pro',
    description: 'Analyses avancées et prévisions de dépenses',
    minPlan: 'Premium',
  },
  priceComparison: {
    name: 'Comparaison de prix',
    description: 'Comparez les prix entre différents magasins',
    minPlan: 'Standard',
  },
  priceHistory: {
    name: 'Historique des prix',
    description: 'Suivez l\'évolution des prix dans le temps',
    minPlan: 'Standard',
  },
  priceAlerts: {
    name: 'Alertes de prix',
    description: 'Recevez des alertes quand les prix baissent',
    minPlan: 'Premium',
  },
  categoryAnalysis: {
    name: 'Analyse par catégorie',
    description: 'Analysez vos dépenses par catégorie de produits',
    minPlan: 'Standard',
  },
  dataExport: {
    name: 'Export de données',
    description: 'Exportez vos reçus et statistiques',
    minPlan: 'Premium',
  },
  offlineMode: {
    name: 'Mode hors ligne',
    description: 'Scannez sans connexion internet',
    minPlan: 'Standard',
  },
  shoppingLists: {
    name: 'Listes de courses',
    description: 'Créez et gérez vos listes de courses',
    minPlan: 'Basic',
  },
  multipleShoppingLists: {
    name: 'Plusieurs listes',
    description: 'Créez plusieurs listes de courses',
    minPlan: 'Basic',
  },
};

/**
 * Check if user has access to a feature
 */
export function hasFeatureAccess(
  feature: FeatureName,
  subscription: Subscription | null,
): boolean {
  if (!subscription) return false;

  const planId = subscription.planId || 'freemium';
  const allowedPlans = FEATURE_ACCESS[feature];

  // During trial, user has access to all features (full Premium access)
  if (subscription.status === 'trial') {
    // Verify trial is still valid
    if (subscription.trialEndDate) {
      const now = new Date();
      const trialEnd = subscription.trialEndDate instanceof Date 
        ? subscription.trialEndDate 
        : new Date(subscription.trialEndDate);
      if (now < trialEnd) {
        return true;
      }
    }
  }
  
  // Cancelled but still in paid period - maintain access
  if (subscription.status === 'cancelled' && subscription.subscriptionEndDate) {
    const now = new Date();
    const endDate = subscription.subscriptionEndDate instanceof Date
      ? subscription.subscriptionEndDate
      : new Date(subscription.subscriptionEndDate);
    if (now < endDate) {
      return allowedPlans.includes(planId);
    }
    // Cancelled and expired - no access
    return false;
  }
  
  // Grace period - maintain limited access
  if (subscription.status === 'grace') {
    return allowedPlans.includes(planId);
  }
  
  // Expired or pending - no premium features
  if (subscription.status === 'expired' || subscription.status === 'pending') {
    return false;
  }

  return allowedPlans.includes(planId);
}

/**
 * Show upgrade prompt for locked feature
 */
export function showUpgradePrompt(
  feature: FeatureName,
  onUpgrade: () => void,
): void {
  const featureInfo = FEATURE_DESCRIPTIONS[feature];

  Alert.alert(
    `${featureInfo.name} - ${featureInfo.minPlan}`,
    `${featureInfo.description}\n\nMettez à niveau vers ${featureInfo.minPlan} pour débloquer cette fonctionnalité.`,
    [
      {
        text: 'Plus tard',
        style: 'cancel',
      },
      {
        text: 'Mettre à niveau',
        onPress: onUpgrade,
      },
    ],
  );
}

/**
 * Get minimum plan required for a feature
 */
export function getMinimumPlanFor(feature: FeatureName): string {
  return FEATURE_DESCRIPTIONS[feature].minPlan;
}

/**
 * Check if user can create more shopping lists
 */
export function canCreateShoppingList(
  subscription: Subscription | null,
  currentListCount: number,
): {canCreate: boolean; reason?: string} {
  if (!subscription) {
    return {canCreate: false, reason: 'Aucun abonnement'};
  }

  // Trial users have full access
  if (subscription.status === 'trial' && subscription.trialEndDate) {
    const now = new Date();
    const trialEnd = subscription.trialEndDate instanceof Date
      ? subscription.trialEndDate
      : new Date(subscription.trialEndDate);
    if (now < trialEnd) {
      return {canCreate: true};
    }
  }

  const planId = subscription.planId || 'freemium';

  // Freemium: 1 list only
  if (planId === 'freemium' || subscription.status === 'freemium') {
    if (currentListCount >= 1) {
      return {
        canCreate: false,
        reason: 'Passez à Basic pour créer plusieurs listes',
      };
    }
  }
  
  // Expired or pending - restrict to 1 list
  if (subscription.status === 'expired' || subscription.status === 'pending') {
    if (currentListCount >= 1) {
      return {
        canCreate: false,
        reason: 'Renouvelez votre abonnement pour créer plus de listes',
      };
    }
  }

  // All other plans: unlimited
  return {canCreate: true};
}

/**
 * Get user-friendly plan name
 */
export function getPlanDisplayName(planId: string): string {
  const planNames: Record<string, string> = {
    freemium: 'Gratuit',
    free: 'Essai Gratuit',
    basic: 'Basic',
    standard: 'Standard',
    premium: 'Premium',
  };
  return planNames[planId] || planId;
}

/**
 * Get plan tier level (higher = more features)
 */
export function getPlanTier(planId: string): number {
  const tiers: Record<string, number> = {
    freemium: 0,
    free: 0,
    basic: 1,
    standard: 2,
    premium: 3,
  };
  return tiers[planId] || 0;
}

/**
 * Check if user has downgraded from a higher plan
 * Returns previous plan info if detected
 */
export function checkDowngradeStatus(subscription: Subscription | null): {
  isDowngraded: boolean;
  previousPlan?: string;
  currentPlan?: string;
  lostFeatures?: FeatureName[];
} {
  if (!subscription) {
    return { isDowngraded: false };
  }

  const currentPlan = subscription.planId || 'freemium';
  
  // Check if there's a recorded previous plan that was higher tier
  // This could be stored in subscription document after downgrade
  const previousPlan = (subscription as any).previousPlanId;
  
  if (previousPlan && getPlanTier(previousPlan) > getPlanTier(currentPlan)) {
    // Determine which features were lost
    const lostFeatures: FeatureName[] = [];
    
    for (const [feature, allowedPlans] of Object.entries(FEATURE_ACCESS)) {
      if (allowedPlans.includes(previousPlan) && !allowedPlans.includes(currentPlan)) {
        lostFeatures.push(feature as FeatureName);
      }
    }
    
    return {
      isDowngraded: true,
      previousPlan: getPlanDisplayName(previousPlan),
      currentPlan: getPlanDisplayName(currentPlan),
      lostFeatures,
    };
  }

  return { isDowngraded: false };
}

/**
 * Get features lost when downgrading between plans
 */
export function getFeaturesLostOnDowngrade(
  fromPlan: string,
  toPlan: string,
): { feature: FeatureName; name: string; description: string }[] {
  const lostFeatures: { feature: FeatureName; name: string; description: string }[] = [];

  for (const [feature, allowedPlans] of Object.entries(FEATURE_ACCESS)) {
    if (allowedPlans.includes(fromPlan) && !allowedPlans.includes(toPlan)) {
      const info = FEATURE_DESCRIPTIONS[feature as FeatureName];
      lostFeatures.push({
        feature: feature as FeatureName,
        name: info.name,
        description: info.description,
      });
    }
  }

  return lostFeatures;
}

/**
 * Check if a specific feature requires upgrade from current plan
 */
export function getRequiredPlanForFeature(feature: FeatureName): string {
  const allowedPlans = FEATURE_ACCESS[feature];
  
  // Return the lowest tier plan that has access
  if (allowedPlans.includes('basic')) return 'Basic';
  if (allowedPlans.includes('standard')) return 'Standard';
  if (allowedPlans.includes('premium')) return 'Premium';
  
  return 'Premium';
}
