# Fix send-timesheet-reminder Function

## Issues Fixed

### 1. ✅ 404 Error (RESOLVED)
The function was not deployed initially - now deployed.

### 2. ⚠️ Current Issue: "Edge Function returned a non-2xx status code"
The function is missing required environment variables in Supabase.

## Required Environment Variables

The function requires these environment variables to be set **in your Supabase project**:

### Critical (Function will fail without these):
- `SUPABASE_SERVICE_ROLE_KEY` - **Required for admin operations** (bypasses RLS)
- `BREVO_API_KEY` - Brevo API key for sending emails
- `BREVO_FROM` - From email address

### Auto-provided by Supabase:
- `SUPABASE_URL` - Automatically available
- `SUPABASE_ANON_KEY` - Automatically available (not used by current version)

### Optional (have defaults):
- `COMPANY_LOGO_URL_W` - Company logo URL (defaults to Supabase storage)
- `AT_LOGO_URL` - Area Tecnica logo URL (defaults to Supabase storage)

## How to Set Environment Variables

### Via Supabase Dashboard:

1. Go to https://supabase.com/dashboard/project/syldobdcdsgfgjtbuwxm/settings/functions
2. Scroll to "Environment variables" or "Secrets"
3. Add the following secrets:
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (found in Project Settings > API > service_role key)
   - `BREVO_API_KEY`: Your Brevo/Sendinblue API key
   - `BREVO_FROM`: Your verified sender email

### Via Supabase CLI:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
npx supabase secrets set BREVO_API_KEY=your-brevo-api-key
npx supabase secrets set BREVO_FROM=noreply@yourdomain.com
```

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
- **404 Not Found**: Timesheet not found (check that SERVICE_ROLE_KEY is set!)
- **500 Internal Server Error**: Check Supabase function logs for details

## Troubleshooting

### "Edge Function returned a non-2xx status code"

This error means the function is deployed but failing during execution. Common causes:

1. **Missing SUPABASE_SERVICE_ROLE_KEY**
   - Symptom: Function returns 404 or 500 when querying database
   - Fix: Set the environment variable in Supabase dashboard
   - Verify: Check Project Settings > API > service_role key

2. **Missing BREVO_API_KEY or BREVO_FROM**
   - Symptom: Function works until trying to send email
   - Fix: Set both Brevo environment variables

3. **Check Function Logs**
   - Go to https://supabase.com/dashboard/project/syldobdcdsgfgjtbuwxm/functions/send-timesheet-reminder
   - View recent invocations and logs
   - Look for console.log and console.error messages

### How to Get Your Service Role Key

1. Go to https://supabase.com/dashboard/project/syldobdcdsgfgjtbuwxm/settings/api
2. Scroll to "Project API keys"
3. Copy the `service_role` key (⚠️ **Keep this secret!**)
4. Add it to your edge function environment variables

### After Setting Variables, Redeploy

After adding environment variables, you must redeploy the function:

```bash
npx supabase functions deploy send-timesheet-reminder
```

## Function Details

- **Path**: `supabase/functions/send-timesheet-reminder/index.ts`
- **Config**: JWT verification enabled (`verify_jwt = true`)
- **Permissions**: Requires admin or management role
- **Purpose**: Sends reminder emails to technicians for incomplete timesheets

## Environment Variables Required

The function requires these environment variables to be set in Supabase:
- `BREVO_API_KEY` - Brevo API key for sending emails
- `BREVO_FROM` - From email address
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `COMPANY_LOGO_URL_W` (optional) - Company logo URL
- `AT_LOGO_URL` (optional) - Area Tecnica logo URL
