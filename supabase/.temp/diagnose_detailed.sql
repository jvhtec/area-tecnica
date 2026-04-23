-- Detailed Diagnostic: Show exactly which policies still need fixing

-- Part 1: Count by schema
SELECT
  schemaname,
  COUNT(*) as policies_needing_fix
FROM pg_policies
WHERE (
    qual::text ~ 'auth\.(uid|jwt|role)\(\)'
    OR with_check::text ~ 'auth\.(uid|jwt|role)\(\)'
  )
  AND NOT (
    (qual IS NULL OR qual::text ~ '\(select auth\.' OR qual::text ~ '\(SELECT auth\.')
    AND (with_check IS NULL OR with_check::text ~ '\(select auth\.' OR with_check::text ~ '\(SELECT auth\.')
  )
GROUP BY schemaname
ORDER BY schemaname;

-- Part 2: Count by table (top 20)
SELECT
  tablename,
  COUNT(*) as policy_count,
  string_agg(policyname, ', ' ORDER BY policyname) as policy_names
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text ~ 'auth\.(uid|jwt|role)\(\)'
    OR with_check::text ~ 'auth\.(uid|jwt|role)\(\)'
  )
  AND NOT (
    (qual IS NULL OR qual::text ~ '\(select auth\.' OR qual::text ~ '\(SELECT auth\.')
    AND (with_check IS NULL OR with_check::text ~ '\(select auth\.' OR with_check::text ~ '\(SELECT auth\.')
  )
GROUP BY tablename
ORDER BY policy_count DESC, tablename
LIMIT 20;

-- Part 3: Total count
SELECT
  COUNT(*) as total_policies_still_needing_fix,
  COUNT(DISTINCT tablename) as total_tables_affected
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text ~ 'auth\.(uid|jwt|role)\(\)'
    OR with_check::text ~ 'auth\.(uid|jwt|role)\(\)'
  )
  AND NOT (
    (qual IS NULL OR qual::text ~ '\(select auth\.' OR qual::text ~ '\(SELECT auth\.')
    AND (with_check IS NULL OR with_check::text ~ '\(select auth\.' OR with_check::text ~ '\(SELECT auth\.')
  );

-- Part 4: Show a few example policies that still need fixing
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual::text ~ 'auth\.(uid|jwt|role)\(\)' THEN 'YES'
    ELSE 'NO'
  END as has_unwrapped_using,
  CASE
    WHEN with_check::text ~ 'auth\.(uid|jwt|role)\(\)' THEN 'YES'
    ELSE 'NO'
  END as has_unwrapped_with_check,
  substring(qual::text, 1, 100) as using_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text ~ 'auth\.(uid|jwt|role)\(\)'
    OR with_check::text ~ 'auth\.(uid|jwt|role)\(\)'
  )
  AND NOT (
    (qual IS NULL OR qual::text ~ '\(select auth\.' OR qual::text ~ '\(SELECT auth\.')
    AND (with_check IS NULL OR with_check::text ~ '\(select auth\.' OR with_check::text ~ '\(SELECT auth\.')
  )
ORDER BY tablename, policyname
LIMIT 10;
