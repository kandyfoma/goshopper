import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Sentry DSN - Safe to include directly (client-side key)
const SENTRY_DSN = 'https://f6378185c1c40bc4b10680da40d9e1e3@o4510788821450752.ingest.de.sentry.io/4510788885217360';

export const initializeSentry = () => {
  // Only initialize in production or if explicitly enabled
  const isProduction = !__DEV__;

  if (!SENTRY_DSN || SENTRY_DSN === SENTRY_DSN) {
    console.log('⚠️ Sentry DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Enable in production, can enable in dev for testing
    enabled: isProduction,

    // Environment
    environment: isProduction ? 'production' : 'development',

    // Release tracking
    release: `goshopper@${Constants.expoConfig?.version || '7.4.2'}`,
    dist: Constants.expoConfig?.android?.versionCode?.toString() ||
          Constants.expoConfig?.ios?.buildNumber ||
          '1',

    // Performance monitoring - sample 20% of transactions
    tracesSampleRate: 0.2,

    // Capture user context
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,

    // Native crash integration
    enableNative: true,
    enableNativeCrashHandling: true,
    enableNativeNagger: false,

    // Breadcrumbs for debugging
    maxBreadcrumbs: 50,

    // Filter out sensitive information
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (__DEV__ && !event.environment?.includes('test')) {
        console.log('🐛 Sentry event (dev mode - not sent):', event);
        return null;
      }

      // Filter out known issues or sensitive data
      if (event.message?.includes('password') ||
          event.message?.includes('token') ||
          event.message?.includes('secret')) {
        return null;
      }

      return event;
    },

    // Integration configuration
    integrations: [
      Sentry.reactNavigationIntegration(),
    ],
  });

  console.log('✅ Sentry initialized for error tracking');
};

// Export Sentry for use in error boundaries
export { Sentry };