# Google Play Closed Testing Checklist - GoShopper AI v1.0.0

## ✅ Pre-Build Requirements

### 1. Version Configuration
- [x] **package.json**: version = "1.0.0"
- [x] **app.json**: version = "1.0.0"
- [x] **android/app/build.gradle**: versionCode = 1, versionName = "1.0.0"

### 2. App Identity
- [x] **Package Name**: com.goshopper.app
- [x] **App Name**: GoShopper AI
- [ ] **App Icon**: Verified in all resolutions (ic_launcher.png in all mipmap folders)

### 3. Legal Documents
- [x] **Privacy Policy**: store-assets/PRIVACY_POLICY.md
- [x] **Terms of Service**: store-assets/TERMS_OF_SERVICE.md
- [ ] **Privacy Policy URL**: Host and add URL to Play Console
- [ ] **Terms of Service URL**: Host and add URL to Play Console

---

## 🔐 Code Signing (CRITICAL)

### Create Release Keystore
Run this command once:
```powershell
keytool -genkeypair -v -storetype PKCS12 `
  -keystore android/app/release.keystore `
  -alias goshopper-release `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=GoShopper AI, OU=Mobile, O=GoShopper, L=Kinshasa, ST=Kinshasa, C=CD"
```

### Configure Signing
1. [ ] Create `android/gradle.properties` (use `android/gradle.properties.example` as template)
2. [ ] Add these properties:
```properties
GOSHOPPER_UPLOAD_STORE_FILE=release.keystore
GOSHOPPER_UPLOAD_KEY_ALIAS=goshopper-release
GOSHOPPER_UPLOAD_STORE_PASSWORD=YOUR_PASSWORD_HERE
GOSHOPPER_UPLOAD_KEY_PASSWORD=YOUR_PASSWORD_HERE
```
3. [ ] **BACKUP KEYSTORE**: Copy `release.keystore` to secure location
4. [ ] **SAVE PASSWORDS**: Store in password manager

⚠️ **WARNING**: Losing the keystore means you can NEVER update the app again!

---

## 🏗️ Build the AAB File

### Option 1: Windows PowerShell
```powershell
npm run build:android:windows
```

### Option 2: Mac/Linux
```bash
npm run build:android:mac
```

### Verify Build
- [ ] AAB file created at: `android/app/build/outputs/bundle/release/goshopper-v1.0.0-release.aab`
- [ ] File size: ~30-50 MB (typical for React Native app)

---

## 📱 Google Play Console Setup

### 1. Create App Listing
1. [ ] Go to [Play Console](https://play.google.com/console)
2. [ ] Click "Create app"
3. [ ] Fill in:
   - **App name**: GoShopper AI
   - **Default language**: English (US) or French (FR)
   - **App or game**: App
   - **Free or paid**: Free
4. [ ] Accept declarations and create

### 2. Store Listing
**Main store listing** → Complete all required fields:

#### App Details
- [ ] **App name**: GoShopper AI
- [ ] **Short description** (80 chars max):
```
Scan receipts, track prices, compare costs across stores with AI
```

- [ ] **Full description** (4000 chars max):
```
GoShopper AI helps you save money on groceries by tracking prices and comparing costs across different stores in DRC.

KEY FEATURES:
✨ AI-Powered Receipt Scanning - Scan receipts with your camera
📊 Price Tracking - Track product prices over time
🏪 Store Comparison - Compare prices across supermarkets
💰 Savings Insights - See how much you save
📝 Smart Shopping Lists - Create and manage shopping lists
🔔 Price Alerts - Get notified when prices drop
📈 Spending Analytics - Understand your shopping patterns

WHY GOSHOPPER AI?
• Save time and money on grocery shopping
• Make informed purchasing decisions
• Never overpay for products again
• Track your household spending
• Optimized for Congolese market (USD & CDF)

PERFECT FOR:
• Families managing grocery budgets
• Smart shoppers looking for best deals
• Anyone who wants to save money

