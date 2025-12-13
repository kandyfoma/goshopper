/**
 * Empty State Component - Urbanist Design
 *
 * Modern empty state with soft pastels and clean typography
 */

import React, {useRef, useEffect} from 'react';
import {View, Text, StyleSheet, ViewStyle, Animated} from 'react-native';
import {Typography, Spacing} from '../theme/theme';
import Icon from './Icon';
import Button from './Button';

// Urbanist Design Colors
const URBANIST_COLORS = {
  background: '#FFFFFF',
  cardBg: '#FFFFFF',
  primaryAccent: '#D8DFE9',
  secondaryAccent: '#FDF0D5',
  highlightAccent: '#EFF0A3',
  textPrimary: '#212121',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  purple: '#8B5CF6',
  border: '#E5E7EB',
};

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox-line',
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle bounce animation for icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconBounce, {
          toValue: -8,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(iconBounce, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{scale: scaleAnim}],
        },
      ]}>
      <Animated.View
        style={[styles.iconContainer, {transform: [{translateY: iconBounce}]}]}>
        <View style={styles.iconInner}>
          <Icon name={icon} size="3xl" color={URBANIST_COLORS.purple} />
        </View>
        <View style={styles.iconGlow} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <View style={styles.buttonContainer}>
          <Button
            title={actionLabel}
            onPress={onAction}
            variant="primary"
            size="md"
            fullWidth={false}
          />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  iconInner: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: URBANIST_COLORS.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: URBANIST_COLORS.purple,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  iconGlow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 28,
    backgroundColor: URBANIST_COLORS.purple,
    opacity: 0.08,
    zIndex: -1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: URBANIST_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 15,
    color: URBANIST_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    marginTop: 8,
  },
});

export default EmptyState;

