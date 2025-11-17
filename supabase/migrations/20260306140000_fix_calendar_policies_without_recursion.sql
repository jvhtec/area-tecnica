-- Rework the house-tech personal calendar policies so they no longer
-- depend on has_personal_calendar_access (which queried profiles and
-- triggered recursion) and instead lean on the existing
-- get_current_user_role() helper.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'house_tech_calendar_profiles'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_profiles" ON public.profiles
      USING (
        public.get_current_user_role() = ANY (
          ARRAY['house_tech','admin','management','logistics']
        )
        AND role = 'house_tech'
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
      AND policyname = 'house_tech_calendar_job_assignments'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_job_assignments" ON public.job_assignments
      USING (
        public.get_current_user_role() = ANY (
          ARRAY['house_tech','admin','management','logistics']
        )
        AND technician_id IN (
          SELECT id FROM public.profiles WHERE role = 'house_tech'
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
      AND tablename = 'jobs'
      AND policyname = 'house_tech_calendar_jobs'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_jobs" ON public.jobs
      USING (
        public.get_current_user_role() = ANY (
          ARRAY['house_tech','admin','management','logistics']
        )
        AND EXISTS (
          SELECT 1
          FROM public.job_assignments ja
          JOIN public.profiles tech ON tech.id = ja.technician_id
          WHERE ja.job_id = jobs.id
            AND tech.role = 'house_tech'
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
      AND tablename = 'availability_schedules'
      AND policyname = 'house_tech_calendar_availability'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_availability" ON public.availability_schedules
      USING (
        public.get_current_user_role() = ANY (
          ARRAY['house_tech','admin','management','logistics']
        )
        AND user_id IN (
          SELECT id FROM public.profiles WHERE role = 'house_tech'
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
      AND policyname = 'house_tech_calendar_locations'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_locations" ON public.locations
      USING (
        public.get_current_user_role() = ANY (
          ARRAY['house_tech','admin','management','logistics']
        )
        AND EXISTS (
          SELECT 1
          FROM public.jobs j
          JOIN public.job_assignments ja ON ja.job_id = j.id
          JOIN public.profiles tech ON tech.id = ja.technician_id
          WHERE j.location_id = locations.id
            AND tech.role = 'house_tech'
        )
      );
    $$;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.has_personal_calendar_access();
