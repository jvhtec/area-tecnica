-- Allow timesheets to span into the next day
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS ends_next_day boolean DEFAULT false;

