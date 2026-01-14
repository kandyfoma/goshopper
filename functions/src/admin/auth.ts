/**
 * Admin Authentication Helpers
 * Functions to verify admin access for Firebase Functions
 */

import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

/**
 * Check if a user has admin privileges
 * @param userId - Firebase Auth UID
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    
    if (!userDoc.exists) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData?.is_admin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Verify that the current user is an admin
 * Throws an error if user is not authenticated or not an admin
 * @param context - Firebase Functions HTTPS context
 * @throws HttpsError if not authenticated or not admin
 */
export async function requireAdmin(context: any): Promise<void> {
  if (!context.auth) {
    throw new Error('Authentication required');
  }
  
  const userId = context.auth.uid;
  const isUserAdmin = await isAdmin(userId);
  
  if (!isUserAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
}

/**
 * Middleware for Express routes to check admin access
 * Use with Firebase ID token in Authorization header
 */
export async function adminAuthMiddleware(req: any, res: any, next: any) {
  try {
    // Get the ID token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Unauthorized - GoShopperAI Admin</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                }
                .error-card {
                    background: white;
                    padding: 3rem;
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 400px;
                }
                h1 { color: #dc2626; margin: 0 0 1rem 0; }
                p { color: #6b7280; margin: 0 0 2rem 0; }
                a {
                    background: #10b981;
                    color: white;
                    padding: 0.75rem 2rem;
                    border-radius: 8px;
                    text-decoration: none;
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div class="error-card">
                <h1>🔒 Unauthorized</h1>
                <p>You need to be logged in as an admin to access this page.</p>
                <a href="/">Login</a>
            </div>
        </body>
        </html>
      `);
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    
    // Check if user is admin
    const isUserAdmin = await isAdmin(userId);
    
    if (!isUserAdmin) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Access Denied - GoShopperAI Admin</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                }
                .error-card {
                    background: white;
                    padding: 3rem;
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 400px;
                }
                h1 { color: #dc2626; margin: 0 0 1rem 0; }
                p { color: #6b7280; margin: 0; }
            </style>
        </head>
        <body>
            <div class="error-card">
                <h1>⛔ Access Denied</h1>
                <p>You do not have admin privileges to access this panel.</p>
            </div>
        </body>
        </html>
      `);
    }
    
    // Store user info for use in routes
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Authentication Error - GoShopperAI Admin</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0;
              }
              .error-card {
                  background: white;
                  padding: 3rem;
                  border-radius: 16px;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                  text-align: center;
                  max-width: 400px;
              }
              h1 { color: #dc2626; margin: 0 0 1rem 0; }
              p { color: #6b7280; margin: 0; }
          </style>
      </head>
      <body>
          <div class="error-card">
              <h1>❌ Authentication Error</h1>
              <p>Invalid or expired authentication token.</p>
          </div>
      </body>
      </html>
    `);
  }
}
