// Main Tab Navigator - Bottom tabs with modern rounded design
import React, {useEffect, useRef} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {View, Text, StyleSheet, Animated, Platform, Pressable} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import QuickActions from 'react-native-quick-actions';
import {MainTabParamList, RootStackParamList} from '@/shared/types';
import {
  Colors,
  Typography,
  Spacing,
  Shadows,
  Layout,
} from '@/shared/theme/theme';
import {Icon} from '@/shared/components';
import {ModernTabBar, TabBarIcon} from '@/shared/components/ModernTabBar';
import {SubscriptionLimitModal} from '@/shared/components';
import {useSubscription} from '@/shared/contexts';
import {hasFeatureAccess} from '@/shared/utils/featureAccess';

// Screens
import {HomeStackNavigator} from '@/features/home/navigation/HomeStackNavigator';
import {UnifiedScannerScreen} from '@/features/scanner/screens';
import {ItemsScreen, CityItemsScreen} from '@/features/items';
import {StatsStackNavigator} from '@/features/stats/navigation/StatsStackNavigator';
import {ProfileStackNavigator} from '@/features/profile/navigation/ProfileStackNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

function TabIcon({focused, icon, label, badge}: {focused: boolean; icon: string; label: string; badge?: number}) {
  return <TabBarIcon focused={focused} icon={icon} label={label} badge={badge} />;
}

// Custom Tab Bar Component with rounded design
export function MainTabNavigator() {
  const navigation = useNavigation<RootNavigationProp>();
  const {subscription, canScan} = useSubscription();
  const [showStatsLimitModal, setShowStatsLimitModal] = React.useState(false);

  // Check if user has access to stats
  const hasStatsAccess = hasFeatureAccess('stats', subscription);

  const handleStatsPress = () => {
    if (!hasStatsAccess) {
      setShowStatsLimitModal(true);
      return false;
    }
    return true;
  };

  const handleScannerPress = () => {
    if (!canScan) {
      navigation.navigate('Subscription');
      return false;
    }
    return true;
  };

  // Handle quick actions (app shortcuts)
  useEffect(() => {
    // Check if QuickActions is available (Android only, and might not be fully initialized)
    if (!QuickActions || typeof QuickActions.popInitialAction !== 'function') {
      console.log('QuickActions not available on this platform');
      return;
    }

    // Handle initial quick action (app opened via shortcut)
    QuickActions.popInitialAction()
      .then((data) => {
        if (data) {
          handleQuickAction(data.type);
        }
      })
      .catch((error) => {
        console.log('Error getting initial quick action:', error);
      });

    // Handle quick actions while app is running
    // Note: QuickActions listener may not be available on all platforms
    try {
      // @ts-ignore - QuickActions listener API varies by platform
      if (QuickActions.addListener) {
        // @ts-ignore
        const subscription = QuickActions.addListener((data: any) => {
          if (data) {
            handleQuickAction(data.type);
          }
        });

        return () => {
          if (subscription && typeof subscription.remove === 'function') {
            subscription.remove();
          }
        };
      }
    } catch (error) {
      console.log('QuickActions listener not available:', error);
    }
  }, []);

  const handleQuickAction = (actionType: string) => {
    console.log('Quick action triggered:', actionType);
    
    // Map action types to navigation
    switch (actionType) {
      case 'com.goshopperai.scan':
        navigation.navigate('Scanner');
        break;
      case 'com.goshopperai.shopping':
        navigation.navigate('ShoppingLists');
        break;
      case 'com.goshopperai.history':
        navigation.navigate('History');
        break;
      default:
        console.log('Unknown quick action type:', actionType);
    }
  };

  // Notification badges from real data
  const notificationBadges = {
    Home: 0,
    Scanner: 0,
    Items: 0,
    Stats: 0,
    Profile: 0,
  };

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <ModernTabBar {...props} badges={notificationBadges} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}>
        <Tab.Screen
          name="Home"
          component={HomeStackNavigator}
          options={{
            tabBarIcon: ({focused}) => (
              <TabIcon focused={focused} icon="home" label="Accueil" badge={notificationBadges.Home} />
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
          name="Scanner"
          component={UnifiedScannerScreen}
          listeners={{
            tabPress: (e) => {
              if (!handleScannerPress()) {
                e.preventDefault();
              }
            },
          }}
          options={{
            tabBarIcon: ({focused}) => (
              <TabIcon focused={focused} icon="camera" label="Scanner" badge={notificationBadges.Scanner} />
            ),
          }}
        />
        <Tab.Screen
          name="Stats"
          component={StatsStackNavigator}
          listeners={{
            tabPress: (e) => {
              if (!handleStatsPress()) {
                e.preventDefault();
              }
            },
          }}
          options={{
            tabBarIcon: ({focused}) => (
              <TabIcon focused={focused} icon="bar-chart-2" label="Stats" badge={notificationBadges.Stats} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStackNavigator}
          options={{
            tabBarIcon: ({focused}) => (
              <TabIcon focused={focused} icon="user" label="Profil" badge={notificationBadges.Profile} />
            ),
          }}
        />
      </Tab.Navigator>

      {/* Subscription Limit Modal */}
      <SubscriptionLimitModal
        visible={showStatsLimitModal}
        onClose={() => setShowStatsLimitModal(false)}
        limitType="generic"
        customTitle="Statistiques"
        customMessage="Les statistiques sont réservées aux abonnés Premium. Mettez à niveau pour visualiser vos dépenses et tendances."
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Minimal styles since we use ModernTabBar component
  container: {
    flex: 1,
  },
});

export default MainTabNavigator;