Download now and start saving!
```

- [ ] **App icon**: 512x512 PNG (32-bit with alpha)
- [ ] **Feature graphic**: 1024x500 PNG

#### Screenshots (Required)
**Phone screenshots** (minimum 2, maximum 8):
- [ ] Screenshot 1: Home screen (1080x1920 or similar)
- [ ] Screenshot 2: Scanner screen
- [ ] Screenshot 3: Receipt detail
- [ ] Screenshot 4: Price comparison (optional)

**7-inch tablet screenshots** (optional but recommended):
- [ ] Tablet screenshot (1200x1920 or similar)

**10-inch tablet screenshots** (optional):
- [ ] Large tablet screenshot (1600x2560 or similar)

### 3. Content Rating
1. [ ] Go to **Content rating** section
2. [ ] Start questionnaire
3. [ ] Select category: **Utility & Productivity**
4. [ ] Answer questions (all "No" for GoShopper)
5. [ ] Submit and get rating (likely "Everyone")

### 4. Target Audience
- [ ] **Target age**: 18 and older (or 13+ with parental consent)
- [ ] **Country/Region**: Democratic Republic of Congo (primary), others optional

### 5. App Access
- [ ] All features are accessible without special access? **Yes**
- [ ] Add instructions if login required (provide test account)

### 6. Ads
- [ ] Does your app contain ads? **No** (currently no ads)

### 7. Data Safety
Complete the Data Safety form:

#### Data Collection
- [ ] **Location**: Approximate location (optional, city-level for price comparison)
- [ ] **Personal info**: Name, Email (for account)
- [ ] **Photos**: Receipt images (stored encrypted)
- [ ] **Files and docs**: Saved receipts

#### Data Usage
- [ ] **App functionality**: Yes
- [ ] **Analytics**: Yes (Firebase Analytics)
- [ ] **Fraud prevention**: Yes

#### Data Security
- [ ] Data is encrypted in transit: **Yes**
- [ ] Data is encrypted at rest: **Yes**
- [ ] Users can request data deletion: **Yes**
- [ ] Data is not shared with third parties: **Yes**

#### Privacy Policy
- [ ] **Privacy policy URL**: https://yourwebsite.com/privacy (REQUIRED - must host online)

### 8. App Content
- [ ] Government apps: **No**
- [ ] COVID-19 contact tracing: **No**
- [ ] Data safety: **Completed**

---

## 🚀 Upload and Release

### 1. Create Release
1. [ ] Go to **Production** → **Create new release**
2. [ ] Or go to **Testing** → **Closed testing** → **Create new release**

### 2. Upload AAB
1. [ ] Click "Upload"
2. [ ] Select `goshopper-v1.0.0-release.aab`
3. [ ] Wait for processing (5-10 minutes)
4. [ ] Verify upload successful

### 3. Release Notes
Add release notes (optional for closed testing):
```
Version 1.0.0 - Initial Release

Features:
• AI-powered receipt scanning
• Price tracking across stores
• Smart shopping lists
• Spending analytics
• Price alerts
• Support for USD and CDF currencies
```

### 4. Closed Testing Track
1. [ ] Create testing track: **Closed testing**
2. [ ] Create testers list:
   - Add email addresses of testers
   - Or create email list and share link
3. [ ] Set up countries: **Democratic Republic of Congo**

### 5. Review and Rollout
1. [ ] Review all information
2. [ ] Click "Start rollout to Closed testing"
3. [ ] Confirm rollout

---

## ⏱️ What Happens Next?

### Google Review Process
- **Timeline**: 1-3 days typically
- **Status**: Check in Play Console → Release → Dashboard
- **Possible outcomes**:
  - ✅ **Approved**: Testers can download immediately
  - ❌ **Rejected**: Fix issues and resubmit

### Common Rejection Reasons
1. **Missing Privacy Policy URL** - Must be hosted online
2. **Incomplete store listing** - All required fields must be filled
3. **Missing screenshots** - At least 2 phone screenshots required
4. **Dangerous permissions** - Must justify all permissions used
5. **Crashes on launch** - Test thoroughly before submitting

---

## 📧 Invite Testers

After approval:
1. [ ] Share testing link with testers (found in Closed testing track)
2. [ ] Or send email invitations from Play Console
3. [ ] Testers must:
   - Accept invitation
   - Download from Play Store
   - Provide feedback

---

## 🔍 Pre-Submission Testing

### Test Before Uploading
- [ ] Clean install on real device
- [ ] Test all major features:
  - [ ] Receipt scanning
  - [ ] User registration/login
  - [ ] Price tracking
  - [ ] Shopping lists
  - [ ] Notifications
- [ ] Test on different devices/Android versions
- [ ] Check for crashes or ANRs

### Build Validation
```powershell
# Verify AAB is valid
cd android
.\gradlew bundleRelease --info

# Check AAB contents
jar tf app/build/outputs/bundle/release/goshopper-v1.0.0-release.aab
```

---

## 📚 Additional Resources

### Documentation
- [ ] **Play Console Help**: https://support.google.com/googleplay/android-developer
- [ ] **Launch Checklist**: https://developer.android.com/distribute/best-practices/launch/launch-checklist
- [ ] **Pre-launch Reports**: Enable in Play Console for automated testing

### After Closed Testing
Once testing is complete:
1. Collect feedback from testers
2. Fix any critical bugs
3. Create new release for Production
4. Update version to 1.0.1 or higher
5. Repeat upload process for Production track

---

## 🎯 Quick Command Reference

```powershell
# Build release AAB
npm run build:android:windows

# Clean build
cd android
.\gradlew clean
cd ..
npm run build:android:windows

# Check app version
cd android
.\gradlew :app:dependencies --configuration releaseRuntimeClasspath
```

---

## ✅ Final Checklist Before Upload

- [ ] AAB file builds successfully
- [ ] Keystore backed up securely
- [ ] Privacy policy hosted online
- [ ] All store listing fields completed
- [ ] Screenshots prepared
- [ ] Content rating completed
- [ ] Data safety form completed
- [ ] Testers list ready
- [ ] App tested on real device
- [ ] No crashes or major bugs

---

## 🆘 Troubleshooting

### Build Fails
- Clean build: `cd android && .\gradlew clean && cd ..`
- Check Java version: `java -version` (should be 11 or 17)
- Check Gradle version: `cd android && .\gradlew -v`

### Upload Fails
- AAB must be signed with release key
- Package name must match Play Console
- Version code must be higher than previous (use 1 for first release)

### App Crashes on Install
- Test AAB on physical device before uploading
- Check ProGuard rules if minification enabled
- Review crash logs in Play Console

---

**Current Status**: Ready for closed testing ✅
**Next Step**: Create keystore and build AAB file
