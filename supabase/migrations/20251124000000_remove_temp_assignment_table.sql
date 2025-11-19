-- ============================================================================
-- ROLLBACK: Remove Temporary Per-Day Assignment Table
-- ============================================================================
-- Purpose: Clean up temporary hotfix table after timesheet architecture
--          is fully deployed and operational.
--
-- Prerequisites before running:
-- 1. Verify timesheet architecture is deployed and stable
-- 2. Confirm all temp table data is migrated or no longer needed
-- 3. Remove code patches from:
--    - src/components/matrix/AssignJobDialog.tsx (multi-day write path)
--    - supabase/functions/staffing-click/index.ts (auto-assignment)
--    - src/hooks/useOptimizedMatrixData.ts (read path + realtime)
--    - src/integrations/supabase/types.ts (TypeScript types)
--
-- Safety: This script drops the table and all its data. If you need to
--         preserve historical assignment data, export it before running.
-- ============================================================================

-- Optional: Export data for historical record (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS job_assignment_days_temp_archive AS
-- SELECT *, now() as archived_at FROM job_assignment_days_temp;

-- Drop RLS policies first
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.job_assignment_days_temp;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.job_assignment_days_temp;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.job_assignment_days_temp;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.job_assignment_days_temp;

-- Drop trigger
DROP TRIGGER IF EXISTS tg_touch_job_assignment_days_temp ON public.job_assignment_days_temp;

-- Drop function
DROP FUNCTION IF EXISTS public.touch_job_assignment_days_temp();

-- Drop indexes (these will be dropped automatically with the table, but explicit for clarity)
DROP INDEX IF EXISTS public.idx_job_assignment_days_temp_date_range;
DROP INDEX IF EXISTS public.idx_job_assignment_days_temp_technician_id;
DROP INDEX IF EXISTS public.idx_job_assignment_days_temp_job_id;

-- Drop the table (CASCADE will remove any remaining dependencies)
DROP TABLE IF EXISTS public.job_assignment_days_temp CASCADE;

-- Verify cleanup
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'job_assignment_days_temp'
  ) THEN
    RAISE EXCEPTION 'Failed to drop job_assignment_days_temp table';
  END IF;

  RAISE NOTICE 'Successfully removed job_assignment_days_temp hotfix table';
END
$$;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST:
-- ============================================================================
-- [ ] Confirm table is dropped: SELECT * FROM information_schema.tables WHERE table_name = 'job_assignment_days_temp';
-- [ ] Verify no broken foreign key references in other tables
-- [ ] Check application logs for errors related to missing table
-- [ ] Test matrix assignment creation and display
-- [ ] Test auto-assignment from staffing offers
-- [ ] Monitor for any realtime subscription errors
-- [ ] Remove this rollback migration file from version control if desired
-- ============================================================================
