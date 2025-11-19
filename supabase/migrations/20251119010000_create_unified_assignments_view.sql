-- ============================================================================
-- TEMPORARY HOTFIX: Unified Assignments View
-- ============================================================================
-- Purpose: Create a VIEW that transparently UNIONs job_assignments table
--          with job_assignment_days_temp table, allowing all existing queries
--          to seamlessly read from both sources without code changes.
--
-- Lifecycle: TEMPORARY until timesheet architecture rollout (est. 2025-11-24)
--
-- Why: This enables ALL application components (job cards, timesheets, PDFs,
--      reports, etc.) to see temp assignments without needing to patch every
--      single query location. Single source of truth pattern.
--
-- Rollback: See migration 20251124000000_remove_temp_assignment_table.sql
-- ============================================================================

-- Create unified view that combines both assignment sources
CREATE OR REPLACE VIEW public.job_assignments_unified AS
-- Records from the permanent job_assignments table (unchanged)
SELECT
  id,
  job_id,
  technician_id,
  sound_role,
  lights_role,
  video_role,
  single_day,
  assignment_date,
  status,
  assigned_at,
  assigned_by,
  assignment_source,
  response_time,
  use_tour_multipliers
FROM public.job_assignments

UNION ALL

-- Records from the temporary per-day assignments table
-- Map temp table columns to match job_assignments schema
SELECT
  id,
  job_id,
  technician_id,
  NULL::text as sound_role,                    -- Temp table doesn't store roles
  NULL::text as lights_role,                   -- Temp table doesn't store roles
  NULL::text as video_role,                    -- Temp table doesn't store roles
  true as single_day,                          -- All temp assignments are single-day
  assignment_date,
  'confirmed'::public.assignment_status as status,  -- Infer confirmed status
  created_at as assigned_at,                   -- Use created_at as assignment timestamp
  NULL::uuid as assigned_by,                   -- Temp table doesn't track who assigned
  source as assignment_source,                 -- Map source to assignment_source
  created_at as response_time,                 -- Use created_at as response time
  NULL::boolean as use_tour_multipliers        -- Temp table doesn't have this flag
FROM public.job_assignment_days_temp;

-- Add helpful comment for future developers
COMMENT ON VIEW public.job_assignments_unified IS
  'TEMPORARY HOTFIX: Unified view combining job_assignments + job_assignment_days_temp.
   Allows existing queries to transparently read from both tables without code changes.
   Scheduled for removal on 2025-11-24 when timesheet architecture is deployed.

   IMPORTANT: This view is READ-ONLY. All INSERT/UPDATE/DELETE operations must target
   the underlying tables directly (job_assignments or job_assignment_days_temp).';

-- Grant appropriate permissions (match existing job_assignments permissions)
GRANT SELECT ON public.job_assignments_unified TO authenticated;
GRANT SELECT ON public.job_assignments_unified TO service_role;
GRANT SELECT ON public.job_assignments_unified TO anon;

-- ============================================================================
-- IMPORTANT NOTES FOR DEVELOPERS:
-- ============================================================================
--
-- 1. READ OPERATIONS:
--    Change: .from('job_assignments')
--    To:     .from('job_assignments_unified')
--
-- 2. WRITE OPERATIONS (Do NOT change):
--    Keep using direct table writes:
--    - Whole-job assignments → job_assignments
--    - Multi-day assignments → job_assignment_days_temp
--
-- 3. JOINS:
--    The view supports all standard joins just like the table:
--    .select('*, profiles!job_assignments_unified_technician_id_fkey(...)')
--
-- 4. PERFORMANCE:
--    The UNION ALL means both tables are queried. For large datasets,
--    consider adding WHERE clauses to filter early.
--
-- 5. NULL HANDLING:
--    Temp records have NULL for role columns (sound_role, lights_role, video_role).
--    Your UI should handle these gracefully.
--
-- ============================================================================
