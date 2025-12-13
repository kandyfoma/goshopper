/**
 * GoShopperAI - Invoice Intelligence App
 * Main Application Entry Point
 */

import React, {useEffect, useState} from 'react';
import {StatusBar, LogBox, View, Text, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from '@/navigation/RootNavigator';
import {AuthProvider} from '@/shared/contexts/AuthContext';
import {UserProvider} from '@/shared/contexts/UserContext';
import {SubscriptionProvider} from '@/shared/contexts/SubscriptionContext';
import {ThemeProvider} from '@/shared/contexts/ThemeContext';
import {ToastProvider} from '@/shared/contexts/ToastContext';
import {NetworkBanner, useNetwork, OfflineBanner, SplashScreen} from '@/shared/components';
import {initializeFirebase} from '@/shared/services/firebase/config';
import {analyticsService} from '@/shared/services';
import {pushNotificationService} from '@/shared/services/firebase';
import {quickActionsService, inAppReviewService, spotlightSearchService, offlineService, widgetDataService} from '@/shared/services';

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

function NetworkAwareApp(): React.JSX.Element {
  const networkState = useNetwork();

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <UserProvider>
              <SubscriptionProvider>
                <ToastProvider>
                  <NavigationContainer>
                    <NetworkBanner networkState={networkState} />
                    <OfflineBanner />
                    <StatusBar
                      barStyle="dark-content"
                      backgroundColor="#FFFFFF"
                      translucent={false}
                    />
                    <RootNavigator />
                  </NavigationContainer>
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
        console.log('Initializing Firebase...');
        await initializeFirebase();
        console.log('Firebase initialized successfully');

        // Initialize Analytics
        console.log('Initializing Analytics...');
        await analyticsService.initialize();
        console.log('Analytics initialized successfully');

        // Initialize Push Notifications
        console.log('Initializing Push Notifications...');
        await pushNotificationService.init();
        console.log('Push Notifications initialized successfully');

        // Initialize Quick Actions (App Icon Shortcuts)
        console.log('Initializing Quick Actions...');
        quickActionsService.initialize();
        console.log('Quick Actions initialized successfully');

        // Initialize In-App Review tracking
        console.log('Initializing In-App Review...');
        await inAppReviewService.initialize();
        console.log('In-App Review initialized successfully');

        // Initialize Spotlight Search
        console.log('Initializing Spotlight Search...');
        await spotlightSearchService.initialize();
        console.log('Spotlight Search initialized successfully');

        // Initialize Offline Service
        console.log('Initializing Offline Service...');
        await offlineService.initialize();
        console.log('Offline Service initialized successfully');

        // Initialize Widget Data Service
        console.log('Initializing Widget Data Service...');
        await widgetDataService.initialize();
        console.log('Widget Data Service initialized successfully');

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
