-- Internal helper; caller must hold the parent workflow lock. Never callable by
-- browser roles. INSERT/UPDATE deliberately never overwrite status/audit fields.
CREATE FUNCTION public.sync_setup_workflow_tasks(p_workflow_id uuid, p_tasks jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_tasks IS NULL OR jsonb_typeof(p_tasks) <> 'array' THEN
    RAISE EXCEPTION 'invalid_input: tasks must be an array' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_tasks) t
    WHERE jsonb_typeof(t) <> 'object' OR NOT (t ?& ARRAY['task_key', 'category', 'label', 'required', 'responsible_role', 'metadata'])
      OR jsonb_typeof(t->'required') <> 'boolean'
      OR jsonb_typeof(t->'metadata') <> 'object'
      OR jsonb_typeof(t->'task_key') <> 'string'
      OR jsonb_typeof(t->'category') <> 'string'
      OR jsonb_typeof(t->'label') <> 'string'
      OR jsonb_typeof(t->'responsible_role') <> 'string'
  ) OR (SELECT count(*) <> count(DISTINCT t->>'task_key') FROM jsonb_array_elements(p_tasks) t) THEN
    RAISE EXCEPTION 'invalid_input: malformed or duplicate task definitions' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.setup_workflow_tasks AS existing
    (workflow_id, task_key, category, label, required, responsible_role, metadata)
  SELECT p_workflow_id, t->>'task_key', t->>'category', t->>'label',
    (t->>'required')::boolean, t->>'responsible_role', t->'metadata'
  FROM jsonb_array_elements(p_tasks) t
  ON CONFLICT (workflow_id, task_key) DO UPDATE SET
    category = EXCLUDED.category, label = EXCLUDED.label,
    required = EXCLUDED.required, responsible_role = EXCLUDED.responsible_role,
    metadata = existing.metadata || EXCLUDED.metadata, applicable = true
  WHERE (existing.category, existing.label, existing.required, existing.responsible_role, existing.metadata, existing.applicable)
    IS DISTINCT FROM (EXCLUDED.category, EXCLUDED.label, EXCLUDED.required, EXCLUDED.responsible_role, existing.metadata || EXCLUDED.metadata, true);

  UPDATE public.setup_workflow_tasks SET applicable = false
  WHERE workflow_id = p_workflow_id AND applicable
    AND task_key NOT IN (SELECT t->>'task_key' FROM jsonb_array_elements(p_tasks) t);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_setup_workflow_tasks(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Parent row lock serializes state patches, task sync/status and completion.
-- Any error rolls the entire operation back, including initial task generation.
CREATE FUNCTION public.mutate_setup_workflow(p_action text, p_payload jsonb, p_workflow_id uuid DEFAULT NULL)
RETURNS public.setup_workflows LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_workflow public.setup_workflows;
  v_task public.setup_workflow_tasks;
  v_status text;
  v_type text;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.is_admin_or_management(), false) THEN
    RAISE EXCEPTION 'forbidden: setup workflows require management access' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input: payload must be an object' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'create' THEN
    v_type := p_payload->>'type';
    IF v_type IS NULL OR v_type NOT IN ('job', 'tour', 'tour_date') THEN
      RAISE EXCEPTION 'unknown_type: unsupported workflow type' USING ERRCODE = '22023';
    END IF;
    BEGIN
      INSERT INTO public.setup_workflows(type, entity_id, current_step, assigned_to, state)
      VALUES (v_type, (p_payload->>'entity_id')::uuid,
        CASE WHEN v_type = 'tour_date' THEN 'defaults' ELSE 'basic' END,
        (p_payload->>'assigned_to')::uuid, COALESCE(p_payload->'state', '{}'::jsonb))
      RETURNING * INTO v_workflow;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'duplicate_workflow: an active workflow already exists' USING ERRCODE = '23505';
    END;
    PERFORM public.sync_setup_workflow_tasks(v_workflow.id, p_payload->'tasks');
    RETURN v_workflow;
  END IF;

  SELECT * INTO v_workflow FROM public.setup_workflows WHERE id = p_workflow_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'missing_workflow: workflow not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_workflow.status IN ('complete', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_transition: terminal workflow is immutable' USING ERRCODE = '22023';
  END IF;

  CASE p_action
    WHEN 'state' THEN
      IF jsonb_typeof(p_payload->'state') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'invalid_input: state must be an object' USING ERRCODE = '22023';
      END IF;
      -- Shallow patch at the top level; callers own individual step subtrees.
      UPDATE public.setup_workflows SET state = state || (p_payload->'state')
      WHERE id = p_workflow_id;
    WHEN 'step' THEN
      IF jsonb_typeof(p_payload->'step') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION 'invalid_input: step must be valid for the workflow type' USING ERRCODE = '22023';
      END IF;
      BEGIN
        -- Reuse the table's workflow-specific step constraint rather than
        -- maintaining a second set of step arrays inside the RPC.
        UPDATE public.setup_workflows SET current_step = p_payload->>'step' WHERE id = p_workflow_id;
      EXCEPTION WHEN check_violation THEN
        RAISE EXCEPTION 'invalid_input: step must be valid for the workflow type' USING ERRCODE = '22023';
      END;
    WHEN 'sync' THEN
      PERFORM public.sync_setup_workflow_tasks(p_workflow_id, p_payload->'tasks');
    WHEN 'task_status' THEN
      SELECT * INTO v_task FROM public.setup_workflow_tasks
      WHERE workflow_id = p_workflow_id AND task_key = p_payload->>'task_key' FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing_task: task not found' USING ERRCODE = 'P0002';
      END IF;
      v_status := p_payload->>'status';
      IF NOT v_task.applicable OR v_status IS NULL OR NOT (
        (v_task.status = 'pending' AND v_status IN ('completed', 'skipped', 'blocked'))
        OR (v_task.status = 'blocked' AND v_status IN ('pending', 'completed', 'skipped'))
        OR (v_task.status IN ('completed', 'skipped') AND v_status = 'pending')
      ) THEN
        RAISE EXCEPTION 'invalid_task_transition: task status change not allowed' USING ERRCODE = '22023';
      END IF;
      UPDATE public.setup_workflow_tasks SET status = v_status,
        completed_at = CASE WHEN v_status = 'completed' THEN now() END,
        completed_by = CASE WHEN v_status = 'completed' THEN auth.uid() END
      WHERE id = v_task.id;
    WHEN 'status' THEN
      v_status := p_payload->>'status';
      IF v_status IS NULL OR NOT (
        (v_workflow.status = 'draft' AND v_status IN ('in_progress', 'cancelled'))
        OR (v_workflow.status = 'in_progress' AND v_status IN ('review', 'complete', 'cancelled'))
        OR (v_workflow.status = 'review' AND v_status IN ('in_progress', 'complete', 'cancelled'))
      ) THEN
        RAISE EXCEPTION 'invalid_transition: workflow status change not allowed' USING ERRCODE = '22023';
      END IF;
      IF v_status = 'complete' AND (
        NOT EXISTS (SELECT 1 FROM public.setup_workflow_tasks WHERE workflow_id = p_workflow_id AND applicable)
        OR EXISTS (SELECT 1 FROM public.setup_workflow_tasks WHERE workflow_id = p_workflow_id AND applicable
          AND (status = 'blocked' OR (required AND status <> 'completed')))
      ) THEN
        RAISE EXCEPTION 'incomplete_workflow: required work or blockers remain' USING ERRCODE = '22023';
      END IF;
      UPDATE public.setup_workflows SET status = v_status,
        completed_at = CASE WHEN v_status = 'complete' THEN now() END
      WHERE id = p_workflow_id;
    ELSE
      RAISE EXCEPTION 'invalid_input: unsupported workflow action' USING ERRCODE = '22023';
  END CASE;
  UPDATE public.setup_workflows SET updated_at = now() WHERE id = p_workflow_id RETURNING * INTO v_workflow;
  RETURN v_workflow;
END;
$$;
ALTER FUNCTION public.mutate_setup_workflow(text, jsonb, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mutate_setup_workflow(text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_setup_workflow(text, jsonb, uuid) TO authenticated;
