// Gemini AI Service for Receipt Parsing
// Uses Cloud Functions as a proxy for security

import functions from '@react-native-firebase/functions';
import {Receipt, ReceiptItem, ReceiptScanResult} from '@/shared/types';
import {generateUUID} from '@/shared/utils/helpers';

// Cloud Functions region - must match deployed functions
const FUNCTIONS_REGION = 'europe-west1';

interface ParseReceiptResponse {
  success: boolean;
  data?: {
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
  error?: string;
}

class GeminiService {
  private parseReceiptFunction = functions('europe-west1').httpsCallable('parseReceipt');

  /**
   * Parse a receipt image using Gemini AI via Cloud Function
   */
  async parseReceipt(
    imageBase64: string,
    userId: string,
  ): Promise<ReceiptScanResult> {
    try {
      // Call Cloud Function (handles rate limiting, caching, API key security)
      const response = await this.parseReceiptFunction({
        imageBase64: imageBase64,
        mimeType: 'image/jpeg',
      });

      const result = response.data as ParseReceiptResponse;

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to parse receipt',
        };
      }

      // Transform response to Receipt type
      const receipt = this.transformToReceipt(result.data, userId);

      return {
        success: true,
        receipt,
      };
    } catch (error: any) {
      console.error('Gemini parse error:', error);
      
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

      return {
        success: false,
        error: error.message || 'Une erreur est survenue lors de l\'analyse',
      };
    }
  }

  /**
   * Transform API response to Receipt type
   */
  private transformToReceipt(
    data: ParseReceiptResponse['data'],
    userId: string,
  ): Receipt {
    if (!data) {
      throw new Error('No data to transform');
    }

    const now = new Date();
    const receiptId = generateUUID();

    // Transform items
    const items: ReceiptItem[] = data.items.map((item, index) => ({
      id: `${receiptId}-item-${index}`,
      name: item.name,
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
