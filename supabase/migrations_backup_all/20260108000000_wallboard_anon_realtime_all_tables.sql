-- =============================================================================
-- Wallboard: Enable anon realtime for all subscribed tables
-- =============================================================================
-- The public wallboard subscribes to multiple tables for realtime updates.
-- Without anon SELECT policies, postgres_changes events are filtered out.
-- This migration adds minimal SELECT permissions so realtime events propagate.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- job_departments: Affects overview/calendar (department badges)
-- Composite key table (job_id, department) - no id column
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.job_departments FROM anon;
GRANT SELECT (job_id) ON TABLE public.job_departments TO anon;

DROP POLICY IF EXISTS "anon_job_departments_select_for_realtime" ON public.job_departments;
CREATE POLICY "anon_job_departments_select_for_realtime"
  ON public.job_departments
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- job_documents: Affects doc progress panel
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.job_documents FROM anon;
GRANT SELECT (id, job_id) ON TABLE public.job_documents TO anon;

DROP POLICY IF EXISTS "anon_job_documents_select_for_realtime" ON public.job_documents;
CREATE POLICY "anon_job_documents_select_for_realtime"
  ON public.job_documents
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- timesheets: Affects crew panel (timesheet status icons)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.timesheets FROM anon;
GRANT SELECT (id, job_id) ON TABLE public.timesheets TO anon;

DROP POLICY IF EXISTS "anon_timesheets_select_for_realtime" ON public.timesheets;
CREATE POLICY "anon_timesheets_select_for_realtime"
  ON public.timesheets
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- announcements: Affects ticker messages
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.announcements FROM anon;
GRANT SELECT (id) ON TABLE public.announcements TO anon;

DROP POLICY IF EXISTS "anon_announcements_select_for_realtime" ON public.announcements;
CREATE POLICY "anon_announcements_select_for_realtime"
  ON public.announcements
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- logistics_events: Affects logistics panel
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.logistics_events FROM anon;
GRANT SELECT (id, job_id) ON TABLE public.logistics_events TO anon;

DROP POLICY IF EXISTS "anon_logistics_events_select_for_realtime" ON public.logistics_events;
CREATE POLICY "anon_logistics_events_select_for_realtime"
  ON public.logistics_events
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- logistics_event_departments: Affects logistics panel (department badges)
-- Composite key table (event_id, department) - no id column
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.logistics_event_departments FROM anon;
GRANT SELECT (event_id) ON TABLE public.logistics_event_departments TO anon;

DROP POLICY IF EXISTS "anon_logistics_event_departments_select_for_realtime" ON public.logistics_event_departments;
CREATE POLICY "anon_logistics_event_departments_select_for_realtime"
  ON public.logistics_event_departments
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- profiles: Affects crew panel (technician names)
-- -----------------------------------------------------------------------------
-- Note: profiles may already have broad SELECT; just ensure anon can receive events
DO $$
BEGIN
  -- Only add policy if it doesn't exist (profiles likely has other policies)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'anon_profiles_select_for_realtime'
  ) THEN
    EXECUTE 'CREATE POLICY "anon_profiles_select_for_realtime"
      ON public.profiles
      FOR SELECT
      TO anon
      USING (true)';
  END IF;
END $$;

-- Ensure anon has at least SELECT on id for realtime
GRANT SELECT (id) ON TABLE public.profiles TO anon;

-- -----------------------------------------------------------------------------
-- locations: Affects overview/calendar (location names)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.locations FROM anon;
GRANT SELECT (id, name) ON TABLE public.locations TO anon;

DROP POLICY IF EXISTS "anon_locations_select_for_realtime" ON public.locations;
CREATE POLICY "anon_locations_select_for_realtime"
  ON public.locations
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- job_required_roles: Affects overview/pending (crew requirements)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.job_required_roles FROM anon;
GRANT SELECT (id, job_id) ON TABLE public.job_required_roles TO anon;

DROP POLICY IF EXISTS "anon_job_required_roles_select_for_realtime" ON public.job_required_roles;
CREATE POLICY "anon_job_required_roles_select_for_realtime"
  ON public.job_required_roles
  FOR SELECT
  TO anon
  USING (true);

-- -----------------------------------------------------------------------------
-- Enable realtime on job_required_roles if not already enabled
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'job_required_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_required_roles;
  END IF;
END $$;
