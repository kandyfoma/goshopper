# Generate Facebook Key Hash for Android Debug Keystore

$keytoolPath = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
$keystorePath = "$env:USERPROFILE\.android\debug.keystore"
$tempCertFile = "$env:TEMP\debug_cert.der"

Write-Host "Generating Facebook Key Hash..." -ForegroundColor Green

try {
    # Export the certificate to a file
    & $keytoolPath -exportcert -alias androiddebugkey -keystore $keystorePath -storepass android -keypass android -file $tempCertFile | Out-Null
    
    if (Test-Path $tempCertFile) {
        # Read the certificate file
        $certBytes = [System.IO.File]::ReadAllBytes($tempCertFile)
        
        # Compute SHA1 hash
        $sha1 = [System.Security.Cryptography.SHA1]::Create()
        $hash = $sha1.ComputeHash($certBytes)
        
        # Convert to Base64
        $base64Hash = [Convert]::ToBase64String($hash)
        
        Write-Host "`nYour Facebook Key Hash:" -ForegroundColor Cyan
        Write-Host $base64Hash -ForegroundColor Yellow
        Write-Host "`n"
        
        # Clean up temp file
        Remove-Item $tempCertFile -Force
        
        # Also show the SHA-1 fingerprint for reference
        Write-Host "SHA-1 Fingerprint (for reference):" -ForegroundColor Cyan
        & $keytoolPath -list -v -keystore $keystorePath -alias androiddebugkey -storepass android -keypass android | Select-String "SHA1:"
        
        Write-Host "`n=== NEXT STEPS ===" -ForegroundColor Green
        Write-Host "1. Go to: https://developers.facebook.com/apps/1932348127718450/settings/basic/" -ForegroundColor White
        Write-Host "2. Scroll down to 'Android' platform settings" -ForegroundColor White
        Write-Host "3. Add the Key Hash shown above in the 'Key Hashes' field" -ForegroundColor White
        Write-Host "4. Make sure 'Package Name' is: com.goshopper.app" -ForegroundColor White
        Write-Host "5. Make sure 'Class Name' is: com.goshopper.app.MainActivity" -ForegroundColor White
        Write-Host "6. Save changes and rebuild your app" -ForegroundColor White
        Write-Host "`nNote: You may need to add this key hash to BOTH the 'Development' and 'Release' sections." -ForegroundColor Yellow
    } else {
        Write-Host "Error: Could not export certificate" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
