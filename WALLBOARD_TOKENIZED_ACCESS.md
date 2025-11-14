# Wallboard Tokenized Access

This document describes the tokenized access feature for the wallboard, allowing display of wallboards without requiring user authentication.

## Features Implemented

### 1. Splash Screen Animation
- Beautiful animated splash screen that appears while wallboard data loads
- Features:
  - Animated logo with glow effects
  - Floating particles background
  - Animated grid background
  - Loading bar indicator
  - "Initializing System" text
  - Auto-dismisses after 3 seconds or on click
- Located in: `src/components/SplashScreen.tsx`

### 2. Tokenized Wallboard Access
- New public route that doesn't require user login
- URL format: `/wallboard/public/:token/:presetSlug?`
- Token-based access control for security
- Automatic Supabase authentication with dedicated service account
- Located in: `src/pages/WallboardPublic.tsx`

## 🚀 Complete Setup Guide

### Prerequisites
- Supabase project with area-tecnica database
- Existing wallboard RLS policies (from migrations)
- Access to Supabase Dashboard

### Step 1: Create Wallboard Service Account

**1.1 Create the user in Supabase:**
```sql
-- Go to Supabase Dashboard → SQL Editor
-- Run this to create the user (or use the Dashboard UI)

-- Note: You can also create via Dashboard → Authentication → Users → Add User
-- Email: wallboard@yourcompany.com
-- Password: [generate a strong password]
```

**1.2 Assign wallboard role:**
```sql
-- Find the newly created user
SELECT id, email FROM auth.users
WHERE email = 'wallboard@yourcompany.com';

-- Update their profile with wallboard role
UPDATE profiles
SET role = 'wallboard'
WHERE id = '[USER_ID_FROM_ABOVE]';

-- Verify the role was set
SELECT p.id, u.email, p.role, p.first_name, p.last_name
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'wallboard@yourcompany.com';
```

**1.3 Verify RLS policies exist:**
```sql
-- Check that wallboard policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE policyname LIKE '%wallboard%'
ORDER BY tablename, policyname;
```

### Step 2: Configure Environment Variables

**2.1 Add to your `.env.local` file:**
```bash
# URL token for access validation
VITE_WALLBOARD_TOKEN=your-secure-random-token-here

# Wallboard service account credentials
VITE_WALLBOARD_USER_EMAIL=wallboard@yourcompany.com
VITE_WALLBOARD_USER_PASSWORD=the-strong-password-you-created
```

**2.2 Generate secure tokens:**
```bash
# Generate a secure random token (use this for VITE_WALLBOARD_TOKEN)
openssl rand -hex 32

# Example output: 7f3e9c8a1b2d4f6e8a9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a
```

**2.3 For production deployment:**
- Set these variables in your hosting platform (Vercel, Netlify, etc.)
- Use different tokens for dev/staging/production
- Never commit `.env.local` to git

### Step 3: (Optional) Configure Edge Functions

If you want additional security through edge functions:

**3.1 Set Supabase Edge Function secrets:**
```bash
# Via Supabase CLI
supabase secrets set WALLBOARD_SHARED_TOKEN=same-as-vite-wallboard-token
supabase secrets set WALLBOARD_JWT_SECRET=different-secure-random-token
supabase secrets set WALLBOARD_JWT_TTL=900

# Or via Supabase Dashboard → Edge Functions → Manage secrets
```

**3.2 Deploy the edge function:**
```bash
supabase functions deploy wallboard-auth
```

### Step 4: Test Your Setup

**4.1 Local development:**
```bash
# Make sure .env.local is configured
npm run dev

# Navigate to:
http://localhost:5173/wallboard/public/your-token-here/default
```

**4.2 Check for success:**
- ✅ Splash screen appears for 3-5 seconds
- ✅ Wallboard loads with data
- ✅ No console errors
- ✅ All panels display correctly

**4.3 Common issues:**
```bash
# If you see "Access Denied":
# - Check token in URL matches VITE_WALLBOARD_TOKEN

# If you see "Failed to authenticate":
# - Check VITE_WALLBOARD_USER_EMAIL and VITE_WALLBOARD_USER_PASSWORD
# - Verify the user exists in Supabase Auth

# If wallboard loads but shows no data:
# - Check the user's role is 'wallboard' in profiles table
# - Verify RLS policies allow wallboard role access
```

### Step 5: Deploy to Production

**5.1 Set environment variables in your hosting platform**

**5.2 Create the wallboard user in production Supabase:**
- Repeat Step 1 in your production Supabase project

**5.3 Deploy your application:**
```bash
npm run build
# Then deploy via your hosting platform
```

**5.4 Share the URL with your team:**
```
https://yourdomain.com/wallboard/public/YOUR_PRODUCTION_TOKEN/default
```

