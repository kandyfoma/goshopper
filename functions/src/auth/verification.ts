/**
 * Two-Factor Authentication Cloud Functions
 * Handles phone verification (DRC) and email verification (international)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import {config, collections} from '../config';

const db = admin.firestore();

// Verification code settings
const CODE_EXPIRY_MINUTES = 15;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Generate a random verification code
 */
function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Check if a phone number is a test number
 */
function isTestPhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber) return false;
  return phoneNumber.startsWith(config.testing.phonePrefix); // +243999999XXX
}

/**
 * Get the verification code for a phone number
 * Test numbers always get the fixed test OTP
 */
function getVerificationCode(phoneNumber?: string): string {
  if (phoneNumber && isTestPhoneNumber(phoneNumber)) {
    console.log(`🧪 TEST MODE: Using fixed OTP for test number: ${phoneNumber}`);
    return config.testing.testOTP;
  }
  return generateVerificationCode();
}

/**
 * Generate a unique verification session ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Send SMS via Africa's Talking or similar SMS gateway (for DRC)
 */
async function sendSMS(phoneNumber: string, code: string, userName?: string): Promise<{success: boolean; error?: string}> {
  // Check if this is a test phone number
  if (isTestPhoneNumber(phoneNumber)) {
    console.log(`🧪 TEST MODE: Skipping SMS send for test number: ${phoneNumber}`);
    console.log(`🧪 TEST MODE: Test OTP is: ${code} (always 123456)`);
    console.log(`🧪 TEST MODE: SMS cost saved: $0.05`);
    return {success: true}; // Pretend SMS was sent successfully
  }

  try {
    // Africa's Talking SMS API - matching LaboMedPlus implementation
    const greeting = userName ? `Bonjour ${userName},\n\n` : '';
    const message = `${greeting}GoShopper: Code ${code}. Valide ${CODE_EXPIRY_MINUTES} minutes.

goshopper.app`;
    
    // Get credentials - try multiple sources
    const username = process.env.AFRICASTALKING_USERNAME || config.sms.username || 'kandy';
    const apiKey = process.env.AFRICASTALKING_API_KEY || config.sms.apiKey || '';
    const baseUrl = config.sms.baseUrl || 'https://api.africastalking.com';
    
    console.log(`📤 Sending SMS to ${phoneNumber} via Africa's Talking`);
    console.log(`📝 Message: ${message.substring(0, 50)}...`);
    console.log(`🔑 Username: ${username}`);
    console.log(`🔑 API Key: ${apiKey ? apiKey.substring(0, 15) + '...' : 'NOT SET'}`);
    console.log(`🌐 Base URL: ${baseUrl}`);
    console.log(`📧 Sender ID: ${config.sms.senderId || 'NOT SET'}`);
    
    if (!apiKey) {
      console.error('❌ API Key is empty or not set!');
      return {success: false, error: 'API Key not configured'};
    }
    
    // Build request body - omit 'from' field if senderId is not set or is default
    const bodyParams: Record<string, string> = {
      username: username,
      to: phoneNumber,
      message: message,
    };
    
    // Only add 'from' if we have a valid sender ID (not the default)
    // Africa's Talking will use a default shortcode if 'from' is omitted
    if (config.sms.senderId && config.sms.senderId !== 'GoShopperAI') {
      bodyParams.from = config.sms.senderId;
    } else {
      console.log('⚠️ Using default Africa\'s Talking sender ID (no custom sender)');
    }
    
    const requestBody = new URLSearchParams(bodyParams).toString();
    
    console.log(`📦 Request body: ${requestBody.substring(0, 100)}...`);
    
    const response = await fetch(`${baseUrl}/version1/messaging`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'apiKey': apiKey,
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ SMS API returned status ${response.status}: ${errorText}`);
      return {success: false, error: `API returned ${response.status}: ${errorText.substring(0, 100)}`};
    }

    const result = await response.json();
    console.log('✅ SMS API Response:', JSON.stringify(result, null, 2));
    
    // Check response format: { SMSMessageData: { Recipients: [{ status: 'Success' }] } }
    const recipients = result.SMSMessageData?.Recipients || [];
    if (recipients.length > 0) {
      const status = recipients[0].status;
      const statusCode = recipients[0].statusCode;
      console.log(`📊 SMS Status: ${status}, Code: ${statusCode}`);
      
      // statusCode 101 = Success, or status = 'Success'
      if (statusCode === 101 || status === 'Success') {
        return {success: true};
      } else {
        return {success: false, error: `SMS failed with status: ${status} (${statusCode})`};
      }
    }
    
    console.error('❌ No recipients in SMS response');
    return {success: false, error: 'No recipients in API response'};
  } catch (error) {
    console.error('❌ SMS sending error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error details:', errorMsg);
    return {success: false, error: `Exception: ${errorMsg}`};
  }
}

/**
 * Send verification email via SendGrid or Firebase
 */
async function sendVerificationEmail(
  email: string,
  code: string,
  language: string = 'en',
): Promise<boolean> {
  try {
    const subject =
      language === 'fr'
        ? 'Code de vérification GoShopper'
        : 'GoShopper Verification Code';

    const htmlContent =
      language === 'fr'
        ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">GoShopper</h2>
          <p>Bonjour,</p>
          <p>Votre code de vérification est:</p>
          <h1 style="font-size: 36px; letter-spacing: 8px; color: #333; background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px;">
            ${code}
          </h1>
          <p>Ce code expire dans <strong>${CODE_EXPIRY_MINUTES} minutes</strong>.</p>
          <p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} GoShopperAI</p>
        </div>
      `
        : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">GoShopper</h2>
          <p>Hello,</p>
          <p>Your verification code is:</p>
          <h1 style="font-size: 36px; letter-spacing: 8px; color: #333; background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px;">
            ${code}
          </h1>
          <p>This code expires in <strong>${CODE_EXPIRY_MINUTES} minutes</strong>.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} GoShopper</p>
        </div>
      `;

    // Use SendGrid
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.sendgrid.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{to: [{email}]}],
        from: {email: config.sendgrid.fromEmail, name: 'GoShopper'},
        subject,
        content: [{type: 'text/html', value: htmlContent}],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

/**
 * Detect if user is in DRC based on phone number or IP
 */
function isInDRC(phoneNumber?: string, countryCode?: string): boolean {
  // Check phone number prefix
  if (phoneNumber) {
    const drcPrefixes = ['+243', '243', '00243'];
    return drcPrefixes.some(prefix => phoneNumber.startsWith(prefix));
  }

  // Check country code
  if (countryCode) {
    return countryCode.toUpperCase() === 'CD';
  }

  return false;
}

/**
 * Send verification code (phone for DRC, email for international)
 */
export const sendVerificationCode = functions
  .region(config.app.region)
  .runWith({
    secrets: ['AFRICASTALKING_API_KEY', 'AFRICASTALKING_USERNAME'],
  })
  .https.onCall(async (data, context) => {
    const {phoneNumber, email, countryCode, language = 'fr'} = data;

    // Determine if user is in DRC
    const inDRC = isInDRC(phoneNumber, countryCode);

    // Validate input based on location
    if (inDRC && !phoneNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number is required for users in DRC',
      );
    }

    if (!inDRC && !email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email is required for users outside DRC',
      );
    }

    // Validate phone number format for DRC
    if (inDRC && phoneNumber) {
      const phoneRegex = /^(\+?243|0)?[89]\d{8}$/;
      if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid DRC phone number format',
        );
      }
    }

    // Validate email format
    if (!inDRC && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid email format',
        );
      }
    }

    const identifier = inDRC ? phoneNumber : email;
    const verificationType = inDRC ? 'phone' : 'email';

    try {
      // Check for existing verification to prevent spam AND enforce daily limit
      console.log(`📋 Checking for existing verifications for: ${identifier}`);
      try {
        const existingQuery = await db
          .collection('verifications')
          .where('identifier', '==', identifier)
          .where('verified', '==', false)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          const existing = existingQuery.docs[0].data();
          const createdAt = existing.createdAt.toDate();
          const secondsSinceCreation = (Date.now() - createdAt.getTime()) / 1000;

          if (secondsSinceCreation < RESEND_COOLDOWN_SECONDS) {
            const remainingSeconds = Math.ceil(
              RESEND_COOLDOWN_SECONDS - secondsSinceCreation,
            );
            throw new functions.https.HttpsError(
              'resource-exhausted',
              `Please wait ${remainingSeconds} seconds before requesting a new code`,
            );
          }
        }
      } catch (indexError) {
        console.warn('⚠️ Index query failed, skipping spam check:', indexError);
        // Continue without spam check if index isn't ready
      }

      // Enforce daily OTP limit (3 per day per user/device)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      try {
        const todayVerifications = await db
          .collection('verifications')
          .where('identifier', '==', identifier)
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
          .get();

        if (todayVerifications.size >= 3) {
          console.warn(`⚠️ Daily OTP limit reached for ${identifier}`);
          throw new functions.https.HttpsError(
            'resource-exhausted',
            'Limite quotidienne atteinte. Vous avez demande 3 codes aujourd\'hui. Reessayez demain.',
          );
        }
      } catch (limitError) {
        if (limitError instanceof functions.https.HttpsError) {
          throw limitError;
        }
        console.warn('⚠️ Daily limit check failed:', limitError);
        // Continue if limit check fails
      }

      // Generate verification code and session
      const code = getVerificationCode(inDRC ? phoneNumber : undefined);
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

      // Store verification record
      await db
        .collection('verifications')
        .doc(sessionId)
        .set({
          sessionId,
          identifier,
          type: verificationType,
          countryCode: countryCode || (inDRC ? 'CD' : 'INTL'),
          codeHash: crypto.createHash('sha256').update(code).digest('hex'),
          attempts: 0,
          verified: false,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Send verification code
      let smsResult;
      let emailResult;
      if (inDRC) {
        // Try to get user's name from the database
        let userName: string | undefined;
        try {
          const userQuery = await db
            .collection('artifacts')
            .doc(config.app.id)
            .collection('users')
            .where('phoneNumber', '==', phoneNumber)
            .limit(1)
            .get();
          
          if (!userQuery.empty) {
            const userData = userQuery.docs[0].data();
            if (userData.firstName && userData.surname) {
              userName = `${userData.firstName} ${userData.surname}`;
            } else if (userData.firstName) {
              userName = userData.firstName;
            }
          }
        } catch (nameError) {
          console.warn('⚠️ Could not fetch user name:', nameError);
          // Continue without name
        }

        smsResult = await sendSMS(phoneNumber!, code, userName);
        if (!smsResult.success) {
          // Delete the verification record if sending failed
          await db.collection('verifications').doc(sessionId).delete();
          const errorDetails = smsResult.error || 'Unknown error';
          console.error(`❌ SMS sending failed: ${errorDetails}`);
          throw new functions.https.HttpsError(
            'internal',
            `SMS failed: ${errorDetails}`,
          );
        }
      } else {
        emailResult = await sendVerificationEmail(email!, code, language);
        if (!emailResult) {
          // Delete the verification record if sending failed
          await db.collection('verifications').doc(sessionId).delete();
          throw new functions.https.HttpsError(
            'internal',
            'Failed to send verification email',
          );
        }
      }

      return {
        success: true,
        sessionId,
        type: verificationType,
        expiresIn: CODE_EXPIRY_MINUTES * 60,
      };
    } catch (error) {
      console.error('Send verification code error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to send verification code',
      );
    }
  });

/**
 * Verify the code entered by user
 */
export const verifyCode = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    const {sessionId, code} = data;

    if (!sessionId || !code) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Session ID and code are required',
      );
    }

    try {
      const verificationRef = db.collection('verifications').doc(sessionId);
      const verificationDoc = await verificationRef.get();

      if (!verificationDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Verification session not found or expired',
        );
      }

      const verification = verificationDoc.data()!;

      // Check if already verified
      if (verification.verified) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This session has already been verified',
        );
      }

      // Check if expired
      const expiresAt = verification.expiresAt.toDate();
      if (expiresAt < new Date()) {
        await verificationRef.delete();
        throw new functions.https.HttpsError(
          'deadline-exceeded',
          'Verification code has expired',
        );
      }

      // Check attempts
      if (verification.attempts >= MAX_ATTEMPTS) {
        await verificationRef.delete();
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Maximum verification attempts exceeded',
        );
      }

      // Verify code
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');

      if (codeHash !== verification.codeHash) {
        // Increment attempts
        await verificationRef.update({
          attempts: admin.firestore.FieldValue.increment(1),
        });

        const remainingAttempts = MAX_ATTEMPTS - verification.attempts - 1;
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid code. ${remainingAttempts} attempts remaining`,
        );
      }

      // Code is valid - mark as verified
      await verificationRef.update({
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // If this is phone verification, mark the user's phone as verified
      if (verification.type === 'phone') {
        try {
          const phoneNumber = verification.identifier;
          const usersRef = db
            .collection('artifacts')
            .doc(config.app.id)
            .collection('users');
          const userQuery = await usersRef.where('phoneNumber', '==', phoneNumber).limit(1).get();
          
          if (!userQuery.empty) {
            const userId = userQuery.docs[0].id;
            await usersRef.doc(userId).update({
              phoneVerified: true,
              verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`✅ Phone marked as verified for user: ${userId}`);
          }
        } catch (updateError) {
          console.warn('⚠️ Could not mark phone as verified:', updateError);
          // Continue - verification is still valid
        }
      }

      // Generate verification token for registration completion
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes

      await verificationRef.update({
        verificationToken,
        tokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiresAt),
      });

      return {
        success: true,
        verified: true,
        verificationToken,
        identifier: verification.identifier,
        type: verification.type,
        message: 'Verification successful',
      };
    } catch (error) {
      console.error('Verify code error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError('internal', 'Failed to verify code');
    }
  });

