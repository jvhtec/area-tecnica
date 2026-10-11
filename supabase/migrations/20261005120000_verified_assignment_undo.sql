-- PR995: the eight-second undo hold belongs to the server, and the inverse,
-- exact restoration check, relationship and effect cancellation share one TX.
-- No historical window backfill. Existing RPC local return packets are unchanged.
ALTER TABLE public.assignment_commands
  ADD COLUMN undo_expires_at timestamptz,
  ADD COLUMN effects_claimed_at timestamptz,
  ADD COLUMN undone_by_command_id uuid UNIQUE REFERENCES public.assignment_commands(command_id) ON DELETE SET NULL;
COMMENT ON COLUMN public.assignment_commands.undone_by_command_id IS
  'Verified inverse ID, written atomically by undo_assignment_command; null for commands never undone.';
ALTER TABLE public.assignment_commands DROP CONSTRAINT assignment_commands_command_type_check;
ALTER TABLE public.assignment_commands ADD CONSTRAINT assignment_commands_command_type_check CHECK (command_type IN (
  'apply_direct_assignment', 'remove_direct_assignment', 'remove_assignment_date',
  'change_assignment_role', 'set_assignment_status', 'unconfirm_assignment', 'undo_assignment_command'));

CREATE TABLE public.assignment_command_undos (
  original_command_id uuid PRIMARY KEY REFERENCES public.assignment_commands(command_id) ON DELETE CASCADE,
  inverse_command_id uuid NOT NULL UNIQUE REFERENCES public.assignment_commands(command_id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  request jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (original_command_id <> inverse_command_id)
);
ALTER TABLE public.assignment_command_undos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment_command_undos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.assignment_command_undos TO service_role;
COMMENT ON TABLE public.assignment_command_undos IS
  'Server-verified original/inverse relationship. Only atomic undo writes this link; callers cannot manufacture it.';

CREATE FUNCTION public.assignment_command_undo_hold() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.undo_expires_at := NULL;
    NEW.effects_claimed_at := NULL;
    IF NEW.outcome = 'committed'
       AND NEW.source IN ('matrix-inspector', 'matrix-focus', 'matrix-batch', 'matrix-keyboard')
       AND ((NEW.command_type = 'apply_direct_assignment' AND NEW.from_job_id IS NULL
             AND NEW.request->>'from_job_id' IS NULL)
         OR NEW.command_type = 'change_assignment_role'
         OR (NEW.command_type = 'set_assignment_status' AND NEW.request->>'action' = 'confirm')) THEN
      NEW.undo_expires_at := pg_catalog.clock_timestamp() + interval '8 seconds';
    END IF;
  ELSE
    -- Claim/report helpers can remove lease fields, but cannot erase history.
    NEW.effects_claimed_at := OLD.effects_claimed_at;
  END IF;
  IF NEW.effects_claimed_at IS NULL AND EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.side_effects) e
    WHERE e->>'claim_token' IS NOT NULL OR e->>'claimed_until' IS NOT NULL
       OR COALESCE((e->>'attempts')::integer, 0) > 0 OR e->>'status' IN ('failed', 'succeeded')) THEN
    NEW.effects_claimed_at := pg_catalog.clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assignment_command_undo_hold() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assignment_command_undo_hold BEFORE INSERT OR UPDATE ON public.assignment_commands
FOR EACH ROW EXECUTE FUNCTION public.assignment_command_undo_hold();

