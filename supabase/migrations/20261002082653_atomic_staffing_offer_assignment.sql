-- Phase 2A: the technician response is committed by staffing-click FIRST.
-- This command owns only membership + accepted-date schedule persistence.
CREATE OR REPLACE FUNCTION public.assign_staffing_offer(
  p_request_id uuid,
  p_dates date[],
  p_single_day boolean,
  p_role text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_request public.staffing_requests%ROWTYPE;
  v_job_type text;
  v_department text;
  v_assignment public.job_assignments%ROWTYPE;
  v_dates date[];
BEGIN
  SELECT * INTO STRICT v_request FROM public.staffing_requests WHERE id = p_request_id;
  IF v_request.phase <> 'offer' OR v_request.status <> 'confirmed' THEN
    RAISE EXCEPTION 'A confirmed offer response is required' USING ERRCODE = '22023';
  END IF;

  -- Serialize even when membership does not exist yet. Re-read membership under
  -- this lock so simultaneous extensions never reset legacy scope/prep-day data.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_request.job_id::text || ':' || v_request.profile_id::text, 0));
  SELECT job_type INTO STRICT v_job_type FROM public.jobs WHERE id = v_request.job_id;
  SELECT department INTO STRICT v_department FROM public.profiles WHERE id = v_request.profile_id;
  SELECT array_agg(d ORDER BY d) INTO v_dates FROM (SELECT DISTINCT unnest(p_dates) AS d) dates;
  IF array_position(v_dates, NULL) IS NOT NULL
     OR (v_job_type <> 'dryhire' AND COALESCE(cardinality(v_dates), 0) = 0)
     OR (COALESCE(p_single_day, false) AND cardinality(v_dates) IS DISTINCT FROM 1) THEN
    RAISE EXCEPTION 'Valid accepted dates are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_assignment FROM public.job_assignments
  WHERE job_id = v_request.job_id AND technician_id = v_request.profile_id FOR UPDATE;

  IF v_assignment.status = 'confirmed' THEN
    -- Do not mention prep-trigger columns in an extension UPDATE.
    UPDATE public.job_assignments SET
      assigned_by = v_request.requested_by, assigned_at = now(),
      assignment_source = 'staffing', response_time = now(),
      sound_role = CASE WHEN v_department = 'sound' THEN p_role ELSE sound_role END,
      lights_role = CASE WHEN v_department = 'lights' THEN p_role ELSE lights_role END,
      video_role = CASE WHEN v_department = 'video' THEN p_role ELSE video_role END,
      production_role = CASE WHEN v_department IN ('production', 'logistics') THEN p_role ELSE production_role END
    WHERE id = v_assignment.id RETURNING * INTO v_assignment;
  ELSE
    INSERT INTO public.job_assignments (
      job_id, technician_id, status, single_day, assignment_date,
      assigned_by, assigned_at, assignment_source, response_time,
      sound_role, lights_role, video_role, production_role
    ) VALUES (
      v_request.job_id, v_request.profile_id, 'confirmed', COALESCE(p_single_day, false),
      CASE WHEN p_single_day THEN v_dates[1] ELSE NULL END,
      v_request.requested_by, now(), 'staffing', now(),
      CASE WHEN v_department = 'sound' THEN p_role END,
      CASE WHEN v_department = 'lights' THEN p_role END,
      CASE WHEN v_department = 'video' THEN p_role END,
      CASE WHEN v_department IN ('production', 'logistics') THEN p_role END
    ) ON CONFLICT (job_id, technician_id) DO UPDATE SET
      status = excluded.status, single_day = excluded.single_day, assignment_date = excluded.assignment_date,
      assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at,
      assignment_source = excluded.assignment_source, response_time = excluded.response_time,
      sound_role = CASE WHEN v_department = 'sound' THEN p_role ELSE job_assignments.sound_role END,
      lights_role = CASE WHEN v_department = 'lights' THEN p_role ELSE job_assignments.lights_role END,
      video_role = CASE WHEN v_department = 'video' THEN p_role ELSE job_assignments.video_role END,
      production_role = CASE WHEN v_department IN ('production', 'logistics') THEN p_role ELSE job_assignments.production_role END
    RETURNING * INTO v_assignment;
  END IF;

  IF v_job_type <> 'dryhire' THEN
    INSERT INTO public.timesheets (job_id, technician_id, date, is_schedule_only, source, is_active)
    SELECT v_request.job_id, v_request.profile_id, d, v_job_type = 'tourdate', 'staffing', true
    FROM unnest(v_dates) AS d
    ON CONFLICT (job_id, technician_id, date) DO UPDATE SET
      is_schedule_only = excluded.is_schedule_only, source = excluded.source, is_active = excluded.is_active,
      category = COALESCE(timesheets.category, excluded.category)
    WHERE timesheets.is_schedule_only IS DISTINCT FROM excluded.is_schedule_only
       OR timesheets.source IS DISTINCT FROM excluded.source
       OR timesheets.is_active IS DISTINCT FROM excluded.is_active
       OR (timesheets.category IS NULL AND excluded.category IS NOT NULL);

    -- The former HTTP upsert mentioned date, firing the prep pricing trigger.
    -- Reactivated drafts may have missed date-type repricing while inactive.
    -- Reuse the canonical trigger only for accepted, unapproved prep hours;
    -- approved rows and prep days outside this offer remain untouched.
    UPDATE public.timesheets t SET updated_at = now()
    WHERE t.job_id = v_request.job_id AND t.technician_id = v_request.profile_id
      AND t.date = ANY(v_dates) AND t.approved_by_manager IS NOT TRUE
      AND t.start_time IS NOT NULL AND t.end_time IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.job_date_types jdt
                  WHERE jdt.job_id = t.job_id AND jdt.date = t.date AND jdt.type = 'prep_day');
  END IF;
  -- Exceptions propagate: membership, schedule and trigger effects all roll back.
  RETURN v_assignment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_staffing_offer(uuid, date[], boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_staffing_offer(uuid, date[], boolean, text) TO service_role;
COMMENT ON FUNCTION public.assign_staffing_offer(uuid, date[], boolean, text) IS
  'Service-only atomic membership and schedule persistence after an offer response; does not redefine confirmed offers or enforce capacity.';
