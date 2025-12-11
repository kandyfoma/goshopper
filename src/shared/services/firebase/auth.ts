// Authentication Service
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import firebase from '@react-native-firebase/app';
import {User, UserProfile} from '@/shared/types';
import {COLLECTIONS, APP_ID} from './config';

class AuthService {
  private currentUser: FirebaseAuthTypes.User | null = null;
  private initPromise: Promise<boolean> | null = null;

  constructor() {
    // Start initialization process
    this.initPromise = this.initializeWhenReady();
  }

  private async initializeWhenReady(): Promise<boolean> {
    try {
      // Wait for Firebase auth to be ready (up to 5 seconds)
      let attempts = 0;
      while (attempts < 10) {
        try {
          // Try to access auth - if it works, Firebase is ready
          const authInstance = auth();
          if (authInstance) {
            // Firebase is ready!
            authInstance.onAuthStateChanged(user => {
              this.currentUser = user;
            });
            return true;
          }
        } catch (e) {
          // Auth not ready yet, continue waiting
        }
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
        attempts++;
      }
      
      console.warn('Firebase not initialized after 5 seconds - auth service unavailable');
      return false;
    } catch (error) {
      console.warn('Auth service initialization failed:', error);
      return false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      const initialized = await this.initPromise;
      if (!initialized) {
        throw new Error('Firebase not initialized. Auth service unavailable.');
      }
    } else {
      throw new Error('Firebase not initialized. Auth service unavailable.');
    }
  }

  /**
   * Sign in anonymously - primary auth method for MVP
   */
  async signInAnonymously(): Promise<User> {
    try {
      await this.ensureInitialized();
      const credential = await auth().signInAnonymously();
      const user = this.mapFirebaseUser(credential.user);
      
      // Create user profile if new user
      await this.createUserProfileIfNotExists(user.uid);
      
      return user;
    } catch (error) {
      console.error('Anonymous sign in failed:', error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email: string, password: string): Promise<User> {
    try {
      await this.ensureInitialized();
      const credential = await auth().createUserWithEmailAndPassword(email, password);
      const user = this.mapFirebaseUser(credential.user);
      
      // Create user profile
      await this.createUserProfileIfNotExists(user.uid);
      
      return user;
    } catch (error) {
      console.error('Email sign up failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      await this.ensureInitialized();
      const credential = await auth().signInWithEmailAndPassword(email, password);
      return this.mapFirebaseUser(credential.user);
    } catch (error) {
      console.error('Email sign in failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<User> {
    try {
      await this.ensureInitialized();
      // Google Sign-In requires @react-native-google-signin/google-signin package
      // For now, throw an error indicating it needs to be implemented
      throw new Error('Google Sign-In needs to be configured. Install @react-native-google-signin/google-signin');
    } catch (error) {
      console.error('Google sign in failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with Apple
   */
  async signInWithApple(): Promise<User> {
    try {
      await this.ensureInitialized();
      // Apple Sign-In requires @invertase/react-native-apple-authentication package
      // For now, throw an error indicating it needs to be implemented
      throw new Error('Apple Sign-In needs to be configured. Install @invertase/react-native-apple-authentication');
    } catch (error) {
      console.error('Apple sign in failed:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    try {
      // Note: This is a sync method, so we can't await
      // It will return null if Firebase isn't ready yet
      const authInstance = auth();
      const firebaseUser = authInstance.currentUser;
      if (!firebaseUser) return null;
      return this.mapFirebaseUser(firebaseUser);
    } catch (error) {
      console.warn('Get current user failed:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    try {
      const authInstance = auth();
      return !!authInstance.currentUser;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      await this.ensureInitialized();
      await auth().signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(
    callback: (user: User | null) => void,
  ): () => void {
    // This is a sync method but needs to handle async initialization
    // We'll set up the listener once Firebase is ready
    this.initPromise?.then(initialized => {
      if (initialized) {
        auth().onAuthStateChanged(firebaseUser => {
          const user = firebaseUser ? this.mapFirebaseUser(firebaseUser) : null;
          callback(user);
        });
      } else {
        // Firebase not initialized, call callback with null
        callback(null);
      }
    }).catch(() => {
      callback(null);
    });
    
    try {
      const authInstance = auth();
      if (!authInstance) {
        // Not ready yet, will be handled by promise above
        return () => {};
      }
      return authInstance.onAuthStateChanged(firebaseUser => {
        const user = firebaseUser ? this.mapFirebaseUser(firebaseUser) : null;
        callback(user);
      });
    } catch (error) {
      console.warn('Auth state listener failed - returning no-op:', error);
      // Call callback immediately with null user to stop loading state
      callback(null);
      // Return a no-op unsubscribe function
      return () => {};
    }
  }

  /**
   * Create user profile document if it doesn't exist
   */
  private async createUserProfileIfNotExists(userId: string): Promise<void> {
    const profileRef = firestore().doc(COLLECTIONS.userProfile(userId));
    const doc = await profileRef.get();

    if (!doc.exists) {
      const profile: UserProfile = {
        userId,
        preferredLanguage: 'fr', // Default to French for DRC
        preferredCurrency: 'USD',
        notificationsEnabled: true,
        priceAlertsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await profileRef.set(profile);
      
      // Initialize 2-month free trial subscription for new users
      await this.initializeNewUserSubscription(userId);
    }
  }

  /**
   * Initialize subscription with 2-month free trial for new users
   */
  private async initializeNewUserSubscription(userId: string): Promise<void> {
    const subscriptionRef = firestore().doc(COLLECTIONS.subscription(userId));
    
    // Calculate trial dates (60 days = 2 months)
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 60); // 2 months

    await subscriptionRef.set({
      userId,
      trialScansUsed: 0,
      trialScansLimit: -1, // Unlimited scans during trial
      trialStartDate,
      trialEndDate,
      trialExtended: false,
      monthlyScansUsed: 0,
      isSubscribed: false,
      status: 'trial',
      autoRenew: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ 2-month free trial activated for user ${userId}`);
  }

  /**
   * Map Firebase user to our User type
   */
  private mapFirebaseUser(firebaseUser: FirebaseAuthTypes.User): User {
    return {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      isAnonymous: firebaseUser.isAnonymous,
      email: firebaseUser.email || undefined,
      displayName: firebaseUser.displayName || undefined,
      phoneNumber: firebaseUser.phoneNumber || undefined,
      photoURL: firebaseUser.photoURL || undefined,
      createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
      lastLoginAt: new Date(firebaseUser.metadata.lastSignInTime || Date.now()),
    };
  }
}

export const authService = new AuthService();
