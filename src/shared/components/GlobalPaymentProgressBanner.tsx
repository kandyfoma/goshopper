// Global Payment Progress Banner - Shows payment progress across the app
// Like Facebook/Instagram upload progress indicator
import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from './Icon';
import {Colors, Typography, Spacing, Shadows} from '@/shared/theme/theme';
import {usePaymentProcessing} from '@/shared/contexts/PaymentProcessingContext';
import {formatCurrency} from '@/shared/utils/helpers';

const {width} = Dimensions.get('window');

export function GlobalPaymentProgressBanner() {
  const insets = useSafeAreaInsets();
  const {state, isVisible, isPending, dismiss} = usePaymentProcessing();
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  const isSuccess = state.status === 'success';
  const isFailed = state.status === 'failed';
  
  // Show/hide animation
  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
      
      // Start pulse animation for the icon when processing
      if (isPending) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.3,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
        
        // Shimmer effect 
        Animated.loop(
          Animated.sequence([
            Animated.timing(shimmerAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(shimmerAnim, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else {
        pulseAnim.setValue(1);
        shimmerAnim.setValue(0);
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      pulseAnim.stopAnimation();
      shimmerAnim.stopAnimation();
    }
  }, [isVisible, isPending, slideAnim, pulseAnim, shimmerAnim]);
  
  if (!isVisible) {
    return null;
  }
  
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, width],
  });
  
  // Different colors based on status
  const getGradientColors = () => {
    if (isSuccess) return ['#28A745', '#218838']; // Green
    if (isFailed) return ['#DC3545', '#C82333']; // Red
    return ['#669BBC', '#5A8BA8']; // Light blue (processing)
  };
  
  const getIcon = () => {
    if (isSuccess) return 'check-circle';
    if (isFailed) return 'alert-circle';
    return 'credit-card';
  };
  
  const getIconColor = () => {
    return Colors.white; // Always white for all states
  };
  
  const getTitle = () => {
    if (isSuccess) return 'Paiement réussi';
    if (isFailed) return 'Paiement échoué';
    return 'Paiement en cours';
  };
  
  const getTitleColor = () => {
    return Colors.white; // Always white
  };
  
  const getMessageColor = () => {
    return 'rgba(255, 255, 255, 0.9)'; // White with slight transparency
  };
  
  const getMessage = () => {
    if (state.message) return state.message;
    if (isSuccess) return `Abonnement ${state.planName} activé`;
    if (isFailed) return 'Veuillez réessayer';
    return `${state.planName} - ${formatCurrency(state.amount, state.currency)}`;
  };
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{translateY: slideAnim}],
          paddingTop: insets.top + Spacing.xs,
        },
      ]}>
      <LinearGradient
        colors={getGradientColors()}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.gradientBackground}>
        <View style={styles.content}>
          {/* Animated Icon */}
          <Animated.View 
            style={[
              styles.iconContainer, 
              {
                transform: [{scale: pulseAnim}],
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              }
            ]}>
            <Icon name={getIcon()} size="xs" color={getIconColor()} />
          </Animated.View>
          
          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, {color: getTitleColor()}]}>
              {getTitle()}
            </Text>
            <Text style={[styles.message, {color: getMessageColor()}]} numberOfLines={1}>
              {getMessage()}
            </Text>
          </View>
          
          {/* Dismiss button or phone number indicator */}
          {isPending ? (
            <View style={[styles.phoneBadge, {backgroundColor: 'rgba(255, 255, 255, 0.2)'}]}>
              <Text style={styles.phoneText}>{state.phoneNumber?.slice(-4)}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.dismissButton} onPress={dismiss}>
              <Icon name="x" size="xs" color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Progress bar (only show when pending) */}
        {isPending && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarBg, {backgroundColor: 'rgba(255, 255, 255, 0.3)'}]} />
            <View style={styles.progressBarIndeterminate}>
              <Animated.View
                style={[
                  styles.shimmerBar,
                  {
                    transform: [{translateX: shimmerTranslate}],
                  },
                ]}
              />
            </View>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.sm,
    zIndex: 9999,
    ...Shadows.md,
  },
  gradientBackground: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
  },
  message: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
  },
  phoneBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 100,
  },
  phoneText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    marginTop: Spacing.xs,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 2,
  },
  progressBarIndeterminate: {
    height: '100%',
    overflow: 'hidden',
  },
  shimmerBar: {
    width: 100,
    height: '100%',
    backgroundColor: '#003049',
    borderRadius: 2,
  },
});
