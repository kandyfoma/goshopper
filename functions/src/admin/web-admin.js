/**
 * Web Admin Interface
 * Simple web-based admin panel for Firebase database management
 * Run with: npm run admin:web
 */

const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const { config } = require('../../lib/config');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Firebase Admin
// Check if already initialized (to avoid double initialization)
if (!admin.apps.length) {
  // Build absolute path to service account key
  const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase initialized with service account:', serviceAccount.project_id);
    } catch (error) {
      console.error('❌ Error loading service account:', error.message);
      process.exit(1);
    }
  } else {
    console.error('❌ Service account key not found at:', serviceAccountPath);
    console.error('Please download it from Firebase Console > Project Settings > Service Accounts');
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Basic HTML template
function getHtmlTemplate(title, content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - GoShopperAI Admin (v1.1)</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1, h2 { color: #333; }
        .menu { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .menu a { margin: 0 10px; text-decoration: none; color: #007bff; padding: 5px 10px; border-radius: 3px; }
        .menu a:hover { background: #007bff; color: white; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
        .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin: 2px; }
        .btn-primary { background: #007bff; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn:hover { opacity: 0.8; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        .alert { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔥 GoShopperAI Admin Panel</h1>
        <div class="menu">
            <a href="/">Dashboard</a>
            <a href="/users">Users</a>
            <a href="/receipts">Receipts</a>
            <a href="/prices">Prices</a>
            <a href="/analytics">Analytics</a>
            <a href="/notifications">Send Notifications</a>
        </div>
        ${content}
    </div>
</body>
</html>`;
}

// Routes
app.get('/', async (req, res) => {
  try {
    console.log('Loading dashboard...');
    
    // Get basic stats
    console.log('Fetching users...');
    let users = { users: [] };
    let authError = null;
    try {
      users = await auth.listUsers();
      console.log(`Found ${users.users.length} users`);
    } catch (error) {
      authError = error;
      console.error('❌ Error fetching users (Auth not configured?):', error.message);
      // Continue without users
    }
    
    console.log('Fetching receipts...');
    const receipts = await db.collectionGroup('receipts').get();
    console.log(`Found ${receipts.size} receipts`);
    
    console.log('Fetching alerts...');
    const alerts = await db.collectionGroup('priceAlerts').where('isActive', '==', true).get();
    console.log(`Found ${alerts.size} alerts`);

    let totalSpending = 0;
    receipts.docs.forEach(doc => {
      totalSpending += doc.data().total || 0;
    });

    const content = `
        <h2>Dashboard</h2>
        ${authError ? `<div class="alert alert-error">Warning: Authentication service not accessible. User stats may be incomplete.</div>` : ''}
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${users.users.length}</div>
                <div>Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${receipts.size}</div>
                <div>Total Receipts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">$${totalSpending.toFixed(0)}</div>
                <div>Total Spending</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${alerts.size}</div>
                <div>Active Alerts</div>
            </div>
        </div>

        <h3>Quick Actions</h3>
        <p>
            <a href="/users" class="btn btn-primary">Manage Users</a>
            <a href="/receipts" class="btn btn-primary">View Receipts</a>
            <a href="/analytics" class="btn btn-primary">View Analytics</a>
        </p>
    `;

    res.send(getHtmlTemplate('Dashboard', content));
  } catch (error) {
    res.send(getHtmlTemplate('Error', `<div class="alert alert-error">Error loading dashboard: ${error.message}</div>`));
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await auth.listUsers();
    let tableRows = '';

    for (const user of users.users) {
      const userDoc = await db.doc(`artifacts/${config.app.id}/users/${user.uid}`).get();
      const profile = userDoc.exists ? userDoc.data() : {};

      tableRows += `
        <tr>
          <td>${user.uid.substring(0, 8)}...</td>
          <td>${user.email || user.phoneNumber || 'N/A'}</td>
          <td>${user.displayName || 'N/A'}</td>
          <td>${profile.subscriptionStatus || 'N/A'}</td>
          <td>${profile.trialScansRemaining || 0}</td>
          <td>
            <a href="/users/${user.uid}" class="btn btn-primary">View</a>
            <a href="/users/${user.uid}/delete" class="btn btn-danger" onclick="return confirm('Delete this user?')">Delete</a>
          </td>
        </tr>
      `;
    }

    const content = `
        <h2>Users (${users.users.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Contact</th>
                    <th>Name</th>
                    <th>Subscription</th>
                    <th>Trial Scans</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;

    res.send(getHtmlTemplate('Users', content));
  } catch (error) {
    res.send(getHtmlTemplate('Error', `<div class="alert alert-error">Error loading users: ${error.message}</div>`));
  }
});

app.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await auth.getUser(userId);
    const profile = await db.doc(`artifacts/${config.app.id}/users/${userId}`).get();
    const receipts = await db.collection(`artifacts/${config.app.id}/users/${userId}/receipts`).orderBy('date', 'desc').limit(5).get();

    const profileData = profile.exists ? profile.data() : {};

    let receiptsHtml = '<p>No receipts found.</p>';
    if (!receipts.empty) {
      receiptsHtml = '<ul>';
      receipts.docs.forEach(doc => {
        const data = doc.data();
        receiptsHtml += `<li>${data.storeName} - $${data.total} (${data.date?.toDate()?.toLocaleDateString()})</li>`;
      });
      receiptsHtml += '</ul>';
    }

    const content = `
        <h2>User Details: ${user.displayName || user.email}</h2>
        <h3>Auth Info</h3>
        <p><strong>UID:</strong> ${user.uid}</p>
        <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${user.phoneNumber || 'N/A'}</p>
        <p><strong>Created:</strong> ${user.metadata.creationTime}</p>

        <h3>Profile Data</h3>
        <p><strong>Subscription:</strong> ${profileData.subscriptionStatus || 'N/A'}</p>
        <p><strong>Trial Scans:</strong> ${profileData.trialScansRemaining || 0}</p>
        <p><strong>Total Savings:</strong> $${profileData.totalSavings || 0}</p>

        <h3>Recent Receipts</h3>
        ${receiptsHtml}

        <p><a href="/users" class="btn btn-primary">Back to Users</a></p>
    `;

    res.send(getHtmlTemplate('User Details', content));
  } catch (error) {
    res.send(getHtmlTemplate('Error', `<div class="alert alert-error">Error loading user: ${error.message}</div>`));
  }
});

app.get('/receipts', async (req, res) => {
  try {
    const receipts = await db.collectionGroup('receipts').orderBy('date', 'desc').limit(50).get();

    let tableRows = '';
    receipts.docs.forEach(doc => {
      const data = doc.data();
      const userId = doc.ref.path.split('/')[3]; // Extract user ID from path

      tableRows += `
        <tr>
          <td>${doc.id.substring(0, 8)}...</td>
          <td>${userId.substring(0, 8)}...</td>
          <td>${data.storeName || 'N/A'}</td>
          <td>$${data.total || 0}</td>
          <td>${data.date?.toDate()?.toLocaleDateString() || 'N/A'}</td>
          <td>
            <a href="/receipts/${userId}/${doc.id}" class="btn btn-primary">View</a>
            <a href="/receipts/${userId}/${doc.id}/delete" class="btn btn-danger" onclick="return confirm('Delete this receipt?')">Delete</a>
          </td>
        </tr>
      `;
    });

    const content = `
        <h2>Receipts (${receipts.size})</h2>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Store</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;

    res.send(getHtmlTemplate('Receipts', content));
  } catch (error) {
    res.send(getHtmlTemplate('Error', `<div class="alert alert-error">Error loading receipts: ${error.message}</div>`));
  }
});

app.get('/prices', async (req, res) => {
  try {
    const prices = await db.collectionGroup('prices').orderBy('recordedAt', 'desc').limit(50).get();

    let tableRows = '';
    prices.docs.forEach(doc => {
      const data = doc.data();
      tableRows += `
        <tr>
          <td>${data.productName || 'N/A'}</td>
          <td>${data.storeName || 'N/A'}</td>
          <td>${data.price || 0} ${data.currency || 'USD'}</td>
          <td>${data.recordedAt?.toDate()?.toLocaleDateString() || 'N/A'}</td>
        </tr>
      `;
    });

    const content = `
        <h2>Prices (${prices.size})</h2>
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Store</th>
                    <th>Price</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;

    res.send(getHtmlTemplate('Prices', content));
  } catch (error) {
    console.error('❌ Error loading prices:', error);
    res.send(getHtmlTemplate('Error', `<div class="alert alert-error">Error loading prices: ${error.message}</div>`));
  }
});

app.get('/analytics', async (req, res) => {
  try {
    // Get various analytics
    const users = await auth.listUsers();
    const receipts = await db.collectionGroup('receipts').get();
    const alerts = await db.collectionGroup('priceAlerts').get();

    // Calculate spending by month
    const monthlySpending = {};
    receipts.docs.forEach(doc => {
      const data = doc.data();
      const date = data.date?.toDate();
      if (date) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + (data.total || 0);
      }
    });

    // Calculate category breakdown
    const categories = {};
    receipts.docs.forEach(doc => {
      const data = doc.data();
      (data.items || []).forEach(item => {
        const cat = item.category || 'Other';
        categories[cat] = (categories[cat] || 0) + ((item.unitPrice || 0) * (item.quantity || 1));
      });
    });

    const topCategories = Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    const content = `
        <h2>Analytics Dashboard</h2>

        <h3>Summary</h3>
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${users.users.length}</div>
                <div>Registered Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${receipts.size}</div>
                <div>Total Receipts</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${alerts.size}</div>
                <div>Price Alerts</div>
            </div>
        </div>

        <h3>Monthly Spending</h3>
        <table>
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Total Spending</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(monthlySpending).sort().reverse().map(([month, total]) =>
                  `<tr><td>${month}</td><td>$${total.toFixed(2)}</td></tr>`
                ).join('')}
            </tbody>
        </table>

        <h3>Top Categories</h3>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Total Spent</th>
                </tr>
            </thead>
            <tbody>
                ${topCategories.map(([category, total]) =>
                  `<tr><td>${category}</td><td>$${total.toFixed(2)}</td></tr>`
                ).join('')}
            </tbody>
        </table>
    `;

    res.send(getHtmlTemplate('Analytics', content));
  } catch (error) {
    res.send(getHtmlTemplate('Error', `<div class="alert alert-error">Error loading analytics: ${error.message}</div>`));
  }
});

app.get('/notifications', (req, res) => {
  const content = `
        <h2>📢 Send Notifications</h2>

        <h3>Broadcast to All Users</h3>
        <form method="POST" action="/notifications/broadcast">
            <div class="form-group">
                <label for="broadcastTitle">Title:</label>
                <input type="text" id="broadcastTitle" name="title" required placeholder="Notification title">
            </div>
            <div class="form-group">
                <label for="broadcastBody">Message:</label>
                <textarea id="broadcastBody" name="body" required placeholder="Notification message" rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-success">📢 Send Broadcast</button>
        </form>

        <hr>

        <h3>Send to Specific User</h3>
        <form method="POST" action="/notifications/user">
            <div class="form-group">
                <label for="userId">User ID:</label>
                <input type="text" id="userId" name="userId" required placeholder="User ID">
            </div>
            <div class="form-group">
                <label for="userTitle">Title:</label>
                <input type="text" id="userTitle" name="title" required placeholder="Notification title">
            </div>
            <div class="form-group">
                <label for="userBody">Message:</label>
                <textarea id="userBody" name="body" required placeholder="Notification message" rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">📤 Send to User</button>
        </form>

        <hr>

        <h3>Scheduled Notifications</h3>
        <div class="stats">
            <div class="stat-card">
                <div>Saturday 10:00 AM</div>
                <div>Weekly Savings Tips</div>
            </div>
            <div class="stat-card">
                <div>On Achievement</div>
                <div>Achievement Unlocked</div>
            </div>
            <div class="stat-card">
                <div>On Sync Complete</div>
                <div>Offline Sync Done</div>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Notifications', content));
});

app.post('/notifications/broadcast', async (req, res) => {
  try {
    const { title, body } = req.body;

    if (!title || !body) {
      return res.send(getHtmlTemplate('Error', '<div class="alert alert-error">Title and body are required</div>'));
    }

    // Get all users with FCM tokens
    const usersSnapshot = await db.collectionGroup('users').get();
    const notifications = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.fcmToken) {
        notifications.push({
          token: userData.fcmToken,
          notification: {
            title,
            body,
          },
          data: {
            type: 'admin_broadcast',
            sentAt: new Date().toISOString(),
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'admin_broadcast',
              icon: 'ic_notification',
              color: '#10b981',
            },
          },
          apns: {
            payload: {
              aps: {
                badge: 1,
                sound: 'default',
              },
            },
          },
        });
      }
    }

    if (notifications.length === 0) {
      return res.send(getHtmlTemplate('Notifications', '<div class="alert alert-error">No users with FCM tokens found</div>'));
    }

    // Send in batches of 500 (FCM limit)
    const batchSize = 500;
    let totalSent = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const response = await messaging.sendAll(batch);
      totalSent += response.successCount;
    }

    const content = `
        <div class="alert alert-success">✅ Broadcast sent successfully!</div>
        <p><strong>Sent to:</strong> ${totalSent} users</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Message:</strong> ${body}</p>
        <p><a href="/notifications" class="btn btn-primary">Send Another</a></p>
    `;

    res.send(getHtmlTemplate('Broadcast Sent', content));

  } catch (error) {
    res.send(getHtmlTemplate('Error', `<div class="alert alert-error">Error sending broadcast: ${error.message}</div>`));
  }
});

app.post('/notifications/user', async (req, res) => {
  try {
    const { userId, title, body } = req.body;

    if (!userId || !title || !body) {
      return res.send(getHtmlTemplate('Error', '<div class="alert alert-error">User ID, title and body are required</div>'));
    }

    // Get user's FCM token
    const userDoc = await db.doc(`artifacts/${config.app.id}/users/${userId}`).get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      return res.send(getHtmlTemplate('Notifications', '<div class="alert alert-error">User not found or no FCM token available</div>'));
    }

    // Send notification
    await messaging.send({
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: {
        type: 'admin_broadcast',
        sentAt: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'admin_broadcast',
          icon: 'ic_notification',
          color: '#10b981',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
    });

    const content = `
        <div class="alert alert-success">✅ Notification sent successfully!</div>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Message:</strong> ${body}</p>
        <p><a href="/notifications" class="btn btn-primary">Send Another</a></p>
    `;

    res.send(getHtmlTemplate('Notification Sent', content));

  } catch (error) {
    res.send(getHtmlTemplate('Error', `<div class="alert alert-error">Error sending notification: ${error.message}</div>`));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🔥 GoShopperAI Admin Panel running at http://localhost:${PORT}`);
  console.log(`📊 Access the web interface in your browser`);
});