-- Logistics transport operations — row level security and write guards.
--
-- RLS expresses the same admin/management write model the guard triggers enforce, so neither
-- layer is load-bearing on its own. Runs after the function definitions it attaches.

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

-- ---------------------------------------------------------------------------
-- Guard triggers
-- ---------------------------------------------------------------------------
drop trigger if exists enforce_transport_management_write on public.transport_requests;
create trigger enforce_transport_management_write
before insert or update or delete on public.transport_requests
for each row execute function public.enforce_transport_management_write();

drop trigger if exists enforce_transport_item_management_write on public.transport_request_items;
create trigger enforce_transport_item_management_write
before insert or update or delete on public.transport_request_items
for each row execute function public.enforce_transport_management_write();

drop trigger if exists enforce_logistics_event_management_write on public.logistics_events;
create trigger enforce_logistics_event_management_write
before insert or update or delete on public.logistics_events
for each row execute function public.enforce_transport_management_write();

drop trigger if exists enforce_logistics_event_department_management_write on public.logistics_event_departments;
create trigger enforce_logistics_event_department_management_write
before insert or update or delete on public.logistics_event_departments
for each row execute function public.enforce_transport_management_write();

drop trigger if exists guard_transport_request_lifecycle on public.transport_requests;
create trigger guard_transport_request_lifecycle
before update on public.transport_requests
for each row execute function public.guard_transport_request_lifecycle();

drop trigger if exists guard_transport_request_item_lifecycle on public.transport_request_items;
create trigger guard_transport_request_item_lifecycle
before insert or update or delete on public.transport_request_items
for each row execute function public.guard_transport_request_item_lifecycle();

drop trigger if exists guard_logistics_event_transport_request_link on public.logistics_events;
create trigger guard_logistics_event_transport_request_link
before insert or update on public.logistics_events
for each row execute function public.guard_logistics_event_transport_request_link();

-- PostgreSQL fires same-phase triggers alphabetically. Source normalization must run before
-- lifecycle validation so a subrental_id change cannot rewrite source_type/source_ref after
-- the immutability guard has already approved a planned request.
drop trigger if exists normalize_transport_request_source on public.transport_requests;
drop trigger if exists a_normalize_transport_request_source on public.transport_requests;
create trigger a_normalize_transport_request_source
before insert or update of subrental_id on public.transport_requests
for each row execute function public.normalize_transport_request_source();
