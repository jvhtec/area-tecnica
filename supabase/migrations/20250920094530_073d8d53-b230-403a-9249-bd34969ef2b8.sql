-- Set reasonable default categories for technicians based on their department
-- This will allow the resolution function to work properly

-- Set sound department technicians as 'tecnico' by default
UPDATE profiles 
SET default_timesheet_category = 'tecnico'
WHERE department = 'sound' AND default_timesheet_category IS NULL;

-- Set lights department technicians as 'tecnico' by default  
UPDATE profiles 
SET default_timesheet_category = 'tecnico'
WHERE department = 'lights' AND default_timesheet_category IS NULL;

-- Set video department technicians as 'tecnico' by default
UPDATE profiles 
SET default_timesheet_category = 'tecnico'
WHERE department = 'video' AND default_timesheet_category IS NULL;

-- Set logistics department as 'tecnico' by default
UPDATE profiles 
SET default_timesheet_category = 'tecnico'
WHERE department = 'logistics' AND default_timesheet_category IS NULL;

-- Now run the backfill again with the defaults in place
UPDATE timesheets t
SET category = resolve_category_for_timesheet(t.job_id, t.technician_id)
WHERE t.category IS NULL 
  AND resolve_category_for_timesheet(t.job_id, t.technician_id) IS NOT NULL;