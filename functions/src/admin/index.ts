/**
 * Admin Panel Firebase Function
 * Serves the admin web interface as a Firebase HTTPS Function
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {config} from '../config';

const db = admin.firestore();

// This will be the main admin panel function
export const adminPanel = functions
  .region(config.app.region)
  .https.onRequest(async (req, res) => {
    // Check if this is the login page request
    if (req.path === '/' || req.path === '/login') {
      return serveLoginPage(res);
    }
    
    // Check if authenticated via session/cookie
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.redirect('/login');
    }
    
    // Verify user is admin
    try {
      const userDoc = await db
        .collection('artifacts')
        .doc('goshopper')
        .collection('users')
        .doc(userId)
        .get();
      
      if (!userDoc.exists || !userDoc.data()?.is_admin) {
        return serveAccessDeniedPage(res);
      }
      
      // User is admin, serve admin panel
      return serveAdminDashboard(res, userId);
    } catch (error) {
      console.error('Admin panel error:', error);
      res.status(500).send('Internal server error');
    }
  });

/**
 * Serve the login page for admin authentication
 */
function serveLoginPage(res: any) {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - GoShopperAI</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-card {
            background: white;
            padding: 3rem;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 100%;
        }
        
        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .logo-icon {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: white;
            margin-bottom: 1rem;
        }
        
        h1 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #111827;
            margin-bottom: 0.5rem;
            text-align: center;
        }
        
        p {
            color: #6b7280;
            text-align: center;
            margin-bottom: 2rem;
            font-size: 0.875rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        label {
            display: block;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #374151;
            font-size: 0.875rem;
        }
        
        input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 0.875rem;
            font-family: inherit;
            transition: border-color 0.2s;
        }
        
        input:focus {
            outline: none;
            border-color: #10b981;
        }
        
        button {
            width: 100%;
            padding: 0.875rem;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        button:hover {
            transform: translateY(-2px);
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .error {
            background: #fee2e2;
            color: #dc2626;
            padding: 0.75rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            font-size: 0.875rem;
            display: none;
        }
        
        .loading {
            display: none;
            text-align: center;
            margin-top: 1rem;
            color: #6b7280;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="login-card">
        <div class="logo">
            <div class="logo-icon">🛒</div>
            <h1>Admin Panel</h1>
            <p>Sign in with your admin account</p>
        </div>
        
        <div class="error" id="error"></div>
        
        <form id="loginForm">
            <div class="form-group" id="phoneGroup">
                <label for="phone">Admin Phone Number</label>
                <input type="tel" id="phone" name="phone" placeholder="+243828812498" required>
            </div>
            
            <div class="form-group" id="otpGroup" style="display: none;">
                <label for="otp">Enter OTP Code</label>
                <input type="text" id="otp" name="otp" placeholder="123456" maxlength="6">
            </div>
            
            <button type="submit" id="loginBtn">Send OTP</button>
            <div class="loading" id="loading">Processing...</div>
        </form>
    </div>
    
    <div id="recaptcha-container"></div>

    <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
    <script>
        // Initialize Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyCtJUo1dPGSfUAjMIShOFRSK0iLfI15TDM",
            authDomain: "goshopperai.firebaseapp.com",
            projectId: "goshopperai",
            storageBucket: "goshopperai.firebasestorage.app",
            messagingSenderId: "427625756513",
            appId: "1:427625756513:android:e5c7c1d47dc0a80b6c0ff3"
        };
        
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();
        
        const form = document.getElementById('loginForm');
        const errorDiv = document.getElementById('error');
        const loadingDiv = document.getElementById('loading');
        const loginBtn = document.getElementById('loginBtn');
        const phoneGroup = document.getElementById('phoneGroup');
        const otpGroup = document.getElementById('otpGroup');
        const phoneInput = document.getElementById('phone');
        const otpInput = document.getElementById('otp');
        
        let confirmationResult = null;
        let isOtpSent = false;
        
        // Initialize reCAPTCHA
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                console.log('reCAPTCHA solved');
            }
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            errorDiv.style.display = 'none';
            loadingDiv.style.display = 'block';
            loginBtn.disabled = true;
            
            try {
                if (!isOtpSent) {
                    // Step 1: Send OTP
                    const phoneNumber = phoneInput.value.trim();
                    
                    if (!phoneNumber.startsWith('+')) {
                        throw new Error('Phone number must include country code (e.g., +243...)');
                    }
                    
                    const appVerifier = window.recaptchaVerifier;
                    confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, appVerifier);
                    
                    // Switch to OTP input
                    isOtpSent = true;
                    phoneGroup.style.display = 'none';
                    otpGroup.style.display = 'block';
                    loginBtn.textContent = 'Verify OTP';
                    errorDiv.textContent = 'OTP sent to your phone!';
                    errorDiv.style.backgroundColor = '#d1fae5';
                    errorDiv.style.color = '#065f46';
                    errorDiv.style.display = 'block';
                    
                } else {
                    // Step 2: Verify OTP
                    const code = otpInput.value.trim();
                    
                    if (!code || code.length !== 6) {
                        throw new Error('Please enter a valid 6-digit OTP');
                    }
                    
                    const result = await confirmationResult.confirm(code);
                    const user = result.user;
                    
                    // Check if user is admin
                    const userDoc = await db
                        .collection('artifacts')
                        .doc('goshopper')
                        .collection('users')
                        .doc(user.uid)
                        .get();
                    
                    if (!userDoc.exists || !userDoc.data().is_admin) {
                        await auth.signOut();
                        throw new Error('You do not have admin access');
                    }
                    
                    // Success! Redirect to admin panel
                    loadingDiv.textContent = 'Login successful! Redirecting...';
                    setTimeout(() => {
                        window.location.href = 'https://us-central1-goshopperai.cloudfunctions.net/adminPanel/users';
                    }, 1000);
                }
                
            } catch (error) {
                console.error('Login error:', error);
                errorDiv.textContent = error.message || 'Authentication failed. Please try again.';
                errorDiv.style.backgroundColor = '#fee2e2';
                errorDiv.style.color = '#dc2626';
                errorDiv.style.display = 'block';
                
                // Reset if OTP verification failed
                if (isOtpSent && error.code === 'auth/invalid-verification-code') {
                    isOtpSent = false;
                    phoneGroup.style.display = 'block';
                    otpGroup.style.display = 'none';
                    loginBtn.textContent = 'Send OTP';
                }
            } finally {
                loadingDiv.style.display = 'none';
                loginBtn.disabled = false;
            }
        });
        
        // Check if already logged in
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const idToken = await user.getIdToken();
                localStorage.setItem('adminToken', idToken);
                // Could redirect to dashboard
            }
        });
    </script>
