-- Security hardening (codebase audit 2026-06-09):
--
-- 1. Remove anon SELECT policies on sensitive tables. They were added for the
--    wallboard's realtime display, but RLS SELECT policies apply to every access
--    path, so anyone holding the public anon key could read timesheets (wages),
--    profiles (email/DNI/phone), job assignments, etc. via PostgREST without
--    logging in. The wallboard reads data exclusively through the tokenized
--    wallboard-auth/wallboard-feed edge functions (service role), and the other
--    public surfaces (artist form, tour guest links) use their own scoped tables
--    or token-validated RPCs, so no anon table access is required.
--
-- 2. Fix SELECT policies written as USING (true OR <role checks>): the leading
--    "true" short-circuits the role checks and grants read access to everyone,
--    including anon. Replaced with an authenticated-only check, which preserves
--    the effective behavior for every logged-in user (the policy already granted
--    them all access) while closing the anonymous path.
--
-- 3. Add SET search_path to the achievement SECURITY DEFINER functions, which
--    were missing it (search_path injection / privilege escalation risk).

-- ---------------------------------------------------------------------------
-- 1. Drop anon-only realtime SELECT policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_announcements_select_for_realtime" ON public.announcements;
DROP POLICY IF EXISTS "anon_job_assignments_select_for_realtime" ON public.job_assignments;
DROP POLICY IF EXISTS "anon_job_departments_select_for_realtime" ON public.job_departments;
DROP POLICY IF EXISTS "anon_job_documents_select_for_realtime" ON public.job_documents;
DROP POLICY IF EXISTS "anon_job_required_roles_select_for_realtime" ON public.job_required_roles;
DROP POLICY IF EXISTS "anon_jobs_select_for_realtime" ON public.jobs;
DROP POLICY IF EXISTS "anon_locations_select_for_realtime" ON public.locations;
DROP POLICY IF EXISTS "anon_logistics_event_departments_select_for_realtime" ON public.logistics_event_departments;
DROP POLICY IF EXISTS "anon_logistics_events_select_for_realtime" ON public.logistics_events;
DROP POLICY IF EXISTS "anon_profiles_select_for_realtime" ON public.profiles;
DROP POLICY IF EXISTS "anon_timesheets_select_for_realtime" ON public.timesheets;

-- The tours wallboard policy also covered anon; keep it for authenticated only.
DO $$
BEGIN
  ALTER POLICY "Allow wallboard to read tour status" ON public.tours TO authenticated;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Close the "USING (true OR ...)" SELECT policies to authenticated users
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT *
    FROM (VALUES
      ('p_job_date_types_public_select_e0ccdb', 'job_date_types'),
      ('p_job_departments_public_select_ce698d', 'job_departments'),
      ('p_locations_public_select_6df21f', 'locations'),
      ('p_tour_dates_public_select_8f4344', 'tour_dates'),
      ('p_tour_default_sets_public_select_8341a3', 'tour_default_sets'),
      ('p_tour_default_tables_public_select_fead6e', 'tour_default_tables'),
      ('p_tour_power_defaults_public_select_5dba2b', 'tour_power_defaults'),
      ('p_tour_weight_defaults_public_select_b2dacf', 'tour_weight_defaults'),
      ('p_tours_public_select_5a6a0b', 'tours')
    ) AS t(polname, tablename)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND policyname = pol.polname AND tablename = pol.tablename
    ) THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I USING ((( SELECT auth.uid() ) IS NOT NULL))',
        pol.polname, pol.tablename
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Pin search_path on achievement SECURITY DEFINER functions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER FUNCTION public.evaluate_user_achievements(uuid) SET search_path = public;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.evaluate_daily_achievements() SET search_path = public;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION public.trigger_evaluate_achievements_on_job_complete() SET search_path = public;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;
