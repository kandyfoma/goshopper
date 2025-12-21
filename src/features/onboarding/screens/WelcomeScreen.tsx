// Welcome Screen - Simple Onboarding Experience
import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  FlatList,
  PanResponder,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import {BlurView} from '@react-native-community/blur';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import {RootStackParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {hapticService} from '@/shared/services';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OnboardingSlide {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  gradientColors: string[];
  iconName: string;
  lottieSource: any;
  accentColor: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'sparkles',
    title: 'Bienvenue sur Goshopper',
    subtitle: 'Assistant IA',
    description:
      "Votre assistant intelligent pour des achats plus malins.",
    gradientColors: [Colors.primary, Colors.primaryDark],
    iconName: 'sparkles',
    accentColor: Colors.primary,
  },
  {
    id: '2',
    icon: 'camera',
    title: 'Scannez vos reçus',
    subtitle: 'Scan intelligent',
    description:
      'Prenez simplement en photo vos tickets de caisse.',
    gradientColors: [Colors.secondary, Colors.secondaryDark],
    iconName: 'camera',
    accentColor: Colors.secondary,
  },
  {
    id: '3',
    icon: 'trending-up',
    title: 'Économisez plus',
    subtitle: 'Économies garanties',
    description:
      'Suivez vos dépenses et comparez les prix facilement.',
    gradientColors: [Colors.status.success, Colors.status.successLight],
    iconName: 'trending-up',
    accentColor: Colors.status.success,
  },
];

// Animated Counter Component
const AnimatedCounter: React.FC<{targetValue: number; isActive: boolean}> = ({
  targetValue,
  isActive,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setDisplayValue(0);
      return;
    }

    let currentValue = 0;
    const increment = targetValue / 30; // 30 frames
    const timer = setInterval(() => {
      currentValue += increment;
      if (currentValue >= targetValue) {
        setDisplayValue(targetValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(currentValue));
      }
    }, 50);

    return () => clearInterval(timer);
  }, [isActive, targetValue]);

  return (
    <Text style={styles.counterText}>
      {displayValue}
    </Text>
  );
};

// Parallax Background Component
const ParallaxBackground: React.FC<{scrollX: Animated.Value; index: number}> = ({
  scrollX,
  index,
}) => {
  const inputRange = [
    (index - 1) * SLIDE_WIDTH,
    index * SLIDE_WIDTH,
    (index + 1) * SLIDE_WIDTH,
  ];

  const translateX = scrollX.interpolate({
    inputRange,
    outputRange: [-50, 0, 50],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.parallaxLayer,
        {
          transform: [{translateX}],
        },
      ]}>
      <View style={styles.parallaxCircle1} />
      <View style={styles.parallaxCircle2} />
    </Animated.View>
  );
};

// Animated Icon Component with Lottie and Gyroscope
const AnimatedIcon: React.FC<{
  name: string;
  lottieSource: any;
  color: string;
  isActive: boolean;
}> = ({name, lottieSource, color, isActive}) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const lottieRef = useRef<LottieView>(null);

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
        ]),
      );
      float.start();

      // Start Lottie animation
      lottieRef.current?.play();

      // Animated tilt effect (replacing gyroscope)
      const tiltAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -5,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 5,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      tiltAnimation.start();

      return () => {
        float.stop();
        tiltAnimation.stop();
      };
    } else {
      scaleAnim.setValue(0.8);
      lottieRef.current?.reset();
    }
  }, [isActive, floatAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.iconContainer,
        {
          backgroundColor: color,
          transform: [
            {translateY: floatAnim},
            {scale: scaleAnim},
          ],
        },
      ]}>
      <View style={styles.iconInner}>
        <LottieView
          ref={lottieRef}
          source={lottieSource}
          style={styles.lottieAnimation}
          loop
          autoPlay={isActive}
        />
      </View>
    </Animated.View>
  );
};

