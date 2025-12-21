# Facebook Login Setup Guide

## ✅ Current Status

Your app is already configured with Facebook SDK. Here's what's in place:

### Android Configuration
- ✅ Facebook SDK initialized in `MainApplication.kt`
- ✅ Facebook App ID: `1932348127718450`
- ✅ Facebook Client Token configured
- ✅ AndroidManifest.xml has Facebook activities
- ✅ Package name: `com.goshopper.app`

## 🔑 Your Facebook Key Hash

```
5oHBtl2yKI1lOJO+V0pXIsbC7+E=
```

SHA-1 Fingerprint: `E6:81:C1:B6:5D:B2:28:8D:65:38:93:BE:57:4A:57:22:C6:C2:EF:E1`

## 📝 Required Steps in Facebook Developer Console

### Step 1: Go to Facebook App Settings
Visit: https://developers.facebook.com/apps/1932348127718450/settings/basic/

### Step 2: Configure Android Platform
1. Scroll down to find the **Android** platform section
2. If Android is not added, click "Add Platform" → "Android"

### Step 3: Enter Platform Details
Fill in these details:

- **Package Name**: `com.goshopper.app`
- **Default Activity Class Name**: `com.goshopper.app.MainActivity`
- **Key Hashes**: `5oHBtl2yKI1lOJO+V0pXIsbC7+E=`

### Step 4: Enable Facebook Login
1. Go to https://developers.facebook.com/apps/1932348127718450/fb-login/settings/
2. Make sure **Client OAuth Login** is **ENABLED**
3. **IMPORTANT**: Make sure **Embedded Browser OAuth Login** is **ENABLED**
4. For **Valid OAuth Redirect URIs**, you have two options:
   
   **Option A - Leave it EMPTY** (Recommended for native mobile apps)
   - Native Android apps don't require OAuth redirect URIs
   - The custom URL scheme `fb1932348127718450` is handled automatically via AndroidManifest
   
   **Option B - If you need to add a URI** (for web-based flows):
   - Use: `https://www.facebook.com/connect/login_success.html`
   - This is Facebook's default success page
   
5. Make sure **Login from Devices** is enabled if you want device login fallback

### Step 5: App Review (if needed)
If your Facebook App is in Development mode:
- Only testers/developers/admins can login
- To make it public, you need to submit for App Review
- Go to https://developers.facebook.com/apps/1932348127718450/app-review/

Add test users:
- Go to https://developers.facebook.com/apps/1932348127718450/roles/test-users/
- Add email addresses of people who should test

## 🔧 Testing Facebook Login

1. Make sure you're added as a tester in the Facebook App
2. Rebuild your Android app:
   ```powershell
   cd android
   ./gradlew clean
   cd ..
   npx react-native run-android
   ```
3. Try logging in with Facebook
4. Check the logs for any errors

## ⚠️ Common Issues

### "Redirecting to facebook.com instead of app"
**SOLUTION**: Make sure these are configured in Facebook Login Settings:
1. Go to: https://developers.facebook.com/apps/1932348127718450/fb-login/settings/
2. Enable **"Embedded Browser OAuth Login"**
3. Enable **"Client OAuth Login"**
4. For **Valid OAuth Redirect URIs**: 
   - Leave it EMPTY (native apps handle redirects via custom URL scheme)
   - OR use: `https://www.facebook.com/connect/login_success.html`
5. Save changes
6. Make sure the package name is correct in Android Platform Settings
7. Restart your app completely (kill and reopen)

### "App Not Setup: This app is still in development mode"
- Add yourself as a test user in Facebook Developer Console
- Or submit your app for review to make it public

### "Invalid Key Hash"
- Make sure the key hash `5oHBtl2yKI1lOJO+V0pXIsbC7+E=` is added in Facebook settings
- You need to add key hashes for BOTH debug and release builds

### "User cancelled the login process"
- This is normal if the user closes the login dialog
- Not an error with your configuration

### For Release Build
When you create a release build, you'll need to:
1. Get the SHA-1 of your release keystore
2. Generate a new key hash for release
3. Add it to Facebook settings

## 📱 Firebase Console Update (Already Done)

Your Google Sign-In is also configured with the correct SHA-1:
- SHA-1: `E6:81:C1:B6:5D:B2:28:8D:65:38:93:BE:57:4A:57:22:C6:C2:EF:E1`

This was updated in `android/app/google-services.json`

## 🎯 Next Steps After Facebook Setup

1. Add the key hash to Facebook Developer Console
2. Rebuild the app
3. Test login with a Facebook test account
4. Monitor logs for any authentication issues

## 📞 Need Help?

If you see any specific errors, check:
- Android Logcat for detailed error messages
- Facebook Developer Console → App Dashboard for any warnings
- Make sure your Facebook app is not in restricted mode
