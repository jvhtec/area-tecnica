-- Harden timesheets to act as canonical per-day staffing source
-- Adds scheduling flags, cleans duplicates, enforces uniqueness and referential integrity,
-- and creates the indexes recommended by docs/TIMESHEETS_SYSTEM_IMPROVEMENT_PLAN.md

BEGIN;

-- 1. Add scheduling metadata columns
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS is_schedule_only boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'assignment';

-- Ensure new columns are populated for legacy rows
UPDATE public.timesheets
SET is_schedule_only = false
WHERE is_schedule_only IS NULL;

ALTER TABLE public.timesheets
  ALTER COLUMN is_schedule_only SET NOT NULL,
  ALTER COLUMN is_schedule_only SET DEFAULT false,
  ALTER COLUMN source SET DEFAULT 'assignment';

-- 2. Clean duplicate per-day rows so the unique constraint can be enforced
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY job_id, technician_id, date
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.timesheets
)
DELETE FROM public.timesheets t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- 3. Enforce one timesheet per job/tech/date
ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS timesheets_job_id_technician_id_date_key,
  ADD CONSTRAINT timesheets_job_id_technician_id_date_key
    UNIQUE (job_id, technician_id, date);

-- 4. Backfill schedule-only flag based on job type rules
UPDATE public.timesheets ts
SET is_schedule_only = true
FROM public.jobs j
WHERE ts.job_id = j.id
  AND j.job_type IN ('dryhire', 'tourdate');

-- 5. Refresh foreign key constraints for referential integrity
ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS fk_timesheets_job_id,
  ADD CONSTRAINT fk_timesheets_job_id
    FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS fk_timesheets_technician_id,
  ADD CONSTRAINT fk_timesheets_technician_id
    FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS fk_timesheets_approved_by,
  ADD CONSTRAINT fk_timesheets_approved_by
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS fk_timesheets_created_by,
  ADD CONSTRAINT fk_timesheets_created_by
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Create the indexes referenced in the improvement plan
CREATE INDEX IF NOT EXISTS idx_timesheets_job_id
  ON public.timesheets(job_id);
COMMENT ON INDEX idx_timesheets_job_id IS 'Optimizes job-based timesheet fetching';

CREATE INDEX IF NOT EXISTS idx_timesheets_technician_id
  ON public.timesheets(technician_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_status
  ON public.timesheets(status);

CREATE INDEX IF NOT EXISTS idx_timesheets_date
  ON public.timesheets(date);

CREATE INDEX IF NOT EXISTS idx_timesheets_approved_by
  ON public.timesheets(approved_by)
  WHERE approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timesheets_created_by
  ON public.timesheets(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timesheets_job_status
  ON public.timesheets(job_id, status);

CREATE INDEX IF NOT EXISTS idx_timesheets_tech_date
  ON public.timesheets(technician_id, date);
COMMENT ON INDEX idx_timesheets_tech_date IS 'Optimizes technician timesheet queries by date range';

CREATE INDEX IF NOT EXISTS idx_timesheets_approval_status
  ON public.timesheets(approved_by_manager, status)
  WHERE status IN ('submitted', 'approved');

-- 7. Update table statistics after structural changes
ANALYZE public.timesheets;

COMMIT;
