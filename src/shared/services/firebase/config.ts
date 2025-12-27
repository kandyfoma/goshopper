// Firebase Configuration
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';

// Firebase configuration is handled by google-services.json (Android)
// and GoogleService-Info.plist (iOS)

let initialized = false;

export const initializeFirebase = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  try {
    // React Native Firebase auto-initializes from google-services.json (Android)
    // and GoogleService-Info.plist (iOS), so we just need to configure Firestore

    // Enable Firestore offline persistence
    await firestore().settings({
      persistence: true,
      cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
    });

    initialized = true;
  } catch (error) {
    console.warn(
      '⚠️ Firebase initialization failed - running in demo mode:',
      error,
    );
    // Don't throw error, allow app to continue
    initialized = true;
  }
};

// Export Firebase instances
export const firebaseAuth = auth;
export const firebaseFirestore = firestore;
export const firebaseStorage = storage;
export const firebaseFunctions = functions;

// Get functions instance with region
export const getFunctionsInstance = () => {
  return functions();
};

// App ID for artifact paths
export const APP_ID = 'goshopper';

// Collection paths - MUST match Cloud Functions paths in functions/src/config.ts
export const COLLECTIONS = {
  users: (userId: string) => `artifacts/${APP_ID}/users/${userId}`,
  userProfile: (userId: string) => `artifacts/${APP_ID}/users/${userId}`,
  receipts: (userId: string) => `artifacts/${APP_ID}/users/${userId}/receipts`,
  subscription: (userId: string) =>
    `artifacts/${APP_ID}/users/${userId}/subscription/status`,
  subscriptionStatus: (userId: string) =>
    `artifacts/${APP_ID}/users/${userId}/subscription/status`,
  prices: `artifacts/${APP_ID}/prices`,
  stores: `artifacts/${APP_ID}/stores`,
} as const;
