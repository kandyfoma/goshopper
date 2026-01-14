// Animated Modal Wrapper - Reusable modal with blur overlay and animations
import React, {useEffect, useRef, ReactNode} from 'react';
import {
  View,
  StyleSheet,
  Modal as RNModal,
  TouchableOpacity,
  Platform,
  Animated,
  Dimensions,
  ModalProps as RNModalProps,
  Keyboard,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {Colors, BorderRadius, Shadows, Spacing} from '@/shared/theme/theme';

interface AnimatedModalProps extends Omit<RNModalProps, 'children'> {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: 'bottom-sheet' | 'centered';
  overlayOpacity?: number;
  disableBackdropPress?: boolean;
}

/**
 * Animated Modal Component
 * 
 * A reusable modal with:
 * - Blur effect overlay (iOS) or semi-transparent overlay (Android)
 * - Smooth slide-up animation with spring effect
 * - Scale animation for subtle bounce
 * - Fade in/out transitions
 * - Bottom sheet or centered variants
 * - White card with rounded corners (matches payment modal design)
 */
export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  visible,
  onClose,
  children,
  variant = 'bottom-sheet',
  overlayOpacity = 0.25,
  disableBackdropPress = false,
  ...modalProps
}) => {
  const screenHeight = Dimensions.get('window').height;
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(variant === 'bottom-sheet' ? screenHeight : 50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const keyboardShift = useRef(new Animated.Value(0)).current;

  // Animate entrance
  useEffect(() => {
    console.log('🔐 [AnimatedModal] Visibility changed:', visible);
    if (visible) {
      // Reset values before animating in
      slideAnim.setValue(variant === 'bottom-sheet' ? screenHeight : 50);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      keyboardShift.setValue(0);
      
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
      ]).start();
    }
  }, [visible]);

  // Keyboard handling: shift modal up when keyboard is visible
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (e: any) => {
      const keyboardHeight = e?.endCoordinates?.height || 0;
      Animated.timing(keyboardShift, {
        toValue: -keyboardHeight,
        duration: 250,
        useNativeDriver: true,
      }).start();
    };

    const onKeyboardHide = () => {
      Animated.timing(keyboardShift, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardShift]);

  const handleClose = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: variant === 'bottom-sheet' ? screenHeight : 50,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleBackdropPress = () => {
    if (!disableBackdropPress) {
      handleClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
      {...modalProps}>
      <View style={styles.overlay}>
        {/* Blur overlay for iOS, semi-transparent for Android */}
        {Platform.OS === 'ios' ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="light"
              blurAmount={25}
            />
          </Animated.View>
        ) : (
          <Animated.View 
            style={[
              styles.androidOverlay, 
              { 
                opacity: fadeAnim,
                backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
              }
            ]} 
          />
        )}

        {/* Touchable backdrop */}
        <View style={[
          styles.overlayContent,
          variant === 'centered' && styles.overlayContentCentered
        ]}>
          <TouchableOpacity 
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />

          {/* Animated content with card styling */}
          <Animated.View
            style={[
              variant === 'bottom-sheet' ? styles.bottomSheetContent : styles.centeredContent,
              {
                    transform: [
                      { translateY: Animated.add(slideAnim, keyboardShift) },
                      { scale: scaleAnim },
                    ],
                    opacity: fadeAnim,
                  },
            ]}>
            {/* Drag handle for bottom sheet */}
            {variant === 'bottom-sheet' && (
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>
            )}
            {children}
          </Animated.View>
          
          {/* Extra touchable area below for centered modals */}
          {variant === 'centered' && (
            <TouchableOpacity 
              style={styles.overlayTouchable}
              activeOpacity={1}
              onPress={handleBackdropPress}
            />
          )}
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayContentCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  overlayTouchable: {
    flex: 1,
  },
  bottomSheetContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    ...Shadows.lg,
    paddingBottom: 34, // Safe area padding
    maxHeight: '85%',
    overflow: 'hidden',
  },
  centeredContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    ...Shadows.lg,
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xl,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border.medium,
    borderRadius: BorderRadius.full,
  },
});
