CREATE OR REPLACE FUNCTION public.auto_complete_past_jobs() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  updated_count integer;
  job_ids uuid[];
  ts_ids uuid[];
  ts_id uuid;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  -- Use a single atomic UPDATE with RETURNING to avoid TOCTOU race condition.
  -- Timezone-aware: closure starts at startOfDay(end_time + 7 days) in the job's
  -- timezone, matching the client-side isJobPastClosureWindow() logic exactly.
  WITH updated AS (
    UPDATE public.jobs
    SET status = 'Completado'::job_status,
        updated_at = now()
    WHERE now() >= (
            date_trunc('day',
              (end_time AT TIME ZONE COALESCE(timezone, 'Europe/Madrid'))
              + interval '7 days'
            ) AT TIME ZONE COALESCE(timezone, 'Europe/Madrid')
          )
      AND status != 'Cancelado'::job_status
      AND status != 'Completado'::job_status
    RETURNING id
  )
  SELECT array_agg(id), count(*)::integer
  INTO job_ids, updated_count
  FROM updated;

  IF job_ids IS NULL THEN
    RETURN 0;
  END IF;

  -- Normalize timesheets: set default values for any NULL fields
  -- This ensures all timesheets have complete data before computing amounts
  SELECT array_agg(id)
  INTO ts_ids
  FROM (
    UPDATE public.timesheets
    SET start_time = COALESCE(start_time, '09:00'::time),
        end_time = COALESCE(end_time, '17:00'::time),
        break_minutes = COALESCE(break_minutes, 0),
        ends_next_day = COALESCE(ends_next_day, false)
    WHERE job_id = ANY(job_ids)
      AND is_active = true
      AND (start_time IS NULL OR end_time IS NULL OR break_minutes IS NULL OR ends_next_day IS NULL)
    RETURNING id
  ) updated_timesheets;

  IF ts_ids IS NOT NULL THEN
    FOREACH ts_id IN ARRAY ts_ids LOOP
      PERFORM public.compute_timesheet_amount_2025(ts_id, true);
    END LOOP;
  END IF;

  RETURN updated_count;
END;
$$;
