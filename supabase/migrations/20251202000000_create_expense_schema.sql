BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_status') THEN
    CREATE TYPE expense_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE expense_categories (
  slug TEXT PRIMARY KEY,
  label_es TEXT NOT NULL,
  requires_receipt BOOLEAN NOT NULL DEFAULT FALSE,
  default_daily_cap_eur NUMERIC(12, 2),
  default_total_cap_eur NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT expense_categories_caps_check CHECK (
    (default_daily_cap_eur IS NULL OR default_daily_cap_eur >= 0)
    AND (default_total_cap_eur IS NULL OR default_total_cap_eur >= 0)
  )
);

COMMENT ON TABLE expense_categories IS 'Lookup of permitted expense categories for technician reimbursements.';
COMMENT ON COLUMN expense_categories.slug IS 'Stable identifier used across permissions and expenses (lowercase, hyphen-safe).';
COMMENT ON COLUMN expense_categories.label_es IS 'Spanish-facing label presented in the UI.';
COMMENT ON COLUMN expense_categories.requires_receipt IS 'Whether technicians must include a receipt file when submitting this category.';
COMMENT ON COLUMN expense_categories.default_daily_cap_eur IS 'Default per-day cap in EUR that permissions inherit when not overridden.';
COMMENT ON COLUMN expense_categories.default_total_cap_eur IS 'Default total cap in EUR that permissions inherit when not overridden.';

INSERT INTO expense_categories (slug, label_es, requires_receipt, default_daily_cap_eur, default_total_cap_eur)
VALUES
  ('dietas', 'Dietas', FALSE, 45, 450),
  ('transporte', 'Transporte', TRUE, 100, 600),
  ('alojamiento', 'Alojamiento', TRUE, 150, 1200),
  ('material', 'Material', TRUE, NULL, NULL),
  ('otros', 'Otros', FALSE, NULL, NULL)
ON CONFLICT (slug) DO UPDATE
SET
  label_es = EXCLUDED.label_es,
  requires_receipt = EXCLUDED.requires_receipt,
  default_daily_cap_eur = EXCLUDED.default_daily_cap_eur,
  default_total_cap_eur = EXCLUDED.default_total_cap_eur,
  updated_at = timezone('utc', now());

CREATE TABLE expense_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  category_slug TEXT NOT NULL,
  valid_from DATE,
  valid_to DATE,
  daily_cap_eur NUMERIC(12, 2),
  total_cap_eur NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_by UUID,
  CONSTRAINT expense_permissions_pkey PRIMARY KEY (job_id, technician_id, category_slug),
  CONSTRAINT expense_permissions_id_key UNIQUE (id),
  CONSTRAINT expense_permissions_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT expense_permissions_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT expense_permissions_category_slug_fkey FOREIGN KEY (category_slug) REFERENCES expense_categories (slug),
  CONSTRAINT expense_permissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT expense_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT expense_permissions_caps_check CHECK (
    (daily_cap_eur IS NULL OR daily_cap_eur >= 0)
    AND (total_cap_eur IS NULL OR total_cap_eur >= 0)
  ),
  CONSTRAINT expense_permissions_valid_range CHECK (
    valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from
  )
);

COMMENT ON TABLE expense_permissions IS 'Per-job expense allowances granted to a technician for a given category.';
COMMENT ON COLUMN expense_permissions.id IS 'Unique identifier to reference a specific permission row.';
COMMENT ON COLUMN expense_permissions.valid_from IS 'Inclusive start date for when the permission is effective.';
COMMENT ON COLUMN expense_permissions.valid_to IS 'Inclusive end date for when the permission is effective.';
COMMENT ON COLUMN expense_permissions.daily_cap_eur IS 'Optional override of the default daily cap, expressed in EUR.';
COMMENT ON COLUMN expense_permissions.total_cap_eur IS 'Optional override of the default total cap, expressed in EUR.';
COMMENT ON COLUMN expense_permissions.notes IS 'Operational notes visible to management when reviewing expenses.';

CREATE INDEX expense_permissions_job_id_idx ON expense_permissions (job_id);
CREATE INDEX expense_permissions_technician_idx ON expense_permissions (technician_id, job_id);

