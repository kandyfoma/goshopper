// Main Tab Navigator - Bottom tabs with modern design
import React, {useEffect, useRef} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {View, Text, StyleSheet, Animated, Platform} from 'react-native';
import {MainTabParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  Shadows,
  Layout,
} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';

// Screens
import {HomeScreen} from '@/features/home/screens';
import {HistoryScreen} from '@/features/history/screens';
import {UnifiedScannerScreen} from '@/features/scanner/screens';
import {StatsScreen} from '@/features/stats/screens';
import {ItemsScreen} from '@/features/items';
import {ProfileScreen} from '@/features/profile/screens';

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabIconProps {
  focused: boolean;
  icon: string;
  label: string;
}

function TabIcon({focused, icon, label}: TabIconProps) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const translateYAnim = useRef(new Animated.Value(focused ? -4 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.9,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.spring(translateYAnim, {
        toValue: focused ? -4 : 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
    ]).start();
  }, [focused, scaleAnim, translateYAnim]);

  return (
    <Animated.View
      style={[
        styles.tabIconContainer,
        {
          transform: [{scale: scaleAnim}, {translateY: translateYAnim}],
        },
      ]}>
      <View style={[styles.iconWrapper, focused && styles.iconWrapperFocused]}>
        <Icon
          name={icon}
          size="sm"
          color={focused ? Colors.primary : Colors.text.tertiary}
          variant={focused ? 'filled' : 'outline'}
        />
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
        {label}
      </Text>
    </Animated.View>
  );
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarHideOnKeyboard: true,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="home" label="Accueil" />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="receipt" label="Historique" />
          ),
        }}
      />
      <Tab.Screen
        name="Scanner"
        component={UnifiedScannerScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="camera" label="Scanner" />
          ),
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="stats" label="Stats" />
          ),
        }}
      />
      <Tab.Screen
        name="Items"
        component={ItemsScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="cart" label="Articles" />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="user" label="Profil" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: Spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? 24 : Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapperFocused: {
    backgroundColor: Colors.background.secondary,
  },
  tabLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: Typography.fontWeight.medium,
    marginTop: 2,
  },
  tabLabelFocused: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semiBold,
  },
});
