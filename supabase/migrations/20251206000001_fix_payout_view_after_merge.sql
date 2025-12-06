-- Fix v_job_tech_payout_2025 view after merging expense schema with payout overrides
-- This migration ensures the view structure is consistent with both features

BEGIN;

-- Drop the existing views in the correct order
DROP VIEW IF EXISTS v_job_tech_payout_2025 CASCADE;
DROP VIEW IF EXISTS v_job_tech_payout_2025_base CASCADE;

-- Recreate the base view with proper numeric precision
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

-- Create the wrapper view that adds payout override logic
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
  -- Use override amount if exists, otherwise use the original calculated total
  COALESCE(overrides.override_amount_eur, base.total_eur)::numeric(12, 2) AS total_eur
FROM v_job_tech_payout_2025_base base
LEFT JOIN job_technician_payout_overrides overrides
  ON overrides.job_id = base.job_id
  AND overrides.technician_id = base.technician_id;

-- Grant appropriate permissions
GRANT SELECT ON v_job_tech_payout_2025 TO authenticated, service_role, anon;
GRANT SELECT ON v_job_tech_payout_2025_base TO authenticated, service_role;

COMMENT ON VIEW v_job_tech_payout_2025 IS
  'Unified payout view combining timesheets, extras, expenses, and payout overrides for 2025 workflow';

COMMIT;
