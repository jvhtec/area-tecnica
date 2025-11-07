# Daily Morning Push Notification - Setup Guide

This feature sends automated morning summaries with personnel status (who's on jobs, in warehouse, on vacation, etc.).

## Overview

- **Event Type**: `daily.morning.summary`
- **Default Schedule**: 8:00 AM (Europe/Madrid timezone)
- **Default Days**: Monday - Friday (weekdays only)
- **Recipient System**: Granular user subscriptions - each user chooses which departments to receive
- **Message Format**: Single notification with all subscribed departments combined

## Setup Steps

### 1. Run Database Migrations

**Migration 1**: `20250107080000_daily_morning_push_notification.sql` creates:
- Event type in `activity_catalog`
- Schedule configuration table (`push_notification_schedules`)
- Cron job configuration table (`push_cron_config`)
- Helper function (`invoke_scheduled_push_notification`)
- pg_cron job that runs every 15 minutes from 6 AM - 12 PM on weekdays

**Migration 2**: `20250107081000_morning_summary_user_preferences.sql` creates:
- User subscriptions table (`morning_summary_subscriptions`)
- RLS policies for user-level access control
- Allows granular department selection per user

```bash
# Migrations run automatically with Supabase
npm run db:push
```

### 2. Configure Cron Job Settings

**IMPORTANT**: After deploying the migration, you must update the `push_cron_config` table with your Supabase project URL.

Run this SQL in your Supabase SQL Editor:

```sql
UPDATE push_cron_config
SET
  supabase_url = 'https://YOUR-PROJECT-ID.supabase.co',
  service_role_key = NULL  -- Optional: leave NULL to use database setting
WHERE id = 1;
```

Replace `YOUR-PROJECT-ID` with your actual Supabase project ID.

**Alternative**: If you prefer to store the service role key in the database:

```sql
UPDATE push_cron_config
SET
  supabase_url = 'https://YOUR-PROJECT-ID.supabase.co',
  service_role_key = 'your-service-role-key-here'
WHERE id = 1;
```

⚠️ **Security Note**: The service role key has full database access. Only store it if you understand the security implications. Otherwise, leave it NULL and ensure the `app.settings.service_role_key` database setting is configured.

### 3. Users Subscribe to Departments

**Who can subscribe**: Management users, Admin users, and House Tech users

**How to subscribe**:
1. Go to **Settings** page
2. Scroll to **"Mi Suscripción al Resumen Diario"** (My Daily Summary Subscription) card
3. Toggle **"Recibir resumen diario"** to ON
4. Select which departments you want to receive:
   - 🎤 Sonido (Sound)
   - 💡 Iluminación (Lights)
   - 📹 Vídeo (Video)
   - 🚚 Logística (Logistics)
   - 🎬 Producción (Production)
5. Click **"Guardar preferencias"** (Save preferences)

**Key features**:
- ✅ Subscribe to **multiple departments** - receive all in one notification
- ✅ Each user controls their own subscriptions independently
- ✅ Can enable/disable without losing department selections
- ✅ Instant updates - changes take effect on next scheduled send

**Message format**:
- **Single department**: "Resumen del día - Sonido"
- **Multiple departments**: "Resumen del día - Sonido, Iluminación, Vídeo" with sections for each

### 4. Configure Schedule Time (Admin Only)

1. Go to **Settings** page
2. Scroll to **"Notificación Diaria Matutina"** card
3. Adjust settings:
   - **Enable/Disable**: Toggle the notification on/off
   - **Send Time**: Choose hour (6 AM - 12 PM)
   - **Days**: Select which weekdays to send

Changes are saved immediately and take effect on the next scheduled check (within 15 minutes).

### 5. Verify pg_cron Extension

Ensure pg_cron and pg_net extensions are enabled:

```sql
-- Check if extensions are enabled
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- If not enabled, run:
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 6. Verify Cron Job

Check that the cron job was created:

```sql
-- List all cron jobs
SELECT * FROM cron.job WHERE jobname = 'check-morning-notifications';

-- View recent job runs
SELECT * FROM cron.job_run_details
WHERE jobname = 'check-morning-notifications'
ORDER BY start_time DESC
LIMIT 10;
```

## Testing

### Manual Test (Force Send)

To manually trigger a morning summary (bypasses time check):

```sql
-- Call the function directly
SELECT invoke_scheduled_push_notification('daily.morning.summary');
```

Or via HTTP (requires service role key):

```bash
curl -X POST https://YOUR-PROJECT-ID.supabase.co/functions/v1/push \
  -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "check_scheduled",
    "type": "daily.morning.summary",
    "force": true
  }'
