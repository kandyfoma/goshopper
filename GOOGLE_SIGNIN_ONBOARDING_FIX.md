# Google Sign-In Onboarding Loop Fix

## Problem Description

When users clicked "Google Sign In" on the Login screen and selected their Google account, instead of being logged in or taken to complete registration, the app redirected them back to the onboarding/welcome screens, creating an infinite loop.

## Root Cause

The issue occurred because:

1. **Missing Onboarding Flag**: When users signed in via Google/Apple/Facebook, the app successfully authenticated them in Firebase, but it never marked the onboarding process as complete in AsyncStorage.

2. **Navigation Logic**: The `RootNavigator.tsx` checks `isFirstLaunch` (based on AsyncStorage key `@goshopperai_onboarding_complete`) to decide whether to show the Welcome screen. Even though social login users were authenticated (`isAuthenticated = true`), if `isFirstLaunch` was still `true`, they would be redirected to the Welcome screen.

3. **Loop Creation**: 
   - User signs in with Google → authenticated
   - `isFirstLaunch` check runs → still `true` (flag never set)
   - User redirected to Welcome screen
   - Welcome screen navigation tries to proceed but auth state triggers another check
   - Loop continues

## Files Modified

### 1. `src/shared/contexts/AuthContext.tsx`

**Changes:**
- Added `AsyncStorage` import
- Updated `signInWithGoogle()` to mark onboarding as complete after successful sign-in
- Updated `signInWithApple()` to mark onboarding as complete after successful sign-in
- Updated `signInWithFacebook()` to mark onboarding as complete after successful sign-in

**Code Added:**
```typescript
// Mark onboarding as completed for social login users to prevent redirect loop
try {
  await AsyncStorage.setItem('@goshopperai_onboarding_complete', 'completed');
  console.log('✅ Onboarding marked as complete for [Provider] sign-in user');
} catch (storageError) {
  console.warn('Failed to save onboarding status:', storageError);
}
```

### 2. `src/navigation/RootNavigator.tsx`

**Changes:**
- Updated navigation logic comments for clarity
- Added comment explaining that social login users skip Welcome screen by marking onboarding complete in AuthContext
- Improved documentation of the navigation flow

## How It Works Now

### Social Sign-In Flow (Google/Apple/Facebook)

1. User clicks "Continue with Google" on Login screen
2. Google authentication dialog appears
3. User selects their Google account
4. `AuthContext.signInWithGoogle()` is called:
   - Authenticates with Firebase
   - **NEW**: Saves `@goshopperai_onboarding_complete` to AsyncStorage
   - Sets `isAuthenticated = true`
5. `RootNavigator` checks navigation state:
   - `isFirstLaunch = false` (onboarding flag is now set)
   - `isAuthenticated = true`
   - Checks if profile is complete
6. Navigation Decision:
   - **If profile incomplete**: Navigate to `ProfileSetup` screen to collect phone, city, etc.
   - **If profile complete**: Navigate to `Main` app screen

### Phone/Password Sign-In Flow

1. User enters phone and password on Login screen
2. Authentication succeeds
3. Proceeds to main app (onboarding was already completed during registration)

### First-Time User Flow

1. User opens app for first time
2. `isFirstLaunch = true`, `isAuthenticated = false`
3. Shows Welcome/Onboarding screens
4. User completes onboarding → flag set → proceeds to Login or Main

## Benefits

✅ **Fixed the loop**: Social login users no longer get stuck in onboarding
✅ **Seamless experience**: Google/Apple/Facebook sign-in now works correctly
✅ **Profile completion**: If user profile is incomplete (missing phone, city), they're directed to ProfileSetup
✅ **Consistent behavior**: All authentication methods now properly set onboarding flag
✅ **Better UX**: Users can immediately access the app after social sign-in

## Testing Recommendations

1. **Test Google Sign-In**:
   - Fresh install → Google sign-in → Should go to ProfileSetup or Main (not Welcome)
   - Existing user → Google sign-in → Should go directly to Main

2. **Test Apple Sign-In**:
   - Fresh install → Apple sign-in → Should go to ProfileSetup or Main (not Welcome)
   - Existing user → Apple sign-in → Should go directly to Main

3. **Test Facebook Sign-In**:
   - Fresh install → Facebook sign-in → Should go to ProfileSetup or Main (not Welcome)
   - Existing user → Facebook sign-in → Should go directly to Main

4. **Test Phone Registration**:
   - Register with phone → Complete onboarding → Sign in → Should work as before

5. **Test First Launch**:
   - Fresh install → Should still show Welcome screen correctly
   - Complete onboarding → Proceed to app

## Related Files

- `src/shared/contexts/AuthContext.tsx` - Authentication state management
- `src/navigation/RootNavigator.tsx` - App navigation and routing logic
- `src/features/onboarding/screens/WelcomeScreenModern.tsx` - Onboarding/Welcome screen
- `src/features/onboarding/screens/LoginScreen.tsx` - Login with social providers
- `src/features/onboarding/screens/ProfileSetupScreen.tsx` - Complete profile for social users

## Date Fixed
January 10, 2026
