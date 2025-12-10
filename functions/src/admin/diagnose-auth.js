const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize with service account
const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
console.log('Loading service account from:', serviceAccountPath);

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log('Service account loaded for project:', serviceAccount.project_id);
  console.log('Client Email:', serviceAccount.client_email);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  console.log('Firebase Admin initialized');

} catch (error) {
  console.error('Error initializing Firebase:', error);
  process.exit(1);
}

async function diagnose() {
  console.log('\n--- Starting Diagnosis ---');
  
  // 1. Check Auth
  console.log('\n1. Testing Authentication (listUsers)...');
  try {
    const listUsersResult = await admin.auth().listUsers(1);
    console.log('✅ Auth Success! Found users:', listUsersResult.users.length);
  } catch (error) {
    console.error('❌ Auth Failed!');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    if (error.errorInfo) {
      console.error('Error Info:', JSON.stringify(error.errorInfo, null, 2));
    }
  }

  // 2. Check Firestore
  console.log('\n2. Testing Firestore (listCollections)...');
  try {
    const db = admin.firestore();
    const collections = await db.listCollections();
    console.log('✅ Firestore Success! Collections:', collections.map(c => c.id).join(', '));
  } catch (error) {
    console.error('❌ Firestore Failed!');
    console.error('Error Message:', error.message);
  }
  
  console.log('\n--- Diagnosis Complete ---');
}

diagnose();
