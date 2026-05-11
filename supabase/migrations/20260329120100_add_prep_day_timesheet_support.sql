CREATE OR REPLACE FUNCTION public.trg_apply_prep_day_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_prep_day boolean := false;
  v_worked_hours numeric := 0;
  v_raw_worked_hours numeric := 0;
  v_rate numeric := 15.00;
BEGIN
  IF NEW.job_id IS NULL OR NEW.date IS NULL OR NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.job_date_types jdt
    WHERE jdt.job_id = NEW.job_id
      AND jdt.date = NEW.date
      AND jdt.type = 'prep_day'
  ) INTO v_is_prep_day;

  IF NOT v_is_prep_day THEN
    RETURN NEW;
  END IF;

  IF NEW.end_time < NEW.start_time OR COALESCE(NEW.ends_next_day, false) THEN
    v_worked_hours := EXTRACT(EPOCH FROM (
      NEW.end_time - NEW.start_time + INTERVAL '24 hours'
    )) / 3600.0 - (COALESCE(NEW.break_minutes, 0) / 60.0);
  ELSE
    v_worked_hours := EXTRACT(EPOCH FROM (
      NEW.end_time - NEW.start_time
    )) / 3600.0 - (COALESCE(NEW.break_minutes, 0) / 60.0);
  END IF;

  v_worked_hours := GREATEST(v_worked_hours, 0);
  v_raw_worked_hours := v_worked_hours;
  v_worked_hours := ROUND(v_worked_hours);

  NEW.amount_eur := v_worked_hours * v_rate;
  NEW.amount_breakdown := jsonb_build_object(
    'worked_hours', v_raw_worked_hours,
    'worked_hours_rounded', v_worked_hours,
    'hours_rounded', v_worked_hours,
    'billable_hours', v_worked_hours,
    'is_prep_day', true,
    'prep_day_hourly_rate_eur', v_rate,
    'base_amount_eur', NEW.amount_eur,
    'base_day_eur', NEW.amount_eur,
    'plus_10_12_hours', 0,
    'plus_10_12_eur', 0,
    'plus_10_12_amount_eur', 0,
    'overtime_hours', 0,
    'overtime_hour_eur', 0,
    'overtime_amount_eur', 0,
    'total_eur', NEW.amount_eur,
    'category', 'prep_day'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_apply_prep_day_rate() FROM PUBLIC;

DROP TRIGGER IF EXISTS t_biu_apply_prep_day_rate ON public.timesheets;
CREATE TRIGGER t_biu_apply_prep_day_rate
BEFORE INSERT OR UPDATE OF job_id, date, start_time, end_time, break_minutes, ends_next_day, amount_eur, amount_breakdown, updated_at
ON public.timesheets
FOR EACH ROW
EXECUTE FUNCTION public.trg_apply_prep_day_rate();

-- Backfill persisted prep-day timesheets so existing rows follow €15/hour logic.
-- updated_at is intentionally included in the trigger column list above, so this
-- update forces the trigger to recompute amount_eur and amount_breakdown.
UPDATE public.timesheets t
SET updated_at = now()
WHERE t.job_id IS NOT NULL
  AND t.date IS NOT NULL
  AND t.start_time IS NOT NULL
  AND t.end_time IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.job_date_types jdt
    WHERE jdt.job_id = t.job_id
      AND jdt.date = t.date
      AND jdt.type = 'prep_day'
  );
-- Keep persisted timesheet amounts in sync when a date is marked or unmarked
-- as a prep day after timesheets already exist.

CREATE OR REPLACE FUNCTION public.compute_timesheet_amounts_2025(
  _timesheet_ids uuid[],
  _persist boolean DEFAULT false
)
RETURNS jsonb[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    array_agg(public.compute_timesheet_amount_2025(ids.timesheet_id, _persist) ORDER BY ids.ordinality),
    ARRAY[]::jsonb[]
  )
  FROM unnest(COALESCE(_timesheet_ids, ARRAY[]::uuid[])) WITH ORDINALITY AS ids(timesheet_id, ordinality);
$$;

