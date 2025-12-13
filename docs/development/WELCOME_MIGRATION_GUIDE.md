# Welcome Screen Migration Guide

## Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
npm install --save lottie-react-native @react-native-community/blur react-native-video @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler@^2.16.1 react-native-gyroscope --legacy-peer-deps
```

✅ **Status**: Already completed

### 2. Clean and Rebuild

#### iOS (requires macOS)
```bash
# Clean
rm -rf ios/Pods ios/build ios/Podfile.lock
cd ios
pod install
cd ..

# Rebuild
npx react-native run-ios
```

#### Android
```bash
# Clean
cd android
./gradlew clean
cd ..

# Rebuild
npx react-native run-android
```

### 3. Test Features Checklist

Run through each feature on a physical device:

- [ ] **Lottie Animations**: Icons animate smoothly
- [ ] **Blur Header**: Header has frosted glass effect
- [ ] **Haptic Feedback**: Feel vibrations on taps
- [ ] **Auto-Advance**: Slides progress automatically every 5s
- [ ] **Pause/Play**: Toggle button works
- [ ] **Swipe Up**: Reveals detail sheet
- [ ] **Gyroscope**: Icons tilt with device (physical device only)
- [ ] **Bottom Sheet**: Tap "Conditions" link opens sheet
- [ ] **Social Buttons**: Google/Apple icons visible on last slide
- [ ] **Animated Counter**: "2 mois" counts from 0 to 2

---

## Customization Options

### Change Auto-Advance Speed
```typescript
// File: src/features/onboarding/screens/WelcomeScreen.tsx
// Line: ~215

Animated.timing(progressAnim, {
  toValue: 1,
  duration: 5000, // Change to 3000 for 3 seconds, 7000 for 7 seconds, etc.
  useNativeDriver: false,
})
```

### Replace Video Background
```typescript
// File: src/features/onboarding/screens/WelcomeScreen.tsx
// Line: ~330

<Video
  source={{uri: 'YOUR_CUSTOM_VIDEO_URL'}} // Replace with your video
  style={styles.videoBackground}
  resizeMode="cover"
  repeat
  muted
  paused={!isActive}
/>
```

Or use local video:
```typescript
<Video
  source={require('../../../assets/videos/welcome-bg.mp4')}
  ...
/>
```

### Disable Auto-Advance by Default
```typescript
// File: src/features/onboarding/screens/WelcomeScreen.tsx
// Line: ~206

const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false); // Changed from true
```

### Adjust Haptic Intensity
```typescript
// Available options:
hapticService.impact('light')    // Subtle
hapticService.impact('medium')   // Default
hapticService.impact('heavy')    // Strong
```

### Change Lottie Animations
1. Download from [LottieFiles.com](https://lottiefiles.com/)
2. Replace JSON files in `assets/animations/`
3. Keep same filenames or update imports in `WelcomeScreen.tsx`

---

## Troubleshooting

### Issue: Blur not working on Android
**Solution**: Android blur is software-based. For better performance:
```typescript
// Reduce blur amount
<BlurView
  blurAmount={5} // Reduced from 10
  ...
/>
```

### Issue: Lottie animations not playing
**Solution**: Verify native linking
```bash
# iOS
cd ios
pod install
cd ..

# Android
npx react-native run-android
```

### Issue: Bottom sheet gesture conflicts
**Solution**: Ensure GestureHandlerRootView wraps app
```typescript
// File: src/app/App.tsx (already done)
<GestureHandlerRootView style={{flex: 1}}>
  {/* app content */}
</GestureHandlerRootView>
```

### Issue: Gyroscope not working
**Causes**:
1. Testing on simulator (not supported)
2. Permission not granted
3. Device doesn't have gyroscope sensor

**Solution**: Test on physical device and check permissions

### Issue: Video not loading
**Solutions**:
1. Check network connection
2. Use local video file instead of URL
3. Verify video codec (use H.264)
4. Check video file size (< 5MB recommended)

### Issue: Haptics not working
**iOS**: Test on physical device (simulator doesn't support haptics)
**Android**: Verify VIBRATE permission in AndroidManifest.xml (already added)

---

## Performance Optimization

### For Low-End Devices

1. **Disable Video Background**:
```typescript
// Comment out video in Slide component
{/* {item.hasVideo && index === 0 && (
  <Video ... />
)} */}
```

2. **Reduce Blur**:
```typescript
<BlurView
  blurAmount={3} // Lower value
  ...
/>
```

3. **Simplify Lottie Animations**:
- Use simpler JSON files (< 50KB)
- Reduce animation frame rate

4. **Disable Gyroscope**:
```typescript
// Remove gyroscope subscription in AnimatedIcon component
```

---

## Rollback Plan

If you need to revert to the old WelcomeScreen:

1. **Git Revert** (recommended):
```bash
git checkout HEAD~1 src/features/onboarding/screens/WelcomeScreen.tsx
```

2. **Manual Rollback**:
- Remove Lottie/Video/Blur imports
- Remove new components (AnimatedCounter, ParallaxBackground)
- Restore old AnimatedIcon component
- Remove bottom sheet code
- Simplify slide rendering

---

## Feature Flags (Optional)

To gradually roll out features, add feature flags:

```typescript
// config/features.ts
export const FEATURES = {
  enableLottie: true,
  enableBlur: true,
  enableHaptics: true,
  enableVideo: true,
  enableGyroscope: true,
  enableAutoAdvance: true,
  enableBottomSheet: true,
};

// Then in WelcomeScreen.tsx
import {FEATURES} from '@/config/features';

{FEATURES.enableLottie && (
  <LottieView ... />
)}
```

---

## Analytics Events to Track

Add analytics to measure engagement:

```typescript
import {analyticsService} from '@/shared/services';

// Track slide views
analyticsService.logEvent('welcome_slide_view', {
  slide_index: currentIndex,
  slide_title: SLIDES[currentIndex].title,
});

// Track auto-advance interactions
analyticsService.logEvent('welcome_auto_advance_toggled', {
  enabled: autoAdvanceEnabled,
});

// Track swipe gestures
analyticsService.logEvent('welcome_detail_revealed', {
  slide_index: index,
});

// Track bottom sheet opens
analyticsService.logEvent('welcome_terms_viewed', {
  source: 'conditions_link',
});
```

---

## Team Communication

### For Designers
- Lottie animations can be customized
- Video background can be replaced
- Colors follow existing theme system
- All animations respect reduced motion settings

### For QA
- Test on both iOS and Android
- Test on physical devices (not just simulators)
- Verify gyroscope permission flow
- Check video playback on different networks
- Test haptics on various device models

### For Product Managers
- Auto-advance can be A/B tested
- All features can be tracked with analytics
- Social login preview reduces signup friction
- Bottom sheet keeps users in context

---

## Timeline

- **Development**: ✅ Complete (December 2025)
- **Testing**: Recommended 1-2 days on devices
- **QA Review**: 1-2 days
- **Production Deploy**: After successful testing

---

## Support

Questions? Check:
1. `docs/development/WELCOME_SCREEN_SETUP.md` - Full setup guide
2. `docs/development/WELCOME_MODERNIZATION_SUMMARY.md` - Feature overview
3. GitHub Issues - Report bugs/requests

---

**Status**: Ready for testing  
**Risk Level**: Low (all features have fallbacks)  
**Rollback Time**: < 5 minutes via git revert  
**Recommended**: Test on staging environment first
