-- Matrix hardening: the remaining assignment-state writers join the command
-- boundary (ledger, expected-state token, shared lock order).
--   change_assignment_role  — job-card per-department role edits
--   set_assignment_status   — Matrix confirm/decline (wraps
--                             manage_assignment_lifecycle in the same
--                             transaction, after the shared locks)

ALTER TABLE public.assignment_commands DROP CONSTRAINT assignment_commands_command_type_check;
ALTER TABLE public.assignment_commands ADD CONSTRAINT assignment_commands_command_type_check
  CHECK (command_type IN (
    'apply_direct_assignment', 'remove_direct_assignment', 'remove_assignment_date',
    'change_assignment_role', 'set_assignment_status'));


-- ---------------------------------------------------------------------------
-- change_assignment_role
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.change_assignment_role(
  p_command_id uuid,
  p_job_id uuid,
  p_technician_id uuid,
  p_department text,
  p_role text,
  p_sync_category boolean DEFAULT true,
  p_expected_state_token text DEFAULT NULL,
  p_source text DEFAULT 'job-card',
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_type constant text := 'change_assignment_role';
  v_is_service boolean := auth.role() = 'service_role';
  v_actor uuid;
  v_role text := NULLIF(NULLIF(pg_catalog.btrim(p_role), ''), 'none');
  v_source text := COALESCE(NULLIF(pg_catalog.btrim(p_source), ''), 'job-card');
  v_role_discipline text;
  v_department text;
  v_job_type text;
  v_request jsonb;
  v_hash text;
  v_ledger public.assignment_commands%ROWTYPE;
  v_existing public.job_assignments%ROWTYPE;
  v_updated public.job_assignments%ROWTYPE;
  v_old_role text;
  v_prior jsonb;
  v_after jsonb;
  v_category text;
  v_ts_id uuid;
  v_warnings jsonb := '[]'::jsonb;
  v_side_effects jsonb := '[]'::jsonb;
  v_outcome text;
  v_result jsonb;
BEGIN
  IF NOT (v_is_service OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_actor := CASE WHEN v_is_service THEN p_actor_id ELSE auth.uid() END;
  IF p_command_id IS NULL OR p_job_id IS NULL OR p_technician_id IS NULL
     OR p_department IS NULL OR p_department NOT IN ('sound', 'lights', 'video', 'production') THEN
    RAISE EXCEPTION 'command, job, technician and a role department are required' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.length(v_role) > 64 THEN
    RAISE EXCEPTION 'role is too long' USING ERRCODE = '22023';
  END IF;
  IF v_source !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  -- Interactive callers must say which state they decided on; only trusted
  -- service callers may act without an expected-state token.
  IF NOT v_is_service AND p_expected_state_token IS NULL THEN
    RAISE EXCEPTION 'an expected state token is required' USING ERRCODE = '22023';
  END IF;
  IF p_metadata IS NOT NULL AND (pg_catalog.jsonb_typeof(p_metadata) <> 'object'
     OR pg_catalog.pg_column_size(p_metadata) > 4096) THEN
    RAISE EXCEPTION 'metadata must be a small JSON object' USING ERRCODE = '22023';
  END IF;

  v_request := pg_catalog.jsonb_build_object(
    'job_id', p_job_id, 'technician_id', p_technician_id, 'department', p_department,
    'role', v_role, 'sync_category', COALESCE(p_sync_category, true),
    'expected_state_token', p_expected_state_token);
  v_hash := pg_catalog.md5(v_request::text);

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

  SELECT job_type INTO v_job_type FROM public.jobs WHERE id = p_job_id FOR KEY SHARE;
  SELECT * INTO v_existing FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id FOR UPDATE;
  v_prior := public.assignment_state_snapshot(p_job_id, p_technician_id);

  IF v_job_type = 'dryhire' THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'dryhire_job', 'Dry-hire jobs have no crew', NULL, v_prior->>'state_token');
  END IF;
  IF v_existing.id IS NULL THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'assignment_not_found',
      'There is no assignment to change', NULL, v_prior->>'state_token');
  END IF;
  IF p_expected_state_token IS NOT NULL AND p_expected_state_token <> v_prior->>'state_token' THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'stale_state',
      'The assignment changed after it was loaded',
      pg_catalog.jsonb_build_object('current', v_prior), v_prior->>'state_token');
  END IF;

  -- Authoritative role validation (clearing a role is always allowed): a
  -- registered code of this role column's discipline, held by a technician of
  -- that discipline.
  IF v_role IS NOT NULL THEN
    SELECT discipline INTO v_role_discipline FROM public.assignment_role_codes WHERE code = v_role;
    IF NOT FOUND THEN
      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
        v_actor, v_source, v_request, v_hash, 'invalid_role', 'The role is not a registered role code',
        pg_catalog.jsonb_build_object('role', v_role), v_prior->>'state_token');
    END IF;
    SELECT department INTO v_department FROM public.profiles WHERE id = p_technician_id;
    IF v_role_discipline <> p_department
       OR public.assignment_role_discipline(v_department) IS DISTINCT FROM p_department THEN
      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
        v_actor, v_source, v_request, v_hash, 'role_department_mismatch',
        'The role does not belong to that department',
        pg_catalog.jsonb_build_object('department', p_department, 'technician_department', v_department, 'role', v_role),
        v_prior->>'state_token');
    END IF;
  END IF;

  v_old_role := CASE p_department WHEN 'sound' THEN v_existing.sound_role WHEN 'lights' THEN v_existing.lights_role
    WHEN 'video' THEN v_existing.video_role ELSE v_existing.production_role END;

  IF v_old_role IS NOT DISTINCT FROM v_role THEN
    v_outcome := 'noop';
  ELSE
    -- ---- Writes start here. ----
    UPDATE public.job_assignments SET
      sound_role = CASE WHEN p_department = 'sound' THEN v_role ELSE sound_role END,
      lights_role = CASE WHEN p_department = 'lights' THEN v_role ELSE lights_role END,
      video_role = CASE WHEN p_department = 'video' THEN v_role ELSE video_role END,
      production_role = CASE WHEN p_department = 'production' THEN v_role ELSE production_role END
    WHERE id = v_existing.id
    RETURNING * INTO v_updated;

    IF COALESCE(p_sync_category, true) THEN
      v_category := public.assignment_role_category(ARRAY[v_updated.sound_role, v_updated.lights_role, v_updated.video_role, v_updated.production_role]);
      IF v_category IS NOT NULL THEN
        PERFORM 1 FROM public.profiles WHERE id = p_technician_id FOR KEY SHARE NOWAIT;
        PERFORM 1 FROM public.timesheets t
        WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id
        ORDER BY t.date FOR UPDATE;
        FOR v_ts_id IN
          UPDATE public.timesheets t SET category = v_category
          WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id AND t.is_active
            AND t.category IS DISTINCT FROM v_category
            AND t.approved_by_manager IS NOT TRUE AND t.status <> 'approved'
          RETURNING t.id
        LOOP
          BEGIN
            PERFORM public.compute_timesheet_amount_2025(v_ts_id, true);
          EXCEPTION WHEN OTHERS THEN
            v_warnings := v_warnings || pg_catalog.jsonb_build_object(
              'kind', 'timesheet_repricing_failed', 'timesheet_id', v_ts_id, 'message', SQLERRM);
          END;
        END LOOP;
      END IF;
    END IF;

    INSERT INTO public.assignment_audit_log (
      assignment_id, job_id, technician_id, action, previous_status, new_status, actor_id, metadata
    ) VALUES (
      v_existing.id, p_job_id, p_technician_id, 'role_changed',
      v_existing.status::text, v_existing.status::text, v_actor,
      COALESCE(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'command_id', p_command_id, 'source', v_source, 'department', p_department,
        'previous_role', v_old_role, 'role', v_role)
    );

    -- Flex crew membership follows the sound/lights role appearing or going.
    IF p_department IN ('sound', 'lights') AND (v_old_role IS NULL) <> (v_role IS NULL) THEN
      v_side_effects := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'kind', 'flex', 'action', CASE WHEN v_role IS NULL THEN 'remove' ELSE 'add' END,
        'job_id', p_job_id, 'department', p_department, 'status', 'pending'));
      v_side_effects := public.assignment_effects_with_ids(p_command_id, v_side_effects);
    END IF;
    v_outcome := 'committed';
  END IF;

  v_after := public.assignment_state_snapshot(p_job_id, p_technician_id);
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome', v_outcome, 'command_id', p_command_id,
    'job_id', p_job_id, 'technician_id', p_technician_id,
    'assignment', v_after->'assignment', 'dates', v_after->'dates',
    'state_token', v_after->>'state_token', 'prior_state_token', v_prior->>'state_token',
    'side_effects', v_side_effects, 'warnings', v_warnings);

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

