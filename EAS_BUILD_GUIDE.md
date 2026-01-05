# EAS Build Guide for Google Play

## Overview
This guide explains how to build Android App Bundles (AAB) for Google Play using Expo Application Services (EAS).

## Prerequisites

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Login to Expo
```bash
eas login
```

### 3. Verify EAS Configuration
Your project is already configured with:
- ✅ `eas.json` - Build profiles configured
- ✅ `app.json` - EAS project ID set
- ✅ `credentials.json` - Keystore configuration
- ✅ `goshopper-release-key.keystore` - Signing keystore

## Build Profiles

### Production (Google Play)
```json
"production": {
  "android": {
    "buildType": "app-bundle",
    "credentialsSource": "local"
  }
}
```
This builds an AAB file using your local keystore.

### Preview (Testing)
```json
"preview": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```
This builds an APK for testing.

## Building for Google Play

### Method 1: Using EAS (Recommended) ✨

#### Step 1: Build AAB
```bash
# Build production AAB for Google Play
eas build --platform android --profile production
```

**What happens:**
1. EAS uploads your code to their servers
2. Builds the AAB with your local keystore
3. Downloads the signed AAB when complete
4. Typically takes 10-20 minutes

#### Step 2: Download the Build
The AAB will be:
- Available in the EAS dashboard: https://expo.dev/accounts/YOUR_ACCOUNT/projects/goshopper/builds
- Downloaded automatically to your machine
- Also accessible via the CLI

#### Step 3: Upload to Google Play
1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Navigate to **Production** → **Releases** → **Create new release**
4. Upload the AAB file
5. Add release notes
6. Submit for review

### Method 2: Local Build with Gradle

If you prefer building locally without EAS:

```powershell
# Windows
.\scripts\build-android-release.ps1

# Or use npm script
npm run build:android:windows
```

This uses the traditional Gradle build process.

## EAS Build Commands

### Build Production AAB
```bash
eas build --platform android --profile production
```

### Build Preview APK for Testing
```bash
eas build --platform android --profile preview
```

### Build Development Build
```bash
eas build --platform android --profile development
```

### Check Build Status
```bash
eas build:list
```

### View Build Logs
```bash
eas build:view BUILD_ID
```

## Updating Credentials

### Update Keystore Password
If you need to update the keystore password in `credentials.json`:
```json
{
  "android": {
    "keystore": {
      "keystorePath": "./goshopper-release-key.keystore",
      "keystorePassword": "YOUR_ACTUAL_PASSWORD",
      "keyAlias": "goshopper-release",
      "keyPassword": "YOUR_ACTUAL_PASSWORD"
    }
  }
}
```

**⚠️ SECURITY**: Never commit `credentials.json` with real passwords!

### Let EAS Manage Credentials
If you want EAS to manage your keystore:
```bash
# Remove local keystore
rm goshopper-release-key.keystore
rm credentials.json

# Update eas.json to use remote credentials
```
```json
"production": {
  "android": {
    "buildType": "app-bundle",
    "credentialsSource": "remote"  // Changed from "local"
  }
}
```

Then EAS will generate and store the keystore securely.

## Building iOS (Bonus)

### For iOS App Store
```bash
eas build --platform ios --profile production
```

### For iOS Testing
```bash
eas build --platform ios --profile preview
```

## Version Management

### Update Version Before Building

1. **Update version in app.json:**
```json
{
  "expo": {
    "version": "1.0.1"  // Increment this
  }
}
```

2. **Update version in package.json:**
```json
{
  "version": "1.0.1"  // Keep in sync
}
```

3. **Update Android version codes:**
```bash
# Edit android/app/build.gradle
versionCode 2  // Increment for each release
versionName "1.0.1"  // Match app.json
```

## Automated Submission

### Submit to Google Play via EAS
```bash
# Build and submit in one command
eas build --platform android --profile production --auto-submit

# Or submit an existing build
eas submit --platform android --latest
```

### Configure Submission in eas.json
Already configured:
```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./play-store-key.json",
      "track": "internal"
    }
  }
}
```

**Note**: You need a Google Play Service Account JSON key for automated submission.

## Troubleshooting

### Build Fails with "Keystore not found"
```bash
# Verify keystore exists
ls goshopper-release-key.keystore

# Verify credentials.json path is correct
cat credentials.json
```

### Build Fails with "Invalid credentials"
```bash
# Test keystore locally
keytool -list -v -keystore goshopper-release-key.keystore
```

### EAS CLI Not Found
```bash
# Reinstall globally
npm install -g eas-cli

# Verify installation
eas --version
```

### Build Takes Too Long
- Normal build time: 10-20 minutes
- Check status: `eas build:list`
- View logs: `eas build:view BUILD_ID`

## Build Checklist

Before building for production:

- [ ] Updated version in `app.json`
- [ ] Updated version in `package.json`
- [ ] Updated `versionCode` in `android/app/build.gradle`
- [ ] Tested the app thoroughly
- [ ] Verified keystore is valid
- [ ] Checked `credentials.json` has correct passwords
- [ ] Created release notes
- [ ] Updated screenshots (if needed)
- [ ] Ran `npm run validate` (if available)

## Quick Reference

| Task | Command |
|------|---------|
| Build AAB for Play Store | `eas build --platform android --profile production` |
| Build APK for testing | `eas build --platform android --profile preview` |
| List builds | `eas build:list` |
| View build details | `eas build:view BUILD_ID` |
| Submit to Play Store | `eas submit --platform android --latest` |
| Login to EAS | `eas login` |
| Check EAS status | `eas whoami` |

## Cost

- **EAS Build Free Tier**: 30 builds/month (shared iOS + Android)
- **EAS Build Paid**: Unlimited builds starting at $29/month
- Check your usage: https://expo.dev/accounts/YOUR_ACCOUNT/settings/billing

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Google Play Console](https://play.google.com/console)
- [Release Guide](./RELEASE_GUIDE.md)
- [Submission Status](./SUBMISSION_STATUS.md)

---

## Summary

**Recommended Workflow:**
1. `eas build --platform android --profile production`
2. Wait 10-20 minutes for build to complete
3. Download AAB from EAS dashboard
4. Upload to Google Play Console
5. Submit for review

**Advantages of EAS:**
- ✅ Consistent build environment
- ✅ No local setup issues
- ✅ Build logs saved online
- ✅ Can build from any machine
- ✅ Automated submission available
- ✅ Credential management
- ✅ Easy collaboration

**When to use local builds:**
- You're offline
- You need faster iteration
- You have custom native modules
- You prefer full control
