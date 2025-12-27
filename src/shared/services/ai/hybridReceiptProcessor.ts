// Hybrid Receipt Processor Service
// Integrates local OCR with AI fallback for receipt extraction
// Combines local OCR, rule-based extraction, and AI fallback

import {Platform} from 'react-native';
import {Receipt, ReceiptItem, ReceiptScanResult} from '@/shared/types';
import {generateUUID} from '@/shared/utils/helpers';
import {ocrCorrectionService} from '../ocrCorrectionService';
import {itemSanitizationService} from '../itemSanitizationService';
import {localOcrService} from './localOcrService';

// Import existing Gemini service for fallback
import {geminiService} from './gemini';

interface HybridReceiptResult {
  success: boolean;
  method: 'local' | 'hybrid' | 'gemini';
  confidence: number;
  receipt?: Receipt;
  error?: string;
  processingTime?: number;
}

interface LocalProcessingResult {
  success: boolean;
  confidence: number;
  merchant?: string;
  items?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  total?: number;
  currency?: string;
  date?: string;
  error?: string;
  rawText?: string; // Raw OCR text for quality analysis
}

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  metrics: {
    hasStoreName: boolean;
    hasTotal: boolean;
    hasItems: boolean;
    hasDate: boolean;
    mathMatches: boolean;
    pricesReasonable: boolean;
    textQuality: number; // 0-1 score for OCR text quality
  };
}

class HybridReceiptProcessor {
  /**
   * Process receipt using hybrid approach:
   * 1. Local OCR + Rule-based extraction (fast, cheap)
   * 2. VALIDATE local results with multiple checks
   * 3. Gemini fallback if validation fails (accurate, expensive)
   * 4. Machine learning from corrections
   */
  async processReceipt(
    imageBase64: string,
    userId: string,
    userCity?: string,
  ): Promise<ReceiptScanResult> {
    const startTime = Date.now();

    try {
      console.log('Starting hybrid receipt processing...');

      // Check if local OCR is available
      if (!localOcrService.isAvailable()) {
        console.log('Local OCR not available - using Gemini directly');
        return await geminiService.parseReceipt(imageBase64, userId, userCity);
      }

      // Phase 1: Attempt local processing first
      console.log('Phase 1: Local OCR processing...');
      const localResult = await this.processLocally(imageBase64);

      // If local processing failed, go directly to Gemini
      if (!localResult.success) {
        console.log('Local OCR failed - using Gemini');
        return await geminiService.parseReceipt(imageBase64, userId, userCity);
      }

      // Phase 2: VALIDATE local results thoroughly
      console.log('Phase 2: Validating local OCR results...');
      const validation = this.validateLocalResult(localResult);

      console.log('Validation results:', {
        isValid: validation.isValid,
        confidence: validation.confidence,
        issues: validation.issues,
        metrics: validation.metrics,
      });

      // Decision matrix based on validation
      const shouldUseLocal = 
        localResult.success && 
        validation.isValid && 
        validation.confidence >= 0.80 && // Require 80% confidence
        validation.metrics.mathMatches && // Math MUST match
        validation.metrics.textQuality >= 0.7; // Good OCR quality

      if (shouldUseLocal) {
        // High confidence + validated local result - safe to use
        console.log(`✅ Local OCR validated successfully (confidence: ${validation.confidence})`);
        console.log(`   Metrics: Math=${validation.metrics.mathMatches}, Quality=${validation.metrics.textQuality.toFixed(2)}`);

        const receipt = this.createReceiptFromLocalResult(
          localResult,
          userId,
          'local',
          userCity
        );

        return {
          success: true,
          receipt,
        };
      }

      // Phase 3: Local validation failed, use Gemini fallback
      const reasons = validation.issues.join(', ');
      console.log(`⚠️  Local OCR validation failed: ${reasons}`);
      console.log(`   Falling back to Gemini for accuracy...`);

      const geminiResult = await geminiService.parseReceipt(imageBase64, userId, userCity);

      if (geminiResult.success && geminiResult.receipt) {
        // Gemini successful - learn from this correction
        console.log('✅ Gemini successful, learning from correction...');
        await this.learnFromGeminiCorrection(localResult, geminiResult, imageBase64);

        return geminiResult;
      }

      // Both methods failed
      return {
        success: false,
        error: geminiResult.error || 'Receipt processing failed',
      };

    } catch (error: any) {
      console.error('Hybrid processing error:', error);

      // Ultimate fallback: pure Gemini processing
      console.log('Hybrid processing failed, using pure Gemini fallback...');
      return await geminiService.parseReceipt(imageBase64, userId, userCity);
    }
  }

