// Type definitions for Price comparison data

import {ProductCategory} from './receipt.types';

export interface PricePoint {
  id: string;
  productName: string;
  productNameNormalized: string;
  storeName: string;
  storeNameNormalized: string;
  price: number;
  unit: string;
  pricePerUnit: number; // Normalized price for comparison
  currency: string; // ISO currency code (USD, EUR, GBP, INR, ZAR, CDF, etc.)
  date: Date;
  receiptId: string;
  userId: string;
  category?: ProductCategory;

  // Source tracking
  source: 'user_scan' | 'store_upload' | 'manual';
  verified: boolean;

  createdAt: Date;
}

export interface PriceComparison {
  productName: string;
  productNameNormalized: string;
  category?: ProductCategory;
  unit: string;

  // Current receipt price
  currentPrice: number;
  currentStore: string;

  // Best price found
  bestPrice: number;
  bestStore: string;
  bestDate: Date;

  // Price stats
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  priceCount: number;

  // Savings calculation
  potentialSavings: number;
  savingsPercentage: number;

  // All prices for this product
  allPrices: PricePoint[];
}

export interface PriceAlert {
  id: string;
  userId: string;
  productNameNormalized: string;
  targetPrice: number;
  currency: string; // ISO currency code (USD, EUR, GBP, INR, ZAR, CDF, etc.)
  isActive: boolean;
  triggeredAt?: Date;
  createdAt: Date;
}

export interface StorePriceList {
  storeId: string;
  storeName: string;
  storeNameNormalized: string;
  location?: string;
  lastUpdated: Date;
  productCount: number;
  averagePriceIndex?: number; // Relative to other stores
}
