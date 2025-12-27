// Authentication Context
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
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

  // Listen to auth state changes
  useEffect(() => {
    try {
      const unsubscribe = authService.onAuthStateChanged(user => {

        // Track user authentication state
        if (user) {
          analyticsService.setUserId(user.uid);
          // Preload critical data for better performance
          cachePreloader.preloadCriticalData(user.uid).catch(error => {
            console.warn('Cache preload failed:', error);
          });
        } else {
          // Reset cache on logout
          cachePreloader.reset();
        }

        setState({
          user,
          isLoading: false,
          isAuthenticated: !!user,
          error: null,
        });
      });

      return unsubscribe;
    } catch (error) {
      console.warn('Auth state listener setup failed:', error);
      // Set to not loading, not authenticated
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Firebase not initialized',
      });
      return () => {};
    }
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
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Échec de la déconnexion',
      }));
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

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithGoogle,
        signInWithApple,
        signInWithFacebook,
        signOut,
        setPhoneUser,
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
