-- =============================================================================
-- Policy Cleanup: Remove redundant OR conditions
-- =============================================================================
-- The previous migrations merged policies creating redundant conditions like:
--   (admin OR admin OR admin) -> (admin)
--   (condition OR true) -> (true)
-- This migration replaces them with clean, efficient policies.
-- =============================================================================

-- =============================================================================
-- PROFILES
-- =============================================================================

DROP POLICY IF EXISTS "p_profiles_public_select_5a9b0a" ON profiles;
DROP POLICY IF EXISTS "p_profiles_public_insert_2420a3" ON profiles;
DROP POLICY IF EXISTS "p_profiles_public_update_833ffe" ON profiles;
DROP POLICY IF EXISTS "p_profiles_public_delete_bd0d98" ON profiles;

-- SELECT: All authenticated users can view profiles (original had OR true)
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Admin/management only
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('admin', 'management'));

-- UPDATE: Admin/management can update all, users can update their own
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() IN ('admin', 'management')
    OR auth.uid() = id
  );

-- DELETE: Admin/management only
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('admin', 'management'));

-- =============================================================================
-- JOBS
-- =============================================================================

DROP POLICY IF EXISTS "p_jobs_public_select_c5f1fa" ON jobs;
DROP POLICY IF EXISTS "p_jobs_public_insert_ca8790" ON jobs;
DROP POLICY IF EXISTS "p_jobs_public_update_2caf4c" ON jobs;
DROP POLICY IF EXISTS "p_jobs_public_delete_bc4342" ON jobs;

-- SELECT: Admin/management/logistics see all, others see assigned jobs
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() IN ('admin', 'management', 'logistics', 'wallboard')
    OR id IN (SELECT job_id FROM job_assignments WHERE technician_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM job_departments jd
      JOIN profiles p ON p.department = jd.department
      WHERE jd.job_id = jobs.id AND p.id = auth.uid()
    )
  );

-- INSERT: Admin/management/logistics
CREATE POLICY "jobs_insert" ON jobs
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('admin', 'management', 'logistics'));

-- UPDATE: Admin/management/logistics
CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('admin', 'management', 'logistics'));

-- DELETE: Admin/management/logistics
CREATE POLICY "jobs_delete" ON jobs
  FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('admin', 'management', 'logistics'));

-- =============================================================================
-- JOB_ASSIGNMENTS
-- =============================================================================

DROP POLICY IF EXISTS "p_job_assignments_public_select_ef8f9d" ON job_assignments;
DROP POLICY IF EXISTS "p_job_assignments_public_insert_a8ee07" ON job_assignments;
DROP POLICY IF EXISTS "p_job_assignments_public_update_ec2c79" ON job_assignments;
DROP POLICY IF EXISTS "p_job_assignments_public_delete_d91e4d" ON job_assignments;

-- SELECT: Admin/management see all, technicians see their own + jobs they can access
CREATE POLICY "job_assignments_select" ON job_assignments
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() IN ('admin', 'management', 'logistics')
    OR technician_id = auth.uid()
    OR job_id IN (SELECT job_id FROM job_assignments WHERE technician_id = auth.uid())
  );

-- INSERT: Admin/management
CREATE POLICY "job_assignments_insert" ON job_assignments
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('admin', 'management'));

-- UPDATE: Admin/management or own assignment
CREATE POLICY "job_assignments_update" ON job_assignments
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() IN ('admin', 'management')
    OR technician_id = auth.uid()
  );

-- DELETE: Admin/management only
CREATE POLICY "job_assignments_delete" ON job_assignments
  FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('admin', 'management'));
