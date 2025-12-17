# Google and Apple Sign-In Setup Guide

This guide will help you configure Google and Apple Sign-In for the GoShopper app.

## Prerequisites

1. Firebase project set up
2. Google Cloud Console access
3. Apple Developer account (for iOS)

## Android Setup - Google Sign-In

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **General** tab
4. Scroll down to **Your apps** section
5. Click on your Android app or add a new Android app
6. Download the `google-services.json` file
7. Place it in `android/app/google-services.json`

### 2. Update Auth Service

In `src/shared/services/firebase/auth.ts`, replace `'YOUR_FIREBASE_WEB_CLIENT_ID'` with your actual web client ID:

```typescript
GoogleSignin.configure({
  webClientId: '123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com', // Your actual web client ID
  offlineAccess: true,
});
```

**To find your web client ID:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** > **Credentials**
4. Find the **Web client (auto created by Google Service)** or **Web application** credential
5. Copy the **Client ID**

## iOS Setup - Apple Sign-In

### 1. Apple Developer Configuration

1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Identifiers** from the sidebar
4. Click the **+** button to create a new identifier
5. Select **App IDs** and click **Continue**
6. Choose **App** and click **Continue**
7. Fill in your app details:
   - **Bundle ID**: `com.goshopper.app`
   - **Description**: GoShopper
8. Under **Capabilities**, enable **Sign In with Apple**
9. Click **Continue** and **Register**

### 2. Xcode Configuration

1. Open your project in Xcode
2. Select your target
3. Go to **Signing & Capabilities**
4. Click **+ Capability**
5. Add **Sign In with Apple**

## Firebase Configuration

### Enable Authentication Providers

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** > **Sign-in method**
4. Enable **Google** and **Apple** providers

### Google Provider Setup

1. In Firebase Console, click on **Google** provider
2. Enter your **Web client ID** (same as used in the app)
3. Add your project support email
4. Click **Save**

### Apple Provider Setup

1. In Firebase Console, click on **Apple** provider
2. You'll need:
   - **Service ID**: Create this in Apple Developer Console
   - **Apple Team ID**: Your Apple Developer Team ID
   - **Key ID**: From the private key you generate
   - **Private Key**: The .p8 file content
3. Click **Save**

## Testing

1. Run the app: `npm run android` or `npm run ios`
2. Try signing in with Google and Apple
3. Check Firebase Console > Authentication to see signed-in users

## Troubleshooting

### Common Issues

1. **Google Sign-In not working on Android:**
   - Ensure `google-services.json` is in the correct location
   - Check that the web client ID matches exactly
   - Verify SHA-1 fingerprint is added to Firebase

2. **Apple Sign-In not working on iOS:**
   - Ensure Sign In with Apple capability is enabled in Xcode
   - Check that the bundle ID matches your Apple app ID
   - Verify Firebase Apple configuration is correct

3. **Build errors:**
   - Clean and rebuild: `cd android && ./gradlew clean && cd .. && npm run android`
   - Check that all dependencies are installed: `npm install`

### Debug Tips

- Check device logs for detailed error messages
- Use Firebase Console > Authentication > Users to see sign-in attempts
- Test with different devices/emulators

## Security Notes

- Never commit `google-services.json` to version control
- Keep your web client ID and other secrets secure
- Regularly rotate your signing keys
- Use Firebase Security Rules to protect your data