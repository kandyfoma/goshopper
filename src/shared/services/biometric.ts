// Biometric Authentication Service
// Handles fingerprint/Face ID authentication for quick login with secure credential storage

import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import base64 from 'react-native-base64';
import {authService} from './firebase';

const rnBiometrics = new ReactNativeBiometrics({allowDeviceCredentials: true});

// Storage keys
const BIOMETRIC_ENABLED_KEY = '@biometric_enabled';
const BIOMETRIC_USER_ID_KEY = '@biometric_user_id';
const BIOMETRIC_USER_EMAIL_KEY = '@biometric_user_email';
const BIOMETRIC_USER_PHONE_KEY = '@biometric_user_phone';
const BIOMETRIC_PASSWORD_KEY = '@biometric_password'; // Encrypted password
const BIOMETRIC_SETUP_COMPLETE_KEY = '@biometric_setup_complete';

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: 'TouchID' | 'FaceID' | 'Biometrics' | null;
  isEnabled: boolean;
}

export interface BiometricCredentials {
  userId: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
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
   * @param userId - User's unique identifier
   * @param credentials - User credentials (phone/email and password)
   */
  async enable(
    userId: string,
    credentials: {
      phoneNumber?: string;
      email?: string;
      password: string;
    },
  ): Promise<{success: boolean; error?: string}> {
    try {
      // Require password for biometric login to work
      if (!credentials.password || credentials.password.trim().length === 0) {
        return {
          success: false,
          error: 'Un mot de passe est requis pour activer la biométrie',
        };
      }
      
      // Require phone or email
      if (!credentials.phoneNumber && !credentials.email) {
        return {
          success: false,
          error: 'Un numéro de téléphone ou email est requis',
        };
      }
      
      // Check if biometrics are available
      const {available} = await this.checkAvailability();
      if (!available) {
        return {
          success: false,
          error: 'Biométrie non disponible sur cet appareil',
        };
      }

      // First verify biometrics work
      const {success, error} = await this.authenticate(
        'Confirmer votre identité pour activer la connexion biométrique',
      );

      if (!success) {
        return {success: false, error: error || 'Authentification échouée'};
      }

      // Store credentials securely
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      await AsyncStorage.setItem(BIOMETRIC_USER_ID_KEY, userId);
      if (credentials.phoneNumber) {
        await AsyncStorage.setItem(
          BIOMETRIC_USER_PHONE_KEY,
          credentials.phoneNumber,
        );
      }
      if (credentials.email) {
        await AsyncStorage.setItem(BIOMETRIC_USER_EMAIL_KEY, credentials.email);
      }
      // Encode password with Base64
      await AsyncStorage.setItem(
        BIOMETRIC_PASSWORD_KEY,
        base64.encode(credentials.password),
      );
      await AsyncStorage.setItem(BIOMETRIC_SETUP_COMPLETE_KEY, 'true');

      return {success: true};
    } catch (err) {
      console.error('Error enabling biometric:', err);
      return {
        success: false,
        error: 'Erreur lors de l\'activation de la biométrie',
      };
    }
  }

  /**
   * Disable biometric authentication and clear stored credentials
   */
  async disable(): Promise<{success: boolean; error?: string}> {
    try {
      // Verify identity before disabling
      const isEnabled = await this.isEnabled();
      if (isEnabled) {
        const {success, error} = await this.authenticate(
          'Confirmer pour désactiver la connexion biométrique',
        );
        if (!success) {
          return {success: false, error: error || 'Authentification requise'};
        }
      }

      // Clear all biometric data
      await AsyncStorage.multiRemove([
        BIOMETRIC_ENABLED_KEY,
        BIOMETRIC_USER_ID_KEY,
        BIOMETRIC_USER_EMAIL_KEY,
        BIOMETRIC_USER_PHONE_KEY,
        BIOMETRIC_PASSWORD_KEY,
        BIOMETRIC_SETUP_COMPLETE_KEY,
      ]);

      return {success: true};
    } catch (error: any) {
      console.error('Failed to disable biometric:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la désactivation',
      };
    }
  }

