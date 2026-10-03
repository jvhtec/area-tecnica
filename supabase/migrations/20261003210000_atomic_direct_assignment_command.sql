-- Matrix hardening M1: one authoritative database command for direct
-- assignment (create / modify / move), replacing the multi-step browser
-- transaction in AssignJobDialog. See
-- docs/staffing/MATRIX_HARDENING_ROADMAP_2026-10-03.md and
-- docs/staffing/ASSIGNMENT_COMMANDS.md.
--
-- Lock order shared by every assignment command (and compatible with
-- assign_staffing_offer / remove_assignment_with_timesheets, which take only
-- step 2 onwards):
--   1. advisory 'assignment-technician:<technician>' (commands that enforce
--      cross-job conflicts serialize per technician);
--   2. advisory 'staffing-offer:<job>:<technician>' for every touched job,
--      sorted by job id;
--   3. jobs FOR KEY SHARE (sorted by id);
--   4. job_assignments rows FOR UPDATE (sorted by job id);
--   5. technician profile FOR KEY SHARE NOWAIT, then timesheet rows in date
--      order.
-- Business rejections (stale, conflict, missing entity) are decided BEFORE any
-- write and returned as {ok:false, code}; anything after the first write raises
-- so the whole command rolls back.

-- ---------------------------------------------------------------------------
-- Command ledger: idempotent replay, audit and side-effect reconciliation.
-- ---------------------------------------------------------------------------
CREATE TABLE public.assignment_commands (
  command_id uuid PRIMARY KEY,
  command_type text NOT NULL CHECK (command_type IN (
    'apply_direct_assignment', 'remove_direct_assignment', 'remove_assignment_date')),
  job_id uuid NOT NULL,
  technician_id uuid NOT NULL,
  from_job_id uuid,
  actor_id uuid,
  source text NOT NULL,
  request_hash text NOT NULL,
  request jsonb NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('committed', 'noop', 'rejected')),
  error_code text,
  prior_state_token text,
  result_state_token text,
  result jsonb NOT NULL,
  side_effects jsonb NOT NULL DEFAULT '[]'::jsonb,
  side_effects_status text NOT NULL DEFAULT 'none'
    CHECK (side_effects_status IN ('none', 'pending', 'succeeded', 'failed')),
  side_effects_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome <> 'rejected' OR error_code IS NOT NULL)
);

COMMENT ON TABLE public.assignment_commands IS
  'Ledger of assignment commands (apply/remove/date removal): idempotent replay by command_id, structured audit, and post-commit side-effect reconciliation state. No foreign keys so the audit survives job/profile deletion.';

CREATE INDEX assignment_commands_pair_idx
  ON public.assignment_commands (job_id, technician_id, created_at DESC);
CREATE INDEX assignment_commands_created_at_idx
  ON public.assignment_commands (created_at DESC);
CREATE INDEX assignment_commands_side_effects_open_idx
  ON public.assignment_commands (side_effects_status, created_at DESC)
  WHERE side_effects_status IN ('pending', 'failed');

ALTER TABLE public.assignment_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.assignment_commands FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.assignment_commands TO authenticated;
GRANT ALL ON TABLE public.assignment_commands TO service_role;

CREATE POLICY assignment_commands_management_read
  ON public.assignment_commands FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_management()));

-- ---------------------------------------------------------------------------
-- State token: fingerprint of everything a manager decided about one
-- job/technician pair (membership fields + active schedule). A dialog loads it
-- and sends it back; a mismatch means somebody else changed the pair.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.assignment_state_snapshot(p_job_id uuid, p_technician_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH membership AS (
    SELECT pg_catalog.jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'sound_role', a.sound_role,
      'lights_role', a.lights_role,
      'video_role', a.video_role,
      'production_role', a.production_role,
      'single_day', a.single_day,
      'assignment_date', a.assignment_date,
      'assignment_source', a.assignment_source
    ) AS membership_row
    FROM public.job_assignments a
    WHERE a.job_id = p_job_id AND a.technician_id = p_technician_id
  ),
  schedule AS (
    SELECT COALESCE(pg_catalog.jsonb_agg(t.date ORDER BY t.date), '[]'::jsonb) AS dates
    FROM public.timesheets t
    WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id AND t.is_active
  ),
  decided AS (
    SELECT (SELECT membership_row FROM membership) AS membership_row, (SELECT dates FROM schedule) AS dates
  )
  SELECT pg_catalog.jsonb_build_object(
    'exists', d.membership_row IS NOT NULL,
    'assignment', d.membership_row,
    'dates', d.dates,
    -- id/assignment_source are identity/provenance, not a manager decision.
    'state_token', pg_catalog.md5(pg_catalog.jsonb_build_object(
      'membership', d.membership_row - ARRAY['id', 'assignment_source']::text[],
      'dates', d.dates
    )::text)
  )
  FROM decided d;
