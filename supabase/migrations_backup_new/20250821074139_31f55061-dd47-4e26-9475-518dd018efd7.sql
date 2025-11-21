
-- 1) Tag availability rows with their source (manual, vacation, etc.)
ALTER TABLE public.availability_schedules
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id uuid NULL;

-- Helpful indexes for lookups/cleanup
CREATE INDEX IF NOT EXISTS idx_availability_schedules_user_date
  ON public.availability_schedules (user_id, date);

CREATE INDEX IF NOT EXISTS idx_availability_schedules_source_sourceid
  ON public.availability_schedules (source, source_id);

-- 2) Trigger function to sync approved vacations -> availability_schedules
CREATE OR REPLACE FUNCTION public.sync_vacations_to_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tech_dept text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Remove any availability rows created for this request
    DELETE FROM public.availability_schedules
    WHERE source = 'vacation' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- For INSERT or UPDATE:
  -- Ensure we always clean previous rows for this request id first (idempotent)
  DELETE FROM public.availability_schedules
  WHERE source = 'vacation' AND source_id = NEW.id;

  -- Determine department for the technician
  SELECT department
    INTO tech_dept
    FROM public.profiles
   WHERE id = COALESCE(NEW.technician_id, OLD.technician_id);

  IF NEW.status = 'approved' THEN
    -- Remove any pre-existing availability rows in the range to avoid ambiguity
    DELETE FROM public.availability_schedules
     WHERE user_id = NEW.technician_id
       AND date BETWEEN NEW.start_date AND NEW.end_date;

    -- Insert one 'unavailable' row per day of the request
    INSERT INTO public.availability_schedules
      (id, user_id, department, date, status, notes, source, source_id)
    SELECT
      gen_random_uuid(),
      NEW.technician_id,
      tech_dept,
      d::date,
      'unavailable'::global_preset_status,
      'Vacation (auto)'::text,
      'vacation'::text,
      NEW.id
    FROM generate_series(NEW.start_date, NEW.end_date, INTERVAL '1 day') AS d;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Attach trigger to vacation_requests
DROP TRIGGER IF EXISTS trg_sync_vacations_to_availability ON public.vacation_requests;

CREATE TRIGGER trg_sync_vacations_to_availability
AFTER INSERT OR UPDATE OR DELETE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_vacations_to_availability();