  /**
   * Process receipt using local OCR service
   */
  private async processLocally(imageBase64: string): Promise<LocalProcessingResult> {
    try {
      // Use the local OCR service to extract receipt data
      const result = await localOcrService.extractReceiptData(imageBase64);

      return {
        success: result.success,
        confidence: result.confidence || 0.0,
        merchant: result.merchant,
        items: result.items,
        total: result.total,
        currency: result.currency,
        date: result.date,
        rawText: result.rawText,
        error: result.error
      };

    } catch (error: any) {
      console.error('Local processing error:', error);
      return {
        success: false,
        confidence: 0.0,
        items: [],
        error: error.message || 'Local processing failed'
      };
    }
  }

  /**
   * COMPREHENSIVE VALIDATION of local OCR results
   * Ensures we don't misread receipts by checking multiple quality metrics
   */
  private validateLocalResult(localResult: LocalProcessingResult): ValidationResult {
    const issues: string[] = [];
    const metrics = {
      hasStoreName: false,
      hasTotal: false,
      hasItems: false,
      hasDate: false,
      mathMatches: false,
      pricesReasonable: false,
      textQuality: 0,
    };

    // 1. Check for critical fields
    if (!localResult.merchant || localResult.merchant.length < 2) {
      issues.push('Missing or invalid store name');
    } else {
      metrics.hasStoreName = true;
    }

    if (!localResult.total || localResult.total <= 0) {
      issues.push('Missing or invalid total');
    } else {
      metrics.hasTotal = true;
    }

    if (!localResult.items || localResult.items.length === 0) {
      issues.push('No items extracted');
    } else {
      metrics.hasItems = true;
    }

    if (localResult.date) {
      metrics.hasDate = true;
    }

    // 2. CRITICAL: Validate math (total = sum of items)
    if (localResult.items && localResult.items.length > 0 && localResult.total) {
      const calculatedTotal = localResult.items.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
      );
      
      // Allow 1% tolerance for rounding
      const tolerance = Math.max(1, localResult.total * 0.01);
      const difference = Math.abs(calculatedTotal - localResult.total);
      
      if (difference <= tolerance) {
        metrics.mathMatches = true;
      } else {
        issues.push(
          `Math mismatch: items=${calculatedTotal.toFixed(2)}, total=${localResult.total.toFixed(2)}, diff=${difference.toFixed(2)}`
        );
      }
    }

    // 3. Validate price reasonableness (detect OCR errors)
    if (localResult.items && localResult.items.length > 0) {
      const unreasonablePrices = localResult.items.filter(item => {
        // Check for common OCR mistakes:
        // - Prices too high (> 1,000,000)
        // - Prices with weird decimals (e.g., 12.345)
        // - Zero or negative prices
        if (item.price <= 0) return true;
        if (item.price > 1000000) return true;
        
        // Check decimal places (should be max 2 for currency)
        const decimalStr = item.price.toString().split('.')[1];
        if (decimalStr && decimalStr.length > 2) return true;
        
        return false;
      });

      if (unreasonablePrices.length === 0) {
        metrics.pricesReasonable = true;
      } else {
        issues.push(`${unreasonablePrices.length} items with unreasonable prices`);
      }
    }

    // 4. Assess OCR text quality (if available)
    if (localResult.rawText) {
      metrics.textQuality = this.assessTextQuality(localResult.rawText);
      
      if (metrics.textQuality < 0.5) {
        issues.push(`Low OCR quality score: ${metrics.textQuality.toFixed(2)}`);
      }
    } else {
      // No raw text available, give benefit of doubt
      metrics.textQuality = 0.7;
    }

    // 5. Calculate overall confidence score
    let confidence = localResult.confidence || 0;
    
    // Adjust confidence based on validation
    if (metrics.hasStoreName) confidence += 0.05;
    if (metrics.hasTotal) confidence += 0.05;
    if (metrics.hasItems) confidence += 0.05;
    if (metrics.hasDate) confidence += 0.02;
    if (metrics.mathMatches) confidence += 0.10; // Math matching is critical
    if (metrics.pricesReasonable) confidence += 0.05;
    
    // Penalize for poor text quality
    confidence *= metrics.textQuality;

    // Cap at 1.0
    confidence = Math.min(1.0, confidence);

    // Determine if valid
    const isValid = 
      metrics.hasStoreName &&
      metrics.hasTotal &&
      metrics.hasItems &&
      metrics.mathMatches && // CRITICAL: Math must match
      metrics.pricesReasonable &&
      issues.length === 0;

