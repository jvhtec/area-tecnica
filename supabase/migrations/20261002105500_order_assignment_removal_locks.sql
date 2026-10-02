-- Atomic offer acceptance holds membership while writing timesheets. Removal
-- must acquire those same row locks in that order, preserving its authorization,
-- result counts and final Hoja behavior.
CREATE OR REPLACE FUNCTION public.remove_assignment_with_timesheets(
  p_job_id uuid,
  p_technician_id uuid
)
RETURNS TABLE(deleted_timesheets integer, deleted_assignment boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_deleted_timesheets int := 0;
  v_assignment_rows int := 0;
  v_deleted_assignment boolean := false;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  -- Serialize with acceptance even if membership is initially absent and a
  -- third writer recreates it before this command reaches its DELETE.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'staffing-offer:' || p_job_id::text || ':' || p_technician_id::text, 0));

  -- Match acceptance and manage_assignment_lifecycle: membership first, then
  -- timesheets. No row is created or required when membership is absent.
  PERFORM 1 FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id
  FOR UPDATE;

  DELETE FROM public.timesheets
  WHERE job_id = p_job_id AND technician_id = p_technician_id;
  GET DIAGNOSTICS v_deleted_timesheets = ROW_COUNT;

  DELETE FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id;
  GET DIAGNOSTICS v_assignment_rows = ROW_COUNT;
  v_deleted_assignment := v_assignment_rows > 0;

  IF v_deleted_assignment THEN
    DELETE FROM public.hoja_de_ruta_staff s
    USING public.hoja_de_ruta h
    WHERE h.job_id = p_job_id AND s.hoja_de_ruta_id = h.id
      AND COALESCE(h.status, 'draft') <> 'final'
      AND s.technician_id = p_technician_id;

    DELETE FROM public.hoja_de_ruta_contacts c
    USING public.hoja_de_ruta h
    WHERE h.job_id = p_job_id AND c.hoja_de_ruta_id = h.id
      AND COALESCE(h.status, 'draft') <> 'final'
      AND c.technician_id = p_technician_id;
  END IF;

  RETURN QUERY SELECT v_deleted_timesheets, v_deleted_assignment;
END;
$$;
