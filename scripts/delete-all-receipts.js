/**
 * Delete All Receipts Script
 * Deletes all receipts from all users (for testing only)
 * 
 * Usage:
 *   node scripts/delete-all-receipts.js
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

async function getAllUsers() {
  try {
    const usersSnapshot = await db.collection(`artifacts/${APP_ID}/users`).get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        displayName: data.displayName || data.name || 'Unknown',
        email: data.email || 'No email',
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

async function deleteAllReceiptsForUser(userId) {
  try {
    const receiptsRef = db.collection(`artifacts/${APP_ID}/users/${userId}/receipts`);
    const receiptsSnapshot = await receiptsRef.get();
    
    if (receiptsSnapshot.empty) {
      console.log(`   No receipts found for user ${userId}`);
      return 0;
    }
    
    const batch = db.batch();
    let count = 0;
    
    receiptsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      count++;
    });
    
    await batch.commit();
    return count;
  } catch (error) {
    console.error(`Error deleting receipts for user ${userId}:`, error);
    return 0;
  }
}

async function main() {
  console.log('🗑️  Delete All Receipts Tool');
  console.log('============================\n');
  
  // Get all users
  console.log('📋 Fetching users...\n');
  const users = await getAllUsers();
  
  if (users.length === 0) {
    console.log('No users found.');
    rl.close();
    process.exit(0);
  }
  
  console.log(`Found ${users.length} user(s):\n`);
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.displayName} (${user.email})`);
    console.log(`   ID: ${user.id}\n`);
  });
  
  // Confirm deletion
  const confirm = await question(`\n⚠️  WARNING: This will delete ALL receipts for ALL users!\nType "DELETE ALL" to confirm: `);
  
  if (confirm !== 'DELETE ALL') {
    console.log('❌ Deletion cancelled.');
    rl.close();
    process.exit(0);
  }
  
  console.log('\n🗑️  Deleting all receipts...\n');
  
  let totalDeleted = 0;
  
  for (const user of users) {
    console.log(`Processing user: ${user.displayName} (${user.id})`);
    const count = await deleteAllReceiptsForUser(user.id);
    console.log(`   ✅ Deleted ${count} receipt(s)\n`);
    totalDeleted += count;
  }
  
  console.log(`\n✅ Total receipts deleted: ${totalDeleted}`);
  console.log('\n📝 Note: User items will be cleaned up automatically by triggers.');
  console.log('   City items are preserved (community data).');
  
  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
