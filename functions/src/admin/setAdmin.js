/**
 * Script to set a user as admin by phone number
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const auth = admin.auth();

async function setUserAdmin(phoneNumber) {
  try {
    console.log(`🔍 Searching for user with phone: ${phoneNumber}`);
    
    // Get user by phone number from Auth
    const user = await auth.getUserByPhoneNumber(phoneNumber);
    console.log(`✅ Found user: ${user.uid}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Display Name: ${user.displayName || 'N/A'}`);
    
    // Update user profile in Firestore
    const userRef = db.doc(`artifacts/goshopper/users/${user.uid}`);
    await userRef.set({ is_admin: true }, { merge: true });
    
    console.log(`✅ Successfully set user ${user.uid} as admin!`);
    
    // Verify the update
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    console.log(`✅ Verified: is_admin = ${userData?.is_admin}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
const phoneNumber = process.argv[2] || '+243828812498';
setUserAdmin(phoneNumber);
