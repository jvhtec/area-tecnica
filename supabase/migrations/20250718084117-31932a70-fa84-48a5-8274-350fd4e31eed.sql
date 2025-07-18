
-- Create tour_date_type enum
CREATE TYPE public.tour_date_type AS ENUM ('show', 'rehearsal', 'travel');

-- Add new columns to tour_dates table
ALTER TABLE public.tour_dates 
ADD COLUMN tour_date_type public.tour_date_type DEFAULT 'show',
ADD COLUMN start_date date,
ADD COLUMN end_date date,
ADD COLUMN rehearsal_days integer;

-- Populate new columns from existing data for backward compatibility
UPDATE public.tour_dates 
SET 
  start_date = date,
  end_date = date,
  rehearsal_days = 1
WHERE start_date IS NULL;

-- Make start_date and end_date NOT NULL after populating
ALTER TABLE public.tour_dates 
ALTER COLUMN start_date SET NOT NULL,
ALTER COLUMN end_date SET NOT NULL;

-- Add check constraint to ensure end_date >= start_date
ALTER TABLE public.tour_dates 
ADD CONSTRAINT tour_dates_date_range_check 
CHECK (end_date >= start_date);

-- Update rehearsal_days calculation
UPDATE public.tour_dates 
SET rehearsal_days = (end_date - start_date) + 1;
