/**
 * Web Admin Interface
 * Simple web-based admin panel for Firebase database management
 * Run with: npm run admin:web
 */

const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const {config} = require('../../lib/config');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Firebase Admin
// Check if already initialized (to avoid double initialization)
if (!admin.apps.length) {
  // Build absolute path to service account key
  const serviceAccountPath = path.resolve(
    __dirname,
    '../../serviceAccountKey.json',
  );

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf8'),
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log(
        '✅ Firebase initialized with service account:',
        serviceAccount.project_id,
      );
    } catch (error) {
      console.error('❌ Error loading service account:', error.message);
      process.exit(1);
    }
  } else {
    console.error('❌ Service account key not found at:', serviceAccountPath);
    console.error(
      'Please download it from Firebase Console > Project Settings > Service Accounts',
    );
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({extended: true}));

// Modern HTML template with GoShopperAI branding
function getHtmlTemplate(title, content, activePage = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - GoShopperAI Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary: #003049; /* Blue for submit buttons */
            --primary-dark: #001a2e;
            --primary-light: #e6f3ff;
            --secondary: #003049;
            --danger: #C1121F; /* Red for delete/cancel buttons */
            --warning: #f59e0b;
            --success: #22C55E;
            --info: #669BBC;
            --dark: #780000;
            --gray-50: #f9fafb;
            --gray-100: #f3f4f6;
            --gray-200: #e5e7eb;
            --gray-300: #d1d5db;
            --gray-400: #9ca3af;
            --gray-500: #6b7280;
            --gray-600: #4b5563;
            --gray-700: #374151;
            --gray-800: #1f2937;
            --gray-900: #780000;
            --shadow-sm: 0 1px 2px 0 rgba(120, 0, 0, 0.05);
            --shadow: 0 1px 3px 0 rgba(120, 0, 0, 0.1), 0 1px 2px 0 rgba(120, 0, 0, 0.06);
            --shadow-md: 0 4px 6px -1px rgba(120, 0, 0, 0.1), 0 2px 4px -1px rgba(120, 0, 0, 0.06);
            --shadow-lg: 0 10px 15px -3px rgba(120, 0, 0, 0.1), 0 4px 6px -2px rgba(120, 0, 0, 0.05);
            --shadow-xl: 0 20px 25px -5px rgba(120, 0, 0, 0.1), 0 10px 10px -5px rgba(120, 0, 0, 0.04);
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f9fafb;
            min-height: 100vh;
            color: var(--gray-800);
            line-height: 1.6;
        }
        
        .app-container {
            display: flex;
            min-height: 100vh;
        }
        
        /* Sidebar */
        .sidebar {
            width: 280px;
            background: white;
            box-shadow: var(--shadow-xl);
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            z-index: 1000;
        }
        
        .sidebar-header {
            padding: 2rem 1.5rem;
            border-bottom: 1px solid var(--gray-200);
            background: white;
        }
        
        .logo {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: var(--gray-900);
            text-decoration: none;
        }
        
        .logo-text h1 {
            font-size: 1.25rem;
            font-weight: 700;
            margin: 0;
            color: var(--gray-900);
        }
        
        .nav-menu {
            padding: 1.5rem 0;
        }
        
        .nav-section {
            margin-bottom: 2rem;
        }
        
        .nav-section-title {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--gray-500);
            padding: 0 1.5rem;
            margin-bottom: 0.5rem;
        }
        
        .nav-link {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1.5rem;
            color: var(--gray-700);
            text-decoration: none;
            transition: all 0.2s;
            border-left: 3px solid transparent;
            font-weight: 500;
        }
        
        .nav-link:hover {
            background: var(--gray-50);
            color: var(--primary);
            border-left-color: var(--primary);
        }
        
        .nav-link.active {
            background: var(--primary-light);
            color: var(--primary-dark);
            border-left-color: var(--primary);
        }
        
        .nav-link i {
            width: 20px;
            text-align: center;
            font-size: 1.1rem;
        }
        
        .nav-badge {
            margin-left: auto;
            background: var(--primary);
            color: white;
            font-size: 0.7rem;
            padding: 0.2rem 0.5rem;
            border-radius: 10px;
            font-weight: 600;
        }
        
        .logout-section {
            padding: 1.5rem;
            border-top: 1px solid var(--gray-200);
        }
        
        .logout-btn {
            width: 100%;
            padding: 0.75rem;
            background: var(--danger);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            transition: all 0.2s;
        }
        
        .logout-btn:hover {
            background: #dc2626;
            transform: translateY(-1px);
        }
        
        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: 280px;
            padding: 2rem;
        }
        
        .top-bar {
            background: white;
            padding: 1.5rem 2rem;
            border-radius: 16px;
            box-shadow: var(--shadow-md);
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .page-title {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .page-title h2 {
            font-size: 1.875rem;
            font-weight: 700;
            color: var(--gray-900);
            margin: 0;
        }
        
        .page-title .breadcrumb {
            font-size: 0.875rem;
            color: var(--gray-500);
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        
        .top-bar-actions {
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        
        .search-box {
            position: relative;
        }
        
        .search-box input {
            padding: 0.65rem 1rem 0.65rem 2.75rem;
            border: 1px solid var(--gray-300);
            border-radius: 10px;
            width: 300px;
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        
        .search-box input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }
        
        .search-box i {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--gray-400);
        }
        
        /* Cards */
        .content-card {
            background: white;
            border-radius: 16px;
            padding: 2rem;
            box-shadow: var(--shadow-md);
            margin-bottom: 2rem;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: white;
            border-radius: 16px;
            padding: 1.75rem;
            box-shadow: var(--shadow-md);
            border: 1px solid var(--gray-100);
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
        }
        
        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
        }
        
        .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-lg);
        }
        
        .stat-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }
        
        .stat-icon {
            width: 56px;
            height: 56px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }
        
        .stat-icon.primary { background: var(--primary-light); color: var(--primary); }
        .stat-icon.secondary { background: #dbeafe; color: var(--secondary); }
        .stat-icon.warning { background: #fef3c7; color: var(--warning); }
        .stat-icon.danger { background: #fee2e2; color: var(--danger); }
        .stat-icon.info { background: #cffafe; color: var(--info); }
        .stat-icon.success { background: var(--primary-light); color: var(--success); }
        
        .stat-content h3 {
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--gray-600);
            margin-bottom: 0.5rem;
        }
        
        .stat-number {
            font-size: 2.25rem;
            font-weight: 700;
            color: var(--gray-900);
            line-height: 1;
            margin-bottom: 0.5rem;
        }
        
        .stat-change {
            font-size: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        
        .stat-change.positive { color: var(--success); }
        .stat-change.negative { color: var(--danger); }
        
        /* Tables */
        .table-container {
            overflow-x: auto;
            border-radius: 12px;
            border: 1px solid var(--gray-200);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        
        thead {
            background: var(--gray-50);
            border-bottom: 2px solid var(--gray-200);
        }
        
        th {
            padding: 1rem 1.5rem;
            text-align: left;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--gray-600);
        }
        
        td {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--gray-100);
            font-size: 0.875rem;
            color: var(--gray-700);
        }
        
        tbody tr {
            transition: all 0.2s;
        }
        
        tbody tr:hover {
            background: var(--gray-50);
        }
        
        tbody tr:last-child td {
            border-bottom: none;
        }
        
        /* Buttons */
        .btn {
            padding: 0.65rem 1.25rem;
            border: none;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
            white-space: nowrap;
        }
        
        .btn-primary {
            background: var(--primary);
            color: white;
        }
        
        .btn-primary:hover {
            background: var(--primary-dark);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }
        
        .btn-secondary {
            background: var(--secondary);
            color: white;
        }
        
        .btn-secondary:hover {
            background: #2563eb;
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }
        
        .btn-danger {
            background: var(--danger);
            color: white;
        }
        
        .btn-danger:hover {
            background: #dc2626;
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }
        
        .btn-success {
            background: var(--success);
            color: white;
        }
        
        .btn-success:hover {
            background: var(--primary-dark);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }
        
        .btn-outline {
            background: transparent;
            border: 1.5px solid var(--gray-300);
            color: var(--gray-700);
        }
        
        .btn-outline:hover {
            border-color: var(--primary);
            color: var(--primary);
            background: var(--primary-light);
        }
        
        .btn-sm {
            padding: 0.4rem 0.85rem;
            font-size: 0.8rem;
        }
        
        .btn-lg {
            padding: 0.875rem 1.75rem;
            font-size: 1rem;
        }
        
        .btn-group {
            display: flex;
            gap: 0.5rem;
        }
        
        /* Badges */
        .badge {
            padding: 0.35rem 0.75rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
        }
        
        .badge-primary { background: var(--primary-light); color: var(--primary-dark); }
        .badge-secondary { background: #dbeafe; color: #1e40af; }
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-info { background: #cffafe; color: #155e75; }
        
        /* Alerts */
        .alert {
            padding: 1rem 1.25rem;
            border-radius: 10px;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            border-left: 4px solid;
        }
        
        .alert i {
            font-size: 1.25rem;
            margin-top: 0.1rem;
        }
        
        .alert-success {
            background: #d1fae5;
            color: #065f46;
            border-color: var(--success);
        }
        
        .alert-error {
            background: #fee2e2;
            color: #991b1b;
            border-color: var(--danger);
        }
        
        .alert-warning {
            background: #fef3c7;
            color: #92400e;
            border-color: var(--warning);
        }
        
        .alert-info {
            background: #dbeafe;
            color: #1e40af;
            border-color: var(--secondary);
        }
        
        /* Forms */
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        label {
            display: block;
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--gray-700);
            margin-bottom: 0.5rem;
        }
        
        input, select, textarea {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1.5px solid var(--gray-300);
            border-radius: 8px;
            font-size: 0.875rem;
            transition: all 0.2s;
            font-family: inherit;
        }
        
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }
        
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        /* Pagination */
        .pagination {
            display: flex;
            gap: 0.5rem;
            justify-content: center;
            margin-top: 2rem;
            padding: 1rem 0;
        }
        
        .pagination-btn {
            padding: 0.5rem 0.875rem;
            border: 1px solid var(--gray-300);
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 500;
            font-size: 0.875rem;
        }
        
        .pagination-btn:hover {
            border-color: var(--primary);
            background: var(--primary-light);
            color: var(--primary-dark);
        }
        
        .pagination-btn.active {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }
        
        /* Filters */
        .filters-bar {
            background: var(--gray-50);
            padding: 1.25rem;
            border-radius: 10px;
            margin-bottom: 1.5rem;
            display: flex;
            gap: 1rem;
            align-items: end;
            flex-wrap: wrap;
        }
        
        .filter-group {
            flex: 1;
            min-width: 200px;
        }
        
        .filter-group label {
            font-size: 0.75rem;
            color: var(--gray-600);
        }
        
        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 4rem 2rem;
            color: var(--gray-500);
        }
        
        .empty-state i {
            font-size: 4rem;
            margin-bottom: 1rem;
            opacity: 0.3;
        }
        
        .empty-state h3 {
            font-size: 1.25rem;
            color: var(--gray-700);
            margin-bottom: 0.5rem;
        }
        
        /* User Avatar */
        .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 0.875rem;
        }
        
        .user-info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .user-details h4 {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--gray-900);
            margin: 0 0 0.15rem 0;
        }
        
        .user-details p {
            font-size: 0.75rem;
            color: var(--gray-500);
            margin: 0;
        }
        
        /* Loading */
        .spinner {
            border: 3px solid var(--gray-200);
            border-top-color: var(--primary);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 0.8s linear infinite;
            margin: 2rem auto;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
            .sidebar {
                transform: translateX(-100%);
            }
            
            .main-content {
                margin-left: 0;
            }
            
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 640px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
            
            .search-box input {
                width: 200px;
            }
            
            .top-bar {
                flex-direction: column;
                gap: 1rem;
                align-items: stretch;
            }
        }
    </style>
