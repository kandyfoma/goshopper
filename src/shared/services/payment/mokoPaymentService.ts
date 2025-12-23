/**
 * Moko Payment Service
 * Integrates with Africanite Payment Hub (Railway + FreshPay PayDRC API)
 */

import 'react-native-url-polyfill/auto';
import {createClient, SupabaseClient} from '@supabase/supabase-js';

// Try to import Config safely
let Config: any = {};
try {
  Config = require('react-native-config').default || {};
} catch (e) {
  console.warn('⚠️ react-native-config not available, using defaults');
}

// Payment Hub Configuration - Use Railway endpoint from README
const PAYMENT_API_URL = 'https://web-production-a4586.up.railway.app/initiate-payment';

// Supabase configuration - try env vars first, fallback to public keys
// Note: Supabase anon key is a PUBLIC key (safe to expose) - it only allows what RLS policies permit
const SUPABASE_URL = Config.SUPABASE_URL || 'https://oacrwvfivsybkvndooyx.supabase.co';
const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hY3J3dmZpdnN5Ymt2bmRvb3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4OTI3NzEsImV4cCI6MjA1MDQ2ODc3MX0.sb_publishable_wj3fQLQJ808R5CG5FG8FYw_5J11Ps4g';

console.log('🔑 Supabase URL:', SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('🔑 Supabase Key:', SUPABASE_ANON_KEY ? '✅ Loaded' : '❌ Missing');

// Create supabase client only if we have the keys
let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client created successfully');
  } catch (e) {
    console.warn('⚠️ Failed to create Supabase client:', e);
  }
} else {
  console.warn('⚠️ Supabase credentials not configured - payment status polling will not work');
}

export type MobileMoneyProvider = 'mpesa' | 'airtel' | 'orange' | 'afrimoney';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface PaymentRequest {
  amount: number;
  phoneNumber: string;
  userId: string;
  currency?: 'USD' | 'CDF';
  userInfo?: {
    firstname?: string;
    lastname?: string;
    email?: string;
  };
}

export interface PaymentResponse {
  success: boolean;
  transaction_id: string;
  message: string;
  instructions?: string;
}

/**
 * Detect mobile money provider from phone number
 */
export const detectProvider = (phoneNumber: string): MobileMoneyProvider | null => {
  // Remove any spaces, dashes, or plus signs
  const cleaned = phoneNumber.replace(/[\s\-+]/g, '');
  
  // Extract prefix (assumes format: 243XXXXXXXXX)
  const prefix = cleaned.substring(3, 5);
  
  // Vodacom M-Pesa: 81, 82, 83
  if (['81', '82', '83'].includes(prefix)) {
    return 'mpesa';
  }
  
  // Airtel Money: 84, 85, 86, 89, 90, 91, 97, 99
  if (['84', '85', '86', '89', '90', '91', '97', '99'].includes(prefix)) {
    return 'airtel';
  }
  
  // Orange Money: 80
  if (prefix === '80') {
    return 'orange';
  }
  
  // Africell Money: 98
  if (prefix === '98') {
    return 'afrimoney';
  }
  
  return null;
};

/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phoneNumber: string): {valid: boolean; message?: string} => {
  const cleaned = phoneNumber.replace(/[\s\-+]/g, '');
  
  // Must start with 243 and have 12 digits total
  if (!/^243[0-9]{9}$/.test(cleaned)) {
    return {
      valid: false,
      message: 'Le numéro doit commencer par 243 et contenir 12 chiffres (ex: 243828812498)'
    };
  }
  
  const provider = detectProvider(cleaned);
  if (!provider) {
    return {
      valid: false,
      message: 'Opérateur non reconnu. Utilisez Vodacom, Airtel, Orange ou Africell.'
    };
  }
  
  return {valid: true};
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/[\s\-+]/g, '');
  
  if (cleaned.length === 12 && cleaned.startsWith('243')) {
    // Format: +243 82 881 2498
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  
  return phoneNumber;
};

/**
 * Get provider display name
 */
export const getProviderName = (provider: MobileMoneyProvider): string => {
  const names = {
    mpesa: 'Vodacom M-Pesa',
    airtel: 'Airtel Money',
    orange: 'Orange Money',
    afrimoney: 'Africell Money'
  };
  return names[provider] || 'Mobile Money';
};

/**
 * Initiate a payment through the Payment Hub
 */
