import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Animated, Easing, ViewStyle, Image} from 'react-native';
import {SvgXml} from 'react-native-svg';
import {
  logoIconSvg,
  logoIconWhiteSvg,
  logoGochujangLightSvg,
  logoGochujangCosmosSvg,
} from '../../../assets/logo-icon';

// PNG logo for Image component usage
const logoPng = require('../../../assets/logo.png');

type LogoVariant =
  | 'default'
  | 'white'
  | 'light'
  | 'cosmos'
  | 'png';

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
  variant = 'default',
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
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (animated) {
      // Subtle continuous animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [animated, pulseOnLoad, scaleAnim]);

  const getLogoSvg = () => {
    switch (variant) {
      case 'white':
        return logoIconWhiteSvg;
      case 'light':
        return logoGochujangLightSvg;
      case 'cosmos':
        return logoGochujangCosmosSvg;
      case 'png':
        return null; // Use Image component instead
      default:
        return logoIconSvg;
    }
  };

  const dimensions = {width: size, height: size};

  // For PNG variant, use Image component
  if (variant === 'png') {
    return (
      <Animated.View
        style={[styles.container, style, {transform: [{scale: scaleAnim}]}]}>
        <Image
          source={logoPng}
          style={{width: size, height: size, borderRadius: size * 0.22}}
          resizeMode="contain"
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.container, style, {transform: [{scale: scaleAnim}]}]}>
      <SvgXml
        xml={getLogoSvg()}
        width={dimensions.width}
        height={dimensions.height}
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
