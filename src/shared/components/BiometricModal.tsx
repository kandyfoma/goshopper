import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from './Icon';
import {AnimatedModal} from './AnimatedModal';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';

// Branding colors
const DARK_BLUE = '#003049';  // Cosmos Blue
const LIGHT_BLUE = '#669BBC'; // Blue Marble

interface BiometricModalProps {
  visible: boolean;
  biometryType: 'TouchID' | 'FaceID' | 'Biometrics' | null;
  onAccept: () => void;
  onDecline: () => void;
}

export const BiometricModal: React.FC<BiometricModalProps> = ({
  visible,
  biometryType,
  onAccept,
  onDecline,
}) => {
  // Debug logging
  React.useEffect(() => {
    console.log('🔐 [BiometricModal] Render state:', {visible, biometryType});
  }, [visible, biometryType]);

  const getBiometricIcon = () => {
    switch (biometryType) {
      case 'FaceID':
        return 'scan-face';
      case 'TouchID':
      case 'Biometrics':
      default:
        return 'fingerprint';
    }
  };

  const getBiometricText = () => {
    switch (biometryType) {
      case 'FaceID':
        return 'Face ID';
      case 'TouchID':
        return 'Touch ID';
      case 'Biometrics':
      default:
        return 'Biométrie';
    }
  };

  return (
    <AnimatedModal
      visible={visible}
      onClose={onDecline}
      variant="centered"
      overlayOpacity={0.5}
      disableBackdropPress>
      <View style={styles.container}>
          {/* Icon with dark blue background */}
          <View style={styles.iconContainer}>
            <Icon 
              name={getBiometricIcon()} 
              size="xl" 
              color={Colors.white} 
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            Activer {getBiometricText()}
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            Souhaitez-vous utiliser {getBiometricText()} pour vous connecter plus rapidement lors de vos prochaines visites ?
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptButtonText}>Oui, activer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={onDecline}
              activeOpacity={0.8}
            >
              <Text style={styles.declineButtonText}>Non, merci</Text>
            </TouchableOpacity>
          </View>
        </View>
    </AnimatedModal>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingHorizontal: Spacing.md,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    ...Shadows.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DARK_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: DARK_BLUE,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: Spacing.md,
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  acceptButton: {
    backgroundColor: DARK_BLUE,
    ...Shadows.sm,
  },
  acceptButtonText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  declineButton: {
    backgroundColor: LIGHT_BLUE,
  },
  declineButtonText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
});
