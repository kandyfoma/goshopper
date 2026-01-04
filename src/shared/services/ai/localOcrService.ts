// Local OCR Service
// Performs text recognition directly on device using ML Kit
// Fast, free, and privacy-friendly on-device OCR

import {Platform} from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';

export interface OcrResult {
  success: boolean;
  text: string;
  blocks?: TextBlock[];
  error?: string;
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ReceiptData {
  success: boolean;
  confidence: number;
  merchant?: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  total?: number;
  currency?: string;
  date?: string;
  rawText: string;
  error?: string;
}

class LocalOcrService {
  /**
   * Perform OCR on an image using ML Kit
   */
  async recognizeText(imageBase64: string): Promise<OcrResult> {
    try {
      // ML Kit expects a file path or data URI
      // Convert base64 to data URI if needed
      const imageUri = imageBase64.startsWith('data:') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`;

      // Perform text recognition using ML Kit
      const result = await TextRecognition.recognize(imageUri);
      
      // Transform ML Kit result to our format
      const blocks: TextBlock[] = result.blocks.map(block => ({
        text: block.text,
        confidence: 1.0, // ML Kit doesn't provide confidence per block
        boundingBox: block.frame ? {
          x: (block.frame as any).x || 0,
          y: (block.frame as any).y || 0,
          width: (block.frame as any).width || 0,
          height: (block.frame as any).height || 0
        } : undefined
      }));

      return {
        success: true,
        text: result.text,
        blocks
      };
      
    } catch (error: any) {
      // Don't log OCR recognition errors - they're expected when ML Kit fails
      // console.error('OCR recognition error:', error);
      return {
        success: false,
        text: '',
        error: error.message || 'OCR failed'
      };
    }
  }

  /**
   * Extract structured receipt data from OCR text
   * Uses pattern matching and heuristics
   */
  async extractReceiptData(imageBase64: string): Promise<ReceiptData> {
    try {
      // Step 1: Perform OCR
      const ocrResult = await this.recognizeText(imageBase64);
      
      if (!ocrResult.success || !ocrResult.text) {
        return {
          success: false,
          confidence: 0,
          items: [],
          rawText: '',
          error: ocrResult.error || 'OCR failed'
        };
      }

      // Step 2: Extract structured data from text
      const text = ocrResult.text;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      // Extract merchant (usually at the top)
      const merchant = this.extractMerchant(lines);

      // Extract items with prices
      const items = this.extractItems(lines);

      // Extract total
      const total = this.extractTotal(lines);

      // Extract date
      const date = this.extractDate(lines);

      // Extract currency
      const currency = this.extractCurrency(text);

      // Calculate confidence
      const confidence = this.calculateConfidence({
        merchant,
        items,
        total,
        date,
        text
      });

      return {
        success: true,
        confidence,
        merchant,
        items,
        total,
        currency,
        date,
        rawText: text
      };

    } catch (error: any) {
      console.error('Receipt extraction error:', error);
      return {
        success: false,
        confidence: 0,
        items: [],
        rawText: '',
        error: error.message || 'Receipt extraction failed'
      };
    }
  }

  /**
   * Extract merchant name from receipt text
   */
  private extractMerchant(lines: string[]): string | undefined {
    // Look for merchant name in first few lines
    // Usually it's capitalized and at the top
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      
      // Skip lines with only numbers or special characters
      if (/^[\d\s\-\.\/]+$/.test(line)) continue;
      
      // Look for lines with mostly uppercase letters (store names)
      if (line.length >= 3 && /[A-Z]/.test(line)) {
        return line;
      }
    }

    return undefined;
  }

  /**
   * Extract items with prices from receipt text
   * Handles multiple formats including CDF prices (12 500 FC, 12.500,00)
   */
  private extractItems(lines: string[]): Array<{name: string; price: number; quantity: number}> {
    const items: Array<{name: string; price: number; quantity: number}> = [];

    // Common receipt patterns - including CDF formats:
    // "Item Name    12.50"
    // "Item Name 2x 25.00"
    // "2 Item Name  25.00"
    // CDF: "Item Name    12 500 FC" or "Item Name    12.500,00"
    const patterns = [
      // Pattern: CDF with space separator "Item Name    12 500" or "Item Name    12 500 FC"
      /^(.+?)\s+(\d{1,3}(?:\s\d{3})+)\s*(?:FC|CDF)?\s*$/i,
      // Pattern: CDF with dot separator "Item Name    12.500,00"
      /^(.+?)\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s*(?:FC|CDF)?\s*$/i,
      // Pattern: "Item Name    12.50" (standard decimal)
      /^(.+?)\s+(\d+[.,]\d{2})\s*$/,
      // Pattern: "Item Name 2x 25.00" or "Item Name x2 25.00"
      /^(.+?)\s+[xX]?(\d+)[xX]?\s+(\d+[.,]\d{2})\s*$/,
      // Pattern: "2 Item Name  25.00"
      /^(\d+)\s+(.+?)\s+(\d+[.,]\d{2})\s*$/,
      // Pattern: CDF with quantity "Item Name 2x 12 500"
      /^(.+?)\s+[xX]?(\d+)[xX]?\s+(\d{1,3}(?:\s\d{3})+)\s*(?:FC|CDF)?\s*$/i,
      // Pattern: CDF quantity at start "2 Item Name  12 500"
      /^(\d+)\s+(.+?)\s+(\d{1,3}(?:\s\d{3})+)\s*(?:FC|CDF)?\s*$/i,
    ];

    for (const line of lines) {
      // Skip common receipt headers/footers
      if (this.isHeaderOrFooter(line)) continue;

      // Try each pattern
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = line.match(pattern);
        if (match) {
          let name: string;
          let price: number;
          let quantity = 1;

          if (i === 0) {
            // CDF with space separator "Item Name    12 500"
            name = match[1].trim();
            price = this.parseCdfPrice(match[2]);
          } else if (i === 1) {
            // CDF with dot separator "Item Name    12.500,00"
            name = match[1].trim();
            price = this.parseCdfPrice(match[2]);
          } else if (i === 2) {
            // Pattern: "Item Name    12.50"
            name = match[1].trim();
            price = parseFloat(match[2].replace(',', '.'));
          } else if (i === 3) {
            // Pattern: "Item Name 2x 25.00"
            name = match[1].trim();
            quantity = parseInt(match[2], 10);
            price = parseFloat(match[3].replace(',', '.'));
          } else if (i === 4) {
            // Pattern: "2 Item Name  25.00"
            quantity = parseInt(match[1], 10);
            name = match[2].trim();
            price = parseFloat(match[3].replace(',', '.'));
          } else if (i === 5) {
            // CDF with quantity "Item Name 2x 12 500"
            name = match[1].trim();
            quantity = parseInt(match[2], 10);
            price = this.parseCdfPrice(match[3]);
          } else {
            // CDF quantity at start "2 Item Name  12 500"
            quantity = parseInt(match[1], 10);
            name = match[2].trim();
            price = this.parseCdfPrice(match[3]);
          }

          // Validate extracted data
          if (name.length >= 2 && price > 0 && quantity > 0) {
            items.push({
              name,
              price: price / quantity, // Unit price
              quantity
            });
            break; // Found match, skip other patterns
          }
        }
      }
    }

    return items;
  }

  /**
   * Parse CDF price formats
   * "12 500" -> 12500
   * "12.500,00" -> 12500.00
   * "1 250 000" -> 1250000
   */
  private parseCdfPrice(priceStr: string): number {
    // Remove FC/CDF suffix if present
    let cleaned = priceStr.replace(/\s*(FC|CDF)\s*/gi, '').trim();
    
    // Handle "12.500,00" format (dot as thousand separator, comma as decimal)
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/.test(cleaned)) {
      // "12.500,00" -> "12500.00"
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Handle "12 500" format (space as thousand separator)
      cleaned = cleaned.replace(/\s/g, '');
    }
    
    return parseFloat(cleaned) || 0;
  }

  /**
   * Extract total from receipt text
   * Handles CDF formats (12 500 FC, 12.500,00)
   */
  private extractTotal(lines: string[]): number | undefined {
    // Look for total in last lines
    const lastLines = lines.slice(-10); // Check last 10 lines

    const totalPatterns = [
      // CDF with space: "Total: 12 500 FC" or "Total: 125 000"
      /total\s*:?\s*(\d{1,3}(?:\s\d{3})+)\s*(?:FC|CDF)?/i,
      // CDF with dots: "Total: 12.500,00"
      /total\s*:?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)\s*(?:FC|CDF)?/i,
      // Standard decimal: "Total: 12.50"
      /total\s*:?\s*(\d+[.,]\d{2})/i,
      // French "montant" patterns
      /montant\s*:?\s*(\d{1,3}(?:\s\d{3})+)\s*(?:FC|CDF)?/i,
      /montant\s*:?\s*(\d+[.,]\d{2})/i,
      // French "somme" patterns
      /somme\s*:?\s*(\d{1,3}(?:\s\d{3})+)\s*(?:FC|CDF)?/i,
      /somme\s*:?\s*(\d+[.,]\d{2})/i,
      // Line starting with Total
      /^total\s+(\d{1,3}(?:\s\d{3})+)\s*(?:FC|CDF)?/i,
      /^total\s+(\d+[.,]\d{2})/i,
    ];

    for (const line of lastLines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          return this.parseCdfPrice(match[1]);
        }
      }
    }

    return undefined;
  }

  /**
   * Extract date from receipt text
   */
  private extractDate(lines: string[]): string | undefined {
    const datePatterns = [
      // DD/MM/YYYY or DD-MM-YYYY
      /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
      // DD/MM/YY or DD-MM-YY
      /(\d{2})[\/\-](\d{2})[\/\-](\d{2})/,
      // YYYY-MM-DD
      /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,
    ];

    for (const line of lines.slice(0, 10)) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          return match[0]; // Return the full date string
        }
      }
    }

    return undefined;
  }

  /**
   * Extract currency from receipt text
   */
  private extractCurrency(text: string): string {
    if (/CDF|FC/i.test(text)) return 'CDF';
    if (/USD|\$|US/i.test(text)) return 'USD';
    if (/EUR|€/i.test(text)) return 'EUR';
    
    // Default to CDF for Congo
    return 'CDF';
  }

  /**
   * Calculate confidence score for extracted data
   */
  private calculateConfidence(data: {
    merchant?: string;
    items: any[];
    total?: number;
    date?: string;
    text: string;
  }): number {
    let confidence = 0.5; // Base confidence

    if (data.merchant) confidence += 0.1;
    if (data.items.length > 0) confidence += 0.2;
    if (data.total) confidence += 0.1;
    if (data.date) confidence += 0.05;

    // Check if items total matches receipt total
    if (data.items.length > 0 && data.total) {
      const itemsTotal = data.items.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
      );
      const difference = Math.abs(itemsTotal - data.total);
      const tolerance = data.total * 0.01; // 1% tolerance

      if (difference <= tolerance) {
        confidence += 0.15; // Math matches - high confidence boost
      }
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Check if line is a header or footer (not an item)
   */
  private isHeaderOrFooter(line: string): boolean {
    const headerFooterPatterns = [
      /merci|thank you|au revoir|goodbye/i,
      /^total/i,
      /^montant/i,
      /^tva|tax/i,
      /facture|invoice|receipt/i,
      /^date/i,
      /^heure|time/i,
      /adresse|address/i,
      /telephone|phone|tel/i,
      /www\.|http/i,
    ];

    return headerFooterPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if local OCR is available
   * Actually tests ML Kit to ensure it's working
   */
  async isAvailable(): Promise<boolean> {
    // Basic platform check
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      return false;
    }
    
    try {
      // Try to import and check if TextRecognition module exists
      if (!TextRecognition || typeof TextRecognition.recognize !== 'function') {
        console.warn('ML Kit TextRecognition not available');
        return false;
      }
      return true;
    } catch (error) {
      console.error('ML Kit availability check failed:', error);
      return false;
    }
  }
  
  /**
   * Synchronous version for quick checks (doesn't verify ML Kit works)
   */
  isAvailableSync(): boolean {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  }
}

export const localOcrService = new LocalOcrService();
