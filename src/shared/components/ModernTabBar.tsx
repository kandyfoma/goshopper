// Enhanced Tab Bar with Notification Badges and Auto-hide on Scroll
import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Colors, Typography, Shadows} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';

const {width: screenWidth} = Dimensions.get('window');

interface TabBarIconProps {
  focused: boolean;
  icon: string;
  label: string;
  badge?: number;
}

export function TabBarIcon({focused, icon, label, badge}: TabBarIconProps) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.15 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0.8)).current;
  const badgeAnim = useRef(new Animated.Value(badge ? 1 : 0)).current;

  // Ensure badge is a valid number
  const validBadge = typeof badge === 'number' && badge > 0 ? badge : 0;
  // Ensure label is a valid string
  const validLabel = typeof label === 'string' ? label : '';
  // Ensure icon is a valid string
  const validIcon = typeof icon === 'string' ? icon : 'circle';

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.15 : 1,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  useEffect(() => {
    Animated.spring(badgeAnim, {
      toValue: validBadge ? 1 : 0,
      useNativeDriver: true,
      tension: 300,
      friction: 8,
    }).start();
  }, [validBadge]);

  return (
    <View style={styles.tabIconContainer}>
      <Animated.View
        style={[
          styles.iconWrapper,
          focused && styles.iconWrapperFocused,
          {
            transform: [{scale: scaleAnim}],
            opacity: opacityAnim,
          },
        ]}>
        {/* Active indicator dot */}
        {focused && <View style={styles.activeIndicator} />}
        
        {/* Icon */}
        <Icon
          name={validIcon}
          size="md"
          color={focused ? '#780000' : '#669BBC'}
        />

        {/* Notification Badge */}
        {validBadge > 0 && (
          <Animated.View
            style={[
              styles.badge,
              {
                transform: [{scale: badgeAnim}],
                opacity: badgeAnim,
              },
            ]}>
            <Text style={styles.badgeText}>
              {validBadge > 99 ? '99+' : validBadge.toString()}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
      
      {/* Text labels removed - icons only */}
    </View>
  );
}

interface ModernTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
  badges?: {[key: string]: number};
  scrollY?: Animated.Value; // Optional scroll position for auto-hide
}

export function ModernTabBar({state, descriptors, navigation, badges = {}, scrollY}: ModernTabBarProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!scrollY) return;

    const listenerId = scrollY.addListener(({value}) => {
      const diff = value - lastScrollY.current;
      
      // Only hide/show if scrolled more than 5 pixels (prevent jitter)
      if (Math.abs(diff) < 5) return;

      if (diff > 0 && value > 50 && isVisible) {
        // Scrolling down - hide tab bar
        setIsVisible(false);
        Animated.spring(translateY, {
          toValue: 100, // Height of tab bar
          useNativeDriver: true,
          tension: 300,
          friction: 30,
        }).start();
      } else if (diff < 0 && !isVisible) {
        // Scrolling up - show tab bar
        setIsVisible(true);
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 300,
          friction: 30,
        }).start();
      }

      lastScrollY.current = value;
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [scrollY, isVisible]);

  return (
    <Animated.View style={[styles.tabBarContainer, {transform: [{translateY}]}]}>
      <LinearGradient
        colors={['#FDF0D5', '#F5E6C3']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.tabBarGradient}>
        <View style={styles.tabBarContent}>
          {state.routes.map((route: any, index: number) => {
            const {options} = descriptors[route.key];
            const isFocused = state.index === index;
            const routeBadge = badges[route.name] || 0;

            const onPress = () => {
              const event = navigation.emit ? navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              }) : { defaultPrevented: false };

              if (!isFocused && !event.defaultPrevented) {
                // Navigate to Main tab navigator with nested screen
                // This ensures we always go to the tab, not root stack screens
                navigation.navigate('Main', {screen: route.name});
              }
            };

            const onLongPress = () => {
              if (navigation.emit) {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              }
            };

            return (
              <View key={index} style={styles.tabItem}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={isFocused ? {selected: true} : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  testID={options.tabBarTestID}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={[
                    styles.tabButton,
                    isFocused && styles.tabButtonFocused,
                  ]}>
                  {options.tabBarIcon ? 
                    options.tabBarIcon({focused: isFocused, badge: routeBadge}) : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Floating center scanner button (optional) */}
        {/* You can uncomment this for a special center button
        <View style={styles.centerButtonContainer}>
          <LinearGradient
            colors={[Colors.accentLight, Colors.accent]}
            style={styles.centerButton}>
            <Icon name="camera" size="lg" color={Colors.white} />
          </LinearGradient>
        </View>
        */}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 16 : 8,
    left: 24,
    right: 24,
    ...Shadows.sm,
  },
  tabBarGradient: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  tabBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    minHeight: 44,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  tabButtonFocused: {
    backgroundColor: 'transparent',
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  iconWrapperFocused: {
    backgroundColor: 'transparent',
  },
  activeIndicator: {
    position: 'absolute',
    top: -6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#780000',
    shadowColor: '#780000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tabLabel: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: Typography.fontWeight.medium,
    marginTop: 4,
    opacity: 0.8,
    textAlign: 'center',
  },
  tabLabelFocused: {
    opacity: 1,
    fontWeight: Typography.fontWeight.semiBold,
  },
  // Optional floating center button styles
  centerButtonContainer: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    ...Shadows.lg,
  },
  centerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.white,
  },
});

export default ModernTabBar;