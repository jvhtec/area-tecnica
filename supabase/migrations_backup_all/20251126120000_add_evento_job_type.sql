-- Add 'evento' to job_type enum
-- Evento jobs will have rates locked to 12hr rate regardless of actual timesheet hours

-- First, add the new value to the enum
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'evento';

-- Add a comment to document the special behavior of evento jobs
COMMENT ON TYPE job_type IS 'Job types: single, multi_day, tour, tourdate, festival, dryhire, evento. Evento jobs have rates locked to 12hr regardless of timesheet hours.';
