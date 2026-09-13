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
-- humans must be admin/management regardless of their department. Missing roles fail closed.
create or replace function public.enforce_transport_management_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
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

-- Manual requests may originate from any active department, but only admin/management users
-- may create or edit them. Generated Tour/Truck Planner flows keep their narrower domain rules.
create or replace function public.save_transport_request(
  p_request_id uuid,
  p_job_id uuid,
  p_department text,
  p_description text default null,
  p_note text default null,
  p_needed_at timestamptz default null,
  p_origin text default null,
  p_destination text default null,
  p_movement_type text default 'transfer',
  p_priority text default 'normal',
  p_is_hoja_relevant boolean default true,
  p_source_type text default 'manual',
  p_source_ref text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.transport_requests%rowtype;
  v_request_id uuid;
  v_item jsonb;
  v_transport_type text;
  v_leftover numeric;
begin
  if v_actor is null or not public.transport_request_is_privileged() then
    raise exception 'Transport operations require admin or management role' using errcode = '42501';
  end if;
  if p_job_id is null then
    raise exception 'job_id is required' using errcode = '22023';
  end if;
  if p_department not in ('sound', 'lights', 'video', 'production', 'administrative', 'logistics') then
    raise exception 'Invalid department' using errcode = '22023';
  end if;
  if p_movement_type not in ('transfer', 'pickup', 'delivery', 'return', 'other') then
    raise exception 'Invalid movement type' using errcode = '22023';
  end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Invalid priority' using errcode = '22023';
  end if;
  if p_source_type not in ('manual', 'subrental', 'tour', 'truck_planner') then
    raise exception 'Invalid source type' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 20 then
    raise exception 'Invalid transport items' using errcode = '22023';
  end if;

  if p_request_id is null then
    insert into public.transport_requests (
      job_id, department, created_by, description, note, status,
      needed_at, origin, destination, movement_type, priority,
      source_type, source_ref, is_hoja_relevant, planning_status
    ) values (
      p_job_id,
      p_department,
      v_actor,
      nullif(trim(p_description), ''),
      nullif(trim(p_note), ''),
      'requested',
      p_needed_at,
      nullif(trim(p_origin), ''),
      nullif(trim(p_destination), ''),
      p_movement_type,
      p_priority,
      p_source_type,
      nullif(trim(p_source_ref), ''),
      p_is_hoja_relevant,
      'requested'
    ) returning id into v_request_id;
  else
    select * into v_request
    from public.transport_requests
    where id = p_request_id
    for update;

    if not found then
      raise exception 'Transport request not found' using errcode = 'P0002';
    end if;
    if v_request.job_id <> p_job_id or v_request.department <> p_department then
      raise exception 'Request scope mismatch' using errcode = '22023';
    end if;
    if v_request.planning_status in ('completed', 'cancelled') then
      raise exception 'Completed or cancelled requests cannot be edited' using errcode = '22023';
    end if;

    update public.transport_requests
    set description = nullif(trim(p_description), ''),
        note = nullif(trim(p_note), ''),
        needed_at = p_needed_at,
        origin = nullif(trim(p_origin), ''),
        destination = nullif(trim(p_destination), ''),
        movement_type = p_movement_type,
        priority = p_priority,
        is_hoja_relevant = p_is_hoja_relevant,
        source_type = p_source_type,
        source_ref = nullif(trim(p_source_ref), ''),
        updated_at = now()
    where id = p_request_id;
    v_request_id := p_request_id;
  end if;

  delete from public.transport_request_items where request_id = v_request_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_transport_type := nullif(trim(v_item->>'transport_type'), '');
    if v_transport_type is null or v_transport_type not in ('trailer', '9m', '8m', '6m', '4m', 'furgoneta') then
      raise exception 'Invalid transport type' using errcode = '22023';
    end if;
    v_leftover := nullif(v_item->>'leftover_space_meters', '')::numeric;
    if v_leftover is not null and v_leftover < 0 then
      raise exception 'Leftover space cannot be negative' using errcode = '22023';
    end if;
    insert into public.transport_request_items(request_id, transport_type, leftover_space_meters)
    values (v_request_id, v_transport_type, v_leftover);
  end loop;

  return v_request_id;
end;
$$;

revoke all on function public.save_transport_request(uuid, uuid, text, text, text, timestamptz, text, text, text, text, boolean, text, text, jsonb) from public, anon;
grant execute on function public.save_transport_request(uuid, uuid, text, text, text, timestamptz, text, text, text, text, boolean, text, text, jsonb) to authenticated, service_role;

-- Lifecycle transitions are management-only and terminal states cannot be silently resurrected.
create or replace function public.set_transport_request_stage(p_request_id uuid, p_stage text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.transport_requests%rowtype;
begin
  if auth.uid() is null or not public.transport_request_is_privileged() then
    raise exception 'Transport operations require admin or management role' using errcode = '42501';
  end if;
  if p_stage not in ('requested', 'reviewing', 'planned', 'confirmed', 'completed', 'cancelled') then
    raise exception 'Invalid planning stage' using errcode = '22023';
  end if;

  select * into v_request
  from public.transport_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Transport request not found' using errcode = 'P0002';
  end if;
  if v_request.planning_status in ('completed', 'cancelled')
     and p_stage is distinct from v_request.planning_status then
    raise exception 'Terminal transport requests cannot be reopened implicitly' using errcode = '22023';
  end if;

  update public.transport_requests
  set planning_status = p_stage,
      status = case
        when p_stage = 'completed' then 'fulfilled'
        when p_stage = 'cancelled' then 'cancelled'
        else 'requested'
      end,
      updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.set_transport_request_stage(uuid, text) from public, anon;
grant execute on function public.set_transport_request_stage(uuid, text) to authenticated, service_role;