-- Shares the EXACT token projection of assignment_state_snapshot. Ignore the
-- supplied state_token and identity/provenance; never use them to authorize.
CREATE FUNCTION public.assignment_undo_normalize_snapshot(p_state jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_assignment jsonb;
  v_dates jsonb;
BEGIN
  IF p_state IS NULL OR pg_catalog.jsonb_typeof(p_state) <> 'object'
     OR pg_catalog.jsonb_typeof(p_state->'dates') IS DISTINCT FROM 'array'
     OR NOT (p_state ? 'assignment')
     OR pg_catalog.jsonb_typeof(p_state->'assignment') NOT IN ('object', 'null')
     OR pg_catalog.jsonb_typeof(p_state->'exists') IS DISTINCT FROM 'boolean'
     OR (p_state->>'exists')::boolean IS DISTINCT FROM (p_state->'assignment' <> 'null'::jsonb)
     OR pg_catalog.pg_column_size(p_state) > 32768 THEN
    RAISE EXCEPTION 'invalid prior snapshot' USING ERRCODE = '22023';
  END IF;
  IF p_state->'assignment' <> 'null'::jsonb THEN
    v_assignment := pg_catalog.jsonb_build_object(
      'status', p_state->'assignment'->>'status',
      'sound_role', p_state->'assignment'->>'sound_role',
      'lights_role', p_state->'assignment'->>'lights_role',
      'video_role', p_state->'assignment'->>'video_role',
      'production_role', p_state->'assignment'->>'production_role',
      'single_day', (p_state->'assignment'->>'single_day')::boolean,
      'assignment_date', (p_state->'assignment'->>'assignment_date')::date);
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(d ORDER BY d), '[]'::jsonb) INTO v_dates
  FROM (SELECT DISTINCT value::date AS d FROM pg_catalog.jsonb_array_elements_text(p_state->'dates')) s;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'dates') d
             WHERE pg_catalog.jsonb_typeof(d) <> 'string') THEN
    RAISE EXCEPTION 'invalid prior snapshot' USING ERRCODE = '22023';
  END IF;
  RETURN pg_catalog.jsonb_build_object('membership', v_assignment, 'dates', v_dates);
END;
$$;
REVOKE ALL ON FUNCTION public.assignment_undo_normalize_snapshot(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.assignment_command_has_unrun_effects(p_command public.assignment_commands)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (p_command).effects_claimed_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements((p_command).side_effects) e
    WHERE e->>'status' IS DISTINCT FROM 'pending'
      OR e->>'claim_token' IS NOT NULL OR e->>'claimed_until' IS NOT NULL
      OR COALESCE((e->>'attempts')::integer, 0) <> 0);
$$;
REVOKE ALL ON FUNCTION public.assignment_command_has_unrun_effects(public.assignment_commands) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_assignment_command_undo_window(p_command_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_command public.assignment_commands%ROWTYPE;
  v_eligible boolean;
BEGIN
  IF (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL
      AND public.is_admin_or_management() IS TRUE)) IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_command FROM public.assignment_commands WHERE command_id = p_command_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown assignment command' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND v_command.actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_eligible := COALESCE(v_command.undo_expires_at > pg_catalog.clock_timestamp(), false)
    AND v_command.outcome = 'committed'
    AND public.assignment_command_has_unrun_effects(v_command)
    AND NOT EXISTS (SELECT 1 FROM public.assignment_command_undos
                    WHERE original_command_id = p_command_id OR inverse_command_id = p_command_id)
    AND public.assignment_state_token(v_command.job_id, v_command.technician_id) = v_command.result_state_token;
  RETURN pg_catalog.jsonb_build_object('undo_expires_at', v_command.undo_expires_at, 'eligible', COALESCE(v_eligible, false));
END;
$$;
REVOKE ALL ON FUNCTION public.get_assignment_command_undo_window(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_command_undo_window(uuid) TO authenticated, service_role;

CREATE FUNCTION public.release_assignment_command_effects(p_command_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_command public.assignment_commands%ROWTYPE;
BEGIN
  IF (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL
      AND public.is_admin_or_management() IS TRUE)) IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_command FROM public.assignment_commands WHERE command_id = p_command_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown assignment command' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND v_command.actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assignment_command_undos
                WHERE original_command_id = p_command_id OR inverse_command_id = p_command_id) THEN
    RETURN pg_catalog.jsonb_build_object('released', false);
  END IF;
  UPDATE public.assignment_commands SET undo_expires_at = LEAST(undo_expires_at, pg_catalog.clock_timestamp())
  WHERE command_id = p_command_id;
  RETURN pg_catalog.jsonb_build_object('released', true);
END;
$$;
REVOKE ALL ON FUNCTION public.release_assignment_command_effects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_assignment_command_effects(uuid) TO authenticated, service_role;

