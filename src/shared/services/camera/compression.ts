// Image compression service for reducing data usage
import {Image} from 'react-native-compressor';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1200,
  maxHeight: 1600,
  quality: 0.7, // 70% quality - good balance for OCR
};

class ImageCompressionService {
  /**
   * Compress an image for AI processing
   * Reduces file size by ~90% while maintaining OCR readability
   * 
   * IMPORTANT: autoRotate is enabled to fix EXIF orientation issues
   * Mobile cameras store rotation in EXIF metadata instead of rotating pixels
   * Without autoRotate, images appear rotated and AI extraction fails
   */
  async compressForAI(
    imagePath: string,
    options: CompressionOptions = {},
  ): Promise<string> {
    const mergedOptions = {...DEFAULT_OPTIONS, ...options};

    try {
      // Add timeout to prevent hanging on corrupted images
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Compression timeout - image may be corrupted')), 15000)
      );

      const compression = Image.compress(imagePath, {
        maxWidth: mergedOptions.maxWidth,
        maxHeight: mergedOptions.maxHeight,
        quality: mergedOptions.quality,
        input: 'uri',
        returnableOutputType: 'uri',
        // FIX: Auto-rotate based on EXIF orientation data
        // This fixes images appearing rotated when taken with mobile cameras
        // Without this, AI extraction fails because text appears upside down
        autoRotate: true,
      });

      const compressedPath = await Promise.race([compression, timeout]);
      return compressedPath;
    } catch (error) {
      console.error('Image compression failed:', error);
      // Don't silently return original - throw error for better UX
      throw new Error('Image compression failed - photo may be corrupted');
    }
  }

  /**
   * Compress image and convert to base64 for API
   */
  async compressToBase64(
    imagePath: string,
    options: CompressionOptions = {},
  ): Promise<string> {
    const compressedPath = await this.compressForAI(imagePath, options);

    // Read compressed image as base64 using fetch
    try {
      const response = await fetch(compressedPath);
      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.status}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Image file is empty or corrupted');
      }

      // Check if compressed image is still too large (>10MB)
      if (blob.size > 10 * 1024 * 1024) {
        throw new Error('Image too large after compression - please select a smaller photo');
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (!result || !result.includes(',')) {
            reject(new Error('Invalid base64 encoding'));
            return;
          }
          const base64data = result.split(',')[1];
          
          // Validate base64
          if (!base64data || base64data.length < 100) {
            reject(new Error('Generated base64 is too short - image may be corrupted'));
            return;
          }
          
          resolve(base64data);
        };
        reader.onerror = () => reject(new Error('Failed to read image data'));
        reader.readAsDataURL(blob);
      });

      return base64;
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      throw error;
    }
  }

  /**
   * Get compression presets for different use cases
   */
  getPreset(preset: 'thumbnail' | 'standard' | 'high'): CompressionOptions {
    const presets: Record<string, CompressionOptions> = {
      thumbnail: {
        maxWidth: 200,
        maxHeight: 200,
        quality: 0.5,
      },
      standard: {
        maxWidth: 1200,
        maxHeight: 1600,
        quality: 0.7,
      },
      high: {
        maxWidth: 2000,
        maxHeight: 2500,
        quality: 0.85,
      },
    };

    return presets[preset] || presets.standard;
  }
}

export const imageCompressionService = new ImageCompressionService();
