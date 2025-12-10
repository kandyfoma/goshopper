# Payment Integration (Mobile Money & Stripe)

## Overview

Invoice Intelligence uses **dual payment providers** to serve both local and international users:
- **Moko Afrika**: Primary payment gateway for DRC users (Mobile Money)
- **Stripe**: Payment gateway for international users (Visa/Card payments)

## Payment Provider Selection by Location

| User Location | Payment Options | Provider |
|--------------|-----------------|----------|
| **DRC (+243)** | Mobile Money, Visa/Card | Moko Afrika + Stripe |
| **International** | Visa/Card only | Stripe |

## Why Moko Afrika for DRC?

| Feature | Moko Afrika | International Providers |
|---------|-------------|------------------------|
| **Local Presence** | ✅ DRC office & support | ❌ Remote support only |
| **Local Phone** | +243 898 900 066 | International numbers |
| **Mobile Money Focus** | ✅ Primary business | Secondary feature |
| **DRC Currency** | ✅ Native CDF support | Limited/conversion fees |
| **Onboarding** | 24-48 hours | Days/weeks |
| **Connected Wallets** | 47M+ | N/A for DRC |
| **Transactions** | 50M+ processed | N/A |

**Contact**: info@mokoafrika.com | +243 898 900 066 | https://www.mokoafrika.com

## Why Stripe for International?

| Feature | Stripe |
|---------|--------|
| **Global Coverage** | 195+ countries |
| **Card Support** | Visa, Mastercard, Amex |
| **Developer Experience** | Excellent SDK & docs |
| **Security** | PCI DSS Level 1 |
| **Fraud Detection** | Built-in Radar |

**Dashboard**: https://dashboard.stripe.com

## Payment Providers

### Supported Mobile Money Operators (DRC)

| Operator | Network Code | Market Share |
|----------|--------------|--------------|
| M-Pesa | `MPESA` | ~30% |
| Orange Money | `ORANGE` | ~30% |
| Airtel Money | `AIRTEL` | ~25% |
| AfriMoney | `AFRIMONEY` | ~15% |

### Supported Card Types (International)

| Card Type | Support |
|-----------|---------|
| Visa | ✅ |
| Mastercard | ✅ |
| American Express | ✅ |
| Discover | ✅ |

## Subscription Plans

### Pricing Structure

| Plan | Price (USD) | Price (CDF) | Scan Limit |
|------|-------------|-------------|------------|
| **Free Trial** | $0 | 0 FC | 2 months unlimited |
| **Basic** | $1.99 | 8,000 FC | 25 scans/month |
| **Standard** | $2.99 | 12,000 FC | 100 scans/month |
| **Premium** | $4.99 | 20,000 FC | Unlimited |

*CDF prices based on ~2,700 CDF/USD rate, rounded for simplicity*

---

## Stripe Integration (International Payments)

### Setup Requirements

1. Stripe account (https://dashboard.stripe.com)
2. API keys (publishable + secret)
3. Webhook endpoint configured
4. `@stripe/stripe-react-native` SDK installed

### Environment Variables

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Payment Flow (Card)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Paywall   │──▶│   Create    │──▶│   Stripe    │──▶│   Webhook   │
│   Screen    │   │   Intent    │   │   Payment   │   │   Confirm   │
└─────────────┘   └─────────────┘   │   Sheet     │   └─────────────┘
                                    └─────────────┘
```

### Cloud Function Implementation

```typescript
// functions/src/payments/stripe.ts

import * as functions from 'firebase-functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const createPaymentIntent = functions.https.onCall(async (data, context) => {
  const { planId, currency, email } = data;
  const userId = context.auth?.uid;

  const planPrices: Record<string, number> = {
    basic: 199,    // $1.99 in cents
    standard: 299, // $2.99 in cents
    premium: 499,  // $4.99 in cents
  };

  const paymentIntent = await stripe.paymentIntents.create({
    amount: planPrices[planId],
    currency: currency.toLowerCase(),
    metadata: { userId, planId },
    receipt_email: email,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
});
```

### Webhook Handler

```typescript
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const event = stripe.webhooks.constructEvent(
    req.rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { userId, planId } = paymentIntent.metadata;
    
    // Activate subscription
    await activateSubscription(userId, planId, 'stripe');
  }

  res.status(200).send('OK');
});
```

---

## Moko Afrika Integration

### Merchant Onboarding

1. **Visit**: https://www.mokoafrika.com/en/become-merchant
2. **Submit Application** with business documents
3. **Verification**: 24-48 hours
4. **Receive API Credentials**: API Key + Secret provided after approval
5. **Configure Webhooks**: Set callback URL in merchant dashboard

### Setup Requirements

1. Moko Afrika merchant account (business verification required)
2. DRC Mobile Money operators enabled
3. Webhook endpoint configured
4. API credentials (API Key + Secret)

### Payment Flow

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Paywall   │──▶│  Initialize │──▶│   Mobile    │──▶│   Webhook   │
│   Screen    │   │   Payment   │   │   Money UI  │   │   Confirm   │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │   User      │
                                    │   Confirms  │
                                    │   on Phone  │
                                    └─────────────┘
```

