// Gemini AI Service for Receipt Parsing
// Uses Cloud Functions as a proxy for security

import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import {Receipt, ReceiptItem, ReceiptScanResult} from '@/shared/types';
import {generateUUID, convertCurrency} from '@/shared/utils/helpers';
import {ocrCorrectionService} from '../ocrCorrectionService';
import {itemSanitizationService} from '../itemSanitizationService';

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
    city?: string;
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
  
  // Request queuing system
  private requestQueue: Array<{
    request: () => Promise<ReceiptScanResult>;
    resolve: (result: ReceiptScanResult) => void;
    reject: (error: any) => void;
  }> = [];
  private isProcessingQueue = false;
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY = 2000; // 2 seconds
  
  // Usage tracking
  private requestCount = 0;
  private lastResetTime = Date.now();
  private readonly USAGE_WARNING_THRESHOLD = 10; // Warn after 10 requests in a short period

  /**
   * Process the request queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { request, resolve, reject } = this.requestQueue.shift()!;
      
      try {
        const result = await this.retryWithBackoff(request);
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Small delay between requests to avoid overwhelming the API
      await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Retry a request with exponential backoff
   */
  private async retryWithBackoff(requestFn: () => Promise<ReceiptScanResult>): Promise<ReceiptScanResult> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.message?.includes('Limite d\'essai atteinte') ||
            error.message?.includes('Limite mensuelle atteinte') ||
            error.message?.includes('Veuillez vous connecter')) {
          throw error;
        }
        
        // If this is the last attempt, throw the error
        if (attempt === this.MAX_RETRIES) {
          throw error;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = this.BASE_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Request failed (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms...`);
        
        await new Promise<void>(resolve => setTimeout(() => resolve(), delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Add request to queue
   */
  private queueRequest(requestFn: () => Promise<ReceiptScanResult>): Promise<ReceiptScanResult> {
    // Track usage
    this.trackUsage();
    
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        request: requestFn,
        resolve,
        reject,
      });
      
      // Start processing queue if not already running
      this.processQueue();
    });
  }

  /**
   * Track API usage and show warnings
   */
  private trackUsage(): void {
    this.requestCount++;
    
    // Reset counter every 5 minutes
    if (Date.now() - this.lastResetTime > 5 * 60 * 1000) {
      this.requestCount = 1;
      this.lastResetTime = Date.now();
    }
    
    // Show warning if approaching rate limits
    if (this.requestCount >= this.USAGE_WARNING_THRESHOLD) {
      console.warn(`⚠️ High API usage detected: ${this.requestCount} requests in the last 5 minutes. Consider spacing out your scans to avoid rate limits.`);
    }
  }

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
    userCity?: string,
  ): Promise<ReceiptScanResult> {
    return this.queueRequest(() => this.processReceiptRequest(imageBase64, userId, userCity));
  }

  /**
   * Internal method to process a single receipt request
   */
  private async processReceiptRequest(
    imageBase64: string,
    userId: string,
    userCity?: string,
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

      // Create AbortController for timeout - 150s to accommodate complex receipts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 150000); // 150s timeout

      // Call Cloud Function via HTTP with Firebase Auth
      // This is needed because the function is deployed in europe-west1
      let response: Response;
      try {
        response = await fetch(
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
            signal: controller.signal,
          },
        );
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          return {
            success: false,
            error: 'Le traitement du reçu prend trop de temps. Veuillez réessayer avec une photo plus claire.',
          };
        }
        throw fetchError;
      }
      clearTimeout(timeoutId);

      // Check if HTTP response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP error response:', response.status, errorText);
        
        // Handle rate limiting (429 Too Many Requests)
        if (response.status === 429) {
          // Check if this is a subscription limit error (not a rate limit error)
          let errorMessage = 'Trop de demandes. Veuillez réessayer dans une minute.';
          
          try {
            // Try to parse the error response to get the actual message
            const errorJson = JSON.parse(errorText);
            if (errorJson.error && errorJson.error.message) {
              // If it's a subscription limit error, use that message
              if (errorJson.error.message.includes('Limite d\'essai') ||
                  errorJson.error.message.includes('Limite mensuelle') ||
                  errorJson.error.status === 'RESOURCE_EXHAUSTED') {
                errorMessage = errorJson.error.message;
              }
            }
          } catch (parseError) {
            // If parsing fails, use default message
            console.log('Could not parse 429 error response');
          }
          
          // Only set rate limit timeout for actual rate limiting (not subscription limits)
          if (!errorMessage.includes('Limite d\'essai') && !errorMessage.includes('Limite mensuelle')) {
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 1 min
            this.rateLimitedUntil = new Date(Date.now() + waitTime);
          }

          this.recordFailure();

          return {
            success: false,
            error: errorMessage,
          };
        }

        this.recordFailure();
        throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      
      // Don't log full response - may contain base64 image data in error cases
      // console.log('Cloud Function response:', JSON.stringify(responseData).substring(0, 500));

      // Log any suspicious item names in the raw response
      if (responseData.result?.receipt?.items || responseData.receipt?.items || responseData.data?.items) {
        const items = responseData.result?.receipt?.items || responseData.receipt?.items || responseData.data?.items || [];
        const suspiciousItems = items.filter((item: any) =>
          item.name && (item.name.includes('prite') || item.name.match(/\s+[a-z]\d+\s+[a-z]\s+[a-z]/))
        );
        if (suspiciousItems.length > 0) {
          console.log('🚨 Suspicious items in Cloud Function response:', suspiciousItems.map((item: any) => item.name));
        }
      }

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
      
      // DEBUG: Log FULL Gemini response for debugging
      console.log('📥 [Gemini] FULL Cloud Function response:', JSON.stringify(result, null, 2));
      console.log('📥 [Gemini] Receipt data:', JSON.stringify(receiptData, null, 2));
      console.log('📥 [Gemini] Summary:', JSON.stringify({
        success: result.success,
        hasReceiptData: !!receiptData,
        storeName: receiptData?.storeName,
        itemsCount: receiptData?.items?.length || 0,
        total: receiptData?.total,
        currency: receiptData?.currency,
        rawItems: receiptData?.items || [],
      }));

      if (!result.success || !receiptData) {
        console.error('📥 [Gemini] No receipt data in response:', result.error);
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
        userCity,
      );

      // Success - reset circuit breaker
      this.recordSuccess();

      return {
        success: true,
        receipt,
      };
    } catch (error: any) {
      console.error('Receipt parse error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      // Don't log full error details - may contain large base64 image data

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
    userCity?: string,
  ): Receipt {
    if (!data) {
      throw new Error('No data to transform');
    }

    const now = new Date();
    // Use the Firestore receipt ID if provided, otherwise generate a new one
    const receiptId = firestoreReceiptId || generateUUID();
    const currency = data.currency || 'CDF';

    // Transform items - filter out undefined fields
    const rawItems: ReceiptItem[] = data.items.map((item, index) => {
      // Apply OCR correction
      const correctedName = ocrCorrectionService.correctProductName(item.name);
      if (item.name.includes('prite') || correctedName.includes('prite')) {
        console.log(`🔧 [Gemini] OCR correction: "${item.name}" → "${correctedName}"`);
      }

      const receiptItem: any = {
        id: `${receiptId}-item-${index}`,
        name: correctedName,
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

    // Sanitize all items - filter garbage, fix errors, translate local languages
    const { validItems, invalidItems, modifications } = itemSanitizationService.sanitizeItems(
      rawItems,
      { currency: currency as 'USD' | 'CDF', strictMode: false }
    );

    if (invalidItems.length > 0) {
      console.log(`🧹 [Gemini] Filtered ${invalidItems.length} invalid items:`, invalidItems.map(i => i.reason));
    }
    if (modifications.length > 0) {
      console.log(`✏️ [Gemini] Made ${modifications.length} item modifications:`, modifications.slice(0, 5));
    }

    // Sanitize store name
    const sanitizedStoreName = itemSanitizationService.sanitizeStoreName(data.storeName || '');

    // Create receipt object with only defined fields
    const receipt: any = {
      id: receiptId,
      userId,
      storeName: sanitizedStoreName,
      storeNameNormalized: this.normalizeStoreName(sanitizedStoreName),
      date: data.date ? new Date(data.date) : now, // Use receipt date or fallback to now
      currency,
      items: validItems,
      total: data.total || 0,
      processingStatus: 'completed',
      createdAt: now,
      updatedAt: now,
      scannedAt: now,
    };

    // Add converted currency amounts for both USD and CDF
    if (receipt.currency === 'USD') {
      receipt.totalUSD = receipt.total;
      receipt.totalCDF = convertCurrency(receipt.total, 'USD', 'CDF');
    } else if (receipt.currency === 'CDF') {
      receipt.totalCDF = receipt.total;
      receipt.totalUSD = convertCurrency(receipt.total, 'CDF', 'USD');
    }

    // Only add optional fields if they have values
    if (data.storeAddress) receipt.storeAddress = data.storeAddress;
    if (data.storePhone) receipt.storePhone = data.storePhone;
    if (data.receiptNumber) receipt.receiptNumber = data.receiptNumber;
    if (data.subtotal !== undefined) receipt.subtotal = data.subtotal;
    if (data.tax !== undefined) receipt.tax = data.tax;
    if (data.rawText) receipt.rawText = data.rawText;
    
    // Add user's default city if not detected from receipt
    if (!data.city && userCity) {
      receipt.city = userCity;
    } else if (data.city) {
      receipt.city = data.city;
    }

    return receipt as Receipt;
  }

  /**
   * Parse a receipt video using Gemini AI
   * Ideal for long receipts - user scans slowly down the receipt
   */
  async parseReceiptVideo(
    videoBase64: string,
    userId: string,
    userCity?: string,
  ): Promise<ReceiptScanResult> {
    return this.queueRequest(() => this.processReceiptVideoRequest(videoBase64, userId, userCity));
  }

  /**
   * Internal method to process a single receipt video request
   */
  private async processReceiptVideoRequest(
    videoBase64: string,
    userId: string,
    userCity?: string,
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
      // Get current user's auth token
      const currentUser = auth().currentUser;
      if (!currentUser) {
        return {
          success: false,
          error: 'Veuillez vous connecter pour scanner.',
        };
      }

      const idToken = await currentUser.getIdToken();

      // Call video parsing Cloud Function with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout (reduced from 4min 40s)

      let response: Response;
      try {
        response = await fetch(
          `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net/parseReceiptVideo`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              data: {
                videoBase64: videoBase64,
                mimeType: 'video/mp4',
              },
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Video HTTP error:', response.status, errorText);

          // Handle subscription limit error (403)
          if (response.status === 403) {
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error) {
                // Preserve subscription limit message
                this.recordFailure();
                return {
                  success: false,
                  error: errorJson.error,
                };
              }
            } catch {
              // Fall through to generic handler
            }
          }

          if (response.status === 429) {
            // Check if this is a subscription limit error (not a rate limit error)
            let errorMessage = 'Trop de demandes. Veuillez réessayer dans une minute.';
            
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error && errorJson.error.message) {
                if (errorJson.error.message.includes('Limite d\'essai') ||
                    errorJson.error.message.includes('Limite mensuelle') ||
                    errorJson.error.status === 'RESOURCE_EXHAUSTED') {
                  errorMessage = errorJson.error.message;
                }
              }
            } catch (parseError) {
              console.log('Could not parse video 429 error response');
            }
            
            // Only set rate limit timeout for actual rate limiting
            if (!errorMessage.includes('Limite d\'essai') && !errorMessage.includes('Limite mensuelle')) {
              const waitTime = 60000;
              this.rateLimitedUntil = new Date(Date.now() + waitTime);
            }
            
            this.recordFailure();
            return {
              success: false,
              error: errorMessage,
            };
          }

          this.recordFailure();
          
          // Try to parse error message from response
          try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.error || `Erreur serveur (${response.status})`);
          } catch {
            throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          this.recordFailure();
          return {
            success: false,
            error: 'Le traitement de la vidéo prend trop de temps. Essayez une vidéo plus courte ou scannez en photo.',
          };
        }
        throw fetchError;
      }

      const responseData = await response.json();
      
      // Don't log full response - may contain base64 video data in error cases
      // console.log('Video Cloud Function response:', JSON.stringify(responseData).substring(0, 500));

      if (responseData.error) {
        const errorMsg =
          typeof responseData.error === 'object'
            ? responseData.error.message || JSON.stringify(responseData.error)
            : responseData.error;
        throw new Error(errorMsg);
      }

      const result = responseData as ParseReceiptResponse;
      const receiptData = result.receipt || result.data;

      if (!result.success || !receiptData) {
        return {
          success: false,
          error: result.error || 'Échec de l\'analyse de la vidéo',
        };
      }

      // Transform response to Receipt type
      const receipt = this.transformToReceipt(
        receiptData,
        userId,
        result.receiptId,
        userCity,
      );

      // Mark as video scan
      (receipt as any).isVideoScan = true;

      // Success - reset circuit breaker
      this.recordSuccess();

      return {
        success: true,
        receipt,
      };
    } catch (error: any) {
      console.error('Video receipt parse error:', error);
      this.recordFailure();

      if (this.circuitState === 'HALF_OPEN') {
        this.circuitState = 'OPEN';
        this.nextAttemptTime = Date.now() + this.OPEN_TIMEOUT;
      }

      return {
        success: false,
        error: error.message || 'Erreur lors de l\'analyse de la vidéo.',
      };
    }
  }

  /**
   * Get current usage statistics
   */
  public getUsageStats(): {
    requestCount: number;
    isRateLimited: boolean;
    rateLimitResetIn?: number;
    circuitState: string;
    queueLength: number;
  } {
    return {
      requestCount: this.requestCount,
      isRateLimited: this.rateLimitedUntil ? new Date() < this.rateLimitedUntil : false,
      rateLimitResetIn: this.rateLimitedUntil ? Math.ceil((this.rateLimitedUntil.getTime() - Date.now()) / 1000) : undefined,
      circuitState: this.circuitState,
      queueLength: this.requestQueue.length,
    };
  }

  /**
   * Clear the request queue - use when scans get stuck
   * This will reject all pending requests and reset the processing state
   */
  public clearQueue(): void {
    console.log(`🧹 Clearing Gemini request queue (${this.requestQueue.length} items)`);
    
    // Reject all pending requests
    while (this.requestQueue.length > 0) {
      const { reject } = this.requestQueue.shift()!;
      reject(new Error('Queue cleared by user'));
    }
    
    // Reset processing state
    this.isProcessingQueue = false;
    
    // Reset rate limit if it was set
    this.rateLimitedUntil = null;
    
    // Reset circuit breaker to allow new requests
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    
    console.log('✅ Gemini queue cleared and reset');
  }

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
