# GoShopper Assets

This folder contains all visual assets for the GoShopper application.

## Logo Files

### logo.svg
- **Purpose**: Main logo icon for app branding
- **Format**: SVG (Scalable Vector Graphics)
- **Dimensions**: 100x100px viewBox
- **Usage**: App icons, favicons, small UI elements
- **Colors**:
  - Primary: #10B981 (Emerald Green)
  - Secondary: #059669 (Dark Emerald)
  - Accent: #F59E0B (Amber for AI sparkles)
  - Text: #374151 (Gray-800)

### logo-full.svg
- **Purpose**: Full logo with app name and tagline
- **Format**: SVG
- **Dimensions**: 400x120px viewBox
- **Usage**: Marketing materials, headers, about screens
- **Includes**:
  - Logo icon
  - "GoShopper" text
  - "Prix Tracker • Factures Intelligentes" tagline

### logo-icon.ts
- **Purpose**: React Native component export
- **Format**: TypeScript module
- **Usage**: Import and use with react-native-svg
- **Example**:
  ```tsx
  import { SvgXml } from 'react-native-svg';
  import { logoIconSvg } from '../assets/logo-icon';

  <SvgXml xml={logoIconSvg} width={100} height={100} />
  ```

## Color Palette

- **Primary Green**: #10B981 - Main brand color, represents savings and growth
- **Dark Green**: #059669 - Secondary green for borders and emphasis
- **Amber**: #F59E0B - AI/sparkle effects, represents intelligence
- **Gray-800**: #374151 - Text and icons
- **Gray-600**: #6B7280 - Secondary text
- **White**: #FFFFFF - Backgrounds and contrast

## Usage Guidelines

1. **Always use SVG format** for crisp rendering on all screen densities
2. **Maintain aspect ratios** when resizing logos
3. **Use appropriate logo variant**:
   - `logo.svg` for app icons and small UI elements
   - `logo-full.svg` for marketing and headers
4. **Color consistency** - stick to the defined color palette
5. **Minimum size** - logos should be at least 24px for readability

## React Native Components

- `Logo.tsx`: Reusable logo component with size prop
- `SplashScreen.tsx`: Full-screen splash with logo

## Implementation Notes

- Uses `react-native-svg` for SVG rendering
- Logo components are optimized for React Native
- All assets are vector-based for scalability
- Colors follow accessibility guidelines