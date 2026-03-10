-- =============================================================================
-- Allow Anonymous Users to Receive Jobs Realtime Events
-- =============================================================================
-- The public wallboard uses anonymous Supabase client for realtime subscriptions.
-- Without SELECT permission, anon users can't receive realtime events.
-- This policy allows anon to SELECT jobs so realtime events are received.
-- The actual data filtering is done by the wallboard-feed edge function.
-- =============================================================================

-- Allow anon users to select jobs (needed for realtime subscription to work)
DROP POLICY IF EXISTS "anon_jobs_select_for_realtime" ON jobs;

CREATE POLICY "anon_jobs_select_for_realtime" ON jobs
  FOR SELECT
  TO anon
  USING (true);
