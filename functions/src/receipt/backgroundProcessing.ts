/**
 * Background Receipt Processing Cloud Function
 * Processes receipts asynchronously after image upload to Cloud Storage
 * Sends FCM push notifications on completion (works even when phone is locked)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config, collections } from '../config';
import { ParsedReceipt } from '../types';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();
const messaging = admin.messaging();

// Timeout constants
const GEMINI_TIMEOUT_MS = 45000; // 45 seconds max for AI processing
const DOWNLOAD_TIMEOUT_MS = 15000; // 15 seconds max for image download

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Fix quantity parsing for weight/volume units
 * Handles cases where "1.000kg" is misread as 1000 instead of 1.0 kg
 */
function fixQuantityForWeightUnits(quantity: number, unit?: string, itemName?: string): number {
  const weightVolumeUnits = ['kg', 'g', 'l', 'ml', 'cl', 'lt', 'litre', 'liter', 'gram', 'gramme', 'kilo'];
  const hasWeightUnit = unit && weightVolumeUnits.some(u => unit.toLowerCase().includes(u));
  const nameHasWeightUnit = itemName && /\d+[\.,]?\d*\s*(kg|g|l|ml|cl|lt)\b/i.test(itemName);
  
  if (!hasWeightUnit && !nameHasWeightUnit) {
    return quantity;
  }
  
  if (quantity >= 100) {
    // 1000 -> 1.0, 2000 -> 2.0
    if (quantity % 1000 === 0 && quantity <= 10000) {
      const fixed = quantity / 1000;
      console.log(`⚖️ Fixed quantity: ${quantity} -> ${fixed} (weight unit)`);
      return fixed;
    }
    // 500 -> 0.5, 250 -> 0.25
    if (quantity % 100 === 0 && quantity < 1000) {
      const fixed = quantity / 1000;
      console.log(`⚖️ Fixed quantity: ${quantity} -> ${fixed} (sub-kg)`);
      return fixed;
    }
    // 1500 -> 1.5, 2500 -> 2.5
    if (quantity % 500 === 0 && quantity <= 10000) {
      const fixed = quantity / 1000;
      console.log(`⚖️ Fixed quantity: ${quantity} -> ${fixed} (.5 pattern)`);
      return fixed;
    }
    // General: if > 50 for kg, likely wrong
    if (hasWeightUnit && quantity > 50) {
      const possibleFixed = quantity / 1000;
      if (possibleFixed >= 0.1 && possibleFixed <= 20) {
        console.log(`⚖️ Fixed quantity: ${quantity} -> ${possibleFixed} (too high)`);
        return possibleFixed;
      }
    }
  }
  
  return quantity;
}

// Gemini AI initialized lazily
let genAI: GoogleGenerativeAI | null = null;

function getGeminiAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || (config && config.gemini ? config.gemini.apiKey : '');
    if (!apiKey) {
      throw new Error('Service d\'analyse non configuré');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

interface PendingScan {
  id: string;
  userId: string;
  imageUrl: string;
  storagePath: string;
  city?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  error?: string;
  receiptId?: string;
  retryCount: number;
  fcmToken?: string;
}

/**
 * Create a pending scan record and trigger background processing
 * Called from the mobile app after uploading image to Cloud Storage
 */
export const createPendingScan = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data, context) => {
    // Validate authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { storagePath, city, fcmToken } = data;
    const userId = context.auth.uid;

    if (!storagePath) {
      throw new functions.https.HttpsError('invalid-argument', 'storagePath is required');
    }

    console.log(`📤 Creating pending scan for user ${userId}`);

    try {
      // Create pending scan record
      const pendingScanRef = db.collection('pendingScans').doc();
      const pendingScan: PendingScan = {
        id: pendingScanRef.id,
        userId,
        imageUrl: '', // Will be set when processing
        storagePath,
        city: city || undefined,
        status: 'pending',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        retryCount: 0,
        fcmToken: fcmToken || undefined,
      };

      await pendingScanRef.set(pendingScan);

      console.log(`✅ Pending scan created: ${pendingScanRef.id}`);

      // NOTE: Processing is now handled by the onPendingScanCreated trigger
      // which runs in its own execution context with proper timeout

      return {
        success: true,
        pendingScanId: pendingScanRef.id,
        message: 'Scan queued for background processing',
      };
    } catch (error: any) {
      console.error('Error creating pending scan:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Firestore trigger: Process receipt when a pending scan is created
 * This runs in its own execution context with 120s timeout
 * Ensures notifications are ALWAYS sent, even on timeout
 */
export const onPendingScanCreated = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 120, // 2 minutes for AI processing
    memory: '512MB',
  })
  .firestore.document('pendingScans/{scanId}')
  .onCreate(async (snap, context) => {
    const pendingScanId = context.params.scanId;
    console.log(`🔔 Firestore trigger: New pending scan ${pendingScanId}`);
    
    try {
      await processReceiptInBackground(pendingScanId);
    } catch (error) {
      console.error(`Firestore trigger processing failed for ${pendingScanId}:`, error);
      // Error handling and notification is done inside processReceiptInBackground
    }
  });

/**
 * Process a receipt in the background
 * Called automatically when a pending scan is created
 */
async function processReceiptInBackground(pendingScanId: string): Promise<void> {
  console.log(`🔄 Starting background processing for scan ${pendingScanId}`);

  const pendingScanRef = db.collection('pendingScans').doc(pendingScanId);
  let pendingScan: PendingScan | null = null;

  try {
    // Get pending scan
    const doc = await pendingScanRef.get();
    if (!doc.exists) {
      console.error(`Pending scan ${pendingScanId} not found`);
      return;
    }

    pendingScan = doc.data() as PendingScan;

    // Update status to processing
    await pendingScanRef.update({
      status: 'processing',
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Download image from Cloud Storage with timeout
    console.log(`📥 Downloading image from ${pendingScan.storagePath}`);
    const bucket = storage.bucket();
    const file = bucket.file(pendingScan.storagePath);
    
    // Check if file exists before downloading
    const [fileExists] = await file.exists();
    if (!fileExists) {
      throw new Error('Image non trouvée. Le fichier a peut-être été supprimé ou n\'a pas été correctement téléchargé.');
    }
    
    const [imageBuffer] = await withTimeout(
      file.download(),
      DOWNLOAD_TIMEOUT_MS,
      'Délai d\'attente dépassé lors du téléchargement de l\'image'
    );
    const imageBase64 = imageBuffer.toString('base64');

    // Get signed URL for reference
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Update with image URL
    await pendingScanRef.update({
      imageUrl: signedUrl,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Detect mime type
    const mimeType = pendingScan.storagePath.toLowerCase().endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';

    // Process with Gemini AI with timeout
    console.log(`🤖 Processing receipt with Gemini AI`);
    const receipt = await withTimeout(
      parseReceiptWithGemini(imageBase64, mimeType, pendingScan.city),
      GEMINI_TIMEOUT_MS,
      'Délai d\'attente dépassé lors de l\'analyse. Veuillez réessayer.'
    );

    if (!receipt || !receipt.items || receipt.items.length === 0) {
      // Even without items, if we have a total and store name, save it
      if (receipt && (receipt.total > 0 || receipt.storeName)) {
        console.log('⚠️ No items but have total or store name, proceeding with minimal receipt');
        // Proceed with what we have
      } else {
        throw new Error('Aucun article détecté dans le reçu');
      }
    }

    // Check subscription limits
    const canScan = await checkSubscriptionLimit(pendingScan.userId);
    if (!canScan.allowed) {
      throw new Error(canScan.message || 'Limite de scans atteinte');
    }

    // Save receipt to Firestore
    console.log(`💾 Saving receipt to Firestore`);
    const receiptRef = db.collection(collections.receipts(pendingScan.userId)).doc();
    
    // Normalize store name for shop association
    const storeNameNormalized = normalizeStoreName(receipt.storeName || 'magasin');
    
    const receiptData = {
      ...receipt,
      id: receiptRef.id,
      userId: pendingScan.userId,
      imageUrl: signedUrl,
      storagePath: pendingScan.storagePath,
      city: pendingScan.city || receipt.city,
      storeNameNormalized, // Important: links receipt to shop
      scannedAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      processedInBackground: true,
    };

    await receiptRef.set(receiptData);

    // Update shop statistics
    await updateShopFromReceipt(receiptData, pendingScan.userId);

    // Record scan usage
    await recordScanUsage(pendingScan.userId);

    // Update pending scan as completed
    await pendingScanRef.update({
      status: 'completed',
      receiptId: receiptRef.id,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    console.log(`✅ Receipt saved successfully: ${receiptRef.id}`);

    // Send success notification
    await sendScanNotification(pendingScan, {
      success: true,
      receipt: receiptData,
      receiptId: receiptRef.id,
    });

  } catch (error: any) {
    console.error(`❌ Background processing failed:`, error);

    // ALWAYS try to send failure notification first
    // This ensures user gets notified even if subsequent operations fail
    if (pendingScan) {
      try {
        // Determine user-friendly error message
        let userMessage = error.message || 'Une erreur est survenue';
        
        // Check for storage/object-not-found error
        if (error.code === 'storage/object-not-found' || userMessage.includes('No object exists')) {
          userMessage = 'Image non trouvée. Veuillez réessayer de scanner le reçu.';
        }
        // Check for timeout errors
        else if (userMessage.includes('Délai d\'attente') || 
            userMessage.includes('timeout') ||
            userMessage.includes('DEADLINE_EXCEEDED')) {
          userMessage = 'L\'analyse a pris trop de temps. Réessayez avec une photo plus nette.';
        }

        // Send notification FIRST before any database updates
        await sendScanNotification(pendingScan, {
          success: false,
          error: userMessage,
        });
        console.log(`📱 Failure notification sent for scan ${pendingScanId}`);
      } catch (notifError) {
        console.error('Failed to send failure notification:', notifError);
      }

      // Now update pending scan status
      try {
        const newRetryCount = (pendingScan.retryCount || 0) + 1;
        
        await pendingScanRef.update({
          status: newRetryCount < 3 ? 'pending' : 'failed', // Retry up to 3 times
          error: error.message,
          retryCount: newRetryCount,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      } catch (updateError) {
        console.error('Failed to update pending scan status:', updateError);
      }
    }
  }
}

/**
 * Parse receipt using Gemini AI
 */
async function parseReceiptWithGemini(
  imageBase64: string,
  mimeType: string,
  defaultCity?: string
): Promise<ParsedReceipt | null> {
  const prompt = `Tu es un expert en analyse de reçus de magasin. Analyse cette image de reçu et extrait les informations suivantes.

RÈGLES CRITIQUES POUR LES ARTICLES:
1. CHAQUE LIGNE D'ARTICLE DOIT ÊTRE UN ARTICLE SÉPARÉ - Ne jamais fusionner plusieurs lignes en un seul article
2. Si tu vois "Article 1" sur une ligne et "Article 2" sur une autre ligne, ce sont DEUX articles distincts
3. Chaque article a son propre prix - ne saute AUCUN prix
4. Vérifie que le nombre d'articles extraits correspond au nombre de lignes d'articles sur le reçu
5. Si plusieurs articles semblent liés mais sont sur des lignes différentes, ce sont des articles SÉPARÉS

IMPORTANT: 
- Tous les prix doivent être des NOMBRES (pas de texte)
- La devise doit être USD ou CDF
- Si le prix est en francs congolais, utilise CDF
- Si le prix est en dollars, utilise USD
- CHAQUE ligne d'article sur le reçu = UN objet dans le tableau items[]

Retourne UNIQUEMENT un JSON valide avec cette structure exacte:
{
  "storeName": "nom du magasin",
  "date": "YYYY-MM-DD",
  "receiptNumber": "numéro si visible",
  "total": 0.00,
  "currency": "USD ou CDF",
  "items": [
    {
      "name": "nom du produit",
      "quantity": 1,
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "category": "catégorie"
    }
  ]
}

IMPORTANT pour la DATE:
- Convertir DD-MM-YY en YYYY-MM-DD
- Exemple: "05-01-26" = 5 janvier 2026 → "2026-01-05"
- Si l'année est 2 chiffres, utiliser 20XX pour 00-30, 19XX pour 31-99

Catégories possibles: Alimentation, Boissons, Hygiène, Entretien, Électronique, Vêtements, Autres

Si ce n'est pas un reçu valide, retourne: {"error": "Ceci n'est pas un reçu valide"}`;

  try {
    const model = getGeminiAI().getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: imageBase64 } },
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Impossible d\'analyser le reçu');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.error) {
      throw new Error(parsed.error);
    }

    // Fix quantity issues and add city to items
    if (parsed.items) {
      // Validate for merged items (items with suspiciously long names)
      parsed.items.forEach((item: any, index: number) => {
        const itemName = item.name || '';
        const words = itemName.split(/\s+/);
        
        // Warn if item name is suspiciously long (may be multiple items merged)
        if (words.length > 10) {
          console.warn(`⚠️ Item ${index + 1} may be multiple items merged: "${itemName}"`);
          console.warn(`   Consider: Each line on receipt should be a separate item`);
        }
        
        // Warn if item name contains multiple product types (heuristic)
        const hasMultipleProducts = /\d+\s*(g|kg|l|ml|lt|pc|pcs)\s+.*?\d+\s*(g|kg|l|ml|lt|pc|pcs)/i.test(itemName);
        if (hasMultipleProducts) {
          console.warn(`⚠️ Item ${index + 1} appears to contain multiple products: "${itemName}"`);
        }
      });
      
      parsed.items = parsed.items.map((item: any) => {
        const rawQuantity = Number(item.quantity) || 1;
        const unit = item.unit;
        // Fix misread quantities for weight/volume units (e.g., 1.000kg read as 1000)
        const fixedQuantity = fixQuantityForWeightUnits(rawQuantity, unit, item.name);
        const unitPrice = Number(item.unitPrice) || 0;
        
        return {
          ...item,
          quantity: fixedQuantity,
          // Recalculate total if quantity was fixed
          totalPrice: rawQuantity !== fixedQuantity 
            ? fixedQuantity * unitPrice 
            : (Number(item.totalPrice) || fixedQuantity * unitPrice),
          city: defaultCity || item.city,
        };
      });
      if (defaultCity) {
        parsed.city = defaultCity;
      }
    }

    return parsed as ParsedReceipt;
  } catch (error: any) {
    console.error('Gemini parsing error:', error);
    throw new Error(error.message || 'Échec de l\'analyse du reçu');
  }
}

/**
 * Normalize store name for consistent matching
 */
function normalizeStoreName(storeName: string): string {
  return storeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 50);
}

/**
 * Update or create shop from receipt
 */
async function updateShopFromReceipt(receipt: any, userId: string): Promise<void> {
  try {
    const shopId = normalizeStoreName(receipt.storeName || 'magasin');
    const shopRef = db.collection(collections.shops(userId)).doc(shopId);
    
    const shopDoc = await shopRef.get();
    
    if (shopDoc.exists) {
      // Update existing shop
      await shopRef.update({
        receiptCount: admin.firestore.FieldValue.increment(1),
        totalSpent: admin.firestore.FieldValue.increment(receipt.total || 0),
        lastVisit: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log(`✅ Updated shop: ${receipt.storeName}`);
    } else {
      // Create new shop
      await shopRef.set({
        id: shopId,
        name: receipt.storeName || 'Magasin inconnu',
        nameNormalized: shopId,
        address: receipt.storeAddress || '',
        phone: receipt.storePhone || '',
        receiptCount: 1,
        totalSpent: receipt.total || 0,
        currency: receipt.currency || 'USD',
        lastVisit: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log(`✅ Created new shop: ${receipt.storeName}`);
    }
  } catch (error) {
    console.error('Error updating shop:', error);
    // Don't throw - shop update is not critical
  }
}

/**
 * Check subscription limit
 */
async function checkSubscriptionLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  try {
    const subscriptionRef = db.collection(collections.subscriptions).doc(userId);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      // No subscription - check trial limits
      return { allowed: true }; // Will be handled by recordScanUsage
    }

    const subscription = subscriptionDoc.data();
    if (!subscription) {
      return { allowed: true };
    }

    // Check if subscribed
    if (subscription.isSubscribed && subscription.status === 'active') {
      return { allowed: true };
    }

    // Check trial limits
    const trialScansUsed = subscription.trialScansUsed || 0;
    const trialScansLimit = subscription.trialScansLimit || 50;

    if (trialScansUsed >= trialScansLimit) {
      return {
        allowed: false,
        message: 'Limite d\'essai atteinte. Abonnez-vous pour continuer à scanner.',
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking subscription:', error);
    return { allowed: true }; // Allow on error
  }
}

/**
 * Record scan usage
 */
async function recordScanUsage(userId: string): Promise<void> {
  try {
    const subscriptionRef = db.collection(collections.subscriptions).doc(userId);
    await subscriptionRef.update({
      trialScansUsed: admin.firestore.FieldValue.increment(1),
      lastScanAt: admin.firestore.Timestamp.now(),
    });
  } catch (error) {
    console.error('Error recording scan usage:', error);
  }
}

/**
 * Send FCM push notification for scan result
 * This works even when the phone is locked!
 */
async function sendScanNotification(
  pendingScan: PendingScan,
  result: {
    success: boolean;
    receipt?: any;
    receiptId?: string;
    error?: string;
  }
): Promise<void> {
  try {
    // Get user's FCM token
    let fcmToken = pendingScan.fcmToken;

    if (!fcmToken) {
      // Try to get from user document
      const userDoc = await db
        .collection(collections.users)
        .doc(pendingScan.userId)
        .get();
      
      if (userDoc.exists) {
        fcmToken = userDoc.data()?.fcmToken;
      }
    }

    if (!fcmToken) {
      console.log('No FCM token available for user', pendingScan.userId);
      return;
    }

    let notification: admin.messaging.Notification;
    let data: { [key: string]: string };

    if (result.success && result.receipt) {
      const itemCount = result.receipt.items?.length || 0;
      const storeName = result.receipt.storeName || 'Magasin';
      const total = result.receipt.total || 0;
      const currency = result.receipt.currency || 'USD';

      notification = {
        title: '✅ Reçu analysé avec succès!',
        body: `${storeName}: ${itemCount} article${itemCount > 1 ? 's' : ''} - ${total.toFixed(2)} ${currency}`,
      };

      data = {
        type: 'scan_complete',
        receiptId: result.receiptId || '',
        pendingScanId: pendingScan.id,
        storeName,
        itemCount: String(itemCount),
        total: String(total),
        currency,
      };
    } else {
      notification = {
        title: '❌ Échec de l\'analyse',
        body: result.error || 'Une erreur est survenue lors de l\'analyse du reçu.',
      };

      data = {
        type: 'scan_failed',
        pendingScanId: pendingScan.id,
        error: result.error || 'Unknown error',
      };
    }

    // Send FCM message
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification,
      data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'scan_results',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: notification,
            sound: 'default',
            badge: 1,
            'content-available': 1,
          },
        },
        headers: {
          'apns-priority': '10',
        },
      },
    };

    await messaging.send(message);
    console.log(`📱 Notification sent to user ${pendingScan.userId}`);

    // Save notification to Firestore for notification history
    try {
      const notificationRef = db
        .collection(`artifacts/${config.app.id}/users/${pendingScan.userId}/notifications`)
        .doc();

      await notificationRef.set({
        id: notificationRef.id,
        title: notification.title,
        body: notification.body,
        type: result.success ? 'receipt' : 'general',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        data: result.success
          ? {
              receiptId: result.receiptId,
              storeName: result.receipt?.storeName,
              total: result.receipt?.total,
              currency: result.receipt?.currency,
            }
          : { error: result.error },
      });

      console.log(`💾 Notification saved to Firestore for user ${pendingScan.userId}`);
    } catch (saveError) {
      console.error('Error saving notification to Firestore:', saveError);
      // Don't throw - FCM notification already sent
    }
  } catch (error: any) {
    // Handle invalid token
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      console.log('Invalid FCM token, removing from user document');
      await db.collection(collections.users).doc(pendingScan.userId).update({
        fcmToken: admin.firestore.FieldValue.delete(),
      });
    } else {
      console.error('Error sending notification:', error);
    }
  }
}

/**
 * Scheduled function to retry failed scans
 * Runs every 5 minutes
 */
export const retryFailedScans = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
    console.log('🔄 Checking for pending scans to retry...');

    try {
      // Get pending scans that need retry (status: pending, retryCount < 3)
      const pendingScans = await db
        .collection('pendingScans')
        .where('status', '==', 'pending')
        .where('retryCount', '<', 3)
        .limit(10)
        .get();

      if (pendingScans.empty) {
        console.log('No pending scans to retry');
        return null;
      }

      console.log(`Found ${pendingScans.size} pending scans to retry`);

      // Process each pending scan
      for (const doc of pendingScans.docs) {
        try {
          await processReceiptInBackground(doc.id);
        } catch (error) {
          console.error(`Failed to retry scan ${doc.id}:`, error);
        }
      }

      return null;
    } catch (error) {
      console.error('Error in retryFailedScans:', error);
      return null;
    }
  });

/**
 * Get pending scan status
 * Called from the mobile app to check if a scan is complete
 */
export const getPendingScanStatus = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { pendingScanId } = data;
    const userId = context.auth.uid;

    if (!pendingScanId) {
      throw new functions.https.HttpsError('invalid-argument', 'pendingScanId is required');
    }

    try {
      const doc = await db.collection('pendingScans').doc(pendingScanId).get();

      if (!doc.exists) {
        return { found: false };
      }

      const pendingScan = doc.data() as PendingScan;

      // Verify ownership
      if (pendingScan.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied');
      }

      return {
        found: true,
        status: pendingScan.status,
        receiptId: pendingScan.receiptId,
        error: pendingScan.error,
        retryCount: pendingScan.retryCount,
      };
    } catch (error: any) {
      console.error('Error getting pending scan status:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Get all pending scans for a user
 */
export const getUserPendingScans = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;

    try {
      const snapshot = await db
        .collection('pendingScans')
        .where('userId', '==', userId)
        .where('status', 'in', ['pending', 'processing'])
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const pendingScans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
      }));

      return { pendingScans };
    } catch (error: any) {
      console.error('Error getting user pending scans:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Cancel a pending scan
 */
export const cancelPendingScan = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { pendingScanId } = data;
    const userId = context.auth.uid;

    if (!pendingScanId) {
      throw new functions.https.HttpsError('invalid-argument', 'pendingScanId is required');
    }

    try {
      const docRef = db.collection('pendingScans').doc(pendingScanId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pending scan not found');
      }

      const pendingScan = doc.data() as PendingScan;

      if (pendingScan.userId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied');
      }

      // Delete the pending scan
      await docRef.delete();

      // Delete the image from Cloud Storage
      if (pendingScan.storagePath) {
        try {
          await storage.bucket().file(pendingScan.storagePath).delete();
        } catch (err) {
          console.log('Could not delete image:', err);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error cancelling pending scan:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
