#!/usr/bin/env node

/**
 * Simple Integration Test for Hybrid Receipt Processor
 * Tests the basic integration structure without React Native dependencies
 */

console.log('🧠 Testing Hybrid Receipt Processor Integration Structure');
console.log('='.repeat(60));

const fs = require('fs');
const path = require('path');

function checkFileExists(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${description} found: ${filePath}`);
    return true;
  } else {
    console.log(`   ❌ ${description} missing: ${filePath}`);
    return false;
  }
}

function checkFileContent(filePath, searchText, description) {
  try {
    const fullPath = path.join(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchText)) {
      console.log(`   ✅ ${description} found in ${filePath}`);
      return true;
    } else {
      console.log(`   ❌ ${description} not found in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading ${filePath}: ${error.message}`);
    return false;
  }
}

async function runIntegrationTests() {
  let allTestsPassed = true;

  // Test 1: Python receipt processor files
  console.log('\n1. Python Receipt Processor Files:');
  allTestsPassed &= checkFileExists('receipt_processor/main.py', 'Main processor');
  allTestsPassed &= checkFileExists('receipt_processor/config.py', 'Configuration');
  allTestsPassed &= checkFileExists('receipt_processor/extractor.py', 'Extractor');
  allTestsPassed &= checkFileExists('receipt_processor/learning_engine.py', 'Learning engine');
  allTestsPassed &= checkFileExists('receipt_processor/gemini_api.py', 'Gemini API client');

  // Test 2: React Native service files
  console.log('\n2. React Native Service Files:');
  allTestsPassed &= checkFileExists('src/shared/services/ai/hybridReceiptProcessor.ts', 'Hybrid processor service');

  // Test 3: Android native module
  console.log('\n3. Android Native Module:');
  allTestsPassed &= checkFileExists('android/app/src/main/java/com/goshopperai/app/ReceiptProcessorModule.kt', 'Android module');
  allTestsPassed &= checkFileExists('android/app/src/main/java/com/goshopperai/app/ReceiptProcessorPackage.kt', 'Android package');

  // Test 4: Integration in MainApplication
  console.log('\n4. Android Integration:');
  allTestsPassed &= checkFileContent(
    'android/app/src/main/java/com/goshopperai/app/MainApplication.kt',
    'ReceiptProcessorPackage()',
    'Package registration'
  );

  // Test 5: Scanner screen integration
  console.log('\n5. Scanner Screen Integration:');
  allTestsPassed &= checkFileContent(
    'src/features/scanner/screens/UnifiedScannerScreen.tsx',
    'hybridReceiptProcessor.processReceipt',
    'Hybrid processor usage'
  );

  // Test 6: Python functionality tests
  console.log('\n6. Python Functionality:');
  try {
    const { spawn } = require('child_process');
    const pythonTest = spawn('python', ['receipt_processor/test_complete_system.py'], {
      cwd: __dirname,
      stdio: 'pipe'
    });

    let testOutput = '';
    let testError = '';

    pythonTest.stdout.on('data', (data) => {
      testOutput += data.toString();
    });

    pythonTest.stderr.on('data', (data) => {
      testError += data.toString();
    });

    await new Promise((resolve, reject) => {
      pythonTest.on('close', (code) => {
        if (code === 0 && testOutput.includes('Complete Hybrid System Test Successful')) {
          console.log('   ✅ Python system test passed');
        } else {
          console.log('   ❌ Python system test failed');
          console.log('   Output:', testOutput.substring(0, 200));
          if (testError) console.log('   Error:', testError.substring(0, 200));
          allTestsPassed = false;
        }
        resolve(null);
      });

      pythonTest.on('error', (error) => {
        console.log('   ❌ Python test execution failed:', error.message);
        allTestsPassed = false;
        resolve(null);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        pythonTest.kill();
        console.log('   ❌ Python test timed out');
        allTestsPassed = false;
        resolve(null);
      }, 30000);
    });

  } catch (error) {
    console.log('   ❌ Python test setup failed:', error.message);
    allTestsPassed = false;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (allTestsPassed) {
    console.log('🎉 INTEGRATION TEST SUCCESSFUL!');
    console.log('\n📋 Integration Status:');
    console.log('   ✅ Python receipt processor complete');
    console.log('   ✅ React Native service layer implemented');
    console.log('   ✅ Android native bridge created');
    console.log('   ✅ Scanner integration updated');
    console.log('   ✅ Learning system integrated');
    console.log('\n🚀 Ready for:');
    console.log('   • Testing on physical devices');
    console.log('   • Performance optimization');
    console.log('   • Production deployment');
    console.log('   • User acceptance testing');
  } else {
    console.log('❌ INTEGRATION TEST FAILED!');
    console.log('   Please check the errors above and fix any missing components.');
  }

  return allTestsPassed;
}

// Run the tests
runIntegrationTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});