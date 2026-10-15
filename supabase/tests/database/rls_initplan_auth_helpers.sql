CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path TO public, extensions;

SELECT plan(1);

-- auth.uid()/auth.jwt()/auth.role() and the zero-argument role helpers must
-- be wrapped as `(select f())` in policies so Postgres evaluates them once per
-- statement (InitPlan) instead of once per row. See
-- 20261015202000_rls_initplan_wrap_auth_helpers.sql.
SELECT is_empty(
  $$ SELECT tablename || '.' || policyname
     FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
           ~ '(?<!SELECT )(?<![.\w])((?:public\.)?(?:get_current_user_role|current_user_role|current_user_department|is_admin_or_management)\(\)|auth\.(?:uid|jwt|role)\(\))' $$,
  'RLS policies evaluate auth helpers once per statement, not per row'
);

SELECT * FROM finish();
