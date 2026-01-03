"use strict";
/**
 * Two-Factor Authentication Cloud Functions
 * Handles phone verification (DRC) and email verification (international)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIdentifierAvailability = exports.completeRegistration = exports.verifyCode = exports.sendVerificationCode = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const config_1 = require("../config");
const db = admin.firestore();
// Verification code settings
const CODE_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 60;
/**
 * Generate a random verification code
 */
function generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
}
/**
 * Generate a unique verification session ID
 */
function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}
/**
 * Send SMS via Africa's Talking or similar SMS gateway (for DRC)
 */
async function sendSMS(phoneNumber, code) {
    var _a, _b, _c;
    try {
        // Africa's Talking SMS API
        const response = await fetch(`${config_1.config.sms.baseUrl}/version1/messaging`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                apiKey: config_1.config.sms.apiKey,
            },
            body: new URLSearchParams({
                username: config_1.config.sms.username,
                to: phoneNumber,
                message: `Votre code de vérification GoShopper est: ${code}. Valide pendant ${CODE_EXPIRY_MINUTES} minutes.`,
                from: config_1.config.sms.senderId,
            }),
        });
        const result = await response.json();
        console.log('SMS sent:', result);
        return ((_c = (_b = (_a = result.SMSMessageData) === null || _a === void 0 ? void 0 : _a.Recipients) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.statusCode) === 101;
    }
    catch (error) {
        console.error('SMS sending error:', error);
        // Fallback to Firebase SMS if primary fails
        return false;
    }
}
/**
 * Send verification email via SendGrid or Firebase
 */
