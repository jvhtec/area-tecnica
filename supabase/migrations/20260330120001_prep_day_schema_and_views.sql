-- =============================================================================
-- Migration: prep_day schema, compute function update, and payout views
-- Runs in a separate transaction so the 'prep_day' enum value is committed.
-- =============================================================================

-- 2. Add parent_job_id column to jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_jobs_parent_job_id
  ON public.jobs(parent_job_id) WHERE parent_job_id IS NOT NULL;

-- Constraint: prep_day jobs MUST have a parent, non-prep jobs MUST NOT
ALTER TABLE public.jobs
  ADD CONSTRAINT chk_prep_day_parent CHECK (
    (job_type = 'prep_day'::public.job_type AND parent_job_id IS NOT NULL)
    OR (job_type <> 'prep_day'::public.job_type AND parent_job_id IS NULL)
  );

-- 3. Replace compute_timesheet_amount_2025 to handle prep_day
CREATE OR REPLACE FUNCTION public.compute_timesheet_amount_2025(
  _timesheet_id uuid,
  _persist boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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

  -- Calculate worked hours (shared across all job types)
  IF v_timesheet.end_time < v_timesheet.start_time OR COALESCE(v_timesheet.ends_next_day, false) THEN
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time + INTERVAL '24 hours'
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  ELSE
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  END IF;

  v_worked_hours := ROUND(v_worked_hours * 2) / 2.0;

  -- ============ PREP DAY: flat 15€/hr ============
  IF v_job_type = 'prep_day' THEN
    v_billable_hours := v_worked_hours;
    v_total_amount := v_worked_hours * 15.0;

    v_breakdown := jsonb_build_object(
      'worked_hours', v_worked_hours,
      'worked_hours_rounded', v_worked_hours,
      'hours_rounded', v_worked_hours,
      'billable_hours', v_worked_hours,
      'is_prep_day', true,
      'hourly_rate_eur', 15.0,
      'base_amount_eur', 0,
      'base_day_eur', 0,
      'plus_10_12_hours', 0,
      'plus_10_12_eur', 0,
      'plus_10_12_amount_eur', 0,
      'overtime_hours', 0,
      'overtime_hour_eur', 0,
      'overtime_amount_eur', 0,
      'total_eur', v_total_amount,
      'category', v_category
    );

    v_result := jsonb_build_object(
      'timesheet_id', _timesheet_id,
      'amount_eur', v_total_amount,
      'amount_breakdown', v_breakdown
    );

    IF _persist THEN
      UPDATE public.timesheets SET
        amount_eur = v_total_amount,
        amount_breakdown = v_breakdown,
        category = v_category,
        updated_at = NOW()
      WHERE id = _timesheet_id;
    END IF;

    RETURN v_result;
  END IF;

  -- ============ Standard rate card lookup ============
  SELECT
    CASE
      WHEN v_category = 'responsable' THEN COALESCE(base_day_responsable_eur, base_day_especialista_eur, base_day_eur)
      WHEN v_category = 'especialista' THEN COALESCE(base_day_especialista_eur, base_day_eur)
      ELSE base_day_eur
    END AS base_day_eur,
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

  -- ============ EVENTO: fixed 12hr ============
  IF v_job_type = 'evento' THEN
    v_billable_hours := 12.0;
    v_base_day_amount := v_rate_card.base_day_eur;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := v_rate_card.plus_10_12_eur;
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_total_amount := v_base_day_amount + v_plus_10_12_amount;
  ELSE
    -- ============ Standard tier calculation ============
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
$$;

COMMENT ON FUNCTION public.compute_timesheet_amount_2025(uuid, boolean)
IS 'Calculates timesheet amounts based on rate cards. Prep day jobs use flat 15€/hr. Evento jobs use fixed 12hr rate. Standard jobs use tiered calculation with overtime. Checks custom_tech_rates first, falls back to rate_cards_2025.';

-- 4. Recreate v_job_tech_payout_2025_base with prep_days_total_eur
CREATE OR REPLACE VIEW public.v_job_tech_payout_2025_base WITH (security_invoker='true') AS
WITH base AS (
  SELECT DISTINCT job_id, technician_id FROM public.job_assignments
  UNION
  SELECT DISTINCT job_id, technician_id FROM public.timesheets
  UNION
  SELECT DISTINCT job_id, technician_id FROM public.job_rate_extras
  UNION
  SELECT DISTINCT job_id, technician_id FROM public.job_expenses
),
expense_rollup AS (
  SELECT
    v.job_id,
    v.technician_id,
    sum(v.approved_total_eur) AS approved_total_eur,
    sum(v.submitted_total_eur) AS submitted_total_eur,
    sum(v.draft_total_eur) AS draft_total_eur,
    sum(v.rejected_total_eur) AS rejected_total_eur,
    jsonb_agg(
      jsonb_build_object(
        'category_slug', v.category_slug,
        'status_counts', v.status_counts,
        'amount_totals', v.amount_totals,
        'approved_total_eur', v.approved_total_eur,
        'submitted_total_eur', v.submitted_total_eur,
        'draft_total_eur', v.draft_total_eur,
        'rejected_total_eur', v.rejected_total_eur,
        'last_receipt_at', v.last_receipt_at
      ) ORDER BY v.category_slug
    ) AS breakdown
  FROM public.v_job_expense_summary v
  GROUP BY v.job_id, v.technician_id
),
prep_rollup AS (
  SELECT
    j.parent_job_id AS job_id,
    t.technician_id,
    sum(t.amount_eur) FILTER (WHERE t.status = 'approved'::public.timesheet_status) AS prep_days_total_eur
  FROM public.timesheets t
  JOIN public.jobs j ON t.job_id = j.id
  WHERE j.job_type = 'prep_day'::public.job_type
    AND j.parent_job_id IS NOT NULL
  GROUP BY j.parent_job_id, t.technician_id
)
SELECT
  b.job_id,
  b.technician_id,
  COALESCE(tt.timesheets_total_eur, 0)::numeric(12,2) AS timesheets_total_eur,
  COALESCE((ex.extras_payload ->> 'total_eur')::numeric, 0)::numeric(12,2) AS extras_total_eur,
  COALESCE(pr.prep_days_total_eur, 0)::numeric(12,2) AS prep_days_total_eur,
  (
    COALESCE(tt.timesheets_total_eur, 0)
    + COALESCE((ex.extras_payload ->> 'total_eur')::numeric, 0)
    + COALESCE(er.approved_total_eur, 0)
    + COALESCE(pr.prep_days_total_eur, 0)
  )::numeric(12,2) AS total_eur,
  ex.extras_payload AS extras_breakdown,
  COALESCE(er.approved_total_eur, 0)::numeric(12,2) AS expenses_total_eur,
  COALESCE(er.breakdown, '[]'::jsonb) AS expenses_breakdown,
  public.needs_vehicle_disclaimer(b.technician_id) AS vehicle_disclaimer,
  CASE
    WHEN public.needs_vehicle_disclaimer(b.technician_id) THEN 'Se requiere vehículo propio'::text
    ELSE NULL::text
  END AS vehicle_disclaimer_text
FROM base b
LEFT JOIN (
  SELECT job_id, technician_id,
    sum(amount_eur) FILTER (WHERE status = 'approved'::public.timesheet_status) AS timesheets_total_eur
  FROM public.timesheets
  GROUP BY job_id, technician_id
) tt ON tt.job_id = b.job_id AND tt.technician_id = b.technician_id
LEFT JOIN LATERAL (
  SELECT COALESCE(
    public.extras_total_for_job_tech(b.job_id, b.technician_id),
    jsonb_build_object('total_eur', 0, 'items', '[]'::jsonb)
  ) AS extras_payload
) ex ON true
LEFT JOIN expense_rollup er ON er.job_id = b.job_id AND er.technician_id = b.technician_id
LEFT JOIN prep_rollup pr ON pr.job_id = b.job_id AND pr.technician_id = b.technician_id;

-- 5. Recreate v_job_tech_payout_2025 with prep_days_total_eur pass-through
CREATE OR REPLACE VIEW public.v_job_tech_payout_2025 WITH (security_invoker='true') AS
SELECT
  base.job_id,
  base.technician_id,
  base.timesheets_total_eur,
  base.extras_total_eur,
  base.prep_days_total_eur,
  base.extras_breakdown,
  base.expenses_total_eur,
  base.expenses_breakdown,
  base.vehicle_disclaimer,
  base.vehicle_disclaimer_text,
  COALESCE(overrides.override_amount_eur, base.total_eur)::numeric(12,2) AS total_eur
FROM public.v_job_tech_payout_2025_base base
LEFT JOIN public.job_technician_payout_overrides overrides
  ON overrides.job_id = base.job_id AND overrides.technician_id = base.technician_id;
