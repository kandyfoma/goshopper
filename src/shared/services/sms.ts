/**
 * SMS Verification Service
 * Handles OTP sending and verification via Firebase Cloud Functions
 */

import {getFunctionsInstance} from './firebase/config';

// Result types
interface SendOTPResult {
  success: boolean;
  sessionId?: string;
  type?: 'phone' | 'email';
  expiresIn?: number;
  message?: string;
  error?: string;
}

interface VerifyOTPResult {
  success: boolean;
  verified?: boolean;
  verificationToken?: string;
  identifier?: string;
  type?: 'phone' | 'email';
  message?: string;
  error?: string;
  token?: string; // Alias for verificationToken
}

class SMSService {
  private functions = getFunctionsInstance();

  /**
   * Send OTP to phone number (for DRC users)
   * Calls the sendVerificationCode Cloud Function
   * 
   * @param phoneNumber - Full phone number with country code (e.g., +243999999001)
   * @param countryCode - Optional country code (e.g., 'CD' for DRC)
   * @param language - Preferred language ('fr' or 'en')
   * @returns Promise with success status and session ID
   */
  async sendOTP(
    phoneNumber: string,
    countryCode?: string,
    language: string = 'fr'
  ): Promise<SendOTPResult> {
    try {
      // Determine if user is in DRC based on phone prefix
      const isDRC = phoneNumber.startsWith('+243') || phoneNumber.startsWith('243');
      
      console.log(`📱 Sending OTP to ${phoneNumber} (DRC: ${isDRC})`);

      // Call the Cloud Function
      const sendVerificationCode = this.functions.httpsCallable('sendVerificationCode');
      const result = await sendVerificationCode({
        phoneNumber: isDRC ? phoneNumber : undefined,
        email: !isDRC ? undefined : undefined, // For now, we only support phone
        countryCode: countryCode || (isDRC ? 'CD' : 'INTL'),
        language,
      });

      const data = result.data as SendOTPResult;

      if (data.success) {
        console.log('✅ OTP sent successfully:', {
          sessionId: data.sessionId,
          type: data.type,
          expiresIn: data.expiresIn,
        });
        return {
          success: true,
          sessionId: data.sessionId,
          type: data.type,
          expiresIn: data.expiresIn,
          message: data.message,
        };
      } else {
        console.error('❌ Failed to send OTP:', data.error);
        return {
          success: false,
          error: data.error || 'Failed to send verification code',
        };
      }
    } catch (error: any) {
      console.error('❌ Error sending OTP:', error);
      
      // Parse Firebase Functions error
      let errorMessage = 'Une erreur est survenue lors de l\'envoi du code';
      if (error.code === 'functions/invalid-argument') {
        errorMessage = 'Numéro de téléphone invalide';
      } else if (error.code === 'functions/resource-exhausted') {
        errorMessage = error.message || 'Veuillez attendre avant de réessayer';
      } else if (error.code === 'functions/internal') {
        errorMessage = 'Erreur serveur. Veuillez réessayer';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify OTP code entered by user
   * Calls the verifyCode Cloud Function
   * 
   * @param phoneNumber - Phone number (unused, kept for compatibility)
   * @param code - 6-digit OTP code entered by user
   * @param sessionId - Session ID from sendOTP response
   * @returns Promise with verification result and token
   */
  async verifyOTP(
    phoneNumber: string,
    code: string,
    sessionId?: string
  ): Promise<VerifyOTPResult> {
    try {
      console.log(`🔐 Verifying OTP code for session: ${sessionId}`);

      // Call the Cloud Function
      const verifyCode = this.functions.httpsCallable('verifyCode');
      const result = await verifyCode({
        sessionId,
        code: code.trim(),
      });

      const data = result.data as VerifyOTPResult;

      if (data.success && data.verified) {
        console.log('✅ OTP verified successfully:', {
          identifier: data.identifier,
          type: data.type,
        });
        return {
          success: true,
          verified: true,
          verificationToken: data.verificationToken,
          token: data.verificationToken, // Alias for compatibility
          identifier: data.identifier,
          type: data.type,
          message: data.message,
        };
      } else {
        console.error('❌ OTP verification failed');
        return {
          success: false,
          verified: false,
          error: data.message || 'Code de vérification incorrect',
        };
      }
    } catch (error: any) {
      console.error('❌ Error verifying OTP:', error);
      
      // Parse Firebase Functions error
      let errorMessage = 'Code de vérification incorrect';
      if (error.code === 'functions/not-found') {
        errorMessage = 'Session expirée. Demandez un nouveau code';
      } else if (error.code === 'functions/invalid-argument') {
        errorMessage = error.message || 'Code invalide';
      } else if (error.code === 'functions/deadline-exceeded') {
        errorMessage = 'Code expiré. Demandez un nouveau code';
      } else if (error.code === 'functions/resource-exhausted') {
        errorMessage = 'Trop de tentatives. Demandez un nouveau code';
      } else if (error.code === 'functions/failed-precondition') {
        errorMessage = 'Session déjà vérifiée';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        verified: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Resend OTP code (calls sendOTP again)
   * 
   * @param phoneNumber - Phone number to resend OTP to
   * @param countryCode - Optional country code
   * @param language - Preferred language
   * @returns Promise with new session ID
   */
  async resendOTP(
    phoneNumber: string,
    countryCode?: string,
    language: string = 'fr'
  ): Promise<SendOTPResult> {
    console.log('🔄 Resending OTP...');
    return this.sendOTP(phoneNumber, countryCode, language);
  }
}

// Export singleton instance
export const smsService = new SMSService();
