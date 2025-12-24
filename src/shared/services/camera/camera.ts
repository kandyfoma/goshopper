// Camera and Image Capture Service
import {
  launchCamera,
  launchImageLibrary,
  CameraOptions,
  ImagePickerResponse,
  Asset,
} from 'react-native-image-picker';
import {Platform, PermissionsAndroid} from 'react-native';
import RNFS from 'react-native-fs';

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

export interface VideoResult {
  success: boolean;
  uri?: string;
  base64?: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  error?: string;
  canRetry?: boolean;
  suggestedAction?: 'close_other_apps' | 'open_settings' | 'check_storage';
}

// Video constraints for receipt scanning
const MAX_VIDEO_DURATION_SECONDS = 10; // Max 10 seconds for receipt scanning
const VIDEO_QUALITY = 'medium'; // Balance quality and file size

const DEFAULT_VIDEO_OPTIONS: CameraOptions = {
  mediaType: 'video',
  videoQuality: 'medium',
  durationLimit: MAX_VIDEO_DURATION_SECONDS,
  saveToPhotos: false,
  cameraType: 'back',
};

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
            "GoShopper a besoin d'accéder à votre caméra pour scanner les factures.",
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
   * Record video for long receipt scanning
   * @param maxDuration Max duration in seconds (default: 10s)
   */
  async recordVideo(maxDuration: number = MAX_VIDEO_DURATION_SECONDS): Promise<VideoResult> {
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
        {
          ...DEFAULT_VIDEO_OPTIONS,
          durationLimit: Math.min(maxDuration, MAX_VIDEO_DURATION_SECONDS),
        },
        async (response: ImagePickerResponse) => {
          const result = this.handleVideoPickerResponse(response);
          
          // If successful, read the video file and convert to base64
          if (result.success && result.uri) {
            try {
              const base64 = await RNFS.readFile(result.uri, 'base64');
              result.base64 = base64;
            } catch (error) {
              console.error('Error reading video file:', error);
              resolve({
                success: false,
                error: 'Erreur lors de la lecture de la vidéo.',
                canRetry: true,
              });
              return;
            }
          }
          
          resolve(result);
        },
      );
    });
  }

  /**
   * Select video from gallery for long receipts
   */
  async selectVideoFromGallery(): Promise<VideoResult> {
    return new Promise(resolve => {
      launchImageLibrary(
        {
          mediaType: 'video',
          videoQuality: 'medium',
        },
        async (response: ImagePickerResponse) => {
          const result = this.handleVideoPickerResponse(response);
          
          // Validate duration for gallery videos
          if (result.success && result.duration && result.duration > MAX_VIDEO_DURATION_SECONDS) {
            resolve({
              success: false,
              error: `Vidéo trop longue (max ${MAX_VIDEO_DURATION_SECONDS}s). Sélectionnez une vidéo plus courte.`,
              canRetry: true,
            });
            return;
          }
          
          // If successful, read the video file and convert to base64
          if (result.success && result.uri) {
            try {
              const base64 = await RNFS.readFile(result.uri, 'base64');
              result.base64 = base64;
            } catch (error) {
              console.error('Error reading video file:', error);
              resolve({
                success: false,
                error: 'Erreur lors de la lecture de la vidéo.',
                canRetry: true,
              });
              return;
            }
          }
          
          resolve(result);
        },
      );
    });
  }

  /**
   * Get max video duration allowed
   */
  getMaxVideoDuration(): number {
    return MAX_VIDEO_DURATION_SECONDS;
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

  /**
   * Handle video picker response
   */
  private handleVideoPickerResponse(
    response: ImagePickerResponse,
  ): VideoResult {
    if (response.didCancel) {
      return {
        success: false,
        error: 'Capture annulée',
        canRetry: true,
      };
    }

    if (response.errorCode) {
      switch (response.errorCode) {
        case 'camera_unavailable':
          return {
            success: false,
            error: 'Caméra non disponible. Fermez les autres applications.',
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
        error: 'Aucune vidéo capturée. Réessayez.',
        canRetry: true,
      };
    }

    // Validate video duration
    const durationSeconds = asset.duration || 0;
    if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      return {
        success: false,
        error: `Vidéo trop longue (max ${MAX_VIDEO_DURATION_SECONDS}s). Réessayez avec une vidéo plus courte.`,
        canRetry: true,
      };
    }

    if (durationSeconds < 1) {
      return {
        success: false,
        error: 'Vidéo trop courte. Scannez lentement tout le reçu.',
        canRetry: true,
      };
    }

    return {
      success: true,
      uri: asset.uri,
      duration: durationSeconds,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
    };
  }
}

export const cameraService = new CameraService();