-- Preserve ordinary compensation; atomic undo cancels this plan in its TX.
CREATE OR REPLACE FUNCTION public.unconfirm_assignment(
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
  c_type constant text := 'unconfirm_assignment';
  v_is_service boolean := COALESCE(auth.role() = 'service_role', false);
  v_actor uuid;
  v_source text := COALESCE(NULLIF(pg_catalog.btrim(p_source), ''), 'matrix');
  v_request jsonb;
  v_hash text;
  v_ledger public.assignment_commands%ROWTYPE;
  v_existing public.job_assignments%ROWTYPE;
  v_prior jsonb;
  v_after jsonb;
  v_job_type text;
  v_approved date[];
  v_outcome text;
  v_result jsonb;
  v_side_effects jsonb := '[]'::jsonb;
BEGIN
  IF (v_is_service OR (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL
      AND public.is_admin_or_management() IS TRUE)) IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  v_actor := CASE WHEN v_is_service THEN p_actor_id ELSE auth.uid() END;
  IF p_command_id IS NULL OR p_job_id IS NULL OR p_technician_id IS NULL THEN
    RAISE EXCEPTION 'command, job and technician are required' USING ERRCODE = '22023';
  END IF;
  IF v_source !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  -- Interactive callers must say which state they decided on: the state right
  -- after the confirm they are taking back.
  IF NOT v_is_service AND p_expected_state_token IS NULL THEN
    RAISE EXCEPTION 'an expected state token is required' USING ERRCODE = '22023';
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

  -- Only a confirmation can be taken back. A decline is final for this
  -- command: undoing it would resurrect a tour membership that was deleted.
  IF v_existing.status IS DISTINCT FROM 'confirmed' AND v_existing.status IS DISTINCT FROM 'invited' THEN
    RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
      v_actor, v_source, v_request, v_hash, 'invalid_transition',
      'Only a confirmed assignment can go back to invited',
      pg_catalog.jsonb_build_object('status', v_existing.status), v_prior->>'state_token');
  END IF;

  IF v_existing.status = 'invited' THEN
    v_outcome := 'noop';
  ELSE
    -- Approved days are financial records: never reopen a confirmation that
    -- already carries an approved timesheet.
    v_approved := public.assignment_approved_dates(p_job_id, p_technician_id, NULL);
    IF pg_catalog.cardinality(v_approved) > 0 THEN
      RETURN public.assignment_command_reject(p_command_id, c_type, p_job_id, p_technician_id, NULL,
        v_actor, v_source, v_request, v_hash, 'approved_timesheet',
        'Approved timesheets block reopening a confirmation',
        pg_catalog.jsonb_build_object('job_id', p_job_id, 'dates', pg_catalog.to_jsonb(v_approved)),
        v_prior->>'state_token');
    END IF;

    -- ---- Writes start here. ----
    UPDATE public.job_assignments SET status = 'invited', response_time = NULL
    WHERE id = v_existing.id;

    INSERT INTO public.assignment_audit_log (
      assignment_id, job_id, technician_id, action, previous_status, new_status, actor_id, metadata
    ) VALUES (
      v_existing.id, p_job_id, p_technician_id, 'unconfirmed',
      'confirmed', 'invited', v_actor,
      COALESCE(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'command_id', p_command_id, 'source', v_source)
    );
    v_outcome := 'committed';
  END IF;

  IF v_outcome = 'committed' THEN
    v_side_effects := public.assignment_effects_with_ids(p_command_id,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'kind', 'notification', 'action', 'job.assignment.invited',
        'job_id', p_job_id, 'status', 'pending')));
  END IF;
  v_after := public.assignment_state_snapshot(p_job_id, p_technician_id);
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome', v_outcome, 'command_id', p_command_id,
    'job_id', p_job_id, 'technician_id', p_technician_id,
    'assignment', v_after->'assignment', 'dates', v_after->'dates',
    'state_token', v_after->>'state_token', 'prior_state_token', v_prior->>'state_token',
    'side_effects', v_side_effects, 'warnings', '[]'::jsonb);

  INSERT INTO public.assignment_commands (
    command_id, command_type, job_id, technician_id, actor_id, source,
    request_hash, request, outcome, prior_state_token, result_state_token, result,
    side_effects, side_effects_status, side_effects_updated_at
  ) VALUES (
    p_command_id, c_type, p_job_id, p_technician_id, v_actor, v_source,
    v_hash, v_request, v_outcome, v_prior->>'state_token', v_after->>'state_token', v_result,
    v_side_effects, CASE WHEN pg_catalog.jsonb_array_length(v_side_effects) > 0 THEN 'pending' ELSE 'none' END, pg_catalog.now()
  ) ON CONFLICT (command_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505',
      DETAIL = 'This command id was already used for a different assignment command.';
  END IF;

  RETURN v_result || pg_catalog.jsonb_build_object('replayed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_assignment_side_effects(
  p_command_id uuid,
  p_lease_seconds integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_command public.assignment_commands%ROWTYPE;
  v_token uuid := gen_random_uuid();
  v_until timestamptz;
  v_effects jsonb;
  v_claimed jsonb;
BEGIN
  IF (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL
      AND public.is_admin_or_management() IS TRUE)) IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 10 AND 900 THEN
    RAISE EXCEPTION 'a command id and a lease of 10-900 seconds are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_command FROM public.assignment_commands
  WHERE command_id = p_command_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown assignment command' USING ERRCODE = 'P0002';
  END IF;

  -- The hold is checked under the same ledger lock as claims and undo.
  IF v_command.undo_expires_at > pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('command_id', p_command_id, 'claim_token', NULL, 'effects', '[]'::jsonb);
  END IF;
  v_until := pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => p_lease_seconds);

  SELECT COALESCE(pg_catalog.jsonb_agg(
           CASE WHEN eligible THEN effect || pg_catalog.jsonb_build_object(
                  'claim_token', v_token, 'claimed_until', v_until)
                ELSE effect END ORDER BY ord), '[]'::jsonb),
         COALESCE(pg_catalog.jsonb_agg(effect || pg_catalog.jsonb_build_object('index', ord - 1) ORDER BY ord)
                    FILTER (WHERE eligible), '[]'::jsonb)
    INTO v_effects, v_claimed
  FROM (
    SELECT e.effect, e.ord,
           e.effect->>'status' IN ('pending', 'failed')
             AND (e.effect->>'claimed_until' IS NULL OR (e.effect->>'claimed_until')::timestamptz < pg_catalog.clock_timestamp())
             AS eligible
    FROM pg_catalog.jsonb_array_elements(v_command.side_effects) WITH ORDINALITY AS e(effect, ord)
  ) effects;

  IF pg_catalog.jsonb_array_length(v_claimed) > 0 THEN
    UPDATE public.assignment_commands
    SET side_effects = v_effects, side_effects_updated_at = pg_catalog.clock_timestamp()
    WHERE command_id = p_command_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'command_id', p_command_id,
    'claim_token', CASE WHEN pg_catalog.jsonb_array_length(v_claimed) > 0 THEN v_token END,
    'effects', v_claimed);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_assignment_side_effects(
  p_command_id uuid,
  p_claim_token uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_command public.assignment_commands%ROWTYPE;
  v_effects jsonb;
  v_item jsonb;
  v_index integer;
  v_status text;
  v_overall text;
  v_ignored jsonb := '[]'::jsonb;
BEGIN
  IF (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL
      AND public.is_admin_or_management() IS TRUE)) IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_claim_token IS NULL OR p_results IS NULL
     OR pg_catalog.jsonb_typeof(p_results) <> 'array' OR pg_catalog.jsonb_array_length(p_results) > 32 THEN
    RAISE EXCEPTION 'a command id, a claim token and an array of results are required' USING ERRCODE = '22023';
  END IF;
  -- One outcome per effect per report: a repeated index could overwrite a
  -- failure with a success and double-count attempts.
  IF (SELECT pg_catalog.count(*) <> pg_catalog.count(DISTINCT e->>'index')
      FROM pg_catalog.jsonb_array_elements(p_results) AS e) THEN
    RAISE EXCEPTION 'invalid side-effect result' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_command FROM public.assignment_commands
  WHERE command_id = p_command_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown assignment command' USING ERRCODE = 'P0002';
  END IF;
  v_effects := v_command.side_effects;

  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_results) LOOP
    v_index := (v_item->>'index')::integer;
    v_status := v_item->>'status';
    IF v_index IS NULL OR v_index < 0 OR v_index >= pg_catalog.jsonb_array_length(v_effects)
       OR v_status IS NULL OR v_status NOT IN ('succeeded', 'failed') THEN
      RAISE EXCEPTION 'invalid side-effect result' USING ERRCODE = '22023';
    END IF;
    -- Only the current claim holder may report; a runner whose lease expired
    -- and was re-claimed by someone else is ignored rather than trusted.
    IF v_effects->v_index->>'status' = 'superseded'
       OR (v_effects->v_index->>'claim_token') IS DISTINCT FROM p_claim_token::text THEN
      v_ignored := v_ignored || pg_catalog.to_jsonb(v_index);
      CONTINUE;
    END IF;
    v_effects := pg_catalog.jsonb_set(v_effects, ARRAY[v_index::text],
      ((v_effects->v_index) - ARRAY['claim_token', 'claimed_until']::text[]) || pg_catalog.jsonb_build_object(
        'status', v_status,
        'attempts', COALESCE((v_effects->v_index->>'attempts')::integer, 0) + 1,
        'last_error', CASE WHEN v_status = 'failed'
          THEN pg_catalog.left(COALESCE(v_item->>'error', 'unknown error'), 500) END,
        'updated_at', pg_catalog.now()));
  END LOOP;

  SELECT CASE
    WHEN pg_catalog.jsonb_array_length(v_effects) = 0 THEN 'none'
    WHEN bool_and(e->>'status' = 'superseded') THEN 'superseded'
    WHEN bool_and(e->>'status' IN ('succeeded', 'superseded')) THEN 'succeeded'
    WHEN bool_or(e->>'status' = 'failed') THEN 'failed'
    ELSE 'pending' END
  INTO v_overall
  FROM pg_catalog.jsonb_array_elements(v_effects) AS e;
  v_overall := COALESCE(v_overall, 'none');

  UPDATE public.assignment_commands
  SET side_effects = v_effects, side_effects_status = v_overall, side_effects_updated_at = pg_catalog.now()
  WHERE command_id = p_command_id;

  RETURN pg_catalog.jsonb_build_object('command_id', p_command_id, 'side_effects', v_effects,
    'side_effects_status', v_overall, 'ignored_indexes', v_ignored);
