-- Matrix hardening M5: post-commit side-effect reconciliation and read-only
-- diagnostics. Commands return a side-effect plan (Flex add/remove,
-- notifications); the client executes it after commit and reports each
-- outcome here, so a failed Flex call is visible and retryable instead of a
-- console line. Nothing here changes core assignment state.

CREATE FUNCTION public.record_assignment_side_effects(
  p_command_id uuid,
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
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_results IS NULL OR pg_catalog.jsonb_typeof(p_results) <> 'array'
     OR pg_catalog.jsonb_array_length(p_results) > 32 THEN
    RAISE EXCEPTION 'a command id and an array of results are required' USING ERRCODE = '22023';
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
    v_effects := pg_catalog.jsonb_set(v_effects, ARRAY[v_index::text],
      (v_effects->v_index) || pg_catalog.jsonb_build_object(
        'status', v_status,
        'attempts', COALESCE((v_effects->v_index->>'attempts')::integer, 0) + 1,
        'last_error', CASE WHEN v_status = 'failed'
          THEN pg_catalog.left(COALESCE(v_item->>'error', 'unknown error'), 500) END,
        'updated_at', pg_catalog.now()));
  END LOOP;

  SELECT CASE
    WHEN pg_catalog.jsonb_array_length(v_effects) = 0 THEN 'none'
    WHEN bool_or(e->>'status' = 'failed') THEN 'failed'
    WHEN bool_and(e->>'status' = 'succeeded') THEN 'succeeded'
    ELSE 'pending' END
  INTO v_overall
  FROM pg_catalog.jsonb_array_elements(v_effects) AS e;
  v_overall := COALESCE(v_overall, 'none');

  UPDATE public.assignment_commands
  SET side_effects = v_effects, side_effects_status = v_overall, side_effects_updated_at = pg_catalog.now()
  WHERE command_id = p_command_id;

  RETURN pg_catalog.jsonb_build_object('command_id', p_command_id, 'side_effects', v_effects,
    'side_effects_status', v_overall);
END;
$$;

REVOKE ALL ON FUNCTION public.record_assignment_side_effects(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_assignment_side_effects(uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.record_assignment_side_effects(uuid, jsonb) IS
  'Records per-effect outcomes ([{index, status: succeeded|failed, error?}]) for a committed assignment command''s post-commit plan.';

-- Commands whose post-commit effects failed, or never reported back (a tab
-- closed mid-way). The grace period keeps in-flight work out of the list.
CREATE FUNCTION public.get_assignment_side_effect_backlog(
  p_limit integer DEFAULT 50,
  p_pending_grace interval DEFAULT interval '5 minutes'
)
RETURNS TABLE (
  command_id uuid,
  command_type text,
  job_id uuid,
  technician_id uuid,
  actor_id uuid,
  source text,
  side_effects jsonb,
  side_effects_status text,
  created_at timestamptz,
  side_effects_updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.command_id, c.command_type, c.job_id, c.technician_id, c.actor_id, c.source,
         c.side_effects, c.side_effects_status, c.created_at, c.side_effects_updated_at
  FROM public.assignment_commands c
  WHERE c.side_effects_status = 'failed'
     OR (c.side_effects_status = 'pending'
         AND COALESCE(c.side_effects_updated_at, c.created_at) < pg_catalog.now() - COALESCE(p_pending_grace, interval '5 minutes'))
  ORDER BY c.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.get_assignment_side_effect_backlog(integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_side_effect_backlog(integer, interval) TO authenticated, service_role;

-- Outcome/error counts for rollout verification.
CREATE FUNCTION public.get_assignment_command_metrics(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  command_type text,
  outcome text,
  error_code text,
  side_effects_status text,
  commands bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.command_type, c.outcome, c.error_code, c.side_effects_status, pg_catalog.count(*)
  FROM public.assignment_commands c
  WHERE c.created_at >= COALESCE(p_since, pg_catalog.now() - interval '24 hours')
  GROUP BY 1, 2, 3, 4
  ORDER BY 1, 2, 3, 4;
END;
$$;

REVOKE ALL ON FUNCTION public.get_assignment_command_metrics(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_command_metrics(timestamptz) TO authenticated, service_role;

-- Read-only membership/schedule consistency diagnostics over jobs that end on
-- or after p_from (default: 30 days ago). Deliberately no repair action: an
-- explicit repair command is added only if production evidence shows a need.
CREATE FUNCTION public.get_assignment_consistency_issues(
  p_from date DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  issue text,
  job_id uuid,
  technician_id uuid,
  details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from timestamptz := COALESCE(p_from, (pg_catalog.now() - interval '30 days')::date)::timestamptz;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH scoped_jobs AS (
    SELECT j.id, j.job_type FROM public.jobs j WHERE j.end_time >= v_from
  ),
  active AS (
    SELECT t.job_id, t.technician_id, pg_catalog.array_agg(t.date ORDER BY t.date) AS dates
    FROM public.timesheets t JOIN scoped_jobs sj ON sj.id = t.job_id
    WHERE t.is_active
    GROUP BY t.job_id, t.technician_id
  ),
  issues AS (
    -- Membership that schedules nobody (dry hires are assignment-only).
    SELECT 'membership_without_schedule'::text AS issue, a.job_id, a.technician_id,
           pg_catalog.jsonb_build_object('status', a.status, 'assignment_source', a.assignment_source) AS details
    FROM public.job_assignments a
    JOIN scoped_jobs sj ON sj.id = a.job_id
    LEFT JOIN active s ON s.job_id = a.job_id AND s.technician_id = a.technician_id
    WHERE s.job_id IS NULL AND sj.job_type <> 'dryhire'
      AND a.status IS DISTINCT FROM 'declined'
    UNION ALL
    -- Active schedule without membership.
    SELECT 'schedule_without_membership', s.job_id, s.technician_id,
           pg_catalog.jsonb_build_object('dates', s.dates)
    FROM active s
    LEFT JOIN public.job_assignments a ON a.job_id = s.job_id AND a.technician_id = s.technician_id
    WHERE a.id IS NULL
    UNION ALL
    -- Compatibility day that is not an active day.
    SELECT 'scoped_date_not_scheduled', a.job_id, a.technician_id,
           pg_catalog.jsonb_build_object('assignment_date', a.assignment_date, 'dates', s.dates)
    FROM public.job_assignments a
    JOIN active s ON s.job_id = a.job_id AND s.technician_id = a.technician_id
    WHERE a.single_day AND a.assignment_date IS NOT NULL AND NOT (a.assignment_date = ANY (s.dates))
    UNION ALL
    -- A declined membership still holding schedule.
    SELECT 'declined_with_active_schedule', a.job_id, a.technician_id,
           pg_catalog.jsonb_build_object('dates', s.dates)
    FROM public.job_assignments a
    JOIN active s ON s.job_id = a.job_id AND s.technician_id = a.technician_id
    WHERE a.status = 'declined'
  )
  SELECT i.issue, i.job_id, i.technician_id, i.details
  FROM issues i
  ORDER BY i.issue, i.job_id, i.technician_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
END;
$$;

REVOKE ALL ON FUNCTION public.get_assignment_consistency_issues(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_consistency_issues(date, integer) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_assignment_consistency_issues(date, integer) IS
  'Read-only diagnostics for membership/schedule inconsistencies (admin/management). No repair.';
