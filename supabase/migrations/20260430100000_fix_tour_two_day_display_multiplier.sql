-- Keep the returned/display tour multiplier aligned with the per-day payout math.
-- Two eligible tour dates in the same ISO week pay 1.125x per day, not a displayed 2.25x aggregate.

DO $$
DECLARE
  function_sql text;
  patched_sql text;
BEGIN
  SELECT pg_get_functiondef('public.compute_tour_job_rate_quote_2025(uuid,uuid)'::regprocedure)
  INTO function_sql;

  IF function_sql IS NULL THEN
    RAISE EXCEPTION 'compute_tour_job_rate_quote_2025(uuid,uuid) is missing';
  END IF;

  patched_sql := replace(
    function_sql,
    'WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 2.25::numeric',
    'WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 1.125::numeric'
  );

  IF patched_sql = function_sql THEN
    RAISE EXCEPTION 'Expected two-day aggregate display multiplier branch was not found';
  END IF;

  function_sql := patched_sql;
  patched_sql := replace(
    function_sql,
    'COALESCE(ROUND(AVG(dm.week_multiplier), 3), 1.0)',
    'COALESCE(ROUND(AVG(dm.date_multiplier), 3), 1.0)'
  );

  IF patched_sql = function_sql THEN
    RAISE EXCEPTION 'Expected display multiplier aggregate was not found';
  END IF;

  EXECUTE patched_sql;
END $$;

COMMENT ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) IS
  'Calculates tour job rate quotes. Scheduled non-prep job_date_types are the base payable dates, expanded show dates update quotes before all timesheets exist, rigging dates count only for assigned technicians, and returned multipliers are per payable date (1 date 1.5x, 2 dates 1.125x each, 3+ dates 1x).';
