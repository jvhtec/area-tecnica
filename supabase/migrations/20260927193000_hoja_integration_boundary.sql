-- Hoja de Ruta integration boundary hardening.
--
-- This migration closes the remaining cross-module gaps found after the
-- post-roadmap audit:
--   * job-documents storage access follows job/Hoja authorization;
--   * canonical published Hoja PDFs cannot be hidden/deleted out-of-band;
--   * Tour Ops mutations are version-aware and transactional with Hoja writes;
--   * normalized travel/accommodation rows have stable Hoja source identity;
--   * tour contacts sync by stable source id instead of append-only similarity;
--   * Programa writes preserve the versioned Hoja workflow boundary.

-- ---------------------------------------------------------------------------
-- Stable Tour Ops <-> Hoja identities
-- ---------------------------------------------------------------------------

alter table public.tours
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_tours_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_tours_updated_at()
  from public, anon, authenticated;

drop trigger if exists update_tours_updated_at on public.tours;
create trigger update_tours_updated_at
before update on public.tours
for each row execute function public.touch_tours_updated_at();

alter table public.hoja_de_ruta_travel_arrangements
  add column if not exists source_tour_travel_segment_id uuid
    references public.tour_travel_segments(id) on delete set null;

alter table public.tour_travel_segments
  add column if not exists source_hoja_travel_arrangement_id uuid
    references public.hoja_de_ruta_travel_arrangements(id) on delete set null;

alter table public.hoja_de_ruta_accommodations
  add column if not exists source_tour_accommodation_id uuid
    references public.tour_accommodations(id) on delete set null;

alter table public.tour_accommodations
  add column if not exists source_hoja_accommodation_id uuid
    references public.hoja_de_ruta_accommodations(id) on delete set null;

alter table public.hoja_de_ruta_contacts
  add column if not exists source_tour_contact_id text;

create unique index if not exists idx_hoja_travel_source_tour_segment
  on public.hoja_de_ruta_travel_arrangements(source_tour_travel_segment_id)
  where source_tour_travel_segment_id is not null;

create unique index if not exists idx_tour_travel_source_hoja
  on public.tour_travel_segments(source_hoja_travel_arrangement_id)
  where source_hoja_travel_arrangement_id is not null;

create unique index if not exists idx_hoja_accommodation_source_tour
  on public.hoja_de_ruta_accommodations(source_tour_accommodation_id)
  where source_tour_accommodation_id is not null;

create unique index if not exists idx_tour_accommodation_source_hoja
  on public.tour_accommodations(source_hoja_accommodation_id)
  where source_hoja_accommodation_id is not null;

create unique index if not exists idx_hoja_contact_source_tour
  on public.hoja_de_ruta_contacts(hoja_de_ruta_id, source_tour_contact_id)
  where source_tour_contact_id is not null;

-- ---------------------------------------------------------------------------
-- Shared version lock for external Hoja editors
-- ---------------------------------------------------------------------------