/**
 * Complete registration after verification
 */
export const completeRegistration = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {verificationToken, displayName} = data;

    if (!verificationToken) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Verification token is required',
      );
    }

    try {
      // Find verification by token
      const verificationQuery = await db
        .collection('verifications')
        .where('verificationToken', '==', verificationToken)
        .where('verified', '==', true)
        .limit(1)
        .get();

      if (verificationQuery.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'Invalid or expired verification token',
        );
      }

      const verificationDoc = verificationQuery.docs[0];
      const verification = verificationDoc.data();

      // Check token expiry
      const tokenExpiresAt = verification.tokenExpiresAt.toDate();
      if (tokenExpiresAt < new Date()) {
        throw new functions.https.HttpsError(
          'deadline-exceeded',
          'Verification token has expired',
        );
      }

      // Update user profile with verified contact
      const userProfileRef = db.doc(`${collections.users}/${userId}/profile`);
      const updateData: Record<string, any> = {
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        countryCode: verification.countryCode,
        isInDRC: verification.countryCode === 'CD',
        registrationDate: admin.firestore.FieldValue.serverTimestamp(),
        upgradeProposalSent: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (verification.type === 'phone') {
        updateData.phoneNumber = verification.identifier;
        updateData.phoneVerified = true;
      } else {
        updateData.email = verification.identifier;
        updateData.emailVerified = true;
      }

      if (displayName) {
        updateData.displayName = displayName;
      }

      await userProfileRef.set(updateData, {merge: true});

      // Update Firebase Auth user if email was verified
      if (verification.type === 'email') {
        await admin.auth().updateUser(userId, {
          email: verification.identifier,
          emailVerified: true,
        });
      }

      // Clean up verification record
      await verificationDoc.ref.delete();

      // Send welcome notifications if FCM token is available
      const userProfileData = await userProfileRef.get();
      const fcmToken = userProfileData.data()?.fcmToken;
      
      if (fcmToken) {
        // Import notification functions
        const {sendWelcomeNotification, sendTrialPlanNotification} = await import('../notifications/welcomeNotifications');
        
        console.log(`📧 Sending welcome notifications to ${userId}`);
        
        // Send welcome notification immediately
        await sendWelcomeNotification(userId, fcmToken, verification.language || 'fr');
        
        // Send trial notification after a short delay
        setTimeout(async () => {
          await sendTrialPlanNotification(userId, fcmToken, verification.language || 'fr');
        }, 5000);
      }

      return {
        success: true,
        userId,
        verificationType: verification.type,
        isInDRC: verification.countryCode === 'CD',
        message: 'Registration completed successfully',
      };
    } catch (error) {
      console.error('Complete registration error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to complete registration',
      );
    }
  });

