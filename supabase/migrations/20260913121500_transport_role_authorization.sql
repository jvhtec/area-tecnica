-- Transport/logistics authorization is role-based, never department-based.
-- Human writes require an admin or management role. Department remains domain metadata only.

create or replace function public.transport_request_is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_current_user_role() = any (array['admin'::text, 'management'::text]);
$$;

revoke all on function public.transport_request_is_privileged() from public, anon;
grant execute on function public.transport_request_is_privileged() to authenticated, service_role;

-- Truck Planner previously treated a legacy logistics role and house-tech department membership
-- as edit authority. Transport planning is an office-management action, independent of department.
create or replace function public.tp_is_office_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_current_user_role() = any (array['admin'::text, 'management'::text]);
$$;

create or replace function public.tp_can_edit_department(p_department text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.tp_is_office_role();
$$;

-- Final enforcement boundary for legacy direct-table callers and older RPC paths.
-- Database/service operations without an authenticated user remain possible; authenticated
-- humans must be admin/management regardless of their department.
create or replace function public.enforce_transport_management_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and public.get_current_user_role() <> all (array['admin'::text, 'management'::text]) then
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

-- Requests and their requested vehicle/capacity rows.
drop trigger if exists enforce_transport_management_write on public.transport_requests;
create trigger enforce_transport_management_write
before insert or update or delete on public.transport_requests
for each row execute function public.enforce_transport_management_write();

drop trigger if exists enforce_transport_item_management_write on public.transport_request_items;
create trigger enforce_transport_item_management_write
before insert or update or delete on public.transport_request_items
for each row execute function public.enforce_transport_management_write();

-- Execution events and their department tagging. This prevents a technician/house-tech from
-- bypassing the request workflow and directly setting up loads/unloads in the calendar.
drop trigger if exists enforce_logistics_event_management_write on public.logistics_events;
create trigger enforce_logistics_event_management_write
before insert or update or delete on public.logistics_events
for each row execute function public.enforce_transport_management_write();

drop trigger if exists enforce_logistics_event_department_management_write on public.logistics_event_departments;
create trigger enforce_logistics_event_department_management_write
before insert or update or delete on public.logistics_event_departments
for each row execute function public.enforce_transport_management_write();
