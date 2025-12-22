// Main Tab Navigator - Bottom tabs with modern rounded design
import React, {useEffect, useRef} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {View, Text, StyleSheet, Animated, Platform, Pressable} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {MainTabParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  Shadows,
  Layout,
} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {ModernTabBar, TabBarIcon} from '@/shared/components/ModernTabBar';

// Screens
import {HomeScreen} from '@/features/home/screens';
import {HistoryScreen} from '@/features/history/screens';
import {UnifiedScannerScreen} from '@/features/scanner/screens';
import {ItemsScreen, CityItemsScreen} from '@/features/items';
import {ProfileScreen} from '@/features/profile/screens';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({focused, icon, label, badge}: {focused: boolean; icon: string; label: string; badge?: number}) {
  return <TabBarIcon focused={focused} icon={icon} label={label} badge={badge} />;
}

// Custom Tab Bar Component with rounded design
export function MainTabNavigator() {
  // Notification badges from real data
  const notificationBadges = {
    Home: 0,
    History: 0, 
    Scanner: 0,
    Items: 0,
    Profile: 0,
  };

  return (
    <Tab.Navigator
      tabBar={(props) => <ModernTabBar {...props} badges={notificationBadges} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="home" label="Accueil" badge={notificationBadges.Home} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="clock" label="Historique" badge={notificationBadges.History} />
          ),
        }}
      />
      <Tab.Screen
        name="Scanner"
        component={UnifiedScannerScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="camera" label="Scanner" badge={notificationBadges.Scanner} />
          ),
        }}
      />
      <Tab.Screen
        name="Items"
        component={CityItemsScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="shopping-bag" label="Articles" badge={notificationBadges.Items} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} icon="user" label="Profil" badge={notificationBadges.Profile} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Minimal styles since we use ModernTabBar component
  container: {
    flex: 1,
  },
});

export default MainTabNavigator;