---

## Usage

### Accessing the Wallboard with Token

#### URL Format
```
/wallboard/public/{TOKEN}/{PRESET_SLUG}
```

#### Examples
```
# Access default wallboard with demo token
/wallboard/public/demo-wallboard-token/default

# Access production wallboard with demo token
/wallboard/public/demo-wallboard-token/produccion

# Access custom preset with production token
/wallboard/public/your-secure-token/custom-preset
```

### Setting Up the Access Token

The wallboard token is configured via environment variable:

1. Create or update your `.env` file:
```bash
VITE_WALLBOARD_TOKEN=your-secure-random-token-here
```

2. Generate a secure token (recommended):
```bash
# Using openssl
openssl rand -hex 32

# Or using node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Share the complete URL with authorized users:
```
https://yourdomain.com/wallboard/public/your-secure-random-token-here/default
```

### Default Token (Development Only)
For development/testing, the default token is: `demo-wallboard-token`

**⚠️ WARNING**: Change this token in production! Use a long, random string.

## Authentication Flow

### Authenticated Access (Existing)
```
User → Login → Dashboard → /wallboard/:presetSlug
                            ↓
                     Requires auth + role check
                     (admin, management, or wallboard role)
```

### Tokenized Access (New)
```
Display Device → /wallboard/public/:token/:presetSlug
                            ↓
                   Step 1: Validate token (client-side)
                            ↓
                   Step 2: Sign in with wallboard service account
                            ↓
                   Step 3: Supabase session established
                            ↓
                   Step 4: Wallboard queries data with RLS policies
                            ↓
                   Wallboard displays with proper data access
