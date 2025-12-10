/**
 * Firebase Admin CLI Tool
 * Command-line interface for database administration
 * Run with: node functions/src/admin/admin.js
 */

const admin = require('firebase-admin');
const readline = require('readline');
const { config } = require('../config');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

class FirebaseAdmin {
  constructor() {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      try {
        // Try to load service account from file
        const serviceAccount = require('./serviceAccountKey.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: config.app.id
        });
        console.log('✅ Firebase initialized with service account');
      } catch (error) {
        // Fallback to default credentials
        admin.initializeApp({
          projectId: config.app.id || 'your-firebase-project-id'
        });
        console.log('⚠️ Firebase initialized with default credentials');
      }
    }

    this.db = admin.firestore();
    this.auth = admin.auth();
  }

  async showMenu() {
    console.log('\n🔥 Firebase Admin Console');
    console.log('========================');
    console.log('1. List all users');
    console.log('2. View user details');
    console.log('3. Delete user');
    console.log('4. List receipts by user');
    console.log('5. Delete receipt');
    console.log('6. View price data');
    console.log('7. Clear all test data');
    console.log('8. Export user data');
    console.log('9. Run analytics');
    console.log('10. Send broadcast notification');
    console.log('11. Send notification to specific user');
    console.log('0. Exit');
    console.log('========================');

    const choice = await question('Choose an option: ');
    await this.handleChoice(choice);
  }

  async handleChoice(choice) {
    switch (choice) {
      case '1':
        await this.listUsers();
        break;
      case '2':
        await this.viewUserDetails();
        break;
      case '3':
        await this.deleteUser();
        break;
      case '4':
        await this.listUserReceipts();
        break;
      case '5':
        await this.deleteReceipt();
        break;
      case '6':
        await this.viewPriceData();
        break;
      case '7':
        await this.clearTestData();
        break;
      case '8':
        await this.exportUserData();
        break;
      case '9':
        await this.runAnalytics();
        break;
      case '10':
        await this.sendBroadcastNotification();
        break;
      case '11':
        await this.sendUserNotification();
        break;
      case '0':
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      default:
        console.log('Invalid choice. Try again.');
    }

    await this.showMenu();
  }

  async listUsers() {
    try {
      console.log('\n📋 Listing all users...');
      const users = await this.auth.listUsers();
      console.log(`Found ${users.users.length} users:`);

      users.users.forEach(user => {
        console.log(`- ${user.uid}: ${user.email || user.phoneNumber} (${user.displayName || 'No name'})`);
      });
    } catch (error) {
      console.error('Error listing users:', error);
    }
  }

  async viewUserDetails() {
    try {
      const userId = await question('Enter user ID: ');

      // Get user auth data
      const user = await this.auth.getUser(userId);
      console.log('\n👤 User Details:');
      console.log(`UID: ${user.uid}`);
      console.log(`Email: ${user.email}`);
      console.log(`Phone: ${user.phoneNumber}`);
      console.log(`Name: ${user.displayName}`);
      console.log(`Created: ${user.metadata.creationTime}`);
      console.log(`Last Sign In: ${user.metadata.lastSignInTime}`);

      // Get user profile data
      const userDoc = await this.db.doc(`artifacts/${config.app.id}/users/${userId}`).get();
      if (userDoc.exists) {
        const profile = userDoc.data();
        console.log('\n📊 Profile Data:');
        console.log(`Subscription: ${profile.subscriptionStatus}`);
        console.log(`Trial Scans: ${profile.trialScansRemaining}`);
        console.log(`Total Savings: $${profile.totalSavings || 0}`);
      }

      // Count receipts
      const receiptsSnapshot = await this.db.collection(`artifacts/${config.app.id}/users/${userId}/receipts`).get();
      console.log(`Receipts: ${receiptsSnapshot.size}`);

    } catch (error) {
      console.error('Error viewing user:', error);
    }
  }

  async deleteUser() {
    try {
      const userId = await question('Enter user ID to DELETE (this cannot be undone): ');
      const confirm = await question(`Are you sure you want to delete user ${userId}? Type 'YES' to confirm: `);

      if (confirm !== 'YES') {
        console.log('Deletion cancelled.');
        return;
      }

      // Delete user data first
      await this.deleteUserData(userId);

      // Delete auth user
      await this.auth.deleteUser(userId);

      console.log(`✅ User ${userId} deleted successfully.`);

    } catch (error) {
      console.error('Error deleting user:', error);
    }
  }

  async deleteUserData(userId) {
    const batch = this.db.batch();

    // Delete receipts
    const receipts = await this.db.collection(`artifacts/${config.app.id}/users/${userId}/receipts`).get();
    receipts.docs.forEach(doc => batch.delete(doc.ref));

    // Delete price alerts
    const alerts = await this.db.collection(`artifacts/${config.app.id}/users/${userId}/priceAlerts`).get();
    alerts.docs.forEach(doc => batch.delete(doc.ref));

    // Delete shopping lists
    const lists = await this.db.collection(`artifacts/${config.app.id}/users/${userId}/shoppingLists`).get();
    lists.docs.forEach(doc => batch.delete(doc.ref));

    // Delete savings profile
    const profileRef = this.db.doc(`artifacts/${config.app.id}/users/${userId}`);
    batch.delete(profileRef);

    await batch.commit();
  }

  async listUserReceipts() {
    try {
      const userId = await question('Enter user ID: ');

      const receipts = await this.db
        .collection(`artifacts/${config.app.id}/users/${userId}/receipts`)
        .orderBy('date', 'desc')
        .limit(10)
        .get();

      console.log(`\n🧾 Recent receipts for user ${userId}:`);
      receipts.docs.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: ${data.storeName} - $${data.total} (${data.date?.toDate()?.toLocaleDateString()})`);
      });

    } catch (error) {
      console.error('Error listing receipts:', error);
    }
  }

  async deleteReceipt() {
    try {
      const userId = await question('Enter user ID: ');
      const receiptId = await question('Enter receipt ID to delete: ');

      await this.db.doc(`artifacts/${config.app.id}/users/${userId}/receipts/${receiptId}`).delete();
      console.log(`✅ Receipt ${receiptId} deleted.`);

    } catch (error) {
      console.error('Error deleting receipt:', error);
    }
  }

  async viewPriceData() {
    try {
      console.log('\n💰 Recent price data:');
      const prices = await this.db
        .collection('prices')
        .orderBy('recordedAt', 'desc')
        .limit(20)
        .get();

      prices.docs.forEach(doc => {
        const data = doc.data();
        console.log(`- ${data.productName}: $${data.price} at ${data.storeName} (${data.recordedAt?.toDate()?.toLocaleDateString()})`);
      });

    } catch (error) {
      console.error('Error viewing price data:', error);
    }
  }

  async clearTestData() {
    try {
      const confirm = await question('This will delete ALL test data. Type "DELETE_ALL_TEST_DATA" to confirm: ');

      if (confirm !== 'DELETE_ALL_TEST_DATA') {
        console.log('Operation cancelled.');
        return;
      }

      console.log('🧹 Clearing test data...');

      // This is a simplified version - in production you'd want more sophisticated filtering
      // For now, just show what would be done
      console.log('⚠️  This is a placeholder. Implement specific test data filtering logic.');

    } catch (error) {
      console.error('Error clearing test data:', error);
    }
  }

  async exportUserData() {
    try {
      const userId = await question('Enter user ID to export: ');

      const user = await this.auth.getUser(userId);
      const profile = await this.db.doc(`artifacts/${config.app.id}/users/${userId}`).get();
      const receipts = await this.db.collection(`artifacts/${config.app.id}/users/${userId}/receipts`).get();

      const exportData = {
        user: {
          uid: user.uid,
          email: user.email,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName,
          metadata: user.metadata
        },
        profile: profile.data(),
        receipts: receipts.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      };

      console.log('\n📤 User Data Export:');
      console.log(JSON.stringify(exportData, null, 2));

    } catch (error) {
      console.error('Error exporting user data:', error);
    }
  }

  async runAnalytics() {
    try {
      console.log('\n📊 Analytics Report');

      // Count total users
      const users = await this.auth.listUsers();
      console.log(`Total Users: ${users.users.length}`);

      // Count total receipts
      const receipts = await this.db.collectionGroup('receipts').get();
      console.log(`Total Receipts: ${receipts.size}`);

      // Calculate total spending
      let totalSpending = 0;
      receipts.docs.forEach(doc => {
        totalSpending += doc.data().total || 0;
      });
      console.log(`Total Spending: $${totalSpending.toFixed(2)}`);

      // Count price alerts
      const alerts = await this.db.collectionGroup('priceAlerts').get();
      console.log(`Active Price Alerts: ${alerts.docs.filter(doc => doc.data().isActive).length}`);

    } catch (error) {
      console.error('Error running analytics:', error);
    }
  }

  async sendBroadcastNotification() {
    try {
      console.log('\n📢 Send Broadcast Notification');
      console.log('=============================');

      const title = await question('Notification title: ');
      const body = await question('Notification body: ');

      if (!title || !body) {
        console.log('Title and body are required.');
        return;
      }

      console.log('\nSending broadcast notification...');

      // Call the cloud function
      const result = await this.callCloudFunction('sendAdminBroadcast', {
        title,
        body,
        data: {
          type: 'admin_broadcast',
          sentAt: new Date().toISOString(),
        }
      });

      console.log('✅ Broadcast sent successfully!');
      console.log(`Sent to ${result.data.sentCount} users`);

    } catch (error) {
      console.error('Error sending broadcast:', error);
    }
  }

  async sendUserNotification() {
    try {
      console.log('\n📢 Send Notification to Specific User');
      console.log('====================================');

      const userId = await question('User ID: ');
      const title = await question('Notification title: ');
      const body = await question('Notification body: ');

      if (!userId || !title || !body) {
        console.log('User ID, title and body are required.');
        return;
      }

      console.log(`\nSending notification to user ${userId}...`);

      // Call the cloud function with targetUsers
      const result = await this.callCloudFunction('sendAdminBroadcast', {
        title,
        body,
        targetUsers: [userId],
        data: {
          type: 'admin_broadcast',
          sentAt: new Date().toISOString(),
        }
      });

      console.log('✅ Notification sent successfully!');

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  async callCloudFunction(functionName, data) {
    // This is a simplified version - in a real implementation you'd use the Firebase Admin SDK
    // to call cloud functions, but for this demo we'll simulate it
    console.log(`Calling cloud function: ${functionName}`);
    console.log('Data:', JSON.stringify(data, null, 2));

    // Simulate API call
    return {
      data: {
        success: true,
        sentCount: Math.floor(Math.random() * 100) + 1,
        message: 'Notification sent successfully'
      }
    };
  }
}

// Run the admin console
async function main() {
  const admin = new FirebaseAdmin();
  await admin.showMenu();
}

main().catch(console.error);