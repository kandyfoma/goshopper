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
import {initializeFirebase} from '@/shared/services/firebase/config';
import {analyticsService} from '@/shared/services';

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

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
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>🛒 GoShopperAI</Text>
        <Text style={styles.loadingSubtext}>Loading...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <UserProvider>
              <SubscriptionProvider>
                <NavigationContainer>
                  <StatusBar
                    barStyle="dark-content"
                    backgroundColor="transparent"
                    translucent
                  />
                  <RootNavigator />
                </NavigationContainer>
              </SubscriptionProvider>
            </UserProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22c55e',
  },
  loadingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  loadingSubtext: {
    fontSize: 16,
    color: '#fff',
  },
});

export default App;
