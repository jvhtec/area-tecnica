-- A physical crew call has one durable writer. There is deliberately no lease
-- takeover: a lost worker's request may still execute at Flex. Retain gates
-- across local job/mapping deletion so a late write never gains a replacement.
CREATE TABLE public.flex_crew_reconciliation_gates (
  flex_element_id text PRIMARY KEY CHECK (length(flex_element_id) BETWEEN 1 AND 200),
  state text NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'busy', 'uncertain')),
  owner_token uuid,
  acquired_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  outstanding_operation jsonb,
  owned_contacts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(owned_contacts) = 'object'),
  CHECK ((state = 'idle' AND owner_token IS NULL AND outstanding_operation IS NULL AND owned_contacts = '{}'::jsonb)
    OR (state <> 'idle' AND owner_token IS NOT NULL)),
  CHECK (outstanding_operation IS NULL OR jsonb_typeof(outstanding_operation) = 'object')
);
ALTER TABLE public.flex_crew_reconciliation_gates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flex_crew_reconciliation_gates FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.flex_crew_reconciliation_gates TO service_role;
COMMENT ON TABLE public.flex_crew_reconciliation_gates IS
  'Non-expiring ownership of a physical Flex crew call. Never unlock busy/uncertain work based on age: retire the worker and prove downstream settlement before operator recovery.';

-- Explicit current roles are the desired crew, including soft-declined direct
-- memberships. A cleared role cannot be recreated by profile-department fallback.
-- The union covers aliases of the same physical element. No source row locks
-- are held across external I/O; assignment transactions remain independent.
CREATE FUNCTION public.flex_crew_reconciliation_projection(p_element text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_desired jsonb;
  v_current jsonb;
  v_calls jsonb;
BEGIN
  IF (auth.role() = 'service_role') IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'crew_call_id', c.id, 'job_id', c.job_id, 'department', c.department)
    ORDER BY c.id), '[]'::jsonb) INTO v_calls
  FROM public.flex_crew_calls c WHERE c.flex_element_id::text = p_element;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'crew_call_id', d.crew_call_id, 'technician_id', d.technician_id,
    'resource_id', d.flex_resource_id, 'department', d.department, 'role', d.role)
    ORDER BY d.crew_call_id, d.technician_id), '[]'::jsonb) INTO v_desired
  FROM (
    SELECT c.id AS crew_call_id, a.technician_id, p.flex_resource_id, c.department,
      CASE c.department WHEN 'sound' THEN a.sound_role WHEN 'lights' THEN a.lights_role END AS role
    FROM public.flex_crew_calls c
    JOIN public.jobs j ON j.id = c.job_id AND j.job_type IS DISTINCT FROM 'dryhire'
    JOIN public.job_assignments a ON a.job_id = c.job_id
    LEFT JOIN public.profiles p ON p.id = a.technician_id
    WHERE c.flex_element_id::text = p_element AND c.department IN ('sound', 'lights')
  ) d WHERE COALESCE(d.role, 'none') NOT IN ('none', '');
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'crew_call_id', a.crew_call_id, 'technician_id', a.technician_id,
    'line_item_id', a.flex_line_item_id, 'resource_id', p.flex_resource_id)
    ORDER BY a.crew_call_id, a.technician_id), '[]'::jsonb) INTO v_current
  FROM public.flex_crew_assignments a
  JOIN public.flex_crew_calls c ON c.id = a.crew_call_id AND c.flex_element_id::text = p_element
  LEFT JOIN public.profiles p ON p.id = a.technician_id;
  RETURN pg_catalog.jsonb_build_object('desired', v_desired, 'current', v_current,
    'state_token', pg_catalog.md5(pg_catalog.jsonb_build_object('desired', v_desired, 'calls', v_calls)::text));