// Single Slide Component with Swipe Gesture and Video
const Slide: React.FC<{
  item: OnboardingSlide;
  index: number;
  scrollX: Animated.Value;
  isActive: boolean;
}> = ({item, index, scrollX, isActive}) => {
  const swipeUpAnim = useRef(new Animated.Value(0)).current;
  const [showDetails, setShowDetails] = useState(false);

  const inputRange = [
    (index - 1) * SLIDE_WIDTH,
    index * SLIDE_WIDTH,
    (index + 1) * SLIDE_WIDTH,
  ];

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

  // Swipe up gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          swipeUpAnim.setValue(Math.max(gestureState.dy, -200));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          hapticService.medium();
          Animated.spring(swipeUpAnim, {
            toValue: -200,
            useNativeDriver: true,
          }).start();
          setShowDetails(true);
        } else {
          Animated.spring(swipeUpAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          setShowDetails(false);
        }
      },
    }),
  ).current;

  return (
    <View style={styles.slide}>
      <LinearGradient
        colors={item.gradientColors}
        style={styles.slideGradient}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <ParallaxBackground scrollX={scrollX} index={index} />
        
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.slideContent,
            {
              opacity,
              transform: [{translateY}, {scale}],
            },
          ]}>
          <AnimatedIcon
            name={item.iconName}
            lottieSource={item.lottieSource}
            color={item.accentColor}
            isActive={isActive}
          />

          <View style={styles.textContainer}>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
            <Text style={styles.slideDescription}>{item.description}</Text>
            
            {/* Swipe up indicator */}
            {!showDetails && (
              <Animated.View style={[styles.swipeIndicator, {opacity: opacity}]}>
                <Icon name="chevron-up" size="sm" color={Colors.text.secondary} />
                <Text style={styles.swipeText}>Glissez pour en savoir plus</Text>
              </Animated.View>
            )}
          </View>

          {/* Details sheet overlay */}
          {showDetails && (
            <Animated.View 
              style={[
                styles.detailsSheet,
                {transform: [{translateY: swipeUpAnim}]}
              ]}>
              <TouchableOpacity
                style={styles.closeDetails}
                onPress={() => {
                  hapticService.light();
                  Animated.spring(swipeUpAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                  }).start();
                  setShowDetails(false);
                }}>
                <Icon name="x" size="md" color={Colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.detailsTitle}>En savoir plus</Text>
              <Text style={styles.detailsText}>
                {item.description} Notre technologie avancée vous permet de gagner du temps et de l'argent sur tous vos achats quotidiens.
              </Text>
            </Animated.View>
          )}
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
          outputRange: [
            Colors.border.medium,
            Colors.primary,
            Colors.border.medium,
          ],
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
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const autoAdvanceTimerRef = useRef<number>();
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Entrance animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const bottomTranslateY = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Auto-advance progress
  useEffect(() => {
    if (autoAdvanceEnabled && currentIndex < SLIDES.length - 1) {
      // Reset and start progress animation
      progressAnim.setValue(0);
      
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 5000, // 5 seconds per slide
        useNativeDriver: false,
      }).start(({finished}) => {
        if (finished) {
          handleNext();
        }
      });

      return () => {
        progressAnim.stopAnimation();
      };
    }
  }, [currentIndex, autoAdvanceEnabled, progressAnim]);

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
    hapticService.light();
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  }, [currentIndex]);



  const handleGetStarted = useCallback(async () => {
    hapticService.success();
    // Mark onboarding as complete so it won't show again
    try {
      await AsyncStorage.setItem('@goshopperai_onboarding_complete', 'true');
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
    navigation.reset({
      index: 0,
      routes: [{name: 'SignIn'}],
    });
  }, [navigation]);

  const handleCommencer = useCallback(async () => {
    hapticService.success();
    // Mark onboarding as complete so it won't show again
    try {
      await AsyncStorage.setItem('@goshopperai_onboarding_complete', 'true');
    } catch (error) {
      console.error('Error saving onboarding state:', error);
    }
    navigation.reset({
      index: 0,
      routes: [{name: 'Main'}],
    });
  }, [navigation]);

  const handlePause = useCallback(() => {
    hapticService.light();
    setAutoAdvanceEnabled(!autoAdvanceEnabled);
  }, [autoAdvanceEnabled]);

  const handleOpenBottomSheet = useCallback(() => {
    hapticService.medium();
    bottomSheetRef.current?.expand();
  }, []);

  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
        hapticService.selection();
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Glassmorphic Blur Header */}
      <BlurView
        style={[
          styles.headerBlur,
          {
            paddingTop: insets.top + Spacing.md,
          },
        ]}
        blurType="light"
        blurAmount={10}
        reducedTransparencyFallbackColor={Colors.background.primary}>
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerOpacity,
            },
          ]}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Icon name="cart" size="sm" color={Colors.primary} />
            </View>
            <Text style={styles.logoText}>Goshopper</Text>
          </View>

          <View style={styles.headerActions}>
            {!isLastSlide && (
              <TouchableOpacity
                style={styles.pauseButton}
                onPress={handlePause}
                activeOpacity={0.7}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon 
                  name={autoAdvanceEnabled ? 'pause' : 'play'} 
                  size="sm" 
                  color={Colors.text.secondary} 
                />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Auto-advance progress bar */}
        {autoAdvanceEnabled && !isLastSlide && (
          <Animated.View 
            style={[
              styles.autoProgressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }
            ]} 
          />
        )}
      </BlurView>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={({item, index}) => (
          <Slide 
            item={item} 
            index={index} 
            scrollX={scrollX}
            isActive={currentIndex === index}
          />
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
        onScrollBeginDrag={() => setAutoAdvanceEnabled(false)}
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

        {/* Passer Button (for non-last slides) */}
        {!isLastSlide && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleGetStarted}
            activeOpacity={0.7}>
            <Text style={styles.skipButtonText}>Passer</Text>
            <Icon
              name="arrow-right"
              size="sm"
              color={Colors.text.secondary}
            />
          </TouchableOpacity>
        )}

        {/* Commencer Button (for last slide) */}
        {isLastSlide && (
          <TouchableOpacity
            style={styles.commencerButton}
            onPress={handleCommencer}
            activeOpacity={0.9}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.commencerGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}>
              <Text style={styles.commencerButtonText}>Commencer</Text>
              <View style={styles.commencerIconContainer}>
                <Icon
                  name="arrow-right"
                  size="sm"
                  color={Colors.white}
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Trial Badge with Animated Counter */}
        <View style={styles.trialBadge}>
          <View style={styles.trialIconContainer}>
            <Icon name="gift" size="sm" color={Colors.status.success} />
          </View>
          <View style={styles.trialTextContainer}>
            <View style={styles.counterRow}>
              <Text style={styles.trialTitle}>Essai gratuit de </Text>
              <AnimatedCounter targetValue={2} isActive={true} />
              <Text style={styles.trialTitle}> mois</Text>
            </View>
            <TouchableOpacity onPress={handleOpenBottomSheet}>
              <Text style={styles.trialSubtitle}>
                Aucune carte bancaire requise • <Text style={styles.termsLink}>Conditions</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Social Login Preview for Last Slide */}
        {isLastSlide && (
          <View style={styles.socialLoginPreview}>
            <Text style={styles.socialTitle}>Connexion rapide</Text>
            <View style={styles.socialButtons}>
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => hapticService.medium()}>
                <Icon name="logo-google" size="md" color={Colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => hapticService.medium()}>
                <Icon name="logo-apple" size="md" color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Bottom Sheet for Terms & Privacy */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['50%', '80%']}
        enablePanDownToClose
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}>
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>Conditions d'utilisation</Text>
          <Text style={styles.bottomSheetText}>
            Profitez de 2 mois gratuits sans engagement. Aucune carte bancaire n'est requise pour commencer votre essai.
            {'\n\n'}
            Vous pouvez annuler à tout moment depuis les paramètres de votre compte.
            {'\n\n'}
            En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
          </Text>
          <TouchableOpacity
            style={styles.bottomSheetButton}
            onPress={() => {
              hapticService.medium();
              bottomSheetRef.current?.close();
            }}>
            <Text style={styles.bottomSheetButtonText}>Compris</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // Glassmorphic Header
  headerBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pauseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
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
  autoProgressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },

  // Slides
  slide: {
    width: SLIDE_WIDTH,
    flex: 1,
  },
  videoBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
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
  
  // Parallax
  parallaxLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  parallaxCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -50,
    left: -50,
  },
  parallaxCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: -30,
    right: -30,
  },

  // Icon & Lottie
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
    overflow: 'hidden',
  },
  lottieAnimation: {
    width: 120,
    height: 120,
  },
  
  // Text
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

  // Swipe Indicator
  swipeIndicator: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  swipeText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium,
  },

  // Details Sheet
  detailsSheet: {
    position: 'absolute',
    bottom: 0,
    left: -Spacing['2xl'],
    right: -Spacing['2xl'],
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    ...Shadows.xl,
    minHeight: 200,
  },
  closeDetails: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  detailsText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    lineHeight: 24,
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

  // Skip Button
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  skipButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
  },

  // Commencer Button (for last slide)
  commencerButton: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  commencerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg + 2,
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.md,
  },
  commencerButtonText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    letterSpacing: -0.3,
  },
  commencerIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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

  // Trial Badge with Counter
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.status.successLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    marginBottom: Spacing.md,
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
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
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
  termsLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },

  // Social Login Preview
  socialLoginPreview: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  socialTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },

  // Bottom Sheet
  bottomSheetBackground: {
    backgroundColor: Colors.background.primary,
    ...Shadows.xl,
  },
  bottomSheetIndicator: {
    backgroundColor: Colors.border.medium,
    width: 40,
  },
  bottomSheetContent: {
    padding: Spacing.xl,
  },
  bottomSheetTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  bottomSheetText: {
    fontSize: Typography.fontSize.md,
    color: Colors.text.secondary,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  bottomSheetButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  bottomSheetButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
});

export default WelcomeScreen;
