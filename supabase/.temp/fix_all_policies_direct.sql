-- Direct Fix Script: Fixes ALL RLS policies with performance issues
--
-- Run this ENTIRE script in Supabase SQL Editor to fix all 187 policies at once
-- This uses dynamic SQL to generate and execute all fixes automatically
--
-- ⚠️  IMPORTANT: Review the output carefully before proceeding
-- This will modify ALL policies with unwrapped auth function calls

DO $$
DECLARE
  policy_record RECORD;
  fixed_using TEXT;
  fixed_with_check TEXT;
  fix_count INTEGER := 0;
  policy_sql TEXT;
BEGIN
  RAISE NOTICE 'Starting RLS policy performance fix...';
  RAISE NOTICE 'This will fix policies by wrapping auth functions in SELECT subqueries';
  RAISE NOTICE '';

  -- Loop through all policies that need fixing
  FOR policy_record IN
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      -- Find policies with unwrapped auth functions
      AND (
        qual::text ~ 'auth\.(uid|jwt|role)\(\)'
        OR with_check::text ~ 'auth\.(uid|jwt|role)\(\)'
      )
      -- Exclude already-fixed policies
      AND NOT (
        (qual IS NULL OR qual::text ~ '\(select auth\.' OR qual::text ~ '\(SELECT auth\.')
        AND (with_check IS NULL OR with_check::text ~ '\(select auth\.' OR with_check::text ~ '\(SELECT auth\.')
      )
    ORDER BY tablename, policyname
  LOOP
    -- Increment counter
    fix_count := fix_count + 1;

    -- Replace unwrapped auth functions with wrapped ones in USING clause
    IF policy_record.qual IS NOT NULL THEN
      fixed_using := regexp_replace(
        regexp_replace(
          regexp_replace(
            policy_record.qual::text,
            'auth\.uid\(\)',
            '(SELECT auth.uid())',
            'g'
          ),
          'auth\.jwt\(\)',
          '(SELECT auth.jwt())',
          'g'
        ),
        'auth\.role\(\)',
        '(SELECT auth.role())',
        'g'
      );
    END IF;

    -- Replace unwrapped auth functions with wrapped ones in WITH CHECK clause
    IF policy_record.with_check IS NOT NULL THEN
      fixed_with_check := regexp_replace(
        regexp_replace(
          regexp_replace(
            policy_record.with_check::text,
            'auth\.uid\(\)',
            '(SELECT auth.uid())',
            'g'
          ),
          'auth\.jwt\(\)',
          '(SELECT auth.jwt())',
          'g'
        ),
        'auth\.role\(\)',
        '(SELECT auth.role())',
        'g'
      );
    END IF;

    -- Build the DROP POLICY statement
    policy_sql := 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON ' || policy_record.tablename || ';';
    EXECUTE policy_sql;

    -- Build the CREATE POLICY statement
    policy_sql := 'CREATE POLICY "' || policy_record.policyname || '" ON ' || policy_record.tablename;

    -- Add command type
    policy_sql := policy_sql ||
      CASE policy_record.cmd
        WHEN 'SELECT' THEN ' FOR SELECT'
        WHEN 'INSERT' THEN ' FOR INSERT'
        WHEN 'UPDATE' THEN ' FOR UPDATE'
        WHEN 'DELETE' THEN ' FOR DELETE'
        WHEN 'ALL' THEN ' FOR ALL'
        ELSE ''
      END;

    -- Add roles if not public
    IF array_to_string(policy_record.roles, ',') != 'public' THEN
      policy_sql := policy_sql || ' TO ' || array_to_string(policy_record.roles, ', ');
    END IF;

    -- Add USING clause (only for SELECT, UPDATE, DELETE, ALL - not INSERT)
    IF fixed_using IS NOT NULL AND policy_record.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') THEN
      policy_sql := policy_sql || ' USING (' || fixed_using || ')';
    END IF;

    -- Add WITH CHECK clause (only for INSERT, UPDATE, ALL - not SELECT or DELETE)
    IF fixed_with_check IS NOT NULL AND policy_record.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
      policy_sql := policy_sql || ' WITH CHECK (' || fixed_with_check || ')';
    END IF;

    policy_sql := policy_sql || ';';

    -- Execute the CREATE POLICY statement
    EXECUTE policy_sql;

    -- Log progress every 10 policies
    IF fix_count % 10 = 0 THEN
      RAISE NOTICE 'Fixed % policies so far...', fix_count;
    END IF;

  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS POLICY FIX COMPLETE!';
  RAISE NOTICE 'Total policies fixed: %', fix_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Re-run the diagnostic query to verify 0 policies remain';
  RAISE NOTICE '2. Check Supabase dashboard - warnings should be gone';
  RAISE NOTICE '3. Monitor query performance improvements';
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error fixing policies: %', SQLERRM;
END $$;
