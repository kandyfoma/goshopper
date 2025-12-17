# GoShopper AI - App Store Readiness Checklist

## 🎯 Current Status Overview

### ✅ Completed Items
- [x] Core app functionality implemented
- [x] Firebase integration (Auth, Firestore, Storage, Functions)
- [x] Product normalization system with AI/ML
- [x] Privacy Policy and Terms of Service created
- [x] Store descriptions (English & French)
- [x] Build scripts created (PowerShell & Bash)
- [x] App architecture documented

### ⚠️ Critical Missing Items
The following items are **required** before submission:

## 📱 1. App Configuration

### iOS (Info.plist)
- [ ] **Bundle Identifier**: Verify `com.goshopper.app` is correct
- [ ] **Version Number**: Confirm `1.0.0` (CFBundleShortVersionString)
- [ ] **Build Number**: Confirm `1` (CFBundleVersion)
- [ ] **App Name**: Verify "GoShopper AI" display name
- [ ] **Privacy Descriptions**: Add all required usage descriptions:
  - [ ] Camera Usage (`NSCameraUsageDescription`)
  - [ ] Photo Library (`NSPhotoLibraryUsageDescription`)
  - [ ] Face ID (`NSFaceIDUsageDescription`)
  - [ ] Location (if used)

### Android (build.gradle)
- [x] **Application ID**: `com.goshopper.app` ✓
- [x] **Version Code**: `1` ✓
- [x] **Version Name**: `1.0.0` ✓
- [ ] **Signing Config**: Configure release signing
  ```gradle
  signingConfigs {
      release {
          if (project.hasProperty('GOSHOPPER_UPLOAD_STORE_FILE')) {
              storeFile file(GOSHOPPER_UPLOAD_STORE_FILE)
              storePassword GOSHOPPER_UPLOAD_STORE_PASSWORD
              keyAlias GOSHOPPER_UPLOAD_KEY_ALIAS
              keyPassword GOSHOPPER_UPLOAD_KEY_PASSWORD
          }
      }
  }
  buildTypes {
      release {
          signingConfig signingConfigs.release  // Change from debug
          // ... rest of config
      }
  }
  ```

### package.json Scripts
- [ ] Add build scripts to package.json:
  ```json
  "scripts": {
    "build:ios": "bash scripts/build-ios-release.sh",
    "build:android:mac": "bash scripts/build-android-release.sh",
    "build:android:windows": "powershell -ExecutionPolicy Bypass -File scripts/build-android-release.ps1",
    "prebuild": "npm run clean",
    "postbuild:android": "echo 'AAB file ready for upload!'"
  }
  ```

## 🖼️ 2. Visual Assets

### App Icons
**Status**: ⚠️ **CRITICAL - NOT CREATED**

#### iOS Requirements
- [ ] **App Store Icon**: 1024x1024px (PNG, no transparency)
  - Location: `ios/goshopper/Images.xcassets/AppIcon.appiconset/`
  - All required sizes via Xcode asset catalog
  
#### Android Requirements
- [ ] **Play Store Icon**: 512x512px (PNG, 32-bit with alpha)
- [ ] **Adaptive Icon**: 
  - Foreground: 108x108dp (432x432px @ xxxhdpi)
  - Background: 108x108dp (432x432px @ xxxhdpi)
  - Location: `android/app/src/main/res/mipmap-*/`

**Action Required**: 
```powershell
# Generate icons using existing logo
cd scripts
node generate-app-icons.js
```

### Screenshots
**Status**: ⚠️ **CRITICAL - NOT CREATED**

#### iOS Screenshots Needed
- [ ] iPhone 6.7" (1290x2796) - iPhone 15 Pro Max
- [ ] iPhone 6.5" (1242x2688) - iPhone 11 Pro Max
- [ ] iPhone 5.5" (1242x2208) - iPhone 8 Plus
- [ ] iPad Pro 12.9" (2048x2732)

#### Android Screenshots Needed
- [ ] Phone: 1080x1920 minimum (16:9 ratio)
- [ ] 7" Tablet: 1200x1920
- [ ] 10" Tablet: 1600x2560

