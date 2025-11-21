-- Safe backfill of existing NULL categories
-- This will update existing timesheets with NULL categories using our resolution logic

UPDATE timesheets t
SET category = resolve_category_for_timesheet(t.job_id, t.technician_id)
WHERE t.category IS NULL 
  AND resolve_category_for_timesheet(t.job_id, t.technician_id) IS NOT NULL;