END;
$$;

CREATE OR REPLACE FUNCTION public.supersede_assignment_side_effects(p_command_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_command public.assignment_commands%ROWTYPE;
  v_effects jsonb;
  v_count integer;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL
      AND public.is_admin_or_management() IS TRUE)) IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_command_ids IS NULL OR pg_catalog.cardinality(p_command_ids) NOT BETWEEN 1 AND 32
     OR pg_catalog.array_position(p_command_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'between 1 and 32 command ids are required' USING ERRCODE = '22023';
  END IF;
  FOR v_id IN SELECT DISTINCT x FROM pg_catalog.unnest(p_command_ids) x ORDER BY x LOOP
    SELECT * INTO v_command FROM public.assignment_commands WHERE command_id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'unknown assignment command' USING ERRCODE = 'P0002'; END IF;
    IF auth.role() <> 'service_role' AND v_command.actor_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
    -- Even service callers need a verified relationship; this RPC never creates
    -- one, and a stale/failed/expired claim is still evidence effects ran.
    IF NOT EXISTS (SELECT 1 FROM public.assignment_command_undos
                   WHERE original_command_id = v_id OR inverse_command_id = v_id)
       OR v_command.effects_claimed_at IS NOT NULL OR EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_array_elements(v_command.side_effects) e
         WHERE e->>'status' NOT IN ('pending', 'superseded')
            OR e->>'status' IS NULL OR e->>'claim_token' IS NOT NULL OR e->>'claimed_until' IS NOT NULL
            OR COALESCE((e->>'attempts')::integer, 0) <> 0) THEN
      RAISE EXCEPTION 'verified unclaimed undo required' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(pg_catalog.jsonb_agg(e || pg_catalog.jsonb_build_object(
      'status', 'superseded', 'superseded_at', COALESCE(e->'superseded_at', pg_catalog.to_jsonb(pg_catalog.clock_timestamp())))
      ORDER BY ord), '[]'::jsonb), count(*) FILTER (WHERE e->>'status' = 'pending')
    INTO v_effects, v_count FROM pg_catalog.jsonb_array_elements(v_command.side_effects) WITH ORDINALITY s(e, ord);
    UPDATE public.assignment_commands SET side_effects = v_effects,
      side_effects_status = CASE WHEN pg_catalog.jsonb_array_length(v_effects) = 0 THEN 'none' ELSE 'superseded' END,
      side_effects_updated_at = pg_catalog.clock_timestamp(),
      result = result || pg_catalog.jsonb_build_object('side_effects', v_effects)
    WHERE command_id = v_id;
    v_total := v_total + v_count;
    v_items := v_items || pg_catalog.jsonb_build_object('command_id', v_id, 'superseded', v_count, 'not_superseded', 0);
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('superseded', v_total, 'not_superseded', 0, 'commands', v_items);
END;
$$;

