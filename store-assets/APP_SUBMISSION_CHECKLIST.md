# GoShopper AI - App Store Submission Checklist

## 📱 App Information

**App Name:** GoShopper AI  
**Bundle ID (iOS):** com.goshopperai.app  
**Package Name (Android):** com.goshopperai.app  
**Version:** 1.0.0  
**Build Number:** 1  

## ✅ Pre-Submission Checklist

### General Requirements
- [x] App name is unique and descriptive
- [x] App icon is high quality (1024x1024px)
- [ ] Screenshots prepared for all required device sizes
- [ ] App description written in French and English
- [ ] Privacy policy URL ready
- [ ] Terms of service URL ready
- [ ] Support URL/email configured
- [ ] App category selected: Shopping / Utilities

### iOS App Store Requirements

#### App Store Connect Setup
- [ ] Apple Developer account active ($99/year)
- [ ] App created in App Store Connect
- [ ] Bundle ID registered
- [ ] App icon uploaded (1024x1024px, no transparency)
- [ ] Screenshots uploaded:
  - [ ] iPhone 6.7" (1290 x 2796 px) - iPhone 14 Pro Max
  - [ ] iPhone 6.5" (1242 x 2688 px) - iPhone 11 Pro Max
  - [ ] iPhone 5.5" (1242 x 2208 px) - iPhone 8 Plus
  - [ ] iPad Pro 12.9" (2048 x 2732 px)
- [ ] App preview videos (optional but recommended)

#### iOS Binary
- [ ] Build signed with Distribution certificate
- [ ] Provisioning profile configured
- [ ] Version and build number set correctly
- [ ] All required permissions explained in Info.plist:
  - [x] Camera usage description
  - [x] Photo library usage description
  - [x] Motion usage description
  - [ ] Location usage description (if needed)
- [ ] App tested on physical devices
- [ ] No crashes or major bugs
- [ ] TestFlight beta tested

#### iOS Compliance
- [ ] App Privacy details filled out
- [ ] Export compliance information provided
- [ ] Content rights verified
- [ ] Age rating completed
- [ ] In-app purchases configured (if any)

### Google Play Store Requirements

#### Google Play Console Setup
- [ ] Google Play Developer account active ($25 one-time)
- [ ] App created in Play Console
- [ ] Package name confirmed
- [ ] App icon uploaded (512x512px, 32-bit PNG)
- [ ] Feature graphic (1024 x 500 px)
- [ ] Screenshots uploaded:
  - [ ] Phone - 2-8 screenshots
  - [ ] 7-inch tablet - 2-8 screenshots (optional)
  - [ ] 10-inch tablet - 2-8 screenshots (optional)
- [ ] Video link (YouTube, optional but recommended)

#### Android Binary
- [ ] APK/AAB signed with upload key
- [ ] Release keystore safely stored
- [ ] Version code incremented
- [ ] Version name set correctly
- [ ] ProGuard rules configured for release
- [ ] App bundle (AAB) generated
- [ ] All permissions justified
- [ ] App tested on multiple devices/Android versions

#### Android Compliance
- [ ] Content rating questionnaire completed
- [ ] Privacy policy URL added
- [ ] Target API level 33+ (Android 13)
- [ ] Data safety form completed
- [ ] Store listing complete (short/full description)
- [ ] App categorization done

## 📝 Store Listing Content

### App Title
**English:** GoShopper AI - Receipt Scanner  
**French:** GoShopper AI - Scanner de Tickets

### Short Description (80 characters max)
**English:** Smart receipt scanner & price tracker for Congo (DRC)  
**French:** Scanner intelligent de tickets et suivi des prix au Congo (RDC)

### Full Description
See `STORE_DESCRIPTION.md`

### Keywords (iOS) / Tags (Android)
- receipt scanner
- price tracking
- shopping list
- budget tracker
- congo
- kinshasa
- drc
- grocery shopping
- expense tracker
- ai scanner

### App Category
- **Primary:** Shopping
- **Secondary:** Utilities / Productivity

### Content Rating
- **Age Rating:** 4+ (Everyone)
- No inappropriate content
- No in-app purchases requiring parental consent
- No access to restricted content

## 🔒 Privacy & Security

### Required Documents
- [ ] Privacy Policy published at: [URL]
- [ ] Terms of Service published at: [URL]
- [ ] Support page/email: support@goshopperai.com

### Data Collection Disclosure
- **User Data Collected:**
  - Email address (for authentication)
  - Name (optional, for personalization)
  - Receipt images (stored securely in Firebase)
  - Purchase history (anonymized analytics)
  - Device information (for crash reporting)

