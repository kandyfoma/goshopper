// Export all types
export * from './receipt.types';
export * from './price.types';
export * from './user.types';
export * from './subscription.types';

// Import types needed in this file
import type { Receipt } from './receipt.types';

// Navigation types
export type RootStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: {oobCode: string};
  ChangePassword: undefined;
  ProfileSetup: {firstName?: string; surname?: string};
  Main: undefined;
  Scanner: undefined;
  ReceiptDetail: {receiptId: string; receipt?: Receipt};
  PriceComparison: {receiptId: string};
  Subscription: undefined;
  Settings: undefined;
  CitySelection: undefined;
  UpdateProfile: undefined;
  // Phase 1.1 Screens
  PriceAlerts: undefined;
  Achievements: undefined;
  BudgetSettings: undefined;
  // Phase 1.2 Screens
  ShoppingList: undefined;
  AIAssistant: undefined;
  // Legal Screens
  FAQ: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
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
