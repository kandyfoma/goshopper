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
    return ['#FDF0D5', '#F5E6C3']; // Cream (processing)
  };
  
  const getIcon = () => {
    if (isSuccess) return 'check-circle';
    if (isFailed) return 'alert-circle';
    return 'credit-card';
  };
  
  const getIconColor = () => {
    if (isSuccess || isFailed) return Colors.white;
    return '#003049'; // Dark blue for contrast
  };
  
  const getTitle = () => {
    if (isSuccess) return 'Paiement réussi!';
    if (isFailed) return 'Paiement échoué';
    return 'Paiement en attente';
  };
  
  const getTitleColor = () => {
    if (isSuccess || isFailed) return Colors.white;
    return '#003049'; // Dark blue
  };
  
  const getMessageColor = () => {
    if (isSuccess || isFailed) return 'rgba(255, 255, 255, 0.85)';
    return '#669BBC'; // Cosmos blue
  };
  
  const getMessage = () => {
    if (state.message) return state.message;
    if (isSuccess) return `Abonnement ${state.planName} activé`;
    if (isFailed) return 'Veuillez réessayer';
    return `${state.planName} - $${state.amount}`;
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
                backgroundColor: isSuccess || isFailed 
                  ? 'rgba(255, 255, 255, 0.2)' 
                  : 'rgba(0, 48, 73, 0.1)',
              }
            ]}>
            <Icon name={getIcon()} size="sm" color={getIconColor()} />
          </Animated.View>
          
          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, {color: getTitleColor()}]}>
              {getTitle()}
            </Text>
            <Text style={[styles.message, {color: getMessageColor()}]} numberOfLines={2}>
              {getMessage()}
            </Text>
          </View>
          
          {/* Dismiss button or phone number indicator */}
          {isPending ? (
            <View style={[styles.phoneBadge, {backgroundColor: 'rgba(0, 48, 73, 0.1)'}]}>
              <Icon name="phone" size="xs" color="#003049" />
              <Text style={styles.phoneText}>{state.phoneNumber?.slice(-4)}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.dismissButton} onPress={dismiss}>
              <Icon name="x" size="sm" color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Progress bar (only show when pending) */}
        {isPending && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarBg, {backgroundColor: 'rgba(102, 155, 188, 0.2)'}]} />
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    zIndex: 9999,
    ...Shadows.lg,
  },
  gradientBackground: {
    paddingVertical: Spacing.sm,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  message: {
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  phoneText: {
    fontSize: Typography.fontSize.xs,
    color: '#003049',
    fontWeight: Typography.fontWeight.semiBold,
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.sm,
    height: 4,
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
