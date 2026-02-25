# 🚀 Database Connection - Available Tools & Scripts

## 🔧 Diagnostic & Recovery Tools

### 1. **diagnose-database.js** - Full System Diagnostics
```bash
node diagnose-database.js
```
**What it does:**
- Checks environment variables
- Validates DATABASE_URL format
- Tests DNS resolution
- Tests port connectivity (5432)
- Attempts PostgreSQL authentication
- Provides detailed error messages if connection fails

**When to use:** First step to understand what's wrong

---

### 2. **recovery-wizard.js** - Interactive Recovery Guide
```bash
node recovery-wizard.js
```
**What it does:**
- Interactive step-by-step recovery guide
- Shows how to resume paused Supabase projects
- Guides creating new Supabase projects
- Helps update .env credentials
- Shows .env file format

**When to use:** When you need guided help fixing the issue

---

### 3. **wake-database.js** - Wake Up Cold Start Database
```bash
node wake-database.js
```
**What it does:**
- Attempts to connect to database 5 times
- Waits 3 seconds between retries
- Wakes up Supabase from cold start
- Shows current server time when successful
- Keeps connection warm for 5 seconds

**When to use:** After fixing main connection issue, to warm up the database

---

### 4. **test-db-connection.js** - Simple Connection Test
```bash
node test-db-connection.js
```
**What it does:**
- Tests basic database connectivity
- Shows if connection times out
- Displays error codes

**When to use:** Quick test to see if database responds

---

### 5. **test-detailed-connection.js** - Detailed Connection Diagnostics
```bash
node test-detailed-connection.js
```
**What it does:**
- Detailed diagnostics of database connection
- Shows which step fails
- Provides timeout and error information

**When to use:** When you need more detail than test-db-connection.js

---

## 📊 Data & Configuration Tools

### 6. **check-db-data.js** - Check Database Contents
```bash
node check-db-data.js
```
**What it does:**
- Lists all tables in the database
- Shows row counts for each table
- Verifies database schema

**When to use:** To confirm database is working and has correct tables

---

### 7. **fix-admin-login.js** - Set Up Admin User
```bash
node fix-admin-login.js
```
**What it does:**
- Creates or resets admin user
- Sets admin credentials for testing
- Configures admin role

**When to use:** After database is connected, to set up admin access

---

## 📋 Recommended Recovery Sequence

### If Database Is Not Connecting:

```bash
# STEP 1: Run full diagnostics
node diagnose-database.js
```

**Result shows:**
- ✅ All green? → Go to STEP 3
- ❌ "Connection timeout"? → Go to STEP 2
- ❌ "Cannot reach database"? → Go to STEP 2

```bash
# STEP 2: Use interactive wizard to fix
node recovery-wizard.js
# Follow the on-screen instructions
```

**What wizard will help with:**
- Resume paused Supabase project, OR
- Create new Supabase project, OR
- Update .env with new credentials

```bash
# STEP 3: Run diagnostics again (after fix)
node diagnose-database.js
# Should show ✅ all checks passing
```

```bash
# STEP 4: Wake up the database
node wake-database.js
```

```bash
# STEP 5: Verify database structure
node check-db-data.js
```

```bash
# STEP 6: Set up admin user
node fix-admin-login.js
```

```bash
# STEP 7: Start the server
npm start
# OR with auto-reload:
npm run dev
```

---

## 🧪 Testing After Fix

### Test Backend Server
```bash
# Health check
curl http://localhost:5000/health

# Should respond:
# {"status":"ok","database":"connected"}
```

### Test Frontend
```
http://localhost:5173
http://localhost:5173/admin/dashboard (requires login)
```

### Test Database Directly
```bash
node -e "import('./src/config/db.js').then(({default: db}) => db.query('SELECT 1').then(() => console.log('✅ DB OK')).catch(e => console.error('❌ Error:', e.message)))"
```

---

## 📝 Manual Recovery Steps (If Scripts Don't Help)

### 1. Check Supabase Project Status
1. Visit https://supabase.com/dashboard
2. Sign in with your account
3. Find your project
4. Check if status is "Ready" or "Paused"
5. If paused, click "Resume"

### 2. Verify DATABASE_URL
Location: `.env` file

```
DATABASE_URL=postgresql://postgres.PROJECT_ID:PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
```

Should have:
- ✅ Correct project ID
- ✅ Correct password
- ✅ Correct region (ap-northeast-2)

### 3. Verify Network
```bash
# Check internet connection
ping google.com

# Verify DNS works
nslookup aws-1-ap-northeast-2.pooler.supabase.com
```

### 4. Stop and Restart Server
```bash
# Stop current server (Ctrl+C)

# Restart
npm start
```

---

## 🆘 If Still Not Working

1. **Try new Supabase project:**
   ```bash
   node recovery-wizard.js
   # Choose option 2: Create new project
   ```

2. **Check .env file is in correct location:**
   ```
   d:\SDP IMPLEMENTATION\IGOLANKATOURS_Backend\.env
   ```

3. **Check .env has NO QUOTES around values:**
   ```
   ❌ DATABASE_URL="postgresql://..."  (Wrong - has quotes)
   ✅ DATABASE_URL=postgresql://...    (Correct - no quotes)
   ```

4. **Check for special characters in password:**
   - If DATABASE_URL has special chars, may need URL encoding

5. **Run with debug output:**
   ```bash
   NODE_DEBUG=* node server.js 2>&1 | grep -i "connect\|database\|error"
   ```

6. **Check system logs:**
   - Windows Event Viewer
   - Check for network connectivity issues

---

## 📚 Quick Reference

| Issue | Script | Solution |
|-------|--------|----------|
| "Cannot connect" | `diagnose-database.js` | Run this first |
| "How do I fix it?" | `recovery-wizard.js` | Start here for guidance |
| "Need new project" | `recovery-wizard.js` → Option 2 | Create new Supabase |
| "Database in cold start" | `wake-database.js` | Warm up database |
| "Want detailed info" | `test-detailed-connection.js` | See all details |
| "Check database data" | `check-db-data.js` | Verify schema |
| "Set up admin" | `fix-admin-login.js` | Create admin user |

---

## 🎯 Summary

**Your database is not connecting because:**
- The Supabase project is **paused/suspended** (most likely)
- OR the credentials in .env are **invalid**

**Quick fix:**
1. Run: `node diagnose-database.js`
2. Run: `node recovery-wizard.js`
3. Follow the on-screen instructions
4. Run: `npm start`

**Questions?**
- Check `DATABASE_CONNECTION_FIX.md` for full troubleshooting guide
- Review console output for specific error messages
- Check Supabase dashboard: https://supabase.com/dashboard