```

### Verify Schedule Check

The cron job runs every 15 minutes. Check logs:

```sql
-- View cron job execution logs
SELECT
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname = 'check-morning-notifications'
ORDER BY start_time DESC
LIMIT 20;
```

### Check Edge Function Logs

View Supabase Edge Function logs to see:
- When schedule checks run
- When messages are sent
- Any errors

Go to: **Supabase Dashboard → Edge Functions → push → Logs**

Look for log messages like:
- `🔍 Checking scheduled notification: daily.morning.summary`
- `✅ Time check passed! Sending at 8:0 on Mon`
- `📨 Sending to N recipients`
- `📊 Recipients by department: sound: 2, lights: 1`

## Message Format

**Single Department Subscription**:

```
📅 Resumen Sonido - Lunes 7 de enero

🎤 EN TRABAJOS:
  • Concierto Teatro Nacional: Juan P., María L.
  • Corporate Event ABC: Carlos R.

🏢 EN ALMACÉN: Pedro M., Ana S., Luis G.

🏖️ DE VACACIONES: Roberto K.
✈️ DE VIAJE: Miguel A.

📊 3/8 técnicos disponibles
```

**Multiple Department Subscription**:

```
📅 Resumen del día - Lunes 7 de enero

━━━ SONIDO ━━━

🎤 EN TRABAJOS:
  • Concierto Teatro: Juan P., María L.

🏢 EN ALMACÉN: Pedro M., Ana S.

📊 2/8 técnicos disponibles

━━━ ILUMINACIÓN ━━━

🎤 EN TRABAJOS:
  • Concierto Teatro: Luis G.

🏖️ DE VACACIONES: Carlos R.

📊 1/5 técnicos disponibles
```

## Troubleshooting

### Notification Not Sending

1. **Check if enabled**:
   ```sql
   SELECT * FROM push_notification_schedules WHERE event_type = 'daily.morning.summary';
   ```

2. **Check cron config**:
   ```sql
   SELECT * FROM push_cron_config WHERE id = 1;
   ```
   Ensure `supabase_url` is set correctly (not the placeholder).

3. **Check user subscriptions**:
   ```sql
   SELECT
     p.first_name,
     p.last_name,
     p.role,
     s.subscribed_departments,
     s.enabled
   FROM morning_summary_subscriptions s
   JOIN profiles p ON p.id = s.user_id
   WHERE s.enabled = true;
   ```
   Must have at least one enabled user subscription.

4. **Check cron job exists**:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'check-morning-notifications';
   ```

5. **Check last execution**:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobname = 'check-morning-notifications'
   ORDER BY start_time DESC LIMIT 1;
   ```

### Already Sent Today

The notification sends only once per day at the configured hour. Check:

```sql
SELECT last_sent_at FROM push_notification_schedules
WHERE event_type = 'daily.morning.summary';
```

To reset and allow immediate resend:

```sql
UPDATE push_notification_schedules
SET last_sent_at = NULL
WHERE event_type = 'daily.morning.summary';
```

Then manually trigger with `force: true`.

### No Recipients

Ensure users have:
1. Subscribed to morning summary (enabled = true)
2. Selected at least one department
3. Management, admin, or house_tech role
4. Push notifications enabled in their browser
5. Active push subscription in `push_subscriptions` table

Check user subscriptions and push subscriptions:

```sql
SELECT
  p.first_name,
  p.last_name,
  p.role,
  s.enabled,
  s.subscribed_departments,
  COUNT(ps.endpoint) as device_count
