-- Add indexes for timesheets to improve query performance
-- Safe to run multiple times; uses IF NOT EXISTS where supported.

DO $$
BEGIN
  -- Simple indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_timesheets_job_id') THEN
    CREATE INDEX idx_timesheets_job_id ON public.timesheets(job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_timesheets_technician_id') THEN
    CREATE INDEX idx_timesheets_technician_id ON public.timesheets(technician_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_timesheets_status') THEN
    CREATE INDEX idx_timesheets_status ON public.timesheets(status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_timesheets_date') THEN
    CREATE INDEX idx_timesheets_date ON public.timesheets(date);
  END IF;

  -- Composite indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_timesheets_job_status') THEN
    CREATE INDEX idx_timesheets_job_status ON public.timesheets(job_id, status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_timesheets_tech_date') THEN
    CREATE INDEX idx_timesheets_tech_date ON public.timesheets(technician_id, date);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_timesheets_approval_status') THEN
    CREATE INDEX idx_timesheets_approval_status ON public.timesheets(approved_by_manager, status) WHERE status IN ('submitted', 'approved');
  END IF;
END $$;
