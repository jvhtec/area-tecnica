-- Add reminder tracking to timesheets table
-- Ensures we only send ONE reminder per timesheet

ALTER TABLE public.timesheets
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.timesheets.reminder_sent_at IS
  'Timestamp when the 24-hour reminder email was sent. NULL means no reminder sent yet.';

-- Create index for faster lookups when checking if reminder was sent
CREATE INDEX IF NOT EXISTS idx_timesheets_reminder_sent
ON public.timesheets(reminder_sent_at) WHERE reminder_sent_at IS NULL;

COMMENT ON INDEX idx_timesheets_reminder_sent IS
  'Optimizes queries for finding timesheets that need reminders (where reminder_sent_at is NULL)';