REVOKE EXECUTE ON FUNCTION public.compute_timesheet_amounts_2025(uuid[],boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_timesheet_amounts_2025(uuid[],boolean) TO service_role;

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
  v_timesheet_ids uuid[] := ARRAY[]::uuid[];
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
    -- pricing in one bulk call using the canonical calculation function, so
    -- stale prep-day amount_breakdown values do not linger.
    SELECT COALESCE(array_agg(t.id), ARRAY[]::uuid[])
    INTO v_timesheet_ids
    FROM public.timesheets t
    WHERE t.job_id = _job_id
      AND t.date = _date
      AND COALESCE(t.is_active, true);

    PERFORM public.compute_timesheet_amounts_2025(v_timesheet_ids, true);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_timesheet_amounts_for_job_date(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_timesheet_amounts_for_job_date(uuid,date) TO service_role;

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

REVOKE EXECUTE ON FUNCTION public.trg_refresh_timesheets_for_prep_day_date_type() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.upsert_job_prep_days(
  p_job_id uuid,
  p_dates date[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dates date[] := ARRAY[]::date[];
  v_job_type public.job_type;
  v_job_start_date date;
  v_invalid_dates text;
  v_conflict_summary text;
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'Job id is required' USING ERRCODE = '22023';
  END IF;

  IF auth.role() <> 'service_role'
     AND COALESCE(public.get_current_user_role(), '') NOT IN ('admin', 'management', 'logistics') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(date_value ORDER BY date_value), ARRAY[]::date[])
  INTO v_dates
  FROM (
    SELECT DISTINCT input.date_value
    FROM unnest(COALESCE(p_dates, ARRAY[]::date[])) AS input(date_value)
    WHERE input.date_value IS NOT NULL
  ) normalized;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_job_id::text, 0));

  SELECT
    j.job_type,
    (j.start_time AT TIME ZONE COALESCE(NULLIF(j.timezone, ''), 'Europe/Madrid'))::date
  INTO v_job_type, v_job_start_date
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id USING ERRCODE = 'P0002';
  END IF;

  IF v_job_type = 'dryhire' AND cardinality(v_dates) > 0 THEN
    RAISE EXCEPTION 'Prep days are not supported for dry hire jobs' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_dates) > 0 THEN
    SELECT string_agg(date_value::text, ', ' ORDER BY date_value)
    INTO v_invalid_dates
    FROM unnest(v_dates) AS requested(date_value)
    WHERE requested.date_value >= v_job_start_date;

    IF v_invalid_dates IS NOT NULL THEN
      RAISE EXCEPTION 'Prep days must be before the job start date: %', v_invalid_dates USING ERRCODE = '22023';
    END IF;

    SELECT string_agg(format('%s (%s)', jdt.date, jdt.type), ', ' ORDER BY jdt.date)
    INTO v_conflict_summary
    FROM public.job_date_types jdt
    WHERE jdt.job_id = p_job_id
      AND jdt.date = ANY(v_dates)
      AND jdt.type <> 'prep_day';

    IF v_conflict_summary IS NOT NULL THEN
      RAISE EXCEPTION 'Prep days conflict with existing date types: %', v_conflict_summary USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.job_date_types (job_id, date, type)
    SELECT p_job_id, requested.date_value, 'prep_day'::public.job_date_type
    FROM unnest(v_dates) AS requested(date_value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.job_date_types existing
      WHERE existing.job_id = p_job_id
        AND existing.date = requested.date_value
        AND existing.type = 'prep_day'
    );
  END IF;

  DELETE FROM public.job_date_types jdt
  WHERE jdt.job_id = p_job_id
    AND jdt.type = 'prep_day'
    AND NOT (jdt.date = ANY(v_dates));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_job_prep_days(uuid,date[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_job_prep_days(uuid,date[]) TO authenticated, service_role;

DROP TRIGGER IF EXISTS t_aiud_refresh_timesheets_for_prep_day_date_type ON public.job_date_types;
CREATE TRIGGER t_aiud_refresh_timesheets_for_prep_day_date_type
AFTER INSERT OR UPDATE OF job_id, date, type OR DELETE
ON public.job_date_types
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_timesheets_for_prep_day_date_type();
