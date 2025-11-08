# Automatic Timesheet Reminders

This feature automatically sends email reminders to technicians who haven't submitted their timesheets 24 hours after a job is completed.

## How It Works

1. **Cron Job**: A PostgreSQL cron job runs every hour to check for jobs that ended approximately 24 hours ago
2. **Job Detection**: The system looks for jobs with `end_time` between 23.5 and 24.5 hours ago (1-hour window)
3. **Assignment Check**: For each completed job, it finds all assigned technicians
4. **Timesheet Verification**: Checks if each technician has submitted or approved timesheets for that job
5. **Reminder Emails**: Sends reminder emails to technicians with draft timesheets that haven't been submitted

## Components

### Edge Functions

1. **`auto-send-timesheet-reminders`** (`supabase/functions/auto-send-timesheet-reminders/index.ts`)
   - Main function that runs on schedule
   - Queries for completed jobs
   - Finds technicians with incomplete timesheets
   - Calls the reminder function for each

2. **`send-timesheet-reminder`** (`supabase/functions/send-timesheet-reminder/index.ts`)
   - Sends individual reminder emails
   - Called by the automated function or manually by management
   - Requires: `timesheetId` in request body

### Database

- **Migration**: `20251108130000_auto_timesheet_reminders_cron.sql`
  - Enables `pg_cron` and `pg_net` extensions
  - Creates helper function `invoke_auto_timesheet_reminders()`
  - Schedules hourly cron job

### Configuration

- **Config**: `supabase/config.toml`
  - `auto-send-timesheet-reminders`: `verify_jwt = false` (called by cron)
  - `send-timesheet-reminder`: `verify_jwt = true` (called by authenticated users)

## Setup Requirements

The cron job needs access to:
- Supabase URL
- Service role key (for bypassing RLS)

These should be configured either:
1. Via PostgreSQL settings: `app.settings.supabase_url` and `app.settings.service_role_key`
2. Or via the `push_cron_config` table (if it exists in your project)

## Schedule

- **Frequency**: Every hour (at minute 0: 1:00, 2:00, 3:00, etc.)
- **Window**: Checks for jobs that ended 23.5-24.5 hours ago
- **Timezone**: Server timezone (ensure jobs' `end_time` is stored in UTC)

## Email Logic

**Each timesheet receives only ONE automated reminder** - no spam!

Reminders are sent when:
- ✅ Job ended 24 hours ago (±30 minutes)
- ✅ Technician is assigned to the job
- ✅ Technician has draft timesheets for the job
- ✅ Reminder has NOT been sent yet (`reminder_sent_at` is NULL)
- ❌ Technician has NOT submitted or approved timesheets

Reminders are NOT sent when:
- Job has no technician assignments
- Technician has already submitted timesheets
- Technician has no timesheets at all (assumes they're creating them)
- **A reminder was already sent for this timesheet** (prevents hourly spam)

### Reminder Tracking

The system uses the `reminder_sent_at` column in the `timesheets` table to track whether a reminder has been sent. This ensures:
- Each timesheet only gets ONE automated reminder
- Manual reminders from management also update this timestamp
- No repeated emails to technicians

## Manual Testing

You can manually trigger the automated function:

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/auto-send-timesheet-reminders \
  -H 'Content-Type: application/json'
```

Or test the individual reminder function (requires authentication):

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/send-timesheet-reminder \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"timesheetId": "uuid-here"}'
```

## Monitoring

Check logs in Supabase Dashboard:
1. Edge Functions → `auto-send-timesheet-reminders` → Logs
2. Look for:
   - "Found X jobs that ended 24 hours ago"
   - "Sending reminder to technician..."
   - "Successfully sent reminder..."

## Troubleshooting

### No reminders being sent

1. **Check cron job status**:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'auto-send-timesheet-reminders';
   ```

2. **Check if jobs exist in the time window**:
   ```sql
   SELECT id, title, end_time
   FROM jobs
   WHERE end_time >= NOW() - INTERVAL '24.5 hours'
     AND end_time <= NOW() - INTERVAL '23.5 hours';
   ```

3. **Check function logs** in Supabase Dashboard

### Configuration not found

Update the configuration:

```sql
-- Option 1: Set PostgreSQL settings (recommended)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

-- Option 2: Update push_cron_config table (if exists)
UPDATE push_cron_config
SET supabase_url = 'https://your-project.supabase.co',
    service_role_key = 'your-service-role-key'
WHERE id = 1;
```

## Future Enhancements

Potential improvements:
- Configurable reminder timing (e.g., 12 hours, 48 hours)
- Multiple reminder attempts
- Escalation to management after X days
- Skip reminders for specific job types
- Batch reminder emails to reduce email volume