async function sendVerificationEmail(email, code, language = 'en') {
    try {
        const subject = language === 'fr'
            ? 'Code de vérification GoShopper'
            : 'GoShopper Verification Code';
        const htmlContent = language === 'fr'
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
                Authorization: `Bearer ${config_1.config.sendgrid.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email }] }],
                from: { email: config_1.config.sendgrid.fromEmail, name: 'GoShopper' },
                subject,
                content: [{ type: 'text/html', value: htmlContent }],
            }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Email sending error:', error);
        return false;
    }
}
/**
 * Detect if user is in DRC based on phone number or IP
 */
function isInDRC(phoneNumber, countryCode) {
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
exports.sendVerificationCode = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    const { phoneNumber, email, countryCode, language = 'fr' } = data;
    // Determine if user is in DRC
    const inDRC = isInDRC(phoneNumber, countryCode);
    // Validate input based on location
    if (inDRC && !phoneNumber) {
        throw new functions.https.HttpsError('invalid-argument', 'Phone number is required for users in DRC');
    }
    if (!inDRC && !email) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required for users outside DRC');
    }
    // Validate phone number format for DRC
    if (inDRC && phoneNumber) {
        const phoneRegex = /^(\+?243|0)?[89]\d{8}$/;
        if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid DRC phone number format');
        }
    }
    // Validate email format
    if (!inDRC && email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
        }
    }
    const identifier = inDRC ? phoneNumber : email;
    const verificationType = inDRC ? 'phone' : 'email';
    try {
        // Check for existing verification to prevent spam
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
                const remainingSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceCreation);
                throw new functions.https.HttpsError('resource-exhausted', `Please wait ${remainingSeconds} seconds before requesting a new code`);
            }
        }
        // Generate verification code and session
        const code = generateVerificationCode();
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
        let sent = false;
        if (inDRC) {
            sent = await sendSMS(phoneNumber, code);
        }
        else {
            sent = await sendVerificationEmail(email, code, language);
        }
        if (!sent) {
            // Delete the verification record if sending failed
            await db.collection('verifications').doc(sessionId).delete();
            throw new functions.https.HttpsError('internal', `Failed to send verification ${verificationType === 'phone' ? 'SMS' : 'email'}`);
        }
        return {
            success: true,
            sessionId,
            type: verificationType,
            expiresIn: CODE_EXPIRY_MINUTES * 60,
            message: inDRC
                ? 'Code de vérification envoyé par SMS'
                : 'Verification code sent to your email',
        };
    }
    catch (error) {
        console.error('Send verification code error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to send verification code');
    }
});
/**
 * Verify the code entered by user
 */
exports.verifyCode = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    const { sessionId, code } = data;
    if (!sessionId || !code) {
        throw new functions.https.HttpsError('invalid-argument', 'Session ID and code are required');
    }
    try {
        const verificationRef = db.collection('verifications').doc(sessionId);
        const verificationDoc = await verificationRef.get();
        if (!verificationDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Verification session not found or expired');
        }
        const verification = verificationDoc.data();
        // Check if already verified
        if (verification.verified) {
            throw new functions.https.HttpsError('failed-precondition', 'This session has already been verified');
        }
        // Check if expired
        const expiresAt = verification.expiresAt.toDate();
        if (expiresAt < new Date()) {
            await verificationRef.delete();
            throw new functions.https.HttpsError('deadline-exceeded', 'Verification code has expired');
        }
        // Check attempts
        if (verification.attempts >= MAX_ATTEMPTS) {
            await verificationRef.delete();
            throw new functions.https.HttpsError('resource-exhausted', 'Maximum verification attempts exceeded');
        }
        // Verify code
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        if (codeHash !== verification.codeHash) {
            // Increment attempts
            await verificationRef.update({
                attempts: admin.firestore.FieldValue.increment(1),
            });
            const remainingAttempts = MAX_ATTEMPTS - verification.attempts - 1;
            throw new functions.https.HttpsError('invalid-argument', `Invalid code. ${remainingAttempts} attempts remaining`);
        }
        // Code is valid - mark as verified
        await verificationRef.update({
            verified: true,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Generate verification token for registration completion
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
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
    }
    catch (error) {
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
exports.completeRegistration = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userId = context.auth.uid;
    const { verificationToken, displayName } = data;
    if (!verificationToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Verification token is required');
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
            throw new functions.https.HttpsError('not-found', 'Invalid or expired verification token');
        }
        const verificationDoc = verificationQuery.docs[0];
        const verification = verificationDoc.data();
        // Check token expiry
        const tokenExpiresAt = verification.tokenExpiresAt.toDate();
        if (tokenExpiresAt < new Date()) {
            throw new functions.https.HttpsError('deadline-exceeded', 'Verification token has expired');
        }
        // Update user profile with verified contact
        const userProfileRef = db.doc(`${config_1.collections.users}/${userId}/profile`);
        const updateData = {
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
        }
        else {
            updateData.email = verification.identifier;
            updateData.emailVerified = true;
        }
        if (displayName) {
            updateData.displayName = displayName;
        }
        await userProfileRef.set(updateData, { merge: true });
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
        const fcmToken = (_a = userProfileData.data()) === null || _a === void 0 ? void 0 : _a.fcmToken;
        if (fcmToken) {
            // Import notification functions
            const { sendWelcomeNotification, sendTrialPlanNotification } = await Promise.resolve().then(() => __importStar(require('../notifications/welcomeNotifications')));
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
    }
    catch (error) {
        console.error('Complete registration error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to complete registration');
    }
});
/**
 * Check if an identifier (phone/email) is already registered
 */
exports.checkIdentifierAvailability = functions
    .region(config_1.config.app.region)
    .https.onCall(async (data) => {
    const { phoneNumber, email } = data;
    if (!phoneNumber && !email) {
        throw new functions.https.HttpsError('invalid-argument', 'Phone number or email is required');
    }
    try {
        const field = phoneNumber ? 'phoneNumber' : 'email';
        const value = phoneNumber || email;
        // Search in user profiles
        const usersQuery = await db
            .collectionGroup('profile')
            .where(field, '==', value)
            .limit(1)
            .get();
        return {
            available: usersQuery.empty,
            field,
        };
    }
    catch (error) {
        console.error('Check identifier error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to check availability');
    }
});
//# sourceMappingURL=verification.js.map