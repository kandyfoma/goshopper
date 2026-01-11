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
  VerifyOtp: {phoneNumber: string; isRegistration?: boolean; registrationData?: {password: string; city: string; countryCode: string}; isPhoneVerification?: boolean};
  ResetPassword: {phoneNumber: string; verificationToken: string};
  ChangePassword: undefined;
  ProfileSetup: {firstName?: string; surname?: string};
  Main: undefined;
  Scanner: undefined;
  ReceiptProcessing: {receiptId?: string; receiptImage?: string};
  ReceiptDetail: {receiptId: string; receipt?: Receipt};
  PriceComparison: {receiptId: string};
  Subscription: undefined;
  SubscriptionDetails: undefined;
  SubscriptionDuration: {
    planId: 'basic' | 'standard' | 'premium';
    isScanPack?: boolean;
    scanPackId?: string;
    scanPackScans?: number;
    scanPackPrice?: number;
    isUpgrade?: boolean;
    isDowngrade?: boolean;
    currentPlanId?: string;
    currentEndDate?: Date | string;
    remainingScans?: number;
  };
  MokoPayment: {amount: number; planId: string; planName: string; isScanPack?: boolean; scanPackId?: string};
  CitySelection: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Scanner: undefined;
  Items: undefined;
  Stats: undefined;
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
