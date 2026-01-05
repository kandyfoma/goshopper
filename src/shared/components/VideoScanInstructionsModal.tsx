/**
 * Video Scan Instructions Modal
 * Uses the same modal structure as the payment modal
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal as RNModal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from '@/shared/components/Icon';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';

interface VideoScanInstructionsModalProps {
  visible: boolean;
  onClose: () => void;
  onUsePhoto?: () => void;
  onStartVideo: () => void;
}

export default function VideoScanInstructionsModal({
  visible,
  onClose,
  onUsePhoto,
  onStartVideo,
}: VideoScanInstructionsModalProps) {
  const insets = useSafeAreaInsets();

  // Animation values
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Animate modal entrance
  useEffect(() => {
    if (visible) {
      // Parallel animations for smooth entrance
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start();
    } else {
      // Reset animations when hidden
      slideAnim.setValue(Dimensions.get('window').height);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
    }
  }, [visible]);

  const handleStartVideo = () => {
    onClose();
    onStartVideo();
  };

  const handleUsePhoto = () => {
    onClose();
    if (onUsePhoto) {
      onUsePhoto();
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {Platform.OS === 'ios' ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="light"
              blurAmount={25}
            />
          </Animated.View>
        ) : (
          <Animated.View style={[styles.androidOverlay, { opacity: fadeAnim }]} />
        )}
        <View style={styles.overlayContent}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={onClose}
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
                  <Text style={styles.headerTitle}>Comment scanner en vidéo</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Icon name="x" size="md" color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>

              {/* Rule 1 */}
              <View style={styles.ruleHeader}>
                <Icon name="zap" size="sm" color={Colors.status.warning} />
                <Text style={styles.ruleTitle}>RÈGLE #1: SCANNEZ TRÈS LENTEMENT!</Text>
              </View>
              <Text style={styles.ruleText}>Prenez 10-15 secondes pour tout le reçu.</Text>

              {/* Rule 2 */}
              <View style={styles.ruleHeader}>
                <Icon name="list" size="sm" color={Colors.primary} />
                <Text style={styles.ruleTitle}>RÈGLE #2: SÉQUENCE CORRECTE</Text>
              </View>
              <View style={styles.stepsList}>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNumber}>1.</Text>
                  <Text style={styles.stepText}>Commencez 5cm AU-DESSUS du nom du magasin</Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNumber}>2.</Text>
                  <Text style={styles.stepText}>Descendez LENTEMENT ligne par ligne (1-2s par section)</Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNumber}>3.</Text>
                  <Text style={styles.stepText}>Terminez 5cm APRÈS le total</Text>
                </View>
              </View>

              {/* Rule 3 */}
              <View style={styles.ruleHeader}>
                <Icon name="sun" size="sm" color={Colors.accent} />
                <Text style={styles.ruleTitle}>RÈGLE #3: QUALITÉ</Text>
              </View>
              <View style={styles.qualityList}>
                <View style={styles.qualityRow}>
                  <Icon name="check-circle" size="xs" color={Colors.status.success} />
                  <Text style={styles.qualityText}>Utilisez les DEUX mains pour stabilité</Text>
                </View>
                <View style={styles.qualityRow}>
                  <Icon name="check-circle" size="xs" color={Colors.status.success} />
                  <Text style={styles.qualityText}>Bonne lumière (près d'une fenêtre)</Text>
                </View>
                <View style={styles.qualityRow}>
                  <Icon name="check-circle" size="xs" color={Colors.status.success} />
                  <Text style={styles.qualityText}>Distance: 20-30cm du reçu</Text>
                </View>
              </View>

              {/* Tip */}
              <View style={styles.tipHeader}>
                <Icon name="info" size="sm" color={Colors.status.info} />
                <Text style={styles.tipTitle}>ASTUCE</Text>
              </View>
              <Text style={styles.tipText}>
                Reçu court (&lt; 10 articles)?{'\n'}
                Le mode PHOTO est plus précis et plus rapide!
              </Text>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {onUsePhoto && (
                <TouchableOpacity style={styles.photoButton} onPress={handleUsePhoto}>
                  <Icon name="camera" size="sm" color={Colors.white} />
                  <Text style={styles.photoButtonText}>Utiliser PHOTO</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.primaryButton} onPress={handleStartVideo}>
                <Icon name="video" size="sm" color={Colors.white} />
                <Text style={styles.primaryButtonText}>
                  OK, compris
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
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
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 16,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
  },
  ruleText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    paddingLeft: 8,
    marginBottom: 12,
  },
  stepsList: {
    gap: 10,
    paddingLeft: 8,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumber: {
    fontSize: 14,
    lineHeight: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  qualityList: {
    gap: 10,
    paddingLeft: 8,
    marginBottom: 16,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  qualityText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 16,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tipText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    paddingLeft: 8,
    marginBottom: 24,
  },
  buttonContainer: {
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoButton: {
    backgroundColor: Colors.primary, // Light blue
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  photoButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  primaryButton: {
    backgroundColor: Colors.accentLight, // Light blue background
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: Colors.accentLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white, // White text
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
});
