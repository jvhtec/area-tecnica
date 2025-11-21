-- Hotfix for missing columns on production
-- This migration adds the missing columns 'is_schedule_only' and 'source' to the 'timesheets' table.
-- It uses IF NOT EXISTS to be safe to run even if partially applied.

ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS is_schedule_only BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'matrix';

-- Add indexes for performance if missing
CREATE INDEX IF NOT EXISTS idx_timesheets_is_schedule_only ON public.timesheets(is_schedule_only);
CREATE INDEX IF NOT EXISTS idx_timesheets_source ON public.timesheets(source);

-- Comment on columns
COMMENT ON COLUMN public.timesheets.is_schedule_only IS 'Flag to indicate if the timesheet entry is for scheduling purposes only (not a worked shift)';
COMMENT ON COLUMN public.timesheets.source IS 'Source of the timesheet entry (e.g., matrix, timesheet, etc.)';
