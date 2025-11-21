-- Add foreign key constraints for timesheets
-- This migration is safe to run on a DB that already contains the tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_timesheets_job_id') THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT fk_timesheets_job_id
        FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_timesheets_technician_id') THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT fk_timesheets_technician_id
        FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_timesheets_approved_by') THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT fk_timesheets_approved_by
        FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_timesheets_created_by') THEN
    ALTER TABLE public.timesheets
      ADD CONSTRAINT fk_timesheets_created_by
        FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