/**
 * Check if an identifier (phone/email) is already registered
 */
export const checkIdentifierAvailability = functions
  .region(config.app.region)
  .https.onCall(async data => {
    const {phoneNumber, email} = data;

    if (!phoneNumber && !email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number or email is required',
      );
    }

    try {
      const field = phoneNumber ? 'phoneNumber' : 'email';
      const value = phoneNumber || email;

      // First, try to search for verified profiles only (preferred)
      try {
        const usersQuery = await db
          .collectionGroup('profile')
          .where(field, '==', value)
          .where('verified', '==', true)
          .limit(1)
          .get();

        return {
          available: usersQuery.empty,
          field,
        };
      } catch (indexError) {
        // If compound index doesn't exist, fall back to simple check
        console.warn('⚠️ Compound index query failed, using fallback:', indexError);
        
        const fallbackQuery = await db
          .collectionGroup('profile')
          .where(field, '==', value)
          .limit(1)
          .get();
        
        // For fallback, check if any found profiles are actually verified
        if (!fallbackQuery.empty) {
          const profile = fallbackQuery.docs[0].data();
          // Consider unavailable only if the profile is verified
          const isVerifiedProfile = profile.verified === true;
          
          return {
            available: !isVerifiedProfile,
            field,
          };
        }
        
        return {
          available: true,
          field,
        };
      }
    } catch (error) {
      console.error('Check identifier error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to check availability',
      );
    }
  });
