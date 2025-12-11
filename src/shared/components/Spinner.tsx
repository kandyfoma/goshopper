// Modern Spinner Component
import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing} from 'react-native';
import {Colors} from '../theme/theme';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: any;
}

export function Spinner({
  size = 'medium',
  color = Colors.primary[500],
  style,
}: SpinnerProps) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    };

    animate();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getSize = () => {
    switch (size) {
      case 'small':
        return 20;
      case 'large':
        return 48;
      default:
        return 32;
    }
  };

  const spinnerSize = getSize();

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.spinner,
          {
            width: spinnerSize,
            height: spinnerSize,
            borderColor: color,
            transform: [{rotate}],
          },
        ]}
      />
    </View>
  );
}

// Loading Overlay
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  spinnerSize?: 'small' | 'medium' | 'large';
  backgroundColor?: string;
  spinnerColor?: string;
}

export function LoadingOverlay({
  visible,
  message,
  spinnerSize = 'large',
  backgroundColor = 'rgba(0, 0, 0, 0.5)',
  spinnerColor = Colors.primary[500],
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={[styles.overlay, {backgroundColor}]}>
      <View style={styles.overlayContent}>
        <Spinner size={spinnerSize} color={spinnerColor} />
        {message && <Text style={styles.overlayMessage}>{message}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    borderWidth: 3,
    borderRadius: 50,
    borderTopColor: 'transparent',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  overlayMessage: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});