</head>
<body>
    <div class="app-container">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <a href="/" class="logo">
                    <div class="logo-text">
                        <h1>GoShopper Admin</h1>
                    </div>
                </a>
            </div>
            
            <nav class="nav-menu">
                <div class="nav-section">
                    <div class="nav-section-title">Main</div>
                    <a href="/" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">
                        <span>Dashboard</span>
                    </a>
                </div>
                
                <div class="nav-section">
                    <div class="nav-section-title">Management</div>
                    <a href="/users" class="nav-link ${activePage === 'users' ? 'active' : ''}">
                        <span>Users</span>
                    </a>
                    <a href="/receipts" class="nav-link ${activePage === 'receipts' ? 'active' : ''}">
                        <span>Receipts</span>
                    </a>
                    <a href="/items" class="nav-link ${activePage === 'items' ? 'active' : ''}">
                        <span>Items</span>
                    </a>
                    <a href="/prices" class="nav-link ${activePage === 'prices' ? 'active' : ''}">
                        <span>Prices</span>
                    </a>
                    <a href="/alerts" class="nav-link ${activePage === 'alerts' ? 'active' : ''}">
                        <span>Price Alerts</span>
                    </a>
                </div>
                
                <div class="nav-section">
                    <div class="nav-section-title">Tools</div>
                    <a href="/analytics" class="nav-link ${activePage === 'analytics' ? 'active' : ''}">
                        <span>Analytics</span>
                    </a>
                    <a href="/notifications" class="nav-link ${activePage === 'notifications' ? 'active' : ''}">
                        <span>Notifications</span>
                    </a>
                </div>
            </nav>
            
            <div class="logout-section">
                <button class="logout-btn" onclick="handleLogout()">
                    <span>Logout</span>
                </button>
            </div>
        </aside>
        
        <!-- Main Content -->
        <main class="main-content">
            ${content}
        </main>
    </div>
    
    <script>
        // Search functionality
        document.addEventListener('DOMContentLoaded', function() {
            const searchInputs = document.querySelectorAll('[data-search]');
            searchInputs.forEach(input => {
                input.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    const tableRows = document.querySelectorAll('tbody tr');
                    
                    tableRows.forEach(row => {
                        const text = row.textContent.toLowerCase();
                        row.style.display = text.includes(searchTerm) ? '' : 'none';
                    });
                });
            });
            
            // Confirm delete actions
            document.querySelectorAll('[data-confirm]').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    if (!confirm(this.dataset.confirm)) {
                        e.preventDefault();
                    }
                });
            });
        });
    </script>
    
    <script>
        // Logout function
        function handleLogout() {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/';
            }
        }
    </script>
