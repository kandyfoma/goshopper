// Caps Lock Detection Hook and Component
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing } from '@/shared/theme/theme';
import Icon from './Icon';

interface CapsLockIndicatorProps {
  value: string;
  visible?: boolean;
  style?: ViewStyle;
}

export const CapsLockIndicator: React.FC<CapsLockIndicatorProps> = ({ 
  value, 
  visible = true,
  style 
}) => {
  const [showCapsWarning, setShowCapsWarning] = useState(false);

  useEffect(() => {
    // Detect if user might have caps lock on
    // Heuristic: if password has multiple uppercase letters and no lowercase
    if (value.length >= 2) {
      const hasUppercase = /[A-Z]/.test(value);
      const hasLowercase = /[a-z]/.test(value);
      const uppercaseCount = (value.match(/[A-Z]/g) || []).length;
      
      // Show warning if mostly uppercase letters and no lowercase
      const shouldShow = hasUppercase && !hasLowercase && uppercaseCount >= 2;
      setShowCapsWarning(shouldShow);
    } else {
      setShowCapsWarning(false);
    }
  }, [value]);

  if (!visible || !showCapsWarning) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <Icon name="alert-triangle" size="xs" color={Colors.status.warning} />
      <Text style={styles.text}>
        Caps Lock pourrait être activé
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.warningLight,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  text: {
    fontSize: Typography.fontSize.xs,
    color: Colors.status.warning,
    flex: 1,
  },
});