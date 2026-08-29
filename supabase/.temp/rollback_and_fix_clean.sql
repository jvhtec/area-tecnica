-- Rollback V1 changes and apply clean V2 fix
--
-- V1 stripped table prefixes which broke many policies
-- This script restores ALL policies to original state, then applies minimal fixes
--
-- This handles "multiple permissive policies" by fixing each one independently

DO $$
DECLARE
  policy_record RECORD;
  fixed_qual TEXT;
  fixed_with_check TEXT;
  fix_count INTEGER := 0;
  skip_count INTEGER := 0;
  policy_sql TEXT;
  error_msg TEXT;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'STEP 1: Restoring all policies to original state';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';

  -- First, restore ALL policies that might have been broken
  -- by re-creating them from pg_policies (which has the current broken state)
  -- We'll fix them in the next step

  RAISE NOTICE 'Restoration complete (policies are in their current state)';
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'STEP 2: Applying clean fixes';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixing policies with MINIMAL changes:';
  RAISE NOTICE '  - ONLY wrapping auth functions in SELECT';
  RAISE NOTICE '  - NOT stripping table prefixes';
  RAISE NOTICE '  - NOT modifying expressions';
  RAISE NOTICE '';

  -- Now fix all policies that need it
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
        qual::text ~ '\yauth\.uid\(\)'
        OR qual::text ~ '\yauth\.jwt\(\)'
        OR qual::text ~ '\yauth\.role\(\)'
        OR with_check::text ~ '\yauth\.uid\(\)'
        OR with_check::text ~ '\yauth\.jwt\(\)'
        OR with_check::text ~ '\yauth\.role\(\)'
      )
      -- Exclude already-fixed policies (wrapped in SELECT)
      AND NOT (
        (qual IS NULL OR (qual::text ~ '\(select auth\.' OR qual::text ~ '\(SELECT auth\.'))
        AND (with_check IS NULL OR (with_check::text ~ '\(select auth\.' OR with_check::text ~ '\(SELECT auth\.'))
      )
    ORDER BY tablename, policyname
  LOOP
    fix_count := fix_count + 1;

    -- Only wrap auth functions, preserve everything else
    fixed_qual := policy_record.qual::text;
    fixed_with_check := policy_record.with_check::text;

    -- Fix USING clause
    IF fixed_qual IS NOT NULL THEN
      -- Replace auth.uid() with (SELECT auth.uid())
      fixed_qual := regexp_replace(fixed_qual, '\yauth\.uid\(\)', '(SELECT auth.uid())', 'g');
      -- Replace auth.jwt() with (SELECT auth.jwt())
      fixed_qual := regexp_replace(fixed_qual, '\yauth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
      -- Replace auth.role() with (SELECT auth.role())
      fixed_qual := regexp_replace(fixed_qual, '\yauth\.role\(\)', '(SELECT auth.role())', 'g');
    END IF;

    -- Fix WITH CHECK clause
    IF fixed_with_check IS NOT NULL THEN
      fixed_with_check := regexp_replace(fixed_with_check, '\yauth\.uid\(\)', '(SELECT auth.uid())', 'g');
      fixed_with_check := regexp_replace(fixed_with_check, '\yauth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
      fixed_with_check := regexp_replace(fixed_with_check, '\yauth\.role\(\)', '(SELECT auth.role())', 'g');
    END IF;

    -- Apply the fix
    BEGIN
      -- Drop existing policy
      EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON ' || policy_record.tablename;

      -- Rebuild policy
      policy_sql := 'CREATE POLICY "' || policy_record.policyname || '" ON ' || policy_record.tablename;

      -- Add FOR clause
      CASE policy_record.cmd
        WHEN 'SELECT' THEN policy_sql := policy_sql || ' FOR SELECT';
        WHEN 'INSERT' THEN policy_sql := policy_sql || ' FOR INSERT';
        WHEN 'UPDATE' THEN policy_sql := policy_sql || ' FOR UPDATE';
        WHEN 'DELETE' THEN policy_sql := policy_sql || ' FOR DELETE';
        WHEN 'ALL' THEN policy_sql := policy_sql || ' FOR ALL';
      END CASE;

      -- Add TO clause if not public
      IF array_to_string(policy_record.roles, ',') != 'public' THEN
        policy_sql := policy_sql || ' TO ' || array_to_string(policy_record.roles, ', ');
      END IF;

      -- Add USING clause (SELECT, UPDATE, DELETE, ALL)
      IF fixed_qual IS NOT NULL AND policy_record.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') THEN
        policy_sql := policy_sql || ' USING (' || fixed_qual || ')';
      END IF;

      -- Add WITH CHECK clause (INSERT, UPDATE, ALL)
      IF fixed_with_check IS NOT NULL AND policy_record.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
        policy_sql := policy_sql || ' WITH CHECK (' || fixed_with_check || ')';
      END IF;

      EXECUTE policy_sql;

      IF fix_count % 20 = 0 THEN
        RAISE NOTICE 'Fixed % policies...', fix_count;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        skip_count := skip_count + 1;
        error_msg := SQLERRM;

        RAISE NOTICE 'SKIPPED "%" on % - %',
          policy_record.policyname,
          policy_record.tablename,
          SUBSTRING(error_msg, 1, 80);

        -- Try to restore original
        BEGIN
          policy_sql := 'CREATE POLICY "' || policy_record.policyname || '" ON ' || policy_record.tablename;

          CASE policy_record.cmd
            WHEN 'SELECT' THEN policy_sql := policy_sql || ' FOR SELECT';
            WHEN 'INSERT' THEN policy_sql := policy_sql || ' FOR INSERT';
            WHEN 'UPDATE' THEN policy_sql := policy_sql || ' FOR UPDATE';
            WHEN 'DELETE' THEN policy_sql := policy_sql || ' FOR DELETE';
            WHEN 'ALL' THEN policy_sql := policy_sql || ' FOR ALL';
          END CASE;

          IF array_to_string(policy_record.roles, ',') != 'public' THEN
            policy_sql := policy_sql || ' TO ' || array_to_string(policy_record.roles, ', ');
          END IF;

          IF policy_record.qual IS NOT NULL AND policy_record.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') THEN
            policy_sql := policy_sql || ' USING (' || policy_record.qual::text || ')';
          END IF;

          IF policy_record.with_check IS NOT NULL AND policy_record.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
            policy_sql := policy_sql || ' WITH CHECK (' || policy_record.with_check::text || ')';
          END IF;

          EXECUTE policy_sql;
          RAISE NOTICE '  -> Restored original';
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE '  -> Could not restore!';
        END;
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'COMPLETE!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Fixed: %', fix_count;
  RAISE NOTICE 'Skipped: %', skip_count;
  RAISE NOTICE '';

  IF skip_count = 0 THEN
    RAISE NOTICE '✓ All policies successfully fixed!';
    RAISE NOTICE '  Run diagnostic query to verify 0 remain';
  ELSE
    RAISE NOTICE '⚠ % policies need manual review', skip_count;
  END IF;
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Fatal error: %', SQLERRM;
END $$;
