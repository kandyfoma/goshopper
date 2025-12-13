# GoShopperAI Assets

This directory contains all static assets for the application.

## Directory Structure

```
assets/
├── animations/          # Lottie animation files (NEW)
│   ├── sparkles.json   # Welcome slide animation
│   ├── scan.json       # Scanner slide animation
│   ├── brain.json      # AI analysis slide animation
│   ├── trending.json   # Savings slide animation
│   └── index.ts        # Animation exports
├── app-icons/          # App icon variants
│   └── urbanist/       # Urbanist design system icons
├── logo.png            # Main app logo (1024x1024 PNG) (NEW)
├── logo-icon.ts        # SVG logo variants with Gochujang colors (UPDATED)
└── README.md           # This file
```

## 🎬 Animations (NEW)

### Lottie Files
All animation files are in JSON format, optimized for `lottie-react-native`.

**Usage:**
```typescript
import LottieView from 'lottie-react-native';
import {sparklesAnimation} from '@/assets/animations';

<LottieView
  source={sparklesAnimation}
  autoPlay
  loop
  style={{width: 200, height: 200}}
/>
```

**Files:**
- `sparkles.json` - Twinkling sparkles for welcome slide
- `scan.json` - Scanner frame with moving scan line
- `brain.json` - AI brain with neural network pulses
- `trending.json` - Upward trending arrow with graph

**Used in**: WelcomeScreen modern onboarding experience

## 🎨 Logos

### PNG Logo (`logo.png`) - NEW
- **Resolution**: 1024x1024
- **Format**: PNG with transparency
- **Usage**: Main app logo, splash screen, about page
- **Color Palette**: Gochujang warm colors

**Usage:**
```typescript
import {Image} from 'react-native';
const logoImage = require('@/assets/logo.png');

<Image source={logoImage} style={{width: 100, height: 100}} />
```

### SVG Logo Variants (`logo-icon.ts`) - UPDATED
Multiple SVG variants for different themes and contexts.

**Available Variants:**
- `logoGochujangSvg` - Default warm red gradient
- `logoGochujangLightSvg` - Cream background variant
- `logoGochujangCosmosSvg` - Cosmos blue variant
- `logoIconWhiteSvg` - White background variant

**Color Palette (Gochujang Warm):**
- Crimson Blaze: #C1121F (primary vibrant)
- Gochujang Red: #780000 (primary dark)
- Cosmos Blue: #003049 (deep teal)
- Blue Marble: #669BBC (light blue accent)
- Varden Cream: #FDF0D5 (warm cream)
- Warm Beige: #F5E6C3 (secondary cream)

## 📱 App Icons

Located in `app-icons/urbanist/` directory.

**Platforms:**
- iOS: Multiple resolutions for App Store and devices
- Android: Adaptive icons with foreground/background layers

## File Size Guidelines

| Asset Type | Max Size | Recommended |
|------------|----------|-------------|
| PNG Images | 500KB | < 200KB |
| Lottie JSON | 200KB | < 100KB |
| SVG Files | 50KB | < 20KB |

## Recent Changes

### December 2025 - Modern Welcome Screen Update
- ✅ Added 4 Lottie animation files for onboarding
- ✅ Added logo.png (1024x1024 PNG)
- ✅ Updated logo-icon.ts with Gochujang warm palette
- ✅ Created animations/index.ts export file
- ✅ Removed all green colors from branding

---

**Maintained by**: GoShopperAI Team  
**Last Updated**: December 12, 2025
