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
import {AppStateTracker, ErrorBoundary} from '@/shared/components';

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
import {CitySelectionScreen} from '@/features/onboarding/screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const ONBOARDING_KEY = '@goshopperai_onboarding_complete';

// Wrap critical screens with Error Boundary for better error handling
const ScannerWithErrorBoundary = () => (
  <ErrorBoundary>
    <UnifiedScannerScreen />
  </ErrorBoundary>
);

const ReceiptDetailWithErrorBoundary = () => (
  <ErrorBoundary>
    <ReceiptDetailScreen />
  </ErrorBoundary>
);

export function RootNavigator() {
  const {isAuthenticated, isLoading, user} = useAuth();
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(
    null,
  );
  const [checkingProfile, setCheckingProfile] = useState(false);

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
        
        // Safety check - if doc doesn't exist or has no data, profile is incomplete
        if (!userDoc.exists || !userData) {
          console.log('📝 RootNavigator: User document not found or empty');
          setIsProfileComplete(false);
          setCheckingProfile(false);
          return;
        }
        
        // Profile is complete if:
        // 1. profileCompleted flag is true, OR
        // 2. User has firstName, surname, phoneNumber, and defaultCity (social login users), OR
        // 3. User registered with phone (has phoneNumber and city from registration)
        const isComplete = !!(
          userData?.profileCompleted ||
          (userData?.firstName &&
            userData?.surname &&
            userData?.phoneNumber &&
            userData?.defaultCity) ||
          (userData?.phoneNumber && userData?.city && userData?.countryCode)
        );

        setIsProfileComplete(isComplete);
      } catch (error) {
        console.error('Error checking profile:', error);
        // On error, assume profile is complete (don't block user)
        setIsProfileComplete(true);
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

  // Determine initial route based on state
  let initialRoute: keyof RootStackParamList = 'Main';
  
  if (isFirstLaunch && !isAuthenticated) {
    // First time user who hasn't logged in yet - show Welcome screen
    initialRoute = 'Welcome';
  } else if (isAuthenticated && isProfileComplete === false) {
    // Authenticated but profile incomplete - show profile setup
    initialRoute = 'ProfileSetup';
  }
  // If authenticated and profile complete, go to Main (default)
  // If not first launch and not authenticated, go to Main (allow anonymous browsing)

  return (
    <React.Fragment>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}>
        {/* Welcome Screen - shown only for first-time users who haven't logged in */}
        {/* Note: Social login users skip this by marking onboarding complete in AuthContext */}
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
          component={ScannerWithErrorBoundary}
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
          name="ReceiptDetail"
          component={ReceiptDetailWithErrorBoundary}
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
            animation: 'fade',
            presentation: 'transparentModal',
            contentStyle: { backgroundColor: 'transparent' },
          }}
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
