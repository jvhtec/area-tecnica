-- =============================================================================
-- Supabase Advisor Security Hardening - Phase 2 (RLS)
-- =============================================================================
-- Replace permissive mutation policies flagged by lint 0024
-- with role/owner-based checks for authenticated users.
--
-- Tables:
-- - public.jobs
-- - public.job_assignments
-- - public.profiles
-- =============================================================================

DO $$
BEGIN
  -- ---------------------------------------------------------------------------
  -- jobs
  -- ---------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'jobs_insert'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "jobs_insert" ON public.jobs
      WITH CHECK (
        (select public.current_user_role()) = ANY (ARRAY['admin','management','logistics'])
      )
    $stmt$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'jobs_update'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "jobs_update" ON public.jobs
      USING (
        (select public.current_user_role()) = ANY (ARRAY['admin','management','logistics'])
      )
      WITH CHECK (
        (select public.current_user_role()) = ANY (ARRAY['admin','management','logistics'])
      )
    $stmt$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'jobs_delete'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "jobs_delete" ON public.jobs
      USING (
        (select public.current_user_role()) = ANY (ARRAY['admin','management','logistics'])
      )
    $stmt$;
  END IF;

  -- ---------------------------------------------------------------------------
  -- job_assignments
  -- ---------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_assignments' AND policyname = 'job_assignments_insert'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "job_assignments_insert" ON public.job_assignments
      WITH CHECK (
        (select public.current_user_role()) = ANY (ARRAY['admin','management','logistics'])
      )
    $stmt$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_assignments' AND policyname = 'job_assignments_update'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "job_assignments_update" ON public.job_assignments
      USING (
        (select public.current_user_role()) = ANY (ARRAY['admin','management','logistics'])
        OR technician_id = (select auth.uid())
      )
      WITH CHECK (
        (select public.current_user_role()) = ANY (ARRAY['admin','management','logistics'])
        OR technician_id = (select auth.uid())
      )
    $stmt$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_assignments' AND policyname = 'job_assignments_delete'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "job_assignments_delete" ON public.job_assignments
      USING (
        (select public.current_user_role()) = ANY (ARRAY['admin','management','logistics'])
      )
    $stmt$;
  END IF;

  -- ---------------------------------------------------------------------------
  -- profiles
  -- ---------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "profiles_insert" ON public.profiles
      WITH CHECK (
        id = (select auth.uid())
        OR (select public.current_user_role()) = ANY (ARRAY['admin','management'])
      )
    $stmt$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "profiles_update" ON public.profiles
      USING (
        id = (select auth.uid())
        OR (select public.current_user_role()) = ANY (ARRAY['admin','management'])
      )
      WITH CHECK (
        id = (select auth.uid())
        OR (select public.current_user_role()) = ANY (ARRAY['admin','management'])
      )
    $stmt$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_delete'
  ) THEN
    EXECUTE $stmt$
      ALTER POLICY "profiles_delete" ON public.profiles
      USING (
        (select public.current_user_role()) = ANY (ARRAY['admin','management'])
      )
    $stmt$;
  END IF;
END
$$;
