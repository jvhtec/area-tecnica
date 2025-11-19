-- ============================================================================
-- ROLLBACK: Remove Temporary Per-Day Assignment Table & Unified View
-- ============================================================================
-- Purpose: Clean up temporary hotfix table and VIEW after timesheet
--          architecture is fully deployed and operational.
--
-- Prerequisites before running:
-- 1. Verify timesheet architecture is deployed and stable
-- 2. Confirm all temp table data is migrated or no longer needed
-- 3. Revert all queries from 'job_assignments_unified' back to 'job_assignments'
-- 4. Remove code patches from (search for "TEMP HOTFIX" comments):
--    - src/components/matrix/AssignJobDialog.tsx (multi-day write path)
--    - supabase/functions/staffing-click/index.ts (auto-assignment)
--    - src/hooks/useOptimizedMatrixData.ts (read path + realtime)
--    - src/hooks/useTimesheets.ts (timesheet auto-creation)
--    - src/hooks/useOptimizedJobCard.ts (job card displays)
--    - src/hooks/useJobAssignmentsRealtime.ts (job assignments list)
--    - src/utils/tour-scheduling-pdf.ts (crew rosters)
--    - src/utils/tour-scheduling-pdf-enhanced.ts (tour books)
--    - src/services/tourRatesExport.ts (rate quotes)
--    - src/components/jobs/cards/JobCardNew.tsx (WhatsApp groups)
--    - src/components/personal/hooks/usePersonalCalendarData.ts (calendars)
--    - src/pages/Wallboard.tsx, MorningSummary.tsx (dashboards)
--    - supabase/functions/create-whatsapp-group/index.ts (edge function)
--    - src/integrations/supabase/types.ts (TypeScript types)
--
-- Safety: This script drops the table, VIEW, and all data. If you need to
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

-- Drop the unified VIEW
DROP VIEW IF EXISTS public.job_assignments_unified CASCADE;

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

  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'job_assignments_unified'
  ) THEN
    RAISE EXCEPTION 'Failed to drop job_assignments_unified view';
  END IF;

  RAISE NOTICE 'Successfully removed job_assignment_days_temp table and job_assignments_unified view';
END
$$;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST:
-- ============================================================================
-- [ ] Confirm table is dropped: SELECT * FROM information_schema.tables WHERE table_name = 'job_assignment_days_temp';
-- [ ] Confirm VIEW is dropped: SELECT * FROM information_schema.views WHERE table_name = 'job_assignments_unified';
-- [ ] Verify no broken foreign key references in other tables
-- [ ] Search codebase for 'job_assignments_unified' - should return 0 results
-- [ ] Search codebase for 'TEMP HOTFIX' comments - should return 0 results
-- [ ] Check application logs for errors related to missing table/view
-- [ ] Test matrix assignment creation and display
-- [ ] Test auto-assignment from staffing offers
-- [ ] Test job card displays show assignments
-- [ ] Test timesheet auto-creation
-- [ ] Test PDF exports (tour books, crew rosters)
-- [ ] Test WhatsApp group creation
-- [ ] Monitor for any realtime subscription errors
-- [ ] Verify TypeScript compilation succeeds
-- [ ] Remove migration files 20251119000000, 20251119010000, and this file from version control
-- ============================================================================
