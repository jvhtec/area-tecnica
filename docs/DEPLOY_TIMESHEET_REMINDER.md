# Deploy send-timesheet-reminder Function

## Issue
The `send-timesheet-reminder` edge function returns 404 because it hasn't been deployed to Supabase yet.

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

After deployment, test the function by sending a POST request:

```bash
curl -X POST \
  https://syldobdcdsgfgjtbuwxm.supabase.co/functions/v1/send-timesheet-reminder \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timesheetId": "your-timesheet-id"}'
```

You should receive a 200 OK response instead of 404.

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
