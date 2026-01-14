/**
 * Refund Management System
 * Handles refunds for Moko Afrika (mobile money)
 * Supports prorated refunds, full refunds, and partial refunds
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import {config} from '../config';

const db = admin.firestore();

// Refund reasons
export type RefundReason =
  | 'plan_downgrade'
  | 'subscription_cancelled'
  | 'duplicate_payment'
  | 'billing_error'
  | 'service_unavailable'
  | 'customer_request'
  | 'fraudulent_transaction'
  | 'other';

// Refund status
export type RefundStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Refund record interface
export interface Refund {
  id: string;
  userId: string;
  subscriptionId?: string;
  paymentTransactionId: string;
  amount: number;
  currency: 'USD' | 'CDF';
  reason: RefundReason;
  reasonDetails?: string;
  status: RefundStatus;
  paymentProvider: 'moko_afrika';
  
  // Provider-specific IDs
  mokoRefundReference?: string;
  
  // Processing details
  processedAt?: Date;
  failureReason?: string;
  retryCount: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // 'system' or admin userId
}

/**
 * Request a refund (user-initiated or system-triggered)
 */
export const requestRefund = functions
  .region(config.app.region)
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onCall(async (data, context) => {
    const {
      transactionId,
      amount,
      reason = 'customer_request',
      reasonDetails,
    } = data;

    // Admin check (optional - can allow user-initiated refunds)
    const userId = context.auth?.uid;
    if (!userId) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    if (!transactionId || !amount) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Transaction ID and amount are required',
      );
    }

    if (amount <= 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Refund amount must be positive',
      );
    }

    try {
      // Find original payment record
      const paymentsQuery = await db
        .collectionGroup('payments')
        .where('transactionId', '==', transactionId)
        .limit(1)
        .get();

      if (paymentsQuery.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'Payment transaction not found',
        );
      }

      const paymentDoc = paymentsQuery.docs[0];
      const payment = paymentDoc.data();

      // Validate user owns this payment (unless admin)
      if (payment.userId !== userId) {
        // Check if caller is admin
        const adminCheck = await db
          .collection('users')
          .doc(userId)
          .get();
        const userData = adminCheck.data();
        
        if (!userData?.isAdmin) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'You can only refund your own payments',
          );
        }
      }

      // Check payment status
      if (payment.status !== 'completed') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Only completed payments can be refunded',
        );
      }

      // C3 FIX: Use transaction to prevent over-refund race condition
      const refundId = db.collection('refunds').doc().id;
      const refundAmount = Math.round(amount * 100) / 100;
      const refundCurrency = (payment.currency || 'USD') as 'USD' | 'CDF';
      
      await admin.firestore().runTransaction(async (transaction) => {
        // Check if already refunded within transaction
        const existingRefundsQuery = await transaction.get(
          db.collection('refunds')
            .where('paymentTransactionId', '==', transactionId)
            .where('status', 'in', ['pending', 'processing', 'completed'])
        );

        const totalRefunded = existingRefundsQuery.docs.reduce(
          (sum, doc) => sum + (doc.data().amount || 0),
          0,
        );

        if (totalRefunded + amount > payment.amount) {
          throw new Error(
            `Cannot refund $${amount}. Already refunded $${totalRefunded} of $${payment.amount}`,
          );
        }

        // Create refund record atomically
        const refundRef = db.collection('refunds').doc(refundId);
        const refundData: Refund = {
          id: refundId,
          userId: payment.userId,
          subscriptionId: payment.subscriptionId,
          paymentTransactionId: transactionId,
          amount: refundAmount,
          currency: refundCurrency,
          reason,
          reasonDetails,
          status: 'pending',
          paymentProvider: payment.paymentProvider || 'stripe',
          retryCount: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
          createdBy: context.auth?.uid || 'system',
        };

        transaction.set(refundRef, refundData);
      });

      // Trigger refund processing
      await processRefund(refundId);

      return {
        success: true,
        refundId,
        amount: refundAmount,
        currency: refundCurrency,
        status: 'pending',
        message: 'Refund request submitted successfully',
      };
    } catch (error) {
      console.error('Request refund error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to request refund',
      );
    }
  });

/**
 * Process refund - handles both Stripe and Moko Afrika
 */
