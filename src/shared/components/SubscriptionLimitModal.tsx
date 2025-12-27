/**
 * Subscription Limit Modal
 * Beautiful modal that blocks access when user hasn't paid for subscription
 * Used instead of Alert.alert for a better UX
 */

import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import Icon from '@/shared/components/Icon';
import {Colors, Typography, Spacing} from '@/shared/theme/theme';
import {AnimatedModal} from './AnimatedModal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type LimitType = 'scan' | 'shoppingList' | 'receipt' | 'generic' | 'stats' | 'priceComparison' | 'downgrade';

interface SubscriptionLimitModalProps {
  visible: boolean;
  onClose: () => void;
  limitType?: LimitType;
  customTitle?: string;
  customMessage?: string;
  isTrialActive?: boolean;
  previousPlan?: string;
  currentPlan?: string;
  requiredPlan?: string;
}

const LIMIT_CONTENT: Record<LimitType, { icon: string; title: string; message: string; trialMessage: string }> = {
  scan: {
    icon: 'camera-off',
    title: 'Limite de Scans Atteinte',
    message: 'Vous avez atteint votre limite de scans mensuels. Passez à Premium pour continuer à scanner vos reçus.',
    trialMessage: 'Vous avez utilisé tous vos scans gratuits ce mois. Passez à Premium pour continuer.',
  },
  shoppingList: {
    icon: 'list',
    title: 'Limite de Listes Atteinte',
    message: 'Votre plan actuel ne permet qu\'une seule liste de courses. Passez à Premium pour créer des listes illimitées.',
    trialMessage: 'Passez à Premium pour créer des listes de courses illimitées.',
  },
  receipt: {
    icon: 'file-text',
    title: 'Accès Limité',
    message: 'Cette fonctionnalité nécessite un abonnement Premium. Mettez à niveau pour en profiter.',
    trialMessage: 'Passez à Premium pour accéder à toutes les fonctionnalités.',
  },
  stats: {
    icon: 'bar-chart-2',
    title: 'Statistiques Premium',
    message: 'Les statistiques détaillées sont réservées aux abonnés Premium. Mettez à niveau pour visualiser vos dépenses.',
    trialMessage: 'Passez à Premium pour accéder aux statistiques détaillées.',
  },
  priceComparison: {
    icon: 'trending-up',
    title: 'Comparaison de Prix',
    message: 'La comparaison de prix est disponible à partir du plan Standard. Mettez à niveau pour comparer les prix.',
    trialMessage: 'Passez à Standard ou Premium pour comparer les prix.',
  },
  downgrade: {
    icon: 'alert-triangle',
    title: 'Fonctionnalité Non Disponible',
    message: 'Cette fonctionnalité n\'est plus disponible avec votre plan actuel. Repassez à un plan supérieur pour y accéder.',
    trialMessage: 'Mettez à niveau pour retrouver l\'accès à cette fonctionnalité.',
  },
  generic: {
    icon: 'lock',
    title: 'Fonctionnalité Premium',
    message: 'Cette fonctionnalité est réservée aux abonnés Premium. Mettez à niveau pour y accéder.',
    trialMessage: 'Passez à Premium pour débloquer cette fonctionnalité.',
  },
};

export default function SubscriptionLimitModal({
  visible,
  onClose,
  limitType = 'generic',
  customTitle,
  customMessage,
  isTrialActive = false,
  previousPlan,
  currentPlan,
  requiredPlan,
}: SubscriptionLimitModalProps) {
  const navigation = useNavigation<NavigationProp>();
  
  const content = LIMIT_CONTENT[limitType];
  
  // Generate dynamic message for downgrade scenario
  let title = customTitle || content.title;
  let message = customMessage || (isTrialActive ? content.trialMessage : content.message);
  
  if (limitType === 'downgrade' && previousPlan && currentPlan) {
    title = 'Accès Restreint';
    message = `Vous êtes passé de ${previousPlan} à ${currentPlan}. Cette fonctionnalité nécessite le plan ${requiredPlan || 'supérieur'}. Mettez à niveau pour retrouver l'accès.`;
  }

  const handleUpgrade = () => {
    onClose();
    navigation.navigate('Subscription');
  };

  const handleBuyScans = () => {
    onClose();
    navigation.navigate('Subscription');
  };

  const handleGoBack = () => {
    onClose();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // Show buy scans option for scan-related limits
  const showBuyScansOption = limitType === 'scan';

  return (
    <AnimatedModal
      visible={visible}
      onClose={handleGoBack}
      variant="centered"
      overlayOpacity={0.6}>
      <View style={styles.modal}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconOuter}>
              <View style={styles.iconInner}>
                <Icon name={content.icon} size="xl" color={Colors.accent} />
              </View>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Premium benefits preview */}
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitRow}>
              <Icon name="check-circle" size="sm" color={Colors.status.success} />
              <Text style={styles.benefitText}>Scans illimités</Text>
            </View>
            <View style={styles.benefitRow}>
              <Icon name="check-circle" size="sm" color={Colors.status.success} />
              <Text style={styles.benefitText}>Listes de courses illimitées</Text>
            </View>
            <View style={styles.benefitRow}>
              <Icon name="check-circle" size="sm" color={Colors.status.success} />
              <Text style={styles.benefitText}>Comparaison de prix avancée</Text>
            </View>
          </View>

          {/* Buy Scans Option - for scan limit */}
          {showBuyScansOption && (
            <TouchableOpacity style={styles.buyScansButton} onPress={handleBuyScans}>
              <Icon name="zap" size="sm" color={Colors.white} />
              <Text style={styles.buyScansButtonText}>Acheter des Scans</Text>
            </TouchableOpacity>
          )}

          {/* Primary Action - Upgrade */}
          <TouchableOpacity style={[styles.primaryButton, showBuyScansOption && styles.primaryButtonAlt]} onPress={handleUpgrade}>
            <Icon name="crown" size="sm" color={showBuyScansOption ? Colors.accent : Colors.white} />
            <Text style={[styles.primaryButtonText, showBuyScansOption && styles.primaryButtonTextAlt]}>
              {showBuyScansOption ? 'Ou mettre à niveau' : 'Mettre à niveau'}
            </Text>
          </TouchableOpacity>

          {/* Secondary Action - Go Back */}
          <TouchableOpacity style={styles.secondaryButton} onPress={handleGoBack}>
            <Text style={styles.secondaryButtonText}>Plus tard</Text>
          </TouchableOpacity>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.background.secondary, // Warm cream
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.accentLight, // Light blue
  },
  iconInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.accentLight, // Light blue
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  benefitsContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: Colors.accent, // Deep blue
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonAlt: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.accent,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  primaryButtonTextAlt: {
    color: Colors.accent,
  },
  buyScansButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buyScansButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
});
