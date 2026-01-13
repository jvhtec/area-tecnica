-- =============================================================================
-- Wallboard: Allow anon to receive job_assignments realtime events (safely)
-- =============================================================================
-- The public wallboard runs with the anon key and relies on `postgres_changes`
-- to know when to refetch feeds from the wallboard edge function.
--
-- `job_assignments` changes affect multiple panels (overview/crew/pending), but
-- anon currently can't see any rows due to missing SELECT RLS policy, so
-- realtime events are filtered out by `realtime.apply_rls`.
--
-- This migration:
--   1) Revokes all privileges from anon on job_assignments
--   2) Grants SELECT only on the primary key (id) so events carry no sensitive data
--   3) Adds an anon SELECT RLS policy (rows are visible, but only `id` is selectable)
-- =============================================================================

-- 1) Ensure anon can't read/write assignment details directly
REVOKE ALL ON TABLE public.job_assignments FROM anon;

-- 2) Re-grant the minimum needed for Realtime (primary key only)
GRANT SELECT (id) ON TABLE public.job_assignments TO anon;

-- 3) Allow anon to "see" rows for realtime filtering (payload remains minimal due to column grants)
DROP POLICY IF EXISTS "anon_job_assignments_select_for_realtime" ON public.job_assignments;
CREATE POLICY "anon_job_assignments_select_for_realtime"
  ON public.job_assignments
  FOR SELECT
  TO anon
  USING (true);

