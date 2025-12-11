// Social Sign-In Buttons Component
// Shows Google on Android, Apple on iOS
import React from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Platform} from 'react-native';
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
      {/* Google Sign-In - Android only */}
      {Platform.OS === 'android' && (
        <TouchableOpacity
          style={[styles.googleButton, disabled && styles.disabledButton]}
          onPress={onGoogleSignIn}
          disabled={disabled || isLoading}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={[styles.googleButtonText, disabled && styles.disabledText]}>
            Continuer avec Google
          </Text>
        </TouchableOpacity>
      )}

      {/* Apple Sign-In - iOS only */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.appleButton, disabled && styles.disabledButton]}
          onPress={onAppleSignIn}
          disabled={disabled || isLoading}>
          <Icon name="apple-fill" size="sm" color={Colors.white} />
          <Text style={[styles.appleButtonText, disabled && styles.disabledText]}>
            Continuer avec Apple
          </Text>
        </TouchableOpacity>
      )}
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
    borderWidth: 1.5,
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
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
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