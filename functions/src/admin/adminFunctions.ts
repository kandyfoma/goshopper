/**
 * Admin-Only Firebase Functions
 * Functions that require admin privileges
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';
import {isAdmin} from './auth';

const db = admin.firestore();
const auth = admin.auth();

/**
 * Get all users with their profile data (Admin only)
 */
export const getAllUsers = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }

    // Check admin status
    const userIsAdmin = await isAdmin(context.auth.uid);
    if (!userIsAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    try {
      const usersResult = await auth.listUsers();
      const usersData = [];

      for (const user of usersResult.users) {
        const profileDoc = await db
          .doc(`artifacts/${config.app.id}/users/${user.uid}`)
          .get();

        usersData.push({
          uid: user.uid,
          email: user.email,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName,
          createdAt: user.metadata.creationTime,
          profile: profileDoc.exists ? profileDoc.data() : null,
        });
      }

      return {
        success: true,
        users: usersData,
        count: usersData.length,
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to fetch users'
      );
    }
  });

/**
 * Update user admin status (Admin only)
 */
export const setUserAdminStatus = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }

    // Check admin status
    const userIsAdmin = await isAdmin(context.auth.uid);
    if (!userIsAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    const {userId, isAdmin: makeAdmin} = data;

    if (!userId || typeof makeAdmin !== 'boolean') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId and isAdmin (boolean) are required'
      );
    }

    try {
      // Update user profile
      await db
        .doc(`artifacts/${config.app.id}/users/${userId}`)
        .set({is_admin: makeAdmin}, {merge: true});

      return {
        success: true,
        userId,
        isAdmin: makeAdmin,
        message: `User ${makeAdmin ? 'granted' : 'revoked'} admin access`,
      };
    } catch (error) {
      console.error('Error updating admin status:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to update admin status'
      );
    }
  });

/**
 * Get admin dashboard stats (Admin only)
 */
export const getAdminStats = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }

    // Check admin status
    const userIsAdmin = await isAdmin(context.auth.uid);
    if (!userIsAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    try {
      // Get user count
      const usersResult = await auth.listUsers();
      const totalUsers = usersResult.users.length;

      // Get receipts count
      const receiptsSnapshot = await db.collectionGroup('receipts').count().get();
      const totalReceipts = receiptsSnapshot.data().count;

      // Get items count
      const itemsSnapshot = await db.collectionGroup('items').count().get();
      const totalItems = itemsSnapshot.data().count;

      // Get price alerts count
      const alertsSnapshot = await db.collectionGroup('priceAlerts').count().get();
      const totalAlerts = alertsSnapshot.data().count;

      // Get active subscriptions count
      const usersWithProfiles = await db
        .collection(`artifacts/${config.app.id}/users`)
        .where('subscriptionStatus', '==', 'active')
        .count()
        .get();
      const activeSubscriptions = usersWithProfiles.data().count;

      return {
        success: true,
        stats: {
          totalUsers,
          totalReceipts,
          totalItems,
          totalAlerts,
          activeSubscriptions,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to fetch admin stats'
      );
    }
  });

/**
 * Delete user and all data (Admin only)
 */
export const adminDeleteUser = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }

    // Check admin status
    const userIsAdmin = await isAdmin(context.auth.uid);
    if (!userIsAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    const {userId} = data;

    if (!userId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId is required'
      );
    }

    try {
      // Delete all user subcollections
      const subcollections = [
        'receipts',
        'items',
        'priceAlerts',
        'notifications',
        'subscriptions',
        'payments',
        'shops',
        'profile',
      ];

      for (const subcollection of subcollections) {
        const snapshot = await db
          .collection(`artifacts/${config.app.id}/users/${userId}/${subcollection}`)
          .get();

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      // Delete user document
      await db.doc(`artifacts/${config.app.id}/users/${userId}`).delete();

      // Delete Firebase Auth user
      await auth.deleteUser(userId);

      return {
        success: true,
        userId,
        message: 'User and all data deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to delete user'
      );
    }
  });
