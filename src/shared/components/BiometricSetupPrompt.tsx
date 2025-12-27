/**
 * Global Biometric Setup Prompt
 * NOTE: This component is no longer used since biometric setup is only for phone/password logins
 * which handle the prompt locally. Keeping for potential future use.
 * 
 * This component now just clears any stale pending prompts from storage.
 */

import React, {useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '@/shared/contexts';

const BIOMETRIC_PROMPT_KEY = '@goshopper:pendingBiometricPrompt';

interface PendingPrompt {
  userId: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  timestamp: number;
}

export default function BiometricSetupPrompt() {
  const {isAuthenticated} = useAuth();

  // Clear any stale pending prompts on mount
  useEffect(() => {
    const clearStalePrompts = async () => {
      try {
        // Clear any old pending prompts that don't have passwords
        // These would have been created by social logins which we no longer support
        const pendingStr = await AsyncStorage.getItem(BIOMETRIC_PROMPT_KEY);
        if (pendingStr) {
          const pending: PendingPrompt = JSON.parse(pendingStr);
          // If no password or too old (5 minutes), clear it
          const isStale = Date.now() - pending.timestamp > 5 * 60 * 1000;
          const hasNoPassword = !pending.password;
          
          if (isStale || hasNoPassword) {
            console.log('[BiometricSetupPrompt] Clearing stale/invalid pending prompt');
            await AsyncStorage.removeItem(BIOMETRIC_PROMPT_KEY);
          }
        }
      } catch (error) {
        // Silently ignore errors
        console.error('Error clearing stale biometric prompts:', error);
      }
    };

    clearStalePrompts();
  }, [isAuthenticated]);

  // This component no longer renders anything
  // Biometric prompts are handled locally in LoginScreen
  return null;
}

// Helper function - kept for backwards compatibility but no longer used
export async function triggerBiometricPrompt(userId: string, email?: string): Promise<void> {
  // No longer stores prompts - biometric setup is handled locally in LoginScreen
  console.log('[triggerBiometricPrompt] Deprecated - biometric setup is now handled locally');
}