</body>
</html>
  `);
}

/**
 * Serve access denied page for non-admin users
 */
function serveAccessDeniedPage(res: any) {
  res.status(403).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied - GoShopper Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #C1121F 0%, #780000 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }
        .message-card {
            background: white;
            padding: 3rem;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            text-align: center;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            font-size: 1.5rem;
            color: #dc2626;
            margin-bottom: 1rem;
        }
        p {
            color: #6b7280;
            margin-bottom: 2rem;
        }
        a {
            display: inline-block;
            padding: 0.875rem 2rem;
            background: linear-gradient(135deg, #C1121F, #780000);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="message-card">
        <div class="icon">🚫</div>
        <h1>Access Denied</h1>
        <p>You do not have permission to access the admin panel. Only authorized administrators can access this area.</p>
        <a href="/login">Back to Login</a>
    </div>
</body>
</html>
  `);
}

/**
 * Serve the main admin dashboard
 */
function serveAdminDashboard(res: any, userId: string) {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoShopper Admin Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f9fafb;
            padding: 2rem;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            font-size: 2rem;
            color: #111827;
            margin-bottom: 2rem;
        }
        .message {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        a {
            color: #C1121F;
            text-decoration: none;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛒 GoShopper Admin Dashboard</h1>
        <div class="message">
            <p>Welcome, Admin! Your user ID: ${userId}</p>
            <p style="margin-top: 1rem;">
                For full admin panel features, please use the local admin panel at 
                <a href="http://localhost:3001" target="_blank">localhost:3001</a>
            </p>
            <p style="margin-top: 1rem;">
                <a href="/login">Logout</a>
            </p>
        </div>
    </div>
</body>
</html>
  `);
}