FROM morning_summary_subscriptions s
JOIN profiles p ON p.id = s.user_id
LEFT JOIN push_subscriptions ps ON ps.user_id = p.id
WHERE s.enabled = true
GROUP BY p.id, p.first_name, p.last_name, p.role, s.enabled, s.subscribed_departments;
```

**Common issues**:
- User subscribed but hasn't enabled push notifications in browser
- User has no departments selected (`subscribed_departments` is empty)
- User's push subscription expired (check `device_count = 0`)

## Configuration Reference

### Schedule Configuration

| Field | Type | Description |
|-------|------|-------------|
| `event_type` | TEXT | Always `'daily.morning.summary'` |
| `enabled` | BOOLEAN | Enable/disable sending |
| `schedule_time` | TIME | Send time in HH:MM:SS format (06:00 - 12:00) |
| `timezone` | TEXT | Timezone for scheduling (default: `'Europe/Madrid'`) |
| `days_of_week` | INTEGER[] | Days to send: 1=Mon, 2=Tue, ..., 7=Sun |
| `last_sent_at` | TIMESTAMPTZ | Last successful send timestamp |

### Cron Job Schedule

- **Pattern**: `*/15 6-12 * * 1-5`
- **Meaning**: Every 15 minutes, from 6 AM to 12 PM, Monday through Friday
- **Why 15 minutes?**: Provides flexibility for schedule time changes while being efficient
- **Time Check**: Edge function verifies exact hour match before sending

## Architecture

```
┌─────────────────┐
│   pg_cron Job   │  Runs every 15 min (6AM-12PM, Mon-Fri)
│ (check-morning- │
│  notifications) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  invoke_        │  Database function
│  scheduled_     │  - Fetches config from push_cron_config
│  push_          │  - Calls edge function via pg_net
│  notification() │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Push Edge      │  Handles check_scheduled action
│  Function       │  - Checks time/day match
│  (check_        │  - Queries push_notification_routes
│   scheduled)    │  - Groups recipients by department
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Per-Department │  For each department:
│  Processing     │  - Query job_assignments
│                 │  - Query availability_schedules
│                 │  - Calculate warehouse techs
│                 │  - Format Spanish message
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Web Push API   │  Send to each recipient's devices
│                 │  via push_subscriptions
└─────────────────┘
```

## Files Modified/Created

### Database
- `/supabase/migrations/20250107080000_daily_morning_push_notification.sql` (new)
  - Schedule configuration and cron job setup
- `/supabase/migrations/20250107081000_morning_summary_user_preferences.sql` (new)
  - User subscription preferences table

### Edge Function
- `/supabase/functions/push/index.ts` (modified)
  - Added `check_scheduled` action
  - Added morning summary handlers (single and multi-department)
  - Added department-specific query functions with caching
  - Updated to use `morning_summary_subscriptions` table

### Frontend - Schedule Management (Admin Only)
- `/src/hooks/usePushNotificationSchedule.ts` (new)
- `/src/components/settings/PushNotificationSchedule.tsx` (new, modified)

### Frontend - User Subscriptions (Management/Admin/House Tech)
- `/src/hooks/useMorningSummarySubscription.ts` (new)
- `/src/components/settings/MorningSummarySubscription.tsx` (new)
- `/src/pages/Settings.tsx` (modified)

### Documentation
- `/docs/DAILY_MORNING_PUSH_NOTIFICATION_SETUP.md` (this file)

## Future Enhancements

Possible improvements:
- [ ] Multiple scheduled notifications (e.g., end-of-day summary)
- [ ] Custom message templates
- [ ] More granular time selection (minutes, not just hours)
- [ ] Weekend scheduling option
- [ ] Email fallback for users without push subscriptions
- [ ] Analytics dashboard for delivery rates
