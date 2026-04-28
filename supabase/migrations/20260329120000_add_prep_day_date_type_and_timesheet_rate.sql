ALTER TYPE public.job_date_type ADD VALUE IF NOT EXISTS 'prep_day';

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
