# App Icon Generation Guide

This guide explains how to generate app icons from the SVG logo for GoShopperAI.

## Prerequisites

Install the required Node.js packages:

```bash
npm install sharp @resvg/resvg-js
```

Or add them to your package.json:

```json
{
  "devDependencies": {
    "sharp": "^0.33.0",
    "@resvg/resvg-js": "^2.6.0"
  }
}
```

## Usage

### Generate All Icons

Run the script from the project root:

```bash
node scripts/generate-app-icons.js
```

This will generate:

### Android Icons

**Standard Icons (mipmap):**
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

**Round Icons:**
- Same sizes as above with `_round` suffix

**Adaptive Icons (Android 8.0+):**
- `drawable/ic_launcher_foreground.xml`
- `drawable/ic_launcher_background.xml`
- `mipmap-anydpi-v26/ic_launcher.xml`
- `mipmap-anydpi-v26/ic_launcher_round.xml`

### iOS Icons

**AppIcon.appiconset:**
- iPhone Notification: 40x40@2x, 60x60@3x
- iPhone Settings: 58x58@2x, 87x87@3x
- iPhone Spotlight: 80x80@2x, 120x120@3x
- iPhone App: 120x120@2x, 180x180@3x
- App Store: 1024x1024@1x
- `Contents.json` (metadata)

## Icon Specifications

### Source Logo

The logo is defined in `assets/logo-icon.ts` as `logoGochujangSvg`:

- **Design:** Letter "G" in cream (#FDF0D5) on red gradient background
- **Gradient:** Crimson Blaze (#C1121F) to Gochujang Red (#780000)
- **Shape:** Rounded square (22px radius)
- **Base Size:** 100x100

### Android Requirements

- **Standard Icons:** PNG format, square, various densities
- **Round Icons:** PNG format, circular mask applied by system
- **Adaptive Icons:** 
  - Foreground: 108x108dp (66dp safe zone)
  - Background: 108x108dp solid or gradient
  - System applies circular, rounded square, or squircle mask

### iOS Requirements

- **Format:** PNG (no transparency in background)
- **Color Space:** sRGB or P3
- **All sizes required** for app submission
- **1024x1024** required for App Store

## After Generation

### Android

1. Clean the build:
   ```bash
   cd android
   ./gradlew clean
   ```

2. Rebuild the app:
   ```bash
   cd ..
   npx react-native run-android
   ```

### iOS

1. Install pods (if needed):
   ```bash
   cd ios
   pod install
   ```

2. Rebuild the app:
   ```bash
   cd ..
   npx react-native run-ios
   ```

## Customization

### Change the Logo

Edit `assets/logo-icon.ts` and update the `logoGochujangSvg` constant, then re-run the script.

### Different Icon Sizes

Edit the `ANDROID_SIZES` or `IOS_SIZES` arrays in `generate-app-icons.js`:

```javascript
const ANDROID_SIZES = [
  { size: 48, density: 'mdpi', folder: 'mipmap-mdpi' },
  // Add more sizes...
];
```

### Different Icon Variants

You can use different SVG variants from `assets/logo-icon.ts`:

- `logoGochujangSvg` - Default warm red gradient
- `logoGochujangLightSvg` - Cream background
- `logoGochujangCosmosSvg` - Blue cosmos background

Just replace the `logoSvg` constant in the script.

## Troubleshooting

### "Cannot find module 'sharp'"

Install dependencies:
```bash
npm install sharp @resvg/resvg-js
```

### Icons not updating in Android

1. Uninstall the app from device
2. Clean build: `cd android && ./gradlew clean`
3. Rebuild and reinstall

### Icons not updating in iOS

1. Delete DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData`
2. Clean build: Open Xcode → Product → Clean Build Folder
3. Rebuild

### "Image is too small" error

The script generates exact sizes. If you get this error, check that:
- SVG viewBox is correctly set to "0 0 100 100"
- The size parameter matches the required dimensions

## Manual Alternative

If the script doesn't work, you can manually:

1. Export SVG to PNG using online tools like:
   - https://svgtopng.com/
   - https://cloudconvert.com/svg-to-png

2. Use image editing software (Photoshop, GIMP, Figma) to resize

3. Place files in the correct folders following the structure above

## Resources

- [Android Icon Design](https://developer.android.com/guide/practices/ui_guidelines/icon_design_launcher)
- [iOS App Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Adaptive Icons Guide](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)

---

**Generated icons are optimized for:**
- High quality (PNG quality: 100)
- Small file size (compression level: 9)
- Consistent appearance across devices
- Both light and dark system themes
