-- Fix All RLS Policies V2 - Minimal Changes Approach
--
-- This version ONLY wraps auth functions in SELECT, nothing else
-- Does NOT strip table prefixes or modify expressions
-- Should handle all 187+ remaining policies successfully

DO $$
DECLARE
  policy_record RECORD;
  fixed_using TEXT;
  fixed_with_check TEXT;
  fix_count INTEGER := 0;
  skip_count INTEGER := 0;
  policy_sql TEXT;
  error_msg TEXT;
BEGIN
  RAISE NOTICE 'Starting RLS policy performance fix V2...';
  RAISE NOTICE 'Using minimal-change approach: only wrapping auth functions';
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

    -- Replace ONLY the auth functions, keeping everything else intact
    IF policy_record.qual IS NOT NULL THEN
      fixed_using := regexp_replace(
        regexp_replace(
          regexp_replace(
            policy_record.qual::text,
            '([^(])auth\.uid\(\)',  -- Match auth.uid() not preceded by (
            '\1(SELECT auth.uid())',
            'g'
          ),
          '([^(])auth\.jwt\(\)',
          '\1(SELECT auth.jwt())',
          'g'
        ),
        '([^(])auth\.role\(\)',
        '\1(SELECT auth.role())',
        'g'
      );
      -- Handle cases at the start of the expression
      fixed_using := regexp_replace(
        regexp_replace(
          regexp_replace(
            fixed_using,
            '^auth\.uid\(\)',
            '(SELECT auth.uid())',
            'g'
          ),
          '^auth\.jwt\(\)',
          '(SELECT auth.jwt())',
          'g'
        ),
        '^auth\.role\(\)',
        '(SELECT auth.role())',
        'g'
      );
    END IF;

    IF policy_record.with_check IS NOT NULL THEN
      fixed_with_check := regexp_replace(
        regexp_replace(
          regexp_replace(
            policy_record.with_check::text,
            '([^(])auth\.uid\(\)',
            '\1(SELECT auth.uid())',
            'g'
          ),
          '([^(])auth\.jwt\(\)',
          '\1(SELECT auth.jwt())',
          'g'
        ),
        '([^(])auth\.role\(\)',
        '\1(SELECT auth.role())',
        'g'
      );
      -- Handle cases at the start of the expression
      fixed_with_check := regexp_replace(
        regexp_replace(
          regexp_replace(
            fixed_with_check,
            '^auth\.uid\(\)',
            '(SELECT auth.uid())',
            'g'
          ),
          '^auth\.jwt\(\)',
          '(SELECT auth.jwt())',
          'g'
        ),
        '^auth\.role\(\)',
        '(SELECT auth.role())',
        'g'
      );
    END IF;

    -- Wrap the DROP and CREATE in a nested exception block
    BEGIN
      -- Drop the policy
      EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON ' || policy_record.tablename || ';';

      -- Build CREATE POLICY statement
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

      -- Add USING clause (SELECT, UPDATE, DELETE, ALL)
      IF fixed_using IS NOT NULL AND policy_record.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') THEN
        policy_sql := policy_sql || ' USING (' || fixed_using || ')';
      END IF;

      -- Add WITH CHECK clause (INSERT, UPDATE, ALL)
      IF fixed_with_check IS NOT NULL AND policy_record.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
        policy_sql := policy_sql || ' WITH CHECK (' || fixed_with_check || ')';
      END IF;

      policy_sql := policy_sql || ';';

      -- Execute the CREATE POLICY statement
      EXECUTE policy_sql;

      -- Log progress
      IF fix_count % 10 = 0 THEN
        RAISE NOTICE 'Fixed % policies so far...', fix_count;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        skip_count := skip_count + 1;
        error_msg := SQLERRM;

        RAISE NOTICE 'SKIPPED: "%" on % - %',
          policy_record.policyname,
          policy_record.tablename,
          error_msg;

        -- Restore original policy
        BEGIN
          policy_sql := 'CREATE POLICY "' || policy_record.policyname || '" ON ' || policy_record.tablename;

          policy_sql := policy_sql ||
            CASE policy_record.cmd
              WHEN 'SELECT' THEN ' FOR SELECT'
              WHEN 'INSERT' THEN ' FOR INSERT'
              WHEN 'UPDATE' THEN ' FOR UPDATE'
              WHEN 'DELETE' THEN ' FOR DELETE'
              WHEN 'ALL' THEN ' FOR ALL'
              ELSE ''
            END;

          IF array_to_string(policy_record.roles, ',') != 'public' THEN
            policy_sql := policy_sql || ' TO ' || array_to_string(policy_record.roles, ', ');
          END IF;

          IF policy_record.qual IS NOT NULL AND policy_record.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') THEN
            policy_sql := policy_sql || ' USING (' || policy_record.qual::text || ')';
          END IF;

          IF policy_record.with_check IS NOT NULL AND policy_record.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
            policy_sql := policy_sql || ' WITH CHECK (' || policy_record.with_check::text || ')';
          END IF;

          policy_sql := policy_sql || ';';
          EXECUTE policy_sql;

          RAISE NOTICE '  -> Restored original';
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE '  -> WARNING: Could not restore!';
        END;
    END;

  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIX COMPLETE!';
  RAISE NOTICE 'Policies fixed: %', fix_count;
  RAISE NOTICE 'Policies skipped: %', skip_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  IF skip_count > 0 THEN
    RAISE NOTICE 'Note: % policies were skipped and need manual review', skip_count;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Fatal error: %', SQLERRM;
END $$;
