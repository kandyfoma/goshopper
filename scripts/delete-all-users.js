/**
 * Delete All Users Script
 * Deletes all users from Firebase Auth and Firestore (for testing only)
 * 
 * Usage:
 *   node scripts/delete-all-users.js
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
const auth = admin.auth();
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
    const listUsersResult = await auth.listUsers();
    return listUsersResult.users;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

async function deleteUserData(userId) {
  try {
    console.log(`   📄 Deleting Firestore data...`);
    
    // Delete receipts
    const receiptsRef = db.collection(`artifacts/${APP_ID}/users/${userId}/receipts`);
    const receiptsSnapshot = await receiptsRef.get();
    
    const batch1 = db.batch();
    let count = 0;
    receiptsSnapshot.forEach(doc => {
      batch1.delete(doc.ref);
      count++;
    });
    if (count > 0) {
      await batch1.commit();
      console.log(`      ✅ Deleted ${count} receipt(s)`);
    }
    
    // Delete items
    const itemsRef = db.collection(`artifacts/${APP_ID}/users/${userId}/items`);
    const itemsSnapshot = await itemsRef.get();
    
    const batch2 = db.batch();
    count = 0;
    itemsSnapshot.forEach(doc => {
      batch2.delete(doc.ref);
      count++;
    });
    if (count > 0) {
      await batch2.commit();
      console.log(`      ✅ Deleted ${count} item(s)`);
    }
    
    // Delete shops
    const shopsRef = db.collection(`artifacts/${APP_ID}/users/${userId}/shops`);
    const shopsSnapshot = await shopsRef.get();
    
    const batch3 = db.batch();
    count = 0;
    shopsSnapshot.forEach(doc => {
      batch3.delete(doc.ref);
      count++;
    });
    if (count > 0) {
      await batch3.commit();
      console.log(`      ✅ Deleted ${count} shop(s)`);
    }
    
    // Delete user document
    await db.doc(`artifacts/${APP_ID}/users/${userId}`).delete();
    console.log(`      ✅ Deleted user document`);
    
    // Delete subscription (check both paths)
    try {
      await db.doc(`artifacts/${APP_ID}/subscriptions/${userId}`).delete();
      console.log(`      ✅ Deleted subscription`);
    } catch (err) {
      // Try old path
      try {
        await db.doc(`subscriptions/${userId}`).delete();
        console.log(`      ✅ Deleted subscription (old path)`);
      } catch (err2) {
        console.log(`      ⚠️  No subscription found`);
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Error deleting Firestore data:`, error.message);
  }
}

async function deleteUser(user) {
  try {
    console.log(`\n🗑️  Deleting user: ${user.displayName || user.email || user.uid}`);
    
    // Delete Firestore data first
    await deleteUserData(user.uid);
    
    // Delete from Firebase Auth
    console.log(`   🔐 Deleting from Firebase Auth...`);
    await auth.deleteUser(user.uid);
    console.log(`      ✅ Deleted from Auth`);
    
  } catch (error) {
    console.error(`   ❌ Error deleting user:`, error.message);
  }
}

async function main() {
  console.log('🗑️  Delete All Users Tool');
  console.log('==========================\n');
  
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
    console.log(`${index + 1}. ${user.displayName || 'No name'} (${user.email || 'No email'})`);
    console.log(`   UID: ${user.uid}`);
    console.log(`   Created: ${new Date(user.metadata.creationTime).toLocaleDateString()}\n`);
  });
  
  // Confirm deletion
  const confirm = await question(`\n⚠️  WARNING: This will PERMANENTLY delete ALL users and their data!\nThis includes:\n- Firebase Auth accounts\n- All receipts\n- All items\n- All shops\n- User profiles\n- Subscriptions\n\nType "DELETE ALL USERS" to confirm: `);
  
  if (confirm !== 'DELETE ALL USERS') {
    console.log('❌ Deletion cancelled.');
    rl.close();
    process.exit(0);
  }
  
  console.log('\n🗑️  Deleting all users...\n');
  
  for (const user of users) {
    await deleteUser(user);
  }
  
  console.log(`\n✅ Successfully deleted ${users.length} user(s) and all their data!`);
  
  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
