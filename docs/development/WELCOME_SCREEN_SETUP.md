# Welcome Screen Modern Features Setup

## Overview
The WelcomeScreen has been upgraded with 10 modern mobile features to create a premium onboarding experience.

## Modern Features Implemented

### 1. ✨ Lottie Animations
- **Location**: `assets/animations/`
- **Files**: 
  - `sparkles.json` - Welcome slide animation
  - `scan.json` - Scanner slide animation
  - `brain.json` - AI analysis slide animation
  - `trending.json` - Savings slide animation
- **Library**: `lottie-react-native`
- **Features**: Smooth, lightweight vector animations with auto-play on active slides

### 2. 🌫️ Glassmorphism Blur Header
- **Component**: BlurView wrapper on header
- **Library**: `@react-native-community/blur`
- **Effect**: iOS-style frosted glass navigation bar
- **Features**: Dynamic blur with light/dark theme support

### 3. 📳 Haptic Feedback
- **Service**: `hapticService` (already integrated)
- **Triggers**:
  - Light: Next/Continue button, pause/play
  - Medium: Skip button, swipe gestures, bottom sheet
  - Success: Get Started final action
  - Selection: Slide change
- **Platforms**: iOS & Android with native haptic engines

### 4. 🎥 Video Background
- **Library**: `react-native-video`
- **Usage**: First slide (Bienvenue) has subtle looping background video
- **Features**: Auto-pause when not active, muted playback, 30% opacity overlay
- **Video URL**: Placeholder (replace with your branded video)

### 5. 🎨 Parallax Scroll Effects
- **Component**: `ParallaxBackground`
- **Effect**: Background circles move at different speeds than foreground
- **Implementation**: Animated.interpolate with scroll offset
- **Creates**: Depth and modern 3D feel

### 6. 📱 Gyroscope Tilt Effects
- **Library**: `react-native-gyroscope`
- **Effect**: Icons tilt subtly based on device orientation
- **Features**: 
  - rotateX/rotateY transforms
  - 100ms update interval
  - 10x multiplier for subtle movement
- **Platforms**: iOS & Android (requires permission)

### 7. 👆 Swipe-to-Reveal Details
- **Gesture**: Swipe up on any slide
- **Implementation**: PanResponder with spring animations
- **Features**:
  - Haptic feedback on successful swipe
  - Details sheet with close button
  - Smooth spring animations
- **Threshold**: 50px upward swipe

### 8. ⏰ Auto-Advance Slides
- **Feature**: Slides automatically progress every 5 seconds
- **Controls**: Pause/Play button in header
- **Progress Bar**: Animated progress indicator shows time remaining
- **Behavior**:
  - Pauses on manual scroll
  - Disabled on last slide
  - Toggle with pause button

### 9. 🔢 Animated Counter
- **Component**: `AnimatedCounter`
- **Usage**: "2 mois" free trial counter
- **Animation**: Counts from 0 to target value over 1.5 seconds
- **Features**: 30-frame smooth animation, automatic timing

### 10. 📋 Bottom Sheet with Terms
- **Library**: `@gorhom/bottom-sheet`
- **Trigger**: Tap "Conditions" link in trial badge
- **Features**:
  - Snap points at 50% and 80%
  - Pan-to-close gesture
  - Terms & privacy content
  - Haptic feedback on interactions

### 11. 🔐 Social Login Preview (Bonus)
- **Display**: Last slide only
- **Buttons**: Google & Apple login icons
- **Purpose**: Reduce friction, preview authentication options
- **Features**: Haptic feedback on tap, smooth reveal animation

## Installation

### 1. Install Dependencies
```bash
npm install --save lottie-react-native @react-native-community/blur react-native-video @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler@^2.16.1 react-native-gyroscope --legacy-peer-deps
```

### 2. iOS Setup
```bash
cd ios
pod install
cd ..
```

### 3. Android Setup

#### Add to `android/app/build.gradle`:
```gradle
dependencies {
    // ... existing dependencies
    implementation project(':lottie-react-native')
    implementation project(':@react-native-community_blur')
}
```

#### Add to `android/settings.gradle`:
```gradle
include ':lottie-react-native'
project(':lottie-react-native').projectDir = new File(rootProject.projectDir, '../node_modules/lottie-react-native/src/android')

include ':@react-native-community_blur'
project(':@react-native-community_blur').projectDir = new File(rootProject.projectDir, '../node_modules/@react-native-community/blur/android')
```