### Client Implementation

```typescript
// src/shared/services/payment/mokoafrika.ts

import Config from 'react-native-config';

interface PaymentConfig {
  plan: 'monthly' | 'yearly';
  userId: string;
  email?: string;
  phone: string;
  currency: 'USD' | 'CDF';
  network?: 'MPESA' | 'ORANGE' | 'AIRTEL' | 'AFRIMONEY';
}

interface PaymentResult {
  success: boolean;
  transactionRef?: string;
  paymentUrl?: string;
  ussdCode?: string;
  error?: string;
}

const PLAN_PRICES = {
  monthly: { USD: 2.99, CDF: 8000 },
  yearly: { USD: 24.99, CDF: 67000 },
};

export class MokoAfrikaService {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = Config.MOKO_API_KEY;
    this.secretKey = Config.MOKO_SECRET_KEY;
    // Note: Actual API URL provided after merchant onboarding
    this.baseUrl = Config.MOKO_API_URL || 'https://api.mokoafrika.com/v1';
  }

  async initializePayment(config: PaymentConfig): Promise<PaymentResult> {
    const amount = PLAN_PRICES[config.plan][config.currency];
    const txRef = this.generateTransactionRef(config.userId);

    const payload = {
      reference: txRef,
      amount: amount,
      currency: config.currency,
      description: `Invoice Intelligence ${config.plan === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
      callback_url: `${Config.APP_URL}/payment/callback`,
      metadata: {
        user_id: config.userId,
        plan: config.plan,
        app_id: Config.APP_ID,
      },
      customer: {
        email: config.email || `${config.userId}@invoice-intelligence.app`,
        phone: config.phone,
      },
      payment_method: {
        type: 'mobile_money',
        provider: config.network?.toLowerCase() || 'mpesa',
        phone: config.phone,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/payments/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success && result.data) {
        return {
          success: true,
          transactionRef: txRef,
          paymentUrl: result.data.payment_url,
          ussdCode: result.data.ussd_code, // Moko may provide USSD for direct dial
        };
      }

      return {
        success: false,
        error: result.message || 'Payment initialization failed',
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async verifyPayment(transactionRef: string): Promise<PaymentVerification> {
    try {
      const response = await fetch(
        `${this.baseUrl}/payments/verify/${transactionRef}`,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'X-API-Key': this.apiKey,
          },
        }
      );

      const result = await response.json();

      if (result.success && result.data?.status === 'successful') {
        return {
          verified: true,
          amount: result.data.amount,
          currency: result.data.currency,
          transactionRef: result.data.reference,
          paymentType: result.data.payment_method,
          provider: result.data.provider,
        };
      }

      return {
        verified: false,
        status: result.data?.status || 'unknown',
      };

    } catch (error) {
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // Check payment status (for polling during USSD flow)
  async checkStatus(transactionRef: string): Promise<PaymentStatus> {
    try {
      const response = await fetch(
        `${this.baseUrl}/payments/status/${transactionRef}`,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'X-API-Key': this.apiKey,
          },
        }
      );

      const result = await response.json();

      return {
        status: result.data?.status || 'pending',
        message: result.data?.message,
      };

    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Status check failed',
      };
    }
  }

  private generateTransactionRef(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `INV-${timestamp}-${userId.substring(0, 8)}-${random}`;
  }
}

