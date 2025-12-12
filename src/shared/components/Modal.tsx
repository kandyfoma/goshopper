import React, {ReactNode} from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ModalProps as RNModalProps,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {Icon} from '../../shared/components';

export interface ModalProps extends Omit<RNModalProps, 'children'> {
  // Content
  children: ReactNode;

  // Header
  title?: string;
  subtitle?: string;
  showCloseButton?: boolean;
  onClose?: () => void;

  // Layout
  variant?: 'fullscreen' | 'bottom-sheet' | 'centered';
  size?: 'small' | 'medium' | 'large' | 'fullscreen';

  // Styling
  backgroundColor?: string;
  contentStyle?: ViewStyle;
  headerStyle?: ViewStyle;

  // Animation
  animationType?: 'none' | 'slide' | 'fade';
}

/**
 * Urbanist Modal Component
 *
 * A comprehensive modal component that follows the Urbanist design system.
 * Supports multiple variants: fullscreen, bottom-sheet, and centered.
 */
export const Modal: React.FC<ModalProps> = ({
  // Content
  children,

  // Header
  title,
  subtitle,
  showCloseButton = true,
  onClose,

  // Layout
  variant = 'bottom-sheet',
  size = 'medium',

  // Styling
  backgroundColor,
  contentStyle,
  headerStyle,

  // Animation
  animationType = 'slide',

  // Other modal props
  ...modalProps
}) => {
  const insets = useSafeAreaInsets();

  // Determine modal presentation based on variant
  const getModalConfig = () => {
    switch (variant) {
      case 'fullscreen':
        return {
          transparent: false,
          presentationStyle: 'pageSheet' as const,
          animationType: animationType,
        };
      case 'centered':
        return {
          transparent: true,
          presentationStyle: 'overFullScreen' as const,
          animationType: animationType,
        };
      case 'bottom-sheet':
      default:
        return {
          transparent: true,
          presentationStyle: 'overFullScreen' as const,
          animationType: animationType,
        };
    }
  };

  const modalConfig = getModalConfig();

  // Get content container style based on variant and size
  const getContentStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor: backgroundColor || Colors.card.white,
      borderRadius: variant === 'bottom-sheet' ? BorderRadius['2xl'] : BorderRadius.xl,
      ...Shadows.lg,
    };

    switch (variant) {
      case 'fullscreen':
        return {
          ...baseStyle,
          flex: 1,
          borderRadius: 0,
        };
      case 'centered':
        const centeredSize = getCenteredSize();
        return {
          ...baseStyle,
          ...centeredSize,
          marginHorizontal: Spacing.lg,
        };
      case 'bottom-sheet':
      default:
        return {
          ...baseStyle,
          marginTop: 'auto',
          marginBottom: insets.bottom,
          marginHorizontal: Spacing.sm,
          maxHeight: '80%',
        };
    }
  };

  const getCenteredSize = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {maxHeight: '40%', minHeight: 200};
      case 'large':
        return {maxHeight: '80%', minHeight: 400};
      case 'fullscreen':
        return {maxHeight: '90%', minHeight: 500};
      case 'medium':
      default:
        return {maxHeight: '60%', minHeight: 300};
    }
  };

  // Render overlay for transparent modals
  const renderOverlay = () => {
    if (!modalConfig.transparent) return null;

    return (
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
    );
  };

  // Render header
  const renderHeader = () => {
    if (!title && !showCloseButton) return null;

    return (
      <View style={[styles.header, headerStyle]}>
        <View style={styles.headerContent}>
          {title && (
            <View style={styles.titleContainer}>
              <Text style={[styles.title, !subtitle && {marginBottom: 0}]}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          )}
          {showCloseButton && onClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon name="x" size="lg" color={Colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render bottom sheet handle
  const renderHandle = () => {
    if (variant !== 'bottom-sheet') return null;

    return <View style={styles.handle} />;
  };

  const contentContainerStyle = getContentStyle();

  return (
    <RNModal {...modalConfig} {...modalProps}>
      {renderOverlay()}

      <View style={styles.container}>
        <View style={[contentContainerStyle, contentStyle]}>
          {renderHandle()}
          {renderHeader()}
          <View style={styles.body}>
            {children}
          </View>
        </View>
      </View>
    </RNModal>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.normal,
  },
  closeButton: {
    padding: Spacing.xs,
    marginTop: Spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border.medium,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});

export default Modal;