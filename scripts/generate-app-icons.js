/**
 * App Icon Generator Script
 *
 * This script generates PNG app icons from SVG for both
 * Google Play Console and Apple App Store submission.
 *
 * Gochujang Warm Color Palette (Clean G Logo)
 *
 * Requirements:
 * - Node.js
 * - sharp (npm install sharp)
 *
 * Usage: node scripts/generate-app-icons.js
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const outputDir = path.join(__dirname, '..', 'app-icons');
  const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  const iosAssetsDir = path.join(__dirname, '..', 'ios', 'goshopperai', 'Images.xcassets', 'AppIcon.appiconset');

  // Create output directories
  [outputDir, iosAssetsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true});
    }
  });

  // Android mipmap directories
  const androidMipmapDirs = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi',
  ];

  androidMipmapDirs.forEach(dir => {
    const fullPath = path.join(androidResDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, {recursive: true});
    }
  });

  // Icon sizes for different platforms
  const iconSizes = {
    // Google Play Console
    'play-store-512': 512,
    'play-store-192': 192,
    'play-store-144': 144,
    'play-store-96': 96,
    'play-store-72': 72,
    'play-store-48': 48,

    // Apple App Store & iOS
    'app-store-1024': 1024,
    'iphone-180': 180,      // iPhone @3x
    'iphone-120': 120,      // iPhone @2x
    'iphone-60': 60,        // iPhone @1x
    'ipad-167': 167,        // iPad Pro
    'ipad-152': 152,        // iPad @2x
    'ipad-76': 76,          // iPad @1x
    'spotlight-120': 120,   // Spotlight @3x
    'spotlight-80': 80,     // Spotlight @2x
    'spotlight-40': 40,     // Spotlight @1x
    'settings-87': 87,      // Settings @3x
    'settings-58': 58,      // Settings @2x
    'settings-29': 29,      // Settings @1x
    'notification-60': 60,  // Notification @3x
    'notification-40': 40,  // Notification @2x
    'notification-20': 20,  // Notification @1x
  };

  // Android specific sizes
  const androidSizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
  };

  // Android adaptive icon foreground sizes (with safe zone padding)
  const androidAdaptiveSizes = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432,
  };

  // Gochujang Warm Color Palette
  const colors = {
    gochujangRed: '#780000',
    crimsonBlaze: '#C1121F',
    cosmosBlue: '#003049',
    blueMarble: '#669BBC',
    vardenCream: '#FDF0D5',
    warmBeige: '#F5E6C3',
    white: '#FFFFFF',
  };

  // Generate main app icon SVG (rounded corners for iOS/Play Store)
  const generateMainIconSvg = () => `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGochujang" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.crimsonBlaze}"/>
      <stop offset="100%" style="stop-color:${colors.gochujangRed}"/>
    </linearGradient>
  </defs>
  
  <!-- Background with warm red gradient -->
  <rect width="100" height="100" fill="url(#bgGochujang)"/>
  
  <!-- Letter G - Clean version centered -->
  <g transform="translate(18, 15)">
    <path d="M32 0C14.3 0 0 14.3 0 32C0 49.7 14.3 64 32 64C38.5 64 44.5 62.2 49.5 59V36H28V46H39.5V51.5C37.2 52.5 34.7 53 32 53C18.7 53 10 43.5 10 32C10 18.7 20.5 10 32 10C41.5 10 49.5 15.5 53 23.5L62 17.5C56 6.8 45 0 32 0Z" 
          fill="${colors.vardenCream}"/>
  </g>
</svg>`;

  // Generate Android adaptive icon foreground (with padding for safe zone)
  const generateAdaptiveForegroundSvg = () => `<svg width="108" height="108" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <!-- Letter G centered in safe zone (18px padding on each side) -->
  <g transform="translate(27, 22)">
    <path d="M27 0C12.1 0 0 12.1 0 27C0 41.9 12.1 54 27 54C32.5 54 37.5 52.5 41.7 49.8V30.4H23.6V38.8H33.3V43.5C31.4 44.3 29.3 44.8 27 44.8C15.8 44.8 8.5 36.8 8.5 27C8.5 15.8 17.3 8.5 27 8.5C35 8.5 41.8 13.1 44.8 19.8L52.4 14.8C47.3 5.7 38 0 27 0Z" 
          fill="${colors.vardenCream}"/>
  </g>
</svg>`;

  // Generate Android adaptive icon background
  const generateAdaptiveBackgroundSvg = () => `<svg width="108" height="108" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgAdaptive" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.crimsonBlaze}"/>
      <stop offset="100%" style="stop-color:${colors.gochujangRed}"/>
    </linearGradient>
  </defs>
  <rect width="108" height="108" fill="url(#bgAdaptive)"/>
</svg>`;

  try {
    const sharp = require('sharp');

    console.log('🎨 Generating App Icons (Gochujang Clean G Logo)...\n');

    const gochujangDir = path.join(outputDir, 'gochujang');
    if (!fs.existsSync(gochujangDir)) {
      fs.mkdirSync(gochujangDir, {recursive: true});
    }

    const mainSvg = generateMainIconSvg();
    const foregroundSvg = generateAdaptiveForegroundSvg();
    const backgroundSvg = generateAdaptiveBackgroundSvg();

    // Save source SVGs
    fs.writeFileSync(path.join(gochujangDir, 'logo-source.svg'), mainSvg);
    fs.writeFileSync(path.join(gochujangDir, 'ic_launcher_foreground.svg'), foregroundSvg);
    fs.writeFileSync(path.join(gochujangDir, 'ic_launcher_background.svg'), backgroundSvg);

    console.log('📁 GOCHUJANG CLEAN G LOGO');
    console.log('─'.repeat(50));

    // Generate general icons
    for (const [name, size] of Object.entries(iconSizes)) {
      const outputPath = path.join(gochujangDir, `${name}.png`);
      await sharp(Buffer.from(mainSvg)).resize(size, size).png().toFile(outputPath);
      console.log(`   ✓ ${name}.png (${size}x${size})`);
    }

    console.log('\n📱 ANDROID MIPMAP ICONS');
    console.log('─'.repeat(50));

    // Generate Android mipmap icons
    for (const [dir, size] of Object.entries(androidSizes)) {
      const outputPath = path.join(androidResDir, dir, 'ic_launcher.png');
      await sharp(Buffer.from(mainSvg)).resize(size, size).png().toFile(outputPath);
      console.log(`   ✓ ${dir}/ic_launcher.png (${size}x${size})`);

      // Also generate round version
      const roundOutputPath = path.join(androidResDir, dir, 'ic_launcher_round.png');
      await sharp(Buffer.from(mainSvg)).resize(size, size).png().toFile(roundOutputPath);
      console.log(`   ✓ ${dir}/ic_launcher_round.png (${size}x${size})`);
    }

    console.log('\n🔲 ANDROID ADAPTIVE ICONS');
    console.log('─'.repeat(50));

    // Generate Android adaptive icon foreground and background
    for (const [dir, size] of Object.entries(androidAdaptiveSizes)) {
      const fgOutputPath = path.join(androidResDir, dir, 'ic_launcher_foreground.png');
      await sharp(Buffer.from(foregroundSvg)).resize(size, size).png().toFile(fgOutputPath);
      console.log(`   ✓ ${dir}/ic_launcher_foreground.png (${size}x${size})`);

      const bgOutputPath = path.join(androidResDir, dir, 'ic_launcher_background.png');
      await sharp(Buffer.from(backgroundSvg)).resize(size, size).png().toFile(bgOutputPath);
      console.log(`   ✓ ${dir}/ic_launcher_background.png (${size}x${size})`);
    }

    console.log('\n🍎 IOS APP ICONS');
    console.log('─'.repeat(50));

    // iOS icon sizes with filenames
    const iosIconSizes = [
      {size: 20, scales: [1, 2, 3], idiom: 'iphone'},
      {size: 29, scales: [1, 2, 3], idiom: 'iphone'},
      {size: 40, scales: [2, 3], idiom: 'iphone'},
      {size: 60, scales: [2, 3], idiom: 'iphone'},
      {size: 20, scales: [1, 2], idiom: 'ipad'},
      {size: 29, scales: [1, 2], idiom: 'ipad'},
      {size: 40, scales: [1, 2], idiom: 'ipad'},
      {size: 76, scales: [1, 2], idiom: 'ipad'},
      {size: 83.5, scales: [2], idiom: 'ipad'},
      {size: 1024, scales: [1], idiom: 'ios-marketing'},
    ];

    const contentsJson = {
      images: [],
      info: {version: 1, author: 'xcode'},
    };

    for (const icon of iosIconSizes) {
      for (const scale of icon.scales) {
        const pixelSize = Math.round(icon.size * scale);
        const filename = `icon-${icon.size}@${scale}x.png`;
        const outputPath = path.join(iosAssetsDir, filename);

        await sharp(Buffer.from(mainSvg)).resize(pixelSize, pixelSize).png().toFile(outputPath);
        console.log(`   ✓ ${filename} (${pixelSize}x${pixelSize})`);

        contentsJson.images.push({
          size: `${icon.size}x${icon.size}`,
          idiom: icon.idiom,
          filename: filename,
          scale: `${scale}x`,
        });
      }
    }

    // Write Contents.json for iOS
    fs.writeFileSync(
      path.join(iosAssetsDir, 'Contents.json'),
      JSON.stringify(contentsJson, null, 2)
    );
    console.log('   ✓ Contents.json');

    console.log(`\n${'═'.repeat(50)}`);
    console.log('✅ ALL ICONS GENERATED SUCCESSFULLY!');
    console.log('═'.repeat(50));
    console.log(`\n📂 Output locations:`);
    console.log(`   - General: ${gochujangDir}`);
    console.log(`   - Android: ${androidResDir}`);
    console.log(`   - iOS: ${iosAssetsDir}`);
    console.log('\n📱 For Google Play Console:');
    console.log('   Use gochujang/play-store-512.png\n');
    console.log('🍎 For Apple App Store:');
    console.log('   Use gochujang/app-store-1024.png\n');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('\n⚠️  sharp module not found.');
      console.log('Install it with: npm install sharp --save-dev');
      console.log('Then run: node scripts/generate-app-icons.js');
    } else {
      throw err;
    }
  }
}

generateIcons().catch(console.error);
