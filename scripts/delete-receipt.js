/**
 * Delete Receipt Script
 * Deletes a receipt directly from Firestore
 * 
 * Usage:
 *   node scripts/delete-receipt.js
 * 
 * Or with parameters:
 *   node scripts/delete-receipt.js <userId> <receiptId>
 */

const admin = require('../functions/node_modules/firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin
const serviceAccount = require('../functions/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const APP_ID = 'goshopper';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function deleteReceipt(userId, receiptId) {
  try {
    console.log('\n🗑️  Deleting receipt...');
    console.log(`   User ID: ${userId}`);
    console.log(`   Receipt ID: ${receiptId}`);

    // Get receipt path
    const receiptPath = `artifacts/${APP_ID}/users/${userId}/receipts/${receiptId}`;
    const receiptRef = db.doc(receiptPath);

    // Check if receipt exists
    const receiptDoc = await receiptRef.get();
    if (!receiptDoc.exists) {
      console.error(`❌ Receipt not found at path: ${receiptPath}`);
      return false;
    }

    const receiptData = receiptDoc.data();
    console.log('\n📄 Receipt Details:');
    console.log(`   Store: ${receiptData.storeName || 'Unknown'}`);
    console.log(`   Date: ${receiptData.date?.toDate?.()?.toLocaleDateString() || 'Unknown'}`);
    console.log(`   Total: ${receiptData.total || 0} ${receiptData.currency || 'CDF'}`);
    console.log(`   Items: ${receiptData.items?.length || 0}`);

    // Confirm deletion
    const confirm = await question('\n⚠️  Are you sure you want to delete this receipt? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled.');
      return false;
    }

    // Delete the receipt
    await receiptRef.delete();
    console.log(`✅ Receipt deleted successfully!`);

    // Note about cleanup
    console.log('\n📝 Note: User items will be cleaned up automatically by the aggregateItemsOnReceipt trigger.');
    console.log('   City items are preserved (community data).');

    return true;
  } catch (error) {
    console.error('❌ Error deleting receipt:', error);
    return false;
  }
}

async function listUserReceipts(userId) {
  try {
    console.log(`\n📋 Fetching receipts for user: ${userId}\n`);

    const receiptsRef = db.collection(`artifacts/${APP_ID}/users/${userId}/receipts`);
    const receiptsSnapshot = await receiptsRef.orderBy('scannedAt', 'desc').limit(20).get();

    if (receiptsSnapshot.empty) {
      console.log('No receipts found for this user.');
      return [];
    }

    const receipts = [];
    receiptsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const receipt = {
        id: doc.id,
        storeName: data.storeName || 'Unknown',
        date: data.date?.toDate?.()?.toLocaleDateString() || 'Unknown',
        total: `${data.total || 0} ${data.currency || 'CDF'}`,
        items: data.items?.length || 0,
      };
      receipts.push(receipt);
      
      console.log(`${index + 1}. ID: ${receipt.id}`);
      console.log(`   Store: ${receipt.storeName}`);
      console.log(`   Date: ${receipt.date}`);
      console.log(`   Total: ${receipt.total}`);
      console.log(`   Items: ${receipt.items}`);
      console.log('');
    });

    return receipts;
  } catch (error) {
    console.error('Error listing receipts:', error);
    return [];
  }
}

async function searchReceiptByStore(userId, storeName) {
  try {
    console.log(`\n🔍 Searching receipts from store: ${storeName}\n`);

    const receiptsRef = db.collection(`artifacts/${APP_ID}/users/${userId}/receipts`);
    const receiptsSnapshot = await receiptsRef
      .where('storeName', '>=', storeName)
      .where('storeName', '<=', storeName + '\uf8ff')
      .limit(20)
      .get();

    if (receiptsSnapshot.empty) {
      console.log('No receipts found from this store.');
      return [];
    }

    const receipts = [];
    receiptsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const receipt = {
        id: doc.id,
        storeName: data.storeName || 'Unknown',
        date: data.date?.toDate?.()?.toLocaleDateString() || 'Unknown',
        total: `${data.total || 0} ${data.currency || 'CDF'}`,
        items: data.items?.length || 0,
      };
      receipts.push(receipt);
      
      console.log(`${index + 1}. ID: ${receipt.id}`);
      console.log(`   Date: ${receipt.date}`);
      console.log(`   Total: ${receipt.total}`);
      console.log(`   Items: ${receipt.items}`);
      console.log('');
    });

    return receipts;
  } catch (error) {
    console.error('Error searching receipts:', error);
    return [];
  }
}

async function main() {
  console.log('🗑️  Receipt Deletion Tool');
  console.log('========================\n');

  // Check if userId and receiptId are provided as command line arguments
  const args = process.argv.slice(2);
  
  let userId, receiptId;

  if (args.length >= 2) {
    // Use command line arguments
    userId = args[0];
    receiptId = args[1];
  } else {
    // Interactive mode
    userId = await question('Enter user ID: ');
    
    // Show options
    console.log('\nOptions:');
    console.log('1. List recent receipts');
    console.log('2. Search by store name');
    console.log('3. Enter receipt ID directly');
    
    const option = await question('\nChoose an option (1-3): ');
    
    if (option === '1') {
      const receipts = await listUserReceipts(userId);
      if (receipts.length === 0) {
        rl.close();
        process.exit(0);
      }
      receiptId = await question('\nEnter receipt ID to delete: ');
    } else if (option === '2') {
      const storeName = await question('Enter store name (partial match): ');
      const receipts = await searchReceiptByStore(userId, storeName);
      if (receipts.length === 0) {
        rl.close();
        process.exit(0);
      }
      receiptId = await question('\nEnter receipt ID to delete: ');
    } else {
      receiptId = await question('Enter receipt ID: ');
    }
  }

  // Delete the receipt
  await deleteReceipt(userId, receiptId);

  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
