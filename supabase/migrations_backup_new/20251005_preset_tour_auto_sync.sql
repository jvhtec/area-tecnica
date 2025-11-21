-- Auto-sync tour-associated presets into day assignments for relevant tour dates

-- Add source fields to track how an assignment was created
ALTER TABLE public.day_preset_assignments
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE INDEX IF NOT EXISTS idx_day_preset_assignments_source
  ON public.day_preset_assignments(source, source_id, date);

-- Function to create day assignments for all dates in a tour for a given preset
CREATE OR REPLACE FUNCTION public.sync_preset_assignments_for_tour(_preset_id uuid, _tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _creator uuid;
BEGIN
  -- Get creator of the preset as fallback for user_id / assigned_by
  SELECT created_by INTO _creator FROM public.presets WHERE id = _preset_id;

  -- Insert an assignment per day across all tour jobs where missing
  INSERT INTO public.day_preset_assignments (date, preset_id, user_id, assigned_by, "order", source, source_id)
  SELECT d::date as date,
         _preset_id,
         COALESCE(_creator, auth.uid()),
         COALESCE(_creator, auth.uid()),
         (
           SELECT COALESCE(MAX(a."order"), -1) + 1
           FROM public.day_preset_assignments a
           WHERE a.date = d::date
         ) as order,
         'tour' as source,
         _tour_id as source_id
  FROM (
    SELECT generate_series(date(j.start_time), date(j.end_time), interval '1 day') as d
    FROM public.jobs j
    WHERE j.job_type = 'tourdate'
      AND j.tour_id = _tour_id
  ) days
  WHERE NOT EXISTS (
    SELECT 1 FROM public.day_preset_assignments a
    WHERE a.date = d::date
      AND a.preset_id = _preset_id
      AND a.source = 'tour'
      AND a.source_id = _tour_id
  );
END;
$$;

-- Function to clear tour-created assignments when un-linking or changing tour
CREATE OR REPLACE FUNCTION public.clear_tour_preset_assignments(_preset_id uuid, _tour_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.day_preset_assignments a
  WHERE a.preset_id = _preset_id
    AND a.source = 'tour'
    AND a.source_id = _tour_id;
END;
$$;

-- Trigger to keep assignments in sync when presets are created/updated
CREATE OR REPLACE FUNCTION public.trg_presets_sync_tour_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tour_id IS NOT NULL THEN
      PERFORM public.sync_preset_assignments_for_tour(NEW.id, NEW.tour_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tour_id IS DISTINCT FROM NEW.tour_id THEN
      IF OLD.tour_id IS NOT NULL THEN
        PERFORM public.clear_tour_preset_assignments(NEW.id, OLD.tour_id);
      END IF;
      IF NEW.tour_id IS NOT NULL THEN
        PERFORM public.sync_preset_assignments_for_tour(NEW.id, NEW.tour_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presets_sync_tour ON public.presets;
CREATE TRIGGER trg_presets_sync_tour
AFTER INSERT OR UPDATE OF tour_id ON public.presets
FOR EACH ROW EXECUTE FUNCTION public.trg_presets_sync_tour_assignments();

-- Also keep things in sync when tour dates (jobs) are created/updated
CREATE OR REPLACE FUNCTION public.trg_jobs_sync_tour_preset_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.job_type = 'tourdate' AND NEW.tour_id IS NOT NULL THEN
    PERFORM public.sync_preset_assignments_for_tour(p.id, NEW.tour_id)
    FROM public.presets p
    WHERE p.tour_id = NEW.tour_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_sync_tour_presets ON public.jobs;
CREATE TRIGGER trg_jobs_sync_tour_presets
AFTER INSERT OR UPDATE OF start_time, end_time, tour_id, job_type ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.trg_jobs_sync_tour_preset_assignments();