- **Data Usage:**
  - Authentication and account management
  - Receipt scanning and price tracking
  - Personalized shopping insights
  - App improvement and analytics

- **Data Sharing:**
  - No data sold to third parties
  - Firebase/Google services for infrastructure
  - Anonymous analytics only

### Permissions Explained

#### iOS
- **Camera:** To scan receipts and capture shopping data
- **Photos:** To allow selecting receipts from photo library
- **Motion:** For interactive animations and better UX
- **Notifications:** To remind users about shopping lists and price alerts

#### Android
- **Camera:** To scan receipts and capture shopping data
- **Storage:** To save and access receipt images
- **Internet:** To sync data and use cloud services
- **Notifications:** To send price alerts and reminders
- **Vibration:** For haptic feedback

## 🎨 Visual Assets Needed

### App Icon
- [x] 1024x1024px (iOS App Store)
- [x] 512x512px (Google Play)
- [x] Adaptive icon for Android (foreground + background)
- [x] All required sizes generated

### Screenshots (6-8 recommended)
1. Welcome/Onboarding screen
2. Receipt scanning in action
3. Items list with prices
4. Price trends and analytics
5. Shopping list feature
6. Insights dashboard
7. Settings/Profile screen

### Feature Graphic (Android)
- 1024 x 500 px
- Showcasing main app features

### Promotional Content
- App preview video (15-30 seconds)
- Banner images for featuring

## 🚀 Build & Release Process

### iOS Release Steps

```bash
# 1. Update version
# Edit ios/goshopperai/Info.plist and set version

# 2. Clean and install dependencies
cd ios
pod install
cd ..

# 3. Build for release
npx react-native run-ios --configuration Release

# 4. Archive in Xcode
# Open Xcode -> Product -> Archive

# 5. Upload to App Store Connect
# Xcode -> Distribute App -> App Store Connect

# 6. Submit for review in App Store Connect
```

### Android Release Steps

```bash
# 1. Update version in android/app/build.gradle
# versionCode and versionName

# 2. Generate release AAB
cd android
./gradlew bundleRelease

# 3. Sign the bundle
# Use your release keystore

# 4. Upload to Play Console
# Go to Production -> Create new release

# 5. Submit for review
```

## 🧪 Testing Checklist

### Functional Testing
- [ ] Receipt scanning works accurately
- [ ] All navigation flows work correctly
- [ ] Data syncs properly with Firebase
- [ ] Offline mode handles gracefully
- [ ] All animations smooth (60fps)
- [ ] No memory leaks or crashes
- [ ] Proper error handling everywhere

### Device Testing
- [ ] Tested on iPhone (latest iOS)
- [ ] Tested on iPad
- [ ] Tested on Android phone (latest Android)
- [ ] Tested on Android tablet
- [ ] Tested on low-end devices
- [ ] Tested in portrait and landscape

### Localization Testing
- [ ] French language properly displayed
- [ ] English language properly displayed
- [ ] Currency formatting correct (CDF)
- [ ] Date formatting correct for locale

### Performance Testing
- [ ] App loads in under 3 seconds
- [ ] Receipt scan completes in under 5 seconds
- [ ] Smooth scrolling in lists
- [ ] No lag in animations
- [ ] Low battery consumption

## 📋 Post-Submission

### After Approval
- [ ] Monitor crash reports
- [ ] Respond to user reviews
- [ ] Track analytics and usage
- [ ] Plan first update based on feedback
- [ ] Promote app on social media
- [ ] Collect user feedback

### Ongoing Maintenance
- [ ] Monthly updates with improvements
- [ ] Bug fixes within 48 hours
- [ ] Stay compliant with OS updates
- [ ] Monitor and respond to reviews
- [ ] Update privacy policy as needed

## 📞 Support Information

**Developer Name:** GoShopper AI Team  
**Support Email:** support@goshopperai.com  
**Website:** https://goshopperai.com  
**Privacy Policy:** https://goshopperai.com/privacy  
**Terms of Service:** https://goshopperai.com/terms  

## 🎯 Marketing Strategy

### Launch Plan
1. Soft launch in DRC first
2. Gather initial feedback
3. Fix critical issues
4. Full launch with marketing push
5. Local influencer partnerships
6. Social media campaign

### Target Markets
- **Primary:** Democratic Republic of Congo (Kinshasa)
- **Secondary:** Other Francophone African countries
- **Future:** West Africa, Central Africa expansion

---

**Last Updated:** December 14, 2024  
**Prepared By:** GoShopper AI Development Team
