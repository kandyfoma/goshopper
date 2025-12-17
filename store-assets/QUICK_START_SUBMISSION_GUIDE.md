# Quick Start Guide: App Store Submission

## 🚀 Fast Track to Submission (4 Weeks)

This guide provides the fastest path to get GoShopper AI into app stores.

---

## Week 1: Setup Developer Accounts & Signing

### Day 1-2: Apple Developer Account
1. **Enroll**: https://developer.apple.com/programs/enroll/
   - Cost: $99 USD/year
   - Entity type: Individual or Company
   - Approval: 24-48 hours

2. **Access App Store Connect**: https://appstoreconnect.apple.com/
   - Wait for enrollment approval
   - Login with Apple ID

3. **Create App**:
   - Apps → Add (+) → New App
   - Platform: iOS
   - Name: GoShopper AI
   - Bundle ID: `com.goshopper.app` (create new)
   - SKU: `GOSHOPPER-001`
   - User Access: Full Access

### Day 3-4: Google Play Console
1. **Register**: https://play.google.com/console/signup
   - Cost: $25 USD (one-time)
   - Instant approval
   - Accept Developer Agreement

2. **Create App**:
   - All apps → Create app
   - Name: GoShopper AI
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free
   - Accept declarations

### Day 5-7: Code Signing Setup

#### iOS Certificates (macOS only)
```bash
# 1. Install Xcode Command Line Tools
xcode-select --install

# 2. Open Xcode
# 3. Preferences → Accounts → Add Apple ID
# 4. Manage Certificates → + → Apple Distribution
# 5. Download provisioning profile from developer.apple.com
```

#### Android Keystore (Any OS)
```powershell
# On Windows - Run PowerShell as Administrator
keytool -genkeypair -v -storetype PKCS12 `
  -keystore android/app/release.keystore `
  -alias goshopper-release `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=GoShopper AI, OU=Mobile, O=GoShopper, L=City, ST=State, C=US" `
  -storepass YOUR_KEYSTORE_PASSWORD `
  -keypass YOUR_KEY_PASSWORD

# Or let the build script prompt you:
.\scripts\build-android-release.ps1
```

**CRITICAL**: Backup keystore immediately!
- Copy `android/app/release.keystore` to secure location
- Save passwords in password manager
- Store backup offline (USB drive, encrypted cloud)

#### Configure Android Signing
Create `android/gradle.properties`:
```properties
GOSHOPPER_UPLOAD_STORE_FILE=release.keystore
GOSHOPPER_UPLOAD_KEY_ALIAS=goshopper-release
GOSHOPPER_UPLOAD_STORE_PASSWORD=your_keystore_password_here
GOSHOPPER_UPLOAD_KEY_PASSWORD=your_key_password_here

# Performance optimizations
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true
```

**Security Note**: Add to `.gitignore`:
```
# Keystore files
*.keystore
*.jks

# Signing configs
gradle.properties
```

---

## Week 2: Create Visual Assets

### App Icons

#### Option 1: Use Icon Generator Service
1. Go to https://appicon.co/
2. Upload your logo (1024x1024px recommended)
3. Select platforms: iOS, Android
4. Download generated icons
5. Replace files:
   - iOS: `ios/goshopper/Images.xcassets/AppIcon.appiconset/`
   - Android: `android/app/src/main/res/mipmap-*/`

#### Option 2: Use Existing Script
```powershell
# If you have logo source files
cd scripts
node generate-app-icons.js
```

### Screenshots

#### Capture Strategy
1. **Run app on simulators**:
   ```powershell
   # iOS (macOS)
   npm run ios -- --simulator="iPhone 15 Pro Max"
   
   # Android
   npm run android
   ```

2. **Navigate to key screens**:
   - Welcome/Onboarding
   - Receipt scanning (show camera or sample receipt)
   - Shopping analytics dashboard
   - Product insights/trends chart
   - Smart shopping list
   - Savings tracker
   - Profile/settings

3. **Capture screenshots**:
   - iOS: Cmd+S in Simulator
   - Android: Volume Down + Power (or use Android Studio screenshot tool)

#### Required Sizes