</body>
</html>`;
}

// Helper function to format currency based on the currency code
function formatCurrency(amount, currency = 'USD') {
  if (!amount && amount !== 0) return 'N/A';
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (currency === 'CDF' || currency === 'FC') {
    return `${numAmount.toFixed(0)} FC`;
  }
  
  return `$${numAmount.toFixed(2)}`;
}

// Helper function to safely convert dates
function formatDate(dateField) {
  if (!dateField) return 'N/A';
  
  try {
    // If it's a Firestore Timestamp
    if (dateField.toDate && typeof dateField.toDate === 'function') {
      return dateField.toDate().toLocaleDateString();
    }
    // If it's already a Date object
    if (dateField instanceof Date) {
      return dateField.toLocaleDateString();
    }
    // If it's a string or number, try to parse it
    const date = new Date(dateField);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
  } catch (error) {
    console.error('Error formatting date:', error);
  }
  
  return 'N/A';
}

function getDateValue(dateField) {
  if (!dateField) return new Date(0);
  
  try {
    if (dateField.toDate && typeof dateField.toDate === 'function') {
      return dateField.toDate();
    }
    if (dateField instanceof Date) {
      return dateField;
    }
    const date = new Date(dateField);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (error) {
    console.error('Error getting date value:', error);
  }
  
  return new Date(0);
}

// Routes
app.get('/', async (req, res) => {
  try {
    console.log('Loading dashboard...');

    // Get basic stats
    console.log('Fetching users...');
    let users = {users: []};
    let authError = null;
    try {
      users = await auth.listUsers();
      console.log(`Found ${users.users.length} users`);
    } catch (error) {
      authError = error;
      console.error(
        '❌ Error fetching users (Auth not configured?):',
        error.message,
      );
      // Continue without users
    }

    console.log('Fetching receipts...');
    const receipts = await db.collectionGroup('receipts').get();
    console.log(`Found ${receipts.size} receipts`);

    console.log('Fetching alerts...');
    const alerts = await db
      .collectionGroup('priceAlerts')
      .where('isActive', '==', true)
      .get();
    console.log(`Found ${alerts.size} alerts`);

    let totalSpending = 0;
    receipts.docs.forEach(doc => {
      totalSpending += doc.data().total || 0;
    });

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Dashboard</h2>
            </div>
            <div class="top-bar-actions">
                <span class="badge badge-success">Live</span>
            </div>
        </div>
        
        ${
          authError
            ? `<div class="alert alert-warning"><div><strong>Warning:</strong> Authentication service not accessible. User stats may be incomplete.</div></div>`
            : ''
        }
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon primary">
                        
                    </div>
                </div>
                <div class="stat-content">
                    <h3>Total Users</h3>
                    <div class="stat-number">${users.users.length.toLocaleString()}</div>
                    <div class="stat-change positive">
                        
                        <span>Active users</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon secondary">
                        
                    </div>
                </div>
                <div class="stat-content">
                    <h3>Total Receipts</h3>
                    <div class="stat-number">${receipts.size.toLocaleString()}</div>
                    <div class="stat-change positive">
                        
                        <span>Scanned receipts</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon warning">
                        
                    </div>
                </div>
                <div class="stat-content">
                    <h3>Total Spending</h3>
                    <div class="stat-number">$${totalSpending.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
                    <div class="stat-change">
                        
                        <span>Tracked spending</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon info">
                        
                    </div>
                </div>
                <div class="stat-content">
                    <h3>Active Alerts</h3>
                    <div class="stat-number">${alerts.size.toLocaleString()}</div>
                    <div class="stat-change">
                        
                        <span>Price alerts</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="content-card">
            <h3 style="margin-bottom: 1.5rem; font-size: 1.25rem; font-weight: 700; color: var(--gray-900);">Quick Actions</h3>
            <div class="btn-group">
                <a href="/users" class="btn btn-primary">Manage Users</a>
                <a href="/receipts" class="btn btn-secondary">View Receipts</a>
                <a href="/analytics" class="btn btn-success">Analytics</a>
                <a href="/notifications" class="btn btn-outline">Send Notification</a>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Dashboard', content, 'dashboard'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading dashboard</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/" class="btn btn-primary">Retry</a>
        </div>`,
        'dashboard'
      ),
    );
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await auth.listUsers();
    let tableRows = '';

    for (const user of users.users) {
      const userDoc = await db
        .doc(`artifacts/${config.app.id}/users/${user.uid}`)
        .get();
      const profile = userDoc.exists ? userDoc.data() : {};

      const initials = (user.displayName || user.email || 'U').substring(0, 2).toUpperCase();
      
      tableRows += `
        <tr>
          <td>
            <div class="user-info">
              <div class="user-avatar">${initials}</div>
              <div class="user-details">
                <h4>${user.displayName || 'Anonymous User'} ${profile.is_admin ? '<span class="badge badge-warning" style="font-size: 0.7rem; margin-left: 0.5rem;">Admin</span>' : ''}</h4>
                <p>${user.uid.substring(0, 12)}...</p>
              </div>
            </div>
          </td>
          <td>
            ${user.email ? `<div><i class="fas fa-envelope" style="color: var(--gray-400); margin-right: 0.5rem;"></i>${user.email}</div>` : ''}
            ${user.phoneNumber ? `<div><i class="fas fa-phone" style="color: var(--gray-400); margin-right: 0.5rem;"></i>${user.phoneNumber}</div>` : ''}
            ${!user.email && !user.phoneNumber ? '<span class="badge badge-secondary">No contact</span>' : ''}
          </td>
          <td>
            ${profile.subscriptionStatus === 'active' 
              ? '<span class="badge badge-success">Active</span>' 
              : profile.subscriptionStatus === 'trial' 
              ? '<span class="badge badge-info">Trial</span>'
              : '<span class="badge badge-secondary">None</span>'}
          </td>
          <td>
            <span class="badge badge-primary">${profile.trialScansRemaining || 0} remaining</span>
          </td>
          <td>
            <code style="font-size: 0.75rem; color: var(--gray-500);">${user.uid.substring(0, 8)}...</code>
          </td>
          <td style="text-align: right;">
            <div class="btn-group">
              <a href="/users/${user.uid}" class="btn btn-sm btn-primary">View</a>
              <a href="/users/${user.uid}/delete" class="btn btn-sm btn-danger" data-confirm="Are you sure you want to delete this user? This action cannot be undone.">Delete</a>
            </div>
          </td>
        </tr>
      `;
    }

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Users</h2>
            </div>
            <div class="top-bar-actions">
                <div class="search-box">
                    
                    <input type="text" placeholder="Search users..." data-search>
                </div>
                <span class="badge badge-primary">${users.users.length} total</span>
            </div>
        </div>
        
        <div class="content-card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Contact</th>
                            <th>Subscription</th>
                            <th>Trial Scans</th>
                            <th>UID</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="6" class="empty-state"><div><h3>No users found</h3></div></td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Users', content, 'users'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading users</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/users" class="btn btn-primary">Retry</a>
        </div>`,
        'users'
      ),
    );
  }
});

app.get('/users/:userId', async (req, res) => {
  try {
    const {userId} = req.params;
    const user = await auth.getUser(userId);
    const profile = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    const receipts = await db
      .collection(`artifacts/${config.app.id}/users/${userId}/receipts`)
      .limit(10)
      .get();

    const profileData = profile.exists ? profile.data() : {};

    // Sort receipts by date client-side
    const sortedReceipts = receipts.docs.sort((a, b) => {
      const dateA = getDateValue(a.data().date);
      const dateB = getDateValue(b.data().date);
      return dateB - dateA;
    });

    let receiptsHtml = '<div class="empty-state" style="padding: 2rem;"><h3>No receipts found</h3><p>This user hasn\'t scanned any receipts yet.</p></div>';
    if (!receipts.empty) {
      receiptsHtml = '<div class="table-container"><table><thead><tr><th>Store</th><th>Amount</th><th>Date</th></tr></thead><tbody>';
      sortedReceipts.slice(0, 5).forEach(doc => {
        const data = doc.data();
        const currency = data.currency || 'USD';
        receiptsHtml += `<tr>
          <td><strong>${data.storeName || 'Unknown Store'}</strong></td>
          <td><span class="badge badge-success">${formatCurrency(data.total || 0, currency)}</span></td>
          <td>${formatDate(data.date)}</td>
        </tr>`;
      });
      receiptsHtml += '</tbody></table></div>';
    }

    const initials = (user.displayName || user.email || 'U').substring(0, 2).toUpperCase();
    
    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>User Details</h2>
            </div>
            <div class="top-bar-actions">
                <a href="/users" class="btn btn-outline">Back to Users</a>
                <a href="/users/${userId}/edit" class="btn btn-secondary">Edit User</a>
                <a href="/users/${userId}/delete" class="btn btn-danger" data-confirm="Are you sure you want to delete this user? This action cannot be undone.">Delete User</a>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
            <div class="content-card">
                <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--gray-200);">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: 700; box-shadow: var(--shadow-lg);">
                        ${initials}
                    </div>
                    <div>
                        <h3 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem 0;">${user.displayName || 'Anonymous User'}</h3>
                        <p style="color: var(--gray-500); margin: 0; font-size: 0.875rem;">${user.email || user.phoneNumber || 'No contact info'}</p>
                    </div>
                </div>
                
                <h4 style="font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-600); margin: 0 0 1rem 0;">Authentication Info</h4>
                <div style="display: grid; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
                        <span style="color: var(--gray-600); font-size: 0.875rem;"><i class="fas fa-fingerprint" style="margin-right: 0.5rem;"></i>UID</span>
                        <code style="font-size: 0.8rem; background: var(--gray-100); padding: 0.25rem 0.5rem; border-radius: 4px;">${user.uid}</code>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
                        <span style="color: var(--gray-600); font-size: 0.875rem;"><i class="fas fa-envelope" style="margin-right: 0.5rem;"></i>Email</span>
                        <strong>${user.email || '<span class="badge badge-secondary">N/A</span>'}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
                        <span style="color: var(--gray-600); font-size: 0.875rem;"><i class="fas fa-phone" style="margin-right: 0.5rem;"></i>Phone</span>
                        <strong>${user.phoneNumber || '<span class="badge badge-secondary">N/A</span>'}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0;">
                        <span style="color: var(--gray-600); font-size: 0.875rem;"><i class="fas fa-calendar" style="margin-right: 0.5rem;"></i>Created</span>
                        <strong>${user.metadata.creationTime}</strong>
                    </div>
                </div>
            </div>
            
            <div class="content-card">
                <h4 style="font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-600); margin: 0 0 1.5rem 0;">Profile Data</h4>
                
                <div style="display: grid; gap: 1.5rem;">
                    ${profileData.is_admin ? `
                    <div>
                        <div style="background: linear-gradient(135deg, var(--warning), var(--danger)); padding: 1rem; border-radius: 8px; color: white;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <i class="fas fa-shield-alt" style="font-size: 1.5rem;"></i>
                                <div>
                                    <strong style="display: block; font-size: 1rem;">Administrator</strong>
                                    <span style="font-size: 0.75rem; opacity: 0.9;">This user has admin privileges</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="color: var(--gray-600); font-size: 0.875rem;">Subscription Status</span>
                        </div>
                        ${
                          profileData.subscriptionStatus === 'active'
                            ? '<div class="badge badge-success" style="font-size: 0.875rem;">Active Premium</div>'
                            : profileData.subscriptionStatus === 'trial'
                            ? '<div class="badge badge-info" style="font-size: 0.875rem;">Trial Period</div>'
                            : '<div class="badge badge-secondary" style="font-size: 0.875rem;">No Subscription</div>'
                        }
                    </div>
                    
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--gray-600); font-size: 0.875rem;">Trial Scans Remaining</span>
                            <div style="font-size: 1.75rem; font-weight: 700; color: var(--primary);">${
                              profileData.trialScansRemaining || 0
                            }</div>
                        </div>
                    </div>
                    
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--gray-600); font-size: 0.875rem;">Total Savings</span>
                            <div style="font-size: 1.75rem; font-weight: 700; color: var(--success);">$${profileData.totalSavings || 0}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="content-card">
            <h4 style="font-size: 1.125rem; font-weight: 700; margin: 0 0 1.5rem 0;">Recent Receipts</h4>
            ${receiptsHtml}
        </div>
    `;

    res.send(getHtmlTemplate('User Details', content, 'users'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading user</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/users" class="btn btn-primary">Back to Users</a>
        </div>`,
        'users'
      ),
    );
  }
});

