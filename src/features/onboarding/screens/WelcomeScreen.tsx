// Welcome Screen - Premium Onboarding Experience
// Urbanist Design System - Sleek, Professional, Animated
import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {RootStackParamList} from '@/shared/types';
import {Colors, Typography, Spacing, BorderRadius, Shadows} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';

const {width: SLIDE_WIDTH} = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OnboardingSlide {
  id: string;
  iconName: string;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  gradientColors: [string, string];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    iconName: 'sparkles',
    title: 'Bienvenue',
    subtitle: 'sur GoShopperAI',
    description: 'Votre assistant intelligent pour des achats plus malins. Économisez sans effort grâce à l\'IA.',
    accentColor: Colors.card.blue,
    gradientColors: ['#E8EDF5', '#D8DFE9'],
  },
  {
    id: '2',
    iconName: 'scan',
    title: 'Scannez',
    subtitle: 'en un instant',
    description: 'Prenez simplement en photo vos tickets de caisse. Notre technologie fait le reste.',
    accentColor: Colors.card.green,
    gradientColors: ['#E5F0E3', '#CFDECA'],
  },
  {
    id: '3',
    iconName: 'brain',
    title: 'Analysez',
    subtitle: 'avec l\'IA',
    description: 'Notre intelligence artificielle extrait et analyse chaque prix automatiquement.',
    accentColor: Colors.card.yellow,
    gradientColors: ['#F7F8D8', '#EFF0A3'],
  },
  {
    id: '4',
    iconName: 'trending-up',
    title: 'Économisez',
    subtitle: 'au quotidien',
    description: 'Suivez vos dépenses, comparez les prix et découvrez les meilleures offres près de chez vous.',
    accentColor: Colors.card.blue,
    gradientColors: ['#E8EDF5', '#D8DFE9'],
  },
];

// Animated Icon Component with floating effect
const AnimatedIcon: React.FC<{
  name: string;
  color: string;
  isActive: boolean;
}> = ({name, color, isActive}) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      // Scale in
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Floating animation
      const float = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -8,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      float.start();

      // Subtle rotation
      const rotate = Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 0.02,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -0.02,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      rotate.start();

      return () => {
        float.stop();
        rotate.stop();
      };
    } else {
      scaleAnim.setValue(0.8);
    }
  }, [isActive, floatAnim, scaleAnim, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [-0.02, 0.02],
    outputRange: ['-2deg', '2deg'],
  });

  return (
    <Animated.View
      style={[
        styles.iconContainer,
        {
          backgroundColor: color,
          transform: [
            {translateY: floatAnim},
            {scale: scaleAnim},
            {rotate: rotation},
          ],
        },
      ]}>
      <View style={styles.iconInner}>
        <Icon name={name} size="3xl" color={Colors.text.primary} variant="filled" />
      </View>
    </Animated.View>
  );
};

// Single Slide Component
const Slide: React.FC<{
  item: OnboardingSlide;
  index: number;
  scrollX: Animated.Value;
}> = ({item, index, scrollX}) => {
  const inputRange = [(index - 1) * SLIDE_WIDTH, index * SLIDE_WIDTH, (index + 1) * SLIDE_WIDTH];

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [30, 0, 30],
    extrapolate: 'clamp',
  });

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.9, 1, 0.9],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.slide}>
      <LinearGradient
        colors={item.gradientColors}
        style={styles.slideGradient}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <Animated.View
          style={[
            styles.slideContent,
            {
              opacity,
              transform: [{translateY}, {scale}],
            },
          ]}>
          <AnimatedIcon
            name={item.iconName}
            color={item.accentColor}
            isActive={true}
          />

          <View style={styles.textContainer}>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            <Text style={styles.slideDescription}>{item.description}</Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

// Animated Dots Indicator
const DotsIndicator: React.FC<{
  scrollX: Animated.Value;
  slidesCount: number;
}> = ({scrollX, slidesCount}) => {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({length: slidesCount}).map((_, index) => {
        const inputRange = [
          (index - 1) * SLIDE_WIDTH,
          index * SLIDE_WIDTH,
          (index + 1) * SLIDE_WIDTH,
        ];

        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 28, 8],
          extrapolate: 'clamp',
        });

        const dotOpacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.4, 1, 0.4],
          extrapolate: 'clamp',
        });

        const dotColor = scrollX.interpolate({
          inputRange,
          outputRange: [Colors.border.medium, Colors.primary, Colors.border.medium],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                opacity: dotOpacity,
                backgroundColor: dotColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

export function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<Animated.FlatList<OnboardingSlide>>(null);
  
  // Entrance animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const bottomTranslateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(bottomOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(bottomTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [headerOpacity, bottomOpacity, bottomTranslateY]);

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  }, [currentIndex]);

  const handleSkip = useCallback(() => {
    handleGetStarted();
  }, []);

  const handleGetStarted = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{name: 'SignIn'}],
    });
  }, [navigation]);

  const onViewableItemsChanged = useRef(({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.md,
            opacity: headerOpacity,
          },
        ]}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Icon name="cart" size="sm" color={Colors.primary} />
          </View>
          <Text style={styles.logoText}>GoShopperAI</Text>
        </View>
        
        {!isLastSlide && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text style={styles.skipButtonText}>Passer</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={({item, index}) => (
          <Slide item={item} index={index} scrollX={scrollX} />
        )}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {x: scrollX}}}],
          {useNativeDriver: false},
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={SLIDE_WIDTH}
        snapToAlignment="center"
      />

      {/* Bottom Section */}
      <Animated.View
        style={[
          styles.bottomSection,
          {
            paddingBottom: Math.max(insets.bottom, Spacing.xl),
            opacity: bottomOpacity,
            transform: [{translateY: bottomTranslateY}],
          },
        ]}>
        
        {/* Dots */}
        <DotsIndicator scrollX={scrollX} slidesCount={SLIDES.length} />

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleNext}
          activeOpacity={0.9}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            style={styles.ctaGradient}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}>
            <Text style={styles.ctaButtonText}>
              {isLastSlide ? 'Commencer maintenant' : 'Continuer'}
            </Text>
            <View style={styles.ctaIconContainer}>
              <Icon
                name={isLastSlide ? 'arrow-right' : 'chevron-right'}
                size="sm"
                color={Colors.white}
              />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Trial Badge */}
        <View style={styles.trialBadge}>
          <View style={styles.trialIconContainer}>
            <Icon name="gift" size="sm" color={Colors.status.success} />
          </View>
          <View style={styles.trialTextContainer}>
            <Text style={styles.trialTitle}>Essai gratuit de 2 mois</Text>
            <Text style={styles.trialSubtitle}>Aucune carte bancaire requise</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
  },

  // Slides
  slide: {
    width: SLIDE_WIDTH,
    flex: 1,
  },
  slideGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  slideContent: {
    alignItems: 'center',
    maxWidth: 340,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    ...Shadows.lg,
  },
  iconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 0,
  },
  slideSubtitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },
  slideDescription: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: Spacing.md,
  },

  // Bottom Section
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    backgroundColor: Colors.background.primary,
  },
  
  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: BorderRadius.full,
  },

  // CTA Button
  ctaButton: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg + 2,
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.md,
  },
  ctaButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    letterSpacing: -0.3,
  },
  ctaIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Trial Badge
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.successLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
  },
  trialIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialTextContainer: {
    alignItems: 'flex-start',
  },
  trialTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.primary,
  },
  trialSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
});

export default WelcomeScreen;
