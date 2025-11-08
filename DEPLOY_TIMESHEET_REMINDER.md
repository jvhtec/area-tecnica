# Fix send-timesheet-reminder Function

## Quick Fix Summary

**You need to redeploy the function to fix the error!**

The database schema issue has been fixed. The function now fetches job data separately instead of trying to join (since no FK constraint exists). Run this command to deploy the fix:

```bash
npx supabase functions deploy send-timesheet-reminder
```

Then ensure you have set the Brevo secrets (see "How to Set Environment Variables" section below).

---

## Issues Fixed

### 1. ✅ 404 Error (RESOLVED)
The function was not deployed initially - now deployed.

### 2. ✅ Database Relationship Errors (RESOLVED)
Three relationship issues were fixed:
- **Technician relationship**: Used wrong FK name `timesheets_technician_id_fkey` → Fixed to `fk_timesheets_technician_id` (commit 23b735d)
- **Jobs relationship (attempt 1)**: Tried to use auto-detection → Failed because no FK constraint exists (commit a164d4a)
- **Jobs relationship (final fix)**: Changed to fetch job data separately instead of joining (commit e9decd9)

**Root cause**: The `timesheets.job_id` column has no foreign key constraint defined in the database schema. PostgREST requires an actual FK constraint to auto-detect relationships via joins.

### 3. ⚠️ Next Step: Deploy Updated Function & Set Secrets
The function code has been fixed and pushed. You need to:
1. Redeploy the function to pick up all fixes (latest commit: e9decd9)
2. Set the required Brevo secrets (if not already done)

## Required Environment Variables

The function requires these environment variables to be set **in your Supabase project**:

### ⚠️ Critical (Must be set as secrets):
- `BREVO_API_KEY` - Brevo API key for sending emails
- `BREVO_FROM` - From email address (must be verified in Brevo)

### ✅ Auto-provided by Supabase (DO NOT SET MANUALLY):
- `SUPABASE_URL` - Automatically injected by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically injected by Supabase (bypasses RLS)
- `SUPABASE_ANON_KEY` - Automatically injected by Supabase

### Optional (have defaults):
- `COMPANY_LOGO_URL_W` - Company logo URL (defaults to Supabase storage)
- `AT_LOGO_URL` - Area Tecnica logo URL (defaults to Supabase storage)

## How to Set Environment Variables

### Via Supabase Dashboard:

1. Go to https://supabase.com/dashboard/project/syldobdcdsgfgjtbuwxm/settings/functions
2. Scroll to "Environment variables" or "Secrets"
3. Add the following secrets:
   - `BREVO_API_KEY`: Your Brevo/Sendinblue API key
   - `BREVO_FROM`: Your verified sender email (e.g., noreply@sectorpro.com)

### Via Supabase CLI:

```bash
npx supabase secrets set BREVO_API_KEY=your-brevo-api-key
npx supabase secrets set BREVO_FROM=noreply@yourdomain.com
```

**Note**: DO NOT set `SUPABASE_SERVICE_ROLE_KEY` manually - it's automatically provided by Supabase!

## Solution

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   # On macOS
   brew install supabase/tap/supabase

   # On Linux
   # Download from https://github.com/supabase/cli/releases/latest
   ```

2. **Link to your Supabase project**:
   ```bash
   npx supabase link --project-ref syldobdcdsgfgjtbuwxm
   ```
   You'll be prompted for your Supabase access token (get it from https://supabase.com/dashboard/account/tokens)

3. **Deploy the function**:
   ```bash
   npx supabase functions deploy send-timesheet-reminder
   ```

### Option 2: Using Lovable.dev Dashboard

1. Open your Lovable project: https://lovable.dev/projects/d0a166bb-d73b-4553-8f2b-be914bc1e2d8
2. Navigate to the Supabase functions deployment section
3. Deploy the `send-timesheet-reminder` function

### Option 3: Using Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/syldobdcdsgfgjtbuwxm/functions
2. Create a new function or deploy from local files
3. Use the function code from `supabase/functions/send-timesheet-reminder/index.ts`

## Verification

After setting environment variables and redeploying, test the function:

```bash
curl -X POST \
  https://syldobdcdsgfgjtbuwxm.supabase.co/functions/v1/send-timesheet-reminder \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timesheetId": "your-timesheet-id"}'
```

### Expected Responses:

✅ **Success (200)**:
```json
{
  "success": true,
  "messageId": "...",
  "sentTo": "technician@example.com"
}
```

❌ **Error Responses**:
- **401 Unauthorized**: Missing or invalid Authorization header
- **403 Forbidden**: User is not admin or management
- **404 Not Found**: Timesheet not found
- **500 Internal Server Error**: Check Supabase function logs for details

## Troubleshooting

### "Edge Function returned a non-2xx status code"

This error means the function is deployed but failing during execution.

**FIRST STEP: Check the function logs!**

1. Go to https://supabase.com/dashboard/project/syldobdcdsgfgjtbuwxm/functions/send-timesheet-reminder
2. Click on "Logs" or "Invocations"
3. Look at the most recent failed invocation
4. Check the console.log and console.error messages
5. Note the actual HTTP status code (401, 403, 404, 500, etc.)

### Common Issues:

1. **Missing BREVO_API_KEY or BREVO_FROM**
   - Symptom: Function logs show "BREVO_API_KEY is not defined" or email sending fails
   - Fix: Set both Brevo secrets using instructions above

2. **Invalid Authorization Header (401)**
   - Symptom: Logs show "Missing or invalid Authorization header"
   - Fix: Ensure the frontend is passing the JWT token correctly

3. **User Not Admin/Management (403)**
   - Symptom: Logs show "User does not have required role"
   - Fix: Ensure the logged-in user has role 'admin' or 'management' in the profiles table

4. **Timesheet Not Found (404)**
   - Symptom: Logs show "Timesheet not found" or "Error fetching profile"
   - Possible causes:
     - Invalid timesheet ID
     - RLS policies blocking access (check function logs for database errors)

5. **Brevo Email Sending Failed (500)**
   - Symptom: Logs show "Brevo API error" or "Failed to send email"
   - Possible causes:
     - Invalid Brevo API key
     - Unverified sender email address
     - Brevo account issues

### After Setting Variables

After adding or updating environment variables, Supabase automatically makes them available to the function. You may need to wait a few seconds or trigger a new deployment for changes to take effect:

```bash
npx supabase functions deploy send-timesheet-reminder
```

## Function Details

- **Path**: `supabase/functions/send-timesheet-reminder/index.ts`
- **Config**: JWT verification enabled (`verify_jwt = true`)
- **Permissions**: Requires admin or management role
- **Purpose**: Sends reminder emails to technicians for incomplete timesheets

## Summary: What You Need to Set

**Required Secrets (set these manually):**
- ✅ `BREVO_API_KEY` - Brevo API key for sending emails
- ✅ `BREVO_FROM` - From email address (must be verified in Brevo)

**Automatically Provided (don't set these):**
- ✅ `SUPABASE_URL` - Auto-injected by Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected by Supabase

**Optional (have reasonable defaults):**
- `COMPANY_LOGO_URL_W` - Company logo URL (defaults to Supabase storage)
- `AT_LOGO_URL` - Area Tecnica logo URL (defaults to Supabase storage)
