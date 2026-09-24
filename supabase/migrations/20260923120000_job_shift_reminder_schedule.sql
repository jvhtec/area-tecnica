-- Evening-before shift reminder (job.shift.reminder).
--
-- Every technician with an active timesheet for tomorrow gets one push the
-- evening before: which job, the call time from their own timesheet and the
-- venue. It reuses the scheduler lease (claim_push_schedule /
-- finish_push_schedule), the durable inbox and recipient preferences, so it is
-- idempotent per evening and a partial send is retried on the next tick.

-- The original time window (06:00-12:00) was written for the morning summary
-- and blocked any evening schedule. Keep it for the morning summary and give
-- the shift reminder its own evening window.
ALTER TABLE public.push_notification_schedules
  DROP CONSTRAINT IF EXISTS valid_schedule_time;

ALTER TABLE public.push_notification_schedules
  ADD CONSTRAINT valid_schedule_time CHECK (
    CASE event_type
      WHEN 'job.shift.reminder'
        THEN schedule_time >= '17:00:00'::time AND schedule_time <= '23:00:00'::time
      ELSE schedule_time >= '06:00:00'::time AND schedule_time <= '12:00:00'::time
    END
  );

COMMENT ON COLUMN public.push_notification_schedules.schedule_time IS
  'Local send time (HH:MM:SS). 06:00-12:00 for morning schedules; 17:00-23:00 for job.shift.reminder.';

INSERT INTO public.push_notification_schedules (
  event_type,
  enabled,
  schedule_time,
  timezone,
  days_of_week
) VALUES (
  'job.shift.reminder',
  true,
  '20:00:00',
  'Europe/Madrid',
  ARRAY[1, 2, 3, 4, 5, 6, 7]
)
ON CONFLICT (event_type) DO NOTHING;

-- The push function only sends at the configured minute (or resumes a
-- retryable occurrence), so a tick is a cheap no-op otherwise. Ticking only
-- between 15:00 and 22:59 UTC covers the whole 17:00-23:00 Europe/Madrid
-- window in both CET and CEST, and keeps retries from firing after midnight
-- when "tomorrow" would already be today.
DO $cron$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING 'cron schema not available; job shift reminder cron was not scheduled';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'job-shift-reminder-tick'
  ) THEN
    PERFORM cron.unschedule('job-shift-reminder-tick');
  END IF;

  PERFORM cron.schedule(
    'job-shift-reminder-tick',
    '* 15-22 * * *',
    $$SELECT public.invoke_scheduled_push_notification('job.shift.reminder')$$
  );
END $cron$;
