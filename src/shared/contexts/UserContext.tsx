// User Profile Context - Manages user profile data from Firestore
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from './AuthContext';
import {UserProfile} from '@/shared/types';
import {COLLECTIONS} from '@/shared/services/firebase/config';
import {analyticsService} from '@/shared/services';
import {safeToDate} from '@/shared/utils/helpers';

const USER_PROFILE_CACHE_KEY = '@goshopperai_user_profile';

interface UserContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferredLanguage: (language: 'fr' | 'ln' | 'sw') => Promise<void>;
  updatePreferredCurrency: (currency: 'USD' | 'CDF') => Promise<void>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
  togglePriceAlerts: (enabled: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({children}: UserProviderProps) {
  const {user, isAuthenticated} = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load cached profile on mount
  useEffect(() => {
    const loadCachedProfile = async () => {
      try {
        const cached = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
        if (cached) {
          const parsedProfile = JSON.parse(cached);
          // Convert date strings back to Date objects
          parsedProfile.createdAt = new Date(parsedProfile.createdAt);
          parsedProfile.updatedAt = new Date(parsedProfile.updatedAt);
          setProfile(parsedProfile);
        }
      } catch (err) {
        console.error('Failed to load cached profile:', err);
      }
    };

    loadCachedProfile();
  }, []);

  // Fetch profile from Firestore when user is authenticated
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Real-time listener for profile changes
    // Path: artifacts/goshopper/users/{userId}
    const unsubscribe = firestore()
      .doc(COLLECTIONS.userProfile(user.uid))
      .onSnapshot(
        async doc => {
          if (doc.exists) {
            const data = doc.data();
            const userProfile: UserProfile = {
              userId: user.uid,
              preferredLanguage: data?.preferredLanguage || 'fr',
              preferredCurrency: data?.preferredCurrency || 'USD',
              notificationsEnabled: data?.notificationsEnabled ?? true,
              priceAlertsEnabled: data?.priceAlertsEnabled ?? true,
              displayName: data?.displayName || user.displayName,
              email: data?.email || user.email,
              phoneNumber: data?.phoneNumber || user.phoneNumber,
              emailVerified: data?.emailVerified,
              phoneVerified: data?.phoneVerified,
              verified: data?.verified,
              verifiedAt: data?.verifiedAt ? safeToDate(data.verifiedAt) : undefined,
              countryCode: data?.countryCode,
              isInDRC: data?.isInDRC,
              // Profile fields
              name: data?.name,
              surname: data?.surname,
              dateOfBirth: data?.dateOfBirth,
              age: data?.age,
              sex: data?.sex,
              monthlyBudget: data?.monthlyBudget,
              defaultMonthlyBudget: data?.defaultMonthlyBudget,
              defaultCity: data?.defaultCity || data?.city, // Fallback to city if defaultCity is missing
              createdAt: safeToDate(data?.createdAt),
              updatedAt: safeToDate(data?.updatedAt),
              // ML & AI fields
              behaviorProfile: data?.behaviorProfile,
              recommendationPreferences: data?.recommendationPreferences,
              engagementMetrics: data?.engagementMetrics,
            };

            setProfile(userProfile);
            setError(null);

            // Track user properties for analytics
            analyticsService.setUserProperties(userProfile);

            // Cache profile locally
            await AsyncStorage.setItem(
              USER_PROFILE_CACHE_KEY,
              JSON.stringify(userProfile),
            );
          } else {
            // Create default profile if doesn't exist
            await createDefaultProfile(user.uid, user);
          }
          setIsLoading(false);
        },
        err => {
          console.error('Profile fetch error:', err);
          setError('Impossible de charger le profil');
          setIsLoading(false);
        },
      );

    return () => unsubscribe();
  }, [isAuthenticated, user?.uid]);

  // Create default profile for new users
  const createDefaultProfile = async (userId: string, authUser?: typeof user) => {
    try {
      // Check if the user document exists in Firestore first with timeout
      // This prevents creating a profile for a deleted user
      const userDocPromise = firestore()
        .collection('artifacts')
        .doc('goshopper')
        .collection('users')
        .doc(userId)
        .get();
      
      // Add 10 second timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Profile creation timeout')), 10000)
      );
      
      const userDoc = await Promise.race([userDocPromise, timeoutPromise]);
      
      if (!userDoc.exists) {
        console.log('User document does not exist, skipping profile creation');
        return;
      }
      
      // Split displayName into name and surname if available
      let name = '';
      let surname = '';
      if (authUser?.displayName) {
        const nameParts = authUser.displayName.trim().split(' ');
        name = nameParts[0] || '';
        surname = nameParts.slice(1).join(' ') || '';
      }

      // Build profile without undefined values (Firestore doesn't accept undefined)
      const defaultProfile: UserProfile = {
        userId,
        preferredLanguage: 'fr',
        preferredCurrency: 'USD',
        notificationsEnabled: true,
        priceAlertsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Only add fields that have values
      if (authUser?.displayName) defaultProfile.displayName = authUser.displayName;
      if (authUser?.email) defaultProfile.email = authUser.email;
      if (authUser?.phoneNumber) defaultProfile.phoneNumber = authUser.phoneNumber;
      if (name) defaultProfile.name = name;
      if (surname) defaultProfile.surname = surname;

      await firestore()
        .doc(COLLECTIONS.userProfile(userId))
        .set({
          ...defaultProfile,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      setProfile(defaultProfile);
      await AsyncStorage.setItem(
        USER_PROFILE_CACHE_KEY,
        JSON.stringify(defaultProfile),
      );
    } catch (err) {
      console.error('Failed to create default profile:', err);
      setError('Impossible de créer le profil');
    }
  };

  // Update profile in Firestore
  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user?.uid) {
        throw new Error('Utilisateur non connecté');
      }

      try {
        await firestore()
          .doc(COLLECTIONS.userProfile(user.uid))
          .update({
            ...updates,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });

        // Update local state immediately for responsiveness
        setProfile(prev =>
          prev
            ? {
                ...prev,
                ...updates,
                updatedAt: new Date(),
              }
            : null,
        );
      } catch (err) {
        console.error('Profile update failed:', err);
        throw new Error('Échec de la mise à jour du profil');
      }
    },
    [user?.uid],
  );

  // Convenience methods for common updates
  const updatePreferredLanguage = useCallback(
    async (language: 'fr' | 'ln' | 'sw') => {
      await updateProfile({preferredLanguage: language});
    },
    [updateProfile],
  );

  const updatePreferredCurrency = useCallback(
    async (currency: 'USD' | 'CDF') => {
      await updateProfile({preferredCurrency: currency});
    },
    [updateProfile],
  );

  const toggleNotifications = useCallback(
    async (enabled: boolean) => {
      await updateProfile({notificationsEnabled: enabled});
    },
    [updateProfile],
  );

  const togglePriceAlerts = useCallback(
    async (enabled: boolean) => {
      await updateProfile({priceAlertsEnabled: enabled});
    },
    [updateProfile],
  );

  const refreshProfile = useCallback(async () => {
    if (!user?.uid) {
      return;
    }

    setIsLoading(true);
    try {
      const doc = await firestore()
        .doc(COLLECTIONS.userProfile(user.uid))
        .get();

      if (doc.exists) {
        const data = doc.data();
        const userProfile: UserProfile = {
          userId: user.uid,
          preferredLanguage: data?.preferredLanguage || 'fr',
          preferredCurrency: data?.preferredCurrency || 'USD',
          notificationsEnabled: data?.notificationsEnabled ?? true,
          priceAlertsEnabled: data?.priceAlertsEnabled ?? true,
          displayName: data?.displayName,
          phoneNumber: data?.phoneNumber,
          emailVerified: data?.emailVerified,
          phoneVerified: data?.phoneVerified,
          verified: data?.verified,
          verifiedAt: data?.verifiedAt ? safeToDate(data.verifiedAt) : undefined,
          countryCode: data?.countryCode,
          isInDRC: data?.isInDRC,
          // Profile fields
          name: data?.name,
          surname: data?.surname,
          dateOfBirth: data?.dateOfBirth,
          age: data?.age,
          sex: data?.sex,
          monthlyBudget: data?.monthlyBudget,
          defaultMonthlyBudget: data?.defaultMonthlyBudget,
          defaultCity: data?.defaultCity || data?.city, // Fallback to city if defaultCity is missing
          createdAt: safeToDate(data?.createdAt),
          updatedAt: safeToDate(data?.updatedAt),
          // ML & AI fields
          behaviorProfile: data?.behaviorProfile,
          recommendationPreferences: data?.recommendationPreferences,
          engagementMetrics: data?.engagementMetrics,
        };

        setProfile(userProfile);
        await AsyncStorage.setItem(
          USER_PROFILE_CACHE_KEY,
          JSON.stringify(userProfile),
        );
      }
    } catch (err) {
      console.error('Profile refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  // Clear profile cache on sign out
  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY);
    }
  }, [isAuthenticated]);

  return (
    <UserContext.Provider
      value={{
        profile,
        isLoading,
        error,
        updateProfile,
        updatePreferredLanguage,
        updatePreferredCurrency,
        toggleNotifications,
        togglePriceAlerts,
        refreshProfile,
      }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