// Edit user page
app.get('/users/:userId/edit', async (req, res) => {
  try {
    const {userId} = req.params;
    const user = await auth.getUser(userId);
    const profile = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    
    const profileData = profile.exists ? profile.data() : {};
    
    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Edit User</h2>
            </div>
            <div class="top-bar-actions">
                <a href="/users/${userId}" class="btn btn-outline">Cancel</a>
            </div>
        </div>
        
        <div class="content-card">
            <form action="/users/${userId}/update" method="POST" style="max-width: 600px;">
                <h4 style="font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-600); margin: 0 0 1.5rem 0; padding-bottom: 1rem; border-bottom: 1px solid var(--gray-200);">
                    Basic Information
                </h4>
                
                <div style="display: grid; gap: 1.5rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--gray-700);">
                            Display Name
                        </label>
                        <input 
                            type="text" 
                            name="displayName" 
                            value="${user.displayName || ''}"
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-size: 0.875rem; font-family: inherit;"
                            placeholder="User's display name"
                        >
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--gray-700);">
                            Email
                        </label>
                        <input 
                            type="email" 
                            name="email" 
                            value="${user.email || ''}"
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-size: 0.875rem; font-family: inherit;"
                            placeholder="user@example.com"
                        >
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--gray-700);">
                            Phone Number
                        </label>
                        <input 
                            type="tel" 
                            name="phoneNumber" 
                            value="${user.phoneNumber || ''}"
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-size: 0.875rem; font-family: inherit;"
                            placeholder="+243123456789"
                        >
                        <small style="display: block; margin-top: 0.5rem; color: var(--gray-500);">Include country code (e.g., +243)</small>
                    </div>
                </div>
                
                <h4 style="font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-600); margin: 0 0 1.5rem 0; padding-bottom: 1rem; border-bottom: 1px solid var(--gray-200);">
                    Profile Settings
                </h4>
                
                <div style="display: grid; gap: 1.5rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--gray-700);">
                            Subscription Status
                        </label>
                        <select 
                            name="subscriptionStatus" 
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-size: 0.875rem; font-family: inherit; background: white;"
                        >
                            <option value="none" ${profileData.subscriptionStatus === 'none' ? 'selected' : ''}>No Subscription</option>
                            <option value="trial" ${profileData.subscriptionStatus === 'trial' ? 'selected' : ''}>Trial Period</option>
                            <option value="active" ${profileData.subscriptionStatus === 'active' ? 'selected' : ''}>Active Premium</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--gray-700);">
                            Trial Scans Remaining
                        </label>
                        <input 
                            type="number" 
                            name="trialScansRemaining" 
                            value="${profileData.trialScansRemaining || 0}"
                            min="0"
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-size: 0.875rem; font-family: inherit;"
                        >
                    </div>
                    
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--gray-700);">
                            Total Savings
                        </label>
                        <input 
                            type="number" 
                            name="totalSavings" 
                            value="${profileData.totalSavings || 0}"
                            min="0"
                            step="0.01"
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 8px; font-size: 0.875rem; font-family: inherit;"
                        >
                    </div>
                    
                    <div style="background: var(--gray-50); padding: 1rem; border-radius: 8px; border: 1px solid var(--gray-200);">
                        <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; font-weight: 600; color: var(--gray-700);">
                            <input 
                                type="checkbox" 
                                name="is_admin" 
                                value="true"
                                ${profileData.is_admin ? 'checked' : ''}
                                style="width: 20px; height: 20px; cursor: pointer;"
                            >
                            <div>
                                <div>Admin Access</div>
                                <small style="display: block; margin-top: 0.25rem; color: var(--gray-500); font-weight: 400;">Grant this user administrative privileges</small>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem; justify-content: flex-end; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
                    <a href="/users/${userId}" class="btn btn-outline">
                        Cancel
                    </a>
                    <button type="submit" class="btn btn-primary">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;
    
    res.send(getHtmlTemplate('Edit User', content, 'users'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading user for editing</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/users" class="btn btn-primary">Back to Users</a>
        </div>`,
        'users'
      ),
    );
  }
});

// Update user handler
app.post('/users/:userId/update', async (req, res) => {
  try {
    const {userId} = req.params;
    const {
      displayName,
      email,
      phoneNumber,
      subscriptionStatus,
      trialScansRemaining,
      totalSavings,
      is_admin
    } = req.body;
    
    // Update Firebase Auth user
    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    
    if (Object.keys(updateData).length > 0) {
      await auth.updateUser(userId, updateData);
    }
    
    // Update Firestore profile
    const profileRef = db.doc(`artifacts/${config.app.id}/users/${userId}`);
    const profileUpdateData = {};
    
    if (subscriptionStatus !== undefined) {
      profileUpdateData.subscriptionStatus = subscriptionStatus;
    }
    if (trialScansRemaining !== undefined) {
      profileUpdateData.trialScansRemaining = parseInt(trialScansRemaining, 10);
    }
    if (totalSavings !== undefined) {
      profileUpdateData.totalSavings = parseFloat(totalSavings);
    }
    
    // Set is_admin field (defaults to false if not checked)
    profileUpdateData.is_admin = is_admin === 'true';
    
    if (Object.keys(profileUpdateData).length > 0) {
      await profileRef.set(profileUpdateData, {merge: true});
    }
    
    res.send(
      getHtmlTemplate(
        'User Updated',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Success</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-success">
                
                <div>
                    <strong>User updated successfully!</strong>
                    <p style="margin: 0.5rem 0 0 0;">Changes have been saved for user ${userId}.</p>
                </div>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                <a href="/users/${userId}" class="btn btn-primary">View User</a>
                <a href="/users" class="btn btn-outline">Back to Users</a>
            </div>
        </div>`,
        'users'
      ),
    );
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error updating user</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/users/${req.params.userId}/edit" class="btn btn-primary">Back to Edit</a>
        </div>`,
        'users'
      ),
    );
  }
});

app.get('/users/:userId/delete', async (req, res) => {
  try {
    const {userId} = req.params;

    // Delete user data first
    await deleteUserData(userId);

    // Delete auth user
    await auth.deleteUser(userId);

    res.send(
      getHtmlTemplate(
        'User Deleted',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Success</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-success">
                
                <div>
                    <strong>User deleted successfully!</strong>
                    <p style="margin: 0.5rem 0 0 0;">User ${userId} and all associated data have been permanently removed.</p>
                </div>
            </div>
            <a href="/users" class="btn btn-primary">Back to Users</a>
        </div>`,
        'users'
      ),
    );
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error deleting user</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/users" class="btn btn-primary">Back to Users</a>
        </div>`,
        'users'
      ),
    );
  }
});

async function deleteUserData(userId) {
  console.log(`🗑️ Starting complete deletion for user ${userId}...`);
  
  // Delete all user subcollections in batches
  const subcollections = [
    'receipts',
    'items', 
    'priceAlerts',
    'notifications',
    'subscriptions',
    'payments',
    'shops',
    'profile'
  ];
  
  for (const subcollection of subcollections) {
    const collectionRef = db.collection(`artifacts/${config.app.id}/users/${userId}/${subcollection}`);
    const snapshot = await collectionRef.get();
    
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Deleted ${snapshot.size} documents from ${subcollection}`);
    }
  }
  
  // Delete the user document itself
  const userDoc = db.doc(`artifacts/${config.app.id}/users/${userId}`);
  await userDoc.delete();
  console.log(`✅ Deleted user document for ${userId}`);
  
  // Delete user from artifacts collection (phone users)
  const phoneUserQuery = await db
    .collection('artifacts')
    .doc(config.app.id)
    .collection('users')
    .where('userId', '==', userId)
    .get();
  
  if (!phoneUserQuery.empty) {
    const batch = db.batch();
    phoneUserQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`✅ Deleted phone user records`);
  }
  
  console.log(`✅ Complete deletion finished for user ${userId}`);
}