### 4. Permissions

#### iOS - `ios/goshopperai/Info.plist`:
```xml
<key>NSMotionUsageDescription</key>
<string>We use device motion for interactive onboarding animations</string>
```

#### Android - `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.VIBRATE" />
```

## Usage

The WelcomeScreen is automatically displayed on first app launch. All features are enabled by default:

- **Auto-advance**: Enabled by default (5s per slide)
- **Haptic feedback**: Works automatically
- **Lottie animations**: Auto-play on active slides
- **Video background**: Plays on first slide only
- **Gyroscope tilt**: Enabled if permission granted
- **Swipe gestures**: Available on all slides
- **Bottom sheet**: Opens via "Conditions" link

## Customization

### Adjust Auto-Advance Speed
```typescript
// In WelcomeScreen.tsx, line ~XXX
Animated.timing(progressAnim, {
  toValue: 1,
  duration: 5000, // Change this (milliseconds)
  useNativeDriver: false,
}).start(...)
```

### Replace Video Background
```typescript
// In Slide component
<Video
  source={{uri: 'YOUR_VIDEO_URL_HERE'}} // Replace with your video
  style={styles.videoBackground}
  ...
/>
```

### Customize Lottie Animations
Replace JSON files in `assets/animations/` with your own Lottie files from:
- [LottieFiles](https://lottiefiles.com/)
- [After Effects with Bodymovin plugin](https://airbnb.io/lottie/)

### Modify Haptic Patterns
```typescript
// Available haptic types:
hapticService.impact('light')    // Subtle tap
hapticService.impact('medium')   // Button press
hapticService.impact('heavy')    // Important action
hapticService.success()          // Completion
hapticService.error()            // Error state
hapticService.selection()        // Picker/selector change
```

## Performance Considerations

1. **Video Background**: 
   - Use optimized MP4 (H.264 codec)
   - Max resolution: 720p
   - Keep file size under 5MB
   - Consider removing for low-end devices

2. **Lottie Animations**:
   - Keep JSON files under 100KB
   - Avoid excessive layers (< 30 layers)
   - Use simple shapes over complex paths

3. **Gyroscope**:
   - Auto-disables if permission denied
   - 100ms update interval (adjustable)
   - Minimal battery impact

4. **Auto-Advance**:
   - Users can disable via pause button
   - Automatically pauses on manual interaction

## Troubleshooting

### iOS

**Blur not working:**
```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

**Gyroscope permission denied:**
- Check Info.plist has NSMotionUsageDescription
- Test on physical device (simulator doesn't support gyroscope)

### Android

**Lottie animations not loading:**
- Verify native linking in `android/settings.gradle`
- Run `npx react-native run-android` to rebuild

**Video playback issues:**
- Check network connectivity for remote videos
- Use local video files for better performance
- Verify video codec (H.264 recommended)

### General

**Haptics not working:**
- iOS: Test on physical device
- Android: Verify VIBRATE permission in AndroidManifest.xml

**Bottom sheet gesture conflicts:**
- Ensure react-native-gesture-handler is properly linked
- Check gesture handler wrapper in App.tsx

## Accessibility

All modern features maintain accessibility:
- **Screen readers**: Full VoiceOver/TalkBack support
- **Reduced motion**: Respects system accessibility settings
- **High contrast**: Color schemes follow system preferences
- **Font scaling**: Text adjusts with system font size

## Future Enhancements

Potential additions:
- [ ] User analytics for slide engagement
- [ ] A/B testing for different animation styles
- [ ] Localized videos for different markets
- [ ] Custom Lottie animations per user segment
- [ ] Sound effects (with mute option)
- [ ] Skip to specific slide via deep link

## Credits

Libraries used:
- [Lottie React Native](https://github.com/lottie-react-native/lottie-react-native)
- [React Native Blur](https://github.com/Kureev/react-native-blur)
- [React Native Video](https://github.com/react-native-video/react-native-video)
- [Gorhom Bottom Sheet](https://github.com/gorhom/react-native-bottom-sheet)
- [React Native Gyroscope](https://github.com/pwmckenna/react-native-gyroscope)

---

**Version**: 1.0  
**Last Updated**: December 2025  
**Maintained by**: GoShopperAI Team
