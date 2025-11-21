-- Ensure house techs can load department pages by allowing them to read the
-- supporting tables that the job listings join against.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_departments'
      AND policyname = 'wb_job_departments_select'
  ) THEN
    EXECUTE $$
      ALTER POLICY "wb_job_departments_select" ON public.job_departments
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
      AND tablename = 'locations'
      AND policyname = 'wb_locations_select'
  ) THEN
    EXECUTE $$
      ALTER POLICY "wb_locations_select" ON public.locations
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
      AND tablename = 'profiles'
      AND policyname = 'wb_profiles_select'
  ) THEN
    EXECUTE $$
      ALTER POLICY "wb_profiles_select" ON public.profiles
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
      AND tablename = 'job_documents'
      AND policyname = 'wb_job_documents_select'
  ) THEN
    EXECUTE $$
      ALTER POLICY "wb_job_documents_select" ON public.job_documents
      USING (
        public.get_current_user_role() = ANY (
          ARRAY['admin','management','wallboard','house_tech']
        )
      );
    $$;
  END IF;
END
$$;
