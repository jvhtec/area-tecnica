-- =============================================================================
-- RLS POLICY OPTIMIZATION
-- =============================================================================
-- Replaces 8 RLS policies that do "SELECT 1 FROM profiles WHERE id = auth.uid()"
-- with the cached current_user_role() function created in previous migration.
--
-- This addresses a major source of the 29M profile queries.
-- =============================================================================

-- =============================================================================
-- ASSIGNMENT AUDIT LOG (1 policy)
-- =============================================================================

DROP POLICY IF EXISTS "Allow read for authorized roles" ON assignment_audit_log;

CREATE POLICY "Allow read for authorized roles" ON assignment_audit_log
  FOR SELECT
  TO authenticated
  USING (current_user_role() IN ('admin', 'management'));

-- =============================================================================
-- BUG REPORTS (3 policies)
-- =============================================================================

DROP POLICY IF EXISTS "Admins can view all bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Admins can update bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Admins can delete bug reports" ON bug_reports;

CREATE POLICY "Admins can view all bug reports" ON bug_reports
  FOR SELECT
  USING (current_user_role() IN ('admin', 'management'));

CREATE POLICY "Admins can update bug reports" ON bug_reports
  FOR UPDATE
  USING (current_user_role() IN ('admin', 'management'));

CREATE POLICY "Admins can delete bug reports" ON bug_reports
  FOR DELETE
  USING (current_user_role() IN ('admin', 'management'));

-- =============================================================================
-- FEATURE REQUESTS (3 policies)
-- =============================================================================

DROP POLICY IF EXISTS "Admins can view all feature requests" ON feature_requests;
DROP POLICY IF EXISTS "Admins can update feature requests" ON feature_requests;
DROP POLICY IF EXISTS "Admins can delete feature requests" ON feature_requests;

CREATE POLICY "Admins can view all feature requests" ON feature_requests
  FOR SELECT
  USING (current_user_role() IN ('admin', 'management'));

CREATE POLICY "Admins can update feature requests" ON feature_requests
  FOR UPDATE
  USING (current_user_role() IN ('admin', 'management'));

CREATE POLICY "Admins can delete feature requests" ON feature_requests
  FOR DELETE
  USING (current_user_role() IN ('admin', 'management'));

-- =============================================================================
-- FEEDBACK ATTACHMENTS (1 policy)
-- =============================================================================

DROP POLICY IF EXISTS "Admins can manage all attachments" ON feedback_attachments;

CREATE POLICY "Admins can manage all attachments" ON feedback_attachments
  FOR ALL
  USING (current_user_role() IN ('admin', 'management'));
