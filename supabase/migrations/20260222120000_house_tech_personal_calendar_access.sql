-- Allow house techs to read the data needed to render the personal calendar

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'house_tech_calendar_profiles'
  ) THEN
    EXECUTE $$
      CREATE POLICY "house_tech_calendar_profiles" ON public.profiles
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 'house_tech'
        )
        AND role = 'house_tech'
      );
    $$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_assignments' AND policyname = 'house_tech_calendar_job_assignments'
  ) THEN
    EXECUTE $$
      CREATE POLICY "house_tech_calendar_job_assignments" ON public.job_assignments
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 'house_tech'
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'house_tech_calendar_jobs'
  ) THEN
    EXECUTE $$
      CREATE POLICY "house_tech_calendar_jobs" ON public.jobs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 'house_tech'
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'availability_schedules' AND policyname = 'house_tech_calendar_availability'
  ) THEN
    EXECUTE $$
      CREATE POLICY "house_tech_calendar_availability" ON public.availability_schedules
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 'house_tech'
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'locations' AND policyname = 'house_tech_calendar_locations'
  ) THEN
    EXECUTE $$
      CREATE POLICY "house_tech_calendar_locations" ON public.locations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 'house_tech'
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
