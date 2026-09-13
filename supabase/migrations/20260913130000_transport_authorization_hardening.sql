-- Transport/logistics authorization hardening.
--
-- 20260913121500 introduced the role-based write model but enforced it in exactly one
-- place: the enforce_transport_management_write trigger. The RLS policies on these tables
-- still described the previous model, so the two layers disagreed:
--
--   * transport_requests INSERT still allowed any user assigned to the job (a technician).
--   * transport_requests UPDATE still allowed the row's creator, whatever their role.
--   * logistics_events and logistics_event_departments still granted INSERT/UPDATE/DELETE
--     to the 'logistics' and 'house_tech' roles, contradicting read-only house-tech access.
--
-- Dropping or replacing the trigger would therefore silently restore write access. This
-- migration makes RLS express the same model so the guard is genuinely redundant, and
-- closes the trigger's own bypass.

-- ---------------------------------------------------------------------------
-- 1. Trust the JWT role claim, not the absence of a user id.
-- ---------------------------------------------------------------------------
-- The previous guard exempted any caller with a null auth.uid(). A request made with the
-- publishable anon key has no `sub` claim, so it satisfied that exemption and the trigger
-- became a no-op for it — leaving RLS as the only barrier. Key off the role claim instead:
-- service_role is the trusted backend, anon/authenticated must pass the role check, and a
-- session with no JWT at all is a direct database connection (migrations, psql, cron).
create or replace function public.transport_write_actor_is_trusted()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  begin
    v_role := nullif(current_setting('request.jwt.claim.role', true), '');
    if v_role is null then
      v_role := nullif(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
        ''
      );
    end if;
  exception when others then
    v_role := null;
  end;

  if v_role = 'service_role' then
    return true;
  end if;

  -- Any other presented role (anon, authenticated) must satisfy the role check.
  if v_role is not null then
    return false;
  end if;

  -- No JWT presented: not a PostgREST request.
  return true;
end;
$$;

revoke all on function public.transport_write_actor_is_trusted() from public, anon;
grant execute on function public.transport_write_actor_is_trusted() to authenticated, service_role;

create or replace function public.enforce_transport_management_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.transport_write_actor_is_trusted()
     and coalesce(public.get_current_user_role(), '') not in ('admin', 'management') then
    raise exception 'Transport operations require admin or management role'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_transport_management_write() from public, anon, authenticated;
grant execute on function public.enforce_transport_management_write() to service_role;

-- ---------------------------------------------------------------------------
-- 2. Align RLS with the role model.
-- ---------------------------------------------------------------------------
-- Drop by discovery rather than by name: the baseline schema names these policies
-- inconsistently ("Users can ...", "p_<table>_public_<op>_<hash>", "anon_..._for_realtime").
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'transport_requests',
        'transport_request_items',
        'logistics_events',
        'logistics_event_departments'
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      v_policy.policyname,
      v_policy.tablename
    );
  end loop;
end;
$$;

alter table public.transport_requests enable row level security;
alter table public.transport_request_items enable row level security;
alter table public.logistics_events enable row level security;
alter table public.logistics_event_departments enable row level security;

-- Transport requests: the operational inbox is visible to the logistics workspace roles,
-- and to whoever raised the request. Writes are admin/management only.
create policy transport_requests_select_scoped
  on public.transport_requests for select to authenticated
  using (
    public.get_current_user_role() = any (array['admin', 'management', 'house_tech'])
    or created_by = (select auth.uid())
  );

create policy transport_requests_insert_management
  on public.transport_requests for insert to authenticated
  with check (public.get_current_user_role() = any (array['admin', 'management']));

create policy transport_requests_update_management
  on public.transport_requests for update to authenticated
  using (public.get_current_user_role() = any (array['admin', 'management']))
  with check (public.get_current_user_role() = any (array['admin', 'management']));

create policy transport_requests_delete_management
  on public.transport_requests for delete to authenticated
  using (public.get_current_user_role() = any (array['admin', 'management']));

-- Requested vehicles follow their parent request for reads, management-only for writes.
create policy transport_request_items_select_scoped
  on public.transport_request_items for select to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_items.request_id
        and (
          public.get_current_user_role() = any (array['admin', 'management', 'house_tech'])
          or tr.created_by = (select auth.uid())
        )
    )
  );

create policy transport_request_items_insert_management
  on public.transport_request_items for insert to authenticated
  with check (public.get_current_user_role() = any (array['admin', 'management']));

create policy transport_request_items_update_management
  on public.transport_request_items for update to authenticated
  using (public.get_current_user_role() = any (array['admin', 'management']))
  with check (public.get_current_user_role() = any (array['admin', 'management']));

create policy transport_request_items_delete_management
  on public.transport_request_items for delete to authenticated
  using (public.get_current_user_role() = any (array['admin', 'management']));

-- Execution events keep their wider read audience (the calendar, Today panel and wallboard)
-- but lose the 'logistics'/'house_tech' write grants the old policies carried.
create policy logistics_events_select_scoped
  on public.logistics_events for select to authenticated
  using (
    public.get_current_user_role() = any (
      array['admin', 'management', 'logistics', 'house_tech', 'wallboard']
    )
  );

create policy logistics_events_insert_management
  on public.logistics_events for insert to authenticated
  with check (public.get_current_user_role() = any (array['admin', 'management']));

create policy logistics_events_update_management
  on public.logistics_events for update to authenticated
  using (public.get_current_user_role() = any (array['admin', 'management']))
  with check (public.get_current_user_role() = any (array['admin', 'management']));

create policy logistics_events_delete_management
  on public.logistics_events for delete to authenticated
  using (public.get_current_user_role() = any (array['admin', 'management']));

create policy logistics_event_departments_select_scoped
  on public.logistics_event_departments for select to authenticated
  using (
    public.get_current_user_role() = any (
      array['admin', 'management', 'logistics', 'house_tech', 'wallboard']
    )
  );

create policy logistics_event_departments_insert_management
  on public.logistics_event_departments for insert to authenticated
  with check (public.get_current_user_role() = any (array['admin', 'management']));

create policy logistics_event_departments_update_management
  on public.logistics_event_departments for update to authenticated
  using (public.get_current_user_role() = any (array['admin', 'management']))
  with check (public.get_current_user_role() = any (array['admin', 'management']));

create policy logistics_event_departments_delete_management
  on public.logistics_event_departments for delete to authenticated
  using (public.get_current_user_role() = any (array['admin', 'management']));