    return {
      isValid,
      confidence,
      issues,
      metrics,
    };
  }

  /**
   * Assess OCR text quality based on various indicators
   */
  private assessTextQuality(text: string): number {
    if (!text || text.length < 10) {
      return 0;
    }

    let qualityScore = 1.0;

    // 1. Check for excessive special characters (OCR noise)
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s€$£¥₹.,:-]/g) || []).length / text.length;
    if (specialCharRatio > 0.3) {
      qualityScore -= 0.3; // Too many weird characters
    }

    // 2. Check for repeated characters (OCR artifacts)
    const repeatedChars = text.match(/(.)\1{4,}/g); // 5+ same characters in a row
    if (repeatedChars && repeatedChars.length > 2) {
      qualityScore -= 0.2;
    }

    // 3. Check for reasonable word length distribution
    const words = text.split(/\s+/);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    if (avgWordLength < 2 || avgWordLength > 15) {
      qualityScore -= 0.2; // Abnormal word lengths suggest OCR issues
    }

    // 4. Check for numeric content (receipts should have numbers)
    const hasNumbers = /\d/.test(text);
    if (!hasNumbers) {
      qualityScore -= 0.3; // Receipt should have prices/quantities
    }

    // 5. Check for currency symbols
    const hasCurrency = /[$€£¥₹CDF USD]/.test(text);
    if (hasCurrency) {
      qualityScore += 0.1; // Good sign for receipts
    }

    return Math.max(0, Math.min(1, qualityScore));
  }

  /**
   * Learn from Gemini corrections to improve local processing
   * This can be used for future ML model training
   */
  private async learnFromGeminiCorrection(
    localResult: LocalProcessingResult,
    geminiResult: ReceiptScanResult,
    imageBase64: string
  ): Promise<void> {
    try {
      // Log the correction for future analysis/training
      console.log('Learning opportunity detected:', {
        localMerchant: localResult.merchant,
        geminiMerchant: geminiResult.receipt?.storeName,
        localItemsCount: localResult.items?.length || 0,
        geminiItemsCount: geminiResult.receipt?.items?.length || 0,
        localTotal: localResult.total,
        geminiTotal: geminiResult.receipt?.total
      });

      // TODO: Store this data for future ML model training
      // Could send to Firebase for analysis or local storage
      
    } catch (error) {
      console.warn('Learning from correction failed:', error);
      // Don't throw - learning failure shouldn't break the main flow
    }
  }

  /**
   * Convert local processing result to Receipt object
   */
  private createReceiptFromLocalResult(
    localResult: LocalProcessingResult,
    userId: string,
    method: string,
    userCity?: string
  ): Receipt {
    const now = new Date();
    const receiptId = generateUUID();
    const currency = (localResult.currency as 'USD' | 'CDF') || 'CDF';

    // Transform items with initial processing
    const rawItems: ReceiptItem[] = (localResult.items || []).map((item, index) => ({
      id: `${receiptId}-item-${index}`,
      name: ocrCorrectionService.correctProductName(item.name),
      nameNormalized: this.normalizeProductName(item.name),
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      confidence: localResult.confidence,
    }));

    // Sanitize all items - filter garbage, fix errors, translate local languages
    const { validItems, invalidItems, modifications } = itemSanitizationService.sanitizeItems(
      rawItems,
      { currency, strictMode: false }
    );

    if (invalidItems.length > 0) {
      console.log(`🧹 Filtered ${invalidItems.length} invalid items:`, invalidItems.map(i => i.reason));
    }
    if (modifications.length > 0) {
      console.log(`✏️ Made ${modifications.length} item modifications:`, modifications.slice(0, 5));
    }

    // Sanitize store name
    const sanitizedStoreName = itemSanitizationService.sanitizeStoreName(
      localResult.merchant || ''
    );

    const receipt: any = {
      id: receiptId,
      userId,
      storeName: sanitizedStoreName,
      storeNameNormalized: this.normalizeStoreName(sanitizedStoreName),
      date: now,
      currency,
      items: validItems,
      total: localResult.total || validItems.reduce((sum, item) => sum + item.totalPrice, 0),
      processingStatus: 'completed',
      createdAt: now,
      updatedAt: now,
      scannedAt: now,
    };

    // Add user's city if available
    if (userCity) {
      receipt.city = userCity;
    }

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

export const hybridReceiptProcessor = new HybridReceiptProcessor();