**Content to Showcase** (6-8 screens):
1. Welcome/Onboarding screen
2. Receipt scanning in action
3. Shopping analytics dashboard
4. Product insights/trends
5. Smart shopping list
6. Savings tracker
7. Multi-shop comparison (if available)
8. Settings/profile

**Action Required**:
1. Run app on simulators/emulators
2. Capture screenshots of key features
3. Add promotional text overlay (optional but recommended)
4. Save in `store-assets/screenshots/` folder

### App Preview Videos (Optional but Recommended)
- [ ] iOS: 15-30 seconds, portrait orientation
- [ ] Android: 15-30 seconds

## 🔐 3. Developer Accounts & Certificates

### Apple Developer Program
**Status**: ⚠️ **REQUIRED - NOT SET UP**

- [ ] **Enroll**: https://developer.apple.com/programs/enroll/
  - Cost: $99 USD/year
  - Process: 24-48 hours for approval
  
- [ ] **App Store Connect Setup**:
  - [ ] Create App ID: `com.goshopper.app`
  - [ ] Create Distribution Certificate
  - [ ] Create Provisioning Profile
  - [ ] Configure App Store listing

### Google Play Console
**Status**: ⚠️ **REQUIRED - NOT SET UP**

- [ ] **Register**: https://play.google.com/console/signup
  - Cost: $25 USD (one-time)
  - Instant approval
  
- [ ] **Play Console Setup**:
  - [ ] Create app
  - [ ] Generate upload key (use build script)
  - [ ] Opt-in to Play App Signing
  - [ ] Complete store listing

## 🔑 4. Code Signing

### iOS Code Signing
- [ ] Install Xcode Command Line Tools
- [ ] Generate Distribution Certificate in App Store Connect
- [ ] Download Provisioning Profile
- [ ] Configure in Xcode:
  - Project → Signing & Capabilities
  - Select team
  - Choose provisioning profile

### Android Signing
- [ ] Generate Release Keystore:
  ```powershell
  # Automated via build script, or manually:
  keytool -genkeypair -v -storetype PKCS12 `
    -keystore android/app/release.keystore `
    -alias goshopper-release `
    -keyalg RSA -keysize 2048 -validity 10000
  ```
  
- [ ] Create `android/gradle.properties`:
  ```properties
  GOSHOPPER_UPLOAD_STORE_FILE=release.keystore
  GOSHOPPER_UPLOAD_KEY_ALIAS=goshopper-release
  GOSHOPPER_UPLOAD_STORE_PASSWORD=<your-password>
  GOSHOPPER_UPLOAD_KEY_PASSWORD=<your-password>
  ```
  
- [ ] **CRITICAL**: Backup keystore and passwords securely!
  - Store in password manager
  - Keep offline backup
  - Share with team via secure channel

## 📝 5. Legal & Compliance

### Privacy & Legal Documents
- [x] Privacy Policy created ✓
- [x] Terms of Service created ✓
- [ ] **Host Documents Online**:
  - [ ] Deploy to web (Firebase Hosting, Vercel, etc.)
  - [ ] Get public URLs:
    - Privacy Policy: `https://goshopper.app/privacy`
    - Terms of Service: `https://goshopper.app/terms`
  - [ ] Add URLs to app config and store listings

### App Store Requirements
- [ ] **iOS**: Add Privacy Policy URL in App Store Connect
- [ ] **Android**: Add Privacy Policy URL in Play Console
- [ ] Declare data collection practices (both stores require this)

### Age Rating
- [ ] Complete questionnaire in both stores
- Expected rating: 4+ (iOS) / Everyone (Android)

## 🧪 6. Testing

### Pre-Submission Testing
- [ ] Test on physical iOS device
- [ ] Test on physical Android device
- [ ] Test all critical flows:
  - [ ] Sign up / Sign in (Google & Apple)
  - [ ] Receipt scanning and OCR
  - [ ] Product normalization
  - [ ] Shopping list
  - [ ] Analytics/insights
  - [ ] Settings and profile
- [ ] Test offline functionality
- [ ] Test error states
- [ ] Verify all permissions work