app.get('/receipts', async (req, res) => {
  try {
    const receipts = await db
      .collectionGroup('receipts')
      .limit(50)
      .get();

    // Sort receipts by date client-side
    const sortedReceipts = receipts.docs.sort((a, b) => {
      const dateA = getDateValue(a.data().date);
      const dateB = getDateValue(b.data().date);
      return dateB - dateA;
    });

    let tableRows = '';
    sortedReceipts.forEach(doc => {
      const data = doc.data();
      const userId = doc.ref.path.split('/')[3];
      const currency = data.currency || 'USD';

      tableRows += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; background: var(--primary-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                
              </div>
              <div>
                <strong>${data.storeName || 'Unknown Store'}</strong>
                <div style="font-size: 0.75rem; color: var(--gray-500);">ID: ${doc.id.substring(0, 12)}...</div>
              </div>
            </div>
          </td>
          <td>
            <code style="font-size: 0.75rem; color: var(--gray-500);">${userId.substring(0, 12)}...</code>
          </td>
          <td>
            <span class="badge badge-success" style="font-size: 0.875rem;">${formatCurrency(data.total || 0, currency)}</span>
          </td>
          <td>${formatDate(data.date)}</td>
          <td style="text-align: right;">
            <div class="btn-group">
              <a href="/receipts/${userId}/${doc.id}" class="btn btn-sm btn-primary">View</a>
              <a href="/receipts/${userId}/${doc.id}/edit" class="btn btn-sm btn-secondary">Edit</a>
              <a href="/receipts/${userId}/${doc.id}/delete" class="btn btn-sm btn-danger" data-confirm="Are you sure you want to delete this receipt?"></a>
            </div>
          </td>
        </tr>
      `;
    });

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Receipts</h2>
            </div>
            <div class="top-bar-actions">
                <div class="search-box">
                    
                    <input type="text" placeholder="Search receipts..." data-search>
                </div>
                <span class="badge badge-secondary">${receipts.size} total</span>
            </div>
        </div>
        
        <div class="content-card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Store</th>
                            <th>User ID</th>
                            <th>Total</th>
                            <th>Date</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="5" class="empty-state"><div><h3>No receipts found</h3></div></td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Receipts', content, 'receipts'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading receipts</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/receipts" class="btn btn-primary">Retry</a>
        </div>`,
        'receipts'
      ),
    );
  }
});

// Receipt Detail View
app.get('/receipts/:userId/:receiptId', async (req, res) => {
  try {
    const {userId, receiptId} = req.params;
    const receiptDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}/receipts/${receiptId}`)
      .get();
    
    if (!receiptDoc.exists) {
      return res.send(
        getHtmlTemplate(
          'Error',
          `<div class="alert alert-error"><div><strong>Receipt not found</strong></div></div>
          <a href="/receipts" class="btn btn-primary">Back to Receipts</a>`,
          'receipts'
        ),
      );
    }

    const data = receiptDoc.data();
    const items = data.items || [];
    
    let itemsHtml = '<div class="empty-state" style="padding: 2rem;"><h3>No items</h3></div>';
    if (items.length > 0) {
      itemsHtml = `<div class="table-container"><table>
        <thead><tr><th>Item</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>`;
      items.forEach(item => {
        const itemTotal = (item.unitPrice || 0) * (item.quantity || 1);
        const itemCurrency = item.currency || data.currency || 'USD';
        itemsHtml += `<tr>
          <td><strong>${item.name || item.itemName || 'Unknown Item'}</strong></td>
          <td>${item.quantity || 1}</td>
          <td>${formatCurrency(item.unitPrice || item.price || 0, itemCurrency)}</td>
          <td><span class="badge badge-success">${formatCurrency(itemTotal, itemCurrency)}</span></td>
        </tr>`;
      });
      itemsHtml += '</tbody></table></div>';
    }

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Receipt Details</h2>
            </div>
            <div class="top-bar-actions">
                <a href="/receipts" class="btn btn-outline">Back</a>
                <a href="/receipts/${userId}/${receiptId}/edit" class="btn btn-secondary">Edit</a>
                <a href="/receipts/${userId}/${receiptId}/delete" class="btn btn-danger" data-confirm="Delete this receipt?">Delete</a>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
            <div class="content-card">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Receipt Information</h3>
                <div style="display: grid; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
                        <span style="color: var(--gray-600);">Store</span>
                        <strong>${data.storeName || 'Unknown'}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
                        <span style="color: var(--gray-600);">Total Amount</span>
                        <strong style="font-size: 1.5rem; color: var(--success);">${formatCurrency(data.total || 0, data.currency || 'USD')}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
                        <span style="color: var(--gray-600);">Date</span>
                        <strong>${formatDate(data.date)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-100);">
                        <span style="color: var(--gray-600);">Receipt ID</span>
                        <code style="font-size: 0.8rem;">${receiptId}</code>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0;">
                        <span style="color: var(--gray-600);">User ID</span>
                        <code style="font-size: 0.8rem;">${userId}</code>
                    </div>
                </div>
            </div>
            
            <div class="content-card">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Statistics</h3>
                <div style="display: grid; gap: 1.5rem;">
                    <div>
                        <div style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 0.5rem;">Total Items</div>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${items.length}</div>
                    </div>
                    <div>
                        <div style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 0.5rem;">Average Item Price</div>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--secondary);">$${items.length > 0 ? ((data.total || 0) / items.length).toFixed(2) : '0.00'}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="content-card">
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Items (${items.length})</h3>
            ${itemsHtml}
        </div>
    `;

    res.send(getHtmlTemplate('Receipt Details', content, 'receipts'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="alert alert-error"><div><strong>Error loading receipt</strong><p>${error.message}</p></div></div>
        <a href="/receipts" class="btn btn-primary">Back to Receipts</a>`,
        'receipts'
      ),
    );
  }
});

// Receipt Edit Page
app.get('/receipts/:userId/:receiptId/edit', async (req, res) => {
  try {
    const {userId, receiptId} = req.params;
    const receiptDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}/receipts/${receiptId}`)
      .get();
    
    if (!receiptDoc.exists) {
      return res.send(
        getHtmlTemplate(
          'Error',
          `<div class="alert alert-error"><div><strong>Receipt not found</strong></div></div>`,
          'receipts'
        ),
      );
    }

    const data = receiptDoc.data();

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Edit Receipt</h2>
            </div>
            <div class="top-bar-actions">
                <a href="/receipts/${userId}/${receiptId}" class="btn btn-outline">Cancel</a>
            </div>
        </div>
        
        <div class="content-card">
            <form method="POST" action="/receipts/${userId}/${receiptId}/update">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div class="form-group">
                        <label for="storeName">Store Name</label>
                        <input type="text" id="storeName" name="storeName" value="${data.storeName || ''}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="total">Total Amount</label>
                        <input type="number" step="0.01" id="total" name="total" value="${data.total || 0}" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="date">Date</label>
                    <input type="date" id="date" name="date" value="${getDateValue(data.date).toISOString().split('T')[0]}" required>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="submit" class="btn btn-success btn-lg">Save Changes</button>
                    <a href="/receipts/${userId}/${receiptId}" class="btn btn-outline btn-lg">Cancel</a>
                </div>
            </form>
        </div>
    `;

    res.send(getHtmlTemplate('Edit Receipt', content, 'receipts'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="alert alert-error"><div><strong>Error loading receipt</strong><p>${error.message}</p></div></div>`,
        'receipts'
      ),
    );
  }
});