$$;

CREATE FUNCTION public.assignment_state_token(p_job_id uuid, p_technician_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.assignment_state_snapshot(p_job_id, p_technician_id)->>'state_token';
$$;

REVOKE ALL ON FUNCTION public.assignment_state_snapshot(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assignment_state_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_state_snapshot(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assignment_state_token(uuid, uuid) TO service_role;

-- Read side for dialogs: the authoritative state + token to send back.
CREATE FUNCTION public.get_assignment_command_state(p_job_id uuid, p_technician_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_job_id IS NULL OR p_technician_id IS NULL THEN
    RAISE EXCEPTION 'job and technician are required' USING ERRCODE = '22023';
  END IF;
  RETURN public.assignment_state_snapshot(p_job_id, p_technician_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_assignment_command_state(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_command_state(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Internal helpers (no client grants).
-- ---------------------------------------------------------------------------

-- Records a rejection in the ledger and returns the client-facing result. A
-- concurrent command that already used this id for something else aborts.
CREATE FUNCTION public.assignment_command_reject(
  p_command_id uuid,
  p_command_type text,
  p_job_id uuid,
  p_technician_id uuid,
  p_from_job_id uuid,
  p_actor_id uuid,
  p_source text,
  p_request jsonb,
  p_request_hash text,
  p_code text,
  p_message text,
  p_details jsonb,
  p_prior_state_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := pg_catalog.jsonb_build_object(
    'ok', false,
    'outcome', 'rejected',
    'code', p_code,
    'message', p_message,
    'command_id', p_command_id,
    'job_id', p_job_id,
    'technician_id', p_technician_id,
    'state_token', p_prior_state_token,
    'details', COALESCE(p_details, '{}'::jsonb)
  );
BEGIN
  INSERT INTO public.assignment_commands (
    command_id, command_type, job_id, technician_id, from_job_id, actor_id, source,
    request_hash, request, outcome, error_code, prior_state_token, result_state_token, result
  ) VALUES (
    p_command_id, p_command_type, p_job_id, p_technician_id, p_from_job_id, p_actor_id, p_source,
    p_request_hash, p_request, 'rejected', p_code, p_prior_state_token, p_prior_state_token, v_result
  ) ON CONFLICT (command_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505',
      DETAIL = 'This command id was already used for a different assignment command.';
  END IF;
  RETURN v_result || pg_catalog.jsonb_build_object('replayed', false);
END;
$$;

-- Removes a whole job/technician membership. Callers MUST already hold the
-- staffing-offer advisory key and the membership row lock for the pair.
-- Mirrors remove_assignment_with_timesheets (timesheets first, then
-- membership, then non-final Hoja de Ruta staff/contact rows).
CREATE FUNCTION public.assignment_remove_membership_locked(p_job_id uuid, p_technician_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_removed public.job_assignments%ROWTYPE;
  v_deleted_timesheets integer := 0;
BEGIN
  DELETE FROM public.timesheets
  WHERE job_id = p_job_id AND technician_id = p_technician_id;
  GET DIAGNOSTICS v_deleted_timesheets = ROW_COUNT;

  DELETE FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id
  RETURNING * INTO v_removed;

  IF v_removed.id IS NOT NULL THEN
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

  RETURN pg_catalog.jsonb_build_object(
    'job_id', p_job_id,
    'deleted_timesheets', v_deleted_timesheets,
    'deleted_assignment', v_removed.id IS NOT NULL,
    'assignment', CASE WHEN v_removed.id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
      'id', v_removed.id,
      'status', v_removed.status,
      'sound_role', v_removed.sound_role,
      'lights_role', v_removed.lights_role,
      'video_role', v_removed.video_role,
      'production_role', v_removed.production_role,
      'single_day', v_removed.single_day,
      'assignment_date', v_removed.assignment_date,
      'assignment_source', v_removed.assignment_source
    ) END
  );
END;
$$;

-- Flex crew departments for a membership snapshot. Mirrors the client's
-- determineFlexDepartmentsForAssignment: sound/lights roles, falling back to
-- the technician's department when it is a Flex department.
CREATE FUNCTION public.assignment_flex_departments(p_assignment jsonb, p_fallback_department text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH from_roles AS (
    SELECT ARRAY_REMOVE(ARRAY[
      CASE WHEN COALESCE(p_assignment->>'sound_role', 'none') NOT IN ('none', '') THEN 'sound' END,
      CASE WHEN COALESCE(p_assignment->>'lights_role', 'none') NOT IN ('none', '') THEN 'lights' END
    ], NULL) AS departments
  )
  SELECT CASE
    WHEN p_assignment IS NULL THEN ARRAY[]::text[]
    WHEN COALESCE(pg_catalog.cardinality(departments), 0) > 0 THEN departments
    WHEN p_fallback_department IN ('sound', 'lights') THEN ARRAY[p_fallback_department]
    ELSE ARRAY[]::text[]
  END
  FROM from_roles;
$$;

REVOKE ALL ON FUNCTION public.assignment_command_reject(uuid, text, uuid, uuid, uuid, uuid, text, jsonb, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assignment_remove_membership_locked(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assignment_flex_departments(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_flex_departments(jsonb, text) TO service_role;

-- ---------------------------------------------------------------------------
-- apply_direct_assignment
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.apply_direct_assignment(
  p_command_id uuid,
  p_job_id uuid,
  p_technician_id uuid,
  p_role text,
  p_status text,
  p_coverage text,
  p_dates date[] DEFAULT NULL,
  p_mode text DEFAULT 'replace',
  p_expected_state_token text DEFAULT NULL,
  p_from_job_id uuid DEFAULT NULL,
  p_expected_from_state_token text DEFAULT NULL,
  p_conflict_policy text DEFAULT 'reject',
  p_source text DEFAULT 'assignment-dialog',
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_type constant text := 'apply_direct_assignment';
  v_is_service boolean := auth.role() = 'service_role';
  v_actor uuid;
  v_role text := NULLIF(pg_catalog.btrim(p_role), '');
  v_source text := COALESCE(NULLIF(pg_catalog.btrim(p_source), ''), 'assignment-dialog');
  v_req_dates date[];
  v_request jsonb;
  v_hash text;
  v_ledger public.assignment_commands%ROWTYPE;
  v_lock_job uuid;
  v_job_type text;
  v_job_start timestamptz;
  v_job_end timestamptz;
  v_department text;
  v_role_prefix text;
  v_existing public.job_assignments%ROWTYPE;
  v_prior jsonb;
  v_from_prior jsonb;
  v_dates date[];
  v_active_dates date[];
  v_modifying boolean;
  v_mode text;
  v_to_add date[];
  v_to_remove date[];
  v_hard jsonb;
  v_soft jsonb;
  v_unavailability jsonb;
  v_conflict_dates date[];
  v_conflict_override boolean := false;
  v_sound text;
  v_lights text;
  v_video text;
  v_production text;
  v_status public.assignment_status;
  v_response_time timestamptz;
  v_single_day boolean;
  v_assignment_date date;
  v_membership_changed boolean;
  v_assignment_id uuid;
  v_category text;
  v_ts_id uuid;
  v_removed jsonb;
  v_after jsonb;
  v_outcome text;
  v_side_effects jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  IF NOT (v_is_service OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_actor := CASE WHEN v_is_service THEN p_actor_id ELSE auth.uid() END;

  -- Shape validation: malformed calls are programming errors, not outcomes.
  IF p_command_id IS NULL OR p_job_id IS NULL OR p_technician_id IS NULL THEN
    RAISE EXCEPTION 'command, job and technician are required' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('invited', 'confirmed')
     OR p_coverage IS NULL OR p_coverage NOT IN ('full', 'single', 'multi')
     OR p_mode IS NULL OR p_mode NOT IN ('add', 'replace')
     OR p_conflict_policy IS NULL OR p_conflict_policy NOT IN ('reject', 'allow') THEN
    RAISE EXCEPTION 'invalid status, coverage, mode or conflict policy' USING ERRCODE = '22023';
  END IF;
  IF v_role IS NULL OR pg_catalog.length(v_role) > 64 THEN
    RAISE EXCEPTION 'a role is required' USING ERRCODE = '22023';
  END IF;
  IF p_from_job_id = p_job_id THEN
    RAISE EXCEPTION 'a move needs a different source job' USING ERRCODE = '22023';
  END IF;
  IF v_source !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  IF p_metadata IS NOT NULL AND (pg_catalog.jsonb_typeof(p_metadata) <> 'object'
     OR pg_catalog.pg_column_size(p_metadata) > 4096) THEN
    RAISE EXCEPTION 'metadata must be a small JSON object' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.array_agg(d ORDER BY d) INTO v_req_dates
  FROM (SELECT DISTINCT pg_catalog.unnest(p_dates) AS d) requested;
  IF p_coverage <> 'full' THEN
    IF pg_catalog.array_position(v_req_dates, NULL) IS NOT NULL
       OR COALESCE(pg_catalog.cardinality(v_req_dates), 0) = 0
       OR pg_catalog.cardinality(v_req_dates) > 366
       OR (p_coverage = 'single' AND pg_catalog.cardinality(v_req_dates) <> 1) THEN
      RAISE EXCEPTION 'valid coverage dates are required' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_req_dates := NULL; -- full coverage is derived from the job span below
  END IF;

  v_request := pg_catalog.jsonb_build_object(
    'job_id', p_job_id,
    'technician_id', p_technician_id,
    'role', v_role,
    'status', p_status,
    'coverage', p_coverage,
    'dates', pg_catalog.to_jsonb(v_req_dates),
    'mode', p_mode,
    'expected_state_token', p_expected_state_token,
    'from_job_id', p_from_job_id,
    'expected_from_state_token', p_expected_from_state_token,
    'conflict_policy', p_conflict_policy
  );
  v_hash := pg_catalog.md5(v_request::text);

  -- 1-2. Advisory locks: technician, then each pair sorted by job id.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'assignment-technician:' || p_technician_id::text, 0));
  FOR v_lock_job IN
    SELECT j FROM pg_catalog.unnest(ARRAY[p_job_id, p_from_job_id]) AS j
    WHERE j IS NOT NULL ORDER BY j
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'staffing-offer:' || v_lock_job::text || ':' || p_technician_id::text, 0));
  END LOOP;

  -- Idempotent replay is decided under the pair locks, so a concurrent retry of
  -- the same command waits and then sees the committed ledger row.
  SELECT * INTO v_ledger FROM public.assignment_commands WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_ledger.command_type = c_type AND v_ledger.request_hash = v_hash THEN
      RETURN v_ledger.result || pg_catalog.jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505',
      DETAIL = 'This command id was already used for a different assignment command.';
  END IF;

  -- 3. Parent rows.
  PERFORM 1 FROM public.jobs
  WHERE id IN (p_job_id, p_from_job_id) ORDER BY id FOR KEY SHARE;
  SELECT job_type, start_time, end_time INTO v_job_type, v_job_start, v_job_end
  FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, p_from_job_id,
      v_actor, v_source, v_request, v_hash, 'job_not_found', 'The job no longer exists', NULL, NULL);
  END IF;

  SELECT department INTO v_department FROM public.profiles WHERE id = p_technician_id;
  IF NOT FOUND THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, p_from_job_id,
      v_actor, v_source, v_request, v_hash, 'technician_not_found', 'The technician no longer exists', NULL, NULL);
  END IF;

  v_role_prefix := CASE v_department
    WHEN 'sound' THEN 'SND' WHEN 'lights' THEN 'LGT' WHEN 'video' THEN 'VID'
    WHEN 'production' THEN 'PROD' WHEN 'logistics' THEN 'PROD' END;
  IF v_role_prefix IS NULL
     OR (v_role ~ '^[A-Z]+-[A-Z]+-[RET]$' AND pg_catalog.split_part(v_role, '-', 1) <> v_role_prefix) THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, p_from_job_id,
      v_actor, v_source, v_request, v_hash, 'role_department_mismatch',
      'The role does not belong to the technician department',
      pg_catalog.jsonb_build_object('department', v_department, 'role', v_role), NULL);
  END IF;

  -- 4. Membership rows, sorted by job id.
  PERFORM 1 FROM public.job_assignments
  WHERE technician_id = p_technician_id AND job_id IN (p_job_id, p_from_job_id)
  ORDER BY job_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.job_assignments
  WHERE job_id = p_job_id AND technician_id = p_technician_id;

  -- Expected-state (stale tab / concurrent manager) protection.
  v_prior := public.assignment_state_snapshot(p_job_id, p_technician_id);
  IF p_expected_state_token IS NOT NULL AND p_expected_state_token <> v_prior->>'state_token' THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, p_from_job_id,
      v_actor, v_source, v_request, v_hash, 'stale_state',
      'The assignment changed after it was loaded',
      pg_catalog.jsonb_build_object('current', v_prior), v_prior->>'state_token');
  END IF;
  IF p_from_job_id IS NOT NULL THEN
    v_from_prior := public.assignment_state_snapshot(p_from_job_id, p_technician_id);
    IF p_expected_from_state_token IS NOT NULL AND p_expected_from_state_token <> v_from_prior->>'state_token' THEN
      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, p_from_job_id,
        v_actor, v_source, v_request, v_hash, 'stale_state',
        'The assignment being moved changed after it was loaded',
        pg_catalog.jsonb_build_object('current_from', v_from_prior), v_prior->>'state_token');
    END IF;
  END IF;

  -- Coverage. Full coverage is every Madrid calendar day of the job span.
  IF p_coverage = 'full' THEN
    SELECT pg_catalog.array_agg(d::date ORDER BY d) INTO v_dates
    FROM pg_catalog.generate_series(
      (v_job_start AT TIME ZONE 'Europe/Madrid')::date,
      (v_job_end AT TIME ZONE 'Europe/Madrid')::date,
      interval '1 day') AS d;
    IF COALESCE(pg_catalog.cardinality(v_dates), 0) = 0 OR pg_catalog.cardinality(v_dates) > 366 THEN
      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, p_from_job_id,
        v_actor, v_source, v_request, v_hash, 'invalid_job_span',
        'The job has no usable date span for full coverage', NULL, v_prior->>'state_token');
    END IF;
  ELSE
    v_dates := v_req_dates;
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(t.date ORDER BY t.date), ARRAY[]::date[]) INTO v_active_dates
  FROM public.timesheets t
  WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id AND t.is_active;
  v_modifying := v_existing.id IS NOT NULL OR pg_catalog.cardinality(v_active_dates) > 0;
  v_mode := CASE WHEN v_modifying THEN p_mode ELSE 'replace' END;

  SELECT COALESCE(pg_catalog.array_agg(d ORDER BY d), ARRAY[]::date[]) INTO v_to_add
  FROM pg_catalog.unnest(v_dates) AS d WHERE NOT (d = ANY (v_active_dates));
  IF v_mode = 'replace' THEN
    SELECT COALESCE(pg_catalog.array_agg(d ORDER BY d), ARRAY[]::date[]) INTO v_to_remove
    FROM pg_catalog.unnest(v_active_dates) AS d WHERE NOT (d = ANY (v_dates));
  ELSE
    v_to_remove := ARRAY[]::date[];
  END IF;

  -- Conflicts are enforced here, under the technician lock, against the dates
  -- this command newly schedules. The job being moved away from is not a
  -- conflict: it is removed in this same transaction. Hard = another active
  -- schedule whose membership is not merely invited; soft = invited.
  WITH clashes AS (
    SELECT j.id, j.title, j.start_time, j.end_time, ts.date,
           CASE WHEN ja.status = 'invited' THEN 'pending' ELSE 'confirmed' END AS kind
    FROM public.timesheets ts
    JOIN public.jobs j ON j.id = ts.job_id
    LEFT JOIN public.job_assignments ja
      ON ja.job_id = ts.job_id AND ja.technician_id = ts.technician_id
    WHERE ts.technician_id = p_technician_id
      AND ts.is_active
      AND ts.job_id <> p_job_id
      AND ts.job_id IS DISTINCT FROM p_from_job_id
      AND ts.date = ANY (v_to_add)
  ),
  per_job AS (
    SELECT id, title, start_time, end_time, kind, pg_catalog.array_agg(date ORDER BY date) AS dates
    FROM clashes GROUP BY id, title, start_time, end_time, kind
  )
  SELECT
    COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id, 'title', title, 'start_time', start_time, 'end_time', end_time,
      'status', kind, 'dates', dates) ORDER BY id) FILTER (WHERE kind = 'confirmed'), '[]'::jsonb),
    COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id, 'title', title, 'start_time', start_time, 'end_time', end_time,
      'status', kind, 'dates', dates) ORDER BY id) FILTER (WHERE kind = 'pending'), '[]'::jsonb),
    (SELECT pg_catalog.array_agg(DISTINCT c.date ORDER BY c.date) FROM clashes c)
  INTO v_hard, v_soft, v_conflict_dates
  FROM per_job;

  IF COALESCE(pg_catalog.cardinality(v_conflict_dates), 0) > 0 THEN
    IF p_conflict_policy = 'reject' THEN
      -- Same shape as check_technician_conflicts so the existing warning UI
      -- renders the authoritative result.
      SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'date', ta.date,
        'reason', CASE ta.status WHEN 'day_off' THEN 'Day Off' WHEN 'travel' THEN 'Travel'
          WHEN 'sick' THEN 'Sick' WHEN 'vacation' THEN 'Vacation' ELSE 'Unavailable' END,
        'source', 'technician_availability') ORDER BY ta.date), '[]'::jsonb)
      INTO v_unavailability
      FROM public.technician_availability ta
      WHERE ta.technician_id = p_technician_id::text AND ta.date = ANY (v_to_add);

      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, p_from_job_id,
        v_actor, v_source, v_request, v_hash, 'conflict',
        'The technician already has work on some of these dates',
        pg_catalog.jsonb_build_object(
          'target_date', v_conflict_dates[1],
          'conflict_dates', pg_catalog.to_jsonb(v_conflict_dates),
          'conflicts', pg_catalog.jsonb_build_object(
            'hasHardConflict', pg_catalog.jsonb_array_length(v_hard) > 0,
            'hasSoftConflict', pg_catalog.jsonb_array_length(v_soft) > 0,
            'hardConflicts', v_hard,
            'softConflicts', v_soft,
            'unavailabilityConflicts', v_unavailability)),
        v_prior->>'state_token');
    END IF;
    v_conflict_override := true;
  END IF;

  -- Desired membership. Role goes to the department's column only.
  v_sound := CASE WHEN v_department = 'sound' THEN v_role END;
  v_lights := CASE WHEN v_department = 'lights' THEN v_role END;
  v_video := CASE WHEN v_department = 'video' THEN v_role END;
  v_production := CASE WHEN v_department IN ('production', 'logistics') THEN v_role END;
  -- A confirmed membership is never downgraded by an invited retry.
  v_status := CASE WHEN v_existing.status = 'confirmed' THEN 'confirmed' ELSE p_status END::public.assignment_status;
  v_response_time := CASE
    WHEN v_existing.status = 'confirmed' THEN COALESCE(v_existing.response_time, pg_catalog.now())
    WHEN p_status = 'confirmed' THEN pg_catalog.now()
    ELSE NULL END;
  -- Compatibility fields: a scoped (non-full) assignment keeps its first day;
  -- adding days to an already scoped membership preserves the original day.
  v_single_day := p_coverage <> 'full';
  v_assignment_date := CASE WHEN v_single_day THEN v_dates[1] END;
  IF v_existing.id IS NOT NULL AND v_mode = 'add' AND p_coverage <> 'full'
     AND v_existing.assignment_date IS NOT NULL THEN
    v_single_day := v_existing.single_day;
    v_assignment_date := v_existing.assignment_date;
  END IF;

  v_membership_changed := v_existing.id IS NULL
    OR v_existing.status IS DISTINCT FROM v_status
    OR v_existing.sound_role IS DISTINCT FROM v_sound
    OR v_existing.lights_role IS DISTINCT FROM v_lights
    OR v_existing.video_role IS DISTINCT FROM v_video
    OR v_existing.production_role IS DISTINCT FROM v_production
    OR v_existing.single_day IS DISTINCT FROM v_single_day
    OR v_existing.assignment_date IS DISTINCT FROM v_assignment_date;

  -- ---- Writes start here: from now on failures raise and roll back. ----

  IF p_from_job_id IS NOT NULL THEN
    v_removed := public.assignment_remove_membership_locked(p_from_job_id, p_technician_id);
    IF (v_removed->>'deleted_assignment')::boolean THEN
      INSERT INTO public.assignment_audit_log (
        assignment_id, job_id, technician_id, action, previous_status, new_status,
        actor_id, metadata, deleted_timesheet_count
      ) VALUES (
        (v_removed->'assignment'->>'id')::uuid, p_from_job_id, p_technician_id, 'hard_deleted',
        v_removed->'assignment'->>'status', NULL, v_actor,
        pg_catalog.jsonb_build_object('command_id', p_command_id, 'source', v_source,
          'reason', 'moved', 'moved_to_job_id', p_job_id,
          'assignment_source', v_removed->'assignment'->>'assignment_source'),
        (v_removed->>'deleted_timesheets')::integer
      );
    END IF;
  END IF;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.job_assignments (
      job_id, technician_id, status, response_time, single_day, assignment_date,
      sound_role, lights_role, video_role, production_role,
      assigned_by, assigned_at, assignment_source
    ) VALUES (
      p_job_id, p_technician_id, v_status, v_response_time, v_single_day, v_assignment_date,
      v_sound, v_lights, v_video, v_production,
      v_actor, pg_catalog.now(), 'direct'
    ) RETURNING id INTO v_assignment_id;
  ELSE
    v_assignment_id := v_existing.id;
    IF v_membership_changed THEN
      UPDATE public.job_assignments SET
        status = v_status, response_time = v_response_time,
        single_day = v_single_day, assignment_date = v_assignment_date,
        sound_role = v_sound, lights_role = v_lights, video_role = v_video,
        production_role = v_production,
        assigned_by = v_actor, assigned_at = pg_catalog.now(), assignment_source = 'direct'
      WHERE id = v_existing.id;
    END IF;
  END IF;

  IF pg_catalog.cardinality(v_to_add) > 0 OR pg_catalog.cardinality(v_to_remove) > 0
     OR NOT v_modifying OR v_membership_changed THEN
    -- 5. Protect the technician parent before touching schedule rows, and lock
    -- the pair's existing rows (and their attribution parents) in date order.
    -- Mirrors assign_staffing_offer: never wait on a profile deletion while
    -- holding membership.
    PERFORM 1 FROM public.profiles WHERE id = p_technician_id FOR KEY SHARE NOWAIT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician profile no longer exists' USING ERRCODE = 'P0002';
    END IF;
    PERFORM 1 FROM public.timesheets t
    WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id
    ORDER BY t.date FOR UPDATE;
    PERFORM 1 FROM public.profiles p
    WHERE p.id IN (
      SELECT ref_id FROM public.timesheets t
      CROSS JOIN LATERAL pg_catalog.unnest(ARRAY[t.created_by, t.approved_by, t.rejected_by]) AS ref_id
      WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id
    )
    ORDER BY p.id FOR KEY SHARE NOWAIT;

    IF v_modifying THEN
      DELETE FROM public.timesheets
      WHERE job_id = p_job_id AND technician_id = p_technician_id AND date = ANY (v_to_remove);
    ELSE
      -- A new membership replaces any leftover (inactive) rows outside coverage.
      DELETE FROM public.timesheets
      WHERE job_id = p_job_id AND technician_id = p_technician_id AND NOT (date = ANY (v_dates));
    END IF;

    INSERT INTO public.timesheets (job_id, technician_id, date, created_by, is_schedule_only, source, is_active)
    SELECT p_job_id, p_technician_id, d, v_actor, v_job_type IN ('dryhire', 'tourdate'), v_source, true
    FROM pg_catalog.unnest(v_to_add) AS d
    ON CONFLICT (job_id, technician_id, date) DO UPDATE SET
      is_active = true,
      is_schedule_only = excluded.is_schedule_only,
      source = excluded.source,
      created_by = COALESCE(excluded.created_by, timesheets.created_by);

    -- Reactivated drafts may have missed prep-day repricing while inactive.
    UPDATE public.timesheets t SET updated_at = pg_catalog.now()
    WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id
      AND t.date = ANY (v_to_add) AND t.approved_by_manager IS NOT TRUE
      AND t.start_time IS NOT NULL AND t.end_time IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.job_date_types jdt
                  WHERE jdt.job_id = t.job_id AND jdt.date = t.date AND jdt.type = 'prep_day');

    -- Category follows the role (formerly syncTimesheetCategoriesForAssignment,
    -- a separate best-effort browser step). Approved rows are left untouched.
    v_category := CASE
      WHEN pg_catalog.upper(v_role) ~ '^[A-Z]{3}-[A-Z]+-[RET]$' THEN
        CASE pg_catalog.right(pg_catalog.upper(v_role), 1)
          WHEN 'R' THEN 'responsable' WHEN 'E' THEN 'especialista' ELSE 'tecnico' END
    END;
    IF v_category IS NOT NULL THEN
      FOR v_ts_id IN
        UPDATE public.timesheets t SET category = v_category
        WHERE t.job_id = p_job_id AND t.technician_id = p_technician_id AND t.is_active
          AND t.category IS DISTINCT FROM v_category
          AND t.approved_by_manager IS NOT TRUE AND t.status <> 'approved'
        RETURNING t.id
      LOOP
        -- Repricing is derived data (e.g. a missing rate card raises). It must
        -- not decide whether the assignment commits, so each row is isolated
        -- and failures are reported for follow-up instead.
        BEGIN
          PERFORM public.compute_timesheet_amount_2025(v_ts_id, true);
        EXCEPTION WHEN OTHERS THEN
          v_warnings := v_warnings || pg_catalog.jsonb_build_object(
            'kind', 'timesheet_repricing_failed', 'timesheet_id', v_ts_id, 'message', SQLERRM);
        END;
      END LOOP;
    END IF;
  END IF;

  v_after := public.assignment_state_snapshot(p_job_id, p_technician_id);
  v_outcome := CASE
    WHEN v_removed IS NULL AND v_after->>'state_token' = v_prior->>'state_token' THEN 'noop'
    ELSE 'committed' END;

  IF v_outcome = 'committed' THEN
    INSERT INTO public.assignment_audit_log (
      assignment_id, job_id, technician_id, action, previous_status, new_status, actor_id, metadata
    ) VALUES (
      v_assignment_id, p_job_id, p_technician_id,
      CASE WHEN v_existing.id IS NULL THEN 'direct_assigned' ELSE 'direct_updated' END,
      v_existing.status::text, v_status::text, v_actor,
      COALESCE(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'command_id', p_command_id, 'source', v_source, 'coverage', p_coverage, 'mode', v_mode,
        'added_dates', pg_catalog.to_jsonb(v_to_add), 'removed_dates', pg_catalog.to_jsonb(v_to_remove),
        'moved_from_job_id', p_from_job_id, 'conflict_override', v_conflict_override)
    );

    -- Post-commit plan. Flex add is idempotent; the client executes the plan
    -- and reports per-effect outcomes via record_assignment_side_effects.
    SELECT COALESCE(pg_catalog.jsonb_agg(effect ORDER BY ord), '[]'::jsonb) INTO v_side_effects
    FROM (
      SELECT 1 AS ord, pg_catalog.jsonb_build_object('kind', 'flex', 'action', 'remove',
        'job_id', p_from_job_id, 'department', dept, 'status', 'pending') AS effect
      FROM pg_catalog.unnest(public.assignment_flex_departments(v_removed->'assignment', v_department)) AS dept
      WHERE (v_removed->>'deleted_assignment')::boolean
      UNION ALL
      SELECT 2, pg_catalog.jsonb_build_object('kind', 'flex', 'action', 'add',
        'job_id', p_job_id, 'department', dept, 'status', 'pending')
      FROM pg_catalog.unnest(ARRAY_REMOVE(ARRAY[
        CASE WHEN v_sound IS NOT NULL THEN 'sound' END,
        CASE WHEN v_lights IS NOT NULL THEN 'lights' END], NULL)) AS dept
      UNION ALL
      SELECT 3, pg_catalog.jsonb_build_object('kind', 'notification', 'action', 'job.assignment.direct',
        'job_id', p_job_id, 'status', 'pending')
    ) effects;
  END IF;

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
    'coverage', p_coverage,
    'mode', v_mode,
    'added_dates', pg_catalog.to_jsonb(v_to_add),
    'removed_dates', pg_catalog.to_jsonb(v_to_remove),
    'moved_from', v_removed,
    'conflict_override', v_conflict_override,
    'side_effects', v_side_effects,
    'warnings', v_warnings
  );

  INSERT INTO public.assignment_commands (
    command_id, command_type, job_id, technician_id, from_job_id, actor_id, source,
    request_hash, request, outcome, prior_state_token, result_state_token, result,
    side_effects, side_effects_status, side_effects_updated_at
  ) VALUES (
    p_command_id, c_type, p_job_id, p_technician_id, p_from_job_id, v_actor, v_source,
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

REVOKE ALL ON FUNCTION public.apply_direct_assignment(uuid, uuid, uuid, text, text, text, date[], text, text, uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_direct_assignment(uuid, uuid, uuid, text, text, text, date[], text, text, uuid, text, text, text, uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.apply_direct_assignment(uuid, uuid, uuid, text, text, text, date[], text, text, uuid, text, text, text, uuid, jsonb) IS
  'Atomic direct assignment (create/modify/move) for admin/management: locks, expected-state check, conflict enforcement, membership + schedule + category in one transaction, idempotent by command id. Returns {ok, outcome, code?, ...}.';