CREATE TABLE job_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  category_slug TEXT NOT NULL,
  permission_id UUID,
  expense_date DATE NOT NULL,
  amount_original NUMERIC(12, 2) NOT NULL,
  currency_code TEXT NOT NULL,
  fx_rate NUMERIC(12, 6) NOT NULL DEFAULT 1,
  amount_eur NUMERIC(12, 2) NOT NULL,
  description TEXT,
  receipt_path TEXT,
  status expense_status NOT NULL DEFAULT 'draft',
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_by UUID,
  CONSTRAINT job_expenses_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
  CONSTRAINT job_expenses_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT job_expenses_category_slug_fkey FOREIGN KEY (category_slug) REFERENCES expense_categories (slug),
  CONSTRAINT job_expenses_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES expense_permissions (id) ON DELETE SET NULL,
  CONSTRAINT job_expenses_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT job_expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT job_expenses_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT job_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT job_expenses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT job_expenses_amounts_check CHECK (amount_original >= 0 AND amount_eur >= 0),
  CONSTRAINT job_expenses_fx_rate_check CHECK (fx_rate > 0),
  CONSTRAINT job_expenses_currency_code_check CHECK (
    char_length(currency_code) = 3 AND upper(currency_code) = currency_code
  )
);

COMMENT ON TABLE job_expenses IS 'Expense submissions captured against a job and technician, with audit state and receipt references.';
COMMENT ON COLUMN job_expenses.permission_id IS 'Permission row that authorized the submission, captured at the time of insert.';
COMMENT ON COLUMN job_expenses.amount_original IS 'Amount in the original currency submitted by the technician.';
COMMENT ON COLUMN job_expenses.amount_eur IS 'Amount converted into EUR using the provided FX rate.';
COMMENT ON COLUMN job_expenses.receipt_path IS 'Relative storage path inside the expense-receipts bucket.';
COMMENT ON COLUMN job_expenses.status IS 'Workflow status for the expense approval lifecycle.';
COMMENT ON COLUMN job_expenses.status_history IS 'Chronological record of status transitions including actor and timestamp.';
COMMENT ON COLUMN job_expenses.submitted_by IS 'Actor that submitted the expense for review.';
COMMENT ON COLUMN job_expenses.rejection_reason IS 'Management feedback recorded when rejecting an expense.';

CREATE INDEX job_expenses_job_idx ON job_expenses (job_id, expense_date);
CREATE INDEX job_expenses_technician_idx ON job_expenses (technician_id, expense_date);
CREATE INDEX job_expenses_status_pending_idx ON job_expenses (job_id, expense_date)
  WHERE status = 'submitted';
CREATE INDEX job_expenses_permission_lookup_idx ON job_expenses (permission_id);
CREATE INDEX job_expenses_receipt_lookup_idx ON job_expenses (receipt_path)
  WHERE receipt_path IS NOT NULL;

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE expense_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE job_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_expenses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Expense categories readable" ON expense_categories;
CREATE POLICY "Expense categories readable"
  ON expense_categories
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Management manages expense permissions" ON expense_permissions;
CREATE POLICY "Management manages expense permissions"
  ON expense_permissions
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS "Technicians read own permissions" ON expense_permissions;
CREATE POLICY "Technicians read own permissions"
  ON expense_permissions
  FOR SELECT
  USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS "Management manages job expenses" ON job_expenses;
CREATE POLICY "Management manages job expenses"
  ON job_expenses
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS "Technicians read own expenses" ON job_expenses;
CREATE POLICY "Technicians read own expenses"
  ON job_expenses
  FOR SELECT
  USING (technician_id = auth.uid());

DROP POLICY IF EXISTS "Technicians insert expenses" ON job_expenses;
CREATE POLICY "Technicians insert expenses"
  ON job_expenses
  FOR INSERT
  WITH CHECK (
    technician_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM expense_permissions ep
      WHERE ep.job_id = job_id
        AND ep.technician_id = auth.uid()
        AND ep.category_slug = category_slug
        AND (ep.valid_from IS NULL OR expense_date >= ep.valid_from)
        AND (ep.valid_to IS NULL OR expense_date <= ep.valid_to)
    )
  );

