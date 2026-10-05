-- Matrix UX overhaul U0: server support for a short "Deshacer" window.
--
-- The new Matrix defers an assignment's post-commit effects (Flex crew sync,
-- notifications) for a few seconds and offers an undo. Undo is an ordinary
-- inverse command plus cancelling the effects that never ran, so neither the
-- technician nor Flex ever hears about a change that was taken back.
--
--   unconfirm_assignment               inverse of a manager confirm
--                                      (confirmed -> invited)
--   supersede_assignment_side_effects  marks never-run effects of undone
--                                      commands as superseded
--
-- Nothing here replaces an existing command: the lock order, ledger and
-- state-token contract are the ones from the atomic assignment commands.
-- Both functions treat a missing/NULL role or auth claim as "not allowed"
-- (COALESCE), instead of letting a NULL slip through a NOT (... OR ...) test.

ALTER TABLE public.assignment_commands DROP CONSTRAINT assignment_commands_command_type_check;
ALTER TABLE public.assignment_commands ADD CONSTRAINT assignment_commands_command_type_check
  CHECK (command_type IN (
    'apply_direct_assignment', 'remove_direct_assignment', 'remove_assignment_date',
    'change_assignment_role', 'set_assignment_status', 'unconfirm_assignment'));

-- A command whose every effect was cancelled before it ran is neither pending
-- (nothing to retry) nor succeeded (nothing happened).
ALTER TABLE public.assignment_commands DROP CONSTRAINT assignment_commands_side_effects_status_check;
ALTER TABLE public.assignment_commands ADD CONSTRAINT assignment_commands_side_effects_status_check
  CHECK (side_effects_status IN ('none', 'pending', 'succeeded', 'failed', 'superseded'));

-- ---------------------------------------------------------------------------
-- unconfirm_assignment: confirmed -> invited
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.unconfirm_assignment(
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
BEGIN
  IF NOT (v_is_service OR COALESCE(public.is_admin_or_management(), false)) THEN
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

  v_after := public.assignment_state_snapshot(p_job_id, p_technician_id);
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome', v_outcome, 'command_id', p_command_id,
    'job_id', p_job_id, 'technician_id', p_technician_id,
    'assignment', v_after->'assignment', 'dates', v_after->'dates',
    'state_token', v_after->>'state_token', 'prior_state_token', v_prior->>'state_token',
    'side_effects', '[]'::jsonb, 'warnings', '[]'::jsonb);

  INSERT INTO public.assignment_commands (
    command_id, command_type, job_id, technician_id, actor_id, source,
    request_hash, request, outcome, prior_state_token, result_state_token, result,
    side_effects, side_effects_status, side_effects_updated_at
  ) VALUES (
    p_command_id, c_type, p_job_id, p_technician_id, v_actor, v_source,
    v_hash, v_request, v_outcome, v_prior->>'state_token', v_after->>'state_token', v_result,
    '[]'::jsonb, 'none', pg_catalog.now()
  ) ON CONFLICT (command_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'command_id_reused' USING ERRCODE = '23505',
      DETAIL = 'This command id was already used for a different assignment command.';
  END IF;

  RETURN v_result || pg_catalog.jsonb_build_object('replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.unconfirm_assignment(uuid, uuid, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unconfirm_assignment(uuid, uuid, uuid, text, text, uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.unconfirm_assignment(uuid, uuid, uuid, text, text, uuid, jsonb) IS
  'Inverse of a manager confirm (confirmed -> invited, response_time cleared) for the Matrix undo window; ledgered, idempotent and token-guarded. Declined or approved-timesheet assignments are rejected.';

-- ---------------------------------------------------------------------------
-- supersede_assignment_side_effects
-- ---------------------------------------------------------------------------
-- Cancels the effects of commands the caller undid, but only effects that have
-- not run: pending or failed and not under a live claim. Anything already
-- succeeded or being executed right now is reported back as not superseded, so
-- the caller can compensate (for example send the "removed" notice) instead of
-- pretending it never happened.
CREATE FUNCTION public.supersede_assignment_side_effects(p_command_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_service boolean := COALESCE(auth.role() = 'service_role', false);
  v_id uuid;
  v_command public.assignment_commands%ROWTYPE;
  v_effects jsonb;
  v_overall text;
  v_superseded integer;
  v_kept integer;
  v_total_superseded integer := 0;
  v_total_kept integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF NOT (v_is_service OR COALESCE(public.is_admin_or_management(), false)) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_command_ids IS NULL OR pg_catalog.cardinality(p_command_ids) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'between 1 and 32 command ids are required' USING ERRCODE = '22023';
  END IF;

  -- Sorted so two concurrent batches lock ledger rows in the same order.
  FOR v_id IN SELECT DISTINCT x FROM pg_catalog.unnest(p_command_ids) AS x ORDER BY x LOOP
    SELECT * INTO v_command FROM public.assignment_commands WHERE command_id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unknown assignment command' USING ERRCODE = 'P0002';
    END IF;
    -- Undo is the author's own decision; one manager cannot silence another's
    -- notifications or Flex sync.
    IF NOT v_is_service AND v_command.actor_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(pg_catalog.jsonb_agg(
             CASE WHEN eligible
               THEN (effect - ARRAY['claim_token', 'claimed_until']::text[]) || pg_catalog.jsonb_build_object(
                      'status', 'superseded', 'superseded_at', pg_catalog.now())
               ELSE effect END ORDER BY ord), '[]'::jsonb),
           pg_catalog.count(*) FILTER (WHERE eligible),
           pg_catalog.count(*) FILTER (WHERE NOT eligible AND effect->>'status' IS DISTINCT FROM 'superseded')
      INTO v_effects, v_superseded, v_kept
    FROM (
      SELECT e.effect, e.ord,
             e.effect->>'status' IN ('pending', 'failed')
               AND (e.effect->>'claimed_until' IS NULL
                    OR (e.effect->>'claimed_until')::timestamptz < pg_catalog.now()) AS eligible
      FROM pg_catalog.jsonb_array_elements(v_command.side_effects) WITH ORDINALITY AS e(effect, ord)
    ) effects;

    IF v_superseded > 0 THEN
      SELECT CASE
        WHEN pg_catalog.jsonb_array_length(v_effects) = 0 THEN 'none'
        WHEN bool_and(e->>'status' = 'superseded') THEN 'superseded'
        WHEN bool_or(e->>'status' = 'failed') THEN 'failed'
        WHEN bool_and(e->>'status' IN ('succeeded', 'superseded')) THEN 'succeeded'
        ELSE 'pending' END
      INTO v_overall
      FROM pg_catalog.jsonb_array_elements(v_effects) AS e;
      UPDATE public.assignment_commands
      SET side_effects = v_effects, side_effects_status = COALESCE(v_overall, 'none'),
          side_effects_updated_at = pg_catalog.now()
      WHERE command_id = v_id;
    END IF;

    v_total_superseded := v_total_superseded + v_superseded;
    v_total_kept := v_total_kept + v_kept;
    v_items := v_items || pg_catalog.jsonb_build_object(
      'command_id', v_id, 'superseded', v_superseded, 'not_superseded', v_kept);
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'superseded', v_total_superseded, 'not_superseded', v_total_kept, 'commands', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.supersede_assignment_side_effects(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supersede_assignment_side_effects(uuid[]) TO authenticated, service_role;
COMMENT ON FUNCTION public.supersede_assignment_side_effects(uuid[]) IS
  'Cancels never-run (pending/failed, unclaimed) post-commit effects of the caller''s own commands after an undo; effects that already ran or are being run are counted as not_superseded so the caller can compensate.';