  /**
   * Get stored credentials for biometric login
   */
  async getStoredCredentials(): Promise<BiometricCredentials | null> {
    try {
      const userId = await AsyncStorage.getItem(BIOMETRIC_USER_ID_KEY);
      const email = await AsyncStorage.getItem(BIOMETRIC_USER_EMAIL_KEY);
      const phoneNumber = await AsyncStorage.getItem(BIOMETRIC_USER_PHONE_KEY);
      const encodedPassword = await AsyncStorage.getItem(BIOMETRIC_PASSWORD_KEY);
      
      if (userId) {
        // Decode password if it exists and is not empty
        let password: string | undefined;
        if (encodedPassword && encodedPassword.trim().length > 0) {
          try {
            password = base64.decode(encodedPassword);
          } catch (decodeError) {
            console.error('Failed to decode password:', decodeError);
          }
        }
        
        return {
          userId,
          email: email || undefined,
          phoneNumber: phoneNumber || undefined,
          password,
        };
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
        error: error.message || 'Erreur d\'authentification',
      };
    }
  }

  /**
   * Perform biometric login with stored credentials
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

      // Check if biometric is available
      const {available} = await this.checkAvailability();
      if (!available) {
        return {
          success: false,
          error: 'Biométrie non disponible. Utilisez votre mot de passe.',
        };
      }

      // Get stored credentials
      const credentials = await this.getStoredCredentials();
      if (!credentials) {
        // Clear biometric setup if credentials are missing
        await this.disable();
        return {
          success: false,
          error: 'Aucun compte associé. Veuillez vous reconnecter.',
        };
      }

      // Authenticate
      const {success, error} = await this.authenticate('Connectez-vous à GoShopper');
      
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
   * Check if biometric setup is complete
   */
  async isSetupComplete(): Promise<boolean> {
    try {
      const setupComplete = await AsyncStorage.getItem(BIOMETRIC_SETUP_COMPLETE_KEY);
      return setupComplete === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark biometric setup as complete (even if user declined)
   * This prevents repeated prompts
   */
  async markSetupComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_SETUP_COMPLETE_KEY, 'true');
    } catch (error) {
      console.error('Failed to mark biometric setup complete:', error);
    }
  }

  /**
   * Reset biometric setup flag (allows prompting again)
   * Used for testing or when user explicitly wants to be prompted again
   */
  async resetSetupFlag(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BIOMETRIC_SETUP_COMPLETE_KEY);
    } catch (error) {
      console.error('Failed to reset biometric setup flag:', error);
    }
  }

  /**
   * Update stored credentials (e.g., after password change)
   */
  async updateCredentials(credentials: {
    phoneNumber?: string;
    email?: string;
    password?: string;
  }): Promise<{success: boolean; error?: string}> {
    try {
      const isEnabled = await this.isEnabled();
      if (!isEnabled) {
        return {success: false, error: 'Biométrie non activée'};
      }

      // Verify identity before updating
      const {success, error} = await this.authenticate(
        'Confirmer pour mettre à jour vos informations',
      );
      if (!success) {
        return {success: false, error: error || 'Authentification requise'};
      }

      // Update credentials
      if (credentials.email) {
        await AsyncStorage.setItem(BIOMETRIC_USER_EMAIL_KEY, credentials.email);
      }
      if (credentials.phoneNumber) {
        await AsyncStorage.setItem(BIOMETRIC_USER_PHONE_KEY, credentials.phoneNumber);
      }
      if (credentials.password) {
        await AsyncStorage.setItem(
          BIOMETRIC_PASSWORD_KEY,
          base64.encode(credentials.password),
        );
      }

      return {success: true};
    } catch (error: any) {
      console.error('Failed to update credentials:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la mise à jour',
      };
    }
  }

  /**
   * Handle biometric change (when user adds/removes fingerprints)
   * This should be called periodically or on app resume
   */
  async handleBiometricChange(): Promise<void> {
    try {
      const isEnabled = await this.isEnabled();
      if (!isEnabled) return;

      const {available} = await this.checkAvailability();
      if (!available) {
        // Biometrics were disabled on device, disable in app too
        await this.disable();
      }
    } catch (error) {
      console.error('Failed to handle biometric change:', error);
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
