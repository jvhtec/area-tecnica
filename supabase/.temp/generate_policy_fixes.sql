-- Helper Script: Auto-generate RLS policy fixes for remaining policies
--
-- This script generates DROP/CREATE statements to fix any RLS policies
-- that still have unwrapped auth function calls.
--
-- HOW TO USE:
-- 1. Run this in Supabase SQL Editor
-- 2. Copy the output SQL statements
-- 3. Create a new migration file with those statements
-- 4. Apply the migration

-- Generate fix statements for all policies with unwrapped auth functions
SELECT
  tablename,
  policyname,
  '-- Fix policy: ' || policyname || ' on table: ' || tablename || E'\n' ||
  'DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';' || E'\n' ||
  'CREATE POLICY "' || policyname || '" ON ' || tablename ||
  CASE
    WHEN cmd = 'SELECT' THEN ' FOR SELECT'
    WHEN cmd = 'INSERT' THEN ' FOR INSERT'
    WHEN cmd = 'UPDATE' THEN ' FOR UPDATE'
    WHEN cmd = 'DELETE' THEN ' FOR DELETE'
    WHEN cmd = 'ALL' THEN ' FOR ALL'
    ELSE ''
  END ||
  CASE
    WHEN array_to_string(roles, ',') != 'public'
    THEN E'\n  TO ' || array_to_string(roles, ', ')
    ELSE ''
  END ||
  CASE
    WHEN qual IS NOT NULL THEN
      E'\n  USING (' || E'\n    ' ||
      -- Replace unwrapped auth functions with wrapped ones
      regexp_replace(
        regexp_replace(
          regexp_replace(
            qual::text,
            'auth\.uid\(\)',  -- Match auth.uid()
            '(SELECT auth.uid())',  -- Replace with wrapped version
            'g'
          ),
          'auth\.jwt\(\)',  -- Match auth.jwt()
          '(SELECT auth.jwt())',
          'g'
        ),
        'auth\.role\(\)',  -- Match auth.role()
        '(SELECT auth.role())',
        'g'
      ) ||
      E'\n  )'
    ELSE ''
  END ||
  CASE
    WHEN with_check IS NOT NULL THEN
      E'\n  WITH CHECK (' || E'\n    ' ||
      -- Replace unwrapped auth functions with wrapped ones
      regexp_replace(
        regexp_replace(
          regexp_replace(
            with_check::text,
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
      ) ||
      E'\n  )'
    ELSE ''
  END ||
  ';' || E'\n' as fix_sql
FROM pg_policies
WHERE schemaname = 'public'
  -- Find policies with unwrapped auth functions
  AND (
    qual::text ~ 'auth\.(uid|jwt|role)\(\)'
    OR with_check::text ~ 'auth\.(uid|jwt|role)\(\)'
  )
  -- Exclude already-fixed policies (wrapped in SELECT)
  AND NOT (
    (qual IS NULL OR qual::text ~ '\(select auth\.' OR qual::text ~ '\(SELECT auth\.')
    AND (with_check IS NULL OR with_check::text ~ '\(select auth\.' OR with_check::text ~ '\(SELECT auth\.')
  )
ORDER BY tablename, policyname;

-- Also show a count
SELECT
  E'\n-- ============================================\n' ||
  '-- SUMMARY: ' || COUNT(*) || ' policies need fixing across ' ||
  COUNT(DISTINCT tablename) || ' tables\n' ||
  '-- ============================================\n'
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

-- List affected tables
SELECT
  E'\n-- Affected tables:\n' ||
  string_agg('--   - ' || tablename || ' (' || count || ' policies)', E'\n' ORDER BY tablename)
FROM (
  SELECT
    tablename,
    COUNT(*)::text as count
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
) t;
