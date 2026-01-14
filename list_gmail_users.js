const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../credentials.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'goshopperai'
});

async function listGmailUsers() {
  try {
    const listUsersResult = await admin.auth().listUsers(1000); // List up to 1000 users
    const gmailUsers = listUsersResult.users.filter(user =>
      user.email && user.email.includes('@gmail.com')
    );

    console.log('Gmail users found:');
    gmailUsers.forEach(user => {
      console.log(`UID: ${user.uid}, Email: ${user.email}, Display Name: ${user.displayName || 'N/A'}`);
    });

    if (gmailUsers.length === 0) {
      console.log('No Gmail users found.');
    }
  } catch (error) {
    console.error('Error listing users:', error);
  }
}

listGmailUsers();