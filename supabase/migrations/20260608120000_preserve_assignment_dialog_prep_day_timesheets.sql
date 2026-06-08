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
      OR (
        t.source IS DISTINCT FROM 'assignment-dialog'
        AND (
          t.category = 'prep_day'
          OR t.amount_breakdown ->> 'is_prep_day' = 'true'
        )
      )
    );

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deactivate_unassigned_prep_day_timesheet(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_unassigned_prep_day_timesheet(uuid,uuid,date) TO service_role;

UPDATE public.timesheets t
SET is_active = true,
    updated_at = now()
WHERE t.source = 'assignment-dialog'
  AND COALESCE(t.is_active, false) IS DISTINCT FROM true
  AND EXISTS (
    SELECT 1
    FROM public.job_date_types jdt
    WHERE jdt.job_id = t.job_id
      AND jdt.date = t.date
      AND jdt.type = 'prep_day'
  )
  AND EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    WHERE ja.job_id = t.job_id
      AND ja.technician_id = t.technician_id
      AND COALESCE(ja.status, 'confirmed'::public.assignment_status) <> 'declined'::public.assignment_status
  );
