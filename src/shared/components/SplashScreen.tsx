import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {Colors} from '@/shared/theme/theme';

interface SplashScreenProps {
  onAnimationComplete?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({onAnimationComplete}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Callback after animation
    const timer = setTimeout(() => {
      onAnimationComplete?.();
    }, 2000);

    return () => clearTimeout(timer);
  }, [fadeAnim, onAnimationComplete]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />

      <Animated.View style={[styles.content, {opacity: fadeAnim}]}>
        {/* App name */}
        <Text style={styles.appName}>GoShopperAI</Text>
        
        {/* Spinner */}
        <ActivityIndicator 
          size="large" 
          color={Colors.primary} 
          style={styles.spinner}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
});

export default SplashScreen;
