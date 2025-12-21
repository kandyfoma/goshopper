// Gemini AI Service for Receipt Parsing
// Uses Cloud Functions as a proxy for security

import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import {Receipt, ReceiptItem, ReceiptScanResult} from '@/shared/types';
import {generateUUID} from '@/shared/utils/helpers';
import {ocrCorrectionService} from '../ocrCorrectionService';

// Cloud Functions region - must match deployed functions
const FUNCTIONS_REGION = 'us-central1'; // H5 FIX: Match actual deployed region
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
  private circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly HALF_OPEN_TIMEOUT = 30000; // 30s
  private readonly OPEN_TIMEOUT = 300000; // 5 minutes

  /**
   * H5 FIX: Check and update circuit breaker state
   */
  private checkCircuitState(): void {
    const now = Date.now();

    switch (this.circuitState) {
      case 'OPEN':
        if (now >= this.nextAttemptTime) {
          console.log('Circuit breaker moving to HALF_OPEN - testing service');
          this.circuitState = 'HALF_OPEN';
        }
        break;

      case 'HALF_OPEN':
        // Allow one test request through
        break;

      case 'CLOSED':
        // Normal operation
        break;
    }
  }

  /**
   * Record successful call
   */
  private recordSuccess(): void {
    this.failureCount = 0;
    this.circuitState = 'CLOSED';
    console.log('Circuit breaker CLOSED - service recovered');
  }

  /**
   * Record failed call
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      this.circuitState = 'OPEN';
      this.nextAttemptTime = Date.now() + this.OPEN_TIMEOUT;
      console.error(
        `Circuit breaker OPEN - service unavailable until ${new Date(this.nextAttemptTime).toLocaleTimeString()}`,
      );
    }
  }

  /**
   * Parse a receipt image using Gemini AI via Cloud Function
   */
  async parseReceipt(
    imageBase64: string,
    userId: string,
  ): Promise<ReceiptScanResult> {
    // Check circuit breaker state
    this.checkCircuitState();

    if (this.circuitState === 'OPEN') {
      const waitSeconds = Math.ceil((this.nextAttemptTime - Date.now()) / 1000);
      return {
        success: false,
        error: `Service temporairement indisponible. Réessayez dans ${waitSeconds} secondes.`,
      };
    }

    // Rate limit check
    if (this.rateLimitedUntil && new Date() < this.rateLimitedUntil) {
      const waitSeconds = Math.ceil(
        (this.rateLimitedUntil.getTime() - Date.now()) / 1000,
      );
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

          this.recordFailure();

          return {
            success: false,
            error: 'Trop de demandes. Veuillez réessayer dans une minute.',
          };
        }

        this.recordFailure();
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

      // Success - reset circuit breaker
      this.recordSuccess();

      return {
        success: true,
        receipt,
      };
    } catch (error: any) {
      console.error('Gemini parse error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // Record failure for circuit breaker
      this.recordFailure();

      // In HALF_OPEN state, one failure reopens circuit
      if (this.circuitState === 'HALF_OPEN') {
        this.circuitState = 'OPEN';
        this.nextAttemptTime = Date.now() + this.OPEN_TIMEOUT;
      }

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

    // Transform items - filter out undefined fields
    const items: ReceiptItem[] = data.items.map((item, index) => {
      const receiptItem: any = {
        id: `${receiptId}-item-${index}`,
        name: ocrCorrectionService.correctProductName(item.name),
        nameNormalized: this.normalizeProductName(item.name),
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        totalPrice: item.totalPrice || 0,
        confidence: item.confidence || 0.5,
      };

      // Only add optional fields if they have values
      if (item.unit) receiptItem.unit = item.unit;
      if (item.category) receiptItem.category = item.category;

      return receiptItem as ReceiptItem;
    });

    // Create receipt object with only defined fields
    const receipt: any = {
      id: receiptId,
      userId,
      storeName: data.storeName || 'Magasin inconnu',
      storeNameNormalized: this.normalizeStoreName(data.storeName || 'magasin-inconnu'),
      date: new Date(data.date),
      currency: data.currency || 'CDF',
      items,
      total: data.total || 0,
      processingStatus: 'completed',
      createdAt: now,
      updatedAt: now,
      scannedAt: now,
    };

    // Only add optional fields if they have values
    if (data.storeAddress) receipt.storeAddress = data.storeAddress;
    if (data.storePhone) receipt.storePhone = data.storePhone;
    if (data.receiptNumber) receipt.receiptNumber = data.receiptNumber;
    if (data.subtotal !== undefined) receipt.subtotal = data.subtotal;
    if (data.tax !== undefined) receipt.tax = data.tax;
    if (data.rawText) receipt.rawText = data.rawText;

    return receipt as Receipt;
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
