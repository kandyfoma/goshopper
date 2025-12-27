/**
 * Hook to handle biometric availability changes
 * Checks when app comes to foreground if biometrics are still available
 */
import {useEffect} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {biometricService} from '../services/biometric';

export function useBiometricCheck() {
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground, check biometric status
        await biometricService.handleBiometricChange();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);
}
