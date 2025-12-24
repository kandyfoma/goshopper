/**
 * Scan Top-Up Pack Types
 */

export interface ScanPack {
  id: string;
  name: string;
  scans: number;
  price: number;
  priceCDF: number;
  popular?: boolean;
}

export const SCAN_PACKS: Record<string, ScanPack> = {
  small: {
    id: 'small',
    name: 'Petit Pack',
    scans: 5,
    price: 0.49,
    priceCDF: 2000,
  },
  medium: {
    id: 'medium',
    name: 'Pack Moyen',
    scans: 10,
    price: 0.99,
    priceCDF: 4000,
    popular: true,
  },
  large: {
    id: 'large',
    name: 'Grand Pack',
    scans: 25,
    price: 1.99,
    priceCDF: 8000,
  },
};

export const EMERGENCY_SCANS_LIMIT = 3;

export interface ScanUsageWarning {
  type: 'low' | 'depleted' | 'emergency' | 'blocked';
  threshold: number;
  message: string;
  actionRequired: boolean;
}

export const SCAN_USAGE_THRESHOLDS = {
  WARNING: 0.8, // 80% used
  DEPLETED: 1.0, // 100% used
  EMERGENCY: 1.0, // Using emergency scans
  BLOCKED: 1.0, // All options exhausted
};
