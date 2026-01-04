/**
 * Subscription Limit Modal
 * Beautiful modal that blocks access when user hasn't paid for subscription
 * Used instead of Alert.alert for a better UX
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import RNModal from 'react-native-modal';
import {BlurView} from '@react-native-community/blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@/shared/types';
import Icon from '@/shared/components/Icon';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';

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
  const insets = useSafeAreaInsets();

  // Animation refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const content = LIMIT_CONTENT[limitType];

  // Generate dynamic message for downgrade scenario
  let title = customTitle || content.title;
  let message = customMessage || (isTrialActive ? content.trialMessage : content.message);

  if (limitType === 'downgrade' && previousPlan && currentPlan) {
    title = 'Accès Restreint';
    message = `Vous êtes passé de ${previousPlan} à ${currentPlan}. Cette fonctionnalité nécessite le plan ${requiredPlan || 'supérieur'}. Mettez à niveau pour retrouver l'accès.`;
  }

  // Animation effects
  useEffect(() => {
    if (visible) {
      // Reset animations
      slideAnim.setValue(100);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);

      // Start animations
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim, scaleAnim]);

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
    <RNModal
      isVisible={visible}
      onBackdropPress={handleGoBack}
      onBackButtonPress={handleGoBack}
      backdropOpacity={0.25}
      animationIn="fadeIn"
      animationOut="fadeOut"
      useNativeDriver={true}
      hideModalContentWhileAnimating={true}
      style={styles.modal}>
      {Platform.OS === 'ios' ? (
        <BlurView style={styles.overlay} blurType="dark" blurAmount={10}>
          <Animated.View style={[styles.androidOverlay, { opacity: fadeAnim }]} />
          <View style={styles.overlayContent}>
            <TouchableOpacity
              style={styles.overlayTouchable}
              activeOpacity={1}
              onPress={handleGoBack}
            />
            <Animated.View
              style={[
                styles.modalContent,
                {
                  paddingBottom: insets.bottom + Spacing.lg,
                  transform: [
                    { translateY: slideAnim },
                    { scale: scaleAnim },
                  ],
                }
              ]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerDrag} />
                <View style={styles.headerTop}>
                  <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{title}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleGoBack}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                    <Icon name="x" size="md" color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <View style={styles.iconOuter}>
                    <View style={styles.iconInner}>
                      <Icon name={content.icon} size="xl" color={Colors.primary} />
                    </View>
                  </View>
                </View>

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
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {/* Buy Scans Option - for scan limit */}
                {showBuyScansOption && (
                  <TouchableOpacity style={styles.photoButton} onPress={handleBuyScans}>
                    <Icon name="zap" size="sm" color={Colors.white} />
                    <Text style={styles.photoButtonText}>Acheter des Scans</Text>
                  </TouchableOpacity>
                )}

                {/* Primary Action - Upgrade */}
                <TouchableOpacity style={[styles.primaryButton, showBuyScansOption && styles.primaryButtonAlt]} onPress={handleUpgrade}>
                  <Icon name="crown" size="sm" color={showBuyScansOption ? Colors.primary : Colors.white} />
                  <Text style={[styles.primaryButtonText, showBuyScansOption && styles.primaryButtonTextAlt]}>
                    {showBuyScansOption ? 'Ou mettre à niveau' : 'Mettre à niveau'}
                  </Text>
                </TouchableOpacity>

                {/* Secondary Action - Go Back */}
                <TouchableOpacity style={styles.secondaryButton} onPress={handleGoBack}>
                  <Text style={styles.secondaryButtonText}>Plus tard</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </BlurView>
      ) : (
        <Animated.View style={[styles.androidOverlay, { opacity: fadeAnim }]} />
      )}
      <View style={styles.overlayContent}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleGoBack}
        />
        <Animated.View
          style={[
            styles.modalContent,
            {
              paddingBottom: insets.bottom + Spacing.lg,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            }
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerDrag} />
            <View style={styles.headerTop}>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>{title}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleGoBack}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon name="x" size="md" color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconOuter}>
                <View style={styles.iconInner}>
                  <Icon name={content.icon} size="xl" color={Colors.primary} />
                </View>
              </View>
            </View>

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
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Buy Scans Option - for scan limit */}
            {showBuyScansOption && (
              <TouchableOpacity style={styles.photoButton} onPress={handleBuyScans}>
                <Icon name="zap" size="sm" color={Colors.white} />
                <Text style={styles.photoButtonText}>Acheter des Scans</Text>
              </TouchableOpacity>
            )}

            {/* Primary Action - Upgrade */}
            <TouchableOpacity style={[styles.primaryButton, showBuyScansOption && styles.primaryButtonAlt]} onPress={handleUpgrade}>
              <Icon name="crown" size="sm" color={showBuyScansOption ? Colors.primary : Colors.white} />
              <Text style={[styles.primaryButtonText, showBuyScansOption && styles.primaryButtonTextAlt]}>
                {showBuyScansOption ? 'Ou mettre à niveau' : 'Mettre à niveau'}
              </Text>
            </TouchableOpacity>

            {/* Secondary Action - Go Back */}
            <TouchableOpacity style={styles.secondaryButton} onPress={handleGoBack}>
              <Text style={styles.secondaryButtonText}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    minHeight: '75%',
    maxHeight: '95%',
    ...Shadows.lg,
  },
  header: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerDrag: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border.medium,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconOuter: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent, // Cosmos Blue
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary, // Crimson Blaze
  },
  iconInner: {
    width: 70,
    height: 70,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary, // Crimson Blaze
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
    paddingHorizontal: Spacing.sm,
  },
  benefitsContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  benefitText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  buttonContainer: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  photoButton: {
    backgroundColor: Colors.primary, // Crimson Blaze
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  photoButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  primaryButton: {
    backgroundColor: Colors.primary, // Crimson Blaze
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonAlt: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary, // Crimson Blaze
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  primaryButtonTextAlt: {
    color: Colors.primary, // Crimson Blaze
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
});