**iOS** (minimum 6.7" required):
- iPhone 6.7": 1290x2796 (iPhone 15 Pro Max)
- iPhone 6.5": 1242x2688 (iPhone 11 Pro Max, backup)
- iPad Pro 12.9": 2048x2732 (if iPad support)

**Android** (minimum 2 required):
- Phone: 1080x1920 (or 1080x2340 for modern aspect ratios)
- 7" Tablet: 1200x1920 (optional)

#### Screenshot Tips
- Use device frames for professional look (https://screenshots.pro/)
- Add short descriptive text overlay
- Show real features, no mockups
- Keep text readable
- Show UI in default language (English)
- Avoid showing user data or empty states

### App Preview Video (Optional)
- Length: 15-30 seconds
- Format: Portrait orientation
- Show: Core functionality (scan → analyze → save)
- Tools: Screen recording + iMovie/DaVinci Resolve
- No audio required (but recommended)

---

## Week 3: Deploy Legal Documents & Test

### Host Privacy Policy & Terms

#### Option 1: Firebase Hosting (Recommended)
```powershell
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize hosting
cd web
firebase init hosting

# Deploy
firebase deploy --only hosting

# Get URL: https://your-project.firebase.com/privacy
```

#### Option 2: GitHub Pages (Free)
```powershell
# Create new repo: goshopper-legal
# Add privacy-policy.html and terms-of-service.html
# Enable GitHub Pages in repo settings
# URL: https://username.github.io/goshopper-legal/privacy-policy.html
```

#### Option 3: Vercel (Fast)
```powershell
# Install Vercel CLI
npm install -g vercel

# Create simple HTML files in /legal folder
cd legal
vercel deploy --prod

# Get URL: https://goshopper-legal.vercel.app/privacy
```

**Required URLs**:
- Privacy Policy: `https://yourdomain.com/privacy`
- Terms of Service: `https://yourdomain.com/terms`

### Build Release Versions

#### iOS Build (macOS only)
```bash
# Clean install
cd ios
pod install
cd ..

# Build release
npm run build:ios

# This creates .xcarchive file
# Location: ~/Library/Developer/Xcode/Archives/
```

#### Android Build (Windows)
```powershell
# Build AAB
npm run build:android:windows

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### Test Release Builds

#### iOS Testing
```bash
# Install on device via Xcode
# 1. Connect iPhone/iPad
# 2. Open .xcarchive in Xcode Organizer
# 3. Distribute App → Development
# 4. Select device and install
```

#### Android Testing
```powershell
# Install AAB on device
# 1. Upload AAB to Play Console Internal Testing track
# 2. Opt-in as tester
# 3. Download from Play Store
# OR use bundletool locally:
bundletool build-apks --bundle=app-release.aab --output=app.apks
bundletool install-apks --apks=app.apks
```

### Critical Testing Checklist
- [ ] Sign in with Google works
- [ ] Sign in with Apple works (iOS)
- [ ] Camera permission granted
- [ ] Receipt scanning successful
- [ ] OCR extracts items
- [ ] Product normalization works
- [ ] Analytics display correctly
- [ ] Shopping list saves/loads
- [ ] Offline mode functions
- [ ] No crashes on launch
- [ ] No console errors
- [ ] Permissions dialogs appear
- [ ] Deep links work
- [ ] Push notifications work (if enabled)

---

## Week 4: Complete Listings & Submit

### Complete App Store Connect Listing

1. **Login**: https://appstoreconnect.apple.com/
2. **Select App**: GoShopper AI
3. **App Information**:
   - Subtitle: "Smart Shopping Made Simple" (30 chars max)
   - Category: Primary = Shopping, Secondary = Productivity
   - Content Rights: Check if using third-party content
   
4. **Pricing and Availability**:
   - Price: Free
   - Availability: All countries
   
5. **iOS App (Version 1.0)**:
   - Screenshots: Upload all sizes
   - Promotional Text: "Save money with AI-powered shopping analytics" (170 chars)
   - Description: Copy from `store-assets/STORE_DESCRIPTIONS.md` (English)
   - Keywords: Copy from store descriptions (100 chars max)
   - Support URL: Your website
   - Marketing URL: (optional)
   - Version: 1.0.0
   - Copyright: 2024 GoShopper AI
   - Rating: Select appropriate ratings
   
6. **App Privacy**:
   - Data Types Collected:
     - Contact Info: Email (for authentication)
     - User Content: Photos (receipts)
     - Usage Data: Product Interactions
   - Data Use: App Functionality, Analytics
   - Linked to User: Yes
   - Tracking: No (unless using third-party analytics)
   
7. **Privacy Policy URL**: `https://yourdomain.com/privacy`
8. **Terms of Service URL**: `https://yourdomain.com/terms`

### Complete Play Console Listing

1. **Login**: https://play.google.com/console/
2. **Select App**: GoShopper AI
3. **Store Settings** → **Main store listing**:
   - App name: GoShopper AI
   - Short description: Copy from `store-assets/STORE_DESCRIPTIONS.md` (80 chars)
   - Full description: Copy full English description (4000 chars max)
   - App icon: 512x512px
   - Feature graphic: 1024x500px (create banner image)
   - Phone screenshots: Upload 2-8 images
   - 7" tablet screenshots: (optional)
   - Category: Shopping
   - Email: support@goshopperai.com
   - Website: (optional)
   - Privacy policy URL: `https://yourdomain.com/privacy`
   
4. **Store Settings** → **App content**:
   - Privacy policy: Add URL
   - App access: All features available (or specify restrictions)
   - Ads: Select "No, my app does not contain ads"
   - Content rating: Complete questionnaire → Likely "Everyone"
   - Target audience: 13+ recommended
   - News app: No
   - COVID-19 contact tracing: No
   - Data safety:
     - Collect data: Yes
     - Share data: No
     - Data types: Photos, Email, Usage data
     - Security practices: Data encrypted in transit, Users can delete data
   
5. **Release** → **Production**:
   - Countries: Select all or specific countries
   - Create new release
   - Upload AAB file
   - Release name: Version 1.0.0 (Build 1)
   - Release notes: Copy from `store-assets/STORE_DESCRIPTIONS.md` (What's New)
   
### Upload Builds

#### iOS Upload
```bash
# Option 1: Xcode Organizer (Recommended)
# 1. Open Xcode → Window → Organizer
# 2. Select your archive
# 3. Distribute App → App Store Connect
# 4. Upload
# 5. Wait for processing (10-60 minutes)

# Option 2: Transporter App
# 1. Download from Mac App Store
# 2. Drag .ipa file into Transporter
# 3. Deliver

# Option 3: Command Line
xcrun altool --upload-app -f path/to/app.ipa \
  -u your@apple.id \
  -p @keychain:ALTOOL_PASSWORD
```

#### Android Upload
1. Go to Play Console
2. Production → Create new release
3. Upload AAB file
4. Add release notes
5. Save

### Submit for Review

#### iOS Submission
1. **App Store Connect** → Your app → Version 1.0
2. **Build**: Select uploaded build (wait for processing)
3. **Version Information**: Verify all fields
4. **App Review Information**:
   - Sign-in required: Yes
   - Demo account:
     - Username: `reviewer@goshopperai.com`
     - Password: Create secure test account
   - Notes: "Please scan a sample receipt to test core functionality"
   - Attachment: (optional) Sample receipt image
5. **Pricing and Availability**: Verify
6. Click **Submit for Review**

**Review Timeline**: 1-3 days typically

#### Android Submission
1. **Play Console** → Production release
2. **Review**: Check all sections are complete
3. Click **Send for review** or **Start rollout to Production**
4. **Rollout percentage**: Start with 20% (phased rollout) or 100% (full)

**Review Timeline**: Few hours to 2 days

---

## 📊 Submission Checklist Summary

### Pre-Submission
- [ ] Apple Developer account active ($99)
- [ ] Google Play Developer account active ($25)
- [ ] iOS certificates generated and installed
- [ ] Android keystore generated and backed up
- [ ] Release signing configured in build files

### Assets
- [ ] App icon (1024x1024 iOS, 512x512 Android)
- [ ] Screenshots (6-8 per platform, all sizes)
- [ ] App preview video (optional)
- [ ] Feature graphic (Android: 1024x500)

### Legal
- [ ] Privacy Policy hosted online
- [ ] Terms of Service hosted online
- [ ] Privacy Policy URL added to listings
- [ ] Data collection practices declared

### Builds
- [ ] iOS release build created (.xcarchive)
- [ ] Android release AAB created
- [ ] Release builds tested on devices
- [ ] No crashes or critical bugs
- [ ] All features working

### Listings
- [ ] App Store Connect listing complete
- [ ] Play Console listing complete
- [ ] Demo account created (iOS)
- [ ] Support email set up
- [ ] Release notes written

### Final
- [ ] All sections in App Store Connect green
- [ ] All sections in Play Console complete
- [ ] Screenshots show latest app version
- [ ] Version numbers match (1.0.0)
- [ ] Submitted for review

---

## 🆘 Common Issues & Solutions

### iOS Issues

**Problem**: "No signing certificate found"
```bash
# Solution: Create distribution certificate
# Xcode → Preferences → Accounts → Manage Certificates → +
```

**Problem**: "No provisioning profile found"
```bash
# Solution: Create App Store profile
# developer.apple.com → Certificates, Identifiers & Profiles → Profiles → +
```

**Problem**: Build fails with "Module not found"
```bash
# Solution: Clean and reinstall
cd ios
pod deintegrate
pod install
cd ..
npm run clean
```

**Problem**: "Archive not showing in Organizer"
```bash
# Solution: Ensure Generic iOS Device selected (not simulator)
# Product → Destination → Any iOS Device (arm64)
```

### Android Issues

**Problem**: "Could not find android SDK"
```powershell
# Solution: Set ANDROID_HOME
$env:ANDROID_HOME = "C:\Users\YourName\AppData\Local\Android\Sdk"
# Add to system environment variables permanently
```

**Problem**: "Keystore not found"
```powershell
# Solution: Run build script, it will create one
.\scripts\build-android-release.ps1
```

**Problem**: "Unsigned AAB"
```powershell
# Solution: Check gradle.properties has signing config
# See Week 1, Day 5-7 instructions
```

**Problem**: Build fails with "Out of memory"
```properties
# Solution: Increase heap in gradle.properties
org.gradle.jvmargs=-Xmx4096m
```

### Submission Issues

**Problem**: iOS "Missing Compliance"
```
# Solution: In App Store Connect
# App → Activity → Build → Export Compliance: No
```

**Problem**: Android "Needs to complete Data safety section"
```
# Solution: Play Console → App content → Data safety
# Complete all questions about data collection
```

**Problem**: "Screenshot doesn't match device"
```
# Solution: Ensure exact pixel dimensions
# iPhone 6.7": 1290x2796 (not 1284x2778)
```

---

## 🎯 Post-Submission

### Once Approved

1. **Monitor Vitals**:
   - App Store Connect: Analytics → Crashes
   - Play Console: Vitals → Crashes & ANRs
   
2. **Respond to Reviews**:
   - App Store: App Store Connect → Ratings and Reviews
   - Play Store: Play Console → User feedback → Reviews
   
3. **Track Downloads**:
   - App Store Connect: Analytics → App Units
   - Play Console: Statistics → Installation metrics
   
4. **Plan Updates**:
   - Bug fixes: Submit within 1 week if critical
   - New features: Plan monthly updates
   - Version bump: 1.0.1, 1.0.2, etc.

### Marketing Launch

1. **Social Media**:
   - Twitter/X: "GoShopper AI is now live!"
   - LinkedIn: Professional announcement
   - Instagram: Visual showcase
   
2. **Website Update**:
   - Add App Store badges
   - Add Play Store badges
   - Create landing page
   
3. **Press Release**:
   - Local tech blogs
   - Shopping/finance publications
   - Submit to Product Hunt

---

## 📞 Support Resources

### Official Documentation
- [iOS App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)
- [React Native Publishing](https://reactnative.dev/docs/publishing-to-app-store)

### Developer Support
- Apple: https://developer.apple.com/contact/
- Google: https://support.google.com/googleplay/android-developer

### Community
- Stack Overflow: [react-native] tag
- Reddit: r/reactnative, r/androiddev, r/iOSProgramming
- Discord: Reactiflux

---

**Good luck with your launch! 🚀**

Remember: First submission is always the hardest. After this, updates are much easier!
