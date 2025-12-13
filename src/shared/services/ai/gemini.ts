// Gemini AI Service for Receipt Parsing
// Uses Cloud Functions as a proxy for security

import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import {Receipt, ReceiptItem, ReceiptScanResult} from '@/shared/types';
import {generateUUID} from '@/shared/utils/helpers';
import {ocrCorrectionService} from '../ocrCorrectionService';

// Cloud Functions region - must match deployed functions
const FUNCTIONS_REGION = 'europe-west1';
const PROJECT_ID = 'goshopperai';

interface ParseReceiptResponse {
  success: boolean;
  receiptId?: string;
  receipt?: {
    storeName: string;
    storeAddress?: string;
    storePhone?: string;
    receiptNumber?: string;
    date: string;
    currency: 'USD' | 'CDF';
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      unit?: string;
      category?: string;
      confidence: number;
    }>;
    subtotal?: number;
    tax?: number;
    total: number;
    rawText?: string;
  };
  // Legacy support for data field
  data?: ParseReceiptResponse['receipt'];
  error?: string;
}

class GeminiService {
  private rateLimitedUntil: Date | null = null;
  private consecutiveFailures = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly MAX_CONSECUTIVE_FAILURES = 10;

  /**
   * Parse a receipt image using Gemini AI via Cloud Function
   */
  async parseReceipt(
    imageBase64: string,
    userId: string,
  ): Promise<ReceiptScanResult> {
    // Circuit breaker check - if too many consecutive failures, stop trying
    if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      const waitMinutes = Math.min(this.consecutiveFailures, this.MAX_CONSECUTIVE_FAILURES);
      
      // Reset circuit breaker after wait time
      if (this.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES) {
        setTimeout(() => {
          console.log('Circuit breaker reset - retrying service');
          this.consecutiveFailures = 0;
        }, waitMinutes * 60 * 1000);
      }
      
      return {
        success: false,
        error: 'Le service de scan est temporairement indisponible. Réessayez dans quelques minutes.',
      };
    }

    // Rate limit check
    if (this.rateLimitedUntil && new Date() < this.rateLimitedUntil) {
      const waitSeconds = Math.ceil((this.rateLimitedUntil.getTime() - Date.now()) / 1000);
      return {
        success: false,
        error: `Trop de demandes. Veuillez attendre ${waitSeconds} secondes.`,
      };
    }
    try {
      // Get current user's auth token for authenticated call
      const currentUser = auth().currentUser;
      if (!currentUser) {
        return {
          success: false,
          error: 'Veuillez vous connecter pour scanner.',
        };
      }

      const idToken = await currentUser.getIdToken();

      // Call Cloud Function via HTTP with Firebase Auth
      // This is needed because the function is deployed in europe-west1
      const response = await fetch(
        `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/parseReceipt`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            data: {
              imageBase64: imageBase64,
              mimeType: 'image/jpeg',
            },
          }),
        },
      );

      // Check if HTTP response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP error response:', response.status, errorText);
        
        // Handle rate limiting (429 Too Many Requests)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 1 min
          this.rateLimitedUntil = new Date(Date.now() + waitTime);
          
          this.consecutiveFailures++;
          
          return {
            success: false,
            error: 'Trop de demandes. Veuillez réessayer dans une minute.',
          };
        }
        
        this.consecutiveFailures++;
        throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      console.log(
        'Cloud Function response:',
        JSON.stringify(responseData).substring(0, 500),
      );

      // Handle error in response
      if (responseData.error) {
        const errorMsg =
          typeof responseData.error === 'object'
            ? responseData.error.message || JSON.stringify(responseData.error)
            : responseData.error;
        throw new Error(errorMsg);
      }

      // Handle callable function response format
      const result = (responseData.result ||
        responseData) as ParseReceiptResponse;

      // Get receipt data from either 'receipt' or 'data' field
      const receiptData = result.receipt || result.data;

      if (!result.success || !receiptData) {
        return {
          success: false,
          error: result.error || 'Failed to parse receipt',
        };
      }

      // Transform response to Receipt type - use receiptId from response
      const receipt = this.transformToReceipt(
        receiptData,
        userId,
        result.receiptId,
      );

      // Success - reset failure counter
      this.consecutiveFailures = 0;

      return {
        success: true,
        receipt,
      };
    } catch (error: any) {
      console.error('Gemini parse error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // Increment failure counter for circuit breaker
      this.consecutiveFailures++;

      // Handle specific error types
      if (error.code === 'functions/resource-exhausted') {
        return {
          success: false,
          error: 'Limite de scans atteinte. Veuillez réessayer plus tard.',
        };
      }

      if (error.code === 'functions/unauthenticated') {
        return {
          success: false,
          error: 'Veuillez vous connecter pour scanner.',
        };
      }

      if (error.code === 'functions/not-found') {
        return {
          success: false,
          error: "Service d'analyse indisponible. Réessayez plus tard.",
        };
      }

      // Get a proper error message
      let errorMessage = "Une erreur est survenue lors de l'analyse";
      if (error.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.error) {
        errorMessage =
          typeof error.error === 'string'
            ? error.error
            : JSON.stringify(error.error);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Transform API response to Receipt type
   */
  private transformToReceipt(
    data: ParseReceiptResponse['data'],
    userId: string,
    firestoreReceiptId?: string,
  ): Receipt {
    if (!data) {
      throw new Error('No data to transform');
    }

    const now = new Date();
    // Use the Firestore receipt ID if provided, otherwise generate a new one
    const receiptId = firestoreReceiptId || generateUUID();

    // Transform items
    const items: ReceiptItem[] = data.items.map((item, index) => ({
      id: `${receiptId}-item-${index}`,
      name: ocrCorrectionService.correctProductName(item.name),
      nameNormalized: this.normalizeProductName(item.name),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      unit: item.unit,
      category: item.category,
      confidence: item.confidence,
    }));

    return {
      id: receiptId,
      userId,
      storeName: data.storeName,
      storeNameNormalized: this.normalizeStoreName(data.storeName),
      storeAddress: data.storeAddress,
      storePhone: data.storePhone,
      receiptNumber: data.receiptNumber,
      date: new Date(data.date),
      currency: data.currency,
      items,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      rawText: data.rawText,
      processingStatus: 'completed',
      createdAt: now,
      updatedAt: now,
      scannedAt: now,
    };
  }

  /**
   * Normalize product name for comparison
   */
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Normalize store name for comparison
   */
  private normalizeStoreName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\b(supermarche|supermarket|magasin|shop|store|market)\b/g, '')
      .trim();
  }
}

export const geminiService = new GeminiService();
