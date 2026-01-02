# GoShopper AI Pre-Release Validation Script
# Checks if everything is ready for building a release AAB

Write-Host ""
Write-Host "GoShopper AI - Release Build Validation" -ForegroundColor Cyan
Write-Host ""

$failed = 0

# Check 1: Version numbers
Write-Host "Checking version numbers..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$appJson = Get-Content "app.json" -Raw | ConvertFrom-Json
$buildGradle = Get-Content "android\app\build.gradle" -Raw

if ($packageJson.version -eq "1.0.0" -and 
    $appJson.expo.version -eq "1.0.0" -and 
    $buildGradle -match 'versionName "1.0.0"') {
    Write-Host "  [PASS] Version Numbers - All set to 1.0.0" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Version Numbers - Version mismatch found" -ForegroundColor Red
    $failed++
}

# Check 2: Package name
Write-Host "Checking package name..." -ForegroundColor Yellow
if ($buildGradle -match 'applicationId "com\.goshopper\.app"' -and 
    $buildGradle -match 'namespace "com\.goshopper\.app"') {
    Write-Host "  [PASS] Package Name - com.goshopper.app" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Package Name - Not properly set" -ForegroundColor Red
    $failed++
}

# Check 3: Keystore file
Write-Host "Checking keystore..." -ForegroundColor Yellow
if (Test-Path "android\goshopper-release-key.keystore") {
    Write-Host "  [PASS] Keystore File - Found goshopper-release-key.keystore" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Keystore File - Not found" -ForegroundColor Red
    $failed++
}

# Check 4: Gradle properties
Write-Host "Checking gradle.properties..." -ForegroundColor Yellow
$gradleProps = Get-Content "android\gradle.properties" -Raw
if ($gradleProps -match 'GOSHOPPER_UPLOAD_STORE_FILE=.+' -and 
    $gradleProps -match 'GOSHOPPER_UPLOAD_KEY_ALIAS=.+' -and
    $gradleProps -match 'GOSHOPPER_UPLOAD_STORE_PASSWORD=.+' -and
    $gradleProps -match 'GOSHOPPER_UPLOAD_KEY_PASSWORD=.+') {
    Write-Host "  [PASS] Gradle Properties - Signing config found" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Gradle Properties - Missing signing configuration" -ForegroundColor Red
    $failed++
}

# Check 5: App icons
Write-Host "Checking app icons..." -ForegroundColor Yellow
$iconCount = (Get-ChildItem "android\app\src\main\res\mipmap-*\ic_launcher.png" -ErrorAction SilentlyContinue).Count
if ($iconCount -ge 5) {
    Write-Host "  [PASS] App Icons - $iconCount density versions found" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] App Icons - Missing icons in some densities" -ForegroundColor Red
    $failed++
}

# Check 6: Build script
Write-Host "Checking build script..." -ForegroundColor Yellow
if (Test-Path "scripts\build-android-release.ps1") {
    Write-Host "  [PASS] Build Script - build-android-release.ps1 exists" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Build Script - Not found" -ForegroundColor Red
    $failed++
}

# Final verdict
Write-Host ""
if ($failed -eq 0) {
    Write-Host "All checks passed! Ready to build release AAB." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step: Run 'npm run build:android:windows'" -ForegroundColor Cyan
    Write-Host ""
    exit 0
} else {
    Write-Host "$failed check(s) failed. Please fix the issues above." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See RELEASE_GUIDE.md for detailed instructions." -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
