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

interface AuthContextType extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
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
    console.log('🔌 Setting up auth state listener...');
    try {
      const unsubscribe = authService.onAuthStateChanged(user => {
        console.log('📱 AuthContext received user:', user?.uid || 'null');
        console.log('📱 Setting isAuthenticated to:', !!user);
        
        // Track user authentication state
        if (user) {
          analyticsService.setUserId(user.uid);
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

  const signIn = useCallback(async () => {
    setState(prev => ({...prev, isLoading: true, error: null}));
    try {
      const user = await authService.signInAnonymously();
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
      
      // Track sign in event
      analyticsService.logLogin('anonymous');
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Échec de la connexion',
      }));
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
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Échec de la déconnexion',
      }));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
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
