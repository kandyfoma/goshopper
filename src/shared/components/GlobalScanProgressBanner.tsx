// Global Scan Progress Banner - Shows scan progress across the app
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
import {Icon} from '@/shared/components';
import {Colors, Typography, Spacing, Shadows} from '@/shared/theme/theme';
import {useScanProcessing} from '@/shared/contexts/ScanProcessingContext';

const {width} = Dimensions.get('window');

export function GlobalScanProgressBanner() {
  const insets = useSafeAreaInsets();
  const {state, isProcessing, dismiss} = useScanProcessing();
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  const isError = state.status === 'error';
  const isVisible = isProcessing || isError;
  
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
      if (isProcessing) {
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
        
        // Shimmer effect for progress bar
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
  }, [isVisible, isProcessing, slideAnim, pulseAnim, shimmerAnim]);
  
  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: state.progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [state.progress, progressAnim]);
  
  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (isError) {
      const timer = setTimeout(() => {
        dismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isError, dismiss]);
  
  if (!isVisible) {
    return null;
  }
  
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });
  
  // Light blue gradient for processing, red for error
  const gradientColors = isError 
    ? ['#DC3545', '#C82333'] 
    : ['#669BBC', '#5A8BA8']; // Light blue
  
  const iconName = isError ? 'alert-circle' : 'camera';
  const iconColor = Colors.white;
  const title = isError ? 'Erreur d\'analyse' : 'Analyse en cours';
  const titleColor = Colors.white;
  const messageColor = 'rgba(255, 255, 255, 0.9)';
  
  // Dynamic message based on progress
  const getProgressMessage = () => {
    if (isError) return state.message || 'Veuillez réessayer';
    
    const progress = state.progress;
    if (progress <= 20) return 'Préparation...';
    if (progress <= 40) return 'Compression...';
    if (progress <= 60) return 'Extraction...';
    if (progress <= 80) return 'Vérification...';
    if (progress <= 95) return 'Finalisation...';
    return 'Presque terminé';
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
        colors={gradientColors}
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
            <Icon name={iconName} size="xs" color={iconColor} />
          </Animated.View>
          
          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={[styles.title, {color: titleColor}]}>
              {title}
            </Text>
            <Text style={[styles.message, {color: messageColor}]} numberOfLines={1}>
              {getProgressMessage()}
            </Text>
          </View>
          
          {/* Progress percentage or dismiss button */}
          {isError ? (
            <TouchableOpacity style={styles.dismissButton} onPress={dismiss}>
              <Icon name="x" size="xs" color={Colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.progressBadge, {backgroundColor: 'rgba(255, 255, 255, 0.2)'}]}>
              <Text style={[styles.progressText, {color: Colors.white}]}>{Math.round(state.progress)}%</Text>
            </View>
          )}
        </View>
        
        {/* Progress bar (only show when processing) */}
        {isProcessing && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarBg, {backgroundColor: 'rgba(255, 255, 255, 0.3)'}]} />
            <Animated.View 
              style={[styles.progressBar, {width: progressWidth, backgroundColor: '#003049'}]} 
            />
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
  progressBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 100,
  },
  progressText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
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
    height: 3,
    borderRadius: 2,
    marginTop: Spacing.xs,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
});