export const initiatePayment = async (request: PaymentRequest): Promise<PaymentResponse> => {
  try {
    // Validate phone number
    const validation = validatePhoneNumber(request.phoneNumber);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    // Clean phone number
    const cleanedPhone = request.phoneNumber.replace(/[\s\-+]/g, '');
    
    // Call Railway Payment Hub (as per README)
    const response = await fetch(PAYMENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_name: 'GoShopper',
        user_id: request.userId,
        amount: request.amount,
        phone_number: cleanedPhone,
        currency: request.currency || 'USD',
        // Optional fields (will use defaults from README if not provided):
        firstname: 'Africanite',
        lastname: 'Service',
        email: 'foma.kandy@gmail.com'
      })
    });

    const data = await response.json();
    
    console.log('🚀 Railway Payment Hub Response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || 'Échec de l\'initiation du paiement');
    }

    return {
      success: true,
      transaction_id: data.transaction_id,
      message: data.message || 'Payment initiated successfully',
      instructions: data.instructions || 'Please check your phone and enter your PIN to complete the payment.'
    };
  } catch (error: any) {
    console.error('Payment initiation failed:', error);
    throw new Error(error.message || 'Erreur lors de l\'initiation du paiement');
  }
};

/**
 * Subscribe to payment status updates via Supabase real-time
 * Uses both real-time subscription AND polling for reliability
 */
export const subscribeToPaymentStatus = (
  transactionId: string,
  onStatusChange: (status: PaymentStatus, details?: any) => void
): (() => void) => {
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let isResolved = false;

  // Always start polling as a reliable fallback
  console.log('🔄 Starting polling for transaction:', transactionId);
  pollInterval = setInterval(async () => {
    if (isResolved) return;
    
    try {
      const status = await getPaymentStatus(transactionId);
      console.log('📊 Poll result:', status);
      
      if (status && status.status !== 'PENDING') {
        isResolved = true;
        onStatusChange(status.status, status.details);
        if (pollInterval) clearInterval(pollInterval);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 5000);

  // Also try real-time if Supabase is available
  let channel: any = null;
  if (supabase) {
    console.log('✅ Setting up real-time subscription for:', transactionId);
    
    channel = supabase
      .channel(`transaction-${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `id=eq.${transactionId}`
        },
        (payload) => {
          if (isResolved) return;
          
          console.log('📨 Real-time payment status update:', payload.new);
          isResolved = true;
          onStatusChange(payload.new.status, payload.new);
          if (pollInterval) clearInterval(pollInterval);
        }
      )
      .subscribe((status: string) => {
        console.log('📡 Supabase subscription status:', status);
      });
  } else {
    console.warn('⚠️ Supabase client not available for real-time');
  }

  // Return cleanup function
  return () => {
    isResolved = true;
    if (pollInterval) clearInterval(pollInterval);
    if (channel && supabase) {
      supabase.removeChannel(channel);
    }
  };
};

/**
 * Get payment status from Supabase (fallback method)
 */
export const getPaymentStatus = async (transactionId: string): Promise<{
  status: PaymentStatus;
  details: any;
} | null> => {
  if (!supabase) {
    console.log('⚠️ Supabase client not available, cannot check status');
    // For now, return null - in a real implementation, you might call a REST API
    return null;
  }

  try {
    const {data, error} = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (error) {
      console.error('Error fetching payment status:', error);
      return null;
    }

    return {
      status: data.status,
      details: data
    };
  } catch (error) {
    console.error('Error in getPaymentStatus:', error);
    return null;
  }
};

/**
 * Get payment instructions for user
 */
export const getPaymentInstructions = (provider: MobileMoneyProvider): string[] => {
  const instructions = {
    mpesa: [
      '1. Vous allez recevoir une notification M-Pesa',
      '2. Ouvrez le menu USSD sur votre téléphone',
      '3. Entrez votre code PIN M-Pesa',
      '4. Confirmez le paiement'
    ],
    airtel: [
      '1. Vous allez recevoir une notification Airtel Money',
      '2. Composez *501# sur votre téléphone',
      '3. Entrez votre code PIN Airtel Money',
      '4. Confirmez le paiement'
    ],
    orange: [
      '1. Vous allez recevoir une notification Orange Money',
      '2. Composez #150# sur votre téléphone',
      '3. Entrez votre code PIN Orange Money',
      '4. Confirmez le paiement'
    ],
    afrimoney: [
      '1. Vous allez recevoir une notification Africell Money',
      '2. Ouvrez le menu sur votre téléphone',
      '3. Entrez votre code PIN Africell Money',
      '4. Confirmez le paiement'
    ]
  };
  
  return instructions[provider] || [
    '1. Vérifiez votre téléphone pour une notification de paiement',
    '2. Entrez votre code PIN mobile money',
    '3. Confirmez le paiement',
    '4. Attendez la confirmation'
  ];
};

export const mokoPaymentService = {
  initiatePayment,
  subscribeToPaymentStatus,
  getPaymentStatus,
  detectProvider,
  validatePhoneNumber,
  formatPhoneNumber,
  getProviderName,
  getPaymentInstructions
};
