// Type definitions for Invoice/Receipt data

export interface ReceiptItem {
  id: string;
  name: string;
  nameNormalized: string; // Standardized product name
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit?: string; // kg, L, piece, etc.
  category?: string;
  confidence: number; // AI confidence score 0-1
}

export interface Receipt {
  id: string;
  userId: string;
  imageUrl?: string;
  imageUrls?: string[]; // For multi-page receipts
  thumbnailUrl?: string;
  
  // Store information
  storeName: string;
  storeNameNormalized: string;
  storeAddress?: string;
  storePhone?: string;
  city?: string; // City where the purchase was made
  
  // Receipt details
  receiptNumber?: string;
  date: Date;
  purchaseDate?: Date; // Alias for date
  currency: 'USD' | 'CDF';
  
  // Items and totals
  items: ReceiptItem[];
  subtotal?: number;
  tax?: number;
  total: number;
  totalAmount?: number; // Alias for total
  
  // Multi-currency support
  totalUSD?: number; // USD amount if receipt has both currencies
  totalCDF?: number; // CDF amount if receipt has both currencies
  
  // Status
  status?: 'pending' | 'processing' | 'processed' | 'error';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  
  // Metadata
  rawText?: string; // Original OCR text
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  scannedAt: Date;
}

export interface ReceiptScanResult {
  success: boolean;
  receipt?: Receipt;
  error?: string;
  rawResponse?: string;
}

// Categories for DRC market
export const PRODUCT_CATEGORIES = [
  'Alimentation', // Food
  'Boissons', // Beverages
  'Produits laitiers', // Dairy
  'Viandes & Poissons', // Meat & Fish
  'Fruits & Légumes', // Fruits & Vegetables
  'Épicerie', // Grocery
  'Hygiène', // Hygiene
  'Ménage', // Household
  'Bébé', // Baby
  'Autres', // Other
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
