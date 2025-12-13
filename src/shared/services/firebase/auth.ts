// Authentication Service
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import firebase from '@react-native-firebase/app';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {appleAuth} from '@invertase/react-native-apple-authentication';
import {User, UserProfile} from '@/shared/types';
import {COLLECTIONS, APP_ID} from './config';

class AuthService {
  private currentUser: FirebaseAuthTypes.User | null = null;
  private initPromise: Promise<boolean> | null = null;

  constructor() {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId:
        '889807854788-snap5tikvb7f50jp67h62f3g7iukbgr0.apps.googleusercontent.com',
      offlineAccess: true,
    });

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

      console.warn(
        'Firebase not initialized after 5 seconds - auth service unavailable',
      );
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
      const credential = await auth().createUserWithEmailAndPassword(
        email,
        password,
      );
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
      const credential = await auth().signInWithEmailAndPassword(
        email,
        password,
      );
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

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

      // Sign in with Google - v16+ returns { data: { idToken, user } }
      const response = await GoogleSignin.signIn();

      // Extract idToken from the response (v16+ structure)
      const idToken = response.data?.idToken;
      const googleUser = response.data?.user;

      if (!idToken) {
        throw new Error('Google Sign-In failed - no ID token returned');
      }

      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign-in the user with the credential
      const credential = await auth().signInWithCredential(googleCredential);

      // Extract additional user data from Google response
      const user = this.mapFirebaseUser(credential.user);

      // If we have Google user data, update the user profile with full name
      if (googleUser && (googleUser.givenName || googleUser.familyName)) {
        const fullName = [googleUser.givenName, googleUser.familyName]
          .filter(Boolean)
          .join(' ');

        if (fullName && fullName !== user.displayName) {
          // Update Firebase Auth profile with full name
          await credential.user.updateProfile({
            displayName: fullName,
          });

          // Update our user object
          user.displayName = fullName;
        }
      }

      return user;
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

      // Start the sign-in request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // Ensure Apple returned a user identityToken
      if (!appleAuthRequestResponse.identityToken) {
        throw new Error('Apple Sign-In failed - no identify token returned');
      }

      // Extract full name from Apple response
      const {identityToken, nonce, fullName} = appleAuthRequestResponse;

      // Create a Firebase credential from the response
      const appleCredential = auth.AppleAuthProvider.credential(
        identityToken,
        nonce,
      );

      // Sign the user in with the credential
      const credential = await auth().signInWithCredential(appleCredential);

      // Extract additional user data from Apple response
      const user = this.mapFirebaseUser(credential.user);

      // If we have Apple full name data, update the user profile
      if (fullName && (fullName.givenName || fullName.familyName)) {
        const displayName = [fullName.givenName, fullName.familyName]
          .filter(Boolean)
          .join(' ');

        if (displayName && displayName !== user.displayName) {
          // Update Firebase Auth profile with full name
          await credential.user.updateProfile({
            displayName: displayName,
          });

          // Update our user object
          user.displayName = displayName;
        }
      }

      return user;
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
      if (!firebaseUser) {
        return null;
      }
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
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await this.ensureInitialized();
      await auth().sendPasswordResetEmail(email);
    } catch (error) {
      console.error('Password reset email failed:', error);
      throw error;
    }
  }

  /**
   * Confirm password reset with code from email
   */
  async confirmPasswordReset(
    oobCode: string,
    newPassword: string,
  ): Promise<void> {
    try {
      await this.ensureInitialized();
      await auth().confirmPasswordReset(oobCode, newPassword);
    } catch (error) {
      console.error('Confirm password reset failed:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const profileRef = firestore().doc(COLLECTIONS.userProfile(userId));
      const doc = await profileRef.get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return {
        userId,
        displayName: data?.displayName,
        firstName: data?.firstName,
        surname: data?.surname,
        email: data?.email,
        emailVerified: data?.emailVerified,
        phoneNumber: data?.phoneNumber,
        phoneVerified: data?.phoneVerified,
        countryCode: data?.countryCode,
        isInDRC: data?.isInDRC,
        verified: data?.verified,
        verifiedAt: data?.verifiedAt?.toDate(),
        preferredLanguage: data?.preferredLanguage || 'fr',
        preferredCurrency: data?.preferredCurrency || 'USD',
        defaultCity: data?.defaultCity,
        profileCompleted: data?.profileCompleted,
        name: data?.name,
        age: data?.age,
        sex: data?.sex,
        monthlyBudget: data?.monthlyBudget,
        notificationsEnabled: data?.notificationsEnabled ?? true,
        priceAlertsEnabled: data?.priceAlertsEnabled ?? true,
        createdAt: data?.createdAt?.toDate() || new Date(),
        updatedAt: data?.updatedAt?.toDate() || new Date(),
      } as UserProfile;
    } catch (error) {
      console.error('Get user profile failed:', error);
      return null;
    }
  }

  /**
   * Update user password (requires recent authentication)
   */
  async updatePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      await this.ensureInitialized();
      const user = auth().currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user with current password
      const credential = auth.EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await user.reauthenticateWithCredential(credential);

      // Update password
      await user.updatePassword(newPassword);
    } catch (error) {
      console.error('Update password failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    let unsubscribe: (() => void) | null = null;

    try {
      // Try to set up the listener directly
      const authInstance = auth();

      unsubscribe = authInstance.onAuthStateChanged(firebaseUser => {
        console.log('🔄 Auth state changed:', firebaseUser?.uid || 'null');
        const user = firebaseUser ? this.mapFirebaseUser(firebaseUser) : null;
        callback(user);
      });

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } catch (error) {
      console.warn('Auth state listener setup failed:', error);
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
