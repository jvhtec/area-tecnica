-- Migration: Fix RLS Performance Issues - Wrap auth functions in subqueries
--
-- Problem: auth.uid(), auth.jwt(), and auth.role() are re-evaluated for each row
-- Solution: Wrap them in (SELECT auth.function()) to evaluate once per query
--
-- This migration fixes ALL known RLS policies with this performance issue
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

BEGIN;

-- ============================================================================
-- 1. FEEDBACK SYSTEM: bug_reports table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own bug reports" ON bug_reports;
CREATE POLICY "Users can view their own bug reports"
    ON bug_reports FOR SELECT
    USING (
        (SELECT auth.uid()) = created_by
        OR reporter_email = ((SELECT auth.jwt())->>'email')
    );

DROP POLICY IF EXISTS "Admins can view all bug reports" ON bug_reports;
CREATE POLICY "Admins can view all bug reports"
    ON bug_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'management')
        )
    );

DROP POLICY IF EXISTS "Admins can update bug reports" ON bug_reports;
CREATE POLICY "Admins can update bug reports"
    ON bug_reports FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'management')
        )
    );

DROP POLICY IF EXISTS "Admins can delete bug reports" ON bug_reports;
CREATE POLICY "Admins can delete bug reports"
    ON bug_reports FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'management')
        )
    );

-- ============================================================================
-- 2. FEEDBACK SYSTEM: feature_requests table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own feature requests" ON feature_requests;
CREATE POLICY "Users can view their own feature requests"
    ON feature_requests FOR SELECT
    USING (
        (SELECT auth.uid()) = created_by
        OR reporter_email = ((SELECT auth.jwt())->>'email')
    );

DROP POLICY IF EXISTS "Admins can view all feature requests" ON feature_requests;
CREATE POLICY "Admins can view all feature requests"
    ON feature_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'management')
        )
    );

DROP POLICY IF EXISTS "Admins can update feature requests" ON feature_requests;
CREATE POLICY "Admins can update feature requests"
    ON feature_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'management')
        )
    );

DROP POLICY IF EXISTS "Admins can delete feature requests" ON feature_requests;
CREATE POLICY "Admins can delete feature requests"
    ON feature_requests FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role IN ('admin', 'management')
        )
    );

-- ============================================================================
-- 3. STORAGE: feedback-system bucket policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can delete feedback files" ON storage.objects;
CREATE POLICY "Admins can delete feedback files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-system' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.role IN ('admin', 'management')
  )
);

-- ============================================================================
-- 4. ASSIGNMENT AUDIT LOG
-- ============================================================================

DROP POLICY IF EXISTS "Allow read for authorized roles" ON assignment_audit_log;
CREATE POLICY "Allow read for authorized roles" ON assignment_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS "Service role full access" ON assignment_audit_log;
CREATE POLICY "Service role full access" ON assignment_audit_log
  FOR ALL
  TO service_role
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ============================================================================
-- 5. EXPENSE SYSTEM: expense_categories
-- ============================================================================

DROP POLICY IF EXISTS "Expense categories readable" ON expense_categories;
CREATE POLICY "Expense categories readable"
  ON expense_categories
  FOR SELECT
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- 6. EXPENSE SYSTEM: expense_permissions
-- ============================================================================

DROP POLICY IF EXISTS "Management manages expense permissions" ON expense_permissions;
CREATE POLICY "Management manages expense permissions"
  ON expense_permissions
  FOR ALL
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS "Technicians read own permissions" ON expense_permissions;
CREATE POLICY "Technicians read own permissions"
  ON expense_permissions
  FOR SELECT
  USING (
    technician_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'management')
    )
  );

-- ============================================================================
-- 7. EXPENSE SYSTEM: job_expenses
-- ============================================================================

DROP POLICY IF EXISTS "Management manages job expenses" ON job_expenses;
CREATE POLICY "Management manages job expenses"
  ON job_expenses
  FOR ALL
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'management')
    )
  );

