# Facebook SDK Setup Guide

This guide explains how to configure Facebook authentication for the GoShopper app.

## Overview

Facebook authentication has been integrated into the app using `react-native-fbsdk-next`. The following steps are required to complete the setup.

## Prerequisites

1. Facebook Developer Account
2. Facebook App created in Facebook Developers Console
3. App ID and Client Token from Facebook

## Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Consumer" as app type
4. Fill in app details:
   - **App Name**: GoShopper
   - **Contact Email**: Your email
5. Click "Create App"
6. Note down your **App ID** and **App Secret**

## Step 2: Configure Android

### 2.1 Update `android/app/src/main/res/values/strings.xml`

```xml
<resources>
    <string name="app_name">goshopperai</string>
    <string name="facebook_app_id">YOUR_FACEBOOK_APP_ID</string>
    <string name="fb_login_protocol_scheme">fbYOUR_FACEBOOK_APP_ID</string>
    <string name="facebook_client_token">YOUR_CLIENT_TOKEN</string>
</resources>
```

### 2.2 Update `android/app/src/main/AndroidManifest.xml`

Add the following inside the `<application>` tag:

```xml
<meta-data
    android:name="com.facebook.sdk.ApplicationId"
    android:value="@string/facebook_app_id"/>

<meta-data
    android:name="com.facebook.sdk.ClientToken"
    android:value="@string/facebook_client_token"/>

<activity
    android:name="com.facebook.FacebookActivity"
    android:configChanges="keyboard|keyboardHidden|screenLayout|screenSize|orientation"
    android:label="@string/app_name" />

<activity
    android:name="com.facebook.CustomTabActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="@string/fb_login_protocol_scheme" />
    </intent-filter>
</activity>
```

### 2.3 Get Release Key Hash

Run the following command to generate your release key hash:

```bash
cd android
./gradlew signingReport
```

Or use keytool directly:

```bash
keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64
```

Default password is usually: `android`

### 2.4 Configure Facebook App Settings

1. Go to Facebook App Dashboard
2. Navigate to **Settings** → **Basic**
3. Add **Android** platform
4. Enter:
   - **Package Name**: `com.goshopperai`
   - **Class Name**: `com.goshopperai.MainActivity`
   - **Key Hashes**: Paste the hash from step 2.3
5. Save changes

## Step 3: Configure iOS

### 3.1 Update `ios/goshopperai/Info.plist`

Add the following before the final `</dict>`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>fbYOUR_FACEBOOK_APP_ID</string>
    </array>
  </dict>
</array>
<key>FacebookAppID</key>
<string>YOUR_FACEBOOK_APP_ID</string>
<key>FacebookClientToken</key>
<string>YOUR_CLIENT_TOKEN</string>
<key>FacebookDisplayName</key>
<string>GoShopper</string>
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>fbapi</string>
  <string>fb-messenger-share-api</string>
  <string>fbauth2</string>
  <string>fbshareextension</string>
</array>
```

### 3.2 Update `ios/goshopperai/AppDelegate.mm`

Add the import at the top:

```objective-c
#import <FBSDKCoreKit/FBSDKCoreKit-Swift.h>
```

Add the following in the `application:didFinishLaunchingWithOptions:` method:

```objective-c
[[FBSDKApplicationDelegate sharedInstance] application:application
                         didFinishLaunchingWithOptions:launchOptions];
```

Add URL handler method:

```objective-c
- (BOOL)application:(UIApplication *)app
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  if ([[FBSDKApplicationDelegate sharedInstance] application:app openURL:url options:options]) {
    return YES;
  }
  return NO;
}
```

### 3.3 Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### 3.4 Configure Facebook App Settings

1. Go to Facebook App Dashboard
2. Navigate to **Settings** → **Basic**
3. Add **iOS** platform
4. Enter:
   - **Bundle ID**: `org.reactjs.native.example.goshopperai`
5. Save changes

## Step 4: Get Client Token

1. Go to Facebook App Dashboard
2. Navigate to **Settings** → **Advanced**
3. Scroll down to **Security** section
4. Copy the **Client Token**
5. Use this token in the configuration files above

## Step 5: Configure App for Production

### 5.1 Enable Facebook Login

1. Go to Facebook App Dashboard
2. Click on **Add Product**
3. Select **Facebook Login**
4. Click **Settings** under Facebook Login
5. Configure:
   - **Valid OAuth Redirect URIs**: Add your app's redirect URIs
   - **Login from Devices**: Enabled

### 5.2 Privacy Policy and Terms

1. Add **Privacy Policy URL** in App Settings
2. Add **Terms of Service URL** in App Settings
3. These are required for Facebook Login to work in production

### 5.3 Make App Public

1. Go to **App Review** → **Permissions and Features**
2. Request **public_profile** and **email** permissions
3. Switch app to **Live** mode in the top bar

## Step 6: Test the Integration

### Testing on Android

```bash
npm run android
```

### Testing on iOS

```bash
npm run ios
```

### Test Login Flow

1. Open the app
2. Navigate to Login or Register screen
3. Tap "Continuer avec Facebook"
4. Authorize the app
5. Verify user is logged in

## Troubleshooting

### Android Issues

**Problem**: "Invalid key hash"
- **Solution**: Make sure you've added the correct key hash to Facebook App settings
- Generate key hash again and add it to Facebook console

**Problem**: "App not set up correctly"
- **Solution**: Verify `facebook_app_id` and `facebook_client_token` are correct in `strings.xml`

### iOS Issues

**Problem**: "Can't Load URL"
- **Solution**: Check that URL scheme `fbYOUR_FACEBOOK_APP_ID` is correctly configured in `Info.plist`

**Problem**: "Missing FacebookAppID"
- **Solution**: Verify all Facebook keys are added to `Info.plist`

### General Issues

**Problem**: "Login failed"
- **Solution**: Check Firebase console has Facebook authentication enabled
- Verify Facebook App ID and App Secret are added to Firebase

## Firebase Configuration

Don't forget to enable Facebook authentication in Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** → **Sign-in method**
4. Enable **Facebook**
5. Enter your Facebook **App ID** and **App Secret**
6. Copy the **OAuth redirect URI** and add it to Facebook App's **Valid OAuth Redirect URIs**

## Security Notes

- Never commit `strings.xml` or `Info.plist` with real credentials to public repositories
- Use environment variables or secure configuration management
- Rotate App Secret if accidentally exposed
- Use different Facebook Apps for development and production

## Additional Resources

- [Facebook SDK for React Native](https://github.com/thebergamo/react-native-fbsdk-next)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Firebase Facebook Auth](https://firebase.google.com/docs/auth/android/facebook-login)
