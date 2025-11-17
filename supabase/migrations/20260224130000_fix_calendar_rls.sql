-- Broaden personal calendar access to admin/management/logistics while keeping
-- data scoped to house tech rows

CREATE OR REPLACE FUNCTION public.has_personal_calendar_access()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role = ANY (ARRAY['house_tech','admin','management','logistics'])
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_personal_calendar_access()
  TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'house_tech_calendar_profiles'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_profiles" ON public.profiles
      USING (
        public.has_personal_calendar_access()
        AND role = 'house_tech'
      );
    $$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignments'
      AND policyname = 'house_tech_calendar_job_assignments'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_job_assignments" ON public.job_assignments
      USING (
        public.has_personal_calendar_access()
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
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'house_tech_calendar_jobs'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_jobs" ON public.jobs
      USING (
        public.has_personal_calendar_access()
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
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'availability_schedules'
      AND policyname = 'house_tech_calendar_availability'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_availability" ON public.availability_schedules
      USING (
        public.has_personal_calendar_access()
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
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'locations'
      AND policyname = 'house_tech_calendar_locations'
  ) THEN
    EXECUTE $$
      ALTER POLICY "house_tech_calendar_locations" ON public.locations
      USING (
        public.has_personal_calendar_access()
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
