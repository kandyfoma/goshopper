// Camera and Image Capture Service
import {
  launchCamera,
  launchImageLibrary,
  CameraOptions,
  ImagePickerResponse,
  Asset,
} from 'react-native-image-picker';
import {Platform, PermissionsAndroid} from 'react-native';

export interface CaptureResult {
  success: boolean;
  uri?: string;
  base64?: string;
  width?: number;
  height?: number;
  fileName?: string;
  error?: string;
  canRetry?: boolean;
  suggestedAction?: 'close_other_apps' | 'open_settings' | 'check_storage' | 'get_closer';
}

const DEFAULT_CAMERA_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  quality: 0.8,
  maxWidth: 2000,
  maxHeight: 2500,
  includeBase64: true, // Get base64 directly to avoid saving files
  saveToPhotos: false,
  cameraType: 'back', // H4 FIX: Use back camera for receipts (not front)
};

class CameraService {
  /**
   * Request camera permission (Android only)
   */
  async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Permission Caméra',
          message:
            "GoShopperAI a besoin d'accéder à votre caméra pour scanner les factures.",
          buttonNeutral: 'Plus tard',
          buttonNegative: 'Refuser',
          buttonPositive: 'Autoriser',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Camera permission error:', err);
      return false;
    }
  }

  /**
   * Capture image from camera
   */
  async captureFromCamera(
    options: Partial<CameraOptions> = {},
  ): Promise<CaptureResult> {
    // Check permission first
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission caméra refusée',
      };
    }

    return new Promise(resolve => {
      launchCamera(
        {...DEFAULT_CAMERA_OPTIONS, ...options},
        (response: ImagePickerResponse) => {
          resolve(this.handleImagePickerResponse(response));
        },
      );
    });
  }

  /**
   * Select image from gallery
   */
  async selectFromGallery(
    options: Partial<CameraOptions> = {},
  ): Promise<CaptureResult> {
    return new Promise(resolve => {
      launchImageLibrary(
        {...DEFAULT_CAMERA_OPTIONS, ...options},
        (response: ImagePickerResponse) => {
          resolve(this.handleImagePickerResponse(response));
        },
      );
    });
  }

  /**
   * Handle image picker response
   * H4 FIX: Enhanced error handling with recovery suggestions
   */
  private handleImagePickerResponse(
    response: ImagePickerResponse,
  ): CaptureResult {
    if (response.didCancel) {
      return {
        success: false,
        error: 'Capture annulée',
        canRetry: true,
      };
    }

    if (response.errorCode) {
      // Specific error handling with recovery suggestions
      switch (response.errorCode) {
        case 'camera_unavailable':
          return {
            success: false,
            error: 'Caméra non disponible. Fermez les autres applications utilisant la caméra.',
            canRetry: true,
            suggestedAction: 'close_other_apps',
          };

        case 'permission':
          return {
            success: false,
            error: 'Permission caméra refusée. Activez-la dans les paramètres.',
            canRetry: false,
            suggestedAction: 'open_settings',
          };

        case 'others':
          // Could be hardware failure or low storage
          return {
            success: false,
            error: 'Erreur matérielle. Vérifiez votre espace de stockage.',
            canRetry: true,
            suggestedAction: 'check_storage',
          };

        default:
          return {
            success: false,
            error: response.errorMessage || 'Erreur inconnue',
            canRetry: true,
          };
      }
    }

    const asset: Asset | undefined = response.assets?.[0];
    if (!asset || !asset.uri) {
      return {
        success: false,
        error: 'Aucune image capturée. Réessayez.',
        canRetry: true,
      };
    }

    // Validate captured image dimensions
    if (!asset.width || !asset.height) {
      return {
        success: false,
        error: 'Image invalide. Réessayez.',
        canRetry: true,
      };
    }

    if (asset.width < 400 || asset.height < 300) {
      return {
        success: false,
        error: 'Image trop petite. Rapprochez-vous du reçu.',
        canRetry: true,
        suggestedAction: 'get_closer',
      };
    }

    return {
      success: true,
      uri: asset.uri,
      base64: asset.base64,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName,
    };
  }
}

export const cameraService = new CameraService();
