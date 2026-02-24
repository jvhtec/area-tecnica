-- Keep auto reminders default-off globally.
-- This migration is idempotent and safe to re-run.

ALTER TABLE IF EXISTS public.timesheet_reminder_settings
  ALTER COLUMN auto_reminders_enabled SET DEFAULT false;

UPDATE public.timesheet_reminder_settings
SET auto_reminders_enabled = false,
    updated_at = now()
WHERE auto_reminders_enabled IS DISTINCT FROM false;
