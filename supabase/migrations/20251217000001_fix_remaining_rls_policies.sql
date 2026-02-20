-- Migration: Fix remaining RLS performance issues (187 policies across 77 tables)
--
-- This migration was generated using supabase/.temp/generate_policy_fixes.sql
--
-- Run the generator script in Supabase SQL Editor, then paste the output below
-- between the BEGIN and COMMIT statements.
--
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

BEGIN;

-- ============================================================================
-- PASTE GENERATED SQL HERE
-- ============================================================================
--
-- Instructions:
-- 1. Run supabase/.temp/generate_policy_fixes.sql in Supabase SQL Editor
-- 2. Copy ALL rows from the 'fix_sql' column output
-- 3. Paste them here (replacing this comment block)
-- 4. Save this file
-- 5. Push to deploy the migration
--
-- The generated SQL will look like:
--
-- -- Fix policy: some_policy on table: some_table
-- DROP POLICY IF EXISTS "some_policy" ON some_table;
-- CREATE POLICY "some_policy" ON some_table
--   FOR SELECT
--   USING (
--     (SELECT auth.uid()) = user_id
--   );
--
-- [... 187 more policies ...]
--
-- ============================================================================




-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- This migration fixes all remaining RLS policies with performance issues.
-- After applying, re-run the diagnostic query to verify 0 policies remain.
--
-- Expected result:
--   total_policies_needing_fix: 0
--   affected_tables: 0
--
-- ============================================================================

COMMIT;