END;
$$;
REVOKE ALL ON FUNCTION public.flex_crew_reconciliation_projection(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flex_crew_reconciliation_projection(text) TO service_role;

CREATE FUNCTION public.claim_flex_crew_reconciliation(p_job_id uuid, p_department text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_element text;
  v_owner uuid := gen_random_uuid();
  v_contacts jsonb;
BEGIN
  IF (auth.role() = 'service_role') IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_job_id IS NULL OR p_department IS NULL OR p_department NOT IN ('sound', 'lights') THEN
    RAISE EXCEPTION 'job and supported department are required' USING ERRCODE = '22023';
  END IF;
  SELECT c.flex_element_id INTO v_element FROM public.flex_crew_calls c
  WHERE c.job_id = p_job_id AND c.department = p_department;
  IF NOT FOUND OR v_element IS NULL OR v_element = '' THEN
    RAISE EXCEPTION 'crew call not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.flex_crew_reconciliation_gates(flex_element_id) VALUES (v_element)
  ON CONFLICT (flex_element_id) DO NOTHING;
  UPDATE public.flex_crew_reconciliation_gates SET state = 'busy', owner_token = v_owner,
    acquired_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  WHERE flex_element_id = v_element AND state = 'idle';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'flex_crew_reconciliation_busy' USING ERRCODE = '55P03',
      DETAIL = 'Existing ownership must settle; timestamps never permit takeover.';
  END IF;
  -- Snapshot ownership before any provider I/O. Cascading profile/job deletion
  -- must not erase the evidence an admitted worker needs for recovery.
  SELECT COALESCE(pg_catalog.jsonb_object_agg(m->>'line_item_id', m), '{}'::jsonb)
    INTO v_contacts FROM pg_catalog.jsonb_array_elements(
      public.flex_crew_reconciliation_projection(v_element)->'current') m
    WHERE m->>'line_item_id' IS NOT NULL;
  UPDATE public.flex_crew_reconciliation_gates SET owned_contacts = v_contacts
    WHERE flex_element_id = v_element;
  RETURN pg_catalog.jsonb_build_object('flex_element_id', v_element, 'owner_token', v_owner);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_flex_crew_reconciliation(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_flex_crew_reconciliation(uuid,text) TO service_role;

CREATE FUNCTION public.read_flex_crew_reconciliation(p_element text, p_owner uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (auth.role() = 'service_role') IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.flex_crew_reconciliation_gates
    WHERE flex_element_id = p_element AND owner_token = p_owner AND state = 'busy'
      AND outstanding_operation IS NULL) THEN
    RAISE EXCEPTION 'invalid Flex reconciliation owner or outstanding operation' USING ERRCODE = '55000';
  END IF;
  RETURN public.flex_crew_reconciliation_projection(p_element) ||
    pg_catalog.jsonb_build_object('owned_contacts', (SELECT COALESCE(
      (SELECT pg_catalog.jsonb_agg(value) FROM pg_catalog.jsonb_each(g.owned_contacts)), '[]'::jsonb)
      FROM public.flex_crew_reconciliation_gates g WHERE g.flex_element_id = p_element));
END;
$$;
REVOKE ALL ON FUNCTION public.read_flex_crew_reconciliation(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_flex_crew_reconciliation(text,uuid) TO service_role;

CREATE FUNCTION public.admit_flex_crew_operation(p_element text, p_owner uuid, p_operation jsonb, p_state_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_gate public.flex_crew_reconciliation_gates%ROWTYPE;
BEGIN
  IF (auth.role() = 'service_role') IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_gate FROM public.flex_crew_reconciliation_gates WHERE flex_element_id = p_element FOR UPDATE;
  IF NOT FOUND OR v_gate.owner_token IS DISTINCT FROM p_owner OR p_owner IS NULL
    OR v_gate.state <> 'busy' OR v_gate.outstanding_operation IS NOT NULL THEN
    RAISE EXCEPTION 'invalid Flex reconciliation owner or outstanding operation' USING ERRCODE = '55000';
  END IF;
  IF p_operation IS NULL OR pg_catalog.jsonb_typeof(p_operation) <> 'object'
    OR COALESCE(p_operation->>'kind', '') NOT IN ('add','remove','role') THEN
    RAISE EXCEPTION 'invalid Flex operation' USING ERRCODE = '22023';
  END IF;
  IF p_state_token IS NULL OR (public.flex_crew_reconciliation_projection(p_element)->>'state_token')
    IS DISTINCT FROM p_state_token THEN
    RAISE EXCEPTION 'Flex desired state changed' USING ERRCODE = 'P0409';
  END IF;
  UPDATE public.flex_crew_reconciliation_gates SET outstanding_operation = p_operation,
    updated_at = pg_catalog.clock_timestamp() WHERE flex_element_id = p_element;
END;
$$;
REVOKE ALL ON FUNCTION public.admit_flex_crew_operation(text,uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_flex_crew_operation(text,uuid,jsonb,text) TO service_role;

CREATE FUNCTION public.settle_flex_crew_operation(p_element text, p_owner uuid, p_uncertain boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (auth.role() = 'service_role') IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_uncertain IS NULL THEN RAISE EXCEPTION 'settlement outcome is required' USING ERRCODE = '22023'; END IF;
  UPDATE public.flex_crew_reconciliation_gates SET
    state = CASE WHEN p_uncertain THEN 'uncertain' ELSE 'busy' END,
    outstanding_operation = CASE WHEN p_uncertain THEN outstanding_operation ELSE NULL END,
    updated_at = pg_catalog.clock_timestamp()
  WHERE flex_element_id = p_element AND owner_token = p_owner AND state = 'busy'
    AND outstanding_operation IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid Flex reconciliation owner or outstanding operation' USING ERRCODE = '55000';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_flex_crew_operation(text,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_flex_crew_operation(text,uuid,boolean) TO service_role;

CREATE FUNCTION public.write_flex_crew_mapping(p_element text, p_owner uuid, p_crew_call uuid,
  p_technician uuid, p_line_item text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_gate public.flex_crew_reconciliation_gates%ROWTYPE;
BEGIN
  IF (auth.role() = 'service_role') IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_gate FROM public.flex_crew_reconciliation_gates WHERE flex_element_id = p_element FOR UPDATE;
  IF NOT FOUND OR p_owner IS NULL OR v_gate.owner_token IS DISTINCT FROM p_owner
    OR v_gate.state <> 'busy' OR v_gate.outstanding_operation IS NOT NULL THEN
    RAISE EXCEPTION 'invalid Flex reconciliation owner or outstanding operation' USING ERRCODE = '55000';
  END IF;
  PERFORM 1 FROM public.flex_crew_calls WHERE id = p_crew_call AND flex_element_id::text = p_element FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'crew mapping changed' USING ERRCODE = 'P0409';
  END IF;
  IF p_line_item IS NULL THEN
    DELETE FROM public.flex_crew_assignments WHERE crew_call_id = p_crew_call AND technician_id = p_technician;
  ELSE
    IF p_line_item = '' THEN RAISE EXCEPTION 'line item is required' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.flex_crew_assignments(crew_call_id,technician_id,flex_line_item_id)
    VALUES (p_crew_call,p_technician,p_line_item::uuid)
    ON CONFLICT (crew_call_id,technician_id) DO UPDATE SET flex_line_item_id = excluded.flex_line_item_id;
    UPDATE public.flex_crew_reconciliation_gates SET owned_contacts = owned_contacts ||
      pg_catalog.jsonb_build_object(p_line_item, pg_catalog.jsonb_build_object(
        'crew_call_id', p_crew_call, 'technician_id', p_technician, 'line_item_id', p_line_item, 'resource_id', NULL))
      WHERE flex_element_id = p_element;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.write_flex_crew_mapping(text,uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_flex_crew_mapping(text,uuid,uuid,uuid,text) TO service_role;

-- Record ownership of a verified add in the same transaction that settles it.
-- If persistence fails, the admitted external operation remains outstanding.
CREATE FUNCTION public.settle_flex_crew_add(p_element text, p_owner uuid,
  p_crew_call uuid, p_technician uuid, p_line_item text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_gate public.flex_crew_reconciliation_gates%ROWTYPE;
BEGIN
  IF (auth.role() = 'service_role') IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_gate FROM public.flex_crew_reconciliation_gates WHERE flex_element_id = p_element FOR UPDATE;
  IF NOT FOUND OR p_owner IS NULL OR v_gate.owner_token IS DISTINCT FROM p_owner
    OR v_gate.state <> 'busy' OR v_gate.outstanding_operation->>'kind' IS DISTINCT FROM 'add'
    OR v_gate.outstanding_operation->>'crew_call_id' IS DISTINCT FROM p_crew_call::text
    OR v_gate.outstanding_operation->>'technician_id' IS DISTINCT FROM p_technician::text THEN
    RAISE EXCEPTION 'invalid Flex add settlement owner or operation' USING ERRCODE = '55000';
  END IF;
  PERFORM 1 FROM public.flex_crew_calls WHERE id = p_crew_call AND flex_element_id::text = p_element FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'crew mapping changed' USING ERRCODE = 'P0409'; END IF;
  IF p_line_item IS NULL OR p_line_item = '' THEN
    RAISE EXCEPTION 'verified line item is required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.flex_crew_assignments(crew_call_id,technician_id,flex_line_item_id)
  VALUES (p_crew_call,p_technician,p_line_item::uuid)
  ON CONFLICT (crew_call_id,technician_id) DO UPDATE SET flex_line_item_id=excluded.flex_line_item_id;
  UPDATE public.flex_crew_reconciliation_gates SET outstanding_operation=NULL,
    owned_contacts = owned_contacts || pg_catalog.jsonb_build_object(p_line_item,
      pg_catalog.jsonb_build_object('crew_call_id', p_crew_call,
        'technician_id', p_technician, 'line_item_id', p_line_item, 'resource_id', NULL)),
    updated_at=pg_catalog.clock_timestamp() WHERE flex_element_id=p_element;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_flex_crew_add(text,uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_flex_crew_add(text,uuid,uuid,uuid,text) TO service_role;

CREATE FUNCTION public.release_flex_crew_reconciliation(p_element text, p_owner uuid, p_state_token text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_gate public.flex_crew_reconciliation_gates%ROWTYPE;
BEGIN
  IF (auth.role() = 'service_role') IS NOT TRUE THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_gate FROM public.flex_crew_reconciliation_gates WHERE flex_element_id = p_element FOR UPDATE;
  IF NOT FOUND OR p_owner IS NULL OR v_gate.owner_token IS DISTINCT FROM p_owner
    OR v_gate.state <> 'busy' OR v_gate.outstanding_operation IS NOT NULL THEN
    RAISE EXCEPTION 'invalid Flex reconciliation owner or outstanding operation' USING ERRCODE = '55000';
  END IF;
  -- A failed projection cannot establish that cascaded mappings still preserve
  -- ownership. Retain the journal and owner on error, even after a settled add.
  IF p_state_token IS NULL AND v_gate.owned_contacts <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Flex contact ownership requires verified reconciliation' USING ERRCODE = '55000';
  END IF;
  IF p_state_token IS NOT NULL AND (public.flex_crew_reconciliation_projection(p_element)->>'state_token')
    IS DISTINCT FROM p_state_token THEN
    RAISE EXCEPTION 'Flex desired state changed' USING ERRCODE = 'P0409';
  END IF;
  UPDATE public.flex_crew_reconciliation_gates SET state = 'idle', owner_token = NULL,
    outstanding_operation = NULL, owned_contacts = '{}'::jsonb,
    updated_at = pg_catalog.clock_timestamp() WHERE flex_element_id = p_element;
END;
$$;
REVOKE ALL ON FUNCTION public.release_flex_crew_reconciliation(text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_flex_crew_reconciliation(text,uuid,text) TO service_role;