### Beta Testing (Recommended)
- [ ] **iOS**: TestFlight beta (25 internal, 10,000 external testers)
- [ ] **Android**: Internal testing → Closed testing → Open testing
- [ ] Gather feedback for 1-2 weeks
- [ ] Fix critical bugs

## 🚀 7. Build & Upload

### iOS Build Process
```powershell
# Ensure you're on macOS with Xcode installed
cd ios
pod install
cd ..

# Run build script
bash scripts/build-ios-release.sh

# Upload to App Store Connect
# Option 1: Xcode Organizer (Window → Organizer)
# Option 2: Transporter app
# Option 3: Command line with altool
```

### Android Build Process
```powershell
# On Windows
.\scripts\build-android-release.ps1

# On macOS/Linux
bash scripts/build-android-release.sh

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### Upload to Stores
- [ ] **iOS**: Upload via Xcode or Transporter
- [ ] **Android**: Upload AAB to Play Console

## 📋 8. Store Listing Content

### Already Prepared
- [x] App name: "GoShopper AI"
- [x] Short description (80 chars)
- [x] Full description (English & French)
- [x] Keywords/tags
- [x] What's New notes
- [x] Privacy Policy
- [x] Terms of Service

### Still Needed
- [ ] Screenshots (see section 2)
- [ ] App preview video (optional)
- [ ] Support email address
- [ ] Marketing URL (optional)
- [ ] App category selection:
  - iOS: Shopping / Productivity
  - Android: Shopping / Tools

## 🎬 9. Final Steps Before Submission

### Pre-Flight Checklist
- [ ] All crashes fixed
- [ ] No console errors in production build
- [ ] All features working on release build
- [ ] Privacy Policy live and accessible
- [ ] Terms of Service live and accessible
- [ ] Screenshots represent current app state
- [ ] Version numbers match across all platforms
- [ ] Backup keystore and credentials securely

### Submission
- [ ] **iOS**: Submit for review in App Store Connect
  - Review time: 1-3 days typically
- [ ] **Android**: Submit to production in Play Console
  - Review time: Hours to 1-2 days

### Post-Submission
- [ ] Monitor review status
- [ ] Respond to review feedback (if any)
- [ ] Plan rollout strategy (phased vs full release)
- [ ] Prepare user support channels
- [ ] Set up analytics and crash reporting monitoring

## 🎯 Priority Order

### Week 1: Foundation
1. ✅ Set up Apple Developer Account ($99)
2. ✅ Set up Google Play Console ($25)
3. ✅ Generate signing certificates/keystores
4. ✅ Configure signing in build files

### Week 2: Assets
5. Generate app icons (all sizes)
6. Create screenshots (all required sizes)
7. Record app preview video (optional)
8. Deploy privacy policy & terms to web

### Week 3: Testing
9. Build release versions
10. Test on physical devices
11. Beta test with small group
12. Fix critical issues

### Week 4: Launch
13. Complete store listings
14. Upload builds
15. Submit for review
16. Launch! 🎉

## 📞 Resources

### Documentation
- [iOS App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)
- [React Native Publishing Guide](https://reactnative.dev/docs/publishing-to-app-store)

### Support
- Apple Developer Support: https://developer.apple.com/support/
- Google Play Support: https://support.google.com/googleplay/android-developer

### Tools
- [App Icon Generator](https://appicon.co/)
- [Screenshot Frames](https://screenshots.pro/)
- [ASO Tools](https://www.apptweak.com/) - App Store Optimization

---

## 🚦 Current Blockers

### CRITICAL (Must Complete Before Submission)
1. **Developer Accounts**: Need Apple ($99) & Google ($25) accounts
2. **Code Signing**: Generate keystores and certificates
3. **App Icons**: Create all required sizes
4. **Screenshots**: Capture on all required device sizes
5. **Privacy Policy Hosting**: Deploy to public URL

### HIGH PRIORITY (Needed Soon)
6. Physical device testing
7. Beta testing period
8. Support infrastructure setup

### MEDIUM PRIORITY (Nice to Have)
9. App preview videos
10. Marketing website
11. ASO optimization

---

**Next Immediate Action**: Set up developer accounts and generate signing certificates. This can be done in parallel with asset creation.
