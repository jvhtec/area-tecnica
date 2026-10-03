-- Matrix hardening: offer acceptance joins the assignment-command conflict
-- contract. assign_staffing_offer now takes the per-technician advisory key
-- first and re-checks cross-job schedule conflicts under it, raising P0409
-- ("assignment_conflict") before any write. staffing-click records that as
-- auto_assign_skipped_conflict, exactly like its own pre-check.
-- Signature, grants and every other behavior are unchanged.

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
  v_conflicts jsonb;
BEGIN
  SELECT * INTO STRICT v_request FROM public.staffing_requests WHERE id = p_request_id;
  IF v_request.phase <> 'offer' OR v_request.status <> 'confirmed' THEN
    RAISE EXCEPTION 'A confirmed offer response is required' USING ERRCODE = '22023';
  END IF;

  -- Matrix hardening: acceptance enforces cross-job conflicts under the same
  -- per-technician key as the assignment commands, taken before every other
  -- lock (the shared order: technician -> pair -> job -> membership -> rows).
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'assignment-technician:' || v_request.profile_id::text, 0));

  -- Serialize even when membership does not exist yet. Re-read membership under
  -- this lock so simultaneous extensions never reset legacy scope/prep-day data.
  -- Festival cleanup takes its own advisory key AFTER locking membership.
  -- A separate namespace avoids reversing that existing deletion lock order.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'staffing-offer:' || v_request.job_id::text || ':' || v_request.profile_id::text, 0));
  -- Keep parent deletion from holding the job while waiting for membership;
  -- a new schedule row's foreign key needs this parent key too.
  SELECT job_type INTO STRICT v_job_type FROM public.jobs
  WHERE id = v_request.job_id FOR KEY SHARE;
  SELECT department INTO STRICT v_department FROM public.profiles WHERE id = v_request.profile_id;
  SELECT array_agg(d ORDER BY d) INTO v_dates FROM (SELECT DISTINCT unnest(p_dates) AS d) dates;
  IF array_position(v_dates, NULL) IS NOT NULL
     OR (v_job_type <> 'dryhire' AND COALESCE(cardinality(v_dates), 0) = 0)
     OR (COALESCE(p_single_day, false) AND cardinality(v_dates) IS DISTINCT FROM 1) THEN
    RAISE EXCEPTION 'Valid accepted dates are required' USING ERRCODE = '22023';
  END IF;

  -- The edge function's earlier conflict check read the schedule without a
  -- lock. Re-check under the technician key: a direct assignment or another
  -- acceptance that committed meanwhile must win, not be double-booked over.
  -- Dry-hire jobs carry no crew and are ignored on both sides.
  IF v_job_type <> 'dryhire' THEN
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('job_id', c.job_id, 'title', c.title, 'date', c.date)
             ORDER BY c.date, c.job_id)
      INTO v_conflicts
    FROM (
      SELECT DISTINCT t.job_id, j.title, t.date
      FROM public.timesheets t
      JOIN public.jobs j ON j.id = t.job_id
      WHERE t.technician_id = v_request.profile_id
        AND t.is_active
        AND t.job_id <> v_request.job_id
        AND j.job_type <> 'dryhire'
        AND t.date = ANY (v_dates)
    ) c;
    IF v_conflicts IS NOT NULL THEN
      RAISE EXCEPTION 'assignment_conflict' USING ERRCODE = 'P0409',
        DETAIL = v_conflicts::text,
        HINT = 'The technician was scheduled on another job for an accepted date.';
    END IF;
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
    -- Existing membership updates may skip the technician FK check. Protect
    -- this parent before adding schedules, but never wait on its deletion
    -- while holding membership. Take this after assigned_by's auth-user FK
    -- checks so no new profile/auth-user lock order is introduced.
    PERFORM 1 FROM public.profiles WHERE id = v_request.profile_id
    FOR KEY SHARE NOWAIT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician profile no longer exists' USING ERRCODE = 'P0002';
    END IF;

    -- Repricing can update a row already modified by the upsert, causing its
    -- unchanged profile FKs to be checked again. Lock the actual existing rows
    -- before reading their references, then fail fast if a referenced profile
    -- is being deleted while waiting for those rows.
    PERFORM 1 FROM public.timesheets t
    WHERE t.job_id = v_request.job_id AND t.technician_id = v_request.profile_id
      AND t.date = ANY(v_dates)
    ORDER BY t.date FOR UPDATE;
    PERFORM 1 FROM public.profiles p
    WHERE p.id IN (
      SELECT ref_id FROM public.timesheets t
      CROSS JOIN LATERAL unnest(ARRAY[t.created_by, t.approved_by, t.rejected_by]) AS ref_id
      WHERE t.job_id = v_request.job_id AND t.technician_id = v_request.profile_id
        AND t.date = ANY(v_dates)
    )
    ORDER BY p.id FOR KEY SHARE NOWAIT;

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

    -- A direct writer can insert an attributed row after the initial probe.
    -- The upsert now holds that actual row; protect its parents before the
    -- second update can recheck unchanged foreign keys.
    PERFORM 1 FROM public.profiles p
    WHERE p.id IN (
      SELECT ref_id FROM public.timesheets t
      CROSS JOIN LATERAL unnest(ARRAY[t.created_by, t.approved_by, t.rejected_by]) AS ref_id
      WHERE t.job_id = v_request.job_id AND t.technician_id = v_request.profile_id
        AND t.date = ANY(v_dates)
    )
    ORDER BY p.id FOR KEY SHARE NOWAIT;

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
