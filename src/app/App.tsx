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
import {OfflineBanner, SplashScreen, GlobalScanProgressBanner, GlobalScanResultModal, GlobalPaymentProgressBanner, BiometricSetupPrompt, OfflineSyncBanner} from '@/shared/components';
import ScanUsageWarning from '@/shared/components/ScanUsageWarning';
import {initializeFirebase} from '@/shared/services/firebase/config';
import {analyticsService, translationService} from '@/shared/services';
import {pushNotificationService} from '@/shared/services/firebase';
import {quickActionsService, inAppReviewService, spotlightSearchService, offlineService, widgetDataService} from '@/shared/services';
import {cacheInitializer} from '@/shared/services/caching';
import {initializeNotificationChannels} from '@/shared/utils/notificationChannels';
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
                        <NavigationContainer>
                          <OfflineBanner />
                          <OfflineSyncBanner />
                          <GlobalScanProgressBanner />
                          <GlobalPaymentProgressBanner />
                          <ScanUsageWarning />
                          <BiometricSetupPrompt />
                          <StatusBar
                            barStyle="dark-content"
                            backgroundColor="#FFFFFF"
                            translucent={false}
                          />
                          <RootNavigator />
                          <GlobalScanResultModal />
                        </NavigationContainer>
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
        await initializeFirebase();

        // Initialize Cache System (early for better performance)
        await cacheInitializer.initialize();

        // Initialize Analytics
        await analyticsService.initialize();

        // Wait for all interactions to complete before requesting permissions
        await new Promise(resolve => {
          InteractionManager.runAfterInteractions(() => {
            resolve(undefined);
          });
        });

        // Initialize Push Notifications (after interaction is complete)
        await pushNotificationService.init();

        // Initialize Notification Channels (Android only)
        await initializeNotificationChannels();

        // Initialize Quick Actions (App Icon Shortcuts)
        quickActionsService.initialize();

        // Initialize In-App Review tracking
        await inAppReviewService.initialize();

        // Initialize Spotlight Search
        await spotlightSearchService.initialize();

        // Initialize Offline Service
        await offlineService.initialize();

        // Initialize Widget Data Service
        await widgetDataService.initialize();

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
