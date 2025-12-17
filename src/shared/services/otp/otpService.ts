// OTP Service - Development/Testing Implementation
// Logs OTP codes to console for testing without SMS provider

interface OTPRecord {
  phoneNumber: string;
  code: string;
  createdAt: Date;
  expiresAt: Date;
  verified: boolean;
}

class OTPService {
  private otpStore: Map<string, OTPRecord> = new Map();
  private OTP_LENGTH = 6;
  private OTP_EXPIRY_MINUTES = 5;

  /**
   * Generate and send OTP code
   * In production, this would integrate with SMS provider (Twilio, AWS SNS, etc.)
   */
  async sendOTP(phoneNumber: string): Promise<{success: boolean; message: string}> {
    try {
      // Generate 6-digit OTP
      const code = this.generateOTP();
      
      // Calculate expiry time
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + this.OTP_EXPIRY_MINUTES * 60000);
      
      // Store OTP
      const otpRecord: OTPRecord = {
        phoneNumber,
        code,
        createdAt,
        expiresAt,
        verified: false,
      };
      
      this.otpStore.set(phoneNumber, otpRecord);
      
      // Log OTP for development/testing
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 SMS OTP SERVICE - DEVELOPMENT MODE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📞 Phone Number: ${phoneNumber}`);
      console.log(`🔑 OTP Code: ${code}`);
      console.log(`⏰ Generated: ${createdAt.toLocaleString()}`);
      console.log(`⏳ Expires: ${expiresAt.toLocaleString()}`);
      console.log(`⌛ Valid for: ${this.OTP_EXPIRY_MINUTES} minutes`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📨 In production, SMS would be sent via provider');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // In production, integrate with SMS provider here:
      // await this.sendViaTwilio(phoneNumber, code);
      // await this.sendViaAWS(phoneNumber, code);
      // await this.sendViaAfricasTalking(phoneNumber, code);
      
      return {
        success: true,
        message: `Code de vérification envoyé à ${phoneNumber}`,
      };
    } catch (error) {
      console.error('❌ [OTP Service] Failed to send OTP:', error);
      return {
        success: false,
        message: 'Échec de l\'envoi du code',
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(phoneNumber: string, code: string): Promise<{success: boolean; message: string}> {
    try {
      const otpRecord = this.otpStore.get(phoneNumber);
      
      console.log('\n🔍 [OTP Service] Verifying OTP...');
      console.log(`📞 Phone: ${phoneNumber}`);
      console.log(`🔑 Code entered: ${code}`);
      
      if (!otpRecord) {
        console.log('❌ No OTP found for this number');
        return {
          success: false,
          message: 'Aucun code trouvé. Demandez un nouveau code.',
        };
      }
      
      if (otpRecord.verified) {
        console.log('❌ OTP already verified');
        return {
          success: false,
          message: 'Ce code a déjà été utilisé.',
        };
      }
      
      // Check expiry
      const now = new Date();
      if (now > otpRecord.expiresAt) {
        console.log('❌ OTP expired');
        this.otpStore.delete(phoneNumber);
        return {
          success: false,
          message: 'Code expiré. Demandez un nouveau code.',
        };
      }
      
      // Verify code
      if (otpRecord.code !== code) {
        console.log('❌ Invalid OTP code');
        return {
          success: false,
          message: 'Code incorrect. Veuillez réessayer.',
        };
      }
      
      // Mark as verified
      otpRecord.verified = true;
      this.otpStore.set(phoneNumber, otpRecord);
      
      console.log('✅ OTP verified successfully!\n');
      
      return {
        success: true,
        message: 'Vérification réussie',
      };
    } catch (error) {
      console.error('❌ [OTP Service] Verification failed:', error);
      return {
        success: false,
        message: 'Erreur de vérification',
      };
    }
  }

  /**
   * Resend OTP (invalidate old one and send new)
   */
  async resendOTP(phoneNumber: string): Promise<{success: boolean; message: string}> {
    console.log('\n🔄 [OTP Service] Resending OTP...');
    
    // Delete old OTP
    this.otpStore.delete(phoneNumber);
    
    // Send new OTP
    return await this.sendOTP(phoneNumber);
  }

  /**
   * Generate random 6-digit OTP
   */
  private generateOTP(): string {
    const otp = Math.floor(100000 + Math.random() * 900000);
    return otp.toString();
  }

  /**
   * Get remaining time for OTP
   */
  getRemainingTime(phoneNumber: string): number {
    const otpRecord = this.otpStore.get(phoneNumber);
    if (!otpRecord) {
      return 0;
    }
    
    const now = new Date();
    const remaining = otpRecord.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(remaining / 1000)); // Return seconds
  }

  /**
   * Clean up expired OTPs
   */
  cleanupExpiredOTPs(): void {
    const now = new Date();
    for (const [phoneNumber, otpRecord] of this.otpStore.entries()) {
      if (now > otpRecord.expiresAt) {
        this.otpStore.delete(phoneNumber);
        console.log(`🧹 Cleaned up expired OTP for ${phoneNumber}`);
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRODUCTION SMS PROVIDER INTEGRATIONS (Commented for reference)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /*
  // Twilio Integration Example
  private async sendViaTwilio(phoneNumber: string, code: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);
    
    await client.messages.create({
      body: `Votre code de vérification GoShopperAI est: ${code}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
  }
  */

  /*
  // AWS SNS Integration Example
  private async sendViaAWS(phoneNumber: string, code: string): Promise<void> {
    const AWS = require('aws-sdk');
    const sns = new AWS.SNS();
    
    await sns.publish({
      Message: `Votre code de vérification GoShopperAI est: ${code}`,
      PhoneNumber: phoneNumber,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional'
        }
      }
    }).promise();
  }
  */

  /*
  // Africa's Talking Integration Example (Good for DRC)
  private async sendViaAfricasTalking(phoneNumber: string, code: string): Promise<void> {
    const AfricasTalking = require('africastalking')({
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME
    });
    
    const sms = AfricasTalking.SMS;
    await sms.send({
      to: phoneNumber,
      message: `Votre code de vérification GoShopperAI est: ${code}`
    });
  }
  */
}

// Export singleton instance
export const otpService = new OTPService();

// Run cleanup every 5 minutes
setInterval(() => {
  otpService.cleanupExpiredOTPs();
}, 5 * 60 * 1000);
