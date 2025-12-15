#!/bin/bash

# iOS Release Build Script for GoShopper AI
# This script prepares and builds the iOS app for App Store submission

set -e  # Exit on error

echo "================================================"
echo "  GoShopper AI - iOS Release Build"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="GoShopper AI"
SCHEME="goshopperai"
WORKSPACE="ios/goshopperai.xcworkspace"
CONFIGURATION="Release"
BUILD_DIR="ios/build"

echo "📋 Pre-flight checks..."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Error: iOS builds require macOS${NC}"
    exit 1
fi

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Error: Xcode is not installed${NC}"
    exit 1
fi

# Check if CocoaPods is installed
if ! command -v pod &> /dev/null; then
    echo -e "${RED}❌ Error: CocoaPods is not installed${NC}"
    echo "Install with: sudo gem install cocoapods"
    exit 1
fi

echo -e "${GREEN}✓ Environment checks passed${NC}"
echo ""

# Step 1: Clean previous builds
echo "🧹 Cleaning previous builds..."
cd ios
xcodebuild clean -workspace ${WORKSPACE} -scheme ${SCHEME} -configuration ${CONFIGURATION}
rm -rf ${BUILD_DIR}
cd ..
echo -e "${GREEN}✓ Clean complete${NC}"
echo ""

# Step 2: Install dependencies
echo "📦 Installing npm dependencies..."
npm install
echo -e "${GREEN}✓ npm install complete${NC}"
echo ""

# Step 3: Install pods
echo "📦 Installing CocoaPods dependencies..."
cd ios
pod install
cd ..
echo -e "${GREEN}✓ pod install complete${NC}"
echo ""

# Step 4: Version check
echo "📱 Current version information:"
VERSION=$(grep -A 1 "CFBundleShortVersionString" ios/goshopperai/Info.plist | tail -1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/')
BUILD=$(grep -A 1 "CFBundleVersion" ios/goshopperai/Info.plist | tail -1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/')
echo "   Version: ${VERSION}"
echo "   Build: ${BUILD}"
echo ""

read -p "Is this version correct? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Please update version in ios/goshopperai/Info.plist${NC}"
    exit 1
fi

# Step 5: Build for archive
echo "🔨 Building iOS app..."
echo "This may take several minutes..."
cd ios
xcodebuild archive \
    -workspace ${WORKSPACE} \
    -scheme ${SCHEME} \
    -configuration ${CONFIGURATION} \
    -archivePath ${BUILD_DIR}/${SCHEME}.xcarchive \
    CODE_SIGN_IDENTITY="iPhone Distribution" \
    PROVISIONING_PROFILE_SPECIFIER="GoShopper AI Distribution"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful!${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

cd ..
echo ""

# Step 6: Archive info
echo "================================================"
echo "  Build Complete!"
echo "================================================"
echo ""
echo "Archive location: ios/build/${SCHEME}.xcarchive"
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Window → Organizer"
echo "3. Select the archive"
echo "4. Click 'Distribute App'"
echo "5. Choose 'App Store Connect'"
echo "6. Follow the upload wizard"
echo ""
echo "Or run: open ios/build/${SCHEME}.xcarchive"
echo ""
echo -e "${GREEN}✓ Ready for App Store submission!${NC}"
