// Welcome Screen - Simple Onboarding
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootStackParamList} from '@/shared/types';
import {Colors, Typography, Spacing} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OnboardingSlide {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'sparkles',
    title: 'Bienvenue sur GoShopperAI',
    description: 'Votre assistant intelligent pour des achats plus malins.',
  },
  {
    id: '2',
    icon: 'camera',
    title: 'Scannez vos reçus',
    description: 'Prenez simplement en photo vos tickets de caisse.',
  },
  {
    id: '3',
    icon: 'trending-up',
    title: 'Économisez plus',
    description: 'Suivez vos dépenses et comparez les prix facilement.',
  },
];

export function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem('@goshopperai_onboarding_complete', 'true');
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
    navigation.reset({
      index: 0,
      routes: [{name: 'SignIn'}],
    });
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background.primary} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>GoShopperAI</Text>
        <Pressable
          onPress={handleSkip}
          style={styles.skipButton}
          android_ripple={{color: Colors.border.light}}
        >
          <Text style={styles.skipText}>Passer</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
            setCurrentIndex(index);
          }
        }}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            <View style={styles.iconContainer}>
              <Icon name={slide.icon} size="xl" color={Colors.primary} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Main Button */}
        <Pressable
          onPress={handleGetStarted}
          style={({pressed}) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          android_ripple={{color: '#059669'}}
        >
          <Text style={styles.buttonText}>
            {isLastSlide ? 'Commencer' : 'Suivant'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  appName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold as any,
    color: Colors.primary,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
  },
  skipText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium as any,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  slide: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold as any,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border.medium,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{scale: 0.98}],
  },
  buttonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold as any,
    color: Colors.white,
  },
});

export default WelcomeScreen;
