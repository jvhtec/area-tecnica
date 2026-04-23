-- Consolidate Multiple Permissive Policies
--
-- This script combines multiple permissive policies on the same table/command
-- into single consolidated policies to eliminate "multiple permissive policies" warnings
--
-- IMPORTANT: Review the output before running!
-- This will DROP and recreate policies with combined logic

DO $$
DECLARE
  table_cmd_record RECORD;
  policy_record RECORD;
  new_policy_name TEXT;
  combined_using TEXT;
  combined_with_check TEXT;
  policy_roles TEXT[];
  policy_sql TEXT;
  consolidate_count INTEGER := 0;
  skip_count INTEGER := 0;
  using_clauses TEXT[];
  with_check_clauses TEXT[];
BEGIN
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'CONSOLIDATING MULTIPLE PERMISSIVE POLICIES';
  RAISE NOTICE '=========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'This will combine multiple policies per table/command';
  RAISE NOTICE 'into single consolidated policies.';
  RAISE NOTICE '';

  -- Loop through each table/command combination that has multiple permissive policies
  FOR table_cmd_record IN
    SELECT
      schemaname,
      tablename,
      cmd,
      COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
    GROUP BY schemaname, tablename, cmd
    HAVING COUNT(*) > 1
    ORDER BY tablename, cmd
  LOOP
    BEGIN
      RAISE NOTICE 'Processing %.% (% command) - % policies to consolidate',
        table_cmd_record.schemaname,
        table_cmd_record.tablename,
        table_cmd_record.cmd,
        table_cmd_record.policy_count;

      -- Reset arrays
      using_clauses := ARRAY[]::TEXT[];
      with_check_clauses := ARRAY[]::TEXT[];
      policy_roles := ARRAY[]::TEXT[];

      -- Collect all policies for this table/command
      FOR policy_record IN
        SELECT
          policyname,
          qual,
          with_check,
          roles
        FROM pg_policies
        WHERE schemaname = table_cmd_record.schemaname
          AND tablename = table_cmd_record.tablename
          AND cmd = table_cmd_record.cmd
          AND permissive = 'PERMISSIVE'
        ORDER BY policyname
      LOOP
        -- Collect USING clauses
        IF policy_record.qual IS NOT NULL THEN
          using_clauses := array_append(using_clauses, '(' || policy_record.qual::text || ')');
        END IF;

        -- Collect WITH CHECK clauses
        IF policy_record.with_check IS NOT NULL THEN
          with_check_clauses := array_append(with_check_clauses, '(' || policy_record.with_check::text || ')');
        END IF;

        -- Collect roles (use authenticated if any policy uses it)
        policy_roles := policy_roles || policy_record.roles;

        -- Drop the old policy
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON ' || table_cmd_record.tablename;
      END LOOP;

      -- Remove duplicate roles
      policy_roles := (SELECT array_agg(DISTINCT role ORDER BY role) FROM unnest(policy_roles) role);

      -- Create new consolidated policy name
      new_policy_name := table_cmd_record.tablename || '_' ||
                         lower(table_cmd_record.cmd) || '_consolidated';

      -- Combine USING clauses with OR
      IF array_length(using_clauses, 1) > 0 THEN
        combined_using := array_to_string(using_clauses, ' OR ');
      END IF;

      -- Combine WITH CHECK clauses with OR
      IF array_length(with_check_clauses, 1) > 0 THEN
        combined_with_check := array_to_string(with_check_clauses, ' OR ');
      END IF;

      -- Build new consolidated policy
      policy_sql := 'CREATE POLICY "' || new_policy_name || '" ON ' || table_cmd_record.tablename;

      -- Add command type
      CASE table_cmd_record.cmd
        WHEN 'SELECT' THEN policy_sql := policy_sql || ' FOR SELECT';
        WHEN 'INSERT' THEN policy_sql := policy_sql || ' FOR INSERT';
        WHEN 'UPDATE' THEN policy_sql := policy_sql || ' FOR UPDATE';
        WHEN 'DELETE' THEN policy_sql := policy_sql || ' FOR DELETE';
        WHEN 'ALL' THEN policy_sql := policy_sql || ' FOR ALL';
      END CASE;

      -- Add roles
      IF array_to_string(policy_roles, ',') != 'public' THEN
        policy_sql := policy_sql || ' TO ' || array_to_string(policy_roles, ', ');
      END IF;

      -- Add USING clause (for SELECT, UPDATE, DELETE, ALL)
      IF combined_using IS NOT NULL AND table_cmd_record.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') THEN
        policy_sql := policy_sql || ' USING (' || combined_using || ')';
      END IF;

      -- Add WITH CHECK clause (for INSERT, UPDATE, ALL)
      IF combined_with_check IS NOT NULL AND table_cmd_record.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
        policy_sql := policy_sql || ' WITH CHECK (' || combined_with_check || ')';
      END IF;

      policy_sql := policy_sql || ';';

      -- Execute the consolidated policy
      EXECUTE policy_sql;

      consolidate_count := consolidate_count + 1;

      RAISE NOTICE '  ✓ Created consolidated policy: "%"', new_policy_name;

    EXCEPTION
      WHEN OTHERS THEN
        skip_count := skip_count + 1;
        RAISE NOTICE '  ✗ FAILED on %.%: %',
          table_cmd_record.tablename,
          table_cmd_record.cmd,
          SQLERRM;
        RAISE NOTICE '    Policies were dropped but not recreated - MANUAL FIX REQUIRED!';
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'CONSOLIDATION COMPLETE!';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'Table/command combinations consolidated: %', consolidate_count;
  RAISE NOTICE 'Failed consolidations: %', skip_count;
  RAISE NOTICE '';

  IF skip_count = 0 THEN
    RAISE NOTICE '✓ All multiple permissive policies successfully consolidated!';
    RAISE NOTICE '';
    RAISE NOTICE 'Expected result:';
    RAISE NOTICE '  - 900+ warnings should drop to ~0';
    RAISE NOTICE '  - Query performance may improve slightly';
    RAISE NOTICE '  - Policies are now easier to manage';
  ELSE
    RAISE NOTICE '⚠ % consolidations failed and need manual review!', skip_count;
    RAISE NOTICE '  Check the log above for details.';
  END IF;
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Fatal error in consolidation script: %', SQLERRM;
END $$;
