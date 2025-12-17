/**
 * Apple Sign-In Server-to-Server Notifications
 * Handles Apple's server notifications for Sign in with Apple events
 * https://developer.apple.com/documentation/sign_in_with_apple/processing_changes_for_sign_in_with_apple_accounts
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as jwt from 'jsonwebtoken';
import {config} from '../config';

const db = admin.firestore();

interface AppleNotificationPayload {
  iss: string; // Apple
  aud: string; // Your app's bundle ID
  iat: number;
  exp: number;
  sub: string; // User identifier
  email?: string;
  email_verified?: boolean;
  is_private_email?: boolean;
  events: {
    type: 'email-enabled' | 'email-disabled' | 'consent-revoked';
    sub: string;
    event_time: number;
  }[];
}

/**
 * Verify Apple's JWT signature
 */
async function verifyAppleJWT(token: string): Promise<AppleNotificationPayload | null> {
  try {
    // In production, fetch Apple's public keys and verify signature
    // For now, we'll decode without verification (not recommended for production)
    const decoded = jwt.decode(token, {complete: true}) as any;
    
    if (!decoded || !decoded.payload) {
      console.error('Invalid JWT structure');
      return null;
    }

    // Verify issuer is Apple
    if (decoded.payload.iss !== 'https://appleid.apple.com') {
      console.error('Invalid issuer:', decoded.payload.iss);
      return null;
    }

    // Verify audience is your app
    if (decoded.payload.aud !== config.apple.bundleId) {
      console.error('Invalid audience:', decoded.payload.aud);
      return null;
    }

    // Verify expiration
    if (Date.now() / 1000 > decoded.payload.exp) {
      console.error('Token expired');
      return null;
    }

    return decoded.payload as AppleNotificationPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Handle email status changes from Apple
 */
async function handleEmailStatusChange(
  userId: string,
  eventType: string,
  eventTime: number
): Promise<void> {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`User ${userId} not found, skipping notification`);
      return;
    }

    const updateData: any = {
      apple_notifications_last_updated: admin.firestore.FieldValue.serverTimestamp(),
    };

    switch (eventType) {
      case 'email-enabled':
        updateData.apple_email_enabled = true;
        console.log(`Email enabled for user ${userId}`);
        break;

      case 'email-disabled':
        updateData.apple_email_enabled = false;
        console.log(`Email disabled for user ${userId}`);
        break;

      case 'consent-revoked':
        updateData.apple_consent_revoked = true;
        updateData.apple_consent_revoked_at = new Date(eventTime * 1000);
        console.log(`Consent revoked for user ${userId}`);
        
        // Optionally, you might want to disable the user account or clean up data
        // updateData.is_active = false;
        break;

      default:
        console.log(`Unknown event type: ${eventType} for user ${userId}`);
        return;
    }

    await userRef.update(updateData);

    // Log the notification for audit purposes
    await db.collection('apple_notifications').add({
      user_id: userId,
      event_type: eventType,
      event_time: new Date(eventTime * 1000),
      processed_at: admin.firestore.FieldValue.serverTimestamp(),
      raw_payload: { eventType, eventTime }
    });

  } catch (error) {
    console.error(`Error handling ${eventType} for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Apple Sign-In Server-to-Server Notifications Endpoint
 * POST /users/apple-notifications
 */
export const appleNotifications = functions
  .region('us-central1')
  .https
  .onRequest(async (req, res) => {
    // Enable CORS for Apple's servers
    res.set('Access-Control-Allow-Origin', 'https://appleid.apple.com');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        error: 'Method not allowed. Use POST.'
      });
      return;
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Missing or invalid authorization header'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer '
      const payload = await verifyAppleJWT(token);

      if (!payload) {
        res.status(401).json({
          success: false,
          error: 'Invalid JWT token'
        });
        return;
      }

      console.log('Received Apple notification:', {
        sub: payload.sub,
        events: payload.events?.length || 0,
        iat: new Date(payload.iat * 1000).toISOString()
      });

      // Process each event in the notification
      if (payload.events && payload.events.length > 0) {
        const promises = payload.events.map(event => 
          handleEmailStatusChange(event.sub, event.type, event.event_time)
        );

        await Promise.all(promises);

        res.status(200).json({
          success: true,
          message: `Processed ${payload.events.length} event(s)`,
          processed_events: payload.events.length
        });
      } else {
        res.status(200).json({
          success: true,
          message: 'No events to process'
        });
      }

    } catch (error) {
      console.error('Apple notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

/**
 * Test endpoint to simulate Apple notification (development only)
 */
export const testAppleNotification = functions
  .region('us-central1')
  .https
  .onRequest(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).send('Not found');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { userId, eventType = 'email-enabled' } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      await handleEmailStatusChange(
        userId,
        eventType,
        Math.floor(Date.now() / 1000)
      );

      res.status(200).json({
        success: true,
        message: `Test ${eventType} event processed for user ${userId}`
      });

    } catch (error) {
      console.error('Test Apple notification error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });