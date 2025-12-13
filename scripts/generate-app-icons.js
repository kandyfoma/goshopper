/**
 * Generate App Icons Script
 * Converts SVG logo to PNG icons for Android and iOS
 * 
 * Requirements:
 * - Node.js
 * - sharp (npm install sharp)
 * - @resvg/resvg-js (npm install @resvg/resvg-js)
 * 
 * Usage:
 * node scripts/generate-app-icons.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {Resvg} = require('@resvg/resvg-js');

// SVG Logo from assets/logo-icon.ts
const logoSvg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGochujang" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#C1121F"/>
      <stop offset="100%" style="stop-color:#780000"/>
    </linearGradient>
  </defs>
  
  <!-- Background with warm red gradient -->
  <rect width="100" height="100" rx="22" fill="url(#bgGochujang)"/>
  
  <!-- Letter G - Scaled down and centered for app icon -->
  <g transform="translate(25, 22) scale(0.78)">
    <path d="M32 0C14.3 0 0 14.3 0 32C0 49.7 14.3 64 32 64C38.5 64 44.5 62.2 49.5 59V36H28V46H39.5V51.5C37.2 52.5 34.7 53 32 53C18.7 53 10 43.5 10 32C10 18.7 20.5 10 32 10C41.5 10 49.5 15.5 53 23.5L62 17.5C56 6.8 45 0 32 0Z" 
          fill="#FDF0D5"/>
  </g>
</svg>`;

// Android icon sizes (mipmap)
const ANDROID_SIZES = [
  { size: 48, density: 'mdpi', folder: 'mipmap-mdpi' },
  { size: 72, density: 'hdpi', folder: 'mipmap-hdpi' },
  { size: 96, density: 'xhdpi', folder: 'mipmap-xhdpi' },
  { size: 144, density: 'xxhdpi', folder: 'mipmap-xxhdpi' },
  { size: 192, density: 'xxxhdpi', folder: 'mipmap-xxxhdpi' },
];

// iOS icon sizes (AppIcon.appiconset)
const IOS_SIZES = [
  // iPhone Notification (iOS 7-15)
  { size: 40, scale: 2, idiom: 'iphone', name: 'Icon-40@2x.png' },
  { size: 60, scale: 3, idiom: 'iphone', name: 'Icon-60@3x.png' },
  
  // iPhone Settings
  { size: 58, scale: 2, idiom: 'iphone', name: 'Icon-Small@2x.png' },
  { size: 87, scale: 3, idiom: 'iphone', name: 'Icon-Small@3x.png' },
  
  // iPhone Spotlight
  { size: 80, scale: 2, idiom: 'iphone', name: 'Icon-Small-40@2x.png' },
  { size: 120, scale: 3, idiom: 'iphone', name: 'Icon-Small-40@3x.png' },
  
  // iPhone App
  { size: 120, scale: 2, idiom: 'iphone', name: 'Icon-60@2x.png' },
  { size: 180, scale: 3, idiom: 'iphone', name: 'Icon-60@3x.png' },
  
  // App Store
  { size: 1024, scale: 1, idiom: 'ios-marketing', name: 'Icon-1024.png' },
];

const PROJECT_ROOT = path.join(__dirname, '..');
const ANDROID_RES_PATH = path.join(PROJECT_ROOT, 'android/app/src/main/res');
const IOS_IMAGES_PATH = path.join(PROJECT_ROOT, 'ios/goshopperai/Images.xcassets/AppIcon.appiconset');

/**
 * Convert SVG to PNG buffer at specified size
 */
async function svgToPng(svgString, size) {
  try {
    // Render SVG to PNG using resvg
    const resvg = new Resvg(svgString, {
      fitTo: {
        mode: 'width',
        value: size,
      },
    });
    
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    
    // Use sharp to ensure exact size and optimize
    return await sharp(pngBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ quality: 100, compressionLevel: 9 })
      .toBuffer();
  } catch (error) {
    console.error(`Error converting SVG to PNG (size: ${size}):`, error.message);
    throw error;
  }
}

/**
 * Generate Android icons
 */
async function generateAndroidIcons() {
  console.log('\n📱 Generating Android Icons...\n');
  
  for (const { size, density, folder } of ANDROID_SIZES) {
    const folderPath = path.join(ANDROID_RES_PATH, folder);
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    const iconPath = path.join(folderPath, 'ic_launcher.png');
    const roundIconPath = path.join(folderPath, 'ic_launcher_round.png');
    
    try {
      const pngBuffer = await svgToPng(logoSvg, size);
      
      // Save standard icon
      fs.writeFileSync(iconPath, pngBuffer);
      console.log(`✅ Generated ${density} (${size}x${size}): ic_launcher.png`);
      
      // Save round icon (same image for now)
      fs.writeFileSync(roundIconPath, pngBuffer);
      console.log(`✅ Generated ${density} round (${size}x${size}): ic_launcher_round.png`);
    } catch (error) {
      console.error(`❌ Failed to generate ${density} icon:`, error.message);
    }
  }
}

