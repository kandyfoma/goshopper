/**
 * App Icon Generator Script
 * 
 * This script generates PNG app icons from SVG for both
 * Google Play Console and Apple App Store submission.
 * 
 * Urbanist Soft Pastel color scheme
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
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Icon sizes needed for submission
  const iconSizes = {
    // Google Play Console
    'play-store-512': 512,
    'play-store-192': 192,
    'play-store-144': 144,
    'play-store-96': 96,
    'play-store-72': 72,
    'play-store-48': 48,
    
    // Apple App Store
    'app-store-1024': 1024,
    'iphone-180': 180,
    'iphone-120': 120,
    'iphone-60': 60,
    'ipad-167': 167,
    'ipad-152': 152,
    'ipad-76': 76,
    
    // Android adaptive icons
    'android-foreground-432': 432,
    'android-foreground-324': 324,
    'android-foreground-216': 216,
    'android-foreground-162': 162,
    'android-foreground-108': 108,
  };

  // Color palette - Urbanist Soft Pastel
  const colors = {
    aliceBlue: '#D8DFE9',
    honeydew: '#CFDECA',
    vanilla: '#EFF0A3',
    eerieBlack: '#212121',
    ghostWhite: '#F6F5FA',
  };

  // Generate SVG with Urbanist solid background (no search icon)
  const generateSvg = () => `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Solid background color -->
  <rect width="100" height="100" rx="22" fill="${colors.aliceBlue}"/>
  
  <!-- Clean G letter without search -->
  <g transform="translate(25, 20)">
    <path d="M32 0C14.3 0 0 14.3 0 32C0 49.7 14.3 60 32 60C38 60 43.5 58.5 48 55.8V35H30V45H38V49C36.2 49.8 34.2 50 32 50C20 50 10 42 10 32C10 20 20 10 32 10C40 10 47 14.5 50 21L58 16C53 6.5 43.5 0 32 0Z" 
          fill="${colors.eerieBlack}"/>
  </g>
</svg>`;

  try {
    const sharp = require('sharp');
    
    console.log('🎨 Generating PNG icons (Urbanist Soft Pastel)...\n');
    
    const colorDir = path.join(outputDir, 'urbanist');
    if (!fs.existsSync(colorDir)) {
      fs.mkdirSync(colorDir, { recursive: true });
    }
    
    const svg = generateSvg();
    
    // Save SVG
    fs.writeFileSync(path.join(colorDir, 'logo-source.svg'), svg);
    
    console.log('📁 URBANIST SOFT PASTEL');
    console.log('─'.repeat(40));
    
    for (const [name, size] of Object.entries(iconSizes)) {
      const outputPath = path.join(colorDir, `${name}.png`);
      
      await sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`   ✓ ${name}.png (${size}x${size})`);
    }
    
    console.log(`\n${'═'.repeat(50)}`);
    console.log('✅ ALL ICONS GENERATED SUCCESSFULLY!');
    console.log('═'.repeat(50));
    console.log(`\n📂 Output folder: ${outputDir}/urbanist\n`);
    console.log('📱 For Google Play Console:');
    console.log('   Use urbanist/play-store-512.png\n');
    console.log('🍎 For Apple App Store:');
    console.log('   Use urbanist/app-store-1024.png\n');
    
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('\n⚠️  sharp module not found.');
      console.log('Install it with: npm install sharp');
    } else {
      throw err;
    }
  }
}

generateIcons().catch(console.error);
