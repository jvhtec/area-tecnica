BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE expense_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');

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
  expense_date DATE NOT NULL,
  amount_original NUMERIC(12, 2) NOT NULL,
  currency_code TEXT NOT NULL,
  fx_rate NUMERIC(12, 6) NOT NULL DEFAULT 1,
  amount_eur NUMERIC(12, 2) NOT NULL,
  description TEXT,
  receipt_path TEXT,
  status expense_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
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
  CONSTRAINT job_expenses_permission_fkey FOREIGN KEY (job_id, technician_id, category_slug)
    REFERENCES expense_permissions (job_id, technician_id, category_slug),
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
COMMENT ON COLUMN job_expenses.amount_original IS 'Amount in the original currency submitted by the technician.';
COMMENT ON COLUMN job_expenses.amount_eur IS 'Amount converted into EUR using the provided FX rate.';
COMMENT ON COLUMN job_expenses.receipt_path IS 'Relative storage path inside the expense-receipts bucket.';
COMMENT ON COLUMN job_expenses.status IS 'Workflow status for the expense approval lifecycle.';
COMMENT ON COLUMN job_expenses.rejection_reason IS 'Management feedback recorded when rejecting an expense.';

CREATE INDEX job_expenses_job_idx ON job_expenses (job_id, expense_date);
CREATE INDEX job_expenses_technician_idx ON job_expenses (technician_id, expense_date);
CREATE INDEX job_expenses_status_pending_idx ON job_expenses (job_id, expense_date)
  WHERE status = 'submitted';
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
  USING (technician_id = auth.uid());

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
    )
  )
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (
      owner = auth.uid()
      OR auth.role() = 'service_role'
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