// Receipt Update Handler
app.post('/receipts/:userId/:receiptId/update', async (req, res) => {
  try {
    const {userId, receiptId} = req.params;
    const {storeName, total, date} = req.body;
    
    await db
      .doc(`artifacts/${config.app.id}/users/${userId}/receipts/${receiptId}`)
      .update({
        storeName,
        total: parseFloat(total),
        date: new Date(date),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.send(
      getHtmlTemplate(
        'Success',
        `<div class="alert alert-success"><div><strong>Receipt updated successfully!</strong></div></div>
        <div class="btn-group">
          <a href="/receipts/${userId}/${receiptId}" class="btn btn-primary">View Receipt</a>
          <a href="/receipts" class="btn btn-outline">All Receipts</a>
        </div>`,
        'receipts'
      ),
    );
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="alert alert-error"><div><strong>Error updating receipt</strong><p>${error.message}</p></div></div>
        <a href="/receipts/${userId}/${receiptId}/edit" class="btn btn-primary">Try Again</a>`,
        'receipts'
      ),
    );
  }
});

app.get('/receipts/:userId/:receiptId/delete', async (req, res) => {
  try {
    const {userId, receiptId} = req.params;

    await db
      .doc(`artifacts/${config.app.id}/users/${userId}/receipts/${receiptId}`)
      .delete();

    res.send(
      getHtmlTemplate(
        'Receipt Deleted',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Success</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-success">
                
                <div>
                    <strong>Receipt deleted successfully!</strong>
                    <p style="margin: 0.5rem 0 0 0;">Receipt ${receiptId} has been permanently removed.</p>
                </div>
            </div>
            <a href="/receipts" class="btn btn-primary">Back to Receipts</a>
        </div>`,
        'receipts'
      ),
    );
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error deleting receipt</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/receipts" class="btn btn-primary">Back to Receipts</a>
        </div>`,
        'receipts'
      ),
    );
  }
});

app.get('/prices', async (req, res) => {
  try {
    // Try different collection paths since prices might be stored differently
    let prices = await db.collectionGroup('prices').limit(50).get();
    
    // If no prices found, try checking items with price data
    if (prices.empty) {
      prices = await db.collectionGroup('items').limit(50).get();
    }

    // Sort prices by date client-side
    const sortedPrices = prices.docs.sort((a, b) => {
      const dateA = getDateValue(a.data().recordedAt || a.data().createdAt || a.data().date);
      const dateB = getDateValue(b.data().recordedAt || b.data().createdAt || b.data().date);
      return dateB - dateA;
    });

    let tableRows = '';
    sortedPrices.forEach(doc => {
      const data = doc.data();
      const productName = data.productName || data.name || data.itemName || 'Unknown Product';
      const storeName = data.storeName || data.store || 'Unknown Store';
      const price = data.price || data.unitPrice || data.currentPrice || 0;
      const currency = data.currency || 'USD';
      const date = data.recordedAt || data.createdAt || data.date;
      
      tableRows += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; background: #fef3c7; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--warning);">
                
              </div>
              <strong>${productName}</strong>
            </div>
          </td>
          <td>${storeName}</td>
          <td><span class="badge badge-warning" style="font-size: 0.875rem;">${price.toFixed(2)} ${currency}</span></td>
          <td>${formatDate(date)}</td>
          <td style="text-align: right;">
            <div class="btn-group">
              <a href="/prices/${doc.id}" class="btn btn-sm btn-primary">View</a>
            </div>
          </td>
        </tr>
      `;
    });

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Prices</h2>
            </div>
            <div class="top-bar-actions">
                <div class="search-box">
                    
                    <input type="text" placeholder="Search prices..." data-search>
                </div>
                <span class="badge badge-warning">${prices.size} total</span>
            </div>
        </div>
        
        <div class="content-card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Store</th>
                            <th>Price</th>
                            <th>Date</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="5" class="empty-state"><div><h3>No prices found</h3><p>Try checking items or products data.</p></div></td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Prices', content, 'prices'));
  } catch (error) {
    console.error('❌ Error loading prices:', error);
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading prices</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/prices" class="btn btn-primary">Retry</a>
        </div>`,
        'prices'
      ),
    );
  }
});

// Items Page
app.get('/items', async (req, res) => {
  try {
    const items = await db.collectionGroup('items').limit(100).get();
    
    // Sort items by date client-side
    const sortedItems = items.docs.sort((a, b) => {
      const dateA = getDateValue(a.data().createdAt || a.data().date);
      const dateB = getDateValue(b.data().createdAt || b.data().date);
      return dateB - dateA;
    });

    let tableRows = '';
    sortedItems.forEach(doc => {
      const data = doc.data();
      const itemName = data.name || data.itemName || data.productName || 'Unknown Item';
      const price = data.price || data.unitPrice || data.currentPrice || 0;
      const currency = data.currency || 'USD';
      const quantity = data.quantity || 1;
      const storeName = data.storeName || data.store || 'Unknown';
      const category = data.category || 'Uncategorized';
      const userId = doc.ref.path.split('/')[3];
      
      tableRows += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; background: var(--primary-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                
              </div>
              <div>
                <strong>${itemName}</strong>
                <div style="font-size: 0.75rem; color: var(--gray-500);">${category}</div>
              </div>
            </div>
          </td>
          <td>${storeName}</td>
          <td><span class="badge badge-primary">${formatCurrency(price, currency)}</span></td>
          <td>${quantity}</td>
          <td><span class="badge badge-success">${formatCurrency(price * quantity, currency)}</span></td>
          <td style="text-align: right;">
            <div class="btn-group">
              <a href="/items/${userId}/${doc.id}" class="btn btn-sm btn-primary">View</a>
              <a href="/items/${userId}/${doc.id}/edit" class="btn btn-sm btn-secondary">Edit</a>
            </div>
          </td>
        </tr>
      `;
    });

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Items</h2>
            </div>
            <div class="top-bar-actions">
                <div class="search-box">
                    
                    <input type="text" placeholder="Search items..." data-search>
                </div>
                <span class="badge badge-primary">${items.size} total</span>
            </div>
        </div>
        
        <div class="content-card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Store</th>
                            <th>Unit Price</th>
                            <th>Quantity</th>
                            <th>Total</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="6" class="empty-state"><div><h3>No items found</h3></div></td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Items', content, 'items'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading items</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/items" class="btn btn-primary">Retry</a>
        </div>`,
        'items'
      ),
    );
  }
});

// Item Detail Page
app.get('/items/:userId/:itemId', async (req, res) => {
  try {
    const {userId, itemId} = req.params;
    const itemDoc = await db
      .collection('artifacts')
      .doc('goshopper')
      .collection('users')
      .doc(userId)
      .collection('items')
      .doc(itemId)
      .get();

    if (!itemDoc.exists) {
      throw new Error('Item not found');
    }

    const data = itemDoc.data();
    const currency = data.currency || 'USD';

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Item Details</h2>
            </div>
            <div class="top-bar-actions">
                <a href="/items/${userId}/${itemId}/edit" class="btn btn-primary">
                    Edit Item
                </a>
            </div>
        </div>
        
        <div class="content-card">
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Item Name</span>
                    <span class="detail-value">${data.name || data.itemName || data.productName || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Category</span>
                    <span class="detail-value">${data.category || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Store</span>
                    <span class="detail-value">${data.storeName || data.store || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Unit Price</span>
                    <span class="detail-value"><span class="badge badge-primary">${formatCurrency(data.price || data.unitPrice || data.currentPrice || 0, currency)}</span></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Quantity</span>
                    <span class="detail-value">${data.quantity || 1}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Total</span>
                    <span class="detail-value"><span class="badge badge-success">${formatCurrency((data.price || 0) * (data.quantity || 1), currency)}</span></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Currency</span>
                    <span class="detail-value">${currency}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Brand</span>
                    <span class="detail-value">${data.brand || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Barcode</span>
                    <span class="detail-value">${data.barcode || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">${formatDate(data.createdAt || data.date)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Item ID</span>
                    <span class="detail-value"><code>${itemId}</code></span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">User ID</span>
                    <span class="detail-value"><code>${userId}</code></span>
                </div>
            </div>
            
            <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                <a href="/items" class="btn btn-secondary">Back to Items</a>
                <a href="/items/${userId}/${itemId}/edit" class="btn btn-primary">Edit Item</a>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Item Details', content, 'items'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading item</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/items" class="btn btn-primary">Back to Items</a>
        </div>`,
        'items'
      ),
    );
  }
});

// Item Edit Page
app.get('/items/:userId/:itemId/edit', async (req, res) => {
  try {
    const {userId, itemId} = req.params;
    const itemDoc = await db
      .collection('artifacts')
      .doc('goshopper')
      .collection('users')
      .doc(userId)
      .collection('items')
      .doc(itemId)
      .get();

    if (!itemDoc.exists) {
      throw new Error('Item not found');
    }

    const data = itemDoc.data();

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Edit Item</h2>
            </div>
        </div>
        
        <div class="content-card">
            <form action="/items/${userId}/${itemId}/update" method="POST">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="name">Item Name *</label>
                        <input type="text" id="name" name="name" value="${data.name || data.itemName || data.productName || ''}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="category">Category</label>
                        <input type="text" id="category" name="category" value="${data.category || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="storeName">Store Name</label>
                        <input type="text" id="storeName" name="storeName" value="${data.storeName || data.store || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="brand">Brand</label>
                        <input type="text" id="brand" name="brand" value="${data.brand || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="price">Unit Price *</label>
                        <input type="number" id="price" name="price" step="0.01" value="${data.price || data.unitPrice || data.currentPrice || 0}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="quantity">Quantity *</label>
                        <input type="number" id="quantity" name="quantity" value="${data.quantity || 1}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="currency">Currency</label>
                        <select id="currency" name="currency">
                            <option value="CDF" ${(data.currency === 'CDF' || data.currency === 'FC') ? 'selected' : ''}>CDF (FC)</option>
                            <option value="USD" ${data.currency === 'USD' ? 'selected' : ''}>USD</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="barcode">Barcode</label>
                        <input type="text" id="barcode" name="barcode" value="${data.barcode || ''}">
                    </div>
                </div>
                
                <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                    <button type="submit" class="btn btn-primary">
                        Save Changes
                    </button>
                    <a href="/items/${userId}/${itemId}" class="btn btn-secondary">
                        Cancel
                    </a>
                </div>
            </form>
        </div>
    `;

    res.send(getHtmlTemplate('Edit Item', content, 'items'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading item</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/items" class="btn btn-primary">Back to Items</a>
        </div>`,
        'items'
      ),
    );
  }
});

