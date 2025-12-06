-- Fix missing function definitions and authorization issues
BEGIN;

-- Drop views that depend on the functions we need to recreate
DROP VIEW IF EXISTS v_job_tech_payout_2025 CASCADE;
DROP VIEW IF EXISTS v_job_tech_payout_2025_base CASCADE;

-- Now drop and recreate functions with correct parameter names
DROP FUNCTION IF EXISTS needs_vehicle_disclaimer(uuid);
DROP FUNCTION IF EXISTS extras_total_for_job_tech(uuid, uuid);

-- Create needs_vehicle_disclaimer function with matching parameter name
-- This function checks if a technician requires their own vehicle
CREATE FUNCTION needs_vehicle_disclaimer(_profile_id UUID)
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
    WHERE id = _profile_id
      AND (
        -- Add your actual criteria here
        -- For now, return false as a safe default
        false
      )
  );
END;
$$;

-- Create extras_total_for_job_tech function with matching parameter names
-- This function calculates rate extras for a specific job and technician
CREATE FUNCTION extras_total_for_job_tech(_job_id UUID, _technician_id UUID)
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
  WHERE job_id = _job_id
    AND technician_id = _technician_id;

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

-- Recreate v_job_expense_summary view (dropped by CASCADE earlier)
-- This view is required by v_job_tech_payout_2025_base
CREATE OR REPLACE VIEW public.v_job_expense_summary AS
WITH stats AS (
  SELECT
    job_id,
    technician_id,
    category_slug,
    status,
    COUNT(*) AS entry_count,
    COALESCE(SUM(amount_eur), 0) AS total_eur
  FROM job_expenses
  GROUP BY job_id, technician_id, category_slug, status
)
SELECT
  s.job_id,
  s.technician_id,
  s.category_slug,
  SUM(s.entry_count) AS total_count,
  COALESCE(jsonb_object_agg(s.status, s.entry_count), '{}'::jsonb) AS status_counts,
  COALESCE(jsonb_object_agg(s.status, s.total_eur), '{}'::jsonb) AS amount_totals,
  COALESCE(SUM(CASE WHEN s.status = 'approved' THEN s.total_eur ELSE 0 END), 0)::numeric(12, 2) AS approved_total_eur,
  COALESCE(SUM(CASE WHEN s.status = 'submitted' THEN s.total_eur ELSE 0 END), 0)::numeric(12, 2) AS submitted_total_eur,
  COALESCE(SUM(CASE WHEN s.status = 'draft' THEN s.total_eur ELSE 0 END), 0)::numeric(12, 2) AS draft_total_eur,
  COALESCE(SUM(CASE WHEN s.status = 'rejected' THEN s.total_eur ELSE 0 END), 0)::numeric(12, 2) AS rejected_total_eur,
  (
    SELECT MAX(GREATEST(
      COALESCE(e.updated_at, e.created_at),
      COALESCE(e.submitted_at, e.created_at)
    ))
    FROM job_expenses e
    WHERE e.job_id = s.job_id
      AND e.technician_id = s.technician_id
      AND e.category_slug = s.category_slug
      AND e.receipt_path IS NOT NULL
  ) AS last_receipt_at
FROM stats s
GROUP BY s.job_id, s.technician_id, s.category_slug;

GRANT SELECT ON v_job_expense_summary TO authenticated, service_role;

COMMENT ON VIEW v_job_expense_summary IS
  'Per-job/tech/category rollup of expense counts and totals by status';

-- Recreate the views that were dropped at the beginning
-- Base view with expense integration
CREATE VIEW v_job_tech_payout_2025_base AS
WITH base AS (
  SELECT DISTINCT job_id, technician_id FROM job_assignments
  UNION
  SELECT DISTINCT job_id, technician_id FROM timesheets
  UNION
  SELECT DISTINCT job_id, technician_id FROM job_rate_extras
  UNION
  SELECT DISTINCT job_id, technician_id FROM job_expenses
),
expense_rollup AS (
  SELECT
    job_id,
    technician_id,
    SUM(approved_total_eur) AS approved_total_eur,
    SUM(submitted_total_eur) AS submitted_total_eur,
    SUM(draft_total_eur) AS draft_total_eur,
    SUM(rejected_total_eur) AS rejected_total_eur,
    jsonb_agg(
      jsonb_build_object(
        'category_slug', category_slug,
        'status_counts', status_counts,
        'amount_totals', amount_totals,
        'approved_total_eur', approved_total_eur,
        'submitted_total_eur', submitted_total_eur,
        'draft_total_eur', draft_total_eur,
        'rejected_total_eur', rejected_total_eur,
        'last_receipt_at', last_receipt_at
      )
      ORDER BY category_slug
    ) AS breakdown
  FROM v_job_expense_summary
  GROUP BY job_id, technician_id
)
SELECT
  b.job_id,
  b.technician_id,
  COALESCE(tt.timesheets_total_eur, 0)::numeric(12, 2) AS timesheets_total_eur,
  COALESCE((ex.extras_payload->>'total_eur')::numeric, 0)::numeric(12, 2) AS extras_total_eur,
  (
    COALESCE(tt.timesheets_total_eur, 0)
    + COALESCE((ex.extras_payload->>'total_eur')::numeric, 0)
    + COALESCE(er.approved_total_eur, 0)
  )::numeric(12, 2) AS total_eur,
  ex.extras_payload AS extras_breakdown,
  COALESCE(er.approved_total_eur, 0)::numeric(12, 2) AS expenses_total_eur,
  COALESCE(er.breakdown, '[]'::jsonb) AS expenses_breakdown,
  needs_vehicle_disclaimer(b.technician_id) AS vehicle_disclaimer,
  CASE WHEN needs_vehicle_disclaimer(b.technician_id) THEN 'Se requiere vehículo propio' ELSE NULL END AS vehicle_disclaimer_text
FROM base b
LEFT JOIN (
  SELECT
    job_id,
    technician_id,
    SUM(amount_eur) FILTER (WHERE status = 'approved') AS timesheets_total_eur
  FROM timesheets
  GROUP BY job_id, technician_id
) tt ON tt.job_id = b.job_id AND tt.technician_id = b.technician_id
LEFT JOIN LATERAL (
  SELECT COALESCE(
    extras_total_for_job_tech(b.job_id, b.technician_id)::jsonb,
    jsonb_build_object('total_eur', 0, 'items', '[]'::jsonb)
  ) AS extras_payload
) ex ON TRUE
LEFT JOIN expense_rollup er ON er.job_id = b.job_id AND er.technician_id = b.technician_id;

-- Wrapper view with payout override logic
CREATE VIEW v_job_tech_payout_2025 AS
SELECT
  base.job_id,
  base.technician_id,
  base.timesheets_total_eur,
  base.extras_total_eur,
  base.extras_breakdown,
  base.expenses_total_eur,
  base.expenses_breakdown,
  base.vehicle_disclaimer,
  base.vehicle_disclaimer_text,
  COALESCE(overrides.override_amount_eur, base.total_eur)::numeric(12, 2) AS total_eur
FROM v_job_tech_payout_2025_base base
LEFT JOIN job_technician_payout_overrides overrides
  ON overrides.job_id = base.job_id
  AND overrides.technician_id = base.technician_id;

-- Grant permissions
GRANT SELECT ON v_job_tech_payout_2025 TO authenticated, service_role, anon;
GRANT SELECT ON v_job_tech_payout_2025_base TO authenticated, service_role;

COMMIT;
