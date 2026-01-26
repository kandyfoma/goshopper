// AppLoader - Unified Loading Component
// Simple, consistent loader used throughout the entire app
import React from 'react';
import {View, Text, StyleSheet, ActivityIndicator, ViewStyle} from 'react-native';
import {Colors, Typography, Spacing} from '../theme/theme';

interface AppLoaderProps {
  /** Loading message to display */
  message?: string;
  /** Size of the spinner */
  size?: 'small' | 'large';
  /** Custom container style */
  style?: ViewStyle;
  /** Whether to center in a flex container (default: false) */
  fullscreen?: boolean;
}

/**
 * AppLoader - Consistent loading indicator for the entire app
 * 
 * Usage:
 * - Inline: <AppLoader message="Loading..." />
 * - Fullscreen: <AppLoader fullscreen message="Loading data..." />
 */
export function AppLoader({
  message,
  size = 'small',
  style,
  fullscreen = false,
}: AppLoaderProps) {
  return (
    <View style={[fullscreen ? styles.fullscreenContainer : styles.inlineContainer, style]}>
      <ActivityIndicator size={size} color={Colors.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  message: {
    marginLeft: Spacing.sm,
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
  },
});

export default AppLoader;
