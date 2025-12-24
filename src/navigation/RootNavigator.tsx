// Root Navigator - Main app navigation structure
import React, {useEffect, useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ActivityIndicator, View, StyleSheet} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import {APP_ID} from '@/shared/services/firebase/config';
import {RootStackParamList} from '@/shared/types';
import {useAuth} from '@/shared/contexts';
import {Colors} from '@/shared/theme/theme';
import {AppStateTracker} from '@/shared/components';

// Screens
import {MainTabNavigator} from './MainTabNavigator';
import {
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  VerifyOtpScreen,
  ResetPasswordScreen,
  ChangePasswordScreen,
  ProfileSetupScreen,
} from '@/features/onboarding/screens';
import {WelcomeScreenModern} from '@/features/onboarding/screens/WelcomeScreenModern';
import {LoginScreen as SignInScreen} from '@/features/onboarding/screens';
import {
  UnifiedScannerScreen,
  ReceiptDetailScreen,
  PriceComparisonScreen,
  ReceiptProcessingScreen,
} from '@/features/scanner/screens';
import {SubscriptionScreen, SubscriptionDetailsScreen, SubscriptionDurationScreen} from '@/features/subscription/screens';
import {MokoPaymentScreen} from '@/features/payment/screens/MokoPaymentScreen';
import {SettingsScreen} from '@/features/settings/screens';
import {UpdateProfileScreen, BudgetSettingsScreen, SupportScreen, ContactScreen, TermsScreen} from '@/features/profile/screens';

// Phase 1.1 & 1.2 Screens
import {NotificationsScreen} from '@/features/notifications';
import {PriceAlertsScreen} from '@/features/alerts';
import {ShoppingListsScreen, ShoppingListDetailScreen} from '@/features/shopping';
import {AIAssistantScreen} from '@/features/assistant';
import {AchievementsScreen} from '@/features/achievements';
import {CitySelectionScreen} from '@/features/onboarding/screens';
import {FAQScreen, PrivacyPolicyScreen, TermsOfServiceScreen} from '@/features/legal';
import {ShopsScreen, ShopDetailScreen} from '@/features/shops';
import {CityItemsScreen} from '@/features/items/screens';
import {ItemsScreen} from '@/features/items';
import {StatsScreen} from '@/features/stats/screens/StatsScreen';
import {HistoryScreen} from '@/features/history/screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const ONBOARDING_KEY = '@goshopperai_onboarding_complete';

export function RootNavigator() {
  const {isAuthenticated, isLoading, user} = useAuth();
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(
    null,
  );
  const [checkingProfile, setCheckingProfile] = useState(false);

  console.log(
    '🧭 RootNavigator render - isAuthenticated:',
    isAuthenticated,
    'isLoading:',
    isLoading,
  );

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
        setIsFirstLaunch(hasSeenOnboarding === null);
        // Don't mark onboarding as complete here - let WelcomeScreen do it when user completes it
      } catch (error) {
        // If error, assume first launch
        setIsFirstLaunch(true);
      }
    };

    checkFirstLaunch();
  }, []);

  // Check if user profile is complete after authentication
  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!isAuthenticated || !user?.uid) {
        setIsProfileComplete(null);
        return;
      }

      setCheckingProfile(true);
      try {
        const userDoc = await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(user.uid)
          .get();

        const userData = userDoc.data();
        // Profile is complete if they have firstName, surname, phoneNumber, and city
        const isComplete = !!(
          userData?.profileCompleted ||
          (userData?.firstName &&
            userData?.surname &&
            userData?.phoneNumber &&
            userData?.defaultCity)
        );

        console.log('👤 Profile check:', {
          exists: userDoc.exists,
          profileCompleted: userData?.profileCompleted,
          firstName: userData?.firstName,
          surname: userData?.surname,
          phoneNumber: userData?.phoneNumber,
          defaultCity: userData?.defaultCity,
          isComplete,
        });

        setIsProfileComplete(isComplete);
      } catch (error) {
        console.error('Error checking profile:', error);
        // On error, assume profile needs setup
        setIsProfileComplete(false);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkProfileCompletion();
  }, [isAuthenticated, user?.uid]);

  // Show loading screen while checking first launch status or auth
  if (
    isFirstLaunch === null ||
    isLoading ||
    (isAuthenticated && checkingProfile)
  ) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Always show main app - allow anonymous access
  console.log(
    '✅ Showing main app (allowing anonymous access), authenticated:',
    isAuthenticated,
    'profileComplete:',
    isProfileComplete,
    'isFirstLaunch:',
    isFirstLaunch,
  );

  // Determine initial route based on state
  let initialRoute: keyof RootStackParamList = 'Main';
  
  if (isFirstLaunch && !isAuthenticated) {
    // First time user who hasn't logged in yet - show Welcome screen
    initialRoute = 'Welcome';
  } else if (isAuthenticated && isProfileComplete === false) {
    // Authenticated but profile incomplete - show profile setup
    initialRoute = 'ProfileSetup';
  }

  return (
    <React.Fragment>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}>
      {/* Welcome Screen - shown for first-time users who haven't logged in */}
      {isFirstLaunch && !isAuthenticated && (
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreenModern}
          options={{
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
      )}
      {/* Profile Setup - shown first if authenticated but profile incomplete */}
      {isAuthenticated && isProfileComplete === false && (
        <Stack.Screen
          name="ProfileSetup"
          component={ProfileSetupScreen}
          options={{
            animation: 'fade',
            gestureEnabled: false, // Prevent back gesture
          }}
        />
      )}
      <Stack.Screen name="Main" component={MainTabNavigator} />
      {/* Auth screens available for navigation */}
      <Stack.Screen
        name="SignIn"
        component={LoginScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="VerifyOtp"
        component={VerifyOtpScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="Scanner"
        component={UnifiedScannerScreen}
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CitySelection"
        component={CitySelectionScreen}
        options={{
          animation: 'slide_from_right',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="UpdateProfile"
        component={UpdateProfileScreen}
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BudgetSettings"
        component={BudgetSettingsScreen}
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="ReceiptDetail"
        component={ReceiptDetailScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ReceiptProcessing"
        component={ReceiptProcessingScreen}
        options={{
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back during processing
        }}
      />
      <Stack.Screen
        name="PriceComparison"
        component={PriceComparisonScreen}
        options={{headerShown: true, title: 'Comparaison'}}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          animation: 'slide_from_bottom',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="SubscriptionDuration"
        component={SubscriptionDurationScreen}
        options={{
          animation: 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SubscriptionDetails"
        component={SubscriptionDetailsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="MokoPayment"
        component={MokoPaymentScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{headerShown: false}}
      />
      {/* Phase 1.1 Screens */}
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PriceAlerts"
        component={PriceAlertsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{headerShown: false}}
      />
      {/* Phase 1.2 Screens */}
      <Stack.Screen
        name="ShoppingLists"
        component={ShoppingListsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ShoppingListDetail"
        component={ShoppingListDetailScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AIAssistant"
        component={AIAssistantScreen}
        options={{headerShown: false}}
      />
      {/* Shops */}
      <Stack.Screen
        name="Shops"
        component={ShopsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ShopDetail"
        component={ShopDetailScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FAQ"
        component={FAQScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="CityItems"
        component={CityItemsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Items"
        component={ItemsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Stats"
        component={StatsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Contact"
        component={ContactScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{headerShown: false}}
      />
      </Stack.Navigator>
      <AppStateTracker />
    </React.Fragment>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
