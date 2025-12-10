const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

console.log('Initializing with project:', serviceAccount.project_id);
console.log('Client Email:', serviceAccount.client_email);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

async function testAuth() {
  try {
    console.log('Testing Firestore...');
    const db = admin.firestore();
    const collections = await db.listCollections();
    console.log('Successfully connected to Firestore. Collections:', collections.map(c => c.id));

    console.log('Listing users...');
    const listUsersResult = await admin.auth().listUsers(10);
    console.log('Successfully listed users:', listUsersResult.users.length);
    listUsersResult.users.forEach(user => {
      console.log(' -', user.email);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

testAuth();