CREATE FUNCTION public.undo_assignment_command(
  p_command_id uuid, p_original_command_id uuid, p_expected_state_token text, p_prior_state jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_original public.assignment_commands%ROWTYPE;
  v_inverse public.assignment_commands%ROWTYPE;
  v_link public.assignment_command_undos%ROWTYPE;
  v_normal jsonb;
  v_prior_token text;
  v_request jsonb;
  v_hash text;
  v_current jsonb;
  v_result jsonb;
  v_department text;
  v_role text;
  v_dates date[];
  v_coverage text;
  v_approved date[];
  v_code text;
  v_message text;
BEGIN
  IF (auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL
      AND public.is_admin_or_management() IS TRUE)) IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_original_command_id IS NULL OR p_expected_state_token IS NULL
     OR p_command_id = p_original_command_id THEN
    RAISE EXCEPTION 'distinct command ids and expected state token are required' USING ERRCODE = '22023';
  END IF;
  v_normal := public.assignment_undo_normalize_snapshot(p_prior_state);
  v_prior_token := pg_catalog.md5(v_normal::text);
  v_request := pg_catalog.jsonb_build_object('original_command_id', p_original_command_id,
    'expected_state_token', p_expected_state_token, 'prior_state', v_normal);
  v_hash := pg_catalog.md5(v_request::text);

  -- A durable inverse is immutable and needs no current-state locks to replay.
  -- Authenticate its author before this fast path; mutations still take the
  -- canonical assignment locks before the ledger lock below.
  SELECT * INTO v_original FROM public.assignment_commands WHERE command_id = p_original_command_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown assignment command' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND v_original.actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_link FROM public.assignment_command_undos WHERE original_command_id = p_original_command_id;
  IF FOUND THEN
    IF v_link.inverse_command_id = p_command_id AND v_link.request_hash = v_hash AND v_link.request = v_request THEN
      SELECT * INTO v_inverse FROM public.assignment_commands WHERE command_id = p_command_id;
      RETURN v_inverse.result || pg_catalog.jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'assignment-technician:' || v_original.technician_id::text, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'staffing-offer:' || v_original.job_id::text || ':' || v_original.technician_id::text, 0));
  PERFORM 1 FROM public.jobs WHERE id = v_original.job_id FOR KEY SHARE;
  PERFORM 1 FROM public.job_assignments
  WHERE job_id = v_original.job_id AND technician_id = v_original.technician_id FOR UPDATE;
  PERFORM 1 FROM public.profiles WHERE id = v_original.technician_id FOR KEY SHARE NOWAIT;
  PERFORM 1 FROM public.timesheets t
  WHERE t.job_id = v_original.job_id AND t.technician_id = v_original.technician_id ORDER BY t.date FOR UPDATE;
  PERFORM 1 FROM public.profiles p WHERE p.id IN (
    SELECT ref_id FROM public.timesheets t CROSS JOIN LATERAL
      pg_catalog.unnest(ARRAY[t.created_by, t.approved_by, t.rejected_by]) ref_id
    WHERE t.job_id = v_original.job_id AND t.technician_id = v_original.technician_id
  ) ORDER BY p.id FOR KEY SHARE NOWAIT;
  SELECT * INTO v_original FROM public.assignment_commands WHERE command_id = p_original_command_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown assignment command' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND v_original.actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  -- Durable successful replay precedes every current-state/deadline check.
  SELECT * INTO v_link FROM public.assignment_command_undos WHERE original_command_id = p_original_command_id;
  IF FOUND THEN
    IF v_link.inverse_command_id = p_command_id AND v_link.request_hash = v_hash AND v_link.request = v_request THEN
      SELECT * INTO v_inverse FROM public.assignment_commands WHERE command_id = p_command_id;
      RETURN v_inverse.result || pg_catalog.jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO v_inverse FROM public.assignment_commands WHERE command_id = p_command_id;
  IF FOUND THEN
    IF v_inverse.command_type = 'undo_assignment_command' AND v_inverse.actor_id IS NOT DISTINCT FROM v_original.actor_id
       AND v_inverse.request_hash = v_hash AND v_inverse.request = v_request THEN
      RETURN v_inverse.result || pg_catalog.jsonb_build_object('replayed', true);
    END IF;
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505';
  END IF;
  v_current := public.assignment_state_snapshot(v_original.job_id, v_original.technician_id);
  IF v_original.outcome <> 'committed' OR v_original.undo_expires_at IS NULL
     OR v_original.undo_expires_at <= pg_catalog.clock_timestamp()
     OR NOT public.assignment_command_has_unrun_effects(v_original)
     OR EXISTS (SELECT 1 FROM public.assignment_command_undos WHERE inverse_command_id = p_original_command_id)
     OR v_original.source NOT IN ('matrix-inspector', 'matrix-focus', 'matrix-batch', 'matrix-keyboard')
     OR NOT ((v_original.command_type = 'apply_direct_assignment' AND v_original.from_job_id IS NULL
               AND v_original.request->>'from_job_id' IS NULL)
          OR v_original.command_type = 'change_assignment_role'
          OR (v_original.command_type = 'set_assignment_status' AND v_original.request->>'action' = 'confirm')) THEN
    v_code := 'invalid_transition'; v_message := 'The command is no longer eligible for undo';
  ELSIF v_prior_token IS DISTINCT FROM v_original.prior_state_token THEN
    v_code := 'invalid_transition'; v_message := 'The prior snapshot does not match the original decision';
  ELSIF p_expected_state_token IS DISTINCT FROM v_original.result_state_token
     OR p_expected_state_token IS DISTINCT FROM v_current->>'state_token' THEN
    v_code := 'stale_state'; v_message := 'The assignment changed after the original command';
  END IF;
  IF v_code IS NULL THEN
    v_approved := public.assignment_approved_dates(v_original.job_id, v_original.technician_id, NULL);
    IF pg_catalog.cardinality(v_approved) > 0 THEN
      v_code := 'approved_timesheet'; v_message := 'Approved timesheets block undo';
    END IF;
  END IF;
  IF v_code IS NOT NULL THEN
    RETURN public.assignment_command_reject(p_command_id, 'undo_assignment_command',
      v_original.job_id, v_original.technician_id, NULL, v_original.actor_id, 'matrix-undo',
      v_request, v_hash, v_code, v_message, NULL, v_current->>'state_token');
  END IF;

  -- A subtransaction is essential: a plausible inverse can still fail exact
  -- restoration (confirmed downgrade, legacy compatibility fields, multi-role
  -- membership, orphan schedule). Roll back ALL inverse writes/audit/ledger.
  BEGIN
    IF v_original.command_type = 'set_assignment_status'
       OR (v_original.command_type = 'apply_direct_assignment'
           AND v_normal->'membership'->>'status' = 'invited'
           AND v_current->'assignment'->>'status' = 'confirmed'
           AND public.assignment_undo_normalize_snapshot(pg_catalog.jsonb_set(
             v_current, '{assignment,status}', '"invited"'::jsonb)) = v_normal) THEN
      -- apply preserves confirmed status. Only a pure status upgrade can use
      -- unconfirm as its single inverse; role/coverage changes remain refused.
      v_result := public.unconfirm_assignment(p_command_id, v_original.job_id, v_original.technician_id,
        p_expected_state_token, 'matrix-undo', v_original.actor_id);
    ELSIF v_original.command_type = 'change_assignment_role' THEN
      v_department := v_original.request->>'department';
      v_result := public.change_assignment_role(p_command_id, v_original.job_id, v_original.technician_id,
        v_department, v_normal->'membership'->>(v_department || '_role'),
        COALESCE((v_original.request->>'sync_category')::boolean, true), p_expected_state_token,
        'matrix-undo', v_original.actor_id);
    ELSIF v_normal->'membership' = 'null'::jsonb THEN
      v_result := public.remove_direct_assignment(p_command_id, v_original.job_id, v_original.technician_id,
        p_expected_state_token, 'matrix-undo', v_original.actor_id);
    ELSE
      SELECT public.assignment_role_discipline(department) INTO v_department
      FROM public.profiles WHERE id = v_original.technician_id;
      v_role := v_normal->'membership'->>(v_department || '_role');
      IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unsupported prior role' USING ERRCODE = 'P9950';
      END IF;
      v_dates := ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v_normal->'dates')::date);
      v_coverage := CASE WHEN (v_normal->'membership'->>'single_day')::boolean
                        THEN CASE WHEN pg_catalog.cardinality(v_dates) = 1 THEN 'single' ELSE 'multi' END ELSE 'full' END;
      v_result := public.apply_direct_assignment(p_command_id, v_original.job_id, v_original.technician_id,
        v_role, v_normal->'membership'->>'status', v_coverage, v_dates, 'replace',
        p_expected_state_token, NULL, NULL, 'reject', 'matrix-undo', v_original.actor_id);
    END IF;
    IF (v_result->>'ok')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'Inverse rejected' USING ERRCODE = 'P9950';
    END IF;
    IF public.assignment_state_token(v_original.job_id, v_original.technician_id) IS DISTINCT FROM v_original.prior_state_token
       OR v_result->>'state_token' IS DISTINCT FROM v_original.prior_state_token THEN
      v_result := NULL;
      RAISE EXCEPTION 'Inverse did not exactly restore prior decision' USING ERRCODE = 'P9950';
    END IF;
    INSERT INTO public.assignment_command_undos(original_command_id, inverse_command_id, request_hash, request)
    VALUES(p_original_command_id, p_command_id, v_hash, v_request);
    -- Both plans become terminal before either can be observed by a claimant.
    PERFORM public.supersede_assignment_side_effects(ARRAY[p_original_command_id, p_command_id]);
    UPDATE public.assignment_commands SET undo_expires_at = LEAST(undo_expires_at, pg_catalog.clock_timestamp()),
      undone_by_command_id = p_command_id
    WHERE command_id = p_original_command_id;
    SELECT result INTO v_result FROM public.assignment_commands WHERE command_id = p_command_id;
  EXCEPTION WHEN SQLSTATE 'P9950' OR invalid_parameter_value THEN
    v_code := CASE WHEN v_result->>'code' IN ('stale_state', 'approved_timesheet')
                   THEN v_result->>'code' ELSE 'invalid_transition' END;
    RETURN public.assignment_command_reject(p_command_id, 'undo_assignment_command',
      v_original.job_id, v_original.technician_id, NULL, v_original.actor_id, 'matrix-undo',
      v_request, v_hash, v_code, 'The inverse cannot exactly restore the prior decision',
      NULL, v_current->>'state_token');
  END;
  RETURN v_result || pg_catalog.jsonb_build_object('replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.undo_assignment_command(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_assignment_command(uuid, uuid, text, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.undo_assignment_command(uuid, uuid, text, jsonb) IS
  'Author/service-only verified inverse within the server hold, replayable by a fixed packet/ID; exact token restoration and both effect supersessions commit atomically.';
