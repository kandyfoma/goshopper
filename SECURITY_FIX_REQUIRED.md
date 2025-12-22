# 🔒 SECURITY ALERT - ACTION REQUIRED

## ⚠️ Exposed API Key Detected

GitHub has detected that your **Google Firebase API Key** was exposed in commit `2fc6fe81`.

### 📍 Location
- **File**: `web/src/App.js` (line 8)
- **Exposed Key**: `AIzaSyAQBCR-KLZLPZNNPdv3XxRwMvE-Bsxaxt4`

---

## ✅ What I've Fixed

1. **Removed hardcoded API key** from `web/src/App.js`
2. **Moved to environment variables** using React's `process.env.REACT_APP_*` pattern
3. **Created `.env.example`** template for documentation
4. **Created `.env.local`** with your actual values (not committed to git)

---

## 🚨 CRITICAL: What You MUST Do Now

### 1. Rotate/Regenerate the Exposed API Key

Since this key was committed to GitHub, anyone with access can see it. You **MUST** generate a new API key:

#### Steps to Rotate Firebase API Key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **goshopper-ai**
3. Navigate to: **APIs & Services** → **Credentials**
4. Find the API key: `AIzaSyAQBCR-KLZLPZNNPdv3XxRwMvE-Bsxaxt4`
5. Click the **DELETE** button (or restrict it)
6. Create a **NEW API key**
7. **Restrict the new key**:
   - Application restrictions: Set to "HTTP referrers"
   - Add your website domains: `goshopper-ai.firebaseapp.com`, `goshopper-ai.web.app`
   - API restrictions: Only enable "Firebase" APIs

8. Update the new key in:
   - `web/.env.local` (local development)
   - Your hosting environment variables (Firebase Hosting, Vercel, etc.)

### 2. Update Environment Variables

**For Local Development:**
- Already done! The key is in `web/.env.local`

**For Production (Firebase Hosting):**
```bash
cd web
# Add your new API key to environment config
firebase functions:config:set firebase.api_key="YOUR_NEW_KEY"
```

**For Other Hosting (Vercel, Netlify, etc.):**
- Add `REACT_APP_FIREBASE_API_KEY` in your hosting dashboard's environment variables section

### 3. Remove Exposed Key from Git History (Optional but Recommended)

The old key is still in your git history. To completely remove it:

#### Option A: Use BFG Repo-Cleaner (Recommended)
```bash
# 1. Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
# 2. Run from your repo root:
bfg --replace-text <(echo "AIzaSyAQBCR-KLZLPZNNPdv3XxRwMvE-Bsxaxt4==>REMOVED")
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

#### Option B: Use git-filter-repo
```bash
pip install git-filter-repo
git filter-repo --replace-text <(echo "AIzaSyAQBCR-KLZLPZNNPdv3XxRwMvE-Bsxaxt4==>REMOVED")
git push --force
```

⚠️ **Warning**: Force pushing rewrites history. Coordinate with your team first!

### 4. Commit the Security Fix

```bash
git add web/src/App.js web/.env.example
git commit -m "security: Remove hardcoded Firebase API key, use environment variables"
git push
```

---

## 📚 How to Use Environment Variables Going Forward

### Local Development
1. Copy `web/.env.example` to `web/.env.local`
2. Fill in your actual values
3. Never commit `.env.local` (already in `.gitignore`)

### Production Deployment
Set environment variables in your hosting platform:
- **Firebase Hosting**: Use Firebase Functions config
- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Build & Deploy → Environment

### Code Usage
```javascript
// ✅ Good - Using environment variables
const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;

// ❌ Bad - Hardcoded secrets
const apiKey = "AIzaSyAQBCR...";
```

---

## 🔍 Verify the Fix

1. **Check git status**: Ensure `.env.local` is NOT staged
   ```bash
   git status
   # Should NOT show .env.local
   ```

2. **Test locally**: 
   ```bash
   cd web
   npm start
   # Should work with environment variables
   ```

3. **Check GitHub**: The alert should resolve after you push the fix and rotate the key

---

## 📞 Need Help?

- [Firebase Security Best Practices](https://firebase.google.com/docs/projects/api-keys)
- [React Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

---

## ✅ Checklist

- [ ] Rotated/deleted exposed API key in Google Cloud Console
- [ ] Created new restricted API key
- [ ] Updated `.env.local` with new key
- [ ] Updated production environment variables
- [ ] Committed security fix to git
- [ ] (Optional) Removed key from git history
- [ ] Verified GitHub alert is resolved