async function processRefund(refundId: string): Promise<void> {
  const refundRef = db.collection('refunds').doc(refundId);
  const refundDoc = await refundRef.get();

  if (!refundDoc.exists) {
    throw new Error('Refund not found');
  }

  const refund = refundDoc.data() as Refund;

  if (refund.status !== 'pending') {
    console.log(`Refund ${refundId} is not pending, skipping`);
    return;
  }

  try {
    // Update status to processing
    await refundRef.update({
      status: 'processing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (refund.paymentProvider === 'moko_afrika') {
      await processMokoRefund(refund, refundRef);
    } else {
      throw new Error(`Unsupported payment provider: ${refund.paymentProvider}`);
    }

    // Mark as completed
    await refundRef.update({
      status: 'completed',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Refund ${refundId} completed successfully`);
  } catch (error) {
    console.error(`Refund ${refundId} failed:`, error);

    // Update refund with failure details
    await refundRef.update({
      status: 'failed',
      failureReason:
        error instanceof Error ? error.message : 'Unknown error',
      retryCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // TODO: Send notification to admins about failed refund
  }
}

/**
 * Process Moko Afrika refund
 */
async function processMokoRefund(
  refund: Refund,
  refundRef: admin.firestore.DocumentReference,
): Promise<void> {
  // Find original Moko payment
  const paymentsQuery = await db
    .collectionGroup('payments')
    .where('transactionId', '==', refund.paymentTransactionId)
    .limit(1)
    .get();

  if (paymentsQuery.empty) {
    throw new Error('Original payment not found');
  }

  const payment = paymentsQuery.docs[0].data();
  const mokoReference = payment.mokoReference;

  if (!mokoReference) {
    throw new Error('Moko Afrika reference not found');
  }

  // Call Moko Afrika refund API
  const refundPayload = {
    original_transaction_id: mokoReference,
    amount: refund.amount.toFixed(2),
    currency: refund.currency,
    reason: refund.reason,
    refund_reference: `REF-${refund.id}`,
  };

  try {
    const response = await axios.post(
      `${config.moko.baseUrl}/refunds/initiate`,
      refundPayload,
      {
        headers: {
          Authorization: `Bearer ${config.moko.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    if (response.data.success) {
      await refundRef.update({
        mokoRefundReference: response.data.refund_id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Moko refund initiated: ${response.data.refund_id}`);
    } else {
      throw new Error(
        response.data.message || 'Moko Afrika refund failed',
      );
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Moko API error: ${error.response?.data?.message || error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Get refund status
 */
export const getRefundStatus = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const {refundId} = data;

    if (!refundId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Refund ID is required',
      );
    }

    try {
      const refundDoc = await db.collection('refunds').doc(refundId).get();

      if (!refundDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Refund not found',
        );
      }

      const refund = refundDoc.data() as Refund;

      // Verify user owns this refund (unless admin)
      if (refund.userId !== context.auth.uid) {
        const adminCheck = await db
          .collection('users')
          .doc(context.auth.uid)
          .get();
        const userData = adminCheck.data();

        if (!userData?.isAdmin) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'Access denied',
          );
        }
      }

      return {
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        processedAt: refund.processedAt,
        failureReason: refund.failureReason,
      };
    } catch (error) {
      console.error('Get refund status error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to get refund status',
      );
    }
  });

/**
 * List user's refunds
 */
export const listUserRefunds = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const userId = context.auth.uid;
    const {limit = 10} = data;

    try {
      const refundsQuery = await db
        .collection('refunds')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, 50))
        .get();

      const refunds = refundsQuery.docs.map(doc => {
        const refund = doc.data() as Refund;
        return {
          refundId: refund.id,
          amount: refund.amount,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          createdAt: refund.createdAt,
          processedAt: refund.processedAt,
        };
      });

      return {refunds};
    } catch (error) {
      console.error('List refunds error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to list refunds',
      );
    }
  });

/**
 * Retry failed refund (admin only)
 */
export const retryRefund = functions
  .region(config.app.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    // Check admin permissions
    const adminCheck = await db
      .collection('users')
      .doc(context.auth.uid)
      .get();
    const userData = adminCheck.data();

    if (!userData?.isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required',
      );
    }

    const {refundId} = data;

    if (!refundId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Refund ID is required',
      );
    }

    try {
      const refundDoc = await db.collection('refunds').doc(refundId).get();

      if (!refundDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Refund not found',
        );
      }

      const refund = refundDoc.data() as Refund;

      if (refund.status !== 'failed') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Only failed refunds can be retried',
        );
      }

      // Reset to pending and retry
      await db.collection('refunds').doc(refundId).update({
        status: 'pending',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await processRefund(refundId);

      return {
        success: true,
        message: 'Refund retry initiated',
      };
    } catch (error) {
      console.error('Retry refund error:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to retry refund',
      );
    }
  });
