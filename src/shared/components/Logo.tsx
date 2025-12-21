import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Animated, Easing, ViewStyle, Image} from 'react-native';

// PNG logo for Image component usage - using require for proper bundling
const logoPng = require('../../../assets/logo.png');

type LogoVariant = 'png';

interface LogoProps {
  size?: number;
  style?: ViewStyle;
  variant?: LogoVariant;
  animated?: boolean;
  pulseOnLoad?: boolean;
}

const Logo: React.FC<LogoProps> = ({
  size = 100,
  style,
  variant = 'png',
  animated = false,
  pulseOnLoad = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(pulseOnLoad ? 0.8 : 1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pulseOnLoad) {
      // Initial pulse animation on load
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 300,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (animated) {
      // Continuous rotation animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [animated, pulseOnLoad, scaleAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const animatedStyle = animated
    ? {transform: [{scale: scaleAnim}, {rotate}]}
    : {transform: [{scale: scaleAnim}]};

  return (
    <Animated.View
      style={[styles.container, style, animatedStyle]}>
      <Image
        source={logoPng}
        style={{width: size, height: size, borderRadius: size * 0.22}}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Logo;