REVOKE ALL ON FUNCTION public.change_assignment_role(uuid, uuid, uuid, text, text, boolean, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_assignment_role(uuid, uuid, uuid, text, text, boolean, text, text, uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.change_assignment_role(uuid, uuid, uuid, text, text, boolean, text, text, uuid, jsonb) IS
  'Atomic per-department role change for admin/management: role column + category/repricing of unapproved active days, ledgered and idempotent.';

-- ---------------------------------------------------------------------------
-- set_assignment_status
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.set_assignment_status(
  p_command_id uuid,
  p_job_id uuid,
  p_technician_id uuid,
  p_action text,
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
  c_type constant text := 'set_assignment_status';
  v_is_service boolean := auth.role() = 'service_role';
  v_actor uuid;
  v_source text := COALESCE(NULLIF(pg_catalog.btrim(p_source), ''), 'matrix');
  v_request jsonb;
  v_hash text;
  v_ledger public.assignment_commands%ROWTYPE;
  v_existing public.job_assignments%ROWTYPE;
  v_prior jsonb;
  v_after jsonb;
  v_delete_mode text;
  v_job_type text;
  v_department text;
  v_approved date[];
  v_noop boolean := false;
  v_lifecycle jsonb;
  v_outcome text;
  v_side_effects jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  IF NOT (v_is_service OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_actor := CASE WHEN v_is_service THEN p_actor_id ELSE auth.uid() END;
  IF p_command_id IS NULL OR p_job_id IS NULL OR p_technician_id IS NULL
     OR p_action IS NULL OR p_action NOT IN ('confirm', 'decline') THEN
    RAISE EXCEPTION 'command, job, technician and confirm/decline are required' USING ERRCODE = '22023';
  END IF;
  IF v_source !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  -- Interactive callers must say which state they decided on; only trusted
  -- service callers may act without an expected-state token.
  IF NOT v_is_service AND p_expected_state_token IS NULL THEN
    RAISE EXCEPTION 'an expected state token is required' USING ERRCODE = '22023';
  END IF;
  IF p_metadata IS NOT NULL AND (pg_catalog.jsonb_typeof(p_metadata) <> 'object'
     OR pg_catalog.pg_column_size(p_metadata) > 4096) THEN
    RAISE EXCEPTION 'metadata must be a small JSON object' USING ERRCODE = '22023';
  END IF;

  v_request := pg_catalog.jsonb_build_object(
    'job_id', p_job_id, 'technician_id', p_technician_id, 'action', p_action,
    'expected_state_token', p_expected_state_token);
  v_hash := pg_catalog.md5(v_request::text);

  -- Confirmation checks cross-job conflicts: serialize per technician first.
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

  SELECT job_type INTO v_job_type FROM public.jobs WHERE id = p_job_id FOR KEY SHARE;
  SELECT * INTO v_existing FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id FOR UPDATE;
  v_prior := public.assignment_state_snapshot(p_job_id, p_technician_id);

  IF v_job_type = 'dryhire' THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'dryhire_job', 'Dry-hire jobs have no crew', NULL, v_prior->>'state_token');
  END IF;
  IF v_existing.id IS NULL THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'assignment_not_found',
      'There is no assignment to change', NULL, v_prior->>'state_token');
  END IF;
  IF p_expected_state_token IS NOT NULL AND p_expected_state_token <> v_prior->>'state_token' THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'stale_state',
      'The assignment changed after it was loaded',
      pg_catalog.jsonb_build_object('current', v_prior), v_prior->>'state_token');
  END IF;

  -- Tour memberships are removed on decline; everything else is soft.
  v_delete_mode := CASE WHEN v_existing.assignment_source = 'tour' THEN 'hard' ELSE 'soft' END;

  -- Already in the requested state: a true no-op (the lifecycle would still
  -- restamp response_time and write an audit row).
  IF (p_action = 'confirm' AND v_existing.status = 'confirmed')
     OR (p_action = 'decline' AND v_delete_mode = 'soft' AND v_existing.status = 'declined'
         AND pg_catalog.jsonb_array_length(v_prior->'dates') = 0) THEN
    v_noop := true;
  ELSIF p_action = 'decline' THEN
    -- A decline voids (soft) or deletes (tour) the schedule; approved days are
    -- financial records and block it.
    v_approved := public.assignment_approved_dates(p_job_id, p_technician_id,
      CASE WHEN v_delete_mode = 'soft'
        THEN ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_prior->'dates')::date) END);
    IF pg_catalog.cardinality(v_approved) > 0 THEN
      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
        v_actor, v_source, v_request, v_hash, 'approved_timesheet',
        'Approved timesheets cannot be voided by a decline',
        pg_catalog.jsonb_build_object('job_id', p_job_id, 'dates', pg_catalog.to_jsonb(v_approved)),
        v_prior->>'state_token');
    END IF;
  END IF;
  -- This transaction already holds the membership row, so the lifecycle's
  -- own NOWAIT lock succeeds; its writes commit or roll back with ours.
  IF v_noop THEN
    v_lifecycle := pg_catalog.jsonb_build_object('success', true, 'action', 'noop');
  ELSE
    v_lifecycle := public.manage_assignment_lifecycle(p_job_id, p_technician_id, p_action, v_delete_mode,
      v_actor, COALESCE(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object('command_id', p_command_id, 'source', v_source));
  END IF;

  IF NOT COALESCE((v_lifecycle->>'success')::boolean, false) THEN
    IF v_lifecycle->>'error' = 'conflict_detected' THEN
      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
        v_actor, v_source, v_request, v_hash, 'conflict',
        'The technician has conflicting assignments on these dates', NULL, v_prior->>'state_token');
    END IF;
    RAISE EXCEPTION 'assignment lifecycle failed: %', COALESCE(v_lifecycle->>'message', v_lifecycle->>'error')
      USING ERRCODE = 'P0001';
  END IF;

  v_after := public.assignment_state_snapshot(p_job_id, p_technician_id);
  v_outcome := CASE WHEN v_after->>'state_token' = v_prior->>'state_token' THEN 'noop' ELSE 'committed' END;
  IF v_outcome = 'committed' AND p_action = 'confirm' THEN
    v_side_effects := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'kind', 'notification', 'action', 'job.assignment.confirmed', 'job_id', p_job_id, 'status', 'pending'));
  ELSIF v_outcome = 'committed' AND v_lifecycle->>'action' = 'hard_deleted' THEN
    -- A declined tour membership is gone: take it off the Flex crew too, the
    -- same plan remove_direct_assignment uses. Soft declines keep membership
    -- (status declined) and leave Flex as it was before this change.
    SELECT department INTO v_department FROM public.profiles WHERE id = p_technician_id;
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', 'flex', 'action', 'remove',
             'job_id', p_job_id, 'department', dept, 'status', 'pending')), '[]'::jsonb)
      INTO v_side_effects
    FROM pg_catalog.unnest(public.assignment_flex_departments(v_prior->'assignment', v_department)) AS dept;
  END IF;
  v_side_effects := public.assignment_effects_with_ids(p_command_id, v_side_effects);

  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome', v_outcome, 'command_id', p_command_id,
    'job_id', p_job_id, 'technician_id', p_technician_id,
    'assignment', v_after->'assignment', 'dates', v_after->'dates',
    'state_token', v_after->>'state_token', 'prior_state_token', v_prior->>'state_token',
    'lifecycle', v_lifecycle, 'side_effects', v_side_effects, 'warnings', '[]'::jsonb);

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

REVOKE ALL ON FUNCTION public.set_assignment_status(uuid, uuid, uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_assignment_status(uuid, uuid, uuid, text, text, text, uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.set_assignment_status(uuid, uuid, uuid, text, text, text, uuid, jsonb) IS
  'Manager confirm/decline of an assignment under the shared lock order and ledger; delegates the state change to manage_assignment_lifecycle (tour memberships are hard-deleted on decline).';
