@echo off
REM EAS Build Script for GoShopper AI
REM Builds AAB for Google Play using Expo Application Services

echo.
echo ================================================
echo   GoShopper AI - EAS Build for Google Play
echo ================================================
echo.

echo 📋 Checking EAS CLI...
eas --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ EAS CLI not found
    echo Please install EAS CLI first: npm install -g eas-cli
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('eas --version') do set EAS_VERSION=%%i
    echo ✓ EAS CLI installed: %EAS_VERSION%
)

echo.
echo 📋 Checking credentials...

if exist "goshopper-release-key.keystore" (
    echo ✓ Keystore found: goshopper-release-key.keystore
) else (
    echo ⚠️  Warning: Keystore not found
    echo    EAS will use remote credentials or you need to create a keystore
)

if exist "credentials.json" (
    echo ✓ Credentials file found
) else (
    echo ⚠️  Warning: credentials.json not found
)

echo.
echo 📦 Reading current version...
for /f "tokens=*" %%i in ('powershell -Command "(Get-Content app.json | ConvertFrom-Json).expo.version"') do set CURRENT_VERSION=%%i
echo Current version: %CURRENT_VERSION%

echo.
echo ================================================
echo Build Options:
echo   1. Production AAB (for Google Play)
echo   2. Preview APK (for testing)
echo   3. Cancel
echo ================================================
echo.

set /p choice="Select build type (1-3): "

if "%choice%"=="1" goto production
if "%choice%"=="2" goto preview
if "%choice%"=="3" goto cancel

echo ❌ Invalid choice
pause
exit /b 1

:production
echo.
echo 🚀 Building Production AAB...
echo.
echo This will:
echo   • Upload your code to EAS servers
echo   • Build a signed AAB using your keystore
echo   • Take approximately 10-20 minutes
echo   • Download the AAB when complete
echo.

set /p confirm="Continue? (y/n): "
if /i not "%confirm%"=="y" goto cancel

echo.
echo 📤 Starting EAS build...
echo.

eas build --platform android --profile production

echo.
echo ================================================
echo ✅ Build complete!
echo ================================================
echo.
echo Next steps:
echo   1. Check your EAS dashboard for the build
echo   2. Download the AAB file
echo   3. Upload to Google Play Console
echo.
echo Dashboard: https://expo.dev
echo.
goto end

:preview
echo.
echo 🚀 Building Preview APK...
echo.

eas build --platform android --profile preview

echo.
echo ✅ Build complete!
echo You can install this APK on your device for testing
echo.
goto end

:cancel
echo Build cancelled
goto end

:end
echo.
echo 📊 View all builds: eas build:list
echo.
echo 📋 Build details: eas build:view [BUILD_ID]
echo.
pause