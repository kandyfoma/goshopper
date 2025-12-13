/**
 * AppFooter Component
 * Standard footer used across all screens
 * Shows app name, version, and copyright
 */

import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useTheme} from '../contexts';
import {Colors, Typography, Spacing} from '../theme/theme';
import Icon from './Icon';

interface AppFooterProps {
  showLogo?: boolean;
  showVersion?: boolean;
  compact?: boolean;
}

export const AppFooter: React.FC<AppFooterProps> = ({
  showLogo = true,
  showVersion = true,
  compact = false,
}) => {
  const {isDarkMode} = useTheme();
  
  const currentYear = new Date().getFullYear();

  if (compact) {
    return (
      <View style={[styles.footerCompact, isDarkMode && styles.footerDark]}>
        <Text style={[styles.copyrightTextCompact, isDarkMode && styles.textDark]}>
          © {currentYear} GoShopperAI
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.footer, isDarkMode && styles.footerDark]}>
      {showLogo && (
        <View style={styles.logoContainer}>
          <View style={[styles.logoIcon, isDarkMode && styles.logoIconDark]}>
            <Icon 
              name="shopping-cart" 
              size="sm" 
              color={isDarkMode ? Colors.text.inverse : Colors.primary} 
            />
          </View>
          <Text style={[styles.appName, isDarkMode && styles.textDark]}>
            GoShopperAI
          </Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        {showVersion && (
          <Text style={[styles.versionText, isDarkMode && styles.textSecondaryDark]}>
            Version 1.0.0
          </Text>
        )}
        <Text style={[styles.copyrightText, isDarkMode && styles.textSecondaryDark]}>
          © {currentYear} GoShopperAI. Tous droits réservés.
        </Text>
        <Text style={[styles.taglineText, isDarkMode && styles.textSecondaryDark]}>
          Scannez vos reçus, économisez plus
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  footerDark: {
    backgroundColor: Colors.background.secondary,
    borderTopColor: Colors.border.dark,
  },
  footerCompact: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.card.red,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  logoIconDark: {
    backgroundColor: Colors.card.crimson,
  },
  appName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  infoContainer: {
    alignItems: 'center',
  },
  versionText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
  },
  copyrightText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  copyrightTextCompact: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  taglineText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  textDark: {
    color: Colors.text.inverse,
  },
  textSecondaryDark: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
