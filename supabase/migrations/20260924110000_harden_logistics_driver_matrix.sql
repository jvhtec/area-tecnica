-- Hardening for PR #953: lifecycle invariants, audit attribution, timezone defaults,
-- complete Spanish licence categories, and realtime dependencies for the logistics matrix.

-- ---------------------------------------------------------------------------
-- Complete Spanish driving-licence categories used by fleet requirements.
-- Reglamento General de Conductores art. 5 includes B+E, C1+E, C+E, D1+E and D+E.
-- ---------------------------------------------------------------------------
alter table public.fleet_vehicles
  drop constraint if exists fleet_vehicles_required_license_check;

alter table public.fleet_vehicles
  add constraint fleet_vehicles_required_license_check
  check (required_license = any (
    array['B', 'B+E', 'C1', 'C1+E', 'C', 'C+E', 'D1', 'D1+E', 'D', 'D+E']
  ));

alter table public.driver_details
  drop constraint if exists driver_details_license_categories_check;

alter table public.driver_details
  add constraint driver_details_license_categories_check
  check (license_categories <@ array[
    'B', 'B+E', 'C1', 'C1+E', 'C', 'C+E', 'D1', 'D1+E', 'D', 'D+E'
  ]::text[]);

-- ---------------------------------------------------------------------------
-- Audit columns are authoritative server-side, not caller supplied.
-- ---------------------------------------------------------------------------
create or replace function public.set_fleet_vehicle_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.set_fleet_vehicle_created_by() from public, anon, authenticated;
grant execute on function public.set_fleet_vehicle_created_by() to service_role;

drop trigger if exists set_fleet_vehicle_created_by on public.fleet_vehicles;
create trigger set_fleet_vehicle_created_by
before insert on public.fleet_vehicles
for each row execute function public.set_fleet_vehicle_created_by();

create or replace function public.set_driver_details_updated_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

revoke all on function public.set_driver_details_updated_by() from public, anon, authenticated;
grant execute on function public.set_driver_details_updated_by() to service_role;

drop trigger if exists set_driver_details_updated_by on public.driver_details;
create trigger set_driver_details_updated_by
before insert or update on public.driver_details
for each row execute function public.set_driver_details_updated_by();

-- ---------------------------------------------------------------------------
-- Every logistics event has an operational timezone.
-- Job-backed events inherit the job timezone; calendar-only events use Madrid.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_logistics_event_timezone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_timezone text;
begin
  if new.timezone is null or btrim(new.timezone) = '' then
    if new.job_id is not null then
      select nullif(btrim(j.timezone), '')
      into v_job_timezone
      from public.jobs j
      where j.id = new.job_id;
    end if;

    new.timezone := coalesce(v_job_timezone, 'Europe/Madrid');
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_logistics_event_timezone() from public, anon, authenticated;
grant execute on function public.ensure_logistics_event_timezone() to service_role;

drop trigger if exists ensure_logistics_event_timezone on public.logistics_events;
create trigger ensure_logistics_event_timezone
before insert or update of job_id, timezone on public.logistics_events
for each row execute function public.ensure_logistics_event_timezone();

update public.logistics_events le
set timezone = coalesce(
  (
    select nullif(btrim(j.timezone), '')
    from public.jobs j
    where j.id = le.job_id
  ),
  'Europe/Madrid'
)
where le.timezone is null or btrim(le.timezone) = '';

-- ---------------------------------------------------------------------------
-- Destructive transport lifecycle operations must not silently drop a live
-- driver/vehicle assignment. Remove/reassign it through the matrix first, which
-- also owns the driver notification lifecycle.
-- ---------------------------------------------------------------------------
create or replace function public.guard_logistics_event_delete_with_assignments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.transport_driver_assignments a
    where a.logistics_event_id = old.id
      and a.status <> 'declined'
      and a.ends_at > now()
  ) then
    raise exception
      'Este transporte tiene una asignación pendiente. Retírala o reasígnala en la matriz antes de replanificar, cancelar o eliminar el transporte.'
      using errcode = '23514';
  end if;

  return old;
end;
$$;

revoke all on function public.guard_logistics_event_delete_with_assignments() from public, anon, authenticated;
grant execute on function public.guard_logistics_event_delete_with_assignments() to service_role;

drop trigger if exists guard_logistics_event_delete_with_assignments on public.logistics_events;
create trigger guard_logistics_event_delete_with_assignments
before delete on public.logistics_events
for each row execute function public.guard_logistics_event_delete_with_assignments();

-- The role-change trigger from the previous migration also protects account
-- deletion. The edge function gives a friendly error, while this trigger closes
-- races and every other deletion path.
create or replace function public.guard_conductor_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_upcoming boolean;
begin
  select exists (
    select 1
    from public.transport_driver_assignments a
    where a.driver_id = old.id
      and a.status <> 'declined'
      and a.ends_at > now()
  )
  into v_has_upcoming;

  if tg_op = 'DELETE' then
    if v_has_upcoming then
      raise exception
        'Este conductor tiene transportes pendientes. Reasígnalos o quítalos en la matriz de logística antes de eliminar el usuario.'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.role::text = 'conductor'
     and new.role::text is distinct from 'conductor'
     and v_has_upcoming then
    raise exception
      'Este conductor tiene transportes pendientes. Reasígnalos o quítalos en la matriz de logística antes de cambiar su rol.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_conductor_role_change() from public, anon, authenticated;
grant execute on function public.guard_conductor_role_change() to service_role;

drop trigger if exists guard_conductor_delete on public.profiles;
create trigger guard_conductor_delete
before delete on public.profiles
for each row execute function public.guard_conductor_role_change();

-- ---------------------------------------------------------------------------
-- Realtime sources feeding get_logistics_matrix()/get_my_transport_assignments().
-- Route subscriptions fan these tables into the aggregate logistics query key.
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach v_table in array array[
    'transport_driver_assignments',
    'logistics_events',
    'logistics_event_departments',
    'fleet_vehicles',
    'driver_details',
    'profiles',
    'jobs',
    'locations',
    'transport_requests'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