/**
 * Generate iOS icons
 */
async function generateIOSIcons() {
  console.log('\n🍎 Generating iOS Icons...\n');
  
  // Create AppIcon.appiconset folder if it doesn't exist
  if (!fs.existsSync(IOS_IMAGES_PATH)) {
    fs.mkdirSync(IOS_IMAGES_PATH, { recursive: true });
  }
  
  const contentsJson = {
    images: [],
    info: {
      author: 'xcode',
      version: 1
    }
  };
  
  for (const { size, scale, idiom, name } of IOS_SIZES) {
    const iconPath = path.join(IOS_IMAGES_PATH, name);
    
    try {
      const pngBuffer = await svgToPng(logoSvg, size);
      fs.writeFileSync(iconPath, pngBuffer);
      console.log(`✅ Generated ${idiom} ${size}x${size} @${scale}x: ${name}`);
      
      // Add to Contents.json
      contentsJson.images.push({
        filename: name,
        idiom: idiom,
        scale: `${scale}x`,
        size: idiom === 'ios-marketing' ? '1024x1024' : `${size / scale}x${size / scale}`
      });
    } catch (error) {
      console.error(`❌ Failed to generate iOS icon ${name}:`, error.message);
    }
  }
  
  // Save Contents.json
  const contentsJsonPath = path.join(IOS_IMAGES_PATH, 'Contents.json');
  fs.writeFileSync(contentsJsonPath, JSON.stringify(contentsJson, null, 2));
  console.log(`\n✅ Generated Contents.json`);
}

/**
 * Generate adaptive icon for Android (API 26+)
 */
async function generateAndroidAdaptiveIcons() {
  console.log('\n🎨 Generating Android Adaptive Icons...\n');
  
  const drawablePath = path.join(ANDROID_RES_PATH, 'drawable');
  if (!fs.existsSync(drawablePath)) {
    fs.mkdirSync(drawablePath, { recursive: true });
  }
  
  // Foreground vector drawable
  const foregroundVectorXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
  <path
      android:pathData="M54,22 C36.3,22 22,36.3 22,54 C22,71.7 36.3,86 54,86 C60.5,86 66.5,84.2 71.5,81 L71.5,58 L50,58 L50,68 L61.5,68 L61.5,73.5 C59.2,74.5 56.7,75 54,75 C40.7,75 32,65.5 32,54 C32,40.7 42.5,32 54,32 C63.5,32 71.5,37.5 75,45.5 L84,39.5 C78,28.8 67,22 54,22 Z"
      android:fillColor="#FDF0D5"/>
</vector>`;

  // Background vector drawable
  const backgroundVectorXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
  <path
      android:pathData="M0,0h108v108h-108z"
      android:fillColor="#C1121F"/>
</vector>`;

  const foregroundXml = path.join(drawablePath, 'ic_launcher_foreground.xml');
  const backgroundXml = path.join(drawablePath, 'ic_launcher_background.xml');
  
  fs.writeFileSync(foregroundXml, foregroundVectorXml);
  fs.writeFileSync(backgroundXml, backgroundVectorXml);
  
  console.log(`✅ Generated adaptive icon foreground`);
  console.log(`✅ Generated adaptive icon background`);
  
  // Adaptive icon config
  const anydpiPath = path.join(ANDROID_RES_PATH, 'mipmap-anydpi-v26');
  if (!fs.existsSync(anydpiPath)) {
    fs.mkdirSync(anydpiPath, { recursive: true });
  }
  
  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>`;

  const icLauncherXml = path.join(anydpiPath, 'ic_launcher.xml');
  const icLauncherRoundXml = path.join(anydpiPath, 'ic_launcher_round.xml');
  
  fs.writeFileSync(icLauncherXml, adaptiveIconXml);
  fs.writeFileSync(icLauncherRoundXml, adaptiveIconXml);
  
  console.log(`✅ Generated adaptive icon config`);
}

/**
 * Main function
 */
async function main() {
  console.log('🎨 GoShopperAI App Icon Generator\n');
  console.log('='.repeat(50));
  
  try {
    // Check if sharp and resvg are installed
    try {
      require.resolve('sharp');
      require.resolve('@resvg/resvg-js');
    } catch (error) {
      console.error('\n❌ Missing dependencies!');
      console.error('Please install required packages:');
      console.error('npm install sharp @resvg/resvg-js\n');
      process.exit(1);
    }
    
    // Generate all icons
    await generateAndroidIcons();
    await generateAndroidAdaptiveIcons();
    await generateIOSIcons();
    
    console.log('\n' + '='.repeat(50));
    console.log('\n✨ Icon generation complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Rebuild your Android app: cd android && ./gradlew clean');
    console.log('   2. Rebuild your iOS app: cd ios && pod install');
    console.log('   3. Run: npx react-native run-android (or run-ios)\n');
    
  } catch (error) {
    console.error('\n❌ Icon generation failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { svgToPng, generateAndroidIcons, generateIOSIcons };
