# GoShopper SMS Service Implementation

## ✅ What Was Created

### 1. SMS Service (`src/shared/services/sms.ts`)
A new service that connects the GoShopper frontend to Firebase Cloud Functions for OTP handling.

**Methods:**
- `sendOTP(phoneNumber, countryCode?, language?)` - Sends verification code
  - Calls Cloud Function: `sendVerificationCode`
  - Returns: `{ success, sessionId, type, expiresIn, message, error }`
  
- `verifyOTP(phoneNumber, code, sessionId)` - Verifies the OTP code
  - Calls Cloud Function: `verifyCode`
  - Returns: `{ success, verified, verificationToken, identifier, type, message, error }`

- `resendOTP(phoneNumber, countryCode?, language?)` - Resends OTP (wrapper for sendOTP)

### 2. Updated Files

**`src/shared/services/index.ts`**
- Added export for `smsService`

**`src/features/onboarding/screens/VerifyOtpScreen.tsx`**
- Added `sessionId` state to store session from sendOTP response
- Updated `handleVerifyOTP()` to pass sessionId to verifyOTP
- Updated `handleResendOTP()` to store new sessionId

## 📱 How It Works

### Registration Flow:
```
1. User enters phone: 999999001 (or +243999999001)
2. RegisterScreen → navigates to VerifyOtp
3. VerifyOtpScreen loads → calls smsService.sendOTP()
4. Cloud Function detects test number (+243999999XXX)
5. Cloud Function skips SMS, uses fixed OTP: 123456
6. Returns sessionId to frontend
7. User enters: 123456
8. VerifyOtpScreen → calls smsService.verifyOTP(phone, "123456", sessionId)
9. Cloud Function verifies → returns verificationToken
10. Account created! ✅
```

### Password Reset Flow:
```
1. User forgot password → enters phone number
2. ForgotPasswordScreen → calls smsService.sendOTP()
3. Cloud Function sends OTP (or uses 123456 for test numbers)
4. Returns sessionId
5. User enters OTP code
6. App verifies with smsService.verifyOTP()
7. Navigate to ResetPasswordScreen with verificationToken
```

## 🔧 Cloud Functions (Already Implemented)

### `sendVerificationCode`
**Location:** `functions/src/auth/verification.ts`

**Input:**
```typescript
{
  phoneNumber: string,      // +243999999001
  email?: string,           // For international users
  countryCode: string,      // 'CD' for DRC
  language: string          // 'fr' or 'en'
}
```

**Output:**
```typescript
{
  success: true,
  sessionId: "abc123...",
  type: "phone",
  expiresIn: 600,
  message: "Code de vérification envoyé par SMS"
}
```

### `verifyCode`
**Location:** `functions/src/auth/verification.ts`

**Input:**
```typescript
{
  sessionId: string,        // From sendVerificationCode
  code: string              // "123456"
}
```

**Output:**
```typescript
{
  success: true,
  verified: true,
  verificationToken: "xyz789...",
  identifier: "+243999999001",
  type: "phone",
  message: "Verification successful"
}
```

## 🧪 Test Phone Numbers

### Format: 999999XXX
- Testers enter: `999999001`, `999999002`, etc.
- App adds +243: `+243999999001`, `+243999999002`
- Backend detects: starts with `+243999999`
- OTP is always: **123456**
- No SMS sent = $0 cost 💰

### Real Phone Numbers
- Format: Any valid phone starting with +243 (but NOT +243999999)
- Example: `+243812345678`
- Backend generates random 6-digit OTP
- SMS sent via Africa's Talking
- User receives actual SMS

## 🎯 Test Scenarios

### ✅ Test Number Registration
1. Enter phone: `999999001`
2. Wait for OTP screen
3. Enter: `123456`
4. ✅ Account created!

### ✅ Test Number Login
1. Enter phone: `999999001`
2. Enter your password
3. If prompted for OTP: enter `123456`
4. ✅ Logged in!

### ✅ Test Number Password Reset
1. Forgot Password
2. Enter phone: `999999001`
3. Enter OTP: `123456`
4. Set new password
5. ✅ Password reset!

## 📁 Files Modified

```
goshopperai/
├── src/shared/services/
│   ├── sms.ts                          ✅ NEW
│   └── index.ts                        📝 Updated (export smsService)
├── src/features/onboarding/screens/
│   └── VerifyOtpScreen.tsx            📝 Updated (sessionId handling)
└── functions/src/auth/
    ├── verification.ts                 ✅ Already has test phone logic
    └── config.ts                       ✅ Already has test phone config
```

## 🚀 Next Steps

### For Deployment:
1. ✅ Build functions: `cd functions && npm run build`
2. ✅ Deploy to Firebase: `firebase deploy --only functions`
3. ✅ Test with test phone: `999999001` + OTP `123456`
4. ✅ Test with real phone (if in DRC)

### For Testing:
1. Use test numbers: `999999001` through `999999999`
2. OTP is always: `123456`
3. Each test number = separate account
4. No SMS charges! 🎉

## 🐛 Error Handling

The smsService handles all Firebase Functions errors:

| Error Code | User Message |
|------------|--------------|
| `functions/invalid-argument` | "Numéro de téléphone invalide" |
| `functions/resource-exhausted` | "Veuillez attendre avant de réessayer" |
| `functions/not-found` | "Session expirée. Demandez un nouveau code" |
| `functions/deadline-exceeded` | "Code expiré. Demandez un nouveau code" |
| `functions/internal` | "Erreur serveur. Veuillez réessayer" |

## 🔒 Security

- ✅ Session-based OTP verification (not just phone number)
- ✅ OTP expires after 10 minutes
- ✅ Max 3 attempts per session
- ✅ 60-second cooldown between resends
- ✅ Test numbers clearly identified with `+243999999` prefix
- ✅ Test numbers can be disabled in production via config

---

**Status:** ✅ Fully Implemented & Ready for Testing  
**Last Updated:** January 9, 2026
