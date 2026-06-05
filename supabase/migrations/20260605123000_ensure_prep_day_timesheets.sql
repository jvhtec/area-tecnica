CREATE OR REPLACE FUNCTION public.ensure_prep_day_timesheets_for_job_date(
  _job_id uuid,
  _date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_affected integer := 0;
BEGIN
  IF _job_id IS NULL OR _date IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.job_date_types jdt
    WHERE jdt.job_id = _job_id
      AND jdt.date = _date
      AND jdt.type = 'prep_day'
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.timesheets (
    job_id,
    technician_id,
    date,
    source
  )
  SELECT
    _job_id,
    ja.technician_id,
    _date,
    'prep_day'
  FROM public.job_assignments ja
  WHERE ja.job_id = _job_id
    AND ja.technician_id IS NOT NULL
    AND COALESCE(ja.status, 'confirmed'::public.assignment_status) <> 'declined'::public.assignment_status
  ON CONFLICT (job_id, technician_id, date)
  DO UPDATE
    SET is_active = true,
        source = CASE
          WHEN public.timesheets.source IS NULL OR public.timesheets.source = 'matrix' THEN 'prep_day'
          ELSE public.timesheets.source
        END,
        updated_at = now()
    WHERE public.timesheets.is_active IS DISTINCT FROM true;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_prep_day_timesheets_for_job_date(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_prep_day_timesheets_for_job_date(uuid,date) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_refresh_timesheets_for_prep_day_date_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'prep_day' THEN
      PERFORM public.refresh_timesheet_amounts_for_job_date(OLD.job_id, OLD.date);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'prep_day'
       AND (OLD.job_id IS DISTINCT FROM NEW.job_id OR OLD.date IS DISTINCT FROM NEW.date OR OLD.type IS DISTINCT FROM NEW.type) THEN
      PERFORM public.refresh_timesheet_amounts_for_job_date(OLD.job_id, OLD.date);
    END IF;

    IF NEW.type = 'prep_day' THEN
      PERFORM public.ensure_prep_day_timesheets_for_job_date(NEW.job_id, NEW.date);
      PERFORM public.refresh_timesheet_amounts_for_job_date(NEW.job_id, NEW.date);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.type = 'prep_day' THEN
    PERFORM public.ensure_prep_day_timesheets_for_job_date(NEW.job_id, NEW.date);
    PERFORM public.refresh_timesheet_amounts_for_job_date(NEW.job_id, NEW.date);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_refresh_timesheets_for_prep_day_date_type() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trg_ensure_prep_day_timesheets_for_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prep_day record;
BEGIN
  IF NEW.job_id IS NULL
     OR NEW.technician_id IS NULL
     OR COALESCE(NEW.status, 'confirmed'::public.assignment_status) = 'declined'::public.assignment_status THEN
    RETURN NEW;
  END IF;

  FOR v_prep_day IN
    SELECT DISTINCT date
    FROM public.job_date_types
    WHERE job_id = NEW.job_id
      AND type = 'prep_day'
  LOOP
    PERFORM public.ensure_prep_day_timesheets_for_job_date(NEW.job_id, v_prep_day.date);
    PERFORM public.refresh_timesheet_amounts_for_job_date(NEW.job_id, v_prep_day.date);
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_ensure_prep_day_timesheets_for_assignment() FROM PUBLIC;

DROP TRIGGER IF EXISTS t_aiu_ensure_prep_day_timesheets_for_assignment ON public.job_assignments;
CREATE TRIGGER t_aiu_ensure_prep_day_timesheets_for_assignment
AFTER INSERT OR UPDATE OF job_id, technician_id, status
ON public.job_assignments
FOR EACH ROW
EXECUTE FUNCTION public.trg_ensure_prep_day_timesheets_for_assignment();

DO $$
DECLARE
  v_prep_day record;
BEGIN
  FOR v_prep_day IN
    SELECT DISTINCT job_id, date
    FROM public.job_date_types
    WHERE type = 'prep_day'
  LOOP
    PERFORM public.ensure_prep_day_timesheets_for_job_date(v_prep_day.job_id, v_prep_day.date);
    PERFORM public.refresh_timesheet_amounts_for_job_date(v_prep_day.job_id, v_prep_day.date);
  END LOOP;
END;
$$;
