-- Supabase performance advisor: auth_rls_initplan.
--
-- A bare auth.uid() / auth.jwt() / auth.role() in a policy is evaluated once
-- per row. So are our zero-argument STABLE helpers (current_user_role(),
-- get_current_user_role(), current_user_department(),
-- is_admin_or_management()), which each query profiles: current_user_role()
-- alone ran 6.4M times in a month. Wrapping a call as `(select f())` turns it
-- into an InitPlan evaluated once per statement. The functions take no
-- arguments and are STABLE, so the result is identical; only the number of
-- evaluations changes.
--
-- Calls that take row values (can_access_department_task(assigned_department),
-- can_manage_technician(technician_id), ...) are left alone: they depend on
-- the row and must stay per-row.
--
-- 385 policies on 128 tables are affected, so the rewrite is applied to the
-- live (deparsed) policy expressions rather than restated by hand. Already
-- wrapped calls (deparsed as `( SELECT f() AS f)`) are skipped.

do $$
declare
  -- Group 1 is the call to wrap. Skipped when it directly follows "SELECT "
  -- (already wrapped) or "." (the tail of a schema-qualified name).
  c_pattern constant text :=
    '(?<!SELECT )(?<![.\w])((?:public\.)?(?:get_current_user_role|current_user_role|current_user_department|is_admin_or_management)\(\)|auth\.(?:uid|jwt|role)\(\))';
  v_policy record;
  v_using text;
  v_check text;
  v_sql text;
  v_count integer := 0;
begin
  -- pg_policies deparses relative to search_path; pin it so expressions
  -- read back the same way they were validated.
  perform set_config('search_path', 'public, extensions', true);

  for v_policy in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ c_pattern
    order by tablename, policyname
  loop
    v_using := regexp_replace(v_policy.qual, c_pattern, '(select \1)', 'g');
    v_check := regexp_replace(v_policy.with_check, c_pattern, '(select \1)', 'g');

    v_sql := format('alter policy %I on public.%I', v_policy.policyname, v_policy.tablename);
    if v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute v_sql;
    v_count := v_count + 1;
  end loop;

  raise notice 'rls initplan: rewrote % policies', v_count;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ c_pattern
  ) then
    raise exception 'rls initplan: per-row auth helper calls remain after rewrite';
  end if;
end;
$$;
