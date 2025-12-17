# Development Setup

## Overview

This guide covers setting up the development environment for Invoice Intelligence, including the optimized stack for DRC market conditions.

## Prerequisites

### Required Software

| Software       | Version  | Purpose                      |
| -------------- | -------- | ---------------------------- |
| Node.js        | 18.x LTS | JavaScript runtime           |
| npm / yarn     | Latest   | Package manager              |
| Git            | Latest   | Version control              |
| VS Code        | Latest   | Recommended IDE              |
| Android Studio | Latest   | Android development          |
| Xcode          | 14+      | iOS development (macOS only) |
| Java JDK       | 17       | Required for Android builds  |

### Accounts Required

| Service         | Purpose          | Sign Up                                                                         |
| --------------- | ---------------- | ------------------------------------------------------------------------------- |
| Firebase        | Backend services | [console.firebase.google.com](https://console.firebase.google.com)              |
| Google Cloud    | Gemini API       | [console.cloud.google.com](https://console.cloud.google.com)                    |
| Moko Afrika     | Payments (DRC)   | [mokoafrika.com/become-merchant](https://www.mokoafrika.com/en/become-merchant) |
| Expo (optional) | Managed workflow | [expo.dev](https://expo.dev)                                                    |

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/kandyfoma/goshopper.git
cd goshopper
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# Or using yarn
yarn install

# Install additional optimized dependencies
npm install @nozbe/watermelondb @nozbe/with-observables  # Offline database
npm install react-native-image-resizer                   # Image compression
npm install @react-native-ml-kit/text-recognition        # Offline OCR
```

### 3. Enable Hermes Engine (Performance Optimization)

Hermes provides 53% faster startup and 33% smaller bundle size.

**Android** - Edit `android/app/build.gradle`:

```gradle
project.ext.react = [
    enableHermes: true,  // Make sure this is true
]
```

**iOS** - Edit `ios/Podfile`:

```ruby
:hermes_enabled => true,
```

Then rebuild:

```bash
cd ios && pod install && cd ..
```

### 3. Environment Configuration

Create environment files for different stages:

```bash
# Development environment
cp .env.example .env.development

# Production environment
cp .env.example .env.production
```

Edit `.env.development`:

```bash
# App Configuration
APP_ID=invoice-intelligence-dev
APP_NAME=Invoice Intelligence (Dev)
APP_URL=https://invoice-intelligence-dev.web.app

# Firebase Configuration
FIREBASE_API_KEY=AIzaSy...your_dev_key
FIREBASE_AUTH_DOMAIN=invoice-intelligence-dev.firebaseapp.com
FIREBASE_PROJECT_ID=invoice-intelligence-dev
FIREBASE_STORAGE_BUCKET=invoice-intelligence-dev.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Moko Afrika (Test Mode)
MOKO_API_KEY=test_xxxxxxxxxxxxxxxx
MOKO_SECRET_KEY=test_sk_xxxxxxxxxxxxxxxx
MOKO_API_URL=https://sandbox.mokoafrika.com/v1

# Feature Flags
ENABLE_ANALYTICS=false
PAYMENT_MODE=test
```

### 4. Firebase Setup

#### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project"
3. Name: `invoice-intelligence-dev`
4. Enable Google Analytics (optional for dev)
5. Create project

#### Enable Services

```bash
# Authentication
- Go to Authentication > Sign-in method
- Enable "Anonymous" provider

# Firestore
- Go to Firestore Database
- Create database in test mode
- Location: europe-west1

# Cloud Functions
- Enable Cloud Functions
- Will deploy Gemini proxy function

# Storage (optional for dev)
- Go to Storage
- Get started with default rules
```

#### Add App to Firebase

```bash
# For React Native
1. Click gear icon > Project settings
2. Add app > iOS
   - Bundle ID: com.invoiceintelligence.app
   - Download GoogleService-Info.plist
3. Add app > Android
   - Package name: com.invoiceintelligence.app
   - Download google-services.json
4. Add app > Web (for testing)
   - Copy config object
```

#### Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase init
# Select: Firestore, Functions, Storage, Hosting
```

#### Deploy Cloud Functions (Including Gemini Proxy)

```bash
# Navigate to functions directory
cd functions
npm install

# Set secrets for Gemini API
firebase functions:secrets:set GEMINI_API_KEY

# Deploy all functions
firebase deploy --only functions

# Deploy security rules
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

The `parseReceipt` Cloud Function will proxy all Gemini calls securely. See [STACK_OPTIMIZATIONS.md](../architecture/STACK_OPTIMIZATIONS.md) for implementation details.

### 5. Gemini API Setup

1. Go to [Google AI Studio](https://makersuite.google.com/)
2. Click "Get API Key"
3. Create new API key
4. Add to `.env.development`

Or via Google Cloud Console:

1. Enable "Generative Language API"
2. Create credentials > API key
3. Restrict to Generative Language API only

---

## Running the App

### Development Server

```bash
# Start Metro bundler
npm start

# Or with cache clear
npm start -- --reset-cache
```

### Android

```bash
# Start Android emulator first, then:
npm run android

# Or run on connected device
npm run android -- --device
```

### iOS (macOS only)

```bash
# Install pods first
cd ios && pod install && cd ..

# Run on simulator
npm run ios

# Run on specific simulator
npm run ios -- --simulator="iPhone 15 Pro"
```

### Web

```bash
npm run web
```

---

## Project Scripts

| Command                    | Description            |
| -------------------------- | ---------------------- |
| `npm start`                | Start Metro bundler    |
| `npm run android`          | Run on Android         |
| `npm run ios`              | Run on iOS             |
| `npm run web`              | Run on web             |
| `npm run test`             | Run unit tests         |
| `npm run lint`             | Run ESLint             |
| `npm run typecheck`        | Run TypeScript checks  |
| `npm run build:android`    | Build Android APK      |
| `npm run build:ios`        | Build iOS archive      |
| `npm run deploy:functions` | Deploy Cloud Functions |

---

## Verifying Optimizations

### Check Hermes is Enabled

```typescript
// Add to App.tsx to verify
const isHermes = () => !!global.HermesInternal;
console.log('Hermes enabled:', isHermes()); // Should be true
```

### Test Image Compression

```typescript
// Test compression in dev
import {compressReceiptImage} from '@/services/image/compression';

const testCompression = async (imageUri: string) => {
  const result = await compressReceiptImage(imageUri);
  console.log(`Original: ${result.originalSize}`);
  console.log(`Compressed: ${result.compressedSize}`);
  console.log(`Savings: ${result.savingsPercent}%`); // Should be ~90%
};
```

### Test Offline OCR

```typescript
// Test ML Kit OCR
import {performOnDeviceOcr} from '@/services/ocr/mlkit';

const testOfflineOcr = async (imageUri: string) => {
  const result = await performOnDeviceOcr(imageUri);
  console.log('OCR Success:', result.success);
  console.log('Lines found:', result.lines.length);
};
```

### Test WatermelonDB

```typescript
// Test local database
import {database} from '@/database';

const testDatabase = async () => {
  const invoices = await database.get('invoices').query().fetch();
  console.log('Local invoices:', invoices.length);
};
```

---

## IDE Configuration

### VS Code Extensions

Install recommended extensions:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets",
    "formulahendry.auto-rename-tag",
    "naumovs.color-highlight",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["className\\s*=\\s*[\"']([^\"']*)[\"']", "([\\w-/:]+)"]
  ]
}
```

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/features/scanner/__tests__/
```

### E2E Tests (Detox)

```bash
# Build test app
detox build --configuration ios.sim.debug

# Run E2E tests
detox test --configuration ios.sim.debug
```

---

## Debugging

### React Native Debugger

1. Install [React Native Debugger](https://github.com/jhen0409/react-native-debugger)
2. Start debugger before running app
3. Enable debugging in app (shake device > Debug)

### Flipper

1. Install [Flipper](https://fbflipper.com/)
2. Flipper auto-connects to React Native apps
3. Use for network inspection, logs, layouts

### Firebase Emulators

```bash
# Start local emulators
firebase emulators:start

# Emulators available at:
# - Firestore: http://localhost:8080
# - Auth: http://localhost:9099
# - Functions: http://localhost:5001
```

Configure app to use emulators:

```typescript
// src/shared/services/firebase/config.ts
if (__DEV__) {
  // Connect to local emulators
  auth().useEmulator('http://localhost:9099');
  firestore().useEmulator('localhost', 8080);
}
```

---

## Common Issues

### Metro Bundler Issues

```bash
# Clear Metro cache
npm start -- --reset-cache

# Clear all caches
watchman watch-del-all
rm -rf node_modules
rm -rf $TMPDIR/metro-*
npm install
```

### iOS Build Issues

```bash
# Clear derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Reinstall pods
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
cd ..
```

### Android Build Issues

```bash
# Clean Gradle
cd android
./gradlew clean
cd ..

# Rebuild
npm run android
```

### Firebase Connection Issues

1. Check `google-services.json` (Android) is in `android/app/`
2. Check `GoogleService-Info.plist` (iOS) is in `ios/`
3. Verify Firebase project ID matches `.env`
4. Check internet connection

---

## Deployment Checklist

### Before First Deploy

- [ ] Create production Firebase project
- [ ] Set up production environment variables
- [ ] Deploy Cloud Functions (including Gemini proxy)
- [ ] Configure Moko Afrika production keys
- [ ] Set up Gemini API production quota
- [ ] Configure Firebase Security Rules
- [ ] Set up crash reporting (Crashlytics)
- [ ] Configure analytics events
- [ ] Test payment flow in sandbox
- [ ] Prepare store listings (Play Store, App Store)

### Pre-Release Checklist

- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Hermes engine enabled and verified
- [ ] Image compression working (~90% reduction)
- [ ] Offline OCR fallback tested
- [ ] WatermelonDB sync tested
- [ ] Performance tested on low-end device (e.g., Samsung A10)
- [ ] Offline mode tested (airplane mode)
- [ ] Payment flow tested end-to-end
- [ ] Version number bumped
- [ ] Release notes prepared

### DRC-Specific Testing

- [ ] Test on 2G/3G network (throttle in DevTools)
- [ ] Test offline queue scanning
- [ ] Test sync after going back online
- [ ] Verify image compression saves data costs
- [ ] Test with French language
- [ ] Test Mobile Money sandbox payment

---

## Next Steps

After setup is complete:

1. Review [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md)
2. Understand [Data Models](../data/DATA_MODELS.md)
3. Follow [User Flows](../product/USER_FLOWS.md) for implementation
4. Check [Contributing Guidelines](./CONTRIBUTING.md) before coding

---

_For deployment instructions, see [Deployment Guide](./DEPLOYMENT.md)_
