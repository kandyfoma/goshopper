# GoShopper AI v1.0.0 - Release Guide

## 🚀 Quick Start for Google Play Closed Testing

This guide will help you prepare and submit GoShopper AI v1.0.0 to Google Play for closed testing.

---

## ✅ Step 1: Validate Your Setup

Run the validation script to check if everything is ready:

```powershell
npm run validate
```

This will check:
- ✅ Version numbers (1.0.0)
- ✅ Package name (com.goshopper.app)
- ✅ App icons
- ✅ Legal documents
- ✅ Build configuration
- ❌ Code signing setup (you need to configure this)

---

## 🔐 Step 2: Set Up Code Signing (First Time Only)

### 2.1 Generate Release Keystore

```powershell
cd android/app
keytool -genkeypair -v -storetype PKCS12 `
  -keystore release.keystore `
  -alias goshopper-release `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=GoShopper AI, OU=Mobile, O=GoShopper, L=Kinshasa, ST=Kinshasa, C=CD"
```

You'll be prompted for:
- **Keystore password**: Choose a strong password
- **Key password**: Can be same as keystore password

⚠️ **CRITICAL**: 
- Save these passwords in a secure password manager
- Backup `release.keystore` to multiple secure locations
- **Losing the keystore means you can NEVER update the app again!**

### 2.2 Configure Gradle Properties

1. Copy the example file:
```powershell
Copy-Item android/gradle.properties.example android/gradle.properties
```

2. Edit `android/gradle.properties` and fill in your passwords:
```properties
GOSHOPPER_UPLOAD_STORE_FILE=release.keystore
GOSHOPPER_UPLOAD_KEY_ALIAS=goshopper-release
GOSHOPPER_UPLOAD_STORE_PASSWORD=your_actual_keystore_password
GOSHOPPER_UPLOAD_KEY_PASSWORD=your_actual_key_password
```

3. Verify the file is in `.gitignore` (it should be - passwords will NOT be committed)

---

## 🏗️ Step 3: Build the Release AAB

```powershell
npm run build:android:windows
```

This will:
1. Clean previous builds
2. Bundle JavaScript
3. Compile Android app
4. Generate signed AAB file

**Output**: `android/app/build/outputs/bundle/release/goshopper-v1.0.0-release.aab`

**Typical size**: 30-50 MB

### Troubleshooting Build Issues

**If build fails:**
```powershell
# Clean everything and try again
npm run clean
cd android
.\gradlew clean
cd ..
npm run build:android:windows
```

**If Gradle errors:**
- Check Java version: `java -version` (needs Java 11 or 17)
- Check Gradle version: `cd android && .\gradlew -v`

---

## 📱 Step 4: Set Up Google Play Console

### 4.1 Create Developer Account
1. Go to [Google Play Console](https://play.google.com/console)
2. Pay one-time $25 fee
3. Accept Developer Agreement

### 4.2 Create App
1. Click **"Create app"**
2. Fill in:
   - **App name**: GoShopper AI
   - **Default language**: English (US) or French
   - **App or game**: App
   - **Free or paid**: Free
3. Accept declarations

### 4.3 Complete Store Listing

**See detailed instructions in**: `GOOGLE_PLAY_CLOSED_TESTING_CHECKLIST.md`

Quick requirements:
- App icon (512x512 PNG)
- Feature graphic (1024x500 PNG)
- At least 2 phone screenshots
- Short description (80 chars)
- Full description (up to 4000 chars)
- Privacy policy URL (must be hosted online)

---

## 📤 Step 5: Upload AAB

1. Go to **Testing → Closed testing**
2. Click **"Create new release"**
3. Upload `goshopper-v1.0.0-release.aab`
4. Wait for processing (5-10 minutes)
5. Add release notes (optional)
6. Click **"Review release"**
7. Click **"Start rollout to Closed testing"**

---

## ⏱️ Step 6: Wait for Review

**Timeline**: 1-3 days typically

**Check status**: Play Console → Release → Dashboard

**Possible outcomes**:
- ✅ **Approved**: Testers can download immediately
- ❌ **Rejected**: Fix issues and resubmit

---

## 📧 Step 7: Invite Testers

After approval:
1. Go to **Testing → Closed testing → Testers**
2. Create testers list
3. Add email addresses or share testing link
4. Testers will receive invitation

---

## 📋 Complete Checklists

For detailed step-by-step instructions, see:

- **`GOOGLE_PLAY_CLOSED_TESTING_CHECKLIST.md`** - Complete Google Play setup guide
- **`store-assets/QUICK_START_SUBMISSION_GUIDE.md`** - 4-week submission timeline
- **`store-assets/APP_READINESS_CHECKLIST.md`** - Full app readiness checklist

---

## 🆘 Common Issues

### "Keystore not found"
- Make sure `release.keystore` exists in `android/app/`
- Check `gradle.properties` has correct path

### "Wrong password"
- Verify passwords in `gradle.properties`
- Try regenerating keystore if you forgot password

### "Build failed"
- Run `npm run clean` and rebuild
- Check Java version is 11 or 17
- Update Android SDK if needed

### "Upload failed - duplicate version"
- Increase version code in `android/app/build.gradle`
- Version code must always increase for each upload

---

## 🎯 Quick Command Reference

```powershell
# Validate setup
npm run validate

# Build release
npm run build:android:windows

# Clean build
npm run clean

# Check app version
cd android
.\gradlew :app:dependencies --configuration releaseRuntimeClasspath

# View AAB contents
cd android/app/build/outputs/bundle/release
jar tf goshopper-v1.0.0-release.aab
```

---

## ✅ Pre-Submission Checklist

Before uploading to Play Console:

- [ ] Validation script passes (`npm run validate`)
- [ ] AAB builds successfully
- [ ] Tested on real Android device
- [ ] No crashes or critical bugs
- [ ] Keystore backed up securely
- [ ] Passwords saved in password manager
- [ ] Privacy policy hosted online
- [ ] All Play Console fields completed

---

## 📚 Additional Resources

- [Google Play Developer Guide](https://developer.android.com/distribute)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [React Native Release Guide](https://reactnative.dev/docs/signed-apk-android)

---

**Current Version**: 1.0.0  
**Status**: Ready for closed testing ✅  
**Next Step**: Run `npm run validate` to check your setup
