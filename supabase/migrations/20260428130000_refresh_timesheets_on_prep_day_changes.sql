-- Keep persisted timesheet amounts in sync when a date is marked or unmarked
-- as a prep day after timesheets already exist.

CREATE OR REPLACE FUNCTION public.refresh_timesheet_amounts_for_job_date(
  _job_id uuid,
  _date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_prep_day boolean := false;
  v_timesheet record;
BEGIN
  IF _job_id IS NULL OR _date IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.job_date_types jdt
    WHERE jdt.job_id = _job_id
      AND jdt.date = _date
      AND jdt.type = 'prep_day'
  ) INTO v_is_prep_day;

  IF v_is_prep_day THEN
    -- This deliberately updates updated_at only. The prep-day BEFORE UPDATE
    -- trigger on timesheets sees the matching prep_day row and rewrites
    -- amount_eur / amount_breakdown to the fixed €15/hour calculation.
    UPDATE public.timesheets t
    SET updated_at = now()
    WHERE t.job_id = _job_id
      AND t.date = _date
      AND COALESCE(t.is_active, true);
  ELSE
    -- The prep_day row was removed or changed. Restore normal timesheet
    -- pricing using the canonical calculation function, so stale prep-day
    -- amount_breakdown values do not linger.
    FOR v_timesheet IN
      SELECT t.id
      FROM public.timesheets t
      WHERE t.job_id = _job_id
        AND t.date = _date
        AND COALESCE(t.is_active, true)
    LOOP
      PERFORM public.compute_timesheet_amount_2025(v_timesheet.id, true);
    END LOOP;
  END IF;
END;
$$;

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
      PERFORM public.refresh_timesheet_amounts_for_job_date(NEW.job_id, NEW.date);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.type = 'prep_day' THEN
    PERFORM public.refresh_timesheet_amounts_for_job_date(NEW.job_id, NEW.date);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_aiud_refresh_timesheets_for_prep_day_date_type ON public.job_date_types;
CREATE TRIGGER t_aiud_refresh_timesheets_for_prep_day_date_type
AFTER INSERT OR UPDATE OF job_id, date, type OR DELETE
ON public.job_date_types
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_timesheets_for_prep_day_date_type();
