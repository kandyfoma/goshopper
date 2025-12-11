// Export all types
export * from './receipt.types';
export * from './price.types';
export * from './user.types';
export * from './subscription.types';

// Navigation types
export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Scanner: undefined;
  MultiPhotoScanner: undefined;
  ReceiptDetail: {receiptId: string};
  PriceComparison: {receiptId: string};
  Subscription: undefined;
  Settings: undefined;
  CitySelection: undefined;
  UpdateProfile: undefined;
  // Phase 1.1 Screens
  PriceAlerts: undefined;
  Achievements: undefined;
  // Phase 1.2 Screens
  ShoppingList: undefined;
  AIAssistant: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Stats: undefined;
  Items: undefined;
  Profile: undefined;
};

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Common UI types
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}
