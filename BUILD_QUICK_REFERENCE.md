# Quick Build Commands for Google Play

## Using EAS (Recommended) ✨

### Interactive Build Menu
```bash
npm run build:eas
```
This opens an interactive menu where you can select:
- Production AAB (for Google Play)
- Preview APK (for testing)

### Direct Commands

#### Build Production AAB
```bash
npm run build:eas:production
# or
eas build --platform android --profile production
```

#### Build Preview APK
```bash
npm run build:eas:preview
# or
eas build --platform android --profile preview
```

## Using Local Gradle Build

```bash
npm run build:android:windows
```

## First Time Setup

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Login to Expo
```bash
eas login
```

### 3. Verify Configuration
```bash
eas whoami
```

## Build Process

### Step 1: Start Build
```bash
npm run build:eas:production
```

### Step 2: Monitor Progress
- Check EAS Dashboard: https://expo.dev
- Or use CLI: `eas build:list`

### Step 3: Download AAB
- Build completes in ~10-20 minutes
- Download from EAS dashboard
- Or it downloads automatically

### Step 4: Upload to Google Play
1. Go to https://play.google.com/console
2. Select your app
3. Production → Releases → Create new release
4. Upload the AAB
5. Submit

## Troubleshooting

### "EAS CLI not found"
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas login
```

### "Build failed"
```bash
# View build logs
eas build:list
eas build:view BUILD_ID
```

### Check Build Status
```bash
eas build:list
```

## Version Updates

Before building, update version:

1. **app.json**
```json
"version": "1.0.1"
```

2. **package.json**
```json
"version": "1.0.1"
```

3. **android/app/build.gradle**
```gradle
versionCode 2
versionName "1.0.1"
```

## Useful Commands

```bash
# List all builds
eas build:list

# View specific build
eas build:view BUILD_ID

# Cancel build
eas build:cancel BUILD_ID

# Check who you're logged in as
eas whoami

# View project info
eas project:info

# Submit to Play Store
eas submit --platform android --latest
```

## Files You Need

✅ `eas.json` - Build configuration
✅ `app.json` - App configuration
✅ `credentials.json` - Keystore credentials
✅ `goshopper-release-key.keystore` - Signing key

## Build Profiles

| Profile | Output | Use Case |
|---------|--------|----------|
| production | AAB | Google Play Store |
| preview | APK | Internal testing |
| development | APK | Development builds |

## Support

- Full Guide: [EAS_BUILD_GUIDE.md](./EAS_BUILD_GUIDE.md)
- EAS Docs: https://docs.expo.dev/build/introduction/
- Play Console: https://play.google.com/console
