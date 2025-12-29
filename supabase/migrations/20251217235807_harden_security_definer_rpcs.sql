-- =============================================================================
-- HARDEN SECURITY DEFINER RPCs (PROD)
-- =============================================================================
-- Closes privilege-escalation / data-exfil paths caused by SECURITY DEFINER
-- functions that were executable by anon/authenticated without authorization.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Critical: arbitrary SQL executor (auth schema)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dreamlit_auth_admin_executor(command text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF command IS NULL OR btrim(command) = '' THEN
    RAISE EXCEPTION 'Command must be provided';
  END IF;

  IF command !~* 'ON\s+"?auth"?\.' THEN
    RAISE EXCEPTION 'dreamlit auth executor only permits commands targeting auth schema';
  END IF;

  EXECUTE command;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.dreamlit_auth_admin_executor(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dreamlit_auth_admin_executor(text) TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Timesheet visibility RPC (previously returned all rows + raw amounts)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_timesheet_amounts_visible()
RETURNS TABLE(
  id uuid,
  job_id uuid,
  technician_id uuid,
  date date,
  start_time time without time zone,
  end_time time without time zone,
  break_minutes integer,
  overtime_hours numeric,
  notes text,
  status timesheet_status,
  signature_data text,
  signed_at timestamp with time zone,
  created_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  category text,
  amount_eur numeric,
  amount_breakdown jsonb,
  approved_by_manager boolean,
  ends_next_day boolean,
  amount_eur_visible numeric,
  amount_breakdown_visible jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_manager boolean := (auth.role() = 'service_role') OR public.is_admin_or_management();
BEGIN
  -- Require auth (anon must not see anything)
  IF auth.role() = 'anon' OR v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.job_id,
    t.technician_id,
    t.date,
    t.start_time,
    t.end_time,
    t.break_minutes,
    t.overtime_hours,
    t.notes,
    t.status,
    t.signature_data,
    t.signed_at,
    t.created_by,
    t.approved_by,
    t.approved_at,
    t.created_at,
    t.updated_at,
    t.category,
    CASE WHEN v_is_manager THEN t.amount_eur ELSE NULL END AS amount_eur,
    CASE WHEN v_is_manager THEN t.amount_breakdown ELSE NULL END AS amount_breakdown,
    t.approved_by_manager,
    t.ends_next_day,
    CASE
      WHEN v_is_manager THEN t.amount_eur
      WHEN t.approved_by_manager = true THEN t.amount_eur
      ELSE NULL
    END AS amount_eur_visible,
    CASE
      WHEN v_is_manager THEN t.amount_breakdown
      WHEN t.approved_by_manager = true THEN t.amount_breakdown
      ELSE NULL
    END AS amount_breakdown_visible
  FROM public.timesheets t
  WHERE v_is_manager OR t.technician_id = v_uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_timesheet_amounts_visible() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_timesheet_amounts_visible() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3) Profiles-with-skills RPC (fix broken auth check; limit PII)
-- -----------------------------------------------------------------------------

-- Drop existing function first since return type changed
DROP FUNCTION IF EXISTS public.get_profiles_with_skills();

CREATE OR REPLACE FUNCTION public.get_profiles_with_skills()
RETURNS TABLE(
  id uuid,
  first_name text,
  nickname text,
  last_name text,
  email text,
  role user_role,
  phone text,
  dni text,
  department text,
  assignable_as_tech boolean,
  bg_color text,
  skills json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_service boolean := auth.role() = 'service_role';
  v_role text := public.current_user_role();
  v_can_view boolean := v_is_service OR v_role IN ('admin', 'management', 'house_tech');
  v_show_sensitive boolean := v_is_service OR v_role IN ('admin', 'management');
BEGIN
  IF v_uid IS NULL AND NOT v_is_service THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF NOT v_can_view THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.nickname,
    p.last_name,
    p.email,
    p.role,
    CASE WHEN v_show_sensitive THEN p.phone ELSE NULL END AS phone,
    CASE WHEN v_show_sensitive THEN p.dni ELSE NULL END AS dni,
    p.department,
    p.assignable_as_tech,
    p.bg_color,
    COALESCE(
      json_agg(
        jsonb_build_object(
          'name', s.name,
          'category', s.category,
          'proficiency', ps.proficiency,
          'is_primary', ps.is_primary
        )
        ORDER BY ps.is_primary DESC NULLS LAST, ps.proficiency DESC NULLS LAST, s.name
      ) FILTER (WHERE s.id IS NOT NULL),
      '[]'::json
    ) AS skills
  FROM public.profiles p
  LEFT JOIN public.profile_skills ps ON ps.profile_id = p.id
  LEFT JOIN public.skills s ON s.id = ps.skill_id AND s.active IS TRUE
  GROUP BY p.id, p.first_name, p.nickname, p.last_name, p.email, p.role, p.phone, p.dni, p.department, p.assignable_as_tech, p.bg_color;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_profiles_with_skills() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_with_skills() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) Assignment lifecycle RPC (prevent spoofing + enforce authorization)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.manage_assignment_lifecycle(
  p_job_id uuid,
  p_technician_id uuid,
  p_action text,
  p_delete_mode text DEFAULT 'soft',
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_result JSONB;
  v_assignment_id UUID;
  v_previous_status TEXT;
  v_affected_timesheets INT := 0;
  v_assignment_source TEXT;
  v_caller_id uuid := auth.uid();
  v_is_service boolean := auth.role() = 'service_role';
  v_is_management boolean := v_is_service OR public.is_admin_or_management();
  v_actor uuid := CASE
    WHEN v_is_service THEN COALESCE(p_actor_id, v_caller_id)
    ELSE v_caller_id
  END;
BEGIN
  IF NOT v_is_service AND v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Authentication required'
    );
  END IF;

  -- Validate action
  IF p_action NOT IN ('confirm', 'decline', 'cancel') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_action',
      'message', 'Action must be confirm, decline, or cancel'
    );
  END IF;

  -- Validate delete mode
  IF p_delete_mode NOT IN ('soft', 'hard') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_delete_mode',
      'message', 'Delete mode must be soft or hard'
    );
  END IF;

  -- Authorization rules:
  -- - Management/service_role can manage any assignment.
  -- - Technicians can confirm/decline their own assignments (soft only).
  -- - Only management/service_role can cancel or hard delete.
  IF NOT v_is_management AND v_caller_id <> p_technician_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'permission_denied',
      'message', 'Not allowed to manage other technicians'
    );
  END IF;

  IF p_action = 'cancel' AND NOT v_is_management THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'permission_denied',
      'message', 'Only management can cancel assignments'
    );
  END IF;

  IF p_delete_mode = 'hard' AND NOT v_is_management THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'permission_denied',
      'message', 'Hard delete requires management'
    );
  END IF;

  -- Lock the assignment row for update (NOWAIT to fail fast if locked)
  BEGIN
    SELECT id, status, assignment_source
    INTO v_assignment_id, v_previous_status, v_assignment_source
    FROM public.job_assignments
    WHERE job_id = p_job_id AND technician_id = p_technician_id
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'assignment_locked',
        'message', 'Assignment is being modified by another operation'
      );
  END;

  IF v_assignment_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'assignment_not_found',
      'message', 'No assignment found for this job and technician'
    );
  END IF;

  -- Process based on action
  CASE p_action
    WHEN 'confirm' THEN
      -- Check for conflicts before confirming
      PERFORM 1 FROM public.timesheets t1
      WHERE t1.technician_id = p_technician_id
        AND t1.is_active = true
        AND t1.job_id != p_job_id
        AND t1.date IN (
          SELECT t2.date FROM public.timesheets t2
          WHERE t2.job_id = p_job_id
            AND t2.technician_id = p_technician_id
            AND t2.is_active = true
        );

      IF FOUND THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'conflict_detected',
          'message', 'Technician has conflicting assignments on these dates'
        );
      END IF;

      -- Update assignment status
      UPDATE public.job_assignments
      SET status = 'confirmed', response_time = NOW()
      WHERE id = v_assignment_id;

      -- Log the action
      INSERT INTO public.assignment_audit_log (
        assignment_id, job_id, technician_id, action,
        previous_status, new_status, actor_id, metadata
      ) VALUES (
        v_assignment_id, p_job_id, p_technician_id, 'confirmed',
        v_previous_status, 'confirmed', v_actor, p_metadata
      );

      v_result := jsonb_build_object(
        'success', true,
        'action', 'confirmed',
        'assignment_id', v_assignment_id
      );

    WHEN 'decline', 'cancel' THEN
      IF p_delete_mode = 'hard' THEN
        -- Hard delete: count timesheets, delete them, then delete assignment
        SELECT COUNT(*) INTO v_affected_timesheets
        FROM public.timesheets
        WHERE job_id = p_job_id AND technician_id = p_technician_id;

        DELETE FROM public.timesheets
        WHERE job_id = p_job_id AND technician_id = p_technician_id;

        INSERT INTO public.assignment_audit_log (
          assignment_id, job_id, technician_id, action,
          previous_status, new_status, actor_id, metadata, deleted_timesheet_count
        ) VALUES (
          v_assignment_id, p_job_id, p_technician_id, 'hard_deleted',
          v_previous_status, NULL, v_actor,
          p_metadata || jsonb_build_object('assignment_source', v_assignment_source),
          v_affected_timesheets
        );

        DELETE FROM public.job_assignments WHERE id = v_assignment_id;

        v_result := jsonb_build_object(
          'success', true,
          'action', 'hard_deleted',
          'assignment_id', v_assignment_id,
          'deleted_timesheets', v_affected_timesheets
        );

      ELSE
        UPDATE public.job_assignments
        SET status = 'declined', response_time = NOW()
        WHERE id = v_assignment_id;

        UPDATE public.timesheets
        SET is_active = false
        WHERE job_id = p_job_id AND technician_id = p_technician_id
          AND is_active = true;
        GET DIAGNOSTICS v_affected_timesheets = ROW_COUNT;

        INSERT INTO public.assignment_audit_log (
          assignment_id, job_id, technician_id, action,
          previous_status, new_status, actor_id, metadata, deleted_timesheet_count
        ) VALUES (
          v_assignment_id, p_job_id, p_technician_id, 'soft_deleted',
          v_previous_status, 'declined', v_actor, p_metadata,
          v_affected_timesheets
        );

        v_result := jsonb_build_object(
          'success', true,
          'action', 'soft_deleted',
          'assignment_id', v_assignment_id,
          'voided_timesheets', v_affected_timesheets
        );
      END IF;
  END CASE;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'manage_assignment_lifecycle error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'internal_error',
      'message', 'An unexpected error occurred'
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.manage_assignment_lifecycle(uuid,uuid,text,text,uuid,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.manage_assignment_lifecycle(uuid,uuid,text,text,uuid,jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5) Remove assignment + timesheets RPC (management-only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_assignment_with_timesheets(
  p_job_id uuid,
  p_technician_id uuid
)
RETURNS TABLE(
  deleted_timesheets int,
  deleted_assignment boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_deleted_timesheets int := 0;
  v_assignment_rows int := 0;
  v_deleted_assignment boolean := false;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.timesheets
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id;

  GET DIAGNOSTICS v_deleted_timesheets = ROW_COUNT;

  DELETE FROM public.job_assignments
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id;

  GET DIAGNOSTICS v_assignment_rows = ROW_COUNT;
  v_deleted_assignment := v_assignment_rows > 0;

  RETURN QUERY SELECT v_deleted_timesheets, v_deleted_assignment;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.remove_assignment_with_timesheets(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_assignment_with_timesheets(uuid,uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6) toggle_timesheet_day RPC (management-only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.toggle_timesheet_day(
  p_job_id uuid,
  p_technician_id uuid,
  p_date date,
  p_present boolean,
  p_source text DEFAULT 'matrix'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

REVOKE EXECUTE ON FUNCTION public.toggle_timesheet_day(uuid,uuid,date,boolean,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_timesheet_day(uuid,uuid,date,boolean,text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7) auto_complete_past_jobs RPC (management-only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_complete_past_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  updated_count integer;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.jobs
  SET status = 'Completado'::job_status,
      updated_at = now()
  WHERE end_time < now()
    AND status != 'Cancelado'::job_status
    AND status != 'Completado'::job_status;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.auto_complete_past_jobs() FROM anon;
GRANT EXECUTE ON FUNCTION public.auto_complete_past_jobs() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8) Staffing summary (replace direct matview access)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_job_staffing_summary(p_job_ids uuid[])
RETURNS TABLE(
  job_id uuid,
  assigned_count bigint,
  worked_count bigint,
  total_cost_eur numeric,
  approved_cost_eur numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    v.job_id,
    v.assigned_count,
    v.worked_count,
    v.total_cost_eur,
    v.approved_cost_eur
  FROM public.v_job_staffing_summary v
  WHERE v.job_id = ANY(p_job_ids);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_job_staffing_summary(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_job_staffing_summary(uuid[]) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9) Tour quote RPC (management-only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  jtype job_type;
  st timestamptz;
  tour_group uuid;
  cat text;
  house boolean := false;
  is_autonomo boolean := true;
  autonomo_discount numeric := 0;
  base_day_before_discount numeric;
  base_after_discount numeric(10,2);
  team_member boolean := false;
  has_override boolean := false;
  base numeric(10,2);
  mult numeric(6,3) := 1.0;
  per_job_multiplier numeric(6,3) := 1.0;
  cnt int := 1;
  y int := NULL;
  w int := NULL;
  extras jsonb;
  extras_total numeric(10,2);
  final_total numeric(10,2);
  disclaimer boolean;
  tour_date_type text := NULL;
  rehearsal_flat_rate numeric := NULL;
  has_custom_rate boolean := FALSE;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  -- Fetch job info
  SELECT job_type, start_time, tour_id
  INTO jtype, st, tour_group
  FROM public.jobs
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','job_not_found');
  END IF;
  IF jtype <> 'tourdate' THEN
    RETURN jsonb_build_object('error','not_tour_date');
  END IF;

  -- Check for rehearsal tour date type
  SELECT td.tour_date_type INTO tour_date_type
  FROM public.tour_dates td
  JOIN public.jobs j ON j.tour_date_id = td.id
  WHERE j.id = _job_id
  LIMIT 1;

  -- Check if house tech and autonomo status
  SELECT
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END
  INTO house, is_autonomo
  FROM public.profiles
  WHERE id = _tech_id;

  -- Handle rehearsal flat rate for tour dates
  IF tour_date_type = 'rehearsal' THEN
    -- Check for custom rehearsal rate (works for both house_tech and technician roles)
    SELECT rehearsal_day_eur INTO rehearsal_flat_rate
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;

    -- If no custom rate, use defaults
    IF rehearsal_flat_rate IS NULL THEN
      -- Technician rehearsal: €180 base
      rehearsal_flat_rate := 180.00;
      base_day_before_discount := 180.00;

      -- Apply autonomo discount if applicable
      IF NOT is_autonomo THEN
        autonomo_discount := 30.00;
        rehearsal_flat_rate := rehearsal_flat_rate - autonomo_discount;
      END IF;
    ELSE
      base_day_before_discount := rehearsal_flat_rate;
      -- Apply autonomo discount if applicable and not house tech
      IF NOT is_autonomo AND NOT house THEN
        autonomo_discount := 30.00;
        rehearsal_flat_rate := rehearsal_flat_rate - autonomo_discount;
      END IF;
    END IF;
  END IF;

  -- If rehearsal flat rate applies, return early
  IF rehearsal_flat_rate IS NOT NULL THEN
    extras := public.extras_total_for_job_tech(_job_id, _tech_id);
    extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
    final_total := ROUND(rehearsal_flat_rate + extras_total, 2);
    disclaimer := public.needs_vehicle_disclaimer(_tech_id);

    RETURN jsonb_build_object(
      'job_id', _job_id,
      'technician_id', _tech_id,
      'is_rehearsal_flat_rate', true,
      'rehearsal_rate_eur', ROUND(rehearsal_flat_rate, 2),
      'autonomo_discount_eur', ROUND(autonomo_discount, 2),
      'base_day_before_discount_eur', ROUND(COALESCE(base_day_before_discount, rehearsal_flat_rate), 2),
      'base_day_eur', ROUND(rehearsal_flat_rate, 2),
      'total_eur', ROUND(rehearsal_flat_rate, 2),
      'extras', extras,
      'extras_total_eur', ROUND(extras_total, 2),
      'total_with_extras_eur', ROUND(final_total, 2),
      'vehicle_disclaimer', disclaimer,
      'vehicle_disclaimer_text', CASE WHEN disclaimer THEN 'Se requiere vehículo propio' ELSE NULL END,
      'category', 'rehearsal',
      'breakdown', jsonb_build_object('notes', ARRAY['Rehearsal flat rate applied'])
    );
  END IF;

  -- Normal tour rate calculation continues...
  -- Resolve category for everyone (for rate selection)
  SELECT
    CASE
      WHEN sound_role LIKE '%-R' OR lights_role LIKE '%-R' OR video_role LIKE '%-R' THEN 'responsable'
      WHEN sound_role LIKE '%-E' OR lights_role LIKE '%-E' OR video_role LIKE '%-E' THEN 'especialista'
      WHEN sound_role LIKE '%-T' OR lights_role LIKE '%-T' OR video_role LIKE '%-T' THEN 'tecnico'
      ELSE NULL
    END
  INTO cat
  FROM public.job_assignments
  WHERE job_id = _job_id AND technician_id = _tech_id;

  -- If no category from job_assignments, try profile default
  IF cat IS NULL THEN
    SELECT default_timesheet_category INTO cat
    FROM public.profiles
    WHERE id = _tech_id AND default_timesheet_category IN ('tecnico','especialista','responsable');
  END IF;

  -- Category is required
  IF cat IS NULL THEN
    RETURN jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
  END IF;

  -- Base rate lookup - custom_tech_rates for all technicians
  IF cat = 'responsable' THEN
    SELECT COALESCE(tour_base_responsable_eur, base_day_eur) INTO base
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;
  ELSE
    SELECT COALESCE(tour_base_other_eur, base_day_eur) INTO base
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;
  END IF;

  IF base IS NOT NULL THEN
    has_custom_rate := TRUE;
  ELSE
    SELECT base_day_eur INTO base
    FROM public.rate_cards_tour_2025
    WHERE category = cat;

    IF base IS NULL THEN
      RETURN jsonb_build_object('error','tour_base_missing','category',cat);
    END IF;
  END IF;

  base_day_before_discount := base;

  -- Apply autonomo discount for non-house technicians BEFORE multipliers
  IF NOT house AND NOT is_autonomo THEN
    autonomo_discount := 30;
    base := base - autonomo_discount;
  END IF;

  base_after_discount := base;

  -- Check for override flag first
  IF tour_group IS NOT NULL THEN
    SELECT COALESCE(ja.use_tour_multipliers, FALSE)
    INTO has_override
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id AND ja.technician_id = _tech_id;
  END IF;

  -- Determine if technician belongs to the tour team OR has override enabled
  IF tour_group IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.tour_assignments ta
      WHERE ta.tour_id = tour_group
        AND ta.technician_id = _tech_id
    ) OR has_override
    INTO team_member;
  END IF;

  -- Multiplier logic: Count TOUR DATES in the week and check if tech is assigned to all
  SELECT iso_year, iso_week INTO y, w
  FROM public.iso_year_week_madrid(st);

  IF team_member THEN
    DECLARE
      total_tour_dates int;
      tech_assigned_dates int;
    BEGIN
      SELECT count(DISTINCT j.id) INTO total_tour_dates
      FROM public.jobs j
      WHERE j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND j.status != 'Cancelado'
        AND (SELECT iso_year FROM public.iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM public.iso_year_week_madrid(j.start_time)) = w;

      SELECT count(DISTINCT j.id) INTO tech_assigned_dates
      FROM public.jobs j
      JOIN public.job_assignments a ON a.job_id = j.id
      WHERE a.technician_id = _tech_id
        AND j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND j.status != 'Cancelado'
        AND (SELECT iso_year FROM public.iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM public.iso_year_week_madrid(j.start_time)) = w;

      IF tech_assigned_dates = total_tour_dates THEN
        cnt := total_tour_dates;

        IF cnt <= 1 THEN
          mult := 1.5;
          per_job_multiplier := 1.5;
        ELSIF cnt = 2 THEN
          mult := 2.25;
          per_job_multiplier := 1.125;
        ELSE
          mult := 1.0;
          per_job_multiplier := 1.0;
        END IF;
      ELSE
        cnt := tech_assigned_dates;
        mult := 1.0;
        per_job_multiplier := 1.0;
      END IF;
    END;
  ELSE
    cnt := 1;
    mult := 1.0;
    per_job_multiplier := 1.0;
  END IF;

  base := ROUND(base * per_job_multiplier, 2);

  extras := public.extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
  final_total := ROUND(base + extras_total, 2);

  disclaimer := public.needs_vehicle_disclaimer(_tech_id);

  RETURN jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'start_time', st,
    'job_type', jtype,
    'tour_id', tour_group,
    'is_house_tech', house,
    'is_tour_team_member', team_member,
    'use_tour_multipliers', has_override,
    'category', cat,
    'base_day_eur', base,
    'has_custom_rate', has_custom_rate,
    'autonomo_discount_eur', ROUND(autonomo_discount, 2),
    'base_day_before_discount_eur', ROUND(base_day_before_discount, 2),
    'week_count', cnt,
    'multiplier', mult,
    'per_job_multiplier', ROUND(per_job_multiplier, 3),
    'iso_year', y,
    'iso_week', w,
    'total_eur', ROUND(base, 2),
    'extras', extras,
    'extras_total_eur', ROUND(extras_total, 2),
    'total_with_extras_eur', ROUND(final_total, 2),
    'vehicle_disclaimer', disclaimer,
    'vehicle_disclaimer_text', CASE WHEN disclaimer THEN 'Se requiere vehículo propio' ELSE NULL END,
    'breakdown', jsonb_build_object(
      'base_calculation', ROUND(base_day_before_discount, 2),
      'autonomo_discount', ROUND(autonomo_discount, 2),
      'after_discount', ROUND(base_after_discount, 2),
      'multiplier', mult,
      'per_job_multiplier', ROUND(per_job_multiplier, 3),
      'final_base', ROUND(base, 2),
      'has_custom_rate', has_custom_rate
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10) Timesheet amount computation RPC (restrict to owner/management/service_role)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_timesheet_amount_2025(
  _timesheet_id uuid,
  _persist boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_timesheet RECORD;
  v_job_type TEXT;
  v_category TEXT;
  v_rate_card RECORD;
  v_worked_hours NUMERIC;
  v_billable_hours NUMERIC;
  v_base_day_amount NUMERIC := 0;
  v_plus_10_12_hours NUMERIC := 0;
  v_plus_10_12_amount NUMERIC := 0;
  v_overtime_hours NUMERIC := 0;
  v_overtime_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_breakdown JSONB;
  v_result JSONB;
BEGIN
  SELECT
    t.*,
    j.job_type,
    COALESCE(
      t.category,
      CASE
        WHEN a.sound_role LIKE '%-R' OR a.lights_role LIKE '%-R' OR a.video_role LIKE '%-R' THEN 'responsable'
        WHEN a.sound_role LIKE '%-E' OR a.lights_role LIKE '%-E' OR a.video_role LIKE '%-E' THEN 'especialista'
        WHEN a.sound_role LIKE '%-T' OR a.lights_role LIKE '%-T' OR a.video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END,
      'tecnico'
    ) as category
  INTO v_timesheet
  FROM public.timesheets t
  LEFT JOIN public.jobs j ON t.job_id = j.id
  LEFT JOIN public.job_assignments a ON t.job_id = a.job_id AND t.technician_id = a.technician_id
  LEFT JOIN public.profiles p ON t.technician_id = p.id
  WHERE t.id = _timesheet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet not found: %', _timesheet_id;
  END IF;

  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin_or_management()
    OR auth.uid() = v_timesheet.technician_id
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  v_job_type := v_timesheet.job_type;
  v_category := v_timesheet.category;

  SELECT
    base_day_eur,
    COALESCE(plus_10_12_eur, (SELECT plus_10_12_eur FROM public.rate_cards_2025 WHERE category = v_category LIMIT 1)) as plus_10_12_eur,
    COALESCE(overtime_hour_eur, (SELECT overtime_hour_eur FROM public.rate_cards_2025 WHERE category = v_category LIMIT 1)) as overtime_hour_eur
  INTO v_rate_card
  FROM public.custom_tech_rates
  WHERE profile_id = v_timesheet.technician_id;

  IF NOT FOUND THEN
    SELECT * INTO v_rate_card
    FROM public.rate_cards_2025
    WHERE category = v_category;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rate card not found for category: %', v_category;
    END IF;
  END IF;

  IF v_timesheet.end_time < v_timesheet.start_time OR COALESCE(v_timesheet.ends_next_day, false) THEN
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time + INTERVAL '24 hours'
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  ELSE
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  END IF;

  -- FIXED: Round to nearest whole hour (12.0-12.49 -> 12h, 12.5-12.99 -> 13h)
  -- Previously: Rounded to nearest 0.5 (12.7 -> 12.5)
  v_worked_hours := ROUND(v_worked_hours);

  IF v_job_type = 'evento' THEN
    v_billable_hours := 12.0;
    v_base_day_amount := v_rate_card.base_day_eur;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := v_rate_card.plus_10_12_eur;
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_total_amount := v_base_day_amount + v_plus_10_12_amount;
  ELSE
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rate_card.base_day_eur;

    IF v_worked_hours <= 10.5 THEN
      v_total_amount := v_base_day_amount;
    ELSIF v_worked_hours <= 12.5 THEN
      v_plus_10_12_hours := 0;
      v_plus_10_12_amount := 30.0;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount;
    ELSE
      v_plus_10_12_hours := 0;
      v_plus_10_12_amount := 30.0;

      v_overtime_hours := v_worked_hours - 12.5;
      v_overtime_hours := CEILING(v_overtime_hours);

      v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount + v_overtime_amount;
    END IF;
  END IF;

  v_breakdown := jsonb_build_object(
    'worked_hours', v_worked_hours,
    'worked_hours_rounded', v_worked_hours,
    'hours_rounded', v_worked_hours,
    'billable_hours', v_billable_hours,
    'is_evento', (v_job_type = 'evento'),
    'base_amount_eur', COALESCE(v_base_day_amount, 0),
    'base_day_eur', COALESCE(v_base_day_amount, 0),
    'plus_10_12_hours', COALESCE(v_plus_10_12_hours, 0),
    'plus_10_12_eur', v_rate_card.plus_10_12_eur,
    'plus_10_12_amount_eur', COALESCE(v_plus_10_12_amount, 0),
    'overtime_hours', COALESCE(v_overtime_hours, 0),
    'overtime_hour_eur', v_rate_card.overtime_hour_eur,
    'overtime_amount_eur', COALESCE(v_overtime_amount, 0),
    'total_eur', v_total_amount,
    'category', v_category
  );

  v_result := jsonb_build_object(
    'timesheet_id', _timesheet_id,
    'amount_eur', v_total_amount,
    'amount_breakdown', v_breakdown
  );

  IF _persist THEN
    UPDATE public.timesheets
    SET
      amount_eur = v_total_amount,
      amount_breakdown = v_breakdown,
      category = v_category,
      updated_at = NOW()
    WHERE id = _timesheet_id;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.compute_timesheet_amount_2025(uuid,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.compute_timesheet_amount_2025(uuid,boolean) TO authenticated, service_role;
