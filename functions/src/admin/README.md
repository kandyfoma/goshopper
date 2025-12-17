# Firebase Admin Tools

This directory contains admin tools for managing the GoShopper Firebase database.

## Available Tools

### 1. CLI Admin Tool (`admin.js`)

Command-line interface for database administration.

**Usage:**

```bash
cd functions
npm run admin
```

**Features:**

- List all users
- View user details
- Delete users (with data cleanup)
- List user receipts
- Delete receipts
- View price data
- Export user data
- Run analytics
- Clear test data

### 2. Web Admin Panel (`web-admin.js`)

Browser-based admin interface for easy database management.

**Usage:**

```bash
cd functions
npm run admin:web
```

Then open `http://localhost:3001` in your browser.

**Features:**

- Dashboard with key metrics
- User management (view, delete)
- Receipt browsing
- Analytics and reporting
- Real-time data views

## Setup

1. **Install dependencies:**

   ```bash
   cd functions
   npm install
   ```

2. **Configure Firebase:**

   - Update `.firebaserc` with your actual Firebase project ID
   - Ensure Firebase Admin SDK has proper permissions

3. **Run the tools:**
   - CLI: `npm run admin`
   - Web: `npm run admin:web`

## Security Notes

- These tools have full database access
- Use only in development/testing environments
- Never deploy to production
- Consider adding authentication for the web admin in production

## Firebase Console Alternative

For basic operations, you can also use the [Firebase Console](https://console.firebase.google.com):

- Authentication → Users
- Firestore Database → Collections
- Functions → Logs
- Storage → Files

The admin tools provide more advanced operations and bulk actions not available in the console.