// Item Update Handler
app.post('/items/:userId/:itemId/update', async (req, res) => {
  try {
    const {userId, itemId} = req.params;
    const {name, category, storeName, brand, price, quantity, currency, barcode} = req.body;

    const updateData = {
      name: name || '',
      category: category || '',
      storeName: storeName || '',
      brand: brand || '',
      price: parseFloat(price) || 0,
      quantity: parseInt(quantity) || 1,
      currency: currency || 'USD',
      barcode: barcode || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db
      .collection('artifacts')
      .doc('goshopper')
      .collection('users')
      .doc(userId)
      .collection('items')
      .doc(itemId)
      .update(updateData);

    res.send(
      getHtmlTemplate(
        'Item Updated',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Success</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-success">
                
                <div>
                    <strong>Item updated successfully!</strong>
                    <p style="margin: 0.5rem 0 0 0;">The item has been updated with the new information.</p>
                </div>
            </div>
            <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                <a href="/items/${userId}/${itemId}" class="btn btn-primary">View Item</a>
                <a href="/items" class="btn btn-secondary">Back to Items</a>
            </div>
        </div>`,
        'items'
      ),
    );
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error updating item</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/items/${userId}/${itemId}/edit" class="btn btn-primary">Back to Edit</a>
        </div>`,
        'items'
      ),
    );
  }
});

// Price Alerts Page
app.get('/alerts', async (req, res) => {
  try {
    const alerts = await db.collectionGroup('priceAlerts').limit(100).get();
    
    // Sort alerts by date client-side
    const sortedAlerts = alerts.docs.sort((a, b) => {
      const dateA = getDateValue(a.data().createdAt || a.data().date);
      const dateB = getDateValue(b.data().createdAt || b.data().date);
      return dateB - dateA;
    });

    let tableRows = '';
    sortedAlerts.forEach(doc => {
      const data = doc.data();
      const userId = doc.ref.path.split('/')[3];
      const productName = data.productName || data.itemName || 'Unknown Product';
      const targetPrice = data.targetPrice || 0;
      const currentPrice = data.currentPrice || 0;
      const currency = data.currency || 'USD';
      const isActive = data.isActive !== false;
      const storeName = data.storeName || 'Any Store';
      
      tableRows += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; background: ${isActive ? 'var(--primary-light)' : '#fee2e2'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${isActive ? 'var(--primary)' : 'var(--danger)'};">
                
              </div>
              <div>
                <strong>${productName}</strong>
                <div style="font-size: 0.75rem; color: var(--gray-500);">${storeName}</div>
              </div>
            </div>
          </td>
          <td><code style="font-size: 0.75rem; color: var(--gray-500);">${userId.substring(0, 12)}...</code></td>
          <td><span class="badge badge-warning">${formatCurrency(targetPrice, currency)}</span></td>
          <td><span class="badge badge-secondary">${formatCurrency(currentPrice, currency)}</span></td>
          <td>
            ${isActive 
              ? '<span class="badge badge-success">Active</span>' 
              : '<span class="badge badge-danger">Inactive</span>'}
          </td>
          <td style="text-align: right;">
            <div class="btn-group">
              <a href="/alerts/${userId}/${doc.id}" class="btn btn-sm btn-primary">View</a>
              <a href="/alerts/${userId}/${doc.id}/toggle" class="btn btn-sm btn-${isActive ? 'warning' : 'success'}">
                ${isActive ? 'Pause' : 'Activate'}
              </a>
              <a href="/alerts/${userId}/${doc.id}/delete" class="btn btn-sm btn-danger" data-confirm="Delete this alert?"></a>
            </div>
          </td>
        </tr>
      `;
    });

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Price Alerts</h2>
            </div>
            <div class="top-bar-actions">
                <div class="search-box">
                    
                    <input type="text" placeholder="Search alerts..." data-search>
                </div>
                <span class="badge badge-info">${alerts.size} total</span>
            </div>
        </div>
        
        <div class="content-card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>User ID</th>
                            <th>Target Price</th>
                            <th>Current Price</th>
                            <th>Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="6" class="empty-state"><div><h3>No price alerts found</h3></div></td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Price Alerts', content, 'alerts'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading alerts</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/alerts" class="btn btn-primary">Retry</a>
        </div>`,
        'alerts'
      ),
    );
  }
});

// Alert Toggle Handler
app.get('/alerts/:userId/:alertId/toggle', async (req, res) => {
  try {
    const {userId, alertId} = req.params;
    const alertDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}/priceAlerts/${alertId}`)
      .get();
    
    if (alertDoc.exists) {
      const currentStatus = alertDoc.data().isActive !== false;
      await db
        .doc(`artifacts/${config.app.id}/users/${userId}/priceAlerts/${alertId}`)
        .update({
          isActive: !currentStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    
    res.redirect('/alerts');
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="alert alert-error"><div><strong>Error toggling alert</strong><p>${error.message}</p></div></div>
        <a href="/alerts" class="btn btn-primary">Back to Alerts</a>`,
        'alerts'
      ),
    );
  }
});

