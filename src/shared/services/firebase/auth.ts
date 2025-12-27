// Authentication Service
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import firebase from '@react-native-firebase/app';
import functions from '@react-native-firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {appleAuth} from '@invertase/react-native-apple-authentication';
import {LoginManager, AccessToken, Settings} from 'react-native-fbsdk-next';
import {User, UserProfile} from '@/shared/types';
import {COLLECTIONS, APP_ID} from './config';
import {safeToDate} from '@/shared/utils/helpers';
import {biometricService} from '../biometric';

const PHONE_USER_KEY = '@goshopperai_phone_user';

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
   * Sign up with phone number - returns verification object
   */
  async signUpWithPhoneNumber(phoneNumber: string, email?: string): Promise<{verificationId: string}> {
    try {
      await this.ensureInitialized();
      
      console.log('📱 [SMS OTP] Initiating phone verification for:', phoneNumber);
      console.log('📱 [SMS OTP] Starting Firebase Phone Authentication...');
      
      // For development/testing, we can use Firebase's automatic verification
      // In production, Firebase will send actual SMS
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber, true); // auto-verify in dev
      
      console.log('✅ [SMS OTP] Verification initiated successfully');
      console.log('📱 [SMS OTP] Verification ID:', confirmation.verificationId);
      console.log('📱 [SMS OTP] In production, SMS would be sent to:', phoneNumber);
      console.log('📱 [SMS OTP] Development mode: Auto-verification enabled');
      
      // Store email temporarily for later use
      if (email) {
        await this.storeTemporaryEmail(phoneNumber, email);
      }
      
      return { verificationId: confirmation.verificationId || '' };
    } catch (error) {
      console.error('❌ [SMS OTP] Phone verification failed:', error);
      throw error;
    }
  }

  /**
   * Confirm phone verification and complete registration
   */
  async confirmPhoneVerification(verificationId: string, code: string, password: string, email?: string): Promise<User> {
    try {
      await this.ensureInitialized();
      
      console.log('🔑 [SMS OTP] Verifying OTP code...');
      console.log('🔑 [SMS OTP] Verification ID:', verificationId);
      console.log('🔑 [SMS OTP] Code entered:', code);
      
      const credential = auth.PhoneAuthProvider.credential(verificationId, code);
      const userCredential = await auth().signInWithCredential(credential);
      
      console.log('✅ [SMS OTP] Phone number verified successfully!');
      console.log('👤 [SMS OTP] User ID:', userCredential.user.uid);
      console.log('📱 [SMS OTP] Phone:', userCredential.user.phoneNumber);
      
      // Store password and email in user profile
      const user = this.mapFirebaseUser(userCredential.user);
      await this.createUserProfileWithPhoneAuth(user.uid, password, email);
      
      console.log('✅ [SMS OTP] User profile created successfully');
      
      return user;
    } catch (error) {
      console.error('❌ [SMS OTP] Phone verification confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with phone number and password
   */
  async signInWithPhone(phoneNumber: string, password: string): Promise<User> {
    try {
      await this.ensureInitialized();
      
      console.log('🔐 [Phone Login] Attempting login for:', phoneNumber);
      
      // First, find user by phone number in Firestore
      const userProfile = await this.getUserProfileByPhone(phoneNumber);
      if (!userProfile) {
        console.error('❌ [Phone Login] No account found for phone:', phoneNumber);
        throw new Error('Aucun compte trouvé avec ce numéro');
      }
      
      console.log('✅ [Phone Login] User found:', userProfile.userId);
      
      // Verify password
      if (!await this.verifyPassword(userProfile.userId, password)) {
        console.error('❌ [Phone Login] Invalid password for user:', userProfile.userId);
        throw new Error('Mot de passe incorrect');
      }
      
      console.log('✅ [Phone Login] Password verified');
      
      // Get Firebase Custom Token for this phone user
      // This is REQUIRED for scanning to work
      console.log('🔑 [Phone Login] Getting Firebase custom token...');
      const functionsInstance = functions().httpsCallable('getPhoneAuthToken');
      const tokenResult = await functionsInstance({
        userId: userProfile.userId,
        phoneNumber: phoneNumber,
      });
      
      const responseData = tokenResult.data as {customToken?: string; success?: boolean};
      console.log('🔑 [Phone Login] Token response:', JSON.stringify(responseData));
      
      if (responseData.customToken) {
        // Sign in with custom token to Firebase Auth
        await auth().signInWithCustomToken(responseData.customToken);
        console.log('✅ [Phone Login] Signed in to Firebase Auth with custom token');
        console.log('✅ [Phone Login] Current user UID:', auth().currentUser?.uid);
      } else {
        console.error('❌ [Phone Login] No custom token in response:', tokenResult);
        throw new Error('Impossible d\'obtenir le token d\'authentification');
      }
      
      // Update last login timestamp
      try {
        await firestore()
          .collection('artifacts')
          .doc(APP_ID)
          .collection('users')
          .doc(userProfile.userId)
          .update({
            lastLoginAt: firestore.FieldValue.serverTimestamp(),
          });
      } catch (updateError) {
        console.warn('Could not update lastLoginAt:', updateError);
      }
      
      console.log('✅ [Phone Login] Login successful');
      
      // Return user data from Firestore
      const user: User = {
        id: userProfile.userId,
        uid: userProfile.userId,
        phoneNumber: userProfile.phoneNumber || phoneNumber,
        displayName: userProfile.displayName || userProfile.phoneNumber || phoneNumber,
        email: userProfile.email,
        isAnonymous: false,
        createdAt: userProfile.createdAt instanceof Date ? userProfile.createdAt : new Date(),
        lastLoginAt: new Date(),
      };
      
      // Store user session for persistence
      await this.storePhoneUser(user);
      
      return user;
    } catch (error) {
      console.error('❌ [Phone Login] Sign in failed:', error);
      throw error;
    }
  }

  /**
   * Resend OTP code
   */
  async resendOTP(phoneNumber: string): Promise<{verificationId: string}> {
    try {
      await this.ensureInitialized();
      
      console.log('🔄 [SMS OTP] Resending verification code to:', phoneNumber);
      
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber, true);
      
      console.log('✅ [SMS OTP] Verification code resent successfully');
      console.log('📱 [SMS OTP] New Verification ID:', confirmation.verificationId);
      console.log('📱 [SMS OTP] In production, new SMS sent to:', phoneNumber);
      
      return { verificationId: confirmation.verificationId || '' };
    } catch (error) {
      console.error('❌ [SMS OTP] Failed to resend code:', error);
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
   * Sign in with Facebook
   */
  async signInWithFacebook(): Promise<User> {
    try {
      await this.ensureInitialized();

      // Log out any previous Facebook session first
      LoginManager.logOut();

      // Attempt login with permissions using web-based login
      // This forces the use of CustomTabs/WebView instead of Facebook App
      const result = await LoginManager.logInWithPermissions(
        ['public_profile', 'email']
      );

      if (result.isCancelled) {
        throw new Error('User cancelled the login process');
      }

      // Once signed in, get the users AccessToken
      const data = await AccessToken.getCurrentAccessToken();

      if (!data) {
        throw new Error('Something went wrong obtaining access token');
      }

      // Create a Firebase credential with the AccessToken
      const facebookCredential = auth.FacebookAuthProvider.credential(data.accessToken);

      // Sign-in the user with the credential
      const credential = await auth().signInWithCredential(facebookCredential);

      // Map Firebase user to our User type
      const user = this.mapFirebaseUser(credential.user);

      return user;
    } catch (error) {
      console.error('Facebook sign in failed:', error);
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
      // Only sign out from Firebase Auth if there's a current user
      const currentUser = auth().currentUser;
      if (currentUser) {
        await auth().signOut();
      }
      // Clear phone user session from AsyncStorage
      await this.clearPhoneUser();
      console.log('✅ Sign out successful');
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
        verifiedAt: data?.verifiedAt ? safeToDate(data.verifiedAt) : undefined,
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
        createdAt: safeToDate(data?.createdAt) || new Date(),
        updatedAt: safeToDate(data?.updatedAt) || new Date(),
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
   * Get stored phone user session and restore Firebase Auth
   */
  async getStoredPhoneUser(): Promise<User | null> {
    try {
      const stored = await AsyncStorage.getItem(PHONE_USER_KEY);
      if (stored) {
        const user = JSON.parse(stored) as User;
        
        // Try to restore Firebase Auth session for phone user
        if (user.uid && user.phoneNumber) {
          try {
            // Check if already signed in to Firebase Auth
            const currentFirebaseUser = auth().currentUser;
            if (!currentFirebaseUser || currentFirebaseUser.uid !== user.uid) {
              console.log('🔑 [Session] Restoring Firebase Auth for phone user...');
              const functionsInstance = functions().httpsCallable('getPhoneAuthToken');
              const tokenResult = await functionsInstance({
                userId: user.uid,
                phoneNumber: user.phoneNumber,
              });
              
              const {customToken} = tokenResult.data as {customToken: string; success: boolean};
              
              if (customToken) {
                await auth().signInWithCustomToken(customToken);
                console.log('✅ [Session] Firebase Auth restored for phone user');
              }
            }
          } catch (tokenError) {
            console.warn('⚠️ [Session] Could not restore Firebase Auth:', tokenError);
            // Continue anyway - user can still use basic app features
          }
        }
        
        return user;
      }
    } catch (error) {
      console.error('Error getting stored phone user:', error);
    }
    return null;
  }

  /**
   * Store phone user session
   */
  private async storePhoneUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(PHONE_USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error storing phone user:', error);
    }
  }

  /**
   * Clear phone user session
   */
  private async clearPhoneUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PHONE_USER_KEY);
    } catch (error) {
      console.error('Error clearing phone user:', error);
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
      trialScansLimit: 50, // Limited scans during trial
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
   * Store temporary email for phone registration
   */
  private async storeTemporaryEmail(phoneNumber: string, email: string): Promise<void> {
    // Store in a temporary collection or local storage
    // This is a simplified implementation
    console.log(`Temporarily storing email ${email} for phone ${phoneNumber}`);
  }

  /**
   * Create user profile for phone authentication
   */
  private async createUserProfileWithPhoneAuth(userId: string, password: string, email?: string): Promise<void> {
    const profileRef = firestore().doc(COLLECTIONS.userProfile(userId));
    
    const profile: UserProfile = {
      userId,
      phoneNumber: auth().currentUser?.phoneNumber || undefined,
      email: email || undefined,
      preferredLanguage: 'fr',
      preferredCurrency: 'USD', 
      notificationsEnabled: true,
      priceAlertsEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await profileRef.set(profile);
    
    // Store password hash (implement proper password hashing)
    await this.storePasswordHash(userId, password);
    
    // Initialize subscription
    await this.initializeNewUserSubscription(userId);
  }

  /**
   * Get user profile by phone number
   */
  private async getUserProfileByPhone(phoneNumber: string): Promise<UserProfile | null> {
    // First check the main users collection (where phone-registered users are stored)
    const usersRef = firestore()
      .collection('artifacts')
      .doc(APP_ID)
      .collection('users');
    const usersQuery = await usersRef.where('phoneNumber', '==', phoneNumber).limit(1).get();
    
    if (!usersQuery.empty) {
      const userData = usersQuery.docs[0].data();
      return {
        userId: usersQuery.docs[0].id,
        phoneNumber: userData.phoneNumber,
        ...userData,
      } as UserProfile;
    }
    
    // Fallback: check legacy userProfiles collection
    const profilesRef = firestore().collection('userProfiles');
    const query = await profilesRef.where('phoneNumber', '==', phoneNumber).limit(1).get();
    
    if (query.empty) {
      return null;
    }
    
    return query.docs[0].data() as UserProfile;
  }

  /**
   * Store password hash (implement proper password hashing in production)
   */
  private async storePasswordHash(userId: string, password: string): Promise<void> {
    // In production, use proper password hashing like bcrypt
    const passwordRef = firestore().doc(`passwords/${userId}`);
    await passwordRef.set({
      passwordHash: password, // This should be properly hashed
      updatedAt: new Date(),
    });
  }

  /**
   * Verify password (implement proper password verification in production)
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    // In production, use proper password verification
    try {
      // First check if password is stored in the user document itself (new format)
      const userRef = firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(userId);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.passwordHash) {
          return userData.passwordHash === password; // This should use proper password comparison
        }
      }
      
      // Fallback: check legacy passwords collection
      const passwordRef = firestore().doc(`passwords/${userId}`);
      const doc = await passwordRef.get();
      
      if (!doc.exists) {
        return false;
      }
      
      const storedPassword = doc.data()?.passwordHash;
      return storedPassword === password; // This should use proper password comparison
    } catch (error) {
      console.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Delete user account (works for both Firebase Auth and phone users)
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    try {
      const currentAuthUser = auth().currentUser;
      
      // First verify password for phone users
      const phoneUser = await this.getStoredPhoneUser();
      const isPhoneUser = phoneUser && phoneUser.uid === userId;
      
      if (isPhoneUser) {
        // Phone-based user - verify password first
        const isValid = await this.verifyPassword(userId, password);
        if (!isValid) {
          throw new Error('Invalid password');
        }
        console.log('✅ Password verified for phone user');
      }
      
      // Check if this is a Firebase Auth user with email (Google/Apple/Facebook login)
      if (currentAuthUser && currentAuthUser.uid === userId) {
        if (currentAuthUser.email && !isPhoneUser) {
          // Email-based user - need to reauthenticate with email credential
          const credential = auth.EmailAuthProvider.credential(
            currentAuthUser.email,
            password
          );
          await currentAuthUser.reauthenticateWithCredential(credential);
        }
        
        // Delete Firebase Auth account (for both email and phone users)
        try {
          await currentAuthUser.delete();
          console.log('✅ Firebase Auth account deleted');
        } catch (deleteError: any) {
          // If requires-recent-login for phone user, we can proceed since we verified password
          if (deleteError.code === 'auth/requires-recent-login' && isPhoneUser) {
            console.log('⚠️ Requires recent login, but password verified - proceeding with Firestore cleanup');
            // For phone users, we'll just sign out from Firebase Auth
            // The important data deletion is in Firestore
          } else {
            throw deleteError;
          }
        }
      }
      
      // Delete user document from Firestore (artifacts collection)
      await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(userId)
        .delete();
      console.log('✅ User document deleted from Firestore');
      
      // Delete subscription document
      await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('subscriptions')
        .doc(userId)
        .delete();
      console.log('✅ Subscription document deleted');
      
      // Delete user profile if exists
      try {
        await firestore()
          .collection('userProfiles')
          .doc(userId)
          .delete();
      } catch (e) {
        // Profile might not exist, that's OK
      }
      
      // Delete password document if exists
      try {
        await firestore()
          .collection('passwords')
          .doc(userId)
          .delete();
      } catch (e) {
        // Password doc might not exist, that's OK
      }
      
      // Clear biometric data
      await biometricService.clearAllData();
      
      // Clear phone user session
      await this.clearPhoneUser();
      
      console.log('✅ Account deleted successfully');
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  /**
   * Create user with phone number registration data
   */
  async createUserWithPhone(registrationData: {
    phoneNumber: string;
    password: string;
    city: string;
    countryCode: string;
  }): Promise<User> {
    try {
      const {phoneNumber, password, city, countryCode} = registrationData;
      
      console.log('📱 Creating user with phone:', {phoneNumber, city, countryCode});
      
      // Create a user document with phone number as the primary identifier
      const userId = firestore().collection('users').doc().id; // Generate unique ID
      
      const userData = {
        phoneNumber,
        city, // Required for Firestore rules
        defaultCity: city,
        countryCode,
        passwordHash: password, // In production, hash this properly
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastLoginAt: firestore.FieldValue.serverTimestamp(),
        isAnonymous: false,
        // Include behavior profile data during creation
        behaviorProfile: {
          profileVersion: 1,
          lastProfileUpdate: firestore.FieldValue.serverTimestamp(),
          dataQualityScore: 0,
        },
        recommendationPreferences: {
          enablePersonalizedRecommendations: true,
          enablePriceAlertRecommendations: true,
          enableBundleRecommendations: true,
          enableSeasonalRecommendations: true,
          recommendationStyle: 'balanced',
          maxRecommendationsPerDay: 5,
        },
        engagementMetrics: {
          totalSessions: 0,
          scansCount: 0,
          itemViewsCount: 0,
          alertsCreatedCount: 0,
          shoppingListsCreatedCount: 0,
          daysActive: 0,
          consecutiveDaysActive: 0,
        },
      };
      
      // Create user document in the main users collection
      await firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(userId)
        .set(userData);
      
      console.log('✅ User document created with phone number:', phoneNumber);
      
      // Create a mock Firebase user for consistency
      const user: User = {
        id: userId,
        uid: userId,
        phoneNumber,
        displayName: phoneNumber,
        isAnonymous: false,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };
      
      // Get Firebase Custom Token for this new phone user
      // This is REQUIRED for scanning to work
      console.log('🔑 [Registration] Getting Firebase custom token...');
      
      // Small delay to ensure Firestore document is fully written
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const functionsInstance = functions().httpsCallable('getPhoneAuthToken');
      const tokenResult = await functionsInstance({
        userId: userId,
        phoneNumber: phoneNumber,
      });
      
      const responseData = tokenResult.data as {customToken?: string; success?: boolean};
      console.log('🔑 [Registration] Token response received:', responseData.success);
      
      if (responseData.customToken) {
        // Sign in with custom token to Firebase Auth
        await auth().signInWithCustomToken(responseData.customToken);
        console.log('✅ [Registration] Signed in to Firebase Auth with custom token');
        console.log('✅ [Registration] Current user UID:', auth().currentUser?.uid);
      } else {
        console.error('❌ [Registration] No custom token in response');
        throw new Error('Impossible d\'obtenir le token d\'authentification');
      }
      
      // DON'T store phone user here - let RegisterScreen handle it
      // after the biometric modal is shown/dismissed
      // await this.storePhoneUser(user);
      
      console.log('✅ User created successfully:', user.id);
      return user;
      
    } catch (error: any) {
      console.error('❌ Create user with phone failed:', error);
      throw new Error(error.message || 'Failed to create account');
    }
  }

  /**
   * Complete registration and mark user as verified
   */
  async completeRegistration(data: {
    userId: string;
    verificationToken: string;
    phoneNumber: string;
    countryCode: string;
    displayName?: string;
  }): Promise<void> {
    try {
      const {userId, phoneNumber, countryCode, displayName} = data;
      
      console.log('📝 Completing registration:', {userId, phoneNumber, countryCode, displayName});
      
      // Update user profile with verified status
      const profileRef = firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(userId);
      
      const updateData = {
        verified: true,
        verifiedAt: firestore.FieldValue.serverTimestamp(),
        phoneVerified: true,
        phoneNumber,
        countryCode,
        isInDRC: countryCode === 'CD',
        displayName: displayName || phoneNumber,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      
      await profileRef.set(updateData, {merge: true});
      
      console.log('✅ User registration completed and verified:', {userId, phoneNumber, countryCode});
    } catch (error: any) {
      console.error('❌ Complete registration failed:', error);
      throw new Error(error.message || 'Failed to complete registration');
    }
  }

  /**
   * Verify phone number for existing user
   */
  async verifyUserPhone(userId: string, phoneNumber: string, countryCode?: string): Promise<void> {
    try {
      console.log('📞 Verifying phone for user:', {userId, phoneNumber, countryCode});
      
      // Update user profile with verified phone status
      const profileRef = firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users')
        .doc(userId);
      
      const updateData: any = {
        phoneVerified: true,
        verifiedAt: firestore.FieldValue.serverTimestamp(),
        phoneNumber,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      
      // Extract and save country code if provided in phone number
      if (countryCode) {
        updateData.countryCode = countryCode;
        updateData.isInDRC = countryCode === 'CD' || countryCode === '+243';
      } else if (phoneNumber.startsWith('+243') || phoneNumber.startsWith('243')) {
        updateData.countryCode = 'CD';
        updateData.isInDRC = true;
      }
      
      await profileRef.set(updateData, {merge: true});
      
      console.log('✅ User phone verified and saved:', {userId, phoneNumber, countryCode: updateData.countryCode});
    } catch (error: any) {
      console.error('❌ Phone verification failed:', error);
      throw new Error(error.message || 'Failed to verify phone number');
    }
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
