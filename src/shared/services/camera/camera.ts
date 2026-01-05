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
const MIN_VIDEO_DURATION_SECONDS = 3; // Min 3 seconds for meaningful content
const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB max for video
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
  cameraType: 'back',
  selectionLimit: 1,
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
   * Request camera and audio permissions for video recording (Android only)
   */
  async requestVideoPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ];

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      const cameraGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
      const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      
      if (!cameraGranted) {
        console.warn('Camera permission denied');
        return false;
      }
      
      // Audio is optional for video - we can record without audio
      if (!audioGranted) {
        console.warn('Audio permission denied - video will be recorded without audio');
      }
      
      return cameraGranted;
    } catch (err) {
      console.error('Video permissions error:', err);
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

    const cameraOptions = {...DEFAULT_CAMERA_OPTIONS, ...options};
    console.log('📷 [CameraService] Opening camera with options:', {
      cameraType: cameraOptions.cameraType,
      mediaType: cameraOptions.mediaType,
    });

    return new Promise(resolve => {
      launchCamera(
        cameraOptions,
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
    // Check permissions first (camera + audio)
    const hasPermission = await this.requestVideoPermissions();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission caméra refusée',
      };
    }

    // Track recording start time since react-native-image-picker doesn't always return duration
    const recordingStartTime = Date.now();

    return new Promise(resolve => {
      launchCamera(
        {
          ...DEFAULT_VIDEO_OPTIONS,
          durationLimit: Math.min(maxDuration, MAX_VIDEO_DURATION_SECONDS),
        },
        async (response: ImagePickerResponse) => {
          // Calculate actual recording duration
          const recordingEndTime = Date.now();
          const actualDurationMs = recordingEndTime - recordingStartTime;
          
          const result = this.handleVideoPickerResponse(response, actualDurationMs);
          
          // If successful, validate size and convert to base64
          if (result.success && result.uri) {
            try {
              // Check file size BEFORE loading into memory
              const fileInfo = await RNFS.stat(result.uri);
              if (fileInfo.size > MAX_VIDEO_SIZE_BYTES) {
                resolve({
                  success: false,
                  error: `Vidéo trop volumineuse (${Math.round(fileInfo.size / 1024 / 1024)}MB). Maximum ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB.`,
                  canRetry: true,
                });
                return;
              }
              
              // Estimate duration from file size if not available
              // Rough estimate: ~500KB per second of medium quality video
              if (!result.duration || result.duration === 0) {
                const estimatedDurationSeconds = fileInfo.size / (500 * 1024);
                result.duration = Math.max(estimatedDurationSeconds, actualDurationMs / 1000);
                console.log(`📹 Estimated video duration: ${result.duration.toFixed(1)}s (from file size: ${(fileInfo.size / 1024).toFixed(0)}KB)`);
              }

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
          
          // Validate duration FIRST before loading into memory
          if (result.success && result.duration) {
            if (result.duration > MAX_VIDEO_DURATION_SECONDS) {
              resolve({
                success: false,
                error: `Vidéo trop longue (${Math.round(result.duration)}s). Maximum ${MAX_VIDEO_DURATION_SECONDS}s.`,
                canRetry: true,
              });
              return;
            }
            if (result.duration < MIN_VIDEO_DURATION_SECONDS) {
              resolve({
                success: false,
                error: `Vidéo trop courte (${Math.round(result.duration)}s). Minimum ${MIN_VIDEO_DURATION_SECONDS}s pour capturer le reçu.`,
                canRetry: true,
              });
              return;
            }
          }
          
          // If successful, check size and read the video file
          if (result.success && result.uri) {
            try {
              // Check file size BEFORE loading into memory
              const fileInfo = await RNFS.stat(result.uri);
              if (fileInfo.size > MAX_VIDEO_SIZE_BYTES) {
                resolve({
                  success: false,
                  error: `Vidéo trop volumineuse (${Math.round(fileInfo.size / 1024 / 1024)}MB). Maximum ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB.`,
                  canRetry: true,
                });
                return;
              }

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
    actualDurationMs?: number,
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

    // Get duration from asset or from actual recording time
    // react-native-image-picker doesn't always return duration
    let durationSeconds = asset.duration || 0;
    
    // If asset duration is 0, use actual recorded time
    if (durationSeconds === 0 && actualDurationMs && actualDurationMs > 0) {
      durationSeconds = actualDurationMs / 1000;
      console.log(`📹 Using actual recording duration: ${durationSeconds.toFixed(1)}s (asset.duration was ${asset.duration})`);
    }
    
    // Only validate if we have a reliable duration
    // Skip validation for duration 0 - it will be estimated later from file size
    if (durationSeconds > 0) {
      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        return {
          success: false,
          error: `Vidéo trop longue (${Math.round(durationSeconds)}s). Maximum ${MAX_VIDEO_DURATION_SECONDS}s.`,
          canRetry: true,
        };
      }

      if (durationSeconds < MIN_VIDEO_DURATION_SECONDS) {
        return {
          success: false,
          error: `Vidéo trop courte (${Math.round(durationSeconds)}s). Scannez lentement tout le reçu (minimum ${MIN_VIDEO_DURATION_SECONDS}s).`,
          canRetry: true,
        };
      }
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
