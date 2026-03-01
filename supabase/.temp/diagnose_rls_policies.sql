-- Diagnostic Query: Find ALL RLS policies with auth function calls
-- Run this in Supabase SQL Editor to see all policies that need fixing

-- Get all policies that use auth.uid(), auth.jwt(), or auth.role()
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause,
  with_check as with_check_clause,
  -- Check which auth functions are used
  CASE
    WHEN qual::text LIKE '%auth.uid()%' OR with_check::text LIKE '%auth.uid()%' THEN 'auth.uid()'
    ELSE ''
  END ||
  CASE
    WHEN qual::text LIKE '%auth.jwt()%' OR with_check::text LIKE '%auth.jwt()%' THEN ' auth.jwt()'
    ELSE ''
  END ||
  CASE
    WHEN qual::text LIKE '%auth.role()%' OR with_check::text LIKE '%auth.role()%' THEN ' auth.role()'
    ELSE ''
  END as auth_functions_used,
  -- Check if already wrapped in SELECT
  CASE
    WHEN qual::text LIKE '%(select auth.%' OR with_check::text LIKE '%(select auth.%'
      OR qual::text LIKE '%(SELECT auth.%' OR with_check::text LIKE '%(SELECT auth.%'
    THEN 'Already Fixed ✓'
    ELSE 'Needs Fix ⚠️'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%auth.uid()%'
    OR qual::text LIKE '%auth.jwt()%'
    OR qual::text LIKE '%auth.role()%'
    OR with_check::text LIKE '%auth.uid()%'
    OR with_check::text LIKE '%auth.jwt()%'
    OR with_check::text LIKE '%auth.role()%'
  )
  -- Exclude policies that are already fixed
  AND NOT (
    (qual::text LIKE '%(select auth.%' OR qual::text LIKE '%(SELECT auth.%')
    AND (with_check::text LIKE '%(select auth.%' OR with_check::text LIKE '%(SELECT auth.%' OR with_check IS NULL)
  )
ORDER BY tablename, policyname;

-- Count summary
SELECT
  COUNT(*) as total_policies_needing_fix,
  COUNT(DISTINCT tablename) as affected_tables
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text LIKE '%auth.uid()%'
    OR qual::text LIKE '%auth.jwt()%'
    OR qual::text LIKE '%auth.role()%'
    OR with_check::text LIKE '%auth.uid()%'
    OR with_check::text LIKE '%auth.jwt()%'
    OR with_check::text LIKE '%auth.role()%'
  )
  AND NOT (
    (qual::text LIKE '%(select auth.%' OR qual::text LIKE '%(SELECT auth.%')
    AND (with_check::text LIKE '%(select auth.%' OR with_check::text LIKE '%(SELECT auth.%' OR with_check IS NULL)
  );
