# Android Release Build Script for GoShopper AI
# Builds a signed AAB file for Google Play submission

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "GoShopper AI - Android Release Build" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pre-flight checks
Write-Host "Running pre-flight checks..." -ForegroundColor Yellow
Write-Host "  [OK] Skipping Java version check" -ForegroundColor Green

if (-not $env:ANDROID_HOME) {
    $sdkPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "$env:USERPROFILE\AppData\Local\Android\Sdk"
    )
    
    foreach ($path in $sdkPaths) {
        if (Test-Path $path) {
            $env:ANDROID_HOME = $path
            break
        }
    }
}

if ($env:ANDROID_HOME) {
    Write-Host "  [OK] Android SDK: $env:ANDROID_HOME" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Android SDK not found. Set ANDROID_HOME." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Clean build
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
Push-Location android
try {
    .\gradlew.bat clean | Out-Null
    Write-Host "  [OK] Clean complete" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Clean failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host ""

# Step 3: Version info
Write-Host "Version Information:" -ForegroundColor Yellow
$buildGradle = Get-Content "android\app\build.gradle" -Raw
if ($buildGradle -match 'versionName "([^"]+)"') {
    Write-Host "  Version Name: $($matches[1])" -ForegroundColor White
}
if ($buildGradle -match 'versionCode (\d+)') {
    Write-Host "  Version Code: $($matches[1])" -ForegroundColor White
}
Write-Host ""

# Step 4: Build AAB
Write-Host "Building release AAB..." -ForegroundColor Yellow
Write-Host "This will take 2-5 minutes..." -ForegroundColor Cyan
Write-Host ""

Push-Location android
try {
    .\gradlew.bat bundleRelease
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
} catch {
    Write-Host "  [ERROR] Build exception: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host ""

# Step 5: Verify output
$aabPath = "android\app\build\outputs\bundle\release\app-release.aab"

if (Test-Path $aabPath) {
    $aabSize = (Get-Item $aabPath).Length / 1MB
    Write-Host "Build Complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "AAB Location: $aabPath" -ForegroundColor White
    Write-Host "AAB Size: $([math]::Round($aabSize, 2)) MB" -ForegroundColor White
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Go to Google Play Console" -ForegroundColor White
    Write-Host "  2. Create new release in Closed Testing" -ForegroundColor White
    Write-Host "  3. Upload $aabPath" -ForegroundColor White
    Write-Host "  4. Complete and submit" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "  [ERROR] AAB file not found at $aabPath" -ForegroundColor Red
    exit 1
}
