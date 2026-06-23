-- Phase 0 enterprise hardening:
--   * prevent profile privilege escalation
--   * scope availability and vacation writes
--   * remove caller-controlled payout authorization
--   * close unsafe SECURITY DEFINER grants
--   * fix the four application errors reported by `supabase db lint --linked`

-- ---------------------------------------------------------------------------
-- Profile privilege boundary
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_profile_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_department text;
  v_changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.email IS DISTINCT FROM NEW.email THEN
    v_changed_fields := array_append(v_changed_fields, 'email');
  END IF;
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    v_changed_fields := array_append(v_changed_fields, 'role');
  END IF;
  IF OLD.department IS DISTINCT FROM NEW.department THEN
    v_changed_fields := array_append(v_changed_fields, 'department');
  END IF;
  IF OLD.assignable_as_tech IS DISTINCT FROM NEW.assignable_as_tech THEN
    v_changed_fields := array_append(v_changed_fields, 'assignable_as_tech');
  END IF;
  IF OLD.default_timesheet_category IS DISTINCT FROM NEW.default_timesheet_category THEN
    v_changed_fields := array_append(v_changed_fields, 'default_timesheet_category');
  END IF;
  IF OLD.soundvision_access_enabled IS DISTINCT FROM NEW.soundvision_access_enabled THEN
    v_changed_fields := array_append(v_changed_fields, 'soundvision_access_enabled');
  END IF;
  IF OLD.autonomo IS DISTINCT FROM NEW.autonomo THEN
    v_changed_fields := array_append(v_changed_fields, 'autonomo');
  END IF;
  IF OLD.warehouse_duty_exempt IS DISTINCT FROM NEW.warehouse_duty_exempt THEN
    v_changed_fields := array_append(v_changed_fields, 'warehouse_duty_exempt');
  END IF;
  IF OLD.flex_user_id IS DISTINCT FROM NEW.flex_user_id THEN
    v_changed_fields := array_append(v_changed_fields, 'flex_user_id');
  END IF;
  IF OLD.flex_id IS DISTINCT FROM NEW.flex_id THEN
    v_changed_fields := array_append(v_changed_fields, 'flex_id');
  END IF;
  IF OLD.flex_resource_id IS DISTINCT FROM NEW.flex_resource_id THEN
    v_changed_fields := array_append(v_changed_fields, 'flex_resource_id');
  END IF;
  IF OLD.waha_endpoint IS DISTINCT FROM NEW.waha_endpoint THEN
    v_changed_fields := array_append(v_changed_fields, 'waha_endpoint');
  END IF;

  IF cardinality(v_changed_fields) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT p.role::text, p.department
  INTO v_actor_role, v_actor_department
  FROM public.profiles p
  WHERE p.id = v_actor;

  IF v_actor = OLD.id THEN
    RAISE EXCEPTION 'Privileged profile fields cannot be changed on your own account'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Only administrators and management may change privileged profile fields'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor_role = 'management' THEN
    IF OLD.department IS DISTINCT FROM v_actor_department THEN
      RAISE EXCEPTION 'Management may only change profiles in their department'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.role::text IN ('admin', 'management')
       OR NEW.role::text IN ('admin', 'management') THEN
      RAISE EXCEPTION 'Management may not assign or modify administrative roles'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource,
    severity,
    metadata
  )
  VALUES (
    v_actor,
    'profile_privilege_change',
    'profile:' || OLD.id::text,
    CASE WHEN 'role' = ANY(v_changed_fields) THEN 'critical' ELSE 'high' END,
    jsonb_build_object(
      'changed_fields', to_jsonb(v_changed_fields),
      'actor_role', v_actor_role,
      'old_role', OLD.role::text,
      'new_role', NEW.role::text,
      'old_department', OLD.department,
      'new_department', NEW.department
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_privilege_changes ON public.profiles;
CREATE TRIGGER enforce_profile_privilege_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_privilege_changes();

REVOKE ALL ON FUNCTION public.enforce_profile_privilege_changes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_profile_privilege_changes() TO service_role;

-- ---------------------------------------------------------------------------
-- Department-scoped technician management helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_manage_technician(p_technician_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles actor
      JOIN public.profiles target ON target.id::text = p_technician_id
      WHERE actor.id = auth.uid()
        AND (
          actor.role = 'admin'::public.user_role
          OR (
            actor.role = 'management'::public.user_role
            AND actor.department IS NOT DISTINCT FROM target.department
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_technician(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_technician(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Availability and vacation RLS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "p_technician_availability_public_delete_ce70b4" ON public.technician_availability;
DROP POLICY IF EXISTS "p_technician_availability_public_insert_46f742" ON public.technician_availability;
DROP POLICY IF EXISTS "p_technician_availability_public_select_cfa90a" ON public.technician_availability;
DROP POLICY IF EXISTS "p_technician_availability_public_update_c42e80" ON public.technician_availability;

CREATE POLICY technician_availability_select_scoped
ON public.technician_availability
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()::text
  OR public.can_manage_technician(technician_id)
);

CREATE POLICY technician_availability_insert_scoped
ON public.technician_availability
FOR INSERT
TO authenticated
WITH CHECK (
  technician_id = auth.uid()::text
  OR public.can_manage_technician(technician_id)
);

CREATE POLICY technician_availability_update_scoped
ON public.technician_availability
FOR UPDATE
TO authenticated
USING (
  technician_id = auth.uid()::text
  OR public.can_manage_technician(technician_id)
)
WITH CHECK (
  technician_id = auth.uid()::text
  OR public.can_manage_technician(technician_id)
);

CREATE POLICY technician_availability_delete_scoped
ON public.technician_availability
FOR DELETE
TO authenticated
USING (
  technician_id = auth.uid()::text
  OR public.can_manage_technician(technician_id)
);

REVOKE ALL ON TABLE public.technician_availability FROM anon;
REVOKE ALL ON SEQUENCE public.technician_availability_id_seq FROM anon;

CREATE OR REPLACE FUNCTION public.enforce_vacation_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.technician_id = v_actor THEN
    IF OLD.status <> 'pending'
       OR NEW.status <> 'pending'
       OR NEW.technician_id IS DISTINCT FROM OLD.technician_id
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Pending vacation owners may only change dates and reason'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF NOT public.can_manage_technician(OLD.technician_id::text)
     OR NEW.technician_id IS DISTINCT FROM OLD.technician_id THEN
    RAISE EXCEPTION 'Not authorized to update this vacation request'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_vacation_request_update ON public.vacation_requests;
CREATE TRIGGER enforce_vacation_request_update
BEFORE UPDATE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_vacation_request_update();

REVOKE ALL ON FUNCTION public.enforce_vacation_request_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_vacation_request_update() TO service_role;

DROP POLICY IF EXISTS "p_vacation_requests_public_delete_553dfc" ON public.vacation_requests;
DROP POLICY IF EXISTS "p_vacation_requests_public_insert_7548f9" ON public.vacation_requests;
DROP POLICY IF EXISTS "p_vacation_requests_public_select_69263e" ON public.vacation_requests;
DROP POLICY IF EXISTS "p_vacation_requests_public_update_1af407" ON public.vacation_requests;

CREATE POLICY vacation_requests_select_scoped
ON public.vacation_requests
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()
  OR public.can_manage_technician(technician_id::text)
);

CREATE POLICY vacation_requests_insert_scoped
ON public.vacation_requests
FOR INSERT
TO authenticated
WITH CHECK (
  technician_id = auth.uid()
  OR public.can_manage_technician(technician_id::text)
);

CREATE POLICY vacation_requests_update_scoped
ON public.vacation_requests
FOR UPDATE
TO authenticated
USING (
  (technician_id = auth.uid() AND status = 'pending')
  OR public.can_manage_technician(technician_id::text)
)
WITH CHECK (
  technician_id = auth.uid()
  OR public.can_manage_technician(technician_id::text)
);

CREATE POLICY vacation_requests_delete_scoped
ON public.vacation_requests
FOR DELETE
TO authenticated
USING (
  (technician_id = auth.uid() AND status = 'pending')
  OR public.can_manage_technician(technician_id::text)
);

REVOKE ALL ON TABLE public.vacation_requests FROM anon;

-- ---------------------------------------------------------------------------
-- External API quota ledger (service-role only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.external_api_usage (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  service text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  request_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  CONSTRAINT external_api_usage_service_check
    CHECK (char_length(service) BETWEEN 1 AND 80)
);

CREATE INDEX IF NOT EXISTS external_api_usage_actor_service_date_idx
ON public.external_api_usage (actor_id, service, request_date);

ALTER TABLE public.external_api_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_api_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.external_api_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.external_api_usage_id_seq TO service_role;

CREATE POLICY external_api_usage_service_role_all
ON public.external_api_usage
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.consume_external_api_quota(
  p_actor_id uuid,
  p_service text,
  p_daily_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_usage_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF p_actor_id IS NULL
     OR NULLIF(trim(p_service), '') IS NULL
     OR p_daily_limit < 1 THEN
    RAISE EXCEPTION 'Invalid external API quota request';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_actor_id::text || ':' || p_service, 0)
  );

  SELECT count(*)::integer
  INTO v_usage_count
  FROM public.external_api_usage usage
  WHERE usage.actor_id = p_actor_id
    AND usage.service = p_service
    AND usage.request_date = (now() AT TIME ZONE 'UTC')::date;

  IF v_usage_count >= p_daily_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.external_api_usage (actor_id, service)
  VALUES (p_actor_id, p_service);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_external_api_quota(uuid, text, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_external_api_quota(uuid, text, integer)
TO service_role;

-- ---------------------------------------------------------------------------
-- Remove caller-controlled payout authorization and qualify every identifier.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_job_total_amounts(uuid, text);

CREATE OR REPLACE FUNCTION public.get_job_total_amounts(_job_id uuid)
RETURNS TABLE(
  job_id uuid,
  total_approved_eur numeric,
  total_pending_eur numeric,
  pending_item_count integer,
  breakdown_by_category json,
  individual_amounts json,
  user_can_see_all boolean,
  expenses_total_eur numeric,
  expenses_pending_eur numeric,
  expenses_breakdown json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_user_can_see_all boolean := false;
  v_can_view boolean := false;
  v_timesheets_pending_count integer := 0;
  v_timesheets_pending_amount numeric := 0;
  v_timesheets_total numeric := 0;
  v_extras_total numeric := 0;
  v_expenses_total numeric := 0;
  v_expenses_pending_amount numeric := 0;
  v_expenses_pending_count integer := 0;
  v_breakdown jsonb := '{}'::jsonb;
  v_individual jsonb := '[]'::jsonb;
  v_expense_breakdown jsonb := '[]'::jsonb;
BEGIN
  IF _job_id IS NULL THEN
    RAISE EXCEPTION 'Job id is required';
  END IF;

  IF auth.role() = 'service_role' THEN
    v_role := 'admin';
  ELSE
    IF v_actor IS NULL THEN
      RAISE EXCEPTION 'Authentication required to view job totals'
        USING ERRCODE = '42501';
    END IF;

    SELECT lower(p.role::text)
    INTO v_role
    FROM public.profiles p
    WHERE p.id = v_actor;
  END IF;

  v_user_can_see_all := v_role IN ('admin', 'management', 'logistics');
  v_can_view := v_user_can_see_all OR EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id
      AND ja.technician_id = v_actor
  );

  IF NOT v_can_view THEN
    RAISE EXCEPTION 'Not authorized to view totals for job %', _job_id
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(SUM(payout.timesheets_total_eur), 0),
    COALESCE(SUM(payout.extras_total_eur), 0),
    COALESCE(SUM(payout.expenses_total_eur), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'technician_id', payout.technician_id,
          'expenses_breakdown', payout.expenses_breakdown
        )
      ),
      '[]'::jsonb
    )
  INTO v_timesheets_total, v_extras_total, v_expenses_total, v_expense_breakdown
  FROM public.v_job_tech_payout_2025 payout
  WHERE payout.job_id = _job_id
    AND (v_user_can_see_all OR payout.technician_id = v_actor);

  SELECT
    COALESCE(SUM(CASE WHEN t.status = 'submitted' THEN t.amount_eur ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE t.status = 'submitted')
  INTO v_timesheets_pending_amount, v_timesheets_pending_count
  FROM public.timesheets t
  WHERE t.job_id = _job_id
    AND COALESCE(t.is_active, true)
    AND (v_user_can_see_all OR t.technician_id = v_actor);

  SELECT jsonb_object_agg(categories.cat, jsonb_build_object(
    'count', categories.cnt,
    'total_eur', categories.total
  ))
  INTO v_breakdown
  FROM (
    SELECT
      COALESCE(t.category, 'uncategorized') AS cat,
      COUNT(*) AS cnt,
      COALESCE(SUM(t.amount_eur), 0) AS total
    FROM public.timesheets t
    WHERE t.job_id = _job_id
      AND t.status = 'approved'
      AND COALESCE(t.is_active, true)
      AND (v_user_can_see_all OR t.technician_id = v_actor)
    GROUP BY COALESCE(t.category, 'uncategorized')
  ) AS categories;

  IF v_user_can_see_all THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'technician_name', COALESCE(
            NULLIF(trim(COALESCE(p.first_name || ' ' || p.last_name, '')), ''),
            p.nickname,
            p.email,
            'Sin nombre'
          ),
          'category', COALESCE(t.category, 'uncategorized'),
          'amount_eur', COALESCE(t.amount_eur, 0),
          'date', t.date
        )
        ORDER BY t.date DESC
      ),
      '[]'::jsonb
    )
    INTO v_individual
    FROM public.timesheets t
    LEFT JOIN public.profiles p ON p.id = t.technician_id
    WHERE t.job_id = _job_id
      AND t.status = 'approved'
      AND COALESCE(t.is_active, true);
  END IF;

  SELECT
    COALESCE(SUM(expenses.submitted_total_eur), 0),
    COALESCE(SUM((expenses.status_counts->>'submitted')::int), 0)
  INTO v_expenses_pending_amount, v_expenses_pending_count
  FROM public.v_job_expense_summary expenses
  WHERE expenses.job_id = _job_id
    AND (v_user_can_see_all OR expenses.technician_id = v_actor);

  RETURN QUERY
  SELECT
    _job_id,
    ROUND(v_timesheets_total + v_extras_total + v_expenses_total, 2),
    ROUND(v_timesheets_pending_amount + v_expenses_pending_amount, 2),
    v_timesheets_pending_count + v_expenses_pending_count,
    COALESCE(v_breakdown, '{}'::jsonb)::json,
    COALESCE(v_individual, '[]'::jsonb)::json,
    v_user_can_see_all,
    ROUND(v_expenses_total, 2),
    ROUND(v_expenses_pending_amount, 2),
    COALESCE(v_expense_breakdown, '[]'::jsonb)::json;
END;
$$;

REVOKE ALL ON FUNCTION public.get_job_total_amounts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_total_amounts(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Production database lint repairs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_complete_past_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  updated_count integer;
  job_ids uuid[];
  ts_ids uuid[];
  ts_id uuid;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  WITH updated AS (
    UPDATE public.jobs j
    SET status = 'Completado'::public.job_status
    WHERE now() >= (
            date_trunc(
              'day',
              (j.end_time AT TIME ZONE COALESCE(j.timezone, 'Europe/Madrid'))
              + interval '7 days'
            ) AT TIME ZONE COALESCE(j.timezone, 'Europe/Madrid')
          )
      AND j.status NOT IN (
        'Cancelado'::public.job_status,
        'Completado'::public.job_status
      )
    RETURNING j.id
  )
  SELECT array_agg(updated.id), count(*)::integer
  INTO job_ids, updated_count
  FROM updated;

  IF job_ids IS NULL THEN
    RETURN 0;
  END IF;

  SELECT array_agg(updated_timesheets.id)
  INTO ts_ids
  FROM (
    UPDATE public.timesheets t
    SET start_time = COALESCE(t.start_time, '09:00'::time),
        end_time = COALESCE(t.end_time, '17:00'::time),
        break_minutes = COALESCE(t.break_minutes, 0),
        ends_next_day = COALESCE(t.ends_next_day, false)
    WHERE t.job_id = ANY(job_ids)
      AND t.is_active = true
      AND (
        t.start_time IS NULL
        OR t.end_time IS NULL
        OR t.break_minutes IS NULL
        OR t.ends_next_day IS NULL
      )
    RETURNING t.id
  ) updated_timesheets;

  IF ts_ids IS NOT NULL THEN
    FOREACH ts_id IN ARRAY ts_ids LOOP
      PERFORM public.compute_timesheet_amount_2025(ts_id, true);
    END LOOP;
  END IF;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_complete_past_jobs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_complete_past_jobs() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_timesheet_effective_rate(_timesheet_id uuid)
RETURNS TABLE(
  timesheet_id uuid,
  category text,
  technician_id uuid,
  base_day_default numeric,
  plus_10_12_default numeric,
  overtime_default numeric,
  base_day_override numeric,
  plus_10_12_override numeric,
  overtime_override numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.is_admin_or_management()
     AND NOT EXISTS (
       SELECT 1
       FROM public.timesheets owned
       WHERE owned.id = _timesheet_id
         AND owned.technician_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.category,
    t.technician_id,
    rc.base_day_eur,
    rc.plus_10_12_eur,
    rc.overtime_hour_eur,
    CASE
      WHEN t.category = 'responsable' THEN COALESCE(
        ctr.base_day_responsable_eur,
        ctr.base_day_especialista_eur,
        ctr.base_day_eur
      )
      WHEN t.category = 'especialista' THEN COALESCE(
        ctr.base_day_especialista_eur,
        ctr.base_day_eur
      )
      ELSE ctr.base_day_eur
    END,
    ctr.plus_10_12_eur,
    CASE
      WHEN t.category = 'responsable' THEN COALESCE(
        ctr.overtime_hour_responsable_eur,
        ctr.overtime_hour_especialista_eur,
        ctr.overtime_hour_eur
      )
      WHEN t.category = 'especialista' THEN COALESCE(
        ctr.overtime_hour_especialista_eur,
        ctr.overtime_hour_eur
      )
      ELSE ctr.overtime_hour_eur
    END
  FROM public.timesheets t
  LEFT JOIN public.rate_cards_2025 rc ON rc.category = t.category
  LEFT JOIN public.custom_tech_rates ctr ON ctr.profile_id = t.technician_id
  WHERE t.id = _timesheet_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_timesheet_effective_rate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_timesheet_effective_rate(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.find_declined_with_active_timesheets()
RETURNS TABLE(
  job_id uuid,
  technician_id uuid,
  assignment_status text,
  active_timesheet_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin_or_management() THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ja.job_id,
    ja.technician_id,
    ja.status::text,
    COUNT(ts.date)::bigint
  FROM public.job_assignments ja
  JOIN public.timesheets ts
    ON ts.job_id = ja.job_id
   AND ts.technician_id = ja.technician_id
  WHERE ja.status::text = 'declined'
    AND ts.is_active = true
  GROUP BY ja.job_id, ja.technician_id, ja.status;
END;
$$;

REVOKE ALL ON FUNCTION public.find_declined_with_active_timesheets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_declined_with_active_timesheets() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER execution grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.log_activity_as(
  uuid, text, uuid, text, text, jsonb, public.activity_visibility
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity_as(
  uuid, text, uuid, text, text, jsonb, public.activity_visibility
) TO service_role;

REVOKE ALL ON FUNCTION public.log_activity(
  text, uuid, text, text, jsonb, public.activity_visibility
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(
  text, uuid, text, text, jsonb, public.activity_visibility
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.clear_tour_preset_assignments(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_tour_preset_assignments(uuid, uuid)
TO service_role;

REVOKE ALL ON FUNCTION public.sync_preset_assignments_for_tour(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_preset_assignments_for_tour(uuid, uuid)
TO service_role;

REVOKE ALL ON FUNCTION public.invoke_scheduled_push_notification(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_scheduled_push_notification(text)
TO service_role;

REVOKE ALL ON FUNCTION public.get_tour_complete_timeline(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tour_complete_timeline(uuid)
TO service_role;

REVOKE ALL ON FUNCTION public.get_tour_date_complete_info(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tour_date_complete_info(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_job_ids(user_uuid uuid)
RETURNS TABLE(job_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT DISTINCT ja.job_id
  FROM public.job_assignments ja
  WHERE ja.technician_id = user_uuid
    AND (
      auth.role() = 'service_role'
      OR user_uuid = auth.uid()
      OR public.is_admin_or_management()
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_job_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_job_ids(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_venue(
  p_name text,
  p_google_place_id text,
  p_city text,
  p_state_region text,
  p_country text,
  p_full_address text DEFAULT NULL,
  p_coordinates jsonb DEFAULT NULL,
  p_capacity integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_venue_id uuid;
  v_role text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    SELECT p.role::text
    INTO v_role
    FROM public.profiles p
    WHERE p.id = auth.uid();

    IF v_role NOT IN ('admin', 'management', 'house_tech', 'technician', 'logistics') THEN
      RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(trim(p_name), '') IS NULL
     OR NULLIF(trim(p_city), '') IS NULL
     OR NULLIF(trim(p_country), '') IS NULL THEN
    RAISE EXCEPTION 'Venue name, city and country are required';
  END IF;

  IF p_google_place_id IS NOT NULL THEN
    SELECT v.id
    INTO v_venue_id
    FROM public.venues v
    WHERE v.google_place_id = p_google_place_id;
  END IF;

  IF v_venue_id IS NOT NULL THEN
    UPDATE public.venues v
    SET name = p_name,
        city = p_city,
        state_region = p_state_region,
        country = p_country,
        full_address = COALESCE(p_full_address, v.full_address),
        coordinates = COALESCE(p_coordinates, v.coordinates),
        capacity = COALESCE(p_capacity, v.capacity),
        updated_at = now()
    WHERE v.id = v_venue_id;
  ELSE
    INSERT INTO public.venues (
      name,
      google_place_id,
      city,
      state_region,
      country,
      full_address,
      coordinates,
      capacity
    )
    VALUES (
      p_name,
      p_google_place_id,
      p_city,
      p_state_region,
      p_country,
      p_full_address,
      p_coordinates,
      p_capacity
    )
    RETURNING id INTO v_venue_id;
  END IF;

  RETURN v_venue_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_venue(
  text, text, text, text, text, text, jsonb, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_venue(
  text, text, text, text, text, text, jsonb, integer
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_expense_permission(
  uuid, uuid, text, date, date, numeric, numeric, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_expense_permission(
  uuid, uuid, text, date, date, numeric, numeric, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_job_expense(
  uuid, text, date, numeric, text, numeric, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_job_expense(
  uuid, text, date, numeric, text, numeric, text, text, uuid
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_technician_payout_override(uuid, uuid, numeric)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_technician_payout_override(uuid, uuid, numeric)
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.remove_technician_payout_override(uuid, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_technician_payout_override(uuid, uuid)
TO authenticated, service_role;
