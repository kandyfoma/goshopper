// Authentication Context
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {User, AuthState} from '@/shared/types';
import {authService} from '@/shared/services/firebase';
import {analyticsService} from '@/shared/services';
import {cachePreloader} from '@/shared/services/caching';

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<User | null>;
  signInWithApple: () => Promise<User | null>;
  signInWithFacebook: () => Promise<User | null>;
  signOut: () => Promise<void>;
  setPhoneUser: (user: User) => void;
  suppressAuthListener: () => void;
  enableAuthListener: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({children}: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });
  
  // Ref to suppress Firebase Auth listener during phone registration
  const suppressListenerRef = useRef(false);

  // Listen to auth state changes
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // First, try to restore phone user session from AsyncStorage
        const phoneUser = await authService.getStoredPhoneUser();
        
        if (phoneUser && mounted) {
          // Phone user session found - restore it
          setState({
            user: phoneUser,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });
          
          analyticsService.setUserId(phoneUser.uid);
          cachePreloader.preloadCriticalData(phoneUser.uid).catch(error => {
            console.warn('Cache preload failed:', error);
          });
        }

        // Then, set up Firebase Auth listener (for Google/Apple/Facebook)
        const unsubscribe = authService.onAuthStateChanged(user => {
          if (!mounted) return;
          
          console.log('🔔 Auth listener fired - user:', user?.uid || 'null');
          console.log('🔔 suppressListenerRef:', suppressListenerRef.current);
          console.log('🔔 phoneUser:', phoneUser?.uid || 'null');
          
          // Skip if listener is suppressed (during phone registration)
          if (suppressListenerRef.current) {
            console.log('🔇 Auth listener suppressed, skipping state update');
            return;
          }

          // Track user authentication state
          if (user) {
            analyticsService.setUserId(user.uid);
            // Preload critical data for better performance
            cachePreloader.preloadCriticalData(user.uid).catch(error => {
              console.warn('Cache preload failed:', error);
            });
          } else if (!phoneUser) {
            // Only reset cache if there's no phone user either
            cachePreloader.reset();
          }

          // Only update state if no phone user was already restored
          if (!phoneUser) {
            console.log('🔔 Updating state with Firebase Auth user');
            setState({
              user,
              isLoading: false,
              isAuthenticated: !!user,
              error: null,
            });
          } else {
            console.log('🔔 Skipping state update - phoneUser already exists');
          }
        });

        return unsubscribe;
      } catch (error) {
        console.warn('Auth initialization failed:', error);
        if (mounted) {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: 'Failed to restore session',
          });
        }
        return () => {};
      }
    };

    const unsubscribePromise = initAuth();

    return () => {
      mounted = false;
      // Wait for the promise to resolve, then call unsubscribe
      unsubscribePromise.then(unsub => {
        if (unsub && typeof unsub === 'function') {
          try {
            unsub();
          } catch (error) {
            console.warn('Error unsubscribing from auth:', error);
          }
        }
      }).catch(error => {
        console.warn('Error in cleanup:', error);
      });
    };
  }, []);

  // Removed auto sign-in - users must now register/login explicitly

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setState(prev => ({...prev, isLoading: true, error: null}));
    try {
      const user = await authService.signInWithGoogle();
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });

      // Track sign in event
      analyticsService.logLogin('google');
      
      // Mark onboarding as completed for social login users to prevent redirect loop
      try {
        await AsyncStorage.setItem('@goshopperai_onboarding_complete', 'completed');
        console.log('✅ Onboarding marked as complete for Google sign-in user');
      } catch (storageError) {
        console.warn('Failed to save onboarding status:', storageError);
      }
      
      return user;
    } catch (err: any) {
      const errorMessage = err?.message || 'Échec de la connexion Google';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw err; // Re-throw so the caller can handle it
    }
  }, []);

  const signInWithApple = useCallback(async (): Promise<User | null> => {
    setState(prev => ({...prev, isLoading: true, error: null}));
    try {
      const user = await authService.signInWithApple();
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });

      // Track sign in event
      analyticsService.logLogin('apple');
      
      // Mark onboarding as completed for social login users to prevent redirect loop
      try {
        await AsyncStorage.setItem('@goshopperai_onboarding_complete', 'completed');
        console.log('✅ Onboarding marked as complete for Apple sign-in user');
      } catch (storageError) {
        console.warn('Failed to save onboarding status:', storageError);
      }
      
      return user;
    } catch (err: any) {
      const errorMessage = err?.message || 'Échec de la connexion Apple';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw err; // Re-throw so the caller can handle it
    }
  }, []);

  const signInWithFacebook = useCallback(async (): Promise<User | null> => {
    setState(prev => ({...prev, isLoading: true, error: null}));
    try {
      const user = await authService.signInWithFacebook();
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });

      // Track sign in event
      analyticsService.logLogin('facebook');
      
      // Mark onboarding as completed for social login users to prevent redirect loop
      try {
        await AsyncStorage.setItem('@goshopperai_onboarding_complete', 'completed');
        console.log('✅ Onboarding marked as complete for Facebook sign-in user');
      } catch (storageError) {
        console.warn('Failed to save onboarding status:', storageError);
      }
      
      return user;
    } catch (err: any) {
      const errorMessage = err?.message || 'Échec de la connexion Facebook';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw err; // Re-throw so the caller can handle it
    }
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({...prev, isLoading: true}));
    try {
      await authService.signOut();
    } catch (error) {
      // Log but don't throw - we still want to clear local state
      console.warn('Auth service sign out warning:', error);
    } finally {
      // Always clear local state regardless of Firebase Auth result
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    }
  }, []);

  // Set user after phone registration (since Firebase Auth is not used)
  const setPhoneUser = useCallback((user: User) => {
    setState({
      user,
      isLoading: false,
      isAuthenticated: true,
      error: null,
    });
    
    // Track user authentication state
    analyticsService.setUserId(user.uid);
    analyticsService.logLogin('phone');
    
    // Preload critical data for better performance
    cachePreloader.preloadCriticalData(user.uid).catch(error => {
      console.warn('Cache preload failed:', error);
    });
  }, []);

  // Suppress Firebase Auth listener (during phone registration to show biometric modal)
  const suppressAuthListener = useCallback(() => {
    console.log('🔇 Suppressing auth listener');
    suppressListenerRef.current = true;
  }, []);

  // Re-enable Firebase Auth listener
  const enableAuthListener = useCallback(() => {
    console.log('🔊 Enabling auth listener');
    suppressListenerRef.current = false;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithGoogle,
        signInWithApple,
        signInWithFacebook,
        signOut,
        setPhoneUser,
        suppressAuthListener,
        enableAuthListener,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
