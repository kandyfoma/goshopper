# GoShopper (Prix Tracker)

A React Native mobile app for receipt scanning and price comparison, designed specifically for the Democratic Republic of Congo (DRC) market.

## Features

- 📸 **Receipt Scanning** - Scan receipts using AI-powered OCR (Gemini 2.5 Flash)
- 💰 **Price Comparison** - Compare prices across stores to find the best deals
- 📊 **Spending Analytics** - Track spending patterns and categories
- 🔔 **Price Alerts** - Get notified when prices drop
- 💳 **Mobile Money Payments** - Subscribe via M-Pesa, Orange Money, Airtel Money, AfriMoney

## Tech Stack

### Mobile App

- React Native 0.73.6
- TypeScript
- React Navigation 6
- NativeWind (Tailwind CSS)
- Firebase SDK

### Backend (Firebase)

- Cloud Functions (Node.js 20)
- Firestore Database
- Firebase Auth (Anonymous)
- Firebase Storage
- Gemini 2.5 Flash AI
- Moko Afrika (Mobile Money)

## Project Structure

```
goshopper/
├── src/
│   ├── app/                  # App entry point
│   ├── features/             # Feature modules
│   │   ├── home/            # Home screen
│   │   ├── scanner/         # Receipt scanning
│   │   ├── history/         # Receipt history
│   │   ├── stats/           # Analytics
│   │   ├── profile/         # User profile
│   │   ├── settings/        # Settings
│   │   └── subscription/    # Subscription/paywall
│   ├── navigation/          # Navigation config
│   └── shared/              # Shared code
│       ├── contexts/        # React contexts
│       ├── services/        # API services
│       ├── types/           # TypeScript types
│       └── utils/           # Helpers & constants
├── functions/               # Firebase Cloud Functions
│   └── src/
│       ├── receipt/         # Receipt parsing
│       ├── payments/        # Moko Afrika integration
│       ├── subscription/    # Subscription management
│       └── prices/          # Price comparison
└── docs/                    # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- React Native CLI
- Android Studio / Xcode
- Firebase CLI

### Installation

1. **Clone and install dependencies**

   ```bash
   cd goshopper
   npm install
   ```

2. **Install Cloud Functions dependencies**

   ```bash
   cd functions
   npm install
   cd ..
   ```

3. **Configure Firebase**

   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Anonymous sign-in)
   - Enable Firestore (europe-west1 region)
   - Enable Cloud Storage
   - Download `google-services.json` (Android) to `android/app/`
   - Download `GoogleService-Info.plist` (iOS) to `ios/`

4. **Set environment variables for Cloud Functions**

   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   firebase functions:secrets:set MOKO_AFRIKA_API_KEY
   firebase functions:secrets:set MOKO_AFRIKA_SECRET_KEY
   firebase functions:secrets:set MOKO_AFRIKA_MERCHANT_ID
   ```

5. **Deploy Cloud Functions**

   ```bash
   firebase deploy --only functions
   ```

6. **Run the app**

   ```bash
   # Start Metro
   npm start

   # Run on Android
   npm run android

   # Run on iOS (macOS only)
   cd ios && pod install && cd ..
   npm run ios
   ```

## Cloud Functions

| Function                | Type     | Description                    |
| ----------------------- | -------- | ------------------------------ |
| `parseReceipt`          | Callable | Parse single receipt image     |
| `parseReceiptV2`        | Callable | Parse multi-page receipt       |
| `initiateMokoPayment`   | Callable | Start Mobile Money payment     |
| `verifyMokoPayment`     | Callable | Check payment status           |
| `mokoPaymentWebhook`    | HTTP     | Moko Afrika callback           |
| `getSubscriptionStatus` | Callable | Get user subscription          |
| `recordScanUsage`       | Callable | Track trial usage              |
| `savePriceData`         | Trigger  | Auto-save prices from receipts |
| `getPriceComparison`    | Callable | Get price comparison           |

## Subscription Plans

| Plan    | Price    | Features        |
| ------- | -------- | --------------- |
| Free    | $0       | 5 trial scans   |
| Basic   | $1.99/mo | 30 scans/month  |
| Premium | $2.99/mo | Unlimited scans |

## Contributing

This is a private project for the DRC market.

## License

Proprietary - GoShopper © 2024
