-- Supabase performance advisor: multiple_permissive_policies.
--
-- Every permissive policy for a role/command is evaluated and OR-ed. This
-- removes the ones that can never change the outcome. Access is unchanged.
--
-- 1. Exact duplicates: rate_cards_2025 / rate_cards_tour_2025 carry a legacy
--    `p_*_public_*` copy (role public) of each authenticated write policy with
--    the same predicate (is_admin_or_management() is defined as
--    current_user_role() IN ('admin', 'management'), the same test the tour
--    copies spell out). anon has no profile, so its copy is always false.
--
-- 2. Subsumed reads: tours has `true` for authenticated next to
--    `auth.uid() IS NOT NULL` for public; the latter is false for anon and
--    already covered for authenticated.
--
-- 3. FOR ALL write policies next to a SELECT policy that already admits
--    every writer: the ALL policy was being evaluated on every read too.
--    Split it into INSERT/UPDATE/DELETE with the same expressions and roles.
--    (truck_planner_plan_case_counts: tp_can_read_plan_version() admits
--    tp_is_office_role(), which is all tp_can_edit_department() checks.)
--
-- Deliberately not touched:
--  * the *_job_tasks / job_documents / tour_documents policy sets: separate,
--    named concerns (oscar, production department, general) that later
--    migrations manage by name; after the InitPlan rewrite each extra
--    policy costs a few cached comparisons.
--  * rate_extras_2025: its two SELECT policies are not redundant by intent;
--    see the PR description (access question, not a performance change).

drop policy if exists p_rate_cards_2025_public_delete_11c1e5 on public.rate_cards_2025;
drop policy if exists p_rate_cards_2025_public_insert_71c32b on public.rate_cards_2025;
drop policy if exists p_rate_cards_2025_public_update_e14e92 on public.rate_cards_2025;

drop policy if exists p_rate_cards_tour_2025_public_delete_253492 on public.rate_cards_tour_2025;
drop policy if exists p_rate_cards_tour_2025_public_insert_00b7d8 on public.rate_cards_tour_2025;
drop policy if exists p_rate_cards_tour_2025_public_update_fa7ab6 on public.rate_cards_tour_2025;

drop policy if exists p_tours_public_select_5a6a0b on public.tours;

do $$
declare
  v_target record;
  v_policy record;
  v_roles text;
  v_suffix text;
begin
  perform set_config('search_path', 'public, extensions', true);

  for v_target in
    select *
    from (values
      ('madrid_holidays', 'Admins and management can manage Madrid holidays', 'madrid_holidays_manage'),
      ('dryhire_parent_folders', 'Allow management write', 'dryhire_parent_folders_manage'),
      ('staffing_campaigns', 'staffing_campaigns_write_management', 'staffing_campaigns_write_management'),
      ('staffing_campaign_roles', 'staffing_campaign_roles_write_management', 'staffing_campaign_roles_write_management'),
      ('truck_planner_bundle_rules', 'tp_bundle_rules_write', 'tp_bundle_rules_write'),
      ('truck_planner_bundle_versions', 'tp_bundle_versions_write', 'tp_bundle_versions_write'),
      ('truck_planner_case_skus', 'tp_case_skus_write', 'tp_case_skus_write'),
      ('truck_planner_plan_case_counts', 'tp_case_counts_write', 'tp_case_counts_write'),
      ('truck_planner_transport_mappings', 'tp_transport_mappings_write', 'tp_transport_mappings_write'),
      ('truck_planner_trucks', 'tp_trucks_write', 'tp_trucks_write')
    ) as t(table_name, policy_name, new_prefix)
  loop
    select p.qual, p.with_check, p.roles
    into v_policy
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_target.table_name
      and p.policyname = v_target.policy_name
      and p.cmd = 'ALL'
      and p.permissive = 'PERMISSIVE';

    if not found then
      raise notice 'policy split: %.% not found as FOR ALL, skipping', v_target.table_name, v_target.policy_name;
      continue;
    end if;

    select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ')
    into v_roles
    from unnest(v_policy.roles) as r;

    execute format('drop policy %I on public.%I', v_target.policy_name, v_target.table_name);

    foreach v_suffix in array array['insert', 'update', 'delete'] loop
      execute format(
        'create policy %I on public.%I as permissive for %s to %s%s%s',
        v_target.new_prefix || '_' || v_suffix,
        v_target.table_name,
        v_suffix,
        v_roles,
        -- A FOR ALL policy without WITH CHECK applies its USING expression to
        -- writes (pg_policies.with_check is NULL then), so carry that over.
        case when v_suffix in ('update', 'delete') and v_policy.qual is not null
             then format(' using (%s)', v_policy.qual) else '' end,
        case when v_suffix in ('insert', 'update') and coalesce(v_policy.with_check, v_policy.qual) is not null
             then format(' with check (%s)', coalesce(v_policy.with_check, v_policy.qual)) else '' end
      );
    end loop;
  end loop;
end;
$$;
