// Biometric Authentication Service
// Handles fingerprint/Face ID authentication for quick login

import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rnBiometrics = new ReactNativeBiometrics({allowDeviceCredentials: true});

// Storage keys
const BIOMETRIC_ENABLED_KEY = '@biometric_enabled';
const BIOMETRIC_USER_ID_KEY = '@biometric_user_id';
const BIOMETRIC_USER_EMAIL_KEY = '@biometric_user_email';

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: 'TouchID' | 'FaceID' | 'Biometrics' | null;
  isEnabled: boolean;
}

export interface BiometricCredentials {
  userId: string;
  email: string;
}

class BiometricService {
  /**
   * Check if biometric authentication is available on the device
   */
  async checkAvailability(): Promise<{
    available: boolean;
    biometryType: 'TouchID' | 'FaceID' | 'Biometrics' | null;
  }> {
    try {
      const {available, biometryType} = await rnBiometrics.isSensorAvailable();
      
      let type: 'TouchID' | 'FaceID' | 'Biometrics' | null = null;
      if (available) {
        if (biometryType === BiometryTypes.TouchID) {
          type = 'TouchID';
        } else if (biometryType === BiometryTypes.FaceID) {
          type = 'FaceID';
        } else if (biometryType === BiometryTypes.Biometrics) {
          type = 'Biometrics';
        }
      }
      
      return {available, biometryType: type};
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return {available: false, biometryType: null};
    }
  }

  /**
   * Get the full biometric status including if it's enabled for the user
   */
  async getStatus(): Promise<BiometricStatus> {
    const {available, biometryType} = await this.checkAvailability();
    const isEnabled = await this.isEnabled();
    
    return {
      isAvailable: available,
      biometryType,
      isEnabled,
    };
  }

  /**
   * Check if biometric login is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Failed to check biometric enabled status:', error);
      return false;
    }
  }

  /**
   * Enable biometric login for the current user
   */
  async enable(userId: string, email: string): Promise<boolean> {
    try {
      // First verify biometrics work
      const {success} = await this.authenticate('Confirmer votre identité');
      
      if (!success) {
        return false;
      }

      // Store credentials
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      await AsyncStorage.setItem(BIOMETRIC_USER_ID_KEY, userId);
      await AsyncStorage.setItem(BIOMETRIC_USER_EMAIL_KEY, email);
      
      return true;
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return false;
    }
  }

  /**
   * Disable biometric login
   */
  async disable(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      await AsyncStorage.removeItem(BIOMETRIC_USER_ID_KEY);
      await AsyncStorage.removeItem(BIOMETRIC_USER_EMAIL_KEY);
    } catch (error) {
      console.error('Failed to disable biometric:', error);
    }
  }

  /**
   * Get stored credentials for biometric login
   */
  async getStoredCredentials(): Promise<BiometricCredentials | null> {
    try {
      const userId = await AsyncStorage.getItem(BIOMETRIC_USER_ID_KEY);
      const email = await AsyncStorage.getItem(BIOMETRIC_USER_EMAIL_KEY);
      
      if (userId && email) {
        return {userId, email};
      }
      return null;
    } catch (error) {
      console.error('Failed to get stored credentials:', error);
      return null;
    }
  }

  /**
   * Authenticate with biometrics
   */
  async authenticate(promptMessage?: string): Promise<{success: boolean; error?: string}> {
    try {
      const {available} = await this.checkAvailability();
      
      if (!available) {
        return {
          success: false,
          error: 'Biométrie non disponible sur cet appareil',
        };
      }

      const {success, error} = await rnBiometrics.simplePrompt({
        promptMessage: promptMessage || 'Connectez-vous avec votre empreinte',
        cancelButtonText: 'Annuler',
      });

      if (success) {
        return {success: true};
      }

      return {
        success: false,
        error: error || 'Authentification annulée',
      };
    } catch (error: any) {
      console.error('Biometric authentication failed:', error);
      return {
        success: false,
        error: error.message || 'Erreur d\'authentification biométrique',
      };
    }
  }

  /**
   * Perform biometric login - authenticates and returns stored user info
   */
  async login(): Promise<{
    success: boolean;
    credentials?: BiometricCredentials;
    error?: string;
  }> {
    try {
      // Check if biometric is enabled
      const isEnabled = await this.isEnabled();
      if (!isEnabled) {
        return {
          success: false,
          error: 'Connexion biométrique non activée',
        };
      }

      // Get stored credentials
      const credentials = await this.getStoredCredentials();
      if (!credentials) {
        return {
          success: false,
          error: 'Aucun compte associé trouvé',
        };
      }

      // Authenticate
      const {success, error} = await this.authenticate('Connectez-vous à GoShopperAI');
      
      if (success) {
        return {success: true, credentials};
      }

      return {success: false, error};
    } catch (error: any) {
      console.error('Biometric login failed:', error);
      return {
        success: false,
        error: error.message || 'Erreur de connexion biométrique',
      };
    }
  }

  /**
   * Get display name for biometry type
   */
  getBiometryDisplayName(type: 'TouchID' | 'FaceID' | 'Biometrics' | null): string {
    switch (type) {
      case 'TouchID':
        return 'Touch ID';
      case 'FaceID':
        return 'Face ID';
      case 'Biometrics':
        return 'Empreinte digitale';
      default:
        return 'Biométrie';
    }
  }

  /**
   * Get icon name for biometry type
   */
  getBiometryIcon(type: 'TouchID' | 'FaceID' | 'Biometrics' | null): string {
    switch (type) {
      case 'FaceID':
        return 'scan-face';
      case 'TouchID':
      case 'Biometrics':
      default:
        return 'fingerprint';
    }
  }
}

export const biometricService = new BiometricService();
