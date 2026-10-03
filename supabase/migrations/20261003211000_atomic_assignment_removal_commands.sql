-- Matrix hardening M2: atomic removal primitives on the same command boundary
-- as apply_direct_assignment (ledger, expected-state token, shared lock order).
-- Cross-job moves are part of apply_direct_assignment (p_from_job_id).

-- ---------------------------------------------------------------------------
-- remove_direct_assignment: whole membership + schedule.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.remove_direct_assignment(
  p_command_id uuid,
  p_job_id uuid,
  p_technician_id uuid,
  p_expected_state_token text DEFAULT NULL,
  p_source text DEFAULT 'matrix',
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_type constant text := 'remove_direct_assignment';
  v_is_service boolean := auth.role() = 'service_role';
  v_actor uuid;
  v_source text := COALESCE(NULLIF(pg_catalog.btrim(p_source), ''), 'matrix');
  v_request jsonb;
  v_hash text;
  v_ledger public.assignment_commands%ROWTYPE;
  v_department text;
  v_prior jsonb;
  v_removed jsonb;
  v_after jsonb;
  v_outcome text;
  v_side_effects jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  IF NOT (v_is_service OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_actor := CASE WHEN v_is_service THEN p_actor_id ELSE auth.uid() END;
  IF p_command_id IS NULL OR p_job_id IS NULL OR p_technician_id IS NULL THEN
    RAISE EXCEPTION 'command, job and technician are required' USING ERRCODE = '22023';
  END IF;
  IF v_source !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  IF p_metadata IS NOT NULL AND (pg_catalog.jsonb_typeof(p_metadata) <> 'object'
     OR pg_catalog.pg_column_size(p_metadata) > 4096) THEN
    RAISE EXCEPTION 'metadata must be a small JSON object' USING ERRCODE = '22023';
  END IF;

  v_request := pg_catalog.jsonb_build_object(
    'job_id', p_job_id, 'technician_id', p_technician_id,
    'expected_state_token', p_expected_state_token);
  v_hash := pg_catalog.md5(v_request::text);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'assignment-technician:' || p_technician_id::text, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'staffing-offer:' || p_job_id::text || ':' || p_technician_id::text, 0));

  SELECT * INTO v_ledger FROM public.assignment_commands WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_ledger.command_type = c_type AND v_ledger.request_hash = v_hash THEN
      RETURN v_ledger.result || pg_catalog.jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505',
      DETAIL = 'This command id was already used for a different assignment command.';
  END IF;

  PERFORM 1 FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id FOR UPDATE;

  v_prior := public.assignment_state_snapshot(p_job_id, p_technician_id);
  IF p_expected_state_token IS NOT NULL AND p_expected_state_token <> v_prior->>'state_token' THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'stale_state',
      'The assignment changed after it was loaded',
      pg_catalog.jsonb_build_object('current', v_prior), v_prior->>'state_token');
  END IF;

  SELECT department INTO v_department FROM public.profiles WHERE id = p_technician_id;

  -- Orphan schedule rows are removed even without membership (same contract
  -- as remove_assignment_with_timesheets).
  v_removed := public.assignment_remove_membership_locked(p_job_id, p_technician_id);
  v_after := public.assignment_state_snapshot(p_job_id, p_technician_id);
  v_outcome := CASE
    WHEN NOT (v_removed->>'deleted_assignment')::boolean AND (v_removed->>'deleted_timesheets')::integer = 0
      THEN 'noop' ELSE 'committed' END;

  IF (v_removed->>'deleted_assignment')::boolean THEN
    INSERT INTO public.assignment_audit_log (
      assignment_id, job_id, technician_id, action, previous_status, new_status,
      actor_id, metadata, deleted_timesheet_count
    ) VALUES (
      (v_removed->'assignment'->>'id')::uuid, p_job_id, p_technician_id, 'hard_deleted',
      v_removed->'assignment'->>'status', NULL, v_actor,
      COALESCE(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'command_id', p_command_id, 'source', v_source,
        'assignment_source', v_removed->'assignment'->>'assignment_source'),
      (v_removed->>'deleted_timesheets')::integer
    );

    SELECT COALESCE(pg_catalog.jsonb_agg(effect ORDER BY ord), '[]'::jsonb) INTO v_side_effects
    FROM (
      SELECT 1 AS ord, pg_catalog.jsonb_build_object('kind', 'flex', 'action', 'remove',
        'job_id', p_job_id, 'department', dept, 'status', 'pending') AS effect
      FROM pg_catalog.unnest(public.assignment_flex_departments(v_removed->'assignment', v_department)) AS dept
      UNION ALL
      SELECT 2, pg_catalog.jsonb_build_object('kind', 'notification', 'action', 'assignment.removed',
        'job_id', p_job_id, 'status', 'pending')
    ) effects;
  END IF;

  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome', v_outcome,
    'command_id', p_command_id,
    'job_id', p_job_id,
    'technician_id', p_technician_id,
    'assignment', NULL,
    'dates', v_after->'dates',
    'state_token', v_after->>'state_token',
    'prior_state_token', v_prior->>'state_token',
    'removed', v_removed,
    'side_effects', v_side_effects,
    'warnings', '[]'::jsonb
  );

  INSERT INTO public.assignment_commands (
    command_id, command_type, job_id, technician_id, actor_id, source,
    request_hash, request, outcome, prior_state_token, result_state_token, result,
    side_effects, side_effects_status, side_effects_updated_at
  ) VALUES (
    p_command_id, c_type, p_job_id, p_technician_id, v_actor, v_source,
    v_hash, v_request, v_outcome, v_prior->>'state_token', v_after->>'state_token', v_result,
    v_side_effects,
    CASE WHEN pg_catalog.jsonb_array_length(v_side_effects) > 0 THEN 'pending' ELSE 'none' END,
    pg_catalog.now()
  ) ON CONFLICT (command_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505',
      DETAIL = 'This command id was already used for a different assignment command.';
  END IF;

  RETURN v_result || pg_catalog.jsonb_build_object('replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_direct_assignment(uuid, uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_direct_assignment(uuid, uuid, uuid, text, text, uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.remove_direct_assignment(uuid, uuid, uuid, text, text, uuid, jsonb) IS
  'Atomic removal of a job/technician membership and its whole schedule for admin/management, with expected-state check and idempotent command ledger.';

-- ---------------------------------------------------------------------------
-- remove_assignment_date: one day, never the base membership while other
-- days remain, never another day.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.remove_assignment_date(
  p_command_id uuid,
  p_job_id uuid,
  p_technician_id uuid,
  p_date date,
  p_expected_state_token text DEFAULT NULL,
  p_source text DEFAULT 'matrix',
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_type constant text := 'remove_assignment_date';
  v_is_service boolean := auth.role() = 'service_role';
  v_actor uuid;
  v_source text := COALESCE(NULLIF(pg_catalog.btrim(p_source), ''), 'matrix');
  v_request jsonb;
  v_hash text;
  v_ledger public.assignment_commands%ROWTYPE;
  v_existing public.job_assignments%ROWTYPE;
  v_prior jsonb;
  v_active_dates date[];
  v_remaining date[];
  v_deleted integer := 0;
  v_after jsonb;
  v_outcome text;
  v_result jsonb;
BEGIN
  IF NOT (v_is_service OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_actor := CASE WHEN v_is_service THEN p_actor_id ELSE auth.uid() END;
  IF p_command_id IS NULL OR p_job_id IS NULL OR p_technician_id IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'command, job, technician and date are required' USING ERRCODE = '22023';
  END IF;
  IF v_source !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  IF p_metadata IS NOT NULL AND (pg_catalog.jsonb_typeof(p_metadata) <> 'object'
     OR pg_catalog.pg_column_size(p_metadata) > 4096) THEN
    RAISE EXCEPTION 'metadata must be a small JSON object' USING ERRCODE = '22023';
  END IF;

  v_request := pg_catalog.jsonb_build_object(
    'job_id', p_job_id, 'technician_id', p_technician_id, 'date', p_date,
    'expected_state_token', p_expected_state_token);
  v_hash := pg_catalog.md5(v_request::text);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'assignment-technician:' || p_technician_id::text, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'staffing-offer:' || p_job_id::text || ':' || p_technician_id::text, 0));

  SELECT * INTO v_ledger FROM public.assignment_commands WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_ledger.command_type = c_type AND v_ledger.request_hash = v_hash THEN
      RETURN v_ledger.result || pg_catalog.jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505',
      DETAIL = 'This command id was already used for a different assignment command.';
  END IF;

  PERFORM 1 FROM public.jobs WHERE id = p_job_id FOR KEY SHARE;
  SELECT * INTO v_existing FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id FOR UPDATE;

  v_prior := public.assignment_state_snapshot(p_job_id, p_technician_id);
  IF p_expected_state_token IS NOT NULL AND p_expected_state_token <> v_prior->>'state_token' THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'stale_state',
      'The assignment changed after it was loaded',
      pg_catalog.jsonb_build_object('current', v_prior), v_prior->>'state_token');
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(t.date ORDER BY t.date), ARRAY[]::date[]) INTO v_active_dates
  FROM public.timesheets t
  WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id AND t.is_active;

  IF NOT (p_date = ANY (v_active_dates)) THEN
    v_outcome := 'noop';
  ELSE
    SELECT COALESCE(pg_catalog.array_agg(d ORDER BY d), ARRAY[]::date[]) INTO v_remaining
    FROM pg_catalog.unnest(v_active_dates) AS d WHERE d <> p_date;
    IF pg_catalog.cardinality(v_remaining) = 0 AND v_existing.id IS NOT NULL THEN
      -- Removing the last day is a membership removal; the caller must say so.
      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
        v_actor, v_source, v_request, v_hash, 'last_date',
        'This is the last scheduled day; remove the whole assignment instead',
        NULL, v_prior->>'state_token');
    END IF;

    -- ---- Writes start here. ----
    PERFORM 1 FROM public.profiles WHERE id = p_technician_id FOR KEY SHARE NOWAIT;
    PERFORM 1 FROM public.timesheets t
    WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id
    ORDER BY t.date FOR UPDATE;

    DELETE FROM public.timesheets
    WHERE job_id = p_job_id AND technician_id = p_technician_id AND date = p_date;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- Compatibility fields follow active-timesheet truth deterministically.
    IF v_existing.id IS NOT NULL AND v_existing.single_day AND v_existing.assignment_date = p_date THEN
      UPDATE public.job_assignments SET assignment_date = v_remaining[1]
      WHERE id = v_existing.id;
    END IF;

    INSERT INTO public.assignment_audit_log (
      assignment_id, job_id, technician_id, action, previous_status, new_status,
      actor_id, metadata, deleted_timesheet_count
    ) VALUES (
      v_existing.id, p_job_id, p_technician_id, 'date_removed',
      v_existing.status::text, v_existing.status::text, v_actor,
      COALESCE(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'command_id', p_command_id, 'source', v_source, 'date', p_date),
      v_deleted
    );
    v_outcome := 'committed';
  END IF;

  v_after := public.assignment_state_snapshot(p_job_id, p_technician_id);
  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome', v_outcome,
    'command_id', p_command_id,
    'job_id', p_job_id,
    'technician_id', p_technician_id,
    'assignment', v_after->'assignment',
    'dates', v_after->'dates',
    'state_token', v_after->>'state_token',
    'prior_state_token', v_prior->>'state_token',
    'removed_dates', CASE WHEN v_outcome = 'committed' THEN pg_catalog.jsonb_build_array(p_date) ELSE '[]'::jsonb END,
    'side_effects', '[]'::jsonb,
    'warnings', '[]'::jsonb
  );

  INSERT INTO public.assignment_commands (
    command_id, command_type, job_id, technician_id, actor_id, source,
    request_hash, request, outcome, prior_state_token, result_state_token, result
  ) VALUES (
    p_command_id, c_type, p_job_id, p_technician_id, v_actor, v_source,
    v_hash, v_request, v_outcome, v_prior->>'state_token', v_after->>'state_token', v_result
  ) ON CONFLICT (command_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505',
      DETAIL = 'This command id was already used for a different assignment command.';
  END IF;

  RETURN v_result || pg_catalog.jsonb_build_object('replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_assignment_date(uuid, uuid, uuid, date, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_assignment_date(uuid, uuid, uuid, date, text, text, uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.remove_assignment_date(uuid, uuid, uuid, date, text, text, uuid, jsonb) IS
  'Atomic removal of one scheduled day for admin/management. Refuses (last_date) to remove the last day of an existing membership; never touches other days.';

-- ---------------------------------------------------------------------------
-- Existing writers adopt the shared serialization contract.
-- ---------------------------------------------------------------------------

-- remove_assignment_with_timesheets keeps its signature, authorization, result
-- and Hoja behavior; the deletion body is now the shared helper.
CREATE OR REPLACE FUNCTION public.remove_assignment_with_timesheets(
  p_job_id uuid,
  p_technician_id uuid
)
RETURNS TABLE(deleted_timesheets integer, deleted_assignment boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_removed jsonb;
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

  v_removed := public.assignment_remove_membership_locked(p_job_id, p_technician_id);
  RETURN QUERY SELECT (v_removed->>'deleted_timesheets')::integer, (v_removed->>'deleted_assignment')::boolean;
END;
$$;

-- toggle_timesheet_day keeps its contract but now serializes with the
-- assignment commands and offer acceptance on the pair key, and locks the
-- membership before the schedule row (the shared order).
CREATE OR REPLACE FUNCTION public.toggle_timesheet_day(
  p_job_id uuid,
  p_technician_id uuid,
  p_date date,
  p_present boolean,
  p_source text DEFAULT 'matrix'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_job_type text;
  v_schedule_only boolean := false;
  v_actor uuid := auth.uid();
  v_assignment_source text;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_technician_id IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'job_id, technician_id, and date are required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'staffing-offer:' || p_job_id::text || ':' || p_technician_id::text, 0));

  SELECT job_type INTO v_job_type FROM public.jobs WHERE id = p_job_id;
  v_schedule_only := v_job_type IS NOT NULL AND v_job_type IN ('dryhire', 'tourdate');

  v_assignment_source := CASE
    WHEN COALESCE(p_source, 'matrix') IN ('tour') THEN 'tour'
    WHEN COALESCE(p_source, 'matrix') IN ('staffing') THEN 'staffing'
    ELSE 'direct'
  END;

  INSERT INTO public.job_assignments (
    job_id,
    technician_id,
    assignment_source,
    assigned_by,
    assigned_at
  )
  VALUES (
    p_job_id,
    p_technician_id,
    v_assignment_source,
    v_actor,
    NOW()
  )
  ON CONFLICT (job_id, technician_id) DO NOTHING;

  PERFORM 1 FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id
  FOR UPDATE;

  IF p_present THEN
    INSERT INTO public.timesheets (
      job_id,
      technician_id,
      date,
      created_by,
      is_schedule_only,
      source
    ) VALUES (
      p_job_id,
      p_technician_id,
      p_date,
      v_actor,
      v_schedule_only,
      COALESCE(p_source, 'matrix')
    )
    ON CONFLICT (job_id, technician_id, date) DO UPDATE
    SET is_schedule_only = EXCLUDED.is_schedule_only,
        source = EXCLUDED.source,
        created_by = COALESCE(EXCLUDED.created_by, public.timesheets.created_by);
  ELSE
    DELETE FROM public.timesheets
    WHERE job_id = p_job_id
      AND technician_id = p_technician_id
      AND date = p_date;
  END IF;
END;
$$;
