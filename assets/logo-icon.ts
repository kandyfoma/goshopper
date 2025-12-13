/**
 * GoShopperAI Logo & Color Configuration
 *
 * Warm Gochujang Color Palette:
 * - Gochujang Red: #780000 (primary dark)
 * - Crimson Blaze: #C1121F (primary vibrant)
 * - Cosmos Blue: #003049 (deep teal)
 * - Blue Marble: #669BBC (light blue accent)
 * - Varden Cream: #FDF0D5 (warm cream/beige)
 * - Warm Beige: #F5E6C3 (secondary cream)
 */

// ============================================
// GOCHUJANG WARM PALETTE LOGO (DEFAULT)
// Clean G letter without search icon
// ============================================
export const logoGochujangSvg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGochujang" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#C1121F"/>
      <stop offset="100%" style="stop-color:#780000"/>
    </linearGradient>
  </defs>
  
  <!-- Background with warm red gradient -->
  <rect width="100" height="100" rx="22" fill="url(#bgGochujang)"/>
  
  <!-- Letter G - Clean version -->
  <g transform="translate(18, 15)">
    <path d="M32 0C14.3 0 0 14.3 0 32C0 49.7 14.3 64 32 64C38.5 64 44.5 62.2 49.5 59V36H28V46H39.5V51.5C37.2 52.5 34.7 53 32 53C18.7 53 10 43.5 10 32C10 18.7 20.5 10 32 10C41.5 10 49.5 15.5 53 23.5L62 17.5C56 6.8 45 0 32 0Z" 
          fill="#FDF0D5"/>
  </g>
</svg>`;

// Cream background variant (for light themes)
export const logoGochujangLightSvg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Cream background -->
  <rect width="100" height="100" rx="22" fill="#FDF0D5"/>
  
  <!-- Letter G - Clean version -->
  <g transform="translate(18, 15)">
    <path d="M32 0C14.3 0 0 14.3 0 32C0 49.7 14.3 64 32 64C38.5 64 44.5 62.2 49.5 59V36H28V46H39.5V51.5C37.2 52.5 34.7 53 32 53C18.7 53 10 43.5 10 32C10 18.7 20.5 10 32 10C41.5 10 49.5 15.5 53 23.5L62 17.5C56 6.8 45 0 32 0Z" 
          fill="#C1121F"/>
  </g>
</svg>`;

// Cosmos Blue background variant
export const logoGochujangCosmosSvg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgCosmos" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#003049"/>
      <stop offset="100%" style="stop-color:#001F33"/>
    </linearGradient>
  </defs>
  
  <!-- Cosmos blue background -->
  <rect width="100" height="100" rx="22" fill="url(#bgCosmos)"/>
  
  <!-- Letter G - Clean version -->
  <g transform="translate(18, 15)">
    <path d="M32 0C14.3 0 0 14.3 0 32C0 49.7 14.3 64 32 64C38.5 64 44.5 62.2 49.5 59V36H28V46H39.5V51.5C37.2 52.5 34.7 53 32 53C18.7 53 10 43.5 10 32C10 18.7 20.5 10 32 10C41.5 10 49.5 15.5 53 23.5L62 17.5C56 6.8 45 0 32 0Z" 
          fill="#FDF0D5"/>
  </g>
</svg>`;

// White icon variant
export const logoIconWhiteSvg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- White background -->
  <rect width="100" height="100" rx="22" fill="white"/>
  
  <!-- Letter G - Clean version -->
  <g transform="translate(18, 15)">
    <path d="M32 0C14.3 0 0 14.3 0 32C0 49.7 14.3 64 32 64C38.5 64 44.5 62.2 49.5 59V36H28V46H39.5V51.5C37.2 52.5 34.7 53 32 53C18.7 53 10 43.5 10 32C10 18.7 20.5 10 32 10C41.5 10 49.5 15.5 53 23.5L62 17.5C56 6.8 45 0 32 0Z" 
          fill="#C1121F"/>
  </g>
</svg>`;

// ============================================
// COLOR PALETTE EXPORTS
// ============================================
export const ColorPalette = {
  // Gochujang Warm Palette (Primary/Default)
  gochujang: {
    primary: '#C1121F', // Crimson Blaze
    primaryDark: '#780000', // Gochujang Red
    secondary: '#FDF0D5', // Varden Cream
    secondaryDark: '#F5E6C3', // Warm Beige
    accent: '#003049', // Cosmos Blue
    accentLight: '#669BBC', // Blue Marble
    text: '#780000',
    textLight: '#003049',
    white: '#FFFFFF',
  },
};

// Default color palette - Gochujang Warm
export const Colors = ColorPalette.gochujang;

// Default exports - Gochujang style
export const logoIconSvg = logoGochujangSvg;

// Logo image path (for use with Image component)
export const logoImagePath = require('./logo.png');
