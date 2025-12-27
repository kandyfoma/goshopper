/**
 * Moko Payment Service
 * Integrates with Africanite Payment Hub (Railway + FreshPay PayDRC API)
 */

import 'react-native-url-polyfill/auto';

// Payment Hub Configuration - Use Railway endpoint
const PAYMENT_API_URL = 'https://web-production-a4586.up.railway.app/initiate-payment';
const PAYMENT_STATUS_URL = 'https://web-production-a4586.up.railway.app/payment-status';

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
    
    if (!response.ok) {
      throw new Error(data.error || 'Échec de l\'initiation du paiement');
    }

    // Use reference as the transaction ID (this is what Railway generates and saves to Supabase)
    const txId = data.transaction_id || data.reference;
    
    return {
      success: true,
      transaction_id: txId,
      message: data.message || 'Payment initiated successfully',
      instructions: data.instructions || 'Please check your phone and enter your PIN to complete the payment.'
    };
  } catch (error: any) {
    console.error('Payment initiation failed:', error);
    throw new Error(error.message || 'Erreur lors de l\'initiation du paiement');
  }
};

/**
 * Subscribe to payment status updates by polling Railway
 * Railway has the Supabase service key, GoShopper just polls Railway's status endpoint
 */
export const subscribeToPaymentStatus = (
  transactionId: string,
  onStatusChange: (status: PaymentStatus, details?: any) => void,
  onProgressUpdate?: (message: string, pollCount: number) => void
): (() => void) => {
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let isResolved = false;
  let pollCount = 0;
  const maxPolls = 120; // 10 minutes max (120 * 5 seconds)

  // Progress messages based on elapsed time - more granular updates
  const getProgressMessage = (count: number): string => {
    const seconds = count * 5;
    if (seconds < 10) return '📱 Vérifiez votre téléphone...';
    if (seconds < 20) return '🔐 Entrez votre code PIN...';
    if (seconds < 35) return '⏳ En attente de confirmation...';
    if (seconds < 50) return '🔄 Traitement en cours...';
    if (seconds < 70) return '📡 Communication avec l\'opérateur...';
    if (seconds < 90) return '✅ Validation du paiement...';
    if (seconds < 120) return '🔍 Vérification finale...';
    const minutes = Math.floor(seconds / 60);
    return `⏱️ Attente prolongée (${minutes}min)...`;
  };

  // Poll Railway's status endpoint every 5 seconds
  
  // Initial delay to give Railway/FreshPay time to process
  const startPolling = () => {
    pollInterval = setInterval(async () => {
      if (isResolved) return;
      
      pollCount++;
      
      // Update progress message
      if (onProgressUpdate) {
        onProgressUpdate(getProgressMessage(pollCount), pollCount);
      }
      
      // Stop polling after max attempts
      if (pollCount >= maxPolls) {
        isResolved = true;
        onStatusChange('FAILED', { error: 'Timeout - paiement non confirmé' });
        if (pollInterval) clearInterval(pollInterval);
        return;
      }
      
      try {
        const result = await getPaymentStatus(transactionId);
        
        // Only log every 6 polls (30 seconds) or when we get a result
        if (result || pollCount % 6 === 0) {
          if (result && result.status !== 'PENDING') {
            isResolved = true;
            onStatusChange(result.status, result.details);
            if (pollInterval) clearInterval(pollInterval);
          }
        }
      } catch (error) {
        // Silent - polling continues
      }
    }, 5000);
  };
  
  // Start polling after 2 seconds
  setTimeout(startPolling, 2000);

  // Return cleanup function
  return () => {
    isResolved = true;
    if (pollInterval) clearInterval(pollInterval);
  };
};

/**
 * Get payment status from Railway's status endpoint
 * Railway queries Supabase internally with the service key
 */
export const getPaymentStatus = async (transactionId: string): Promise<{
  status: PaymentStatus;
  details: any;
} | null> => {
  try {
    const url = `${PAYMENT_STATUS_URL}/${transactionId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      // 404 is expected while waiting for webhook
      return null;
    }

    const data = await response.json();
    
    return {
      status: data.status as PaymentStatus,
      details: data
    };
  } catch (error) {
    console.error('❌ Error fetching payment status:', error);
    // Suppress logging for network errors during polling
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
