CREATE OR REPLACE FUNCTION public.deactivate_unassigned_prep_day_timesheet(
  _job_id uuid,
  _technician_id uuid,
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
  IF _job_id IS NULL OR _technician_id IS NULL OR _date IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.timesheets t
  SET is_active = false,
      updated_at = now()
  WHERE t.job_id = _job_id
    AND t.technician_id = _technician_id
    AND t.date = _date
    AND COALESCE(t.is_active, true)
    AND EXISTS (
      SELECT 1
      FROM public.job_date_types jdt
      WHERE jdt.job_id = t.job_id
        AND jdt.date = t.date
        AND jdt.type = 'prep_day'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      WHERE ja.job_id = t.job_id
        AND ja.technician_id = t.technician_id
        AND COALESCE(ja.status, 'confirmed'::public.assignment_status) <> 'declined'::public.assignment_status
        AND COALESCE(ja.single_day, false)
        AND ja.assignment_date = t.date
    )
    AND (
      t.source IS NULL
      OR t.source = 'prep_day'
      OR t.category = 'prep_day'
      OR t.amount_breakdown ->> 'is_prep_day' = 'true'
    );

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deactivate_unassigned_prep_day_timesheet(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_unassigned_prep_day_timesheet(uuid,uuid,date) TO service_role;

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
    AND COALESCE(ja.single_day, false)
    AND ja.assignment_date = _date
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

CREATE OR REPLACE FUNCTION public.trg_ensure_prep_day_timesheets_for_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.job_id IS NOT NULL
       AND OLD.technician_id IS NOT NULL
       AND OLD.assignment_date IS NOT NULL THEN
      PERFORM public.deactivate_unassigned_prep_day_timesheet(
        OLD.job_id,
        OLD.technician_id,
        OLD.assignment_date
      );
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.job_id IS NOT NULL
     AND OLD.technician_id IS NOT NULL
     AND OLD.assignment_date IS NOT NULL THEN
    PERFORM public.deactivate_unassigned_prep_day_timesheet(
      OLD.job_id,
      OLD.technician_id,
      OLD.assignment_date
    );
  END IF;

  IF NEW.job_id IS NULL
     OR NEW.technician_id IS NULL
     OR NEW.assignment_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_date_types jdt
    WHERE jdt.job_id = NEW.job_id
      AND jdt.date = NEW.assignment_date
      AND jdt.type = 'prep_day'
  ) THEN
    IF COALESCE(NEW.status, 'confirmed'::public.assignment_status) <> 'declined'::public.assignment_status
       AND COALESCE(NEW.single_day, false) THEN
      PERFORM public.ensure_prep_day_timesheets_for_job_date(NEW.job_id, NEW.assignment_date);
      PERFORM public.refresh_timesheet_amounts_for_job_date(NEW.job_id, NEW.assignment_date);
    ELSE
      PERFORM public.deactivate_unassigned_prep_day_timesheet(
        NEW.job_id,
        NEW.technician_id,
        NEW.assignment_date
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_ensure_prep_day_timesheets_for_assignment() FROM PUBLIC;

DROP TRIGGER IF EXISTS t_aiu_ensure_prep_day_timesheets_for_assignment ON public.job_assignments;
DROP TRIGGER IF EXISTS t_ad_ensure_prep_day_timesheets_for_assignment ON public.job_assignments;
CREATE TRIGGER t_aiu_ensure_prep_day_timesheets_for_assignment
AFTER INSERT OR UPDATE OF job_id, technician_id, status, single_day, assignment_date
ON public.job_assignments
FOR EACH ROW
EXECUTE FUNCTION public.trg_ensure_prep_day_timesheets_for_assignment();

CREATE TRIGGER t_ad_ensure_prep_day_timesheets_for_assignment
AFTER DELETE
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

  UPDATE public.timesheets t
  SET is_active = false,
      updated_at = now()
  WHERE COALESCE(t.is_active, true)
    AND EXISTS (
      SELECT 1
      FROM public.job_date_types jdt
      WHERE jdt.job_id = t.job_id
        AND jdt.date = t.date
        AND jdt.type = 'prep_day'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_assignments ja
      WHERE ja.job_id = t.job_id
        AND ja.technician_id = t.technician_id
        AND COALESCE(ja.status, 'confirmed'::public.assignment_status) <> 'declined'::public.assignment_status
        AND COALESCE(ja.single_day, false)
        AND ja.assignment_date = t.date
    )
    AND (
      t.source IS NULL
      OR t.source = 'prep_day'
      OR t.category = 'prep_day'
      OR t.amount_breakdown ->> 'is_prep_day' = 'true'
    );
END;
$$;
