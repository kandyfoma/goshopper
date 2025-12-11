/**
 * MainLayout Component
 * 
 * A flexible layout wrapper for screens with header and footer
 * Supports safe areas for different phone dimensions (notches, home indicators)
 * Fits the Urbanist pastel design aesthetic
 */

import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Layout } from '../theme/theme';
import Icon from './Icon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// TYPES
// ============================================
interface HeaderAction {
  icon: string;
  onPress: () => void;
  badge?: number;
  accessibilityLabel?: string;
}

interface MainLayoutProps {
  // Header props
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
  headerLeftElement?: ReactNode;
  headerRightElement?: ReactNode;
  headerActions?: HeaderAction[];
  headerTransparent?: boolean;
  headerDark?: boolean;
  
  // Footer props
  showFooter?: boolean;
  footerElement?: ReactNode;
  
  // Content props
  children: ReactNode;
  scrollable?: boolean;
  scrollRef?: React.RefObject<ScrollView>;
  onScroll?: (event: any) => void;
  refreshControl?: React.ReactElement;
  
  // Background
  backgroundColor?: string;
  
  // Keyboard behavior
  keyboardAvoiding?: boolean;
  
  // Style overrides
  contentStyle?: ViewStyle;
  headerStyle?: ViewStyle;
  footerStyle?: ViewStyle;
  
  // Safe area edges to respect
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  
  // Status bar
  statusBarStyle?: 'light-content' | 'dark-content';
}