DROP POLICY IF EXISTS "Technicians read own expenses" ON job_expenses;
CREATE POLICY "Technicians read own expenses"
  ON job_expenses
  FOR SELECT
  USING (technician_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Technicians insert expenses" ON job_expenses;
CREATE POLICY "Technicians insert expenses"
  ON job_expenses
  FOR INSERT
  WITH CHECK (
    technician_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM expense_permissions ep
      WHERE ep.job_id = job_id
        AND ep.technician_id = (SELECT auth.uid())
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
    technician_id = (SELECT auth.uid())
    AND status = 'draft'
  )
  WITH CHECK (technician_id = (SELECT auth.uid()));

-- ============================================================================
-- 8. PAYOUT OVERRIDES: job_technician_payout_overrides
-- ============================================================================

DROP POLICY IF EXISTS "Users can view payout overrides for jobs they can see" ON job_technician_payout_overrides;
CREATE POLICY "Users can view payout overrides for jobs they can see"
  ON job_technician_payout_overrides FOR SELECT
  USING (
    -- Technicians can view their own overrides on jobs they're assigned to
    EXISTS (
      SELECT 1 FROM job_assignments ja
      WHERE ja.job_id = job_technician_payout_overrides.job_id
        AND ja.technician_id = (SELECT auth.uid())
    )
    OR
    -- Admin users have unconditional access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
    OR
    -- Management users can only view overrides for their department's technicians on assigned jobs
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'management'
          AND p.department = (
            SELECT department FROM profiles
            WHERE id = job_technician_payout_overrides.technician_id
          )
      )
      AND EXISTS (
        SELECT 1 FROM job_assignments ja
        WHERE ja.job_id = job_technician_payout_overrides.job_id
          AND ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  );

DROP POLICY IF EXISTS "Only admins and department managers can insert overrides" ON job_technician_payout_overrides;
CREATE POLICY "Only admins and department managers can insert overrides"
  ON job_technician_payout_overrides FOR INSERT
  WITH CHECK (
    -- Admin users have unconditional access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
    OR
    -- Management users can only insert for their department's technicians on assigned jobs
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'management'
          AND p.department = (
            SELECT department FROM profiles
            WHERE id = job_technician_payout_overrides.technician_id
          )
      )
      AND EXISTS (
        SELECT 1 FROM job_assignments ja
        WHERE ja.job_id = job_technician_payout_overrides.job_id
          AND ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  );

DROP POLICY IF EXISTS "Only admins and department managers can update overrides" ON job_technician_payout_overrides;
CREATE POLICY "Only admins and department managers can update overrides"
  ON job_technician_payout_overrides FOR UPDATE
  USING (
    -- Admin users have unconditional access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
    OR
    -- Management users can only update for their department's technicians on assigned jobs
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'management'
          AND p.department = (
            SELECT department FROM profiles
            WHERE id = job_technician_payout_overrides.technician_id
          )
      )
      AND EXISTS (
        SELECT 1 FROM job_assignments ja
        WHERE ja.job_id = job_technician_payout_overrides.job_id
          AND ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  )
  WITH CHECK (
    -- Admin users have unconditional access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
    OR
    -- Management users can only update for their department's technicians on assigned jobs
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'management'
          AND p.department = (
            SELECT department FROM profiles
            WHERE id = job_technician_payout_overrides.technician_id
          )
      )
      AND EXISTS (
        SELECT 1 FROM job_assignments ja
        WHERE ja.job_id = job_technician_payout_overrides.job_id
          AND ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  );

DROP POLICY IF EXISTS "Only admins and department managers can delete overrides" ON job_technician_payout_overrides;
CREATE POLICY "Only admins and department managers can delete overrides"
  ON job_technician_payout_overrides FOR DELETE
  USING (
    -- Admin users have unconditional access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
    OR
    -- Management users can only delete for their department's technicians on assigned jobs
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'management'
          AND p.department = (
            SELECT department FROM profiles
            WHERE id = job_technician_payout_overrides.technician_id
          )
      )
      AND EXISTS (
        SELECT 1 FROM job_assignments ja
        WHERE ja.job_id = job_technician_payout_overrides.job_id
          AND ja.technician_id = job_technician_payout_overrides.technician_id
      )
    )
  );

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- This migration has fixed 22 RLS policies across 8 tables:
--   - bug_reports (4 policies)
--   - feature_requests (4 policies)
--   - storage.objects/feedback-system (1 policy)
--   - assignment_audit_log (2 policies)
--   - expense_categories (1 policy)
--   - expense_permissions (2 policies)
--   - job_expenses (4 policies)
--   - job_technician_payout_overrides (4 policies)
--
-- If you still see warnings after this migration, run the diagnostic query
-- in supabase/.temp/diagnose_rls_policies.sql to find additional policies
-- that may exist in your live database but not in tracked migrations.
-- ============================================================================
