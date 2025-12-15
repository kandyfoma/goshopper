#!/bin/bash

# Android Release Build Script for GoShopper AI
# This script generates a signed AAB (Android App Bundle) for Play Store submission

set -e  # Exit on error

echo "================================================"
echo "  GoShopper AI - Android Release Build"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="GoShopper AI"
BUILD_DIR="android/app/build/outputs/bundle/release"
KEYSTORE_PATH="android/app/release.keystore"
AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"

echo "📋 Pre-flight checks..."

# Check for Java
if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ Error: Java is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Java found: $(java -version 2>&1 | head -n 1)${NC}"

# Check for Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${YELLOW}⚠️  Warning: ANDROID_HOME not set${NC}"
    echo "Attempting to use default location..."
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
        echo -e "${GREEN}✓ Found Android SDK at $ANDROID_HOME${NC}"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
        echo -e "${GREEN}✓ Found Android SDK at $ANDROID_HOME${NC}"
    else
        echo -e "${RED}❌ Error: Android SDK not found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Environment checks passed${NC}"
echo ""

# Step 1: Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean
cd ..
echo -e "${GREEN}✓ Clean complete${NC}"
echo ""

# Step 2: Install dependencies
echo "📦 Installing npm dependencies..."
npm install
echo -e "${GREEN}✓ npm install complete${NC}"
echo ""

# Step 3: Version check
echo "📱 Current version information:"
VERSION_NAME=$(grep "versionName" android/app/build.gradle | awk '{print $2}' | tr -d '"')
VERSION_CODE=$(grep "versionCode" android/app/build.gradle | awk '{print $2}')
echo "   Version Name: ${VERSION_NAME}"
echo "   Version Code: ${VERSION_CODE}"
echo ""

read -p "Is this version correct? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Please update version in android/app/build.gradle${NC}"
    exit 1
fi

# Step 4: Keystore check
echo "🔑 Checking for release keystore..."
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo -e "${YELLOW}⚠️  Release keystore not found${NC}"
    echo ""
    echo "Do you want to generate a new keystore? (y/n)"
    read -p "> " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "Creating release keystore..."
        echo -e "${BLUE}Please provide the following information:${NC}"
        
        keytool -genkeypair -v \
            -storetype PKCS12 \
            -keystore $KEYSTORE_PATH \
            -alias goshopperai-release \
            -keyalg RSA \
            -keysize 2048 \
            -validity 10000
        
        echo -e "${GREEN}✓ Keystore created${NC}"
        echo ""
        echo -e "${YELLOW}IMPORTANT: Store the keystore and password securely!${NC}"
        echo "Location: $KEYSTORE_PATH"
        echo ""
    else
        echo -e "${RED}❌ Cannot proceed without keystore${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Keystore found at $KEYSTORE_PATH${NC}"
fi

echo ""

# Step 5: Signing configuration check
echo "🔐 Checking signing configuration..."
if [ ! -f "android/gradle.properties" ]; then
    echo -e "${YELLOW}⚠️  gradle.properties not found${NC}"
    echo "Creating gradle.properties template..."
    cat > android/gradle.properties << EOF
# Signing Config
GOSHOPPER_UPLOAD_STORE_FILE=release.keystore
GOSHOPPER_UPLOAD_KEY_ALIAS=goshopperai-release
GOSHOPPER_UPLOAD_STORE_PASSWORD=<your-keystore-password>
GOSHOPPER_UPLOAD_KEY_PASSWORD=<your-key-password>

# Gradle
org.gradle.jvmargs=-Xmx2048m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true
EOF
    echo -e "${YELLOW}Please edit android/gradle.properties with your keystore passwords${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Signing configuration found${NC}"
echo ""

# Step 6: Build release AAB
echo "🔨 Building release AAB..."
echo "This may take several minutes..."
cd android
./gradlew bundleRelease

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful!${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    cd ..
    exit 1
fi

cd ..
echo ""

# Step 7: Verify AAB
if [ -f "$AAB_PATH" ]; then
    echo -e "${GREEN}✓ AAB file created successfully${NC}"
    AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
    echo "   Size: ${AAB_SIZE}"
    echo "   Location: ${AAB_PATH}"
else
    echo -e "${RED}❌ AAB file not found${NC}"
    exit 1
fi

echo ""

# Step 8: Build Info
echo "================================================"
echo "  Build Complete!"
echo "================================================"
echo ""
echo "Release AAB: $AAB_PATH"
echo "Size: $AAB_SIZE"
echo ""
echo "Next steps:"
echo "1. Go to Google Play Console"
echo "2. Select your app"
echo "3. Production → Create new release"
echo "4. Upload the AAB file"
echo "5. Add release notes"
echo "6. Review and rollout"
echo ""
echo -e "${BLUE}Testing the AAB locally:${NC}"
echo "bundletool build-apks --bundle=$AAB_PATH --output=app.apks"
echo "bundletool install-apks --apks=app.apks"
echo ""
echo -e "${GREEN}✓ Ready for Play Store submission!${NC}"
