// Profile Stack Navigator - Nested navigation for Profile tab including all profile-related screens
import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ProfileScreen} from '../screens';
import {SubscriptionScreen} from '@/features/subscription/screens';
import {UpdateProfileScreen, BudgetSettingsScreen, SupportScreen, ContactScreen, TermsScreen} from '@/features/profile/screens';
import {SettingsScreen, DeveloperToolsScreen} from '@/features/settings/screens';
import {NotificationsScreen} from '@/features/notifications';
import {AchievementsScreen} from '@/features/achievements';
import {HistoryScreen} from '@/features/history/screens';
import {ShoppingListsScreen, ShoppingListDetailScreen} from '@/features/shopping';
import {AIAssistantScreen} from '@/features/assistant';
import {PriceAlertsScreen} from '@/features/alerts';
import {FAQScreen, PrivacyPolicyScreen, TermsOfServiceScreen} from '@/features/legal';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Subscription: undefined;
  UpdateProfile: undefined;
  BudgetSettings: undefined;
  Support: undefined;
  Contact: undefined;
  Terms: undefined;
  Settings: undefined;
  DeveloperTools: undefined;
  Notifications: undefined;
  Achievements: undefined;
  History: undefined;
  ShoppingLists: undefined;
  ShoppingListDetail: {listId: string; listName: string};
  AIAssistant: undefined;
  PriceAlerts: undefined;
  FAQ: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="UpdateProfile" component={UpdateProfileScreen} />
      <Stack.Screen name="BudgetSettings" component={BudgetSettingsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="DeveloperTools" component={DeveloperToolsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="ShoppingLists" component={ShoppingListsScreen} />
      <Stack.Screen name="ShoppingListDetail" component={ShoppingListDetailScreen} />
      <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
      <Stack.Screen name="PriceAlerts" component={PriceAlertsScreen} />
      <Stack.Screen name="FAQ" component={FAQScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
    </Stack.Navigator>
  );
}
