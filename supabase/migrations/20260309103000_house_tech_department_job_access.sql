-- Allow house techs to load department job data by extending the existing
-- wallboard read policies to cover the role. Without this, the Sound/Lights
-- pages fail because the useJobs query selects from jobs and job_assignments
-- with an authenticated house_tech session.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'wb_jobs_select'
  ) THEN
    EXECUTE $$
      ALTER POLICY "wb_jobs_select" ON public.jobs
      USING (
        public.get_current_user_role() = ANY (
          ARRAY['admin','management','wallboard','house_tech']
        )
      );
    $$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignments'
      AND policyname = 'wb_assign_select'
  ) THEN
    EXECUTE $$
      ALTER POLICY "wb_assign_select" ON public.job_assignments
      USING (
        public.get_current_user_role() = ANY (
          ARRAY['admin','management','wallboard','house_tech']
        )
      );
    $$;
  END IF;
END
$$;
