-- Diagnostic: Show tables with multiple permissive policies
-- This identifies which tables trigger the "multiple permissive policies" warning

-- Count permissive policies per table and command
SELECT
  schemaname,
  tablename,
  cmd as command,
  COUNT(*) as policy_count,
  string_agg(policyname, E'\n  • ' ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'  -- Only permissive policies
GROUP BY schemaname, tablename, cmd
HAVING COUNT(*) > 1  -- More than 1 policy per command
ORDER BY policy_count DESC, tablename, cmd;

-- Summary
SELECT
  COUNT(DISTINCT tablename) as tables_affected,
  SUM(policy_count) as total_policies,
  SUM(policy_count) - COUNT(*) as excess_policies
FROM (
  SELECT
    tablename,
    cmd,
    COUNT(*) as policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND permissive = 'PERMISSIVE'
  GROUP BY tablename, cmd
  HAVING COUNT(*) > 1
) subq;

-- Show example of one table's policies to see consolidation opportunity
SELECT
  tablename,
  policyname,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    -- Get the table with most policies as example
    SELECT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'PERMISSIVE'
    GROUP BY tablename, cmd
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
ORDER BY cmd, policyname;
