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
    // Path: artifacts/goshopperai/users/{userId}
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
              displayName: data?.displayName,
              phoneNumber: data?.phoneNumber,
              // New profile fields
              name: data?.name,
              surname: data?.surname,
              age: data?.age,
              sex: data?.sex,
              monthlyBudget: data?.monthlyBudget,
              defaultCity: data?.defaultCity,
              createdAt: data?.createdAt?.toDate() || new Date(),
              updatedAt: data?.updatedAt?.toDate() || new Date(),
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
            await createDefaultProfile(user.uid);
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
  const createDefaultProfile = async (userId: string) => {
    try {
      const defaultProfile: UserProfile = {
        userId,
        preferredLanguage: 'fr',
        preferredCurrency: 'USD',
        notificationsEnabled: true,
        priceAlertsEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

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
    if (!user?.uid) return;

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
          createdAt: data?.createdAt?.toDate() || new Date(),
          updatedAt: data?.updatedAt?.toDate() || new Date(),
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
