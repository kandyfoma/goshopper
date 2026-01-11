/**
 * Phone Authentication Cloud Functions
 * Generates Firebase Custom Tokens for phone-authenticated users
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

/**
 * Generate a Firebase Custom Token for phone users
 * This allows phone users to authenticate with Firebase Auth
 * so they can call other authenticated cloud functions
 */
export const getPhoneAuthToken = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    const {userId, phoneNumber, passwordHash} = data;

    if (!userId || !phoneNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId and phoneNumber are required',
      );
    }

    try {
      // Verify the user exists in Firestore
      const userDoc = await db.collection(`artifacts/${config.app.id}/users`).doc(userId).get();
      
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User not found',
        );
      }

      const userData = userDoc.data();
      
      // Verify phone number matches
      if (userData?.phoneNumber !== phoneNumber) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Phone number mismatch',
        );
      }

      // Check if phone is verified (similar to LaboMedPlus)
      if (!userData?.phoneVerified) {
        console.log(`Phone verification required for user: ${userId}`);
        throw new functions.https.HttpsError(
          'permission-denied',
          'Phone not verified',
        );
      }

      // Optionally verify password hash if provided (for extra security)
      if (passwordHash) {
        const passwordDoc = await db.collection('passwords').doc(userId).get();
        if (passwordDoc.exists) {
          const storedHash = passwordDoc.data()?.hash;
          if (storedHash && storedHash !== passwordHash) {
            throw new functions.https.HttpsError(
              'permission-denied',
              'Invalid credentials',
            );
          }
        }
      }

      // Create or get Firebase Auth user
      let firebaseUser;
      try {
        // Try to get existing user
        firebaseUser = await admin.auth().getUser(userId);
        console.log(`Found existing Firebase Auth user: ${userId}`);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // Create new Firebase Auth user for this phone user
          // Note: We create WITHOUT phone number to avoid validation issues
          // The phone number is stored in the custom claims instead
          try {
            firebaseUser = await admin.auth().createUser({
              uid: userId,
              displayName: userData?.displayName || phoneNumber,
            });
            console.log(`Created Firebase Auth user for phone user: ${userId}`);
          } catch (createError: any) {
            console.error('Error creating Firebase Auth user:', createError);
            throw new functions.https.HttpsError(
              'internal',
              `Failed to create auth user: ${createError.message}`,
            );
          }
        } else {
          console.error('Error getting Firebase Auth user:', error);
          throw new functions.https.HttpsError(
            'internal',
            `Failed to get auth user: ${error.message}`,
          );
        }
      }

      // Generate custom token
      const customToken = await admin.auth().createCustomToken(userId, {
        phoneNumber: phoneNumber,
        isPhoneUser: true,
      });

      console.log(`Generated custom token for user: ${userId}`);

      return {
        success: true,
        customToken,
        userId: firebaseUser.uid,
      };
    } catch (error: any) {
      console.error('Error generating phone auth token:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        `Failed to generate authentication token: ${error.message || 'Unknown error'}`,
      );
    }
  });
