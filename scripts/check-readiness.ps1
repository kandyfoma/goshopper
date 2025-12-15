# GoShopper AI - Submission Readiness Checker
Write-Host ""
Write-Host "GoShopper AI - Submission Readiness Check"
Write-Host "=========================================="
Write-Host ""

$passed = 0
$warned = 0
$failed = 0

function Check {
    param([string]$Name, [bool]$Result, [bool]$Warn = $false)
    Write-Host "  $Name... " -NoNewline
    if ($Result) {
        Write-Host "[OK]" -ForegroundColor Green
        $script:passed++
    } elseif ($Warn) {
        Write-Host "[WARN]" -ForegroundColor Yellow
        $script:warned++
    } else {
        Write-Host "[FAIL]" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "CONFIG" -ForegroundColor Cyan
Check "package.json" (Test-Path "package.json")
Check "iOS Info.plist" (Test-Path "ios\goshopperai\Info.plist")
Check "Android build.gradle" (Test-Path "android\app\build.gradle")

Write-Host ""
Write-Host "LEGAL" -ForegroundColor Cyan
Check "Privacy Policy" (Test-Path "store-assets\PRIVACY_POLICY.md")
Check "Terms of Service" (Test-Path "store-assets\TERMS_OF_SERVICE.md")

Write-Host ""
Write-Host "DOCS" -ForegroundColor Cyan
Check "Store descriptions" (Test-Path "store-assets\STORE_DESCRIPTIONS.md")
Check "Submission guide" (Test-Path "store-assets\QUICK_START_SUBMISSION_GUIDE.md")

Write-Host ""
Write-Host "SCRIPTS" -ForegroundColor Cyan
Check "iOS build script" (Test-Path "scripts\build-ios-release.sh")
Check "Android build script" (Test-Path "scripts\build-android-release.ps1")

Write-Host ""
Write-Host "SIGNING (Optional for now)" -ForegroundColor Cyan
Check "Android keystore" (Test-Path "android\app\release.keystore") $true
Check "gradle.properties" (Test-Path "android\gradle.properties") $true

Write-Host ""
Write-Host "=========================================="
Write-Host "Passed: $passed | Warnings: $warned | Errors: $failed"
$total = $passed + $warned + $failed
if ($total -gt 0) {
    $pct = [math]::Round(($passed / $total) * 100)
    Write-Host "Readiness: $pct%"
}
Write-Host ""
if ($failed -eq 0) {
    Write-Host "READY FOR SUBMISSION PREP!" -ForegroundColor Green
} else {
    Write-Host "FIX ERRORS FIRST" -ForegroundColor Red
}
Write-Host ""
