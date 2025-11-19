-- ============================================================================
-- TEMPORARY HOTFIX: Per-Day Assignment Table
-- ============================================================================
-- Purpose: Enable multiple single-day assignments for different technicians
--          within a multi-day job span without conflicting with existing
--          job_assignments table constraints.
--
-- Lifecycle: TEMPORARY until timesheet architecture rollout (est. 2025-11-24)
--
-- Why: Current job_assignments table has constraints that prevent multiple
--      technicians from being assigned to different single days within the
--      same job. This temp table allows per-day granularity without touching
--      the production schema.
--
-- Rollback: See migration 20251124000000_remove_temp_assignment_table.sql
-- ============================================================================

-- Create temporary per-day assignment table
-- This mirrors the future timesheet architecture but operates independently
CREATE TABLE IF NOT EXISTS public.job_assignment_days_temp (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys with cascading deletes for data integrity
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,

  -- Assignment date (required for all records)
  assignment_date date NOT NULL,

  -- Metadata for tracking and debugging
  source text DEFAULT 'legacy',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Prevent duplicate assignments for same tech/job/date combination
  UNIQUE (job_id, technician_id, assignment_date)
);

-- Add indexes for query performance
-- Index on job_id for efficient matrix queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_job_assignment_days_temp_job_id
  ON public.job_assignment_days_temp(job_id);

-- Index on technician_id for technician-centric queries
CREATE INDEX IF NOT EXISTS idx_job_assignment_days_temp_technician_id
  ON public.job_assignment_days_temp(technician_id);

-- Composite index for date range queries (matrix viewport)
CREATE INDEX IF NOT EXISTS idx_job_assignment_days_temp_date_range
  ON public.job_assignment_days_temp(assignment_date, job_id);

-- Auto-update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION public.touch_job_assignment_days_temp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_touch_job_assignment_days_temp
  BEFORE UPDATE ON public.job_assignment_days_temp
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_job_assignment_days_temp();

-- Grant appropriate permissions (match existing job_assignments permissions)
-- Note: Adjust these based on your actual RLS policies and role structure
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_assignment_days_temp TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_assignment_days_temp TO service_role;

-- Enable Row Level Security (RLS) for data isolation
ALTER TABLE public.job_assignment_days_temp ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view all assignments (match job_assignments visibility)
CREATE POLICY "Enable read access for all authenticated users"
  ON public.job_assignment_days_temp
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Users can insert assignments (match job_assignments write permissions)
CREATE POLICY "Enable insert for authenticated users"
  ON public.job_assignment_days_temp
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policy: Users can update assignments
CREATE POLICY "Enable update for authenticated users"
  ON public.job_assignment_days_temp
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Users can delete assignments
CREATE POLICY "Enable delete for authenticated users"
  ON public.job_assignment_days_temp
  FOR DELETE
  TO authenticated
  USING (true);

-- Add helpful comment for future developers
COMMENT ON TABLE public.job_assignment_days_temp IS
  'TEMPORARY: Hotfix table for per-day assignments. Scheduled for removal on 2025-11-24 when timesheet architecture is deployed. DO NOT use for new features.';

COMMENT ON COLUMN public.job_assignment_days_temp.source IS
  'Tracking field: "legacy" = migrated from old system, "manual" = UI assignment, "staffing" = auto-assignment from offers';
