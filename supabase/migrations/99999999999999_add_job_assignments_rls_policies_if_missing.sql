-- =====================================================================
-- RLS POLICIES FOR JOB_ASSIGNMENTS TABLE (BACKUP)
-- =====================================================================
--
-- ⚠️  IMPORTANT: VERIFY BEFORE APPLYING ⚠️
--
-- Check if these policies already exist on production:
--   SELECT * FROM pg_policies WHERE tablename = 'job_assignments';
--
-- Only apply this migration if INSERT/UPDATE/DELETE policies are missing.
-- The SELECT policies should already exist from previous migrations.
--
-- This file is timestamped 99999999999999 to ensure it doesn't run
-- automatically. Rename to a proper timestamp if you need to apply it.
-- =====================================================================

-- Enable RLS on job_assignments table (if not already enabled)
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SERVICE ROLE BYPASS (Critical for Edge Functions)
-- =====================================================================

-- Allow service role full access (bypass RLS)
-- This is essential for edge functions like send-staffing-email and staffing-click
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignments'
      AND policyname = 'Service role has full access to job_assignments'
  ) THEN
    CREATE POLICY "Service role has full access to job_assignments"
      ON public.job_assignments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================================
-- INSERT POLICIES
-- =====================================================================

-- Policy: Management can insert job assignments
-- Allows users with 'management' or 'admin' role to create assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignments'
      AND policyname = 'Management can insert job_assignments'
  ) THEN
    CREATE POLICY "Management can insert job_assignments"
      ON public.job_assignments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('management', 'admin')
        )
      );
  END IF;
END $$;

-- =====================================================================
-- UPDATE POLICIES
-- =====================================================================

-- Policy: Management can update job assignments
-- Allows management to modify existing assignments (e.g., change roles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignments'
      AND policyname = 'Management can update job_assignments'
  ) THEN
    CREATE POLICY "Management can update job_assignments"
      ON public.job_assignments
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('management', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('management', 'admin')
        )
      );
  END IF;
END $$;

-- =====================================================================
-- DELETE POLICIES
-- =====================================================================

-- Policy: Management can delete job assignments
-- Allows management to remove assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignments'
      AND policyname = 'Management can delete job_assignments'
  ) THEN
    CREATE POLICY "Management can delete job_assignments"
      ON public.job_assignments
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('management', 'admin')
        )
      );
  END IF;
END $$;

-- =====================================================================
-- SELECT POLICIES (Likely Already Exist)
-- =====================================================================

-- Policy: All authenticated users can view job assignments
-- This is typically needed for technicians to see their own assignments
-- and for management to view all assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignments'
      AND policyname = 'Authenticated users can view job_assignments'
  ) THEN
    CREATE POLICY "Authenticated users can view job_assignments"
      ON public.job_assignments
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================================
-- GRANTS (Ensure Table Permissions)
-- =====================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.job_assignments TO authenticated;
GRANT INSERT ON public.job_assignments TO authenticated;
GRANT UPDATE ON public.job_assignments TO authenticated;
GRANT DELETE ON public.job_assignments TO authenticated;

-- Grant full access to service role
GRANT ALL ON public.job_assignments TO service_role;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- After applying this migration, verify policies exist:
--
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'job_assignments'
-- ORDER BY cmd, policyname;
--
-- Expected policies:
-- 1. Service role has full access to job_assignments (ALL)
-- 2. Management can insert job_assignments (INSERT)
-- 3. Management can update job_assignments (UPDATE)
-- 4. Management can delete job_assignments (DELETE)
-- 5. Authenticated users can view job_assignments (SELECT)
--
-- =====================================================================
-- NOTES
-- =====================================================================
--
-- 1. These policies assume the profiles table has a 'role' column
--    with values like 'management', 'admin', 'technician'
--
-- 2. The service_role policy is CRITICAL for edge functions to work
--    Edge functions authenticate as service_role, not as regular users
--
-- 3. If you have different role names in your system, update the
--    role IN ('management', 'admin') clauses accordingly
--
-- 4. All policies use DO blocks to check existence first, so this
--    migration is idempotent and safe to run multiple times
--
-- 5. The SELECT policy allows all authenticated users to view
--    assignments. If you need more restrictive access (e.g., users
--    can only see their own assignments), modify the USING clause
--
-- =====================================================================
