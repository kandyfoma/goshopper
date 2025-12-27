// Phone number validation and checking service
import firestore from '@react-native-firebase/firestore';
import { APP_ID } from '../firebase/config';

export class PhoneService {
  /**
   * Format phone number to E.164 format
   * Handles numbers starting with 0 or without country code
   */
  static formatPhoneNumber(countryCode: string, phoneNumber: string): string {
    // Remove all non-numeric characters
    let cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    
    // Handle numbers starting with 0 (remove the leading 0)
    if (cleanNumber.startsWith('0')) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    // Return formatted E.164 number
    return `${countryCode}${cleanNumber}`;
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    // Remove spaces and special characters for validation
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Check if it's a valid E.164 format (+ followed by 1-15 digits)
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    return phoneRegex.test(cleanNumber);
  }

  /**
   * Check if phone number already exists in database
   */
  static async checkPhoneExists(phoneNumber: string): Promise<boolean> {
    try {
      console.log('🔍 Checking if phone exists:', phoneNumber);
      
      // Query the correct users collection path: artifacts/{APP_ID}/users
      const usersRef = firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('users');
      
      const snapshot = await usersRef
        .where('phoneNumber', '==', phoneNumber)
        .limit(1)
        .get();
      
      const exists = !snapshot.empty;
      console.log(`📱 Phone ${phoneNumber} exists:`, exists);
      
      if (exists && !snapshot.empty) {
        console.log('👤 Existing user found with userId:', snapshot.docs[0].id);
      }
      
      return exists;
    } catch (error) {
      console.error('❌ Error checking phone existence:', error);
      // In case of error, assume phone doesn't exist to allow registration attempt
      return false;
    }
  }

  /**
   * Get phone number display format for user interface
   */
  static getDisplayFormat(countryCode: string, phoneNumber: string): string {
    const formatted = this.formatPhoneNumber(countryCode, phoneNumber);
    
    // Add spacing for better readability
    if (countryCode === '+243') { // DRC format
      return formatted.replace(/(\+243)(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
    } else if (countryCode === '+33') { // France format
      return formatted.replace(/(\+33)(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5 $6');
    }
    
    // Default format
    return formatted.replace(/(\+\d{1,3})(\d{2,3})(\d{3,4})(\d{4})/, '$1 $2 $3 $4');
  }
}

export default PhoneService;