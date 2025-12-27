// SMS Service - Placeholder implementation with security features
// TODO: Replace with actual SMS provider (Twilio, AWS SNS, etc.)

interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

// Constants for OTP security
const OTP_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between resends
const MAX_RESEND_PER_HOUR = 5;

class SMSService {
  private otpStore = new Map<string, OTPData>();
  private resendTracker = new Map<string, number[]>(); // tracks resend timestamps per phone

  /**
   * Send OTP via SMS (placeholder)
   */
  async sendOTP(phoneNumber: string): Promise<{ success: boolean; error?: string; cooldownSeconds?: number }> {
    try {
      // Check rate limiting for resends
      const rateLimitCheck = this.checkResendRateLimit(phoneNumber);
      if (!rateLimitCheck.allowed) {
        return { 
          success: false, 
          error: rateLimitCheck.error,
          cooldownSeconds: rateLimitCheck.cooldownSeconds
        };
      }

      // Check if there's an existing non-expired OTP (prevent spam)
      const existingOTP = this.otpStore.get(phoneNumber);
      if (existingOTP && existingOTP.expiresAt > Date.now()) {
        const cooldownRemaining = Math.ceil((existingOTP.lastSentAt + OTP_RESEND_COOLDOWN_MS - Date.now()) / 1000);
        if (cooldownRemaining > 0) {
          return {
            success: false,
            error: `Veuillez attendre ${cooldownRemaining} secondes avant de renvoyer`,
            cooldownSeconds: cooldownRemaining
          };
        }
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP with expiration and attempt tracking
      this.otpStore.set(phoneNumber, {
        code: otp,
        expiresAt: Date.now() + OTP_EXPIRATION_MS,
        attempts: 0,
        lastSentAt: Date.now()
      });

      // Track resend for rate limiting
      this.trackResend(phoneNumber);
      
      // TODO: Replace with actual SMS provider
      console.log(`📱 SMS OTP Sent to ${phoneNumber}: ${otp}`);
      console.log(`🔐 [SMS Service] OTP for ${phoneNumber} is: ${otp}`);
      console.log(`⏰ OTP expires at: ${new Date(Date.now() + OTP_EXPIRATION_MS).toISOString()}`);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to send OTP:', error);
      return { 
        success: false, 
        error: 'Échec de l\'envoi du SMS. Veuillez réessayer.' 
      };
    }
  }

  /**
   * Check rate limit for OTP resends
   */
  private checkResendRateLimit(phoneNumber: string): { allowed: boolean; error?: string; cooldownSeconds?: number } {
    const timestamps = this.resendTracker.get(phoneNumber) || [];
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Filter to only timestamps within the last hour
    const recentTimestamps = timestamps.filter(t => t > oneHourAgo);
    this.resendTracker.set(phoneNumber, recentTimestamps);

    if (recentTimestamps.length >= MAX_RESEND_PER_HOUR) {
      const oldestRecent = Math.min(...recentTimestamps);
      const cooldownSeconds = Math.ceil((oldestRecent + (60 * 60 * 1000) - Date.now()) / 1000);
      return {
        allowed: false,
        error: `Trop de tentatives. Réessayez dans ${Math.ceil(cooldownSeconds / 60)} minutes.`,
        cooldownSeconds
      };
    }

    return { allowed: true };
  }

  /**
   * Track resend timestamp
   */
  private trackResend(phoneNumber: string): void {
    const timestamps = this.resendTracker.get(phoneNumber) || [];
    timestamps.push(Date.now());
    this.resendTracker.set(phoneNumber, timestamps);
  }

  /**
   * Verify OTP with attempt limiting
   */
  verifyOTP(phoneNumber: string, enteredOTP: string): {success: boolean; error?: string; token?: string; attemptsRemaining?: number} {
    const otpData = this.otpStore.get(phoneNumber);
    
    // Check if OTP exists
    if (!otpData) {
      console.log(`❌ No OTP found for ${phoneNumber}`);
      return { success: false, error: 'Code de vérification expiré ou invalide' };
    }

    // Check if OTP has expired
    if (otpData.expiresAt < Date.now()) {
      console.log(`❌ OTP expired for ${phoneNumber}`);
      this.otpStore.delete(phoneNumber);
      return { success: false, error: 'Code de vérification expiré. Veuillez en demander un nouveau.' };
    }

    // Check if max attempts exceeded
    if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
      console.log(`❌ Max OTP attempts exceeded for ${phoneNumber}`);
      this.otpStore.delete(phoneNumber);
      return { success: false, error: 'Trop de tentatives incorrectes. Veuillez demander un nouveau code.' };
    }

    // Increment attempt counter
    otpData.attempts++;
    this.otpStore.set(phoneNumber, otpData);

    const isValid = otpData.code === enteredOTP;
    
    if (isValid) {
      console.log(`✅ OTP verified successfully for ${phoneNumber}`);
      // Clear OTP after successful verification
      this.otpStore.delete(phoneNumber);
      return { success: true, token: 'verified_' + Date.now() };
    } else {
      const attemptsRemaining = MAX_OTP_ATTEMPTS - otpData.attempts;
      console.log(`❌ Invalid OTP for ${phoneNumber}. Attempts remaining: ${attemptsRemaining}`);
      
      if (attemptsRemaining <= 0) {
        this.otpStore.delete(phoneNumber);
        return { success: false, error: 'Trop de tentatives incorrectes. Veuillez demander un nouveau code.' };
      }
      
      return { 
        success: false, 
        error: `Code incorrect. ${attemptsRemaining} tentative${attemptsRemaining > 1 ? 's' : ''} restante${attemptsRemaining > 1 ? 's' : ''}.`,
        attemptsRemaining
      };
    }
  }

  /**
   * Clear OTP for a phone number
   */
  clearOTP(phoneNumber: string): void {
    this.otpStore.delete(phoneNumber);
    console.log(`🗑️ Cleared OTP for ${phoneNumber}`);
  }

  /**
   * Get remaining time for OTP (useful for UI countdown)
   */
  getOTPRemainingTime(phoneNumber: string): number {
    const otpData = this.otpStore.get(phoneNumber);
    if (!otpData) return 0;
    
    const remaining = Math.max(0, otpData.expiresAt - Date.now());
    return Math.ceil(remaining / 1000); // Return seconds
  }

  /**
   * Check if can resend OTP
   */
  canResendOTP(phoneNumber: string): { canResend: boolean; cooldownSeconds: number } {
    const otpData = this.otpStore.get(phoneNumber);
    if (!otpData) {
      return { canResend: true, cooldownSeconds: 0 };
    }

    const cooldownRemaining = Math.max(0, otpData.lastSentAt + OTP_RESEND_COOLDOWN_MS - Date.now());
    return {
      canResend: cooldownRemaining <= 0,
      cooldownSeconds: Math.ceil(cooldownRemaining / 1000)
    };
  }
}

export const smsService = new SMSService();