interface PaymentVerification {
  verified: boolean;
  amount?: number;
  currency?: string;
  transactionRef?: string;
  paymentType?: string;
  provider?: string;
  status?: string;
  error?: string;
}

interface PaymentStatus {
  status: 'pending' | 'processing' | 'successful' | 'failed' | 'error';
  message?: string;
}

export const mokoService = new MokoAfrikaService();
```

### React Native Component

```typescript
// src/features/subscription/components/PaymentModal.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, Linking, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';
import { mokoService } from '@/shared/services/payment/mokoafrika';

interface PaymentModalProps {
  visible: boolean;
  plan: 'monthly' | 'yearly';
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ visible, plan, userId, onClose, onSuccess }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState<'MPESA' | 'ORANGE' | 'AIRTEL' | 'AFRIMONEY'>('MPESA');
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const handleInitiatePayment = async () => {
    if (!phone || phone.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await mokoService.initializePayment({
      plan,
      userId,
      phone: formatPhoneNumber(phone),
      currency: 'USD',
      network,
    });

    setLoading(false);

    if (result.success) {
      setTransactionRef(result.transactionRef || null);
      
      if (result.paymentUrl) {
        setPaymentUrl(result.paymentUrl);
      } else if (result.ussdCode) {
        // For USSD-based payments, show code and poll for status
        setUssdCode(result.ussdCode);
        startPolling(result.transactionRef!);
      }
    } else {
      setError(result.error || 'Payment failed');
    }
  };

  const startPolling = (txRef: string) => {
    // Poll every 5 seconds for payment status
    const interval = setInterval(async () => {
      const status = await mokoService.checkStatus(txRef);
      
      if (status.status === 'successful') {
        clearInterval(interval);
        setUssdCode(null);
        onSuccess();
      } else if (status.status === 'failed') {
        clearInterval(interval);
        setUssdCode(null);
        setError('Payment was not completed');
      }
    }, 5000);
    
    setPollInterval(interval);
  };

  const handleWebViewNavigationChange = (navState: any) => {
    const { url } = navState;
    
    // Check for success callback
    if (url.includes('/payment/callback') && url.includes('status=successful')) {
      setPaymentUrl(null);
      onSuccess();
    }
    
    // Check for failure/cancel
    if (url.includes('status=cancelled') || url.includes('status=failed')) {
      setPaymentUrl(null);
      setError('Payment was not completed');
    }
  };

  const handleDialUSSD = () => {
    if (ussdCode) {
      // Open phone dialer with USSD code
      Linking.openURL(`tel:${encodeURIComponent(ussdCode)}`);
    }
  };

  const formatPhoneNumber = (num: string): string => {
    const cleaned = num.replace(/[\s-]/g, '');
    
    if (cleaned.startsWith('0')) {
      return `+243${cleaned.substring(1)}`;
    }
    if (!cleaned.startsWith('+')) {
      return `+243${cleaned}`;
    }
    return cleaned;
  };

  // USSD Payment Screen
  if (ussdCode) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-xl font-bold text-center mb-4">
              Complete Payment via USSD
            </Text>
            
            <Text className="text-center text-gray-600 mb-4">
              Dial the code below on your phone to complete payment:
            </Text>
            
            <TouchableOpacity 
              onPress={handleDialUSSD}
              className="bg-primary-50 border-2 border-primary-500 rounded-xl py-4 mb-4"
            >
              <Text className="text-2xl font-bold text-primary-500 text-center">
                {ussdCode}
              </Text>
              <Text className="text-sm text-primary-400 text-center mt-1">
                Tap to dial
              </Text>
            </TouchableOpacity>
            
            <View className="flex-row items-center justify-center mb-4">
              <ActivityIndicator size="small" color="#22c55e" />
              <Text className="ml-2 text-gray-500">
                Waiting for payment confirmation...
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => {
                if (pollInterval) clearInterval(pollInterval);
                setUssdCode(null);
              }}
            >
              <Text className="text-gray-500 text-center py-2">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // WebView Payment Screen
  if (paymentUrl) {
    return (
      <Modal visible={visible} animationType="slide">
        <View className="flex-1">
          <View className="flex-row justify-between items-center p-4 bg-primary-500">
            <Text className="text-white font-semibold">Complete Payment</Text>
            <TouchableOpacity onPress={() => setPaymentUrl(null)}>
              <Text className="text-white">Cancel</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: paymentUrl }}
            onNavigationStateChange={handleWebViewNavigationChange}
            startInLoadingState
            renderLoading={() => (
              <ActivityIndicator size="large" color="#22c55e" />
            )}
          />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-xl font-bold mb-4">
            Subscribe to {plan === 'monthly' ? 'Monthly' : 'Yearly'} Plan
          </Text>
          
          <Text className="text-2xl font-bold text-primary-500 mb-6">
            ${plan === 'monthly' ? '2.99' : '24.99'}/
            {plan === 'monthly' ? 'month' : 'year'}
          </Text>

          {/* Network Selection */}
          <Text className="text-sm text-gray-600 mb-2">Select Mobile Money Provider</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {(['MPESA', 'ORANGE', 'AIRTEL', 'AFRIMONEY'] as const).map((net) => (
              <TouchableOpacity
                key={net}
                onPress={() => setNetwork(net)}
                className={`flex-1 min-w-[45%] py-3 rounded-lg border ${
                  network === net 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-300'
                }`}
              >
                <Text className={`text-center ${
                  network === net ? 'text-primary-500 font-semibold' : 'text-gray-600'
                }`}>
                  {net === 'AFRIMONEY' ? 'AfriMoney' : net}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Phone Input */}
          <Text className="text-sm text-gray-600 mb-2">Phone Number</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
            placeholder="812 345 678"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          {error && (
            <Text className="text-red-500 mb-4">{error}</Text>
          )}

          {/* Powered by Moko Afrika */}
          <Text className="text-xs text-gray-400 text-center mb-3">
            Secured by Moko Afrika • 47M+ wallets connected
          </Text>

          {/* Action Buttons */}
          <TouchableOpacity
            onPress={handleInitiatePayment}
            disabled={loading}
            className={`py-4 rounded-xl mb-3 ${
              loading ? 'bg-gray-300' : 'bg-primary-500'
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold">
                Pay with Mobile Money
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text className="text-gray-500 text-center py-2">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

## Webhook Handler (Cloud Function)

```typescript
// functions/src/payments/handlePaymentWebhook.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const MOKO_WEBHOOK_SECRET = functions.config().moko?.webhook_secret;

interface MokoWebhookPayload {
  event: string;
  data: {
    reference: string;
    transaction_id: string;
    amount: number;
    currency: string;
    status: 'successful' | 'failed' | 'pending';
    payment_method: {
      type: string;
      provider: string;
      phone: string;
    };
    created_at: string;
    metadata: {
      user_id: string;
      plan: 'monthly' | 'yearly';
      app_id: string;
    };
    customer: {
      email: string;
      phone: string;
    };
  };
  signature: string;
}

// Verify webhook signature using HMAC
function verifyWebhookSignature(payload: any, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export const handlePaymentWebhook = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    
    // Verify webhook signature
    const signature = req.headers['x-moko-signature'] as string;
    if (!signature || !verifyWebhookSignature(req.body.data, signature, MOKO_WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature');
      res.status(401).send('Unauthorized');
      return;
    }

    const payload = req.body as MokoWebhookPayload;
    
    // Only process successful payments
    if (payload.event !== 'payment.completed') {
      res.status(200).send('Event ignored');
      return;
    }

    if (payload.data.status !== 'successful') {
      console.log(`Payment not successful: ${payload.data.status}`);
      res.status(200).send('Payment not successful');
      return;
    }

    const { user_id, plan, app_id } = payload.data.metadata;

    if (!user_id || !plan || !app_id) {
      console.error('Missing required metadata');
      res.status(400).send('Missing metadata');
      return;
    }

    // Calculate subscription dates
    const now = new Date();
    const endDate = new Date(now);
    
    if (plan === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Update Firestore
    const subscriptionRef = admin.firestore()
      .doc(`artifacts/${app_id}/users/${user_id}/subscription/status`);

    try {
      await subscriptionRef.set({
        userId: user_id,
        isSubscribed: true,
        plan: plan,
        amount: payload.data.amount,
        currency: payload.data.currency,
        subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
        subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
        lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
        lastPaymentAmount: payload.data.amount,
        paymentMethod: 'mobile_money',
        paymentProvider: 'moko_afrika',
        mobileMoneyProvider: payload.data.payment_method.provider,
        transactionId: payload.data.transaction_id,
        transactionRef: payload.data.reference,
        customerPhone: payload.data.customer.phone,
        status: 'active',
        autoRenew: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log(`Subscription activated for user: ${user_id}, plan: ${plan}, provider: ${payload.data.payment_method.provider}`);
      
      // Optional: Send confirmation SMS via Moko Afrika
      // await sendPaymentConfirmation(user_id, plan, payload.data.amount);

      res.status(200).send('OK');
      
    } catch (error) {
      console.error('Error updating subscription:', error);
      res.status(500).send('Internal error');
    }
  });

// Verify transaction independently (called from client after redirect)
export const verifyPayment = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { transactionRef } = data;
    
    if (!transactionRef) {
      throw new functions.https.HttpsError('invalid-argument', 'Transaction reference required');
    }

    const MOKO_SECRET = functions.config().moko?.secret_key;
    const MOKO_API_KEY = functions.config().moko?.api_key;
    const MOKO_API_URL = functions.config().moko?.api_url;
    
    const response = await fetch(
      `${MOKO_API_URL}/payments/verify/${transactionRef}`,
      {
        headers: {
          'Authorization': `Bearer ${MOKO_SECRET}`,
          'X-API-Key': MOKO_API_KEY,
        },
      }
    );

    const result = await response.json();

    if (result.success && result.data?.status === 'successful') {
      return {
        verified: true,
        amount: result.data.amount,
        currency: result.data.currency,
        provider: result.data.payment_method?.provider,
      };
    }

    return {
      verified: false,
      status: result.data?.status || 'unknown',
    };
  });
```

## Subscription Management

### Check Subscription Status

```typescript
// src/features/subscription/services/subscriptionService.ts

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Config from 'react-native-config';

export class SubscriptionService {
  private appId: string;

  constructor() {
    this.appId = Config.APP_ID;
  }

  async getStatus(): Promise<SubscriptionStatus> {
    const user = auth().currentUser;
    if (!user) {
      return this.getDefaultStatus();
    }

    const doc = await firestore()
      .doc(`artifacts/${this.appId}/users/${user.uid}/subscription/status`)
      .get();

    if (!doc.exists) {
      // Create initial subscription document
      const initial = this.getDefaultStatus();
      await this.initializeSubscription(user.uid);
      return initial;
    }

    const data = doc.data()!;
    
    // Check if subscription has expired
    if (data.isSubscribed && data.subscriptionEndDate) {
      const endDate = data.subscriptionEndDate.toDate();
      if (endDate < new Date()) {
        // Subscription expired
        await this.expireSubscription(user.uid);
        return {
          ...data,
          isSubscribed: false,
          status: 'expired',
        } as SubscriptionStatus;
      }
    }

    return {
      trialScansRemaining: data.trialScansLimit - data.trialScansUsed,
      isSubscribed: data.isSubscribed,
      plan: data.plan,
      subscriptionEndDate: data.subscriptionEndDate?.toDate(),
      status: data.status,
    } as SubscriptionStatus;
  }

  async canScan(): Promise<boolean> {
    const status = await this.getStatus();
    
    if (status.isSubscribed && status.status === 'active') {
      return true;
    }
    
    return status.trialScansRemaining > 0;
  }

  async recordScanUsage(): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new Error('Not authenticated');

    const status = await this.getStatus();
    
    if (status.isSubscribed) {
      // Subscribed users have unlimited scans
      return;
    }

    if (status.trialScansRemaining <= 0) {
      throw new Error('No scans remaining');
    }

    // Increment trial usage
    await firestore()
      .doc(`artifacts/${this.appId}/users/${user.uid}/subscription/status`)
      .update({
        trialScansUsed: firestore.FieldValue.increment(1),
      });
  }

  private async initializeSubscription(userId: string): Promise<void> {
    await firestore()
      .doc(`artifacts/${this.appId}/users/${userId}/subscription/status`)
      .set({
        userId,
        trialScansUsed: 0,
        trialScansLimit: 5,
        trialStartDate: firestore.FieldValue.serverTimestamp(),
        isSubscribed: false,
        status: 'trial',
        autoRenew: false,
      });
  }

  private async expireSubscription(userId: string): Promise<void> {
    await firestore()
      .doc(`artifacts/${this.appId}/users/${userId}/subscription/status`)
      .update({
        isSubscribed: false,
        status: 'expired',
      });
  }

  private getDefaultStatus(): SubscriptionStatus {
    return {
      trialScansRemaining: 5,
      isSubscribed: false,
      status: 'trial',
    };
  }

  subscribeToStatus(callback: (status: SubscriptionStatus) => void): () => void {
    const user = auth().currentUser;
    if (!user) {
      callback(this.getDefaultStatus());
      return () => {};
    }

    return firestore()
      .doc(`artifacts/${this.appId}/users/${user.uid}/subscription/status`)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data()!;
          callback({
            trialScansRemaining: data.trialScansLimit - data.trialScansUsed,
            isSubscribed: data.isSubscribed,
            plan: data.plan,
            subscriptionEndDate: data.subscriptionEndDate?.toDate(),
            status: data.status,
          });
        } else {
          callback(this.getDefaultStatus());
        }
      });
  }
}

