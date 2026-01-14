/**
 * GoShopper - Invoice Intelligence App
 * Main Application Entry Point
 */

import React, {useEffect, useState} from 'react';
import {StatusBar, LogBox, View, Text, StyleSheet, InteractionManager} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from '@/navigation/RootNavigator';
import {AuthProvider} from '@/shared/contexts/AuthContext';
import {UserProvider} from '@/shared/contexts/UserContext';
import {SubscriptionProvider} from '@/shared/contexts/SubscriptionContext';
import {ThemeProvider} from '@/shared/contexts/ThemeContext';
import {ToastProvider} from '@/shared/contexts/ToastContext';
import {ScanProcessingProvider} from '@/shared/contexts/ScanProcessingContext';
import {PaymentProcessingProvider} from '@/shared/contexts/PaymentProcessingContext';
import {OfflineModeProvider} from '@/shared/contexts/OfflineModeContext';
import {ScrollProvider} from '@/shared/contexts/ScrollContext';
import {OfflineBanner, SplashScreen, GlobalScanProgressBanner, GlobalScanResultModal, GlobalPaymentProgressBanner, BiometricSetupPrompt, OfflineSyncBanner} from '@/shared/components';
import ScanUsageWarning from '@/shared/components/ScanUsageWarning';
import {initializeFirebase} from '@/shared/services/firebase/config';
import {analyticsService, translationService} from '@/shared/services';
import {pushNotificationService} from '@/shared/services/firebase';
import {quickActionsService, inAppReviewService, spotlightSearchService, offlineService, widgetDataService} from '@/shared/services';
import {cacheInitializer, cachePreloader} from '@/shared/services/caching';
import {initializeNotificationChannels} from '@/shared/utils/notificationChannels';
import {notificationActionsService} from '@/shared/services/notificationActions';
import {navigationService, navigationRef} from '@/shared/services/navigationService';
import {useBiometricCheck} from '@/shared/hooks';

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

function NetworkAwareApp(): React.JSX.Element {
  // Check biometric availability on app resume
  useBiometricCheck();

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <UserProvider>
              <SubscriptionProvider>
                <ToastProvider>
                  <OfflineModeProvider>
                    <ScanProcessingProvider>
                      <PaymentProcessingProvider>
                        <ScrollProvider>
                          <NavigationContainer ref={navigationRef}>
                            <OfflineBanner />
                            <OfflineSyncBanner />
                            <GlobalScanProgressBanner />
                            <GlobalPaymentProgressBanner />
                            <ScanUsageWarning />
                            <BiometricSetupPrompt />
                            <StatusBar
                              barStyle="dark-content"
                              backgroundColor="transparent"
                              translucent={true}
                            />
                            <RootNavigator />
                            <GlobalScanResultModal />
                          </NavigationContainer>
                        </ScrollProvider>
                      </PaymentProcessingProvider>
                    </ScanProcessingProvider>
                  </OfflineModeProvider>
                </ToastProvider>
              </SubscriptionProvider>
            </UserProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function App(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize Firebase on app start
    const init = async () => {
      try {
        console.log('🚀 Starting app initialization...');
        await initializeFirebase();
        console.log('✅ Firebase initialized');

        // Initialize Cache System (early for better performance)
        await cacheInitializer.initialize();
        console.log('✅ Cache initialized');

        // Initialize Analytics
        await analyticsService.initialize();
        console.log('✅ Analytics initialized');

        // Wait for all interactions to complete before requesting permissions
        console.log('⏳ Waiting for interactions...');
        await new Promise(resolve => {
          InteractionManager.runAfterInteractions(() => {
            resolve(undefined);
          });
        });
        console.log('✅ Interactions complete');

        // Initialize Push Notifications (after interaction is complete)
        console.log('⏳ Initializing push notifications...');
        await pushNotificationService.init();
        console.log('✅ Push notifications initialized');

        // Initialize Notification Channels (Android only)
        console.log('⏳ Initializing notification channels...');
        await initializeNotificationChannels();
        console.log('✅ Notification channels initialized');

        // Initialize Notification Actions (mark as read, etc.)
        console.log('⏳ Initializing notification actions...');
        await notificationActionsService.initialize();
        console.log('✅ Notification actions initialized');

        // Initialize Quick Actions (App Icon Shortcuts)
        console.log('⏳ Initializing quick actions...');
        quickActionsService.initialize();
        console.log('✅ Quick actions initialized');

        // Initialize In-App Review tracking
        console.log('⏳ Initializing in-app review...');
        await inAppReviewService.initialize();
        console.log('✅ In-app review initialized');

        // Initialize Spotlight Search
        console.log('⏳ Initializing spotlight search...');
        await spotlightSearchService.initialize();
        console.log('✅ Spotlight search initialized');

        // Initialize Offline Service
        console.log('⏳ Initializing offline service...');
        await offlineService.initialize();
        console.log('✅ Offline service initialized');

        // Initialize Widget Data Service
        console.log('⏳ Initializing widget data service...');
        await widgetDataService.initialize();
        console.log('✅ Widget data service initialized');

        // Check for pending navigation from notifications
        // This handles deep linking when user taps notification
        console.log('⏳ Scheduling pending navigation check...');
        setTimeout(async () => {
          await navigationService.checkPendingNavigation();
        }, 1000);

        console.log('✅ All services initialized successfully!');
        console.log('🎉 Setting loading to false...');

        // Pre-translate common search terms in background
        InteractionManager.runAfterInteractions(async () => {
          const commonTerms = [
            'pain', 'bread', 'lait', 'milk', 'eau', 'water', 
            'riz', 'rice', 'viande', 'meat', 'poisson', 'fish',
            'fromage', 'cheese', 'tomate', 'tomato', 'poulet', 'chicken',
            'pomme', 'apple', 'banane', 'banana', 'œuf', 'egg'
          ];
          await translationService.preTranslateCommonTerms(commonTerms);
        });

        setLoading(false);
      } catch (err) {
        console.error('App initialization error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    init();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>⚠️ Initialization Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (loading) {
    return <SplashScreen />;
  }

  return <NetworkAwareApp />;
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fee',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#c00',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default App;
