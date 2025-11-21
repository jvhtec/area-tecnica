-- Disable the trigger that auto-creates timesheets for full job span
-- This was causing issues when using per-day assignments
-- Safe to run multiple times.

DO $$
BEGIN
  -- Disable the trigger if it exists
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'create_timesheets_on_assignment') THEN
    ALTER TABLE public.job_assignments DISABLE TRIGGER create_timesheets_on_assignment;
  END IF;
END $$;
