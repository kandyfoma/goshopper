# Android Release Build Script for GoShopper AI (PowerShell)
# This script generates a signed AAB for Play Store submission

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  GoShopper AI - Android Release Build" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$APP_NAME = "GoShopper AI"
$BUILD_DIR = "android\app\build\outputs\bundle\release"
$KEYSTORE_PATH = "android\app\release.keystore"
$AAB_PATH = "android\app\build\outputs\bundle\release\app-release.aab"

Write-Host "📋 Pre-flight checks..." -ForegroundColor Yellow

# Check for Java
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "✓ Java found: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Java is not installed" -ForegroundColor Red
    exit 1
}

# Check for Android SDK
if (-not $env:ANDROID_HOME) {
    Write-Host "⚠️  Warning: ANDROID_HOME not set" -ForegroundColor Yellow
    Write-Host "Attempting to use default location..."
    
    $androidSdkPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk",
        "C:\Android\Sdk"
    )
    
    $foundSdk = $false
    foreach ($path in $androidSdkPaths) {
        if (Test-Path $path) {
            $env:ANDROID_HOME = $path
            Write-Host "✓ Found Android SDK at $path" -ForegroundColor Green
            $foundSdk = $true
            break
        }
    }
    
    if (-not $foundSdk) {
        Write-Host "❌ Error: Android SDK not found" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✓ Environment checks passed" -ForegroundColor Green
Write-Host ""

# Step 1: Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
Push-Location android
.\gradlew.bat clean
Pop-Location
Write-Host "✓ Clean complete" -ForegroundColor Green
Write-Host ""

# Step 2: Install dependencies
Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✓ npm install complete" -ForegroundColor Green
Write-Host ""

# Step 3: Version check
Write-Host "📱 Current version information:" -ForegroundColor Cyan
$buildGradle = Get-Content "android\app\build.gradle" -Raw
if ($buildGradle -match 'versionName\s+"([^"]+)"') {
    $versionName = $matches[1]
    Write-Host "   Version Name: $versionName" -ForegroundColor White
}
if ($buildGradle -match 'versionCode\s+(\d+)') {
    $versionCode = $matches[1]
    Write-Host "   Version Code: $versionCode" -ForegroundColor White
}
Write-Host ""

$response = Read-Host "Is this version correct? (y/n)"
if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "Please update version in android\app\build.gradle" -ForegroundColor Yellow
    exit 1
}

# Step 4: Keystore check
Write-Host "🔑 Checking for release keystore..." -ForegroundColor Yellow
if (-not (Test-Path $KEYSTORE_PATH)) {
    Write-Host "⚠️  Release keystore not found" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Do you want to generate a new keystore? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host ""
        Write-Host "Creating release keystore..." -ForegroundColor Cyan
        Write-Host "Please provide the following information:" -ForegroundColor Blue
        
        keytool -genkeypair -v `
            -storetype PKCS12 `
            -keystore $KEYSTORE_PATH `
            -alias goshopperai-release `
            -keyalg RSA `
            -keysize 2048 `
            -validity 10000
        
        Write-Host "✓ Keystore created" -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANT: Store the keystore and password securely!" -ForegroundColor Yellow
        Write-Host "Location: $KEYSTORE_PATH" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "❌ Cannot proceed without keystore" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ Keystore found at $KEYSTORE_PATH" -ForegroundColor Green
}

Write-Host ""

# Step 5: Signing configuration check
Write-Host "🔐 Checking signing configuration..." -ForegroundColor Yellow
if (-not (Test-Path "android\gradle.properties")) {
    Write-Host "⚠️  gradle.properties not found" -ForegroundColor Yellow
    Write-Host "Creating gradle.properties template..." -ForegroundColor Yellow
    
    $gradleProps = @"
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
"@
    
    Set-Content -Path "android\gradle.properties" -Value $gradleProps
    Write-Host "Please edit android\gradle.properties with your keystore passwords" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Signing configuration found" -ForegroundColor Green
Write-Host ""

# Step 6: Build release AAB
Write-Host "🔨 Building release AAB..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Cyan
Push-Location android
.\gradlew.bat bundleRelease

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location
Write-Host ""

# Step 7: Verify AAB
if (Test-Path $AAB_PATH) {
    Write-Host "✓ AAB file created successfully" -ForegroundColor Green
    $aabSize = (Get-Item $AAB_PATH).Length / 1MB
    Write-Host "   Size: $([math]::Round($aabSize, 2)) MB" -ForegroundColor White
    Write-Host "   Location: $AAB_PATH" -ForegroundColor White
} else {
    Write-Host "❌ AAB file not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 8: Build Info
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Release AAB: $AAB_PATH" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Go to Google Play Console" -ForegroundColor White
Write-Host "2. Select your app" -ForegroundColor White
Write-Host "3. Production → Create new release" -ForegroundColor White
Write-Host "4. Upload the AAB file" -ForegroundColor White
Write-Host "5. Add release notes" -ForegroundColor White
Write-Host "6. Review and rollout" -ForegroundColor White
Write-Host ""
Write-Host "✓ Ready for Play Store submission!" -ForegroundColor Green
