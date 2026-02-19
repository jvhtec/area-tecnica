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

  SELECT array_agg(id)
  INTO job_ids
  FROM public.jobs
  WHERE end_time < now() - interval '7 days'
    AND status != 'Cancelado'::job_status
    AND status != 'Completado'::job_status;

  IF job_ids IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.jobs
  SET status = 'Completado'::job_status,
      updated_at = now()
  WHERE id = ANY(job_ids);

  GET DIAGNOSTICS updated_count = ROW_COUNT;

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
      AND (start_time IS NULL OR end_time IS NULL)
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
