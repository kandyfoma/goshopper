import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Modal} from './Modal';
import Button from './Button';
import Icon from './Icon';
import {Colors, Typography, Spacing} from '@/shared/theme/theme';

export interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;

  // Content
  title: string;
  message?: string;
  icon?: string;
  iconColor?: string;

  // Actions
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;

  // Styling
  variant?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
}

/**
 * Confirmation Modal Component
 *
 * A specialized modal for confirmation dialogs with consistent styling
 * and behavior across the app.
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  onClose,
  title,
  message,
  icon,
  iconColor,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
  variant = 'info',
  loading = false,
}) => {
  // Get variant-specific styling
  const getVariantConfig = () => {
    switch (variant) {
      case 'danger':
        return {
          iconName: icon || 'alert-triangle',
          iconColor: iconColor || Colors.status.error,
        };
      case 'warning':
        return {
          iconName: icon || 'alert-circle',
          iconColor: iconColor || Colors.status.warning,
        };
      case 'success':
        return {
          iconName: icon || 'check-circle',
          iconColor: iconColor || Colors.status.success,
        };
      case 'info':
      default:
        return {
          iconName: icon || 'info',
          iconColor: iconColor || Colors.primary,
        };
    }
  };

  const variantConfig = getVariantConfig();

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    // Note: onClose is called by parent after confirmation if needed
  };

  return (
    <Modal
      visible={visible}
      variant="centered"
      size="small"
      onClose={handleCancel}
      animationType="fade">
      <View style={styles.content}>
        {variantConfig.iconName && (
          <View style={styles.iconContainer}>
            <Icon
              name={variantConfig.iconName}
              size="3xl"
              color={variantConfig.iconColor}
            />
          </View>
        )}

        <Text style={styles.title}>{title}</Text>

        {message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.actions}>
          <Button
            title={cancelText}
            variant="secondary"
            onPress={handleCancel}
            style={styles.cancelButton}
          />
          <Button
            title={confirmText}
            variant="primary"
            onPress={handleConfirm}
            loading={loading}
            style={styles.confirmButton}
          />
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.normal,
    marginBottom: Spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
});

export default ConfirmationModal;