// ============================================
// HEADER COMPONENT
// ============================================
const LayoutHeader: React.FC<{
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
  actions?: HeaderAction[];
  transparent?: boolean;
  dark?: boolean;
  style?: ViewStyle;
  insetTop: number;
}> = ({
  title,
  subtitle,
  showBackButton,
  onBackPress,
  leftElement,
  rightElement,
  actions,
  transparent = false,
  dark = false,
  style,
  insetTop,
}) => {
  const navigation = useNavigation();
  
  const textColor = dark ? Colors.white : Colors.text.primary;
  const iconColor = dark ? Colors.white : Colors.text.primary;
  const subtitleColor = dark ? Colors.text.tertiary : Colors.text.secondary;

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insetTop + Spacing.sm,
          backgroundColor: transparent ? 'transparent' : Colors.background.primary,
        },
        !transparent && styles.headerShadow,
        style,
      ]}
    >
      <View style={styles.headerContent}>
        {/* Left Section */}
        <View style={styles.headerLeftSection}>
          {leftElement}
          {!leftElement && showBackButton && (
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.headerIconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <View style={[styles.headerIconWrapper, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : Colors.background.secondary }]}>
                <Icon name="chevronLeft" size="sm" color={iconColor} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Center Section - Title */}
        <View style={styles.headerCenterSection}>
          {title && (
            <Text
              style={[styles.headerTitle, { color: textColor }]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={[styles.headerSubtitle, { color: subtitleColor }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Section */}
        <View style={styles.headerRightSection}>
          {rightElement}
          {!rightElement && actions && actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={action.onPress}
              style={[styles.headerIconButton, index > 0 && { marginLeft: Spacing.xs }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={action.accessibilityLabel || action.icon}
              accessibilityRole="button"
            >
              <View style={[styles.headerIconWrapper, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : Colors.background.secondary }]}>
                <Icon name={action.icon} size="sm" color={iconColor} />
                {action.badge !== undefined && action.badge > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>
                      {action.badge > 99 ? '99+' : action.badge}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

// ============================================
// FOOTER COMPONENT
// ============================================
const LayoutFooter: React.FC<{
  children?: ReactNode;
  style?: ViewStyle;
  insetBottom: number;
}> = ({ children, style, insetBottom }) => {
  if (!children) return null;

  return (
    <View
      style={[
        styles.footer,
        { paddingBottom: Math.max(insetBottom, Spacing.base) },
        style,
      ]}
    >
      {children}
    </View>
  );
};

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================
export const MainLayout: React.FC<MainLayoutProps> = ({
  // Header
  title,
  subtitle,
  showHeader = true,
  showBackButton = false,
  onBackPress,
  headerLeftElement,
  headerRightElement,
  headerActions,
  headerTransparent = false,
  headerDark = false,
  
  // Footer
  showFooter = false,
  footerElement,
  
  // Content
  children,
  scrollable = true,
  scrollRef,
  onScroll,
  refreshControl,
  
  // Background
  backgroundColor = Colors.background.secondary,
  
  // Keyboard
  keyboardAvoiding = true,
  
  // Styles
  contentStyle,
  headerStyle,
  footerStyle,
  
  // Safe area
  edges = ['top', 'bottom'],
  
  // Status bar
  statusBarStyle,
}) => {
  const insets = useSafeAreaInsets();
  
  // Determine status bar style
  const resolvedStatusBarStyle = statusBarStyle || (headerDark ? 'light-content' : 'dark-content');
  
  // Calculate safe area padding
  const topInset = edges.includes('top') ? insets.top : 0;
  const bottomInset = edges.includes('bottom') ? insets.bottom : 0;

  // Content wrapper - handles scrolling
  const ContentWrapper = scrollable ? ScrollView : View;
  const contentWrapperProps = scrollable
    ? {
        ref: scrollRef,
        onScroll,
        scrollEventThrottle: 16,
        showsVerticalScrollIndicator: false,
        contentContainerStyle: [
          styles.scrollContent,
          { paddingBottom: showFooter ? Spacing.lg : Math.max(bottomInset, Spacing.lg) },
          contentStyle,
        ],
        keyboardShouldPersistTaps: 'handled' as const,
        refreshControl,
      }
    : {
        style: [styles.content, contentStyle],
      };

  // Main content
  const MainContent = (
    <>
      <StatusBar
        barStyle={resolvedStatusBarStyle}
        backgroundColor="transparent"
        translucent
      />
      
      {/* Header */}
      {showHeader && (
        <LayoutHeader
          title={title}
          subtitle={subtitle}
          showBackButton={showBackButton}
          onBackPress={onBackPress}
          leftElement={headerLeftElement}
          rightElement={headerRightElement}
          actions={headerActions}
          transparent={headerTransparent}
          dark={headerDark}
          style={headerStyle}
          insetTop={topInset}
        />
      )}
      
      {/* Main Content */}
      <ContentWrapper {...contentWrapperProps}>
        {children}
      </ContentWrapper>
      
      {/* Footer */}
      {showFooter && (
        <LayoutFooter style={footerStyle} insetBottom={bottomInset}>
          {footerElement}
        </LayoutFooter>
      )}
    </>
  );

  // Wrap with keyboard avoiding view if needed
  if (keyboardAvoiding && Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor }]}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {MainContent}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {MainContent}
    </View>
  );
};

// ============================================
// PRESET LAYOUTS
// ============================================

// Screen with standard header
export const ScreenLayout: React.FC<Omit<MainLayoutProps, 'showHeader'> & { showHeader?: boolean }> = (props) => (
  <MainLayout showHeader={true} {...props} />
);

// Screen with back button
export const DetailLayout: React.FC<Omit<MainLayoutProps, 'showHeader' | 'showBackButton'>> = (props) => (
  <MainLayout showHeader={true} showBackButton={true} {...props} />
);

// Full screen (no header)
export const FullScreenLayout: React.FC<Omit<MainLayoutProps, 'showHeader'>> = (props) => (
  <MainLayout showHeader={false} edges={['bottom']} {...props} />
);

// Modal screen
export const ModalLayout: React.FC<Omit<MainLayoutProps, 'showHeader' | 'showBackButton'> & { onClose?: () => void }> = ({
  onClose,
  headerActions,
  ...props
}) => (
  <MainLayout
    showHeader={true}
    showBackButton={false}
    headerActions={onClose ? [{ icon: 'close', onPress: onClose, accessibilityLabel: 'Close' }, ...(headerActions || [])] : headerActions}
    backgroundColor={Colors.background.primary}
    {...props}
  />
);

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header styles
  header: {
    width: '100%',
    zIndex: 100,
  },
  headerShadow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: Layout.header.height,
    paddingHorizontal: Spacing.base,
  },
  headerLeftSection: {
    flex: 1,
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  headerCenterSection: {
    flex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightSection: {
    flex: 1,
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  headerIconButton: {
    padding: Spacing.xs,
  },
  headerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    letterSpacing: Typography.letterSpacing.tight,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.status.error,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: Typography.fontWeight.bold,
  },
  
  // Content styles
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
  },
  
  // Footer styles
  footer: {
    width: '100%',
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    ...Shadows.sm,
  },
});

// ============================================
// UTILITY COMPONENTS
// ============================================

// Footer with primary action button
export const FooterWithAction: React.FC<{
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
}> = ({
  primaryLabel,
  onPrimaryPress,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondaryPress,
}) => (
  <View style={footerStyles.actionContainer}>
    {secondaryLabel && onSecondaryPress && (
      <TouchableOpacity
        style={footerStyles.secondaryButton}
        onPress={onSecondaryPress}
        activeOpacity={0.7}
      >
        <Text style={footerStyles.secondaryButtonText}>{secondaryLabel}</Text>
      </TouchableOpacity>
    )}
    <TouchableOpacity
      style={[
        footerStyles.primaryButton,
        primaryDisabled && footerStyles.primaryButtonDisabled,
        !secondaryLabel && { flex: 1 },
      ]}
      onPress={onPrimaryPress}
      disabled={primaryDisabled || primaryLoading}
      activeOpacity={0.8}
    >
      {primaryLoading ? (
        <View style={footerStyles.loadingIndicator} />
      ) : (
        <Text style={[
          footerStyles.primaryButtonText,
          primaryDisabled && footerStyles.primaryButtonTextDisabled,
        ]}>
          {primaryLabel}
        </Text>
      )}
    </TouchableOpacity>
  </View>
);

const footerStyles = StyleSheet.create({
  actionContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  primaryButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    height: Layout.buttonHeight.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.text.tertiary,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  primaryButtonTextDisabled: {
    color: Colors.text.inverse,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    height: Layout.buttonHeight.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  loadingIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.white,
    borderTopColor: 'transparent',
  },
});

export default MainLayout;
