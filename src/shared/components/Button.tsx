/**
 * Button Component
 *
 * A versatile, animated button component with multiple variants
 */

import React, {useRef} from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import {
  Colors,
  Typography,
  BorderRadius,
  Spacing,
  Shadows,
  Layout,
  Animations,
} from '../theme/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = true,
  style,
  textStyle,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      ...Animations.spring.stiff,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...Animations.spring.gentle,
      useNativeDriver: true,
    }).start();
  };

  const getButtonStyles = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      height: Layout.buttonHeight[size],
      borderRadius: BorderRadius.base,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    switch (variant) {
      case 'primary':
        // Dark blue filled button for submit/primary actions
        return {
          ...baseStyle,
          backgroundColor: disabled ? Colors.border.medium : Colors.accent, // Cosmos Blue #003049
          ...Shadows.md,
        };
      case 'danger':
        // Red filled button for cancel/destructive actions
        return {
          ...baseStyle,
          backgroundColor: disabled ? Colors.border.medium : Colors.primary, // Crimson Red #C1121F
          ...Shadows.md,
        };
      case 'outline':
        // Unfilled with yellow border for other features
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: disabled ? Colors.border.medium : Colors.card.yellow, // Warm beige #F5E6C3
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: Colors.white,
          borderWidth: 1.5,
          borderColor: disabled ? Colors.border.medium : Colors.primary,
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyles = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: Typography.fontWeight.semiBold,
      fontSize:
        size === 'sm' ? Typography.fontSize.md : Typography.fontSize.base,
    };

    switch (variant) {
      case 'primary':
      case 'danger':
        // White text for filled buttons
        return {...baseStyle, color: Colors.white};
      case 'outline':
        // Dark text for outline button
        return {
          ...baseStyle,
          color: disabled ? Colors.text.tertiary : Colors.text.primary,
        };
      case 'secondary':
        return {
          ...baseStyle,
          color: disabled ? Colors.text.tertiary : Colors.primary,
        };
      case 'ghost':
        return {
          ...baseStyle,
          color: disabled ? Colors.text.tertiary : Colors.primary,
        };
      default:
        return baseStyle;
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={
            variant === 'primary' || variant === 'danger'
              ? Colors.white
              : Colors.text.primary
          }
        />
      );
    }

    return (
      <>
        {icon && iconPosition === 'left' && (
          <View style={styles.iconLeft}>{icon}</View>
        )}
        <Text style={[getTextStyles(), textStyle]}>{title}</Text>
        {icon && iconPosition === 'right' && (
          <View style={styles.iconRight}>{icon}</View>
        )}
      </>
    );
  };

  return (
    <Animated.View style={[{transform: [{scale: scaleAnim}]}, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        style={getButtonStyles()}>
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  iconLeft: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginLeft: Spacing.sm,
  },
});

export default Button;
