-- Optimize RLS policies by wrapping auth function calls in subqueries
-- This prevents PostgreSQL from re-evaluating auth functions for each row
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =====================================================================
-- SKILLS TABLE
-- =====================================================================

drop policy if exists "Authenticated can read skills" on public.skills;
create policy "Authenticated can read skills"
on public.skills
for select
using ((select auth.role()) = 'authenticated');

-- =====================================================================
-- PROFILE_SKILLS TABLE
-- =====================================================================

drop policy if exists "Authenticated can read profile_skills" on public.profile_skills;
create policy "Authenticated can read profile_skills"
on public.profile_skills
for select
using ((select auth.role()) = 'authenticated');
