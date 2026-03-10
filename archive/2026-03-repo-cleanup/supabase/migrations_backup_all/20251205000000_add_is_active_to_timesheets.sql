-- Add is_active column to timesheets for soft-delete functionality
-- This allows voiding timesheets when job dates are marked as 'off' or 'travel'
-- while preserving the data for potential restoration

-- Add the column with default true (all existing records are active)
ALTER TABLE timesheets
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create index for faster filtering on active timesheets
CREATE INDEX IF NOT EXISTS idx_timesheets_is_active
ON timesheets(is_active)
WHERE is_active = true;

-- Add comment explaining the column
COMMENT ON COLUMN timesheets.is_active IS
'Soft-delete flag. When false, timesheet is voided (e.g., when job date marked as off/travel). Can be restored. IMPORTANT: All timesheet queries should filter WHERE is_active = true to exclude voided entries.';