// Alert Delete Handler
app.get('/alerts/:userId/:alertId/delete', async (req, res) => {
  try {
    const {userId, alertId} = req.params;
    await db
      .doc(`artifacts/${config.app.id}/users/${userId}/priceAlerts/${alertId}`)
      .delete();
    
    res.send(
      getHtmlTemplate(
        'Success',
        `<div class="alert alert-success"><div><strong>Alert deleted successfully!</strong></div></div>
        <a href="/alerts" class="btn btn-primary">Back to Alerts</a>`,
        'alerts'
      ),
    );
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="alert alert-error"><div><strong>Error deleting alert</strong><p>${error.message}</p></div></div>
        <a href="/alerts" class="btn btn-primary">Back to Alerts</a>`,
        'alerts'
      ),
    );
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
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`;
        monthlySpending[monthKey] =
          (monthlySpending[monthKey] || 0) + (data.total || 0);
      }
    });

    // Calculate category breakdown
    const categories = {};
    receipts.docs.forEach(doc => {
      const data = doc.data();
      (data.items || []).forEach(item => {
        const cat = item.category || 'Other';
        categories[cat] =
          (categories[cat] || 0) + (item.unitPrice || 0) * (item.quantity || 1);
      });
    });

    const topCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Analytics Dashboard</h2>
            </div>
            <div class="top-bar-actions">
                <span class="badge badge-info">Live Data</span>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon primary">
                        
                    </div>
                </div>
                <div class="stat-content">
                    <h3>Registered Users</h3>
                    <div class="stat-number">${users.users.length.toLocaleString()}</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon secondary">
                        
                    </div>
                </div>
                <div class="stat-content">
                    <h3>Total Receipts</h3>
                    <div class="stat-number">${receipts.size.toLocaleString()}</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon info">
                        
                    </div>
                </div>
                <div class="stat-content">
                    <h3>Price Alerts</h3>
                    <div class="stat-number">${alerts.size.toLocaleString()}</div>
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <div class="content-card">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Monthly Spending</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th style="text-align: right;">Total Spending</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(monthlySpending).length > 0 ? Object.entries(monthlySpending)
                              .sort()
                              .reverse()
                              .map(
                                ([month, total]) =>
                                  `<tr>
                                    <td><strong>${month}</strong></td>
                                    <td style="text-align: right;"><span class="badge badge-success">${formatCurrency(total, currency)}</span></td>
                                  </tr>`,
                              )
                              .join('') : '<tr><td colspan="2" class="empty-state" style="padding: 2rem;"><div><h3>No spending data</h3></div></td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="content-card">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Top Categories</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th style="text-align: right;">Total Spent</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topCategories.length > 0 ? topCategories
                              .map(
                                ([category, total]) =>
                                  `<tr>
                                    <td><strong>${category}</strong></td>
                                    <td style="text-align: right;"><span class="badge badge-warning">${formatCurrency(total, currency)}</span></td>
                                  </tr>`,
                              )
                              .join('') : '<tr><td colspan="2" class="empty-state" style="padding: 2rem;"><div><h3>No category data</h3></div></td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Analytics', content, 'analytics'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error loading analytics</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/analytics" class="btn btn-primary">Retry</a>
        </div>`,
        'analytics'
      ),
    );
  }
});

app.get('/notifications', (req, res) => {
  const content = `
        <div class="top-bar">
            <div class="page-title">
                <h2>Send Notifications</h2>
            </div>
            <div class="top-bar-actions">
                <span class="badge badge-info">Messaging Center</span>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
            <div class="content-card">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Broadcast to All Users</h3>
                <form method="POST" action="/notifications/broadcast">
                    <div class="form-group">
                        <label for="broadcastTitle">Title</label>
                        <input type="text" id="broadcastTitle" name="title" required placeholder="Enter notification title">
                    </div>
                    <div class="form-group">
                        <label for="broadcastBody">Message</label>
                        <textarea id="broadcastBody" name="body" required placeholder="Enter your message here..." rows="4"></textarea>
                    </div>
                    <button type="submit" class="btn btn-success btn-lg" style="width: 100%;">Send Broadcast</button>
                </form>
            </div>

            <div class="content-card">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Send to Specific User</h3>
                <form method="POST" action="/notifications/user">
                    <div class="form-group">
                        <label for="userId">User ID</label>
                        <input type="text" id="userId" name="userId" required placeholder="Enter user ID">
                    </div>
                    <div class="form-group">
                        <label for="userTitle">Title</label>
                        <input type="text" id="userTitle" name="title" required placeholder="Enter notification title">
                    </div>
                    <div class="form-group">
                        <label for="userBody">Message</label>
                        <textarea id="userBody" name="body" required placeholder="Enter your message here..." rows="4"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Send to User</button>
                </form>
            </div>
        </div>

        <div class="content-card">
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem;">Scheduled Notifications</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon info">
                        
                    </div>
                    <div class="stat-content">
                        <h3>Weekly Tips</h3>
                        <p style="font-size: 0.875rem; color: var(--gray-600); margin: 0;">Saturday 10:00 AM</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success">
                        
                    </div>
                    <div class="stat-content">
                        <h3>Achievements</h3>
                        <p style="font-size: 0.875rem; color: var(--gray-600); margin: 0;">On Achievement</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon secondary">
                        
                    </div>
                    <div class="stat-content">
                        <h3>Sync Complete</h3>
                        <p style="font-size: 0.875rem; color: var(--gray-600); margin: 0;">On Sync Done</p>
                    </div>
                </div>
            </div>
        </div>
    `;

  res.send(getHtmlTemplate('Notifications', content, 'notifications'));
});

app.post('/notifications/broadcast', async (req, res) => {
  try {
    const {title, body} = req.body;

    if (!title || !body) {
      return res.send(
        getHtmlTemplate(
          'Error',
          `<div class="top-bar">
              <div class="page-title">
                  <h2>Validation Error</h2>
              </div>
          </div>
          <div class="content-card">
              <div class="alert alert-error">
                  
                  <div>
                      <strong>Missing required fields</strong>
                      <p style="margin: 0.5rem 0 0 0;">Title and body are required to send a broadcast notification.</p>
                  </div>
              </div>
              <a href="/notifications" class="btn btn-primary">Back to Notifications</a>
          </div>`,
          'notifications'
        ),
      );
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
      return res.send(
        getHtmlTemplate(
          'Notifications',
          `<div class="top-bar">
              <div class="page-title">
                  <h2>No Recipients</h2>
              </div>
          </div>
          <div class="content-card">
              <div class="alert alert-warning">
                  
                  <div>
                      <strong>No users with FCM tokens found</strong>
                      <p style="margin: 0.5rem 0 0 0;">There are no users registered to receive push notifications at this time.</p>
                  </div>
              </div>
              <a href="/notifications" class="btn btn-primary">Try Again</a>
          </div>`,
          'notifications'
        ),
      );
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
        <div class="top-bar">
            <div class="page-title">
                <h2>Broadcast Sent</h2>
            </div>
        </div>
        
        <div class="content-card">
            <div class="alert alert-success">
                
                <div>
                    <strong>Broadcast sent successfully!</strong>
                    <p style="margin: 0.5rem 0 0 0;">Your notification has been delivered to ${totalSent} users.</p>
                </div>
            </div>
            
            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 10px; margin: 1.5rem 0;">
                <h4 style="font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-600); margin: 0 0 1rem 0;">Notification Details</h4>
                <div style="display: grid; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-200);">
                        <span style="color: var(--gray-600); font-size: 0.875rem;"><i class="fas fa-users" style="margin-right: 0.5rem;"></i>Recipients</span>
                        <strong>${totalSent} users</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-200);">
                        <span style="color: var(--gray-600); font-size: 0.875rem;"><i class="fas fa-heading" style="margin-right: 0.5rem;"></i>Title</span>
                        <strong>${title}</strong>
                    </div>
                    <div style="padding: 0.75rem 0;">
                        <span style="color: var(--gray-600); font-size: 0.875rem; display: block; margin-bottom: 0.5rem;"><i class="fas fa-align-left" style="margin-right: 0.5rem;"></i>Message</span>
                        <p style="margin: 0; color: var(--gray-700);">${body}</p>
                    </div>
                </div>
            </div>
            
            <div class="btn-group">
                <a href="/notifications" class="btn btn-primary">Send Another</a>
                <a href="/" class="btn btn-outline">Back to Dashboard</a>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Broadcast Sent', content, 'notifications'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error sending broadcast</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/notifications" class="btn btn-primary">Back to Notifications</a>
        </div>`,
        'notifications'
      ),
    );
  }
});

app.post('/notifications/user', async (req, res) => {
  try {
    const {userId, title, body} = req.body;

    if (!userId || !title || !body) {
      return res.send(
        getHtmlTemplate(
          'Error',
          `<div class="top-bar">
              <div class="page-title">
                  <h2>Validation Error</h2>
              </div>
          </div>
          <div class="content-card">
              <div class="alert alert-error">
                  
                  <div>
                      <strong>Missing required fields</strong>
                      <p style="margin: 0.5rem 0 0 0;">User ID, title and body are required to send a notification.</p>
                  </div>
              </div>
              <a href="/notifications" class="btn btn-primary">Back to Notifications</a>
          </div>`,
          'notifications'
        ),
      );
    }

    // Get user's FCM token
    const userDoc = await db
      .doc(`artifacts/${config.app.id}/users/${userId}`)
      .get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      return res.send(
        getHtmlTemplate(
          'Notifications',
          `<div class="top-bar">
              <div class="page-title">
                  <h2>User Not Found</h2>
              </div>
          </div>
          <div class="content-card">
              <div class="alert alert-warning">
                  
                  <div>
                      <strong>Cannot send notification</strong>
                      <p style="margin: 0.5rem 0 0 0;">User not found or no FCM token available for this user.</p>
                  </div>
              </div>
              <a href="/notifications" class="btn btn-primary">Try Again</a>
          </div>`,
          'notifications'
        ),
      );
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
        <div class="top-bar">
            <div class="page-title">
                <h2>Notification Sent</h2>
            </div>
        </div>
        
        <div class="content-card">
            <div class="alert alert-success">
                
                <div>
                    <strong>Notification sent successfully!</strong>
                    <p style="margin: 0.5rem 0 0 0;">Your notification has been delivered to the user.</p>
                </div>
            </div>
            
            <div style="background: var(--gray-50); padding: 1.5rem; border-radius: 10px; margin: 1.5rem 0;">
                <h4 style="font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-600); margin: 0 0 1rem 0;">Notification Details</h4>
                <div style="display: grid; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-200);">
                        <span style="color: var(--gray-600); font-size: 0.875rem;"><i class="fas fa-user" style="margin-right: 0.5rem;"></i>User ID</span>
                        <code style="font-size: 0.8rem; background: var(--gray-200); padding: 0.25rem 0.5rem; border-radius: 4px;">${userId}</code>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--gray-200);">
                        <span style="color: var(--gray-600); font-size: 0.875rem;"><i class="fas fa-heading" style="margin-right: 0.5rem;"></i>Title</span>
                        <strong>${title}</strong>
                    </div>
                    <div style="padding: 0.75rem 0;">
                        <span style="color: var(--gray-600); font-size: 0.875rem; display: block; margin-bottom: 0.5rem;"><i class="fas fa-align-left" style="margin-right: 0.5rem;"></i>Message</span>
                        <p style="margin: 0; color: var(--gray-700);">${body}</p>
                    </div>
                </div>
            </div>
            
            <div class="btn-group">
                <a href="/notifications" class="btn btn-primary">Send Another</a>
                <a href="/users/${userId}" class="btn btn-secondary">View User</a>
                <a href="/" class="btn btn-outline">Dashboard</a>
            </div>
        </div>
    `;

    res.send(getHtmlTemplate('Notification Sent', content, 'notifications'));
  } catch (error) {
    res.send(
      getHtmlTemplate(
        'Error',
        `<div class="top-bar">
            <div class="page-title">
                <h2>Error</h2>
            </div>
        </div>
        <div class="content-card">
            <div class="alert alert-error">
                
                <div>
                    <strong>Error sending notification</strong>
                    <p style="margin: 0.5rem 0 0 0;">${error.message}</p>
                </div>
            </div>
            <a href="/notifications" class="btn btn-primary">Back to Notifications</a>
        </div>`,
        'notifications'
      ),
    );
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔥 GoShopperAI Admin Panel`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🌐 Access URL: http://localhost:${PORT}`);
  console.log(`📊 Status: Running`);
  console.log(`⏰ Started: ${new Date().toLocaleString()}`);
  console.log(`${'='.repeat(60)}\n`);
});