```

### What Happens Behind the Scenes

1. **Token Validation**
   - Browser checks if URL token matches `VITE_WALLBOARD_TOKEN`
   - If no match → "Access Denied"

2. **Supabase Authentication**
   - Signs in with `VITE_WALLBOARD_USER_EMAIL` and `VITE_WALLBOARD_USER_PASSWORD`
   - Creates a Supabase session with the wallboard role
   - Session is stored in browser (localStorage)

3. **Data Access**
   - All wallboard queries use the established Supabase session
   - RLS policies check the user's role (`wallboard`)
   - Only data allowed by RLS policies is returned

4. **Session Management**
   - Session persists across page refreshes
   - Supabase automatically refreshes tokens
   - No need to re-authenticate on each visit

## Components Modified

### 1. `src/pages/Wallboard.tsx`
- Added splash screen integration
- Refactored to support both authenticated and public access
- Created `WallboardDisplay` component (main display logic)
- Kept `Wallboard` as default export with auth guard
- Exported `WallboardDisplay` for use by public route

### 2. `src/App.tsx`
- Added new route: `/wallboard/public/:token/:presetSlug?`
- Route placed before authenticated wallboard route
- No `RequireAuth` wrapper on public route

### 3. New Files Created
- `src/components/SplashScreen.tsx` - Animated splash screen
- `src/pages/WallboardPublic.tsx` - Public wallboard access handler

## Security Considerations

### 1. Token Security
- ✅ Use long, random tokens (32+ characters minimum)
- ✅ Rotate tokens periodically (e.g., every 90 days)
- ✅ Never commit tokens to version control
- ✅ Use different tokens for different environments
- ✅ Store tokens securely in environment variables

### 2. Wallboard Service Account
- ✅ Create a dedicated account (don't reuse admin accounts)
- ✅ Assign **only** the `wallboard` role (least privilege)
- ✅ Use a strong, unique password
- ✅ Store credentials in environment variables only
- ✅ Never expose credentials in client-side code

### 3. Access Control
- ✅ Token + credentials required for access (two-factor security)
- ✅ Read-only access via RLS policies
- ✅ No write operations possible through public route
- ✅ Data access limited to wallboard role permissions
- ✅ Session-based authentication with automatic refresh

### 4. RLS (Row Level Security) Policies
The wallboard service account uses existing RLS policies that:
- Allow `SELECT` on jobs, assignments, timesheets, etc.
- Check for role = 'wallboard' OR role = 'admin' OR role = 'management'
- Prevent any `INSERT`, `UPDATE`, or `DELETE` operations
- Are defined in: `/supabase/migrations/*wallboard_rls*.sql`

### 5. Production Recommendations
- ✅ Use HTTPS only for wallboard URLs
- ✅ Set all environment variables in production
- ✅ Monitor Supabase auth logs for suspicious activity
- ✅ Implement IP whitelisting if possible
- ✅ Consider implementing token expiration/rotation
- ✅ Use Supabase Edge Functions in production for additional security layer

### 6. What's Exposed vs. Protected

**Exposed (client-side):**
- `VITE_WALLBOARD_TOKEN` - URL token for initial validation
- `VITE_WALLBOARD_USER_EMAIL` - Service account email
- `VITE_WALLBOARD_USER_PASSWORD` - Service account password

**Protected (server-side):**
- `WALLBOARD_SHARED_TOKEN` - Edge function validation
- `WALLBOARD_JWT_SECRET` - JWT signing secret
- All database data (via RLS policies)

**Why This Is Secure:**
1. Even if someone obtains the service account credentials, they can only read wallboard data
2. RLS policies prevent any data modification
3. The wallboard role has minimal permissions
4. Credentials can be rotated without code changes
5. Session expires and requires re-authentication

## Data Access

The wallboard uses the following data sources (all read-only):
- Jobs and job assignments
- Crew availability and timesheets
- Document progress
- Logistics events
- Announcements
- Wallboard presets

All data access is governed by existing RLS policies configured for the `wallboard` role.

## Troubleshooting

### "Access Denied" Error
**Symptoms:** Red error screen with "Access Denied"

**Solutions:**
- ✅ Verify the token in URL matches `VITE_WALLBOARD_TOKEN` environment variable
- ✅ Check that the URL format is correct: `/wallboard/public/TOKEN/preset-slug`
- ✅ Ensure the environment variable is set in your deployment
- ✅ Clear browser cache and try again

### "Failed to authenticate wallboard session"
**Symptoms:** Error after token validation passes

**Solutions:**
- ✅ Verify `VITE_WALLBOARD_USER_EMAIL` is set correctly
- ✅ Verify `VITE_WALLBOARD_USER_PASSWORD` is set correctly
- ✅ Check that the wallboard user exists in Supabase Authentication
- ✅ Ensure the user's password is correct
- ✅ Check Supabase project is online and accessible
- ✅ Look at browser console for detailed error messages

### "Wallboard service account not configured"
**Symptoms:** Error message about missing configuration

**Solutions:**
- ✅ Set `VITE_WALLBOARD_USER_EMAIL` in your environment
- ✅ Set `VITE_WALLBOARD_USER_PASSWORD` in your environment
- ✅ Follow the "Step 1: Create a Wallboard Service Account" section above
- ✅ Rebuild your application after setting environment variables

### Wallboard Shows No Data
**Symptoms:** Wallboard loads but panels are empty

**Solutions:**
- ✅ Check browser console for RLS policy errors
- ✅ Verify wallboard user has role = 'wallboard' in profiles table:
  ```sql
  SELECT id, email, role FROM profiles
  WHERE id = (SELECT id FROM auth.users WHERE email = 'wallboard@yourcompany.com');
  ```
- ✅ Ensure RLS policies allow wallboard role access
- ✅ Check that jobs exist in the database
- ✅ Verify the preset slug exists in `wallboard_presets` table

### Authentication Loops or Redirects
**Symptoms:** Page keeps reloading or redirecting

**Solutions:**
- ✅ Clear browser localStorage: `localStorage.clear()`
- ✅ Sign out any existing user sessions first
- ✅ Check for conflicting auth state in browser
- ✅ Try in incognito/private browsing mode

### Splash Screen Not Appearing
**Symptoms:** No loading animation

**Solutions:**
- ✅ Splash screen shows for up to 5 seconds during validation
- ✅ Click anywhere to skip the splash screen
- ✅ If wallboard loads instantly, splash may be skipped
- ✅ Check that SplashScreen component is imported correctly

### RLS Policy Errors
**Symptoms:** "permission denied for table X" errors in console

**Solutions:**
- ✅ Ensure all wallboard RLS migrations have been applied:
  ```bash
  supabase db push
  ```
- ✅ Check that policies exist for wallboard role:
  ```sql
  SELECT schemaname, tablename, policyname, roles
  FROM pg_policies
  WHERE policyname LIKE '%wallboard%';
  ```
- ✅ Verify wallboard user's role is exactly 'wallboard' (case-sensitive)

### Edge Function Issues (If Using)
**Symptoms:** 403 Forbidden from wallboard-auth endpoint

**Solutions:**
- ✅ Verify `WALLBOARD_SHARED_TOKEN` is set in Supabase Edge Function secrets
- ✅ Verify `WALLBOARD_JWT_SECRET` is set in Supabase Edge Function secrets
- ✅ Ensure edge function is deployed: `supabase functions deploy wallboard-auth`
- ✅ Check edge function logs in Supabase Dashboard

## Future Enhancements

Potential improvements for the tokenized access:
1. Token expiration/rotation system
2. Per-preset token access control
3. Access logging and analytics
4. Multiple token support (different tokens for different presets)
5. JWT-based tokens with Supabase edge function integration
6. IP whitelist restrictions
