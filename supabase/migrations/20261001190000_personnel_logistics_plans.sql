-- Personnel plans reuse crew-transfer events and the existing reservation RPC.
create table public.personnel_logistics_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  job_id uuid references public.jobs(id) on delete set null,
  people_count integer not null check (people_count between 1 and 10000),
  starts_at timestamptz not null, ends_at timestamptz not null,
  origin_location_id uuid not null references public.locations(id) on delete restrict,
  destination_location_id uuid not null references public.locations(id) on delete restrict,
  vehicle_id uuid references public.fleet_vehicles(id) on delete restrict,
  driver_id uuid references public.profiles(id) on delete restrict,
  event_id uuid unique references public.logistics_events(id) on delete set null,
  assignment_id uuid unique references public.transport_driver_assignments(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','confirmed','completed','cancelled')),
  hotel_needed boolean not null default false,
  hotel_name text check (length(hotel_name) <= 200), hotel_address text check (length(hotel_address) <= 300),
  hotel_check_in date, hotel_check_out date,
  single_rooms integer not null default 0 check (single_rooms between 0 and 10000),
  double_rooms integer not null default 0 check (double_rooms between 0 and 10000),
  hotel_status text not null default 'pending' check (hotel_status in ('pending','confirmed')),
  notes text check (length(notes) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint personnel_window check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  constraint personnel_route check (origin_location_id <> destination_location_id),
  constraint personnel_confirmation check (status <> 'confirmed' or (vehicle_id is not null and driver_id is not null)),
  constraint personnel_hotel check (not hotel_needed or (hotel_check_in is not null and hotel_check_out is not null and hotel_check_out > hotel_check_in
    and single_rooms + 2 * double_rooms >= people_count
    and (hotel_status <> 'confirmed' or length(btrim(coalesce(hotel_name,''))) > 0)))
);
create index personnel_window_idx on public.personnel_logistics_plans(starts_at, ends_at);
create index personnel_hotel_idx on public.personnel_logistics_plans(hotel_check_in, hotel_check_out) where hotel_needed;
create index personnel_job_idx on public.personnel_logistics_plans(job_id);
create index personnel_vehicle_idx on public.personnel_logistics_plans(vehicle_id);
create index personnel_driver_idx on public.personnel_logistics_plans(driver_id);
create index personnel_origin_idx on public.personnel_logistics_plans(origin_location_id);
create index personnel_destination_idx on public.personnel_logistics_plans(destination_location_id);
create index personnel_creator_idx on public.personnel_logistics_plans(created_by);
alter table public.personnel_logistics_plans enable row level security;
revoke all on public.personnel_logistics_plans from public, anon, authenticated;
grant select on public.personnel_logistics_plans to authenticated;
grant all on public.personnel_logistics_plans to service_role;
create policy personnel_read on public.personnel_logistics_plans for select to authenticated using (public.logistics_matrix_can_view());

create function public.list_personnel_logistics_plans(p_from date, p_to date)
returns setof public.personnel_logistics_plans language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.logistics_matrix_can_view() then raise exception 'No tienes permiso para consultar logística de personal.' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then raise exception 'El periodo no es válido.' using errcode = '22023'; end if;
  return query select p.* from public.personnel_logistics_plans p
    where (p.starts_at < ((p_to + 1)::timestamp at time zone 'Europe/Madrid') and p.ends_at > (p_from::timestamp at time zone 'Europe/Madrid'))
      or (p.hotel_needed and p.hotel_check_in <= p_to and p.hotel_check_out > p_from)
    order by p.starts_at, p.id;
end;
$$;
revoke all on function public.list_personnel_logistics_plans(date,date) from public, anon;
grant execute on function public.list_personnel_logistics_plans(date,date) to authenticated, service_role;

create function public.save_personnel_logistics_plan(p_plan jsonb, p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v public.personnel_logistics_plans%rowtype;
  old_plan public.personnel_logistics_plans%rowtype;
  vehicle public.fleet_vehicles%rowtype;
  saved_event jsonb; saved_assignment jsonb;
  event_id uuid; assignment_id uuid; plan_id uuid;
begin
  if auth.uid() is null or not public.logistics_matrix_can_manage() then raise exception 'Solo administración y gestión pueden modificar logística de personal.' using errcode = '42501'; end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then raise exception 'Datos de personal no válidos.' using errcode = '22023'; end if;
  v := jsonb_populate_record(null::public.personnel_logistics_plans, p_plan);
  -- Serialise edits of one plan; the existing RPC owns driver/vehicle locks.
  plan_id := coalesce(v.id, gen_random_uuid());
  perform pg_advisory_xact_lock(hashtextextended('personnel_logistics_plans:' || plan_id::text, 0));
  if v.id is not null then
    select * into old_plan from public.personnel_logistics_plans where id = v.id;
    if not found then raise exception 'El traslado ya no existe.' using errcode = 'P0002'; end if;
    if p_expected_updated_at is null or old_plan.updated_at <> p_expected_updated_at then raise exception 'Otra persona ha modificado el traslado. Vuelve a abrirlo antes de guardar.' using errcode = '40001'; end if;
  end if;
  v.id := plan_id; v.created_by := coalesce(old_plan.created_by, auth.uid()); v.updated_at := clock_timestamp();
  v.event_id := old_plan.event_id; v.assignment_id := old_plan.assignment_id;
  v.title := btrim(v.title);
  if v.people_count is null or v.people_count not between 1 and 10000 or v.title is null or length(v.title) not between 1 and 200
    or v.starts_at is null or v.ends_at is null or not isfinite(v.starts_at) or not isfinite(v.ends_at) or v.ends_at <= v.starts_at
    or v.origin_location_id is null or v.destination_location_id is null or v.origin_location_id = v.destination_location_id
    or v.status is null or v.status not in ('planned','confirmed','completed','cancelled') then raise exception 'Revisa el evento, las personas, las ubicaciones y el horario.' using errcode = '22023'; end if;
  if v.hotel_needed and (v.hotel_check_in is null or v.hotel_check_out is null or v.hotel_check_out <= v.hotel_check_in
    or v.single_rooms is null or v.double_rooms is null or v.single_rooms < 0 or v.double_rooms < 0
    or v.single_rooms + 2 * v.double_rooms < v.people_count) then raise exception 'Revisa las fechas y las plazas de alojamiento.' using errcode = '22023'; end if;
  if v.status = 'confirmed' and (v.driver_id is null or v.vehicle_id is null) then raise exception 'Para confirmar, asigna vehículo y conductor.' using errcode = '22023'; end if;
  if v.vehicle_id is not null then
    select * into vehicle from public.fleet_vehicles where id = v.vehicle_id for share;
    if not found or not vehicle.is_active or vehicle.vehicle_type::text not in ('furgoneta','rv','sleeper_bus') then raise exception 'Selecciona un vehículo activo para personal.' using errcode = '22023'; end if;
    if vehicle.passenger_seats is null or vehicle.passenger_seats < v.people_count then raise exception 'El vehículo no tiene suficientes plazas registradas.' using errcode = '22023'; end if;
  end if;
  if not v.hotel_needed then
    v.hotel_name := null; v.hotel_address := null; v.hotel_check_in := null; v.hotel_check_out := null;
    v.single_rooms := 0; v.double_rooms := 0; v.hotel_status := 'pending';
  end if;
  if v.status in ('planned','confirmed') then
    saved_event := public.save_logistics_event_plan(jsonb_build_object(
      'event_type','crew_transfer', 'transport_type',coalesce(vehicle.vehicle_type::text,'furgoneta'),
      'transport_provider','sector_pro', 'job_id',v.job_id, 'title',v.title,
      'event_date',(v.starts_at at time zone 'Europe/Madrid')::date, 'event_time',(v.starts_at at time zone 'Europe/Madrid')::time,
      'end_date',(v.ends_at at time zone 'Europe/Madrid')::date, 'end_time',(v.ends_at at time zone 'Europe/Madrid')::time,
      'origin_location_id',v.origin_location_id, 'location_id',v.destination_location_id, 'passenger_count',v.people_count,
      'notes',v.notes, 'license_plate',vehicle.license_plate, 'color','#8b5cf6', 'is_hoja_relevant',true, 'hoja_categories','[]'::jsonb
    ), array['logistics']::text[], v.event_id, null);
    v.event_id := (saved_event->'event'->>'id')::uuid;
    if v.driver_id is not null or v.vehicle_id is not null then
      saved_assignment := public.assign_transport_driver(v.event_id, v.driver_id, v.vehicle_id, v.starts_at, v.ends_at, v.notes, v.assignment_id, false);
      if saved_assignment->>'status' = 'conflict' then raise exception 'El conductor o el vehículo tiene otro compromiso en ese horario.' using errcode = '23P01'; end if;
      v.assignment_id := (saved_assignment->>'assignment_id')::uuid;
    elsif v.assignment_id is not null then
      delete from public.transport_driver_assignments where id = v.assignment_id;
      v.assignment_id := null;
    end if;
  else
    if v.event_id is not null then delete from public.logistics_events where id = v.event_id; end if;
    v.event_id := null; v.assignment_id := null;
  end if;
  insert into public.personnel_logistics_plans select v.*
    on conflict (id) do update set title = excluded.title, job_id = excluded.job_id, people_count = excluded.people_count,
      starts_at = excluded.starts_at, ends_at = excluded.ends_at, origin_location_id = excluded.origin_location_id, destination_location_id = excluded.destination_location_id,
      vehicle_id = excluded.vehicle_id, driver_id = excluded.driver_id, event_id = excluded.event_id, assignment_id = excluded.assignment_id, status = excluded.status,
      hotel_needed = excluded.hotel_needed, hotel_name = excluded.hotel_name, hotel_address = excluded.hotel_address,
      hotel_check_in = excluded.hotel_check_in, hotel_check_out = excluded.hotel_check_out, single_rooms = excluded.single_rooms, double_rooms = excluded.double_rooms,
      hotel_status = excluded.hotel_status, notes = excluded.notes, updated_at = excluded.updated_at;
  return v.id;
end;
$$;
revoke all on function public.save_personnel_logistics_plan(jsonb,timestamptz) from public, anon;
grant execute on function public.save_personnel_logistics_plan(jsonb,timestamptz) to authenticated, service_role;
