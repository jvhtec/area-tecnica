-- Local feature: workshop reservations share the transport vehicle lock domain.
-- No existing migration/function is replaced. Completed/cancelled rows retain history.
create table public.fleet_workshop_appointments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  workshop text not null check (length(btrim(workshop)) between 1 and 160),
  reason text not null check (length(btrim(reason)) between 1 and 200),
  notes text check (length(notes) <= 2000),
  mileage_km integer check (mileage_km >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint fleet_workshop_window check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at)
);
create index fleet_workshop_vehicle_window on public.fleet_workshop_appointments(vehicle_id, starts_at, ends_at);
create index fleet_workshop_created_by on public.fleet_workshop_appointments(created_by) where created_by is not null;
create index fleet_workshop_updated_by on public.fleet_workshop_appointments(updated_by) where updated_by is not null;
alter table public.fleet_workshop_appointments enable row level security;
revoke all on public.fleet_workshop_appointments from public, anon, authenticated;
grant select on public.fleet_workshop_appointments to authenticated;
grant all on public.fleet_workshop_appointments to service_role;
create policy fleet_workshop_read on public.fleet_workshop_appointments
  for select to authenticated using (public.logistics_matrix_can_view());

-- Both sides use precisely the advisory key already held by assign_transport_driver.
-- Separate SQL statements after the lock see the committed competing reservation.
create function public.guard_fleet_workshop_window()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vehicle uuid;
begin
  v_vehicle := new.vehicle_id;
  if v_vehicle is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('transport_driver_assignments:vehicle:' || v_vehicle::text, 0));
  if tg_table_name = 'fleet_workshop_appointments' then
    if new.status not in ('scheduled', 'in_progress') then return new; end if;
    if exists (
      select 1 from public.fleet_workshop_appointments a
      where a.vehicle_id = v_vehicle and a.id <> new.id
        and a.status in ('scheduled', 'in_progress')
        and a.starts_at < new.ends_at and a.ends_at > new.starts_at
    ) then
      raise exception 'El vehículo ya tiene otra cita de taller en ese horario.' using errcode = '23P01';
    end if;
    if exists (
      select 1 from public.transport_driver_assignments a
      where a.vehicle_id = v_vehicle and a.status <> 'declined'
        and a.starts_at < new.ends_at and a.ends_at > new.starts_at
    ) then
      raise exception 'El vehículo tiene un transporte asignado en ese horario. Reasígnalo o cambia la cita.' using errcode = '23P01';
    end if;
  elsif new.status <> 'declined' and exists (
    select 1 from public.fleet_workshop_appointments a
    where a.vehicle_id = v_vehicle and a.status in ('scheduled', 'in_progress')
      and a.starts_at < new.ends_at and a.ends_at > new.starts_at
  ) then
    raise exception 'El vehículo está reservado para el taller en ese horario. Selecciona otro vehículo o modifica la cita.' using errcode = '23P01';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_fleet_workshop_window() from public, anon, authenticated;
create trigger guard_workshop_window before insert or update of vehicle_id, starts_at, ends_at, status
  on public.fleet_workshop_appointments for each row execute function public.guard_fleet_workshop_window();
create trigger guard_transport_workshop_window before insert or update of vehicle_id, starts_at, ends_at, status
  on public.transport_driver_assignments for each row execute function public.guard_fleet_workshop_window();

create function public.list_fleet_workshop_appointments(p_from date, p_to date)
returns setof public.fleet_workshop_appointments
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.logistics_matrix_can_view() then
    raise exception 'No tienes permiso para consultar las citas de taller.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'El intervalo de consulta no es válido.' using errcode = '22023';
  end if;
  return query select a.* from public.fleet_workshop_appointments a
    where a.starts_at < ((p_to + 1)::timestamp at time zone 'Europe/Madrid')
      and a.ends_at > (p_from::timestamp at time zone 'Europe/Madrid')
    order by a.starts_at, a.id;
end;
$$;
revoke all on function public.list_fleet_workshop_appointments(date, date) from public, anon;
grant execute on function public.list_fleet_workshop_appointments(date, date) to authenticated, service_role;

create function public.save_fleet_workshop_appointment(
  p_id uuid, p_expected_updated_at timestamptz, p_vehicle_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz,
  p_workshop text, p_reason text, p_notes text, p_mileage_km integer, p_status text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_old_vehicle uuid;
begin
  if auth.uid() is null or not public.logistics_matrix_can_manage() then
    raise exception 'Solo administración y gestión pueden modificar citas de taller.' using errcode = '42501';
  end if;
  if p_id is not null then
    select vehicle_id into v_old_vehicle from public.fleet_workshop_appointments where id = p_id;
    if not found then raise exception 'La cita ya no existe.' using errcode = 'P0002'; end if;
  end if;
  -- Lock vehicles before the appointment row, in the same order as transport saves.
  perform pg_advisory_xact_lock(k) from (
    select distinct hashtextextended('transport_driver_assignments:vehicle:' || v::text, 0) as k
    from unnest(array[p_vehicle_id, v_old_vehicle]) v where v is not null order by 1
  ) locks;
  if p_id is null then
    insert into public.fleet_workshop_appointments
      (vehicle_id, starts_at, ends_at, workshop, reason, notes, mileage_km, status, created_by, updated_by)
    values (p_vehicle_id, p_starts_at, p_ends_at, btrim(p_workshop), btrim(p_reason), nullif(btrim(p_notes), ''), p_mileage_km, p_status, auth.uid(), auth.uid())
    returning id into v_id;
  else
    update public.fleet_workshop_appointments
      set vehicle_id = p_vehicle_id, starts_at = p_starts_at, ends_at = p_ends_at,
          workshop = btrim(p_workshop), reason = btrim(p_reason), notes = nullif(btrim(p_notes), ''),
          mileage_km = p_mileage_km, status = p_status, updated_by = auth.uid(), updated_at = clock_timestamp()
      where id = p_id and updated_at = p_expected_updated_at
      returning id into v_id;
    if v_id is null then
      raise exception 'Otra persona ha modificado esta cita. Cierra y vuelve a abrir la cita actualizada antes de guardar.' using errcode = '40001';
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_fleet_workshop_appointment(uuid, timestamptz, uuid, timestamptz, timestamptz, text, text, text, integer, text) from public, anon;
grant execute on function public.save_fleet_workshop_appointment(uuid, timestamptz, uuid, timestamptz, timestamptz, text, text, text, integer, text) to authenticated, service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.fleet_workshop_appointments;
  end if;
end $$;
