// Icon Generator Script for GoShopperAI
// Generates all required Android and iOS app icons from a 1024x1024 source image

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_ICON = path.join(__dirname, '..', 'temp-logo', '1024x1024.png');
const ANDROID_RES_PATH = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const IOS_ASSETS_PATH = path.join(__dirname, '..', 'ios', 'goshopperai', 'Images.xcassets', 'AppIcon.appiconset');

// Android icon sizes (density -> size in pixels)
const ANDROID_ICONS = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// iOS icon sizes (filename -> size in pixels)
const IOS_ICONS = [
  { name: 'Icon-20', size: 20 },
  { name: 'Icon-20@2x', size: 40 },
  { name: 'Icon-20@3x', size: 60 },
  { name: 'Icon-29', size: 29 },
  { name: 'Icon-29@2x', size: 58 },
  { name: 'Icon-29@3x', size: 87 },
  { name: 'Icon-40', size: 40 },
  { name: 'Icon-40@2x', size: 80 },
  { name: 'Icon-40@3x', size: 120 },
  { name: 'Icon-60@2x', size: 120 },
  { name: 'Icon-60@3x', size: 180 },
  { name: 'Icon-76', size: 76 },
  { name: 'Icon-76@2x', size: 152 },
  { name: 'Icon-83.5@2x', size: 167 },
  { name: 'Icon-1024', size: 1024 },
];

async function generateAndroidIcons() {
  console.log('🤖 Generating Android icons...');
  
  for (const [folder, size] of Object.entries(ANDROID_ICONS)) {
    const outputPath = path.join(ANDROID_RES_PATH, folder);
    
    // Ensure directory exists
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    // Generate square icon
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(path.join(outputPath, 'ic_launcher.png'));
    
    // Generate round icon (with circular mask)
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(path.join(outputPath, 'ic_launcher_round.png'));
    
    console.log(`  ✅ ${folder}: ${size}x${size}px`);
  }
  
  // Generate adaptive icon foreground (with padding for safe zone)
  const adaptivePath = path.join(ANDROID_RES_PATH, 'mipmap-xxxhdpi');
  await sharp(SOURCE_ICON)
    .resize(432, 432) // 192 * 2.25 for adaptive icon foreground
    .extend({
      top: 108,
      bottom: 108,
      left: 108,
      right: 108,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .resize(432, 432)
    .png()
    .toFile(path.join(adaptivePath, 'ic_launcher_foreground.png'));
  
  console.log('  ✅ Adaptive icon foreground generated');
}

async function generateiOSIcons() {
  console.log('🍎 Generating iOS icons...');
  
  // Ensure directory exists
  if (!fs.existsSync(IOS_ASSETS_PATH)) {
    fs.mkdirSync(IOS_ASSETS_PATH, { recursive: true });
  }
  
  for (const icon of IOS_ICONS) {
    await sharp(SOURCE_ICON)
      .resize(icon.size, icon.size)
      .png()
      .toFile(path.join(IOS_ASSETS_PATH, `${icon.name}.png`));
    
    console.log(`  ✅ ${icon.name}.png: ${icon.size}x${icon.size}px`);
  }
  
  // Generate Contents.json for iOS
  const contentsJson = {
    images: [
      { filename: 'Icon-20@2x.png', idiom: 'iphone', scale: '2x', size: '20x20' },
      { filename: 'Icon-20@3x.png', idiom: 'iphone', scale: '3x', size: '20x20' },
      { filename: 'Icon-29@2x.png', idiom: 'iphone', scale: '2x', size: '29x29' },
      { filename: 'Icon-29@3x.png', idiom: 'iphone', scale: '3x', size: '29x29' },
      { filename: 'Icon-40@2x.png', idiom: 'iphone', scale: '2x', size: '40x40' },
      { filename: 'Icon-40@3x.png', idiom: 'iphone', scale: '3x', size: '40x40' },
      { filename: 'Icon-60@2x.png', idiom: 'iphone', scale: '2x', size: '60x60' },
      { filename: 'Icon-60@3x.png', idiom: 'iphone', scale: '3x', size: '60x60' },
      { filename: 'Icon-20.png', idiom: 'ipad', scale: '1x', size: '20x20' },
      { filename: 'Icon-20@2x.png', idiom: 'ipad', scale: '2x', size: '20x20' },
      { filename: 'Icon-29.png', idiom: 'ipad', scale: '1x', size: '29x29' },
      { filename: 'Icon-29@2x.png', idiom: 'ipad', scale: '2x', size: '29x29' },
      { filename: 'Icon-40.png', idiom: 'ipad', scale: '1x', size: '40x40' },
      { filename: 'Icon-40@2x.png', idiom: 'ipad', scale: '2x', size: '40x40' },
      { filename: 'Icon-76.png', idiom: 'ipad', scale: '1x', size: '76x76' },
      { filename: 'Icon-76@2x.png', idiom: 'ipad', scale: '2x', size: '76x76' },
      { filename: 'Icon-83.5@2x.png', idiom: 'ipad', scale: '2x', size: '83.5x83.5' },
      { filename: 'Icon-1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024' },
    ],
    info: { author: 'xcode', version: 1 },
  };
  
  fs.writeFileSync(
    path.join(IOS_ASSETS_PATH, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2)
  );
  
  console.log('  ✅ Contents.json generated');
}

async function main() {
  console.log('🚀 Starting icon generation for GoShopperAI...\n');
  console.log(`📁 Source: ${SOURCE_ICON}\n`);
  
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error('❌ Source icon not found:', SOURCE_ICON);
    process.exit(1);
  }
  
  try {
    await generateAndroidIcons();
    console.log('');
    await generateiOSIcons();
    console.log('\n✨ All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

main();
