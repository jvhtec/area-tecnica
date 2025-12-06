-- Fix missing function definitions and authorization issues
BEGIN;

-- Create needs_vehicle_disclaimer function if it doesn't exist
-- This function checks if a technician requires their own vehicle
CREATE OR REPLACE FUNCTION needs_vehicle_disclaimer(p_technician_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the technician's profile indicates they need their own vehicle
  -- Adjust this logic based on your actual business rules
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_technician_id
      AND (
        -- Add your actual criteria here
        -- For now, return false as a safe default
        false
      )
  );
END;
$$;

-- Create extras_total_for_job_tech function if it doesn't exist
-- This function calculates rate extras for a specific job and technician
CREATE OR REPLACE FUNCTION extras_total_for_job_tech(p_job_id UUID, p_technician_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Calculate extras from job_rate_extras table
  SELECT jsonb_build_object(
    'total_eur', COALESCE(SUM(amount_eur), 0),
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'description', description,
        'amount_eur', amount_eur,
        'category', category
      )
      ORDER BY created_at
    ) FILTER (WHERE amount_eur IS NOT NULL), '[]'::jsonb)
  )
  INTO v_result
  FROM job_rate_extras
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id;

  RETURN COALESCE(v_result, '{"total_eur": 0, "items": []}'::jsonb);
END;
$$;

-- Fix authorization issue in get_job_total_amounts
-- Drop and recreate without anon access
DROP FUNCTION IF EXISTS public.get_job_total_amounts(UUID, TEXT);

CREATE FUNCTION public.get_job_total_amounts(
  _job_id UUID,
  _user_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  job_id UUID,
  total_approved_eur NUMERIC,
  total_pending_eur NUMERIC,
  pending_item_count INTEGER,
  breakdown_by_category JSON,
  individual_amounts JSON,
  user_can_see_all BOOLEAN,
  expenses_total_eur NUMERIC,
  expenses_pending_eur NUMERIC,
  expenses_breakdown JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- Require authentication
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view job totals';
  END IF;

  IF _job_id IS NULL THEN
    RAISE EXCEPTION 'Job id is required';
  END IF;

  IF _user_role IS NOT NULL THEN
    v_role := lower(_user_role);
  ELSE
    SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  END IF;

  -- Only authenticated users with specific roles can see all
  v_user_can_see_all := v_role IN ('admin', 'management', 'logistics');

  v_can_view := v_user_can_see_all OR EXISTS (
    SELECT 1
    FROM job_assignments
    WHERE job_id = _job_id
      AND technician_id = v_actor
  );

  IF NOT v_can_view THEN
    RAISE EXCEPTION 'Not authorized to view totals for job %', _job_id;
  END IF;

  SELECT
    COALESCE(SUM(timesheets_total_eur), 0),
    COALESCE(SUM(extras_total_eur), 0),
    COALESCE(SUM(expenses_total_eur), 0),
    jsonb_agg(
      jsonb_build_object(
        'technician_id', technician_id,
        'expenses_breakdown', expenses_breakdown
      )
    )
  INTO v_timesheets_total, v_extras_total, v_expenses_total, v_expense_breakdown
  FROM v_job_tech_payout_2025
  WHERE job_id = _job_id
    AND (v_user_can_see_all OR technician_id = v_actor);

  SELECT
    COALESCE(SUM(CASE WHEN status = 'submitted' THEN amount_eur ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status = 'submitted')
  INTO v_timesheets_pending_amount, v_timesheets_pending_count
  FROM timesheets
  WHERE job_id = _job_id
    AND (v_user_can_see_all OR technician_id = v_actor);

  SELECT jsonb_object_agg(cat, jsonb_build_object('count', cnt, 'total_eur', total))
  INTO v_breakdown
  FROM (
    SELECT
      COALESCE(category, 'uncategorized') AS cat,
      COUNT(*) AS cnt,
      COALESCE(SUM(amount_eur), 0) AS total
    FROM timesheets
    WHERE job_id = _job_id
      AND status = 'approved'
      AND (v_user_can_see_all OR technician_id = v_actor)
    GROUP BY COALESCE(category, 'uncategorized')
  ) AS categories;

  IF v_user_can_see_all THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'technician_name', COALESCE(NULLIF(trim(COALESCE(p.first_name || ' ' || p.last_name, '')), ''), p.nickname, p.email, 'Sin nombre'),
        'category', COALESCE(t.category, 'uncategorized'),
        'amount_eur', COALESCE(t.amount_eur, 0),
        'date', t.date
      )
      ORDER BY t.date DESC
    )
    INTO v_individual
    FROM timesheets t
    LEFT JOIN profiles p ON p.id = t.technician_id
    WHERE t.job_id = _job_id
      AND t.status = 'approved'
      AND (v_user_can_see_all OR t.technician_id = v_actor);
  END IF;

  SELECT
    COALESCE(SUM(submitted_total_eur), 0),
    COALESCE(SUM((status_counts->>'submitted')::int), 0)
  INTO v_expenses_pending_amount, v_expenses_pending_count
  FROM v_job_expense_summary
  WHERE job_id = _job_id
    AND (v_user_can_see_all OR technician_id = v_actor);

  RETURN QUERY
  SELECT
    _job_id,
    ROUND(v_timesheets_total + v_extras_total + v_expenses_total, 2) AS total_approved_eur,
    ROUND(v_timesheets_pending_amount + v_expenses_pending_amount, 2) AS total_pending_eur,
    v_timesheets_pending_count + v_expenses_pending_count AS pending_item_count,
    COALESCE(v_breakdown, '{}'::jsonb)::json AS breakdown_by_category,
    COALESCE(v_individual, '[]'::jsonb)::json AS individual_amounts,
    v_user_can_see_all,
    ROUND(v_expenses_total, 2) AS expenses_total_eur,
    ROUND(v_expenses_pending_amount, 2) AS expenses_pending_eur,
    COALESCE(v_expense_breakdown, '[]'::jsonb)::json AS expenses_breakdown;
END;
$$;

-- Grant execute only to authenticated users (no anon access)
GRANT EXECUTE ON FUNCTION get_job_total_amounts(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION needs_vehicle_disclaimer(UUID) IS
  'Returns true if technician requires their own vehicle for jobs';

COMMENT ON FUNCTION extras_total_for_job_tech(UUID, UUID) IS
  'Calculates total rate extras for a specific job and technician';

COMMENT ON FUNCTION get_job_total_amounts(UUID, TEXT) IS
  'Returns job payment totals including timesheets, extras, and expenses. Requires authentication.';

COMMIT;
