// Social Sign-In Buttons Component
import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet} from 'react-native';
import Icon from './Icon';
import {Colors, Spacing, BorderRadius, Typography} from '../theme/theme';

interface SocialSignInButtonProps {
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function SocialSignInButtons({
  onGoogleSignIn,
  onAppleSignIn,
  isLoading = false,
  disabled = false,
}: SocialSignInButtonProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.googleButton, disabled && styles.disabledButton]}
        onPress={onGoogleSignIn}
        disabled={disabled || isLoading}>
        <Icon name="google" size="sm" color={Colors.text.primary} />
        <Text style={[styles.googleButtonText, disabled && styles.disabledText]}>
          Continuer avec Google
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.appleButton, disabled && styles.disabledButton]}
        onPress={onAppleSignIn}
        disabled={disabled || isLoading}>
        <Icon name="apple" size="sm" color={Colors.white} />
        <Text style={[styles.appleButtonText, disabled && styles.disabledText]}>
          Continuer avec Apple
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    shadowColor: Colors.shadow.light,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.black,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  googleButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
  },
  appleButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
    marginLeft: Spacing.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.6,
  },
});