create or replace function public._hoja_lock_external_edit(
  p_hoja_id uuid,
  p_expected_version integer
)
returns table(job_id uuid, previous_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_status text;
  v_version integer;
begin
  select h.job_id, coalesce(h.status, 'draft'), coalesce(h.document_version, 0)
    into v_job_id, v_status, v_version
  from public.hoja_de_ruta h
  where h.id = p_hoja_id
    and public.can_manage_hoja(h.job_id)
  for update;

  if not found then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if v_status = 'final' then
    raise exception 'La Hoja de Ruta está finalizada y no admite edición'
      using errcode = '22023';
  end if;

  if v_version <> coalesce(p_expected_version, -1) then
    raise exception 'La Hoja de Ruta ha cambiado desde la última carga'
      using errcode = '40001';
  end if;

  return query select v_job_id, v_status;
end;
$$;

revoke all on function public._hoja_lock_external_edit(uuid, integer)
  from public, anon, authenticated;

-- Lock every Hoja touched by one external mutation in deterministic UUID order.
-- Callers pass the versions from the Tour Ops snapshot for *all* affected Hojas,
-- including the old source Hoja when an item is moved to another date.
create or replace function public._hoja_lock_external_edits(
  p_hoja_ids uuid[],
  p_expected_versions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_ids uuid[];
  v_expected_text text;
  v_statuses jsonb := '{}'::jsonb;
  v_seen integer := 0;
begin
  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into v_ids
  from (
    select distinct id
    from unnest(coalesce(p_hoja_ids, '{}'::uuid[])) as x(id)
    where id is not null
  ) ids;

  for v_row in
    select h.id, h.job_id, coalesce(h.status, 'draft') as status,
           coalesce(h.document_version, 0) as document_version
    from public.hoja_de_ruta h
    where h.id = any(v_ids)
    order by h.id
    for update
  loop
    if not public.can_manage_hoja(v_row.job_id) then
      raise exception 'permission denied' using errcode = '42501';
    end if;
    if v_row.status = 'final' then
      raise exception 'La Hoja de Ruta está finalizada y no admite edición'
        using errcode = '22023';
    end if;

    v_expected_text := coalesce(p_expected_versions, '{}'::jsonb) ->> v_row.id::text;
    if v_expected_text is null
       or v_row.document_version <> v_expected_text::integer then
      raise exception 'La Hoja de Ruta ha cambiado desde la última carga'
        using errcode = '40001';
    end if;

    v_statuses := v_statuses || jsonb_build_object(v_row.id::text, v_row.status);
    v_seen := v_seen + 1;
  end loop;

  if v_seen <> cardinality(v_ids) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return v_statuses;
end;
$$;

revoke all on function public._hoja_lock_external_edits(uuid[], jsonb)
  from public, anon, authenticated;

-- Tour Ops bridge RPCs must never attach a Hoja from another tour. The
-- management/logistics roles intentionally span tours, so this is an aggregate
-- integrity check rather than an authorization shortcut.
create or replace function public._hoja_assert_tour_membership(
  p_hoja_id uuid,
  p_tour_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_hoja_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.hoja_de_ruta h
    where h.id = p_hoja_id
      and exists (
        select 1
        from public.tour_dates td
        where td.id = h.tour_date_id
          and td.tour_id = p_tour_id
      )
  ) then
    raise exception 'La Hoja de Ruta no pertenece a esta gira'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function public._hoja_assert_tour_membership(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Programa: one version-aware Hoja mutation
-- ---------------------------------------------------------------------------

create or replace function public.save_tour_ops_hoja_program(
  p_hoja_id uuid,
  p_expected_version integer,
  p_program jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lock record;
  v_result jsonb;
begin
  select * into v_lock
  from public._hoja_lock_external_edit(p_hoja_id, p_expected_version);

  perform set_config('app.hoja_trusted_write', 'on', true);
  update public.hoja_de_ruta
  set program_schedule_json = coalesce(p_program, '[]'::jsonb)
  where id = p_hoja_id;
  perform set_config('app.hoja_trusted_write', 'off', true);

  perform public._hoja_touch(p_hoja_id);

  select jsonb_build_object(
    'hoja_id', h.id,
    'document_version', h.document_version,
    'status', h.status,
    'approval_invalidated', v_lock.previous_status = 'approved'
  ) into v_result
  from public.hoja_de_ruta h
  where h.id = p_hoja_id;

  return v_result;
end;
$$;

revoke all on function public.save_tour_ops_hoja_program(uuid, integer, jsonb)
  from public, anon;
grant execute on function public.save_tour_ops_hoja_program(uuid, integer, jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Travel: normalized row and Hoja copy commit together
-- ---------------------------------------------------------------------------

create or replace function public.save_tour_ops_travel(
  p_tour_id uuid,
  p_source text,
  p_segment_id uuid,
  p_hoja_id uuid,
  p_hoja_row_id uuid,
  p_hoja_source_table text,
  p_expected_hoja_versions jsonb,
  p_expected_ops_updated_at timestamptz,
  p_ops_payload jsonb,
  p_hoja_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_previous_status text;
  v_ops public.tour_travel_segments%rowtype;
  v_hoja_travel public.hoja_de_ruta_travel_arrangements%rowtype;
  v_hoja_transport public.hoja_de_ruta_transport%rowtype;
  v_segment_id uuid := p_segment_id;
  v_hoja_row_id uuid := p_hoja_row_id;
  v_existing_updated_at timestamptz;
  v_previous_hoja_row_id uuid;
  v_previous_hoja_id uuid;
  v_previous_hoja_status text;
  v_locked_statuses jsonb := '{}'::jsonb;
  v_result jsonb;
begin
  if coalesce(p_source, 'normalized') not in ('normalized', 'hoja') then
    raise exception 'Origen de viaje no válido' using errcode = '22023';
  end if;

  if coalesce(public.get_current_user_role(), '') not in ('admin', 'management', 'logistics')
     and not public._hoja_is_service_role() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  perform public._hoja_assert_tour_membership(p_hoja_id, p_tour_id);

  v_ops := jsonb_populate_record(null::public.tour_travel_segments, coalesce(p_ops_payload, '{}'::jsonb));
  v_hoja_travel := jsonb_populate_record(null::public.hoja_de_ruta_travel_arrangements, coalesce(p_hoja_payload, '{}'::jsonb));
  v_hoja_transport := jsonb_populate_record(null::public.hoja_de_ruta_transport, coalesce(p_hoja_payload, '{}'::jsonb));

  if p_source = 'normalized' then
    if v_segment_id is not null then
      select s.updated_at,
             s.source_hoja_travel_arrangement_id,
             a.hoja_de_ruta_id
        into v_existing_updated_at, v_previous_hoja_row_id, v_previous_hoja_id
      from public.tour_travel_segments s
      left join public.hoja_de_ruta_travel_arrangements a
        on a.id = s.source_hoja_travel_arrangement_id
      where s.id = v_segment_id and s.tour_id = p_tour_id
      for update of s;

      if not found then
        raise exception 'No existe el viaje de operaciones' using errcode = '22023';
      end if;
      if p_expected_ops_updated_at is not null
         and v_existing_updated_at is distinct from p_expected_ops_updated_at then
        raise exception 'El viaje de operaciones ha cambiado desde la última carga'
          using errcode = '40001';
      end if;
    end if;
  end if;

  v_locked_statuses := public._hoja_lock_external_edits(
    array[p_hoja_id, v_previous_hoja_id],
    p_expected_hoja_versions
  );
  if p_hoja_id is not null then
    v_target_previous_status := v_locked_statuses ->> p_hoja_id::text;
  end if;
  if v_previous_hoja_id is not null then
    v_previous_hoja_status := v_locked_statuses ->> v_previous_hoja_id::text;
  end if;

  perform set_config('app.hoja_trusted_write', 'on', true);

  if p_source = 'normalized' then
    if v_segment_id is null then
      insert into public.tour_travel_segments (
        tour_id, from_tour_date_id, to_tour_date_id, from_location_id, to_location_id,
        transportation_type, departure_time, arrival_time, carrier_name, vehicle_details,
        distance_km, estimated_duration_minutes, route_notes, stops, crew_manifest,
        luggage_truck, status, updated_at
      ) values (
        p_tour_id, v_ops.from_tour_date_id, v_ops.to_tour_date_id, v_ops.from_location_id, v_ops.to_location_id,
        coalesce(v_ops.transportation_type, 'bus'), v_ops.departure_time, v_ops.arrival_time,
        v_ops.carrier_name, coalesce(v_ops.vehicle_details, '{}'::jsonb), v_ops.distance_km,
        v_ops.estimated_duration_minutes, v_ops.route_notes, coalesce(v_ops.stops, '[]'::jsonb),
        coalesce(v_ops.crew_manifest, '[]'::jsonb), coalesce(v_ops.luggage_truck, false),
        coalesce(v_ops.status, 'planned'), now()
      ) returning id into v_segment_id;
    else
      update public.tour_travel_segments
      set from_tour_date_id = v_ops.from_tour_date_id,
          to_tour_date_id = v_ops.to_tour_date_id,
          from_location_id = v_ops.from_location_id,
          to_location_id = v_ops.to_location_id,
          transportation_type = coalesce(v_ops.transportation_type, 'bus'),
          departure_time = v_ops.departure_time,
          arrival_time = v_ops.arrival_time,
          carrier_name = v_ops.carrier_name,
          vehicle_details = coalesce(v_ops.vehicle_details, '{}'::jsonb),
          distance_km = v_ops.distance_km,
          estimated_duration_minutes = v_ops.estimated_duration_minutes,
          route_notes = v_ops.route_notes,
          stops = coalesce(v_ops.stops, '[]'::jsonb),
          crew_manifest = coalesce(v_ops.crew_manifest, '[]'::jsonb),
          luggage_truck = coalesce(v_ops.luggage_truck, false),
          status = coalesce(v_ops.status, 'planned'),
          updated_at = now()
      where id = v_segment_id;
    end if;

    if v_previous_hoja_id is not null and v_previous_hoja_id is distinct from p_hoja_id then
      delete from public.hoja_de_ruta_travel_arrangements
      where id = v_previous_hoja_row_id
        and hoja_de_ruta_id = v_previous_hoja_id
        and source_tour_travel_segment_id = v_segment_id;
      v_hoja_row_id := null;
    end if;

    if p_hoja_id is not null then
      select t.id into v_hoja_row_id
      from public.hoja_de_ruta_travel_arrangements t
      where t.hoja_de_ruta_id = p_hoja_id
        and t.source_tour_travel_segment_id = v_segment_id
      limit 1;

      if v_hoja_row_id is null then
        -- Adopt one pre-link matching row rather than creating another duplicate.
        select t.id into v_hoja_row_id
        from public.hoja_de_ruta_travel_arrangements t
        where t.hoja_de_ruta_id = p_hoja_id
          and t.source_tour_travel_segment_id is null
          and coalesce(t.transportation_type, '') = coalesce(v_hoja_travel.transportation_type, '')
          and coalesce(t.pickup_address, '') = coalesce(v_hoja_travel.pickup_address, '')
          and t.departure_time is not distinct from v_hoja_travel.departure_time
          and t.arrival_time is not distinct from v_hoja_travel.arrival_time
        order by t.created_at, t.id
        limit 1;
      end if;

      if v_hoja_row_id is null then
        insert into public.hoja_de_ruta_travel_arrangements (
          hoja_de_ruta_id, transportation_type, pickup_address, pickup_time,
          flight_train_number, departure_time, arrival_time, driver_name, driver_phone,
          plate_number, notes, source_tour_travel_segment_id
        ) values (
          p_hoja_id, coalesce(v_hoja_travel.transportation_type, 'van'), v_hoja_travel.pickup_address,
          v_hoja_travel.pickup_time, v_hoja_travel.flight_train_number, v_hoja_travel.departure_time,
          v_hoja_travel.arrival_time, v_hoja_travel.driver_name, v_hoja_travel.driver_phone,
          v_hoja_travel.plate_number, v_hoja_travel.notes, v_segment_id
        ) returning id into v_hoja_row_id;
      else
        update public.hoja_de_ruta_travel_arrangements
        set transportation_type = coalesce(v_hoja_travel.transportation_type, 'van'),
            pickup_address = v_hoja_travel.pickup_address,
            pickup_time = v_hoja_travel.pickup_time,
            flight_train_number = v_hoja_travel.flight_train_number,
            departure_time = v_hoja_travel.departure_time,
            arrival_time = v_hoja_travel.arrival_time,
            driver_name = v_hoja_travel.driver_name,
            driver_phone = v_hoja_travel.driver_phone,
            plate_number = v_hoja_travel.plate_number,
            notes = v_hoja_travel.notes,
            source_tour_travel_segment_id = v_segment_id
        where id = v_hoja_row_id and hoja_de_ruta_id = p_hoja_id;
      end if;

      update public.tour_travel_segments
      set source_hoja_travel_arrangement_id = v_hoja_row_id
      where id = v_segment_id;
    elsif p_source = 'normalized' then
      update public.tour_travel_segments
      set source_hoja_travel_arrangement_id = null
      where id = v_segment_id;
    end if;
  else
    if p_hoja_id is null or v_hoja_row_id is null then
      raise exception 'Falta la fila de Hoja de Ruta del viaje' using errcode = '22023';
    end if;

    if coalesce(p_hoja_source_table, 'hoja_de_ruta_travel_arrangements') = 'hoja_de_ruta_transport' then
      update public.hoja_de_ruta_transport
      set transport_type = v_hoja_transport.transport_type,
          date_time = v_hoja_transport.date_time,
          return_date_time = v_hoja_transport.return_date_time,
          company = v_hoja_transport.company,
          driver_name = v_hoja_transport.driver_name,
          driver_phone = v_hoja_transport.driver_phone,
          license_plate = v_hoja_transport.license_plate
      where id = v_hoja_row_id and hoja_de_ruta_id = p_hoja_id;
      if not found then
        raise exception 'No existe el transporte de Hoja de Ruta' using errcode = '22023';
      end if;

      -- Hoja transport is logistics-owned. Do not create a second normalized
      -- Tour Ops identity for it; editing from Tour Ops updates the source row.
      perform set_config('app.hoja_trusted_write', 'off', true);
      perform public._hoja_touch(p_hoja_id);
      return jsonb_build_object(
        'id', v_hoja_row_id,
        'ops_id', null,
        'hoja_row_id', v_hoja_row_id,
        'hoja_document_version', (select document_version from public.hoja_de_ruta where id = p_hoja_id),
        'hoja_status', (select status from public.hoja_de_ruta where id = p_hoja_id),
        'approval_invalidated', v_target_previous_status = 'approved'
      );
    else
      update public.hoja_de_ruta_travel_arrangements
      set transportation_type = coalesce(v_hoja_travel.transportation_type, 'van'),
          pickup_address = v_hoja_travel.pickup_address,
          pickup_time = v_hoja_travel.pickup_time,
          flight_train_number = v_hoja_travel.flight_train_number,
          departure_time = v_hoja_travel.departure_time,
          arrival_time = v_hoja_travel.arrival_time,
          driver_name = v_hoja_travel.driver_name,
          driver_phone = v_hoja_travel.driver_phone,
          plate_number = v_hoja_travel.plate_number,
          notes = v_hoja_travel.notes
      where id = v_hoja_row_id and hoja_de_ruta_id = p_hoja_id;
      if not found then
        raise exception 'No existe el viaje de Hoja de Ruta' using errcode = '22023';
      end if;
    end if;

    select id into v_segment_id
    from public.tour_travel_segments
    where tour_id = p_tour_id
      and (
        source_hoja_travel_arrangement_id = v_hoja_row_id
        or vehicle_details->>'hojaSourceId' = v_hoja_row_id::text
      )
    order by created_at
    limit 1
    for update;

    if v_segment_id is null then
      insert into public.tour_travel_segments (
        tour_id, from_tour_date_id, to_tour_date_id, from_location_id, to_location_id,
        transportation_type, departure_time, arrival_time, carrier_name, vehicle_details,
        distance_km, estimated_duration_minutes, route_notes, stops, crew_manifest,
        luggage_truck, status, source_hoja_travel_arrangement_id, updated_at
      ) values (
        p_tour_id, v_ops.from_tour_date_id, v_ops.to_tour_date_id, v_ops.from_location_id, v_ops.to_location_id,
        coalesce(v_ops.transportation_type, 'bus'), v_ops.departure_time, v_ops.arrival_time,
        v_ops.carrier_name, coalesce(v_ops.vehicle_details, '{}'::jsonb), v_ops.distance_km,
        v_ops.estimated_duration_minutes, v_ops.route_notes, coalesce(v_ops.stops, '[]'::jsonb),
        coalesce(v_ops.crew_manifest, '[]'::jsonb), coalesce(v_ops.luggage_truck, false),
        coalesce(v_ops.status, 'planned'),
        v_hoja_row_id,
        now()
      ) returning id into v_segment_id;
    else
      update public.tour_travel_segments
      set from_tour_date_id = v_ops.from_tour_date_id,
          to_tour_date_id = v_ops.to_tour_date_id,
          from_location_id = v_ops.from_location_id,
          to_location_id = v_ops.to_location_id,
          transportation_type = coalesce(v_ops.transportation_type, 'bus'),
          departure_time = v_ops.departure_time,
          arrival_time = v_ops.arrival_time,
          carrier_name = v_ops.carrier_name,
          vehicle_details = coalesce(v_ops.vehicle_details, '{}'::jsonb),
          distance_km = v_ops.distance_km,
          estimated_duration_minutes = v_ops.estimated_duration_minutes,
          route_notes = v_ops.route_notes,
          stops = coalesce(v_ops.stops, '[]'::jsonb),
          crew_manifest = coalesce(v_ops.crew_manifest, '[]'::jsonb),
          luggage_truck = coalesce(v_ops.luggage_truck, false),
          status = coalesce(v_ops.status, 'planned'),
          source_hoja_travel_arrangement_id = v_hoja_row_id,
          updated_at = now()
      where id = v_segment_id;
    end if;

    if p_hoja_source_table <> 'hoja_de_ruta_transport' then
      update public.hoja_de_ruta_travel_arrangements
      set source_tour_travel_segment_id = v_segment_id
      where id = v_hoja_row_id;
    end if;
  end if;

  perform set_config('app.hoja_trusted_write', 'off', true);

  if p_hoja_id is not null then
    perform public._hoja_touch(p_hoja_id);
  end if;
  if v_previous_hoja_id is not null and v_previous_hoja_id is distinct from p_hoja_id then
    perform public._hoja_touch(v_previous_hoja_id);
  end if;

  select jsonb_build_object(
    'id', case when p_source = 'hoja' then v_hoja_row_id else v_segment_id end,
    'ops_id', v_segment_id,
    'hoja_row_id', v_hoja_row_id,
    'hoja_document_version', h.document_version,
    'hoja_status', h.status,
    'approval_invalidated',
      (v_target_previous_status = 'approved')
      or (v_previous_hoja_id is not null and v_previous_hoja_id is distinct from p_hoja_id and v_previous_hoja_status = 'approved')
  ) into v_result
  from (select 1) seed
  left join public.hoja_de_ruta h on h.id = p_hoja_id;

  return v_result;
end;
$$;

revoke all on function public.save_tour_ops_travel(uuid, text, uuid, uuid, uuid, text, jsonb, timestamptz, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_tour_ops_travel(uuid, text, uuid, uuid, uuid, text, jsonb, timestamptz, jsonb, jsonb)
  to authenticated, service_role;

create or replace function public.delete_tour_ops_travel(
  p_segment_id uuid,
  p_expected_hoja_versions jsonb,
  p_expected_ops_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_previous_status text;
  v_updated_at timestamptz;
  v_hoja_row_id uuid;
  v_hoja_id uuid;
  v_locked_statuses jsonb := '{}'::jsonb;
begin
  if coalesce(public.get_current_user_role(), '') not in ('admin', 'management', 'logistics')
     and not public._hoja_is_service_role() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select s.updated_at, s.source_hoja_travel_arrangement_id, a.hoja_de_ruta_id
    into v_updated_at, v_hoja_row_id, v_hoja_id
  from public.tour_travel_segments s
  left join public.hoja_de_ruta_travel_arrangements a
    on a.id = s.source_hoja_travel_arrangement_id
  where s.id = p_segment_id
  for update of s;
  if not found then
    return jsonb_build_object('deleted', false);
  end if;
  if p_expected_ops_updated_at is not null and v_updated_at is distinct from p_expected_ops_updated_at then
    raise exception 'El viaje de operaciones ha cambiado desde la última carga'
      using errcode = '40001';
  end if;

  v_locked_statuses := public._hoja_lock_external_edits(
    array[v_hoja_id],
    p_expected_hoja_versions
  );
  if v_hoja_id is not null then
    v_target_previous_status := v_locked_statuses ->> v_hoja_id::text;
  end if;

  perform set_config('app.hoja_trusted_write', 'on', true);
  if v_hoja_id is not null then
    delete from public.hoja_de_ruta_travel_arrangements
    where hoja_de_ruta_id = v_hoja_id
      and (source_tour_travel_segment_id = p_segment_id or id = v_hoja_row_id);
  end if;
  delete from public.tour_travel_segments where id = p_segment_id;
  perform set_config('app.hoja_trusted_write', 'off', true);

  if v_hoja_id is not null then
    perform public._hoja_touch(v_hoja_id);
  end if;

  return jsonb_build_object(
    'deleted', true,
    'hoja_document_version', (select document_version from public.hoja_de_ruta where id = v_hoja_id),
    'hoja_status', (select status from public.hoja_de_ruta where id = v_hoja_id),
    'approval_invalidated', v_target_previous_status = 'approved'
  );
end;
$$;

revoke all on function public.delete_tour_ops_travel(uuid, jsonb, timestamptz)
  from public, anon;
grant execute on function public.delete_tour_ops_travel(uuid, jsonb, timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Accommodation + rooming: one transaction, stable source identity
-- ---------------------------------------------------------------------------

create or replace function public.save_tour_ops_accommodation(
  p_tour_id uuid,
  p_source text,
  p_accommodation_id uuid,
  p_hoja_id uuid,
  p_hoja_row_id uuid,
  p_expected_hoja_versions jsonb,
  p_expected_ops_updated_at timestamptz,
  p_ops_payload jsonb,
  p_hoja_payload jsonb,
  p_rooms jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_previous_status text;
  v_ops public.tour_accommodations%rowtype;
  v_hoja public.hoja_de_ruta_accommodations%rowtype;
  v_ops_id uuid := p_accommodation_id;
  v_hoja_id uuid := p_hoja_row_id;
  v_existing_updated_at timestamptz;
  v_previous_hoja_row_id uuid;
  v_previous_hoja_id uuid;
  v_previous_hoja_status text;
  v_room jsonb;
  v_staff1 uuid;
  v_staff2 uuid;
  v_locked_statuses jsonb := '{}'::jsonb;
  v_result jsonb;
begin
  if coalesce(p_source, 'normalized') not in ('normalized', 'hoja') then
    raise exception 'Origen de alojamiento no válido' using errcode = '22023';
  end if;
  if coalesce(public.get_current_user_role(), '') not in ('admin', 'management', 'logistics')
     and not public._hoja_is_service_role() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  perform public._hoja_assert_tour_membership(p_hoja_id, p_tour_id);

  v_ops := jsonb_populate_record(null::public.tour_accommodations, coalesce(p_ops_payload, '{}'::jsonb));
  v_hoja := jsonb_populate_record(null::public.hoja_de_ruta_accommodations, coalesce(p_hoja_payload, '{}'::jsonb));

  if p_source = 'normalized' then
    if v_ops_id is not null then
      select a.updated_at,
             a.source_hoja_accommodation_id,
             ha.hoja_de_ruta_id
        into v_existing_updated_at, v_previous_hoja_row_id, v_previous_hoja_id
      from public.tour_accommodations a
      left join public.hoja_de_ruta_accommodations ha
        on ha.id = a.source_hoja_accommodation_id
      where a.id = v_ops_id and a.tour_id = p_tour_id
      for update of a;
      if not found then
        raise exception 'No existe el alojamiento de operaciones' using errcode = '22023';
      end if;
      if p_expected_ops_updated_at is not null and v_existing_updated_at is distinct from p_expected_ops_updated_at then
        raise exception 'El alojamiento de operaciones ha cambiado desde la última carga'
          using errcode = '40001';
      end if;
    end if;
  end if;

  v_locked_statuses := public._hoja_lock_external_edits(
    array[p_hoja_id, v_previous_hoja_id],
    p_expected_hoja_versions
  );
  if p_hoja_id is not null then
    v_target_previous_status := v_locked_statuses ->> p_hoja_id::text;
  end if;
  if v_previous_hoja_id is not null then
    v_previous_hoja_status := v_locked_statuses ->> v_previous_hoja_id::text;
  end if;

  perform set_config('app.hoja_trusted_write', 'on', true);

  if p_source = 'normalized' then
    if v_ops_id is null then
      insert into public.tour_accommodations (
        tour_id, tour_date_id, hotel_name, hotel_address, location_id, latitude, longitude,
        check_in_date, check_out_date, confirmation_number, room_allocation, rooms_booked,
        notes, status, updated_at
      ) values (
        p_tour_id, v_ops.tour_date_id, coalesce(v_ops.hotel_name, 'Hotel'), v_ops.hotel_address,
        v_ops.location_id, v_ops.latitude, v_ops.longitude, v_ops.check_in_date, v_ops.check_out_date,
        v_ops.confirmation_number, coalesce(v_ops.room_allocation, '[]'::jsonb), v_ops.rooms_booked,
        v_ops.notes, coalesce(v_ops.status, 'planned'), now()
      ) returning id into v_ops_id;
    else
      update public.tour_accommodations
      set tour_date_id = v_ops.tour_date_id,
          hotel_name = coalesce(v_ops.hotel_name, 'Hotel'),
          hotel_address = v_ops.hotel_address,
          location_id = v_ops.location_id,
          latitude = v_ops.latitude,
          longitude = v_ops.longitude,
          check_in_date = v_ops.check_in_date,
          check_out_date = v_ops.check_out_date,
          confirmation_number = v_ops.confirmation_number,
          room_allocation = coalesce(v_ops.room_allocation, '[]'::jsonb),
          rooms_booked = v_ops.rooms_booked,
          notes = v_ops.notes,
          status = coalesce(v_ops.status, 'planned'),
          updated_at = now()
      where id = v_ops_id;
    end if;

    if v_previous_hoja_id is not null and v_previous_hoja_id is distinct from p_hoja_id then
      delete from public.hoja_de_ruta_accommodations
      where id = v_previous_hoja_row_id
        and hoja_de_ruta_id = v_previous_hoja_id
        and source_tour_accommodation_id = v_ops_id;
      v_hoja_id := null;
    end if;

    if p_hoja_id is not null then
      select a.id into v_hoja_id
      from public.hoja_de_ruta_accommodations a
      where a.hoja_de_ruta_id = p_hoja_id
        and a.source_tour_accommodation_id = v_ops_id
      limit 1;

      if v_hoja_id is null then
        select a.id into v_hoja_id
        from public.hoja_de_ruta_accommodations a
        where a.hoja_de_ruta_id = p_hoja_id
          and a.source_tour_accommodation_id is null
          and lower(btrim(coalesce(a.hotel_name, ''))) = lower(btrim(coalesce(v_hoja.hotel_name, '')))
          and a.check_in is not distinct from v_hoja.check_in
          and a.check_out is not distinct from v_hoja.check_out
        order by a.created_at, a.id
        limit 1;
      end if;

      if v_hoja_id is null then
        insert into public.hoja_de_ruta_accommodations (
          hoja_de_ruta_id, hotel_name, address, check_in, check_out, latitude, longitude,
          source_tour_accommodation_id
        ) values (
          p_hoja_id, coalesce(v_hoja.hotel_name, 'Hotel'), v_hoja.address, v_hoja.check_in,
          v_hoja.check_out, v_hoja.latitude, v_hoja.longitude, v_ops_id
        ) returning id into v_hoja_id;
      else
        update public.hoja_de_ruta_accommodations
        set hotel_name = coalesce(v_hoja.hotel_name, 'Hotel'),
            address = v_hoja.address,
            check_in = v_hoja.check_in,
            check_out = v_hoja.check_out,
            latitude = v_hoja.latitude,
            longitude = v_hoja.longitude,
            source_tour_accommodation_id = v_ops_id
        where id = v_hoja_id and hoja_de_ruta_id = p_hoja_id;
      end if;

      update public.tour_accommodations
      set source_hoja_accommodation_id = v_hoja_id
      where id = v_ops_id;
    elsif p_source = 'normalized' then
      update public.tour_accommodations
      set source_hoja_accommodation_id = null
      where id = v_ops_id;
    end if;
  else
    if p_hoja_id is null or v_hoja_id is null then
      raise exception 'Falta el alojamiento de Hoja de Ruta' using errcode = '22023';
    end if;

    update public.hoja_de_ruta_accommodations
    set hotel_name = coalesce(v_hoja.hotel_name, 'Hotel'),
        address = v_hoja.address,
        check_in = v_hoja.check_in,
        check_out = v_hoja.check_out,
        latitude = v_hoja.latitude,
        longitude = v_hoja.longitude
    where id = v_hoja_id and hoja_de_ruta_id = p_hoja_id;
    if not found then
      raise exception 'No existe el alojamiento de Hoja de Ruta' using errcode = '22023';
    end if;

    select id into v_ops_id
    from public.tour_accommodations
    where tour_id = p_tour_id
      and source_hoja_accommodation_id = v_hoja_id
    order by created_at
    limit 1
    for update;

    if v_ops_id is null then
      insert into public.tour_accommodations (
        tour_id, tour_date_id, hotel_name, hotel_address, location_id, latitude, longitude,
        check_in_date, check_out_date, confirmation_number, room_allocation, rooms_booked,
        notes, status, source_hoja_accommodation_id, updated_at
      ) values (
        p_tour_id, v_ops.tour_date_id, coalesce(v_ops.hotel_name, 'Hotel'), v_ops.hotel_address,
        v_ops.location_id, v_ops.latitude, v_ops.longitude, v_ops.check_in_date, v_ops.check_out_date,
        v_ops.confirmation_number, coalesce(v_ops.room_allocation, '[]'::jsonb), v_ops.rooms_booked,
        v_ops.notes, coalesce(v_ops.status, 'planned'), v_hoja_id, now()
      ) returning id into v_ops_id;
    else
      update public.tour_accommodations
      set tour_date_id = v_ops.tour_date_id,
          hotel_name = coalesce(v_ops.hotel_name, 'Hotel'),
          hotel_address = v_ops.hotel_address,
          location_id = v_ops.location_id,
          latitude = v_ops.latitude,
          longitude = v_ops.longitude,
          check_in_date = v_ops.check_in_date,
          check_out_date = v_ops.check_out_date,
          confirmation_number = v_ops.confirmation_number,
          room_allocation = coalesce(v_ops.room_allocation, '[]'::jsonb),
          rooms_booked = v_ops.rooms_booked,
          notes = v_ops.notes,
          status = coalesce(v_ops.status, 'planned'),
          updated_at = now()
      where id = v_ops_id;
    end if;

    update public.hoja_de_ruta_accommodations
    set source_tour_accommodation_id = v_ops_id
    where id = v_hoja_id;
  end if;

  if p_hoja_id is not null and v_hoja_id is not null then
    delete from public.hoja_de_ruta_room_assignments
    where accommodation_id = v_hoja_id;

    for v_room in select value from jsonb_array_elements(coalesce(p_rooms, '[]'::jsonb))
    loop
      v_staff1 := nullif(v_room->>'staff_member1_hoja_staff_id', '')::uuid;
      v_staff2 := nullif(v_room->>'staff_member2_hoja_staff_id', '')::uuid;

      if v_staff1 is not null and not exists (
        select 1 from public.hoja_de_ruta_staff s
        where s.id = v_staff1 and s.hoja_de_ruta_id = p_hoja_id
      ) then
        raise exception 'La habitación referencia personal de otra Hoja de Ruta' using errcode = '22023';
      end if;
      if v_staff2 is not null and not exists (
        select 1 from public.hoja_de_ruta_staff s
        where s.id = v_staff2 and s.hoja_de_ruta_id = p_hoja_id
      ) then
        raise exception 'La habitación referencia personal de otra Hoja de Ruta' using errcode = '22023';
      end if;

      insert into public.hoja_de_ruta_room_assignments (
        id, accommodation_id, room_type, room_number,
        staff_member1_hoja_staff_id, staff_member2_hoja_staff_id,
        staff_member1_id, staff_member2_id, sort_order
      ) values (
        coalesce(nullif(v_room->>'id', '')::uuid, gen_random_uuid()),
        v_hoja_id,
        coalesce(nullif(v_room->>'room_type', ''), 'single'),
        coalesce(v_room->>'room_number', ''),
        v_staff1,
        v_staff2,
        case when v_staff1 is null then nullif(btrim(v_room->>'staff_member1_id'), '') else null end,
        case when v_staff2 is null then nullif(btrim(v_room->>'staff_member2_id'), '') else null end,
        coalesce((v_room->>'sort_order')::integer, 0)
      );
    end loop;
  end if;

  perform set_config('app.hoja_trusted_write', 'off', true);
  if p_hoja_id is not null then
    perform public._hoja_touch(p_hoja_id);
  end if;
  if v_previous_hoja_id is not null and v_previous_hoja_id is distinct from p_hoja_id then
    perform public._hoja_touch(v_previous_hoja_id);
  end if;

  select jsonb_build_object(
    'id', case when p_source = 'hoja' then v_hoja_id else v_ops_id end,
    'ops_id', v_ops_id,
    'hoja_row_id', v_hoja_id,
    'hoja_document_version', h.document_version,
    'hoja_status', h.status,
    'approval_invalidated',
      (v_target_previous_status = 'approved')
      or (v_previous_hoja_id is not null and v_previous_hoja_id is distinct from p_hoja_id and v_previous_hoja_status = 'approved')
  ) into v_result
  from (select 1) seed
  left join public.hoja_de_ruta h on h.id = p_hoja_id;

  return v_result;
end;
$$;

revoke all on function public.save_tour_ops_accommodation(uuid, text, uuid, uuid, uuid, jsonb, timestamptz, jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_tour_ops_accommodation(uuid, text, uuid, uuid, uuid, jsonb, timestamptz, jsonb, jsonb, jsonb)
  to authenticated, service_role;

create or replace function public.delete_tour_ops_accommodation(
  p_source text,
  p_accommodation_id uuid,
  p_hoja_id uuid,
  p_expected_hoja_versions jsonb,
  p_expected_ops_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_previous_status text;
  v_ops_id uuid;
  v_hoja_row_id uuid;
  v_actual_hoja_id uuid;
  v_updated_at timestamptz;
  v_locked_statuses jsonb := '{}'::jsonb;
begin
  if coalesce(public.get_current_user_role(), '') not in ('admin', 'management', 'logistics')
     and not public._hoja_is_service_role() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_source = 'hoja' then
    v_hoja_row_id := p_accommodation_id;
    select a.hoja_de_ruta_id into v_actual_hoja_id
    from public.hoja_de_ruta_accommodations a
    where a.id = v_hoja_row_id;
    if v_actual_hoja_id is distinct from p_hoja_id then
      raise exception 'La Hoja de Ruta del alojamiento no coincide con la carga actual'
        using errcode = '40001';
    end if;
    select a.id, a.updated_at into v_ops_id, v_updated_at
    from public.tour_accommodations a
    where a.source_hoja_accommodation_id = v_hoja_row_id
    limit 1
    for update;
  else
    v_ops_id := p_accommodation_id;
    select a.source_hoja_accommodation_id, a.updated_at, ha.hoja_de_ruta_id
      into v_hoja_row_id, v_updated_at, v_actual_hoja_id
    from public.tour_accommodations a
    left join public.hoja_de_ruta_accommodations ha
      on ha.id = a.source_hoja_accommodation_id
    where a.id = v_ops_id
    for update of a;
  end if;

  if v_ops_id is not null and p_expected_ops_updated_at is not null
     and v_updated_at is distinct from p_expected_ops_updated_at then
    raise exception 'El alojamiento de operaciones ha cambiado desde la última carga'
      using errcode = '40001';
  end if;

  v_locked_statuses := public._hoja_lock_external_edits(
    array[v_actual_hoja_id],
    p_expected_hoja_versions
  );
  if v_actual_hoja_id is not null then
    v_target_previous_status := v_locked_statuses ->> v_actual_hoja_id::text;
  end if;

  perform set_config('app.hoja_trusted_write', 'on', true);
  if v_actual_hoja_id is not null then
    delete from public.hoja_de_ruta_accommodations
    where hoja_de_ruta_id = v_actual_hoja_id
      and (
        id = v_hoja_row_id
        or source_tour_accommodation_id = v_ops_id
      );
  end if;
  if v_ops_id is not null then
    delete from public.tour_accommodations where id = v_ops_id;
  end if;
  perform set_config('app.hoja_trusted_write', 'off', true);

  if v_actual_hoja_id is not null then
    perform public._hoja_touch(v_actual_hoja_id);
  end if;

  return jsonb_build_object(
    'deleted', true,
    'hoja_document_version', (select document_version from public.hoja_de_ruta where id = v_actual_hoja_id),
    'hoja_status', (select status from public.hoja_de_ruta where id = v_actual_hoja_id),
    'approval_invalidated', v_target_previous_status = 'approved'
  );
end;
$$;

revoke all on function public.delete_tour_ops_accommodation(text, uuid, uuid, jsonb, timestamptz)
  from public, anon;
grant execute on function public.delete_tour_ops_accommodation(text, uuid, uuid, jsonb, timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tour contacts: optimistic tour snapshot + stable source ids + Hoja versions
-- ---------------------------------------------------------------------------

create or replace function public.save_tour_contacts_and_sync_hojas(
  p_tour_id uuid,
  p_expected_tour_updated_at timestamptz,
  p_contacts jsonb,
  p_expected_hoja_versions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_updated_at timestamptz;
  v_hoja record;
  v_contact jsonb;
  v_contact_id text;
  v_existing_id uuid;
  v_changed boolean;
  v_rowcount integer;
  v_synced integer := 0;
  v_changed_hojas integer := 0;
  v_invalidated integer := 0;
  v_skipped_final integer := 0;
begin
  if coalesce(public.get_current_user_role(), '') not in ('admin', 'management', 'logistics')
     and not public._hoja_is_service_role() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select t.updated_at
    into v_current_updated_at
  from public.tours t
  where t.id = p_tour_id
  for update;
  if not found then
    raise exception 'No existe la gira' using errcode = '22023';
  end if;

  if p_expected_tour_updated_at is not null
     and v_current_updated_at is distinct from p_expected_tour_updated_at then
    raise exception 'Los contactos de la gira han cambiado desde la última carga'
      using errcode = '40001';
  end if;

  -- Lock every linked Hoja in deterministic order before changing the tour.
  for v_hoja in
    select h.id, h.job_id, coalesce(h.status, 'draft') as status,
           coalesce(h.document_version, 0) as document_version
    from public.hoja_de_ruta h
    where h.tour_date_id in (
      select td.id from public.tour_dates td where td.tour_id = p_tour_id
    )
    order by h.id
    for update
  loop
    if not public.can_manage_hoja(v_hoja.job_id) then
      raise exception 'permission denied' using errcode = '42501';
    end if;
    if v_hoja.status = 'final' then
      v_skipped_final := v_skipped_final + 1;
      continue;
    end if;
    if coalesce((p_expected_hoja_versions->>v_hoja.id::text)::integer, -1) <> v_hoja.document_version then
      raise exception 'Una Hoja de Ruta de la gira ha cambiado desde la última carga'
        using errcode = '40001';
    end if;
  end loop;

  update public.tours set tour_contacts = coalesce(p_contacts, '[]'::jsonb) where id = p_tour_id;

  perform set_config('app.hoja_trusted_write', 'on', true);

  for v_hoja in
    select h.id, h.job_id, coalesce(h.status, 'draft') as status
    from public.hoja_de_ruta h
    where h.tour_date_id in (
        select td.id from public.tour_dates td where td.tour_id = p_tour_id
      )
      and coalesce(h.status, 'draft') <> 'final'
    order by h.id
  loop
    v_changed := false;

    delete from public.hoja_de_ruta_contacts c
    where c.hoja_de_ruta_id = v_hoja.id
      and c.source_tour_contact_id is not null
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) value
        where nullif(btrim(value->>'id'), '') = c.source_tour_contact_id
      );
    get diagnostics v_rowcount = row_count;
    v_changed := v_changed or v_rowcount > 0;

    for v_contact in select value from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb))
    loop
      v_contact_id := nullif(btrim(v_contact->>'id'), '');
      if v_contact_id is null or nullif(btrim(v_contact->>'name'), '') is null then
        continue;
      end if;

      select c.id into v_existing_id
      from public.hoja_de_ruta_contacts c
      where c.hoja_de_ruta_id = v_hoja.id
        and c.source_tour_contact_id = v_contact_id
      limit 1;

      if v_existing_id is null then
        -- Claim one old append-only copy on first post-migration save.
        select c.id into v_existing_id
        from public.hoja_de_ruta_contacts c
        where c.hoja_de_ruta_id = v_hoja.id
          and c.source_tour_contact_id is null
          and c.technician_id is null
          and lower(btrim(coalesce(c.name, ''))) = lower(btrim(coalesce(v_contact->>'name', '')))
          and lower(btrim(coalesce(c.role, ''))) = lower(btrim(coalesce(v_contact->>'role', '')))
          and btrim(coalesce(c.phone, '')) = btrim(coalesce(v_contact->>'phone', ''))
        order by c.id
        limit 1;
      end if;

      if v_existing_id is null then
        insert into public.hoja_de_ruta_contacts (
          hoja_de_ruta_id, name, role, phone, email, source_tour_contact_id
        ) values (
          v_hoja.id,
          btrim(v_contact->>'name'),
          nullif(btrim(v_contact->>'role'), ''),
          nullif(btrim(v_contact->>'phone'), ''),
          nullif(btrim(v_contact->>'email'), ''),
          v_contact_id
        );
        v_changed := true;
        v_synced := v_synced + 1;
      else
        update public.hoja_de_ruta_contacts c
        set name = btrim(v_contact->>'name'),
            role = nullif(btrim(v_contact->>'role'), ''),
            phone = nullif(btrim(v_contact->>'phone'), ''),
            email = nullif(btrim(v_contact->>'email'), ''),
            source_tour_contact_id = v_contact_id
        where c.id = v_existing_id
          and (
            c.name is distinct from btrim(v_contact->>'name')
            or c.role is distinct from nullif(btrim(v_contact->>'role'), '')
            or c.phone is distinct from nullif(btrim(v_contact->>'phone'), '')
            or c.email is distinct from nullif(btrim(v_contact->>'email'), '')
            or c.source_tour_contact_id is distinct from v_contact_id
          );
        get diagnostics v_rowcount = row_count;
        if v_rowcount > 0 then
          v_changed := true;
          v_synced := v_synced + 1;
        end if;
      end if;
    end loop;

    if v_changed then
      perform set_config('app.hoja_trusted_write', 'off', true);
      perform public._hoja_touch(v_hoja.id);
      perform set_config('app.hoja_trusted_write', 'on', true);
      v_changed_hojas := v_changed_hojas + 1;
      if v_hoja.status = 'approved' then
        v_invalidated := v_invalidated + 1;
      end if;
    end if;
  end loop;

  perform set_config('app.hoja_trusted_write', 'off', true);

  return jsonb_build_object(
    'synced_rows', v_synced,
    'changed_hojas', v_changed_hojas,
    'approval_invalidated', v_invalidated,
    'skipped_final', v_skipped_final
  );
end;
$$;

revoke all on function public.save_tour_contacts_and_sync_hojas(uuid, timestamptz, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_tour_contacts_and_sync_hojas(uuid, timestamptz, jsonb, jsonb)
  to authenticated, service_role;

-- Aggregate saves keep intentional free-text room occupants. The three-argument
-- persistence core only understands canonical staff UUIDs; the wrapper restores
-- the explicit free-text fields after that atomic save, while the trusted-write
-- flag is still active. Sending null/empty explicitly clears the external name.
create or replace function public.save_hoja_de_ruta(
  p_job_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_removed_image_ids uuid[]
)
returns table(id uuid, document_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saved record;
  v_legacy_images jsonb := '[]'::jsonb;
  v_removed uuid[] := coalesce(array_remove(p_removed_image_ids, null), '{}'::uuid[]);
  v_previous_status text;
begin
  if not public.can_manage_hoja(p_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.job_type = 'dryhire'
  ) then
    raise exception 'Los trabajos de dry-hire no tienen Hoja de Ruta'
      using errcode = '22023';
  end if;

  select coalesce(h.status, 'draft') into v_previous_status
  from public.hoja_de_ruta h
  where h.job_id = p_job_id;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
    into v_legacy_images
  from public.hoja_de_ruta h
  join public.hoja_de_ruta_images i on i.hoja_de_ruta_id = h.id
  where h.job_id = p_job_id
    and (i.image_path like 'blob:%' or i.image_path like 'data:%');

  perform set_config('app.hoja_trusted_write', 'on', true);

  select saved.id, saved.document_version
    into v_saved
  from public.save_hoja_de_ruta(p_job_id, p_expected_version, p_payload) saved;

  perform set_config('app.allow_legacy_hoja_image_delete', 'on', true);
  delete from public.hoja_de_ruta_images image
  where image.hoja_de_ruta_id = v_saved.id
    and (image.image_path like 'blob:%' or image.image_path like 'data:%')
    and image.id = any(v_removed);
  perform set_config('app.allow_legacy_hoja_image_delete', 'off', true);

  insert into public.hoja_de_ruta_images (
    id, hoja_de_ruta_id, image_path, image_type, sort_order
  )
  select legacy.id, v_saved.id, legacy.image_path, legacy.image_type, coalesce(legacy.sort_order, 0)
  from jsonb_to_recordset(v_legacy_images) as legacy(
    id uuid,
    hoja_de_ruta_id uuid,
    image_path text,
    image_type text,
    sort_order integer
  )
  where not (legacy.id = any(v_removed))
  on conflict on constraint hoja_de_ruta_images_pkey do nothing;

  update public.hoja_de_ruta_staff staff
  set department = nullif(btrim(payload_staff.department), '')
  from jsonb_to_recordset(
    coalesce(p_payload -> 'eventData' -> 'staff', '[]'::jsonb)
  ) as payload_staff(id uuid, department text)
  where staff.id = payload_staff.id
    and staff.hoja_de_ruta_id = v_saved.id;

  update public.hoja_de_ruta_room_assignments room
  set staff_member1_id = case
        when room.staff_member1_hoja_staff_id is null
          then nullif(btrim(payload_room.staff_member1_free_text), '')
        else null
      end,
      staff_member2_id = case
        when room.staff_member2_hoja_staff_id is null
          then nullif(btrim(payload_room.staff_member2_free_text), '')
        else null
      end
  from jsonb_array_elements(coalesce(p_payload -> 'accommodations', '[]'::jsonb)) accommodation,
       lateral jsonb_to_recordset(coalesce(accommodation -> 'rooms', '[]'::jsonb)) as payload_room(
         id uuid,
         staff_member1_free_text text,
         staff_member2_free_text text
       )
  where room.id = payload_room.id
    and exists (
      select 1 from public.hoja_de_ruta_accommodations a
      where a.id = room.accommodation_id
        and a.hoja_de_ruta_id = v_saved.id
    );

  if v_previous_status = 'approved' then
    update public.hoja_de_ruta h
    set status = 'review',
        approved_by = null,
        approved_at = null,
        review_requested_by = coalesce(auth.uid(), h.review_requested_by)
    where h.id = v_saved.id
      and h.status = 'approved';

    perform public._hoja_log_status_change(
      p_job_id, v_saved.id, 'hoja.status.review', 'approved', 'review',
      jsonb_build_object('reason', 'edited_after_approval')
    );
  elsif v_previous_status = 'review' then
    update public.hoja_de_ruta h
    set review_requested_by = coalesce(auth.uid(), h.review_requested_by)
    where h.id = v_saved.id
      and h.status = 'review';
  end if;

  perform set_config('app.hoja_trusted_write', 'off', true);

  return query select v_saved.id, v_saved.document_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Published Hoja PDF metadata is an issued artifact, not generic job-document CRUD.
-- No historical backfill is performed: protection is based on the canonical
-- published_document_id pointer, while new publications set read_only atomically.
-- ---------------------------------------------------------------------------

create or replace function public.protect_published_hoja_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public._hoja_trusted_write() or public._hoja_is_service_role() then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.hoja_de_ruta h
    where h.published_document_id = old.id
  ) then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'La Hoja de Ruta publicada solo se reemplaza desde su flujo de publicación'
      using errcode = '42501';
  end if;

  if new.visible_to_tech is distinct from old.visible_to_tech
     or new.read_only is distinct from old.read_only
     or new.file_path is distinct from old.file_path
     or new.job_id is distinct from old.job_id
     or new.document_kind is distinct from old.document_kind then
    raise exception 'La Hoja de Ruta publicada solo se reemplaza desde su flujo de publicación'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_published_hoja_document()
  from public, anon, authenticated;

drop trigger if exists trg_protect_published_hoja_document on public.job_documents;
create trigger trg_protect_published_hoja_document
before update or delete on public.job_documents
for each row execute function public.protect_published_hoja_document();

-- Publication makes the canonical row immutable to generic document controls.
create or replace function public.publish_hoja_de_ruta_document(
  p_job_id uuid,
  p_document_id uuid,
  p_expected_version integer
)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_version integer;
  v_retired text[];
begin
  if not public.can_manage_hoja(p_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select coalesce(h.document_version, 0)
    into v_current_version
  from public.hoja_de_ruta h
  where h.job_id = p_job_id
  for update;

  if not found then
    raise exception 'No existe una Hoja de Ruta para este trabajo' using errcode = '22023';
  end if;
  if v_current_version <> coalesce(p_expected_version, 0) then
    raise exception 'La Hoja de Ruta ha cambiado desde la última carga'
      using errcode = '40001';
  end if;

  perform set_config('app.hoja_trusted_write', 'on', true);
  v_retired := public.publish_hoja_de_ruta_document(p_job_id, p_document_id);
  update public.job_documents jd
  set visible_to_tech = true,
      read_only = true
  where jd.id = p_document_id and jd.job_id = p_job_id;
  perform set_config('app.hoja_trusted_write', 'off', true);

  return v_retired;
end;
$$;

-- ---------------------------------------------------------------------------
-- job-documents Storage RLS: remove broad legacy grants and use job-aware guards
-- ---------------------------------------------------------------------------

create or replace function public.job_document_storage_job_id(p_path text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_part text;
begin
  -- Storage ownership is encoded in the object namespace. Do not consult
  -- mutable job_documents metadata here: file_path is not unique and an
  -- authenticated user can create metadata rows they own, so metadata-derived
  -- ownership would let a duplicate row reassign an existing object's job.
  foreach v_part in array string_to_array(coalesce(p_path, ''), '/')
  loop
    if v_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select j.id into v_job_id from public.jobs j where j.id = v_part::uuid limit 1;
      if v_job_id is not null then return v_job_id; end if;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.can_read_job_document_storage(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid := public.job_document_storage_job_id(p_path);
  v_role text := coalesce(public.get_current_user_role(), '');
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then return true; end if;
  if auth.uid() is null or v_job_id is null then return false; end if;
  if v_role in ('admin', 'management', 'logistics', 'house_tech') then return true; end if;

  if exists (
    select 1
    from public.job_documents jd
    join public.job_assignments ja on ja.job_id = jd.job_id
    where jd.job_id = v_job_id
      and jd.file_path = p_path
      and jd.visible_to_tech = true
      and ja.technician_id = auth.uid()
      and ja.status = 'confirmed'
  ) then return true; end if;

  if p_path like ('hojas-de-ruta/' || v_job_id::text || '/images/%')
     and exists (
       select 1
       from public.hoja_de_ruta h
       join public.job_assignments ja on ja.job_id = h.job_id
       where h.job_id = v_job_id
         and coalesce(h.status, 'draft') in ('approved', 'final')
         and ja.technician_id = auth.uid()
         and ja.status = 'confirmed'
     ) then return true; end if;

  return false;
end;
$$;

create or replace function public.can_write_job_document_storage(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid := public.job_document_storage_job_id(p_path);
  v_role text := coalesce(public.get_current_user_role(), '');
begin
  if coalesce(auth.jwt()->>'role', '') = 'service_role' then return true; end if;
  if auth.uid() is null or v_job_id is null then return false; end if;

  -- Never mutate the storage object backing the canonical issued Hoja through
  -- generic storage APIs. Publication cleanup first retires the DB row/pointer.
  if exists (
    select 1
    from public.job_documents jd
    join public.hoja_de_ruta h on h.published_document_id = jd.id
    where jd.file_path = p_path
  ) then return false; end if;

  if v_role in ('admin', 'management', 'logistics', 'house_tech') then return true; end if;

  if p_path like 'incident-reports/%'
     and exists (
       select 1 from public.job_assignments ja
       where ja.job_id = v_job_id
         and ja.technician_id = auth.uid()
         and ja.status = 'confirmed'
     ) then return true; end if;

  return false;
end;
$$;

revoke all on function public.job_document_storage_job_id(text) from public, anon, authenticated;
revoke all on function public.can_read_job_document_storage(text) from public, anon;
revoke all on function public.can_write_job_document_storage(text) from public, anon;
grant execute on function public.can_read_job_document_storage(text) to authenticated, service_role;
grant execute on function public.can_write_job_document_storage(text) to authenticated, service_role;

drop policy if exists "Authenticated users can view job documents" on storage.objects;
drop policy if exists "Users can view job documents" on storage.objects;
drop policy if exists "Users can upload job documents" on storage.objects;
drop policy if exists "Users can update job documents" on storage.objects;
drop policy if exists "Users can delete job documents" on storage.objects;
drop policy if exists "Management can upload job documents" on storage.objects;
drop policy if exists "Management can delete job documents" on storage.objects;
drop policy if exists "p_storage_job_documents_authorized_select" on storage.objects;
drop policy if exists "p_storage_job_documents_authorized_insert" on storage.objects;
drop policy if exists "p_storage_job_documents_authorized_update" on storage.objects;
drop policy if exists "p_storage_job_documents_authorized_delete" on storage.objects;

create policy "p_storage_job_documents_authorized_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'job-documents'
  and public.can_read_job_document_storage(name)
  and exists (
    select 1 from public.jobs j
    where j.id = public.job_document_storage_job_id(storage.objects.name)
  )
  and (
    public.get_current_user_role() in ('admin', 'management', 'logistics', 'house_tech')
    or public.can_read_job_document_storage(name)
  )
);

create policy "p_storage_job_documents_authorized_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-documents'
  and public.can_write_job_document_storage(name)
  and exists (
    select 1 from public.jobs j
    where j.id = public.job_document_storage_job_id(storage.objects.name)
  )
  and (
    public.get_current_user_role() in ('admin', 'management', 'logistics', 'house_tech')
    or public.can_write_job_document_storage(name)
  )
);

create policy "p_storage_job_documents_authorized_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'job-documents'
  and public.get_current_user_role() in ('admin', 'management', 'logistics', 'house_tech')
  and public.can_write_job_document_storage(name)
  and exists (
    select 1 from public.jobs j
    where j.id = public.job_document_storage_job_id(storage.objects.name)
  )
)
with check (
  bucket_id = 'job-documents'
  and public.get_current_user_role() in ('admin', 'management', 'logistics', 'house_tech')
  and public.can_write_job_document_storage(name)
  and exists (
    select 1 from public.jobs j
    where j.id = public.job_document_storage_job_id(storage.objects.name)
  )
);

create policy "p_storage_job_documents_authorized_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'job-documents'
  and public.can_write_job_document_storage(name)
  and exists (
    select 1 from public.jobs j
    where j.id = public.job_document_storage_job_id(storage.objects.name)
  )
  and (
    public.get_current_user_role() in ('admin', 'management', 'logistics', 'house_tech')
    or not exists (
      select 1 from public.job_documents jd where jd.file_path = storage.objects.name
    )
  )
);