DROP POLICY IF EXISTS "Technicians update draft expenses" ON job_expenses;
CREATE POLICY "Technicians update draft expenses"
  ON job_expenses
  FOR UPDATE
  USING (
    technician_id = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (technician_id = auth.uid());

CREATE OR REPLACE FUNCTION set_job_expense_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fx numeric := COALESCE(NULLIF(NEW.fx_rate, 0), 1);
BEGIN
  NEW.fx_rate := v_fx;
  NEW.currency_code := upper(NEW.currency_code);
  NEW.amount_eur := ROUND(NEW.amount_original * NEW.fx_rate, 2);
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := timezone('utc', now());
  ELSIF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN
    NEW.created_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION maintain_job_expense_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_entry jsonb;
  v_history jsonb := COALESCE(CASE WHEN TG_OP = 'INSERT' THEN NEW.status_history ELSE OLD.status_history END, '[]'::jsonb);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_entry := jsonb_build_object(
      'status', NEW.status::text,
      'changed_at', timezone('utc', now()),
      'changed_by', COALESCE(v_actor, NEW.submitted_by, NEW.created_by)
    );
    NEW.status_history := v_history || v_entry;
  ELSE
    NEW.status_history := COALESCE(NEW.status_history, v_history);
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_entry := jsonb_build_object(
        'status', NEW.status::text,
        'changed_at', timezone('utc', now()),
        'changed_by', COALESCE(v_actor, NEW.updated_by, NEW.approved_by, NEW.rejected_by)
      );
      NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) || v_entry;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_job_expense_status_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'Approved expenses cannot change status';
    ELSIF OLD.status = 'rejected' AND NEW.status <> 'rejected' THEN
      RAISE EXCEPTION 'Rejected expenses cannot change status';
    ELSIF OLD.status = 'submitted' AND NEW.status NOT IN ('submitted', 'approved', 'rejected') THEN
      RAISE EXCEPTION 'Submitted expenses may only transition via approval or rejection';
    ELSIF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'Draft expenses may only transition to submitted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION can_submit_job_expense(
  p_job_id UUID,
  p_technician_id UUID,
  p_category_slug TEXT,
  p_expense_date DATE,
  p_amount_original NUMERIC,
  p_currency_code TEXT,
  p_fx_rate NUMERIC DEFAULT 1
)
RETURNS TABLE (allowed BOOLEAN, reason TEXT, permission_id UUID, remaining NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_permission RECORD;
  v_fx numeric := COALESCE(NULLIF(p_fx_rate, 0), 1);
  v_amount_eur numeric := ROUND(p_amount_original * v_fx, 2);
  v_daily_cap numeric;
  v_total_cap numeric;
  v_daily_used numeric := 0;
  v_total_used numeric := 0;
  v_daily_remaining numeric;
  v_total_remaining numeric;
  v_remaining_after numeric := NULL;
BEGIN
  IF p_job_id IS NULL OR p_technician_id IS NULL OR p_category_slug IS NULL OR p_expense_date IS NULL OR p_amount_original IS NULL THEN
    RETURN QUERY SELECT FALSE, 'missing_params', NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  IF v_actor IS DISTINCT FROM p_technician_id THEN
    SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
    IF v_role NOT IN ('admin', 'management') THEN
      RETURN QUERY SELECT FALSE, 'not_authorized', NULL::uuid, NULL::numeric;
      RETURN;
    END IF;
  END IF;

  SELECT ep.*, ec.requires_receipt, ec.default_daily_cap_eur, ec.default_total_cap_eur
  INTO v_permission
  FROM expense_permissions ep
  JOIN expense_categories ec ON ec.slug = ep.category_slug
  WHERE ep.job_id = p_job_id
    AND ep.technician_id = p_technician_id
    AND ep.category_slug = p_category_slug;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'permission_missing', NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  IF v_permission.valid_from IS NOT NULL AND p_expense_date < v_permission.valid_from THEN
    RETURN QUERY SELECT FALSE, 'permission_inactive', v_permission.id, NULL::numeric;
    RETURN;
  END IF;

  IF v_permission.valid_to IS NOT NULL AND p_expense_date > v_permission.valid_to THEN
    RETURN QUERY SELECT FALSE, 'permission_expired', v_permission.id, NULL::numeric;
    RETURN;
  END IF;

  v_daily_cap := COALESCE(v_permission.daily_cap_eur, v_permission.default_daily_cap_eur);
  v_total_cap := COALESCE(v_permission.total_cap_eur, v_permission.default_total_cap_eur);

  SELECT COALESCE(SUM(amount_eur), 0)
  INTO v_daily_used
  FROM job_expenses
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id
    AND category_slug = p_category_slug
    AND expense_date = p_expense_date
    AND status IN ('draft', 'submitted', 'approved');

  SELECT COALESCE(SUM(amount_eur), 0)
  INTO v_total_used
  FROM job_expenses
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id
    AND category_slug = p_category_slug
    AND status IN ('draft', 'submitted', 'approved');

  v_daily_remaining := CASE WHEN v_daily_cap IS NULL THEN NULL ELSE GREATEST(v_daily_cap - v_daily_used, 0) END;
  v_total_remaining := CASE WHEN v_total_cap IS NULL THEN NULL ELSE GREATEST(v_total_cap - v_total_used, 0) END;

  IF v_daily_remaining IS NOT NULL AND v_amount_eur > v_daily_remaining THEN
    RETURN QUERY SELECT FALSE, 'over_daily_cap', v_permission.id, ROUND(v_daily_remaining, 2);
    RETURN;
  END IF;

  IF v_total_remaining IS NOT NULL AND v_amount_eur > v_total_remaining THEN
    RETURN QUERY SELECT FALSE, 'over_total_cap', v_permission.id, ROUND(v_total_remaining, 2);
    RETURN;
  END IF;

  IF v_daily_remaining IS NOT NULL THEN
    v_remaining_after := COALESCE(v_remaining_after, v_daily_remaining - v_amount_eur);
  END IF;
  IF v_total_remaining IS NOT NULL THEN
    IF v_remaining_after IS NULL THEN
      v_remaining_after := v_total_remaining - v_amount_eur;
    ELSE
      v_remaining_after := LEAST(v_remaining_after, v_total_remaining - v_amount_eur);
    END IF;
  END IF;

  RETURN QUERY
    SELECT TRUE,
           NULL::text,
           v_permission.id,
           CASE WHEN v_remaining_after IS NULL THEN NULL ELSE ROUND(GREATEST(v_remaining_after, 0), 2) END;
END;
$$;

CREATE OR REPLACE FUNCTION submit_job_expense(
  p_job_id UUID,
  p_category_slug TEXT,
  p_expense_date DATE,
  p_amount_original NUMERIC,
  p_currency_code TEXT,
  p_fx_rate NUMERIC DEFAULT 1,
  p_description TEXT DEFAULT NULL,
  p_receipt_path TEXT DEFAULT NULL,
  p_technician_id UUID DEFAULT NULL
)
RETURNS job_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_target uuid := COALESCE(p_technician_id, v_actor);
  v_check RECORD;
  v_requires_receipt boolean;
  v_insert job_expenses%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit expenses';
  END IF;

  IF v_target IS DISTINCT FROM v_actor THEN
    SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
    IF v_role NOT IN ('admin', 'management') THEN
      RAISE EXCEPTION 'Not authorized to submit on behalf of another technician';
    END IF;
  END IF;

  SELECT requires_receipt
  INTO v_requires_receipt
  FROM expense_categories
  WHERE slug = p_category_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown expense category %', p_category_slug;
  END IF;

  SELECT * INTO v_check
  FROM can_submit_job_expense(p_job_id, v_target, p_category_slug, p_expense_date, p_amount_original, p_currency_code, p_fx_rate);

  IF NOT v_check.allowed THEN
    RAISE EXCEPTION 'Expense submission denied: %', COALESCE(v_check.reason, 'unknown');
  END IF;

  IF v_requires_receipt AND p_receipt_path IS NULL THEN
    RAISE EXCEPTION 'A receipt is required for category %', p_category_slug;
  END IF;

  INSERT INTO job_expenses (
    job_id,
    technician_id,
    category_slug,
    permission_id,
    expense_date,
    amount_original,
    currency_code,
    fx_rate,
    description,
    receipt_path,
    status,
    submitted_at,
    submitted_by,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  VALUES (
    p_job_id,
    v_target,
    p_category_slug,
    v_check.permission_id,
    p_expense_date,
    p_amount_original,
    UPPER(p_currency_code),
    COALESCE(NULLIF(p_fx_rate, 0), 1),
    p_description,
    p_receipt_path,
    'submitted',
    timezone('utc', now()),
    v_actor,
    timezone('utc', now()),
    v_actor,
    timezone('utc', now()),
    v_actor
  )
  RETURNING * INTO v_insert;

  RETURN v_insert;
END;
$$;

CREATE OR REPLACE FUNCTION approve_job_expense(
  p_expense_id UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS job_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_row job_expenses%ROWTYPE;
  v_reason text := NULL;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to approve expenses';
  END IF;

  SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  IF v_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Only management roles can approve expenses';
  END IF;

  SELECT * INTO v_row
  FROM job_expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense % not found', p_expense_id;
  END IF;

  IF v_row.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only submitted expenses can be approved or rejected';
  END IF;

  IF p_approved THEN
    UPDATE job_expenses
    SET status = 'approved',
        approved_at = timezone('utc', now()),
        approved_by = v_actor,
        rejected_at = NULL,
        rejected_by = NULL,
        rejection_reason = NULL,
        updated_at = timezone('utc', now()),
        updated_by = v_actor
    WHERE id = p_expense_id
    RETURNING * INTO v_row;
  ELSE
    v_reason := COALESCE(NULLIF(trim(p_rejection_reason), ''), 'Rejected by management');
    UPDATE job_expenses
    SET status = 'rejected',
        rejected_at = timezone('utc', now()),
        rejected_by = v_actor,
        rejection_reason = v_reason,
        approved_at = NULL,
        approved_by = NULL,
        updated_at = timezone('utc', now()),
        updated_by = v_actor
    WHERE id = p_expense_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION set_expense_permission(
  p_job_id UUID,
  p_technician_id UUID,
  p_category_slug TEXT,
  p_valid_from DATE DEFAULT NULL,
  p_valid_to DATE DEFAULT NULL,
  p_daily_cap_eur NUMERIC DEFAULT NULL,
  p_total_cap_eur NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS expense_permissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_row expense_permissions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to manage expense permissions';
  END IF;

  SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  IF v_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Only management roles can manage expense permissions';
  END IF;

  INSERT INTO expense_permissions (
    id,
    job_id,
    technician_id,
    category_slug,
    valid_from,
    valid_to,
    daily_cap_eur,
    total_cap_eur,
    notes,
    created_at,
    created_by,
    updated_at,
    updated_by
  ) VALUES (
    gen_random_uuid(),
    p_job_id,
    p_technician_id,
    p_category_slug,
    p_valid_from,
    p_valid_to,
    p_daily_cap_eur,
    p_total_cap_eur,
    p_notes,
    timezone('utc', now()),
    v_actor,
    timezone('utc', now()),
    v_actor
  )
  ON CONFLICT (job_id, technician_id, category_slug)
  DO UPDATE SET
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    daily_cap_eur = EXCLUDED.daily_cap_eur,
    total_cap_eur = EXCLUDED.total_cap_eur,
    notes = EXCLUDED.notes,
    updated_at = timezone('utc', now()),
    updated_by = v_actor
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION replace_job_expense_receipt(
  p_expense_id UUID,
  p_new_receipt_path TEXT,
  p_remove BOOLEAN DEFAULT FALSE
)
RETURNS job_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_row job_expenses%ROWTYPE;
  v_requires_receipt boolean := FALSE;
  v_old_path text;
  v_new_path text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update receipts';
  END IF;

  SELECT * INTO v_row
  FROM job_expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense % not found', p_expense_id;
  END IF;

  SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  IF v_row.technician_id IS DISTINCT FROM v_actor AND v_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Not authorized to modify this receipt';
  END IF;

  SELECT requires_receipt INTO v_requires_receipt
  FROM expense_categories
  WHERE slug = v_row.category_slug;

  v_old_path := v_row.receipt_path;
  IF p_remove THEN
    IF v_requires_receipt AND v_row.status <> 'draft' THEN
      RAISE EXCEPTION 'Receipt is required for category % and cannot be removed after submission', v_row.category_slug;
    END IF;
    v_new_path := NULL;
  ELSE
    IF p_new_receipt_path IS NULL OR length(trim(p_new_receipt_path)) = 0 THEN
      RAISE EXCEPTION 'A new receipt path is required when not removing the receipt';
    END IF;
    v_new_path := p_new_receipt_path;
  END IF;

  UPDATE job_expenses
  SET receipt_path = v_new_path,
      updated_at = timezone('utc', now()),
      updated_by = v_actor
  WHERE id = p_expense_id
  RETURNING * INTO v_row;

  IF v_old_path IS NOT NULL AND v_new_path IS DISTINCT FROM v_old_path THEN
    UPDATE storage.objects
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('retired_at', timezone('utc', now()))
    WHERE bucket_id = 'expense-receipts'
      AND name = v_old_path;
  END IF;

  RETURN v_row;
END;
$$;

CREATE TRIGGER job_expenses_set_amounts_trg
BEFORE INSERT OR UPDATE ON job_expenses
FOR EACH ROW EXECUTE FUNCTION set_job_expense_amounts();

CREATE TRIGGER job_expenses_status_history_trg
BEFORE INSERT OR UPDATE ON job_expenses
FOR EACH ROW EXECUTE FUNCTION maintain_job_expense_status_history();

CREATE TRIGGER job_expenses_status_guard_trg
BEFORE UPDATE OF status ON job_expenses
FOR EACH ROW EXECUTE FUNCTION enforce_job_expense_status_transitions();

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

-- Drop existing view to avoid type conflicts when adding expense columns
DROP VIEW IF EXISTS v_job_tech_payout_2025 CASCADE;

CREATE VIEW public.v_job_tech_payout_2025 AS
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

CREATE OR REPLACE FUNCTION public.get_job_total_amounts(
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
  IF _job_id IS NULL THEN
    RAISE EXCEPTION 'Job id is required';
  END IF;

  IF _user_role IS NOT NULL THEN
    v_role := lower(_user_role);
  ELSE
    SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  END IF;

  v_user_can_see_all := v_actor IS NULL OR v_role IN ('admin', 'management', 'logistics');

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

GRANT EXECUTE ON FUNCTION can_submit_job_expense(UUID, UUID, TEXT, DATE, NUMERIC, TEXT, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_job_expense(UUID, TEXT, DATE, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION approve_job_expense(UUID, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_expense_permission(UUID, UUID, TEXT, DATE, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION replace_job_expense_receipt(UUID, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_job_total_amounts(UUID, TEXT) TO authenticated, service_role, anon;
GRANT SELECT ON v_job_expense_summary TO authenticated, service_role;
GRANT SELECT ON v_job_tech_payout_2025 TO authenticated, service_role, anon;

INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', FALSE)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'expense-receipts';

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Expense receipts read policy" ON storage.objects;
CREATE POLICY "Expense receipts read policy"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'expense-receipts'
    AND (
      owner = auth.uid()
      OR auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'management')
      )
    )
  );

DROP POLICY IF EXISTS "Expense receipts insert policy" ON storage.objects;
CREATE POLICY "Expense receipts insert policy"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (
      auth.role() = 'service_role'
      OR COALESCE(owner, auth.uid()) = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'management')
      )
    )
  );

DROP POLICY IF EXISTS "Expense receipts update policy" ON storage.objects;
CREATE POLICY "Expense receipts update policy"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'expense-receipts'
    AND (
      owner = auth.uid()
      OR auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'management')
      )
    )
  )
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (
      owner = auth.uid()
      OR auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'management')
      )
    )
  );

DROP POLICY IF EXISTS "Expense receipts delete policy" ON storage.objects;
CREATE POLICY "Expense receipts delete policy"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'expense-receipts'
    AND (
      owner = auth.uid()
      OR auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'management')
      )
    )
  );

COMMIT;