export const subscriptionService = new SubscriptionService();
```

## Testing Payments

### Test Mode Configuration

```bash
# .env.development
MOKO_API_KEY=test_xxxxxxxxxxxxxxxx
MOKO_SECRET_KEY=test_sk_xxxxxxxxxxxxxxxx
MOKO_API_URL=https://sandbox.mokoafrika.com/v1
PAYMENT_MODE=test
```

### Test Phone Numbers

| Network | Test Number | Expected Result |
|---------|-------------|-----------------|
| M-Pesa | +243812345678 | Success |
| Orange Money | +243999999999 | Success |
| Airtel Money | +243888888888 | Success |
| AfriMoney | +243777777777 | Success |
| Any | +243000000000 | Failure |

*Note: Actual test numbers provided by Moko Afrika after merchant onboarding*

### Testing Webhooks Locally

```bash
# Use ngrok to expose local function
ngrok http 5001

# Set webhook URL in Moko Afrika merchant dashboard
# https://<ngrok-id>.ngrok.io/invoice-intelligence-dev/europe-west1/handlePaymentWebhook
```

## Moko Afrika Support

### Contact Information
- **Phone**: +243 898 900 066
- **Email**: info@mokoafrika.com
- **Website**: https://www.mokoafrika.com
- **Merchant Portal**: https://www.mokoafrika.com/en/become-merchant

### Onboarding Process
1. Submit merchant application online
2. Business verification (24-48 hours)
3. Receive API credentials
4. Configure webhooks
5. Test in sandbox environment
6. Go live

### Key Advantages for DRC
- **Local Presence**: DRC-based company with local support
- **47M+ Wallets**: Direct connection to major Mobile Money networks
- **50M+ Transactions**: Proven track record in DRC market
- **All Major Operators**: M-Pesa, Orange Money, Airtel Money, AfriMoney
- **Fast Onboarding**: 24-48 hour merchant verification
- **Native CDF Support**: No currency conversion required

---

*Next: [User Flows](../product/USER_FLOWS.md)*
