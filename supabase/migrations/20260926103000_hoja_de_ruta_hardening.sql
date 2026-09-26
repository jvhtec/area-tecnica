-- Hoja de Ruta hardening: transactional persistence, stable ordering/IDs,
-- deterministic publication metadata, structured dates, and room/staff references.
--
-- This migration intentionally keeps the legacy room text references for read
-- compatibility. New writes use UUID FKs to hoja_de_ruta_staff. Numeric legacy
-- indexes cannot be migrated safely because historical reads had no ORDER BY.

alter table public.hoja_de_ruta
  add column if not exists event_start_date date,
  add column if not exists event_end_date date,
  add column if not exists weather_fetched_at timestamptz,
  add column if not exists published_document_id uuid;

alter table public.job_documents
  add column if not exists document_kind text;

create index if not exists idx_job_documents_job_kind_uploaded
  on public.job_documents (job_id, document_kind, uploaded_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hoja_de_ruta_published_document_id_fkey'
      and conrelid = 'public.hoja_de_ruta'::regclass
  ) then
    alter table public.hoja_de_ruta
      add constraint hoja_de_ruta_published_document_id_fkey
      foreign key (published_document_id)
      references public.job_documents(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_hoja_de_ruta_published_document_id
  on public.hoja_de_ruta (published_document_id)
  where published_document_id is not null;

-- Existing generated Hoja PDFs live in this canonical folder. Marking only
-- canonical paths avoids turning arbitrary customer uploads with "hoja" in
-- the filename into published route sheets.
update public.job_documents
set document_kind = 'hoja_de_ruta'
where document_kind is null
  and file_path like 'hojas-de-ruta/%';

alter table public.hoja_de_ruta_contacts
  add column if not exists email text,
  add column if not exists sort_order integer not null default 0;

alter table public.hoja_de_ruta_staff
  add column if not exists sort_order integer not null default 0;

alter table public.hoja_de_ruta_transport
  add column if not exists sort_order integer not null default 0,
  add column if not exists source_logistics_updated_at timestamptz,
  add column if not exists origin text,
  add column if not exists destination text;

alter table public.hoja_de_ruta_travel_arrangements
  add column if not exists sort_order integer not null default 0;

alter table public.hoja_de_ruta_accommodations
  add column if not exists sort_order integer not null default 0;

alter table public.hoja_de_ruta_room_assignments
  add column if not exists sort_order integer not null default 0,
  add column if not exists staff_member1_hoja_staff_id uuid,
  add column if not exists staff_member2_hoja_staff_id uuid;

alter table public.hoja_de_ruta_images
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hoja_room_staff1_hoja_staff_fkey'
      and conrelid = 'public.hoja_de_ruta_room_assignments'::regclass
  ) then
    alter table public.hoja_de_ruta_room_assignments
      add constraint hoja_room_staff1_hoja_staff_fkey
      foreign key (staff_member1_hoja_staff_id)
      references public.hoja_de_ruta_staff(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'hoja_room_staff2_hoja_staff_fkey'
      and conrelid = 'public.hoja_de_ruta_room_assignments'::regclass
  ) then
    alter table public.hoja_de_ruta_room_assignments
      add constraint hoja_room_staff2_hoja_staff_fkey
      foreign key (staff_member2_hoja_staff_id)
      references public.hoja_de_ruta_staff(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_hoja_room_staff1
  on public.hoja_de_ruta_room_assignments (staff_member1_hoja_staff_id)
  where staff_member1_hoja_staff_id is not null;
create index if not exists idx_hoja_room_staff2
  on public.hoja_de_ruta_room_assignments (staff_member2_hoja_staff_id)
  where staff_member2_hoja_staff_id is not null;

-- Migrate only references that can be resolved without guessing: an existing
-- hoja staff row id or a technician_id belonging to that same Hoja.
update public.hoja_de_ruta_room_assignments r
set staff_member1_hoja_staff_id = s.id
from public.hoja_de_ruta_accommodations a
join public.hoja_de_ruta_staff s
  on s.hoja_de_ruta_id = a.hoja_de_ruta_id
where r.accommodation_id = a.id
  and r.staff_member1_hoja_staff_id is null
  and r.staff_member1_id is not null
  and (
    r.staff_member1_id = s.id::text
    or (s.technician_id is not null and r.staff_member1_id = s.technician_id::text)
  );

update public.hoja_de_ruta_room_assignments r
set staff_member2_hoja_staff_id = s.id
from public.hoja_de_ruta_accommodations a
join public.hoja_de_ruta_staff s
  on s.hoja_de_ruta_id = a.hoja_de_ruta_id
where r.accommodation_id = a.id
  and r.staff_member2_hoja_staff_id is null
  and r.staff_member2_id is not null
  and (
    r.staff_member2_id = s.id::text
    or (s.technician_id is not null and r.staff_member2_id = s.technician_id::text)
  );

-- Preserve a deterministic order for existing rows. There was no historical
-- ordering contract, so UUID order is only a one-off presentation fallback,
-- never used to reinterpret numeric room references.
with ranked as (
  select id, row_number() over (partition by hoja_de_ruta_id order by id) - 1 as n
  from public.hoja_de_ruta_contacts
)
update public.hoja_de_ruta_contacts t set sort_order = ranked.n
from ranked where ranked.id = t.id and t.sort_order = 0;

with ranked as (
  select id, row_number() over (partition by hoja_de_ruta_id order by id) - 1 as n
  from public.hoja_de_ruta_staff
)
update public.hoja_de_ruta_staff t set sort_order = ranked.n
from ranked where ranked.id = t.id and t.sort_order = 0;

with ranked as (
  select id, row_number() over (partition by hoja_de_ruta_id order by id) - 1 as n
  from public.hoja_de_ruta_transport
)
update public.hoja_de_ruta_transport t set sort_order = ranked.n
from ranked where ranked.id = t.id and t.sort_order = 0;

with ranked as (
  select id, row_number() over (partition by hoja_de_ruta_id order by id) - 1 as n
  from public.hoja_de_ruta_travel_arrangements
)
update public.hoja_de_ruta_travel_arrangements t set sort_order = ranked.n
from ranked where ranked.id = t.id and t.sort_order = 0;

with ranked as (
  select id, row_number() over (partition by hoja_de_ruta_id order by id) - 1 as n
  from public.hoja_de_ruta_accommodations
)
update public.hoja_de_ruta_accommodations t set sort_order = ranked.n
from ranked where ranked.id = t.id and t.sort_order = 0;

with ranked as (
  select r.id, row_number() over (partition by r.accommodation_id order by r.id) - 1 as n
  from public.hoja_de_ruta_room_assignments r
)
update public.hoja_de_ruta_room_assignments t set sort_order = ranked.n
from ranked where ranked.id = t.id and t.sort_order = 0;

with ranked as (
  select id, row_number() over (partition by hoja_de_ruta_id, image_type order by id) - 1 as n
  from public.hoja_de_ruta_images
)
update public.hoja_de_ruta_images t set sort_order = ranked.n
from ranked where ranked.id = t.id and t.sort_order = 0;

-- Convert the stringly typed travel/hotel timestamps. Invalid historical text
-- becomes NULL rather than aborting the migration.
create or replace function public._hoja_parse_madrid_timestamptz(p_value text)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v text := nullif(btrim(p_value), '');
begin
  if v is null then
    return null;
  end if;

  begin
    if v ~* '(z|[+-][0-9]{2}:[0-9]{2})$' then
      return v::timestamptz;
    end if;

    if v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([ T][0-9]{2}:[0-9]{2}(:[0-9]{2})?)?$' then
      return replace(v, 'T', ' ')::timestamp at time zone 'Europe/Madrid';
    end if;
  exception when others then
    return null;
  end;

  return null;
end;
$$;

alter table public.hoja_de_ruta_travel_arrangements
  alter column pickup_time type timestamptz using public._hoja_parse_madrid_timestamptz(pickup_time),
  alter column departure_time type timestamptz using public._hoja_parse_madrid_timestamptz(departure_time),
  alter column arrival_time type timestamptz using public._hoja_parse_madrid_timestamptz(arrival_time);

alter table public.hoja_de_ruta_accommodations
  alter column check_in type timestamptz using public._hoja_parse_madrid_timestamptz(check_in),
  alter column check_out type timestamptz using public._hoja_parse_madrid_timestamptz(check_out);

drop function public._hoja_parse_madrid_timestamptz(text);

create or replace function public.can_manage_hoja(p_job_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.role() = 'service_role'
    or coalesce(public.get_current_user_role(), '') in ('admin', 'management', 'logistics');
$$;

revoke all on function public.can_manage_hoja(uuid) from public, anon;
grant execute on function public.can_manage_hoja(uuid) to authenticated, service_role;

-- Clear legacy text room references when their matching staff row disappears.
create or replace function public.clear_legacy_hoja_room_staff_references()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.hoja_de_ruta_room_assignments r
  set
    staff_member1_id = case
      when r.staff_member1_id in (old.id::text, old.technician_id::text) then null
      else r.staff_member1_id
    end,
    staff_member2_id = case
      when r.staff_member2_id in (old.id::text, old.technician_id::text) then null
      else r.staff_member2_id
    end
  from public.hoja_de_ruta_accommodations a
  where r.accommodation_id = a.id
    and a.hoja_de_ruta_id = old.hoja_de_ruta_id
    and (
      r.staff_member1_id in (old.id::text, old.technician_id::text)
      or r.staff_member2_id in (old.id::text, old.technician_id::text)
    );

  return old;
end;
$$;

drop trigger if exists trg_clear_legacy_hoja_room_staff_refs on public.hoja_de_ruta_staff;
create trigger trg_clear_legacy_hoja_room_staff_refs
before delete on public.hoja_de_ruta_staff
for each row execute function public.clear_legacy_hoja_room_staff_references();

-- One transaction owns the entire editable aggregate. Child rows are diffed by
-- UUID, so identities remain stable and realtime consumers see actual changes
-- instead of delete/insert storms.
create or replace function public.save_hoja_de_ruta(
  p_job_id uuid,
  p_expected_version integer,
  p_payload jsonb
)
returns table(id uuid, document_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.hoja_de_ruta%rowtype;
  v_id uuid;
  v_version integer;
  v_actor uuid := auth.uid();
  v_event jsonb := coalesce(p_payload->'eventData', '{}'::jsonb);
  v_logistics jsonb := coalesce(p_payload->'eventData'->'logistics', '{}'::jsonb);
  v_tour_date_id uuid;
  v_start_date date;
  v_end_date date;
begin
  if not public.can_manage_hoja(p_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(v_event->>'eventName', '')), '') is null then
    raise exception 'El nombre del evento es obligatorio' using errcode = '22023';
  end if;

  select *
    into v_existing
  from public.hoja_de_ruta
  where job_id = p_job_id
  for update;

  if found then
    if coalesce(v_existing.document_version, 0) <> coalesce(p_expected_version, 0) then
      raise exception 'Otra persona ha guardado cambios en esta Hoja de Ruta'
        using errcode = '40001',
              detail = format(
                'expected_version=%s current_version=%s',
                coalesce(p_expected_version, 0),
                coalesce(v_existing.document_version, 0)
              );
    end if;
    v_version := coalesce(v_existing.document_version, 0) + 1;
  else
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'La Hoja de Ruta cambió antes de crearla'
        using errcode = '40001';
    end if;
    v_version := 1;
  end if;

  select
    j.tour_date_id,
    (j.start_time at time zone 'Europe/Madrid')::date,
    (j.end_time at time zone 'Europe/Madrid')::date
  into v_tour_date_id, v_start_date, v_end_date
  from public.jobs j
  where j.id = p_job_id;

  insert into public.hoja_de_ruta (
    job_id,
    event_name,
    event_dates,
    event_start_date,
    event_end_date,
    venue_name,
    venue_address,
    venue_latitude,
    venue_longitude,
    schedule,
    program_schedule_json,
    power_requirements,
    auxiliary_needs,
    aux_staff_setup_qty,
    aux_staff_dismantle_qty,
    aux_machinery_requirements,
    weather_data,
    weather_fetched_at,
    restaurants_info,
    print_excluded_sections,
    tour_date_id,
    document_version,
    created_by,
    last_modified,
    last_modified_by,
    updated_at
  )
  values (
    p_job_id,
    coalesce(v_event->>'eventName', ''),
    coalesce(v_event->>'eventDates', ''),
    coalesce(nullif(v_event->>'eventStartDate', '')::date, v_start_date),
    coalesce(nullif(v_event->>'eventEndDate', '')::date, v_end_date),
    coalesce(v_event#>>'{venue,name}', ''),
    coalesce(v_event#>>'{venue,address}', ''),
    nullif(v_event#>>'{venue,coordinates,lat}', '')::double precision,
    nullif(v_event#>>'{venue,coordinates,lng}', '')::double precision,
    coalesce(v_event->>'schedule', ''),
    nullif(v_event->'programScheduleDays', 'null'::jsonb),
    coalesce(v_event->>'powerRequirements', ''),
    coalesce(v_event->>'auxiliaryNeeds', ''),
    greatest(coalesce((v_event->>'auxiliaryStaffSetupQty')::integer, 0), 0),
    greatest(coalesce((v_event->>'auxiliaryStaffDismantleQty')::integer, 0), 0),
    coalesce(v_event->'auxiliaryMachinery', '[]'::jsonb),
    nullif(v_event->'weather', 'null'::jsonb),
    nullif(v_event->>'weatherFetchedAt', '')::timestamptz,
    jsonb_build_object(
      'restaurants', coalesce(v_event->'restaurants', '[]'::jsonb),
      'selectedRestaurants', coalesce(v_event->'selectedRestaurants', '[]'::jsonb)
    ),
    coalesce(v_event->'printExcludedSections', '[]'::jsonb),
    v_tour_date_id,
    v_version,
    coalesce(v_existing.created_by, v_actor),
    now(),
    v_actor,
    now()
  )
  on conflict (job_id) do update
  set
    event_name = excluded.event_name,
    event_dates = excluded.event_dates,
    event_start_date = excluded.event_start_date,
    event_end_date = excluded.event_end_date,
    venue_name = excluded.venue_name,
    venue_address = excluded.venue_address,
    venue_latitude = excluded.venue_latitude,
    venue_longitude = excluded.venue_longitude,
    schedule = excluded.schedule,
    program_schedule_json = excluded.program_schedule_json,
    power_requirements = excluded.power_requirements,
    auxiliary_needs = excluded.auxiliary_needs,
    aux_staff_setup_qty = excluded.aux_staff_setup_qty,
    aux_staff_dismantle_qty = excluded.aux_staff_dismantle_qty,
    aux_machinery_requirements = excluded.aux_machinery_requirements,
    weather_data = excluded.weather_data,
    weather_fetched_at = excluded.weather_fetched_at,
    restaurants_info = excluded.restaurants_info,
    print_excluded_sections = excluded.print_excluded_sections,
    tour_date_id = excluded.tour_date_id,
    document_version = excluded.document_version,
    last_modified = excluded.last_modified,
    last_modified_by = excluded.last_modified_by,
    updated_at = excluded.updated_at
  where coalesce(hoja_de_ruta.document_version, 0) = coalesce(p_expected_version, 0)
  returning hoja_de_ruta.id, hoja_de_ruta.document_version
    into v_id, v_version;

  if v_id is null then
    raise exception 'Otra persona ha guardado cambios en esta Hoja de Ruta'
      using errcode = '40001';
  end if;

  insert into public.hoja_de_ruta_logistics (
    hoja_de_ruta_id,
    loading_details,
    unloading_details,
    equipment_logistics
  )
  values (
    v_id,
    coalesce(v_logistics->>'loadingDetails', ''),
    coalesce(v_logistics->>'unloadingDetails', ''),
    coalesce(v_logistics->>'equipmentLogistics', '')
  )
  on conflict (hoja_de_ruta_id) do update
  set
    loading_details = excluded.loading_details,
    unloading_details = excluded.unloading_details,
    equipment_logistics = excluded.equipment_logistics;

  -- Contacts. Supplied IDs may only address rows already owned by this Hoja.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(v_event->'contacts', '[]'::jsonb)) as r(id uuid)
    join public.hoja_de_ruta_contacts c on c.id = r.id
    where c.hoja_de_ruta_id is distinct from v_id
  ) then
    raise exception 'Un contacto pertenece a otra Hoja de Ruta' using errcode = '22023';
  end if;

  delete from public.hoja_de_ruta_contacts t
  where t.hoja_de_ruta_id = v_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(v_event->'contacts', '[]'::jsonb))
        as r(id uuid)
      where r.id = t.id
    );

  insert into public.hoja_de_ruta_contacts (
    id, hoja_de_ruta_id, name, role, phone, email, technician_id, sort_order
  )
  select
    coalesce(r.id, gen_random_uuid()),
    v_id,
    coalesce(r.name, ''),
    coalesce(r.role, ''),
    coalesce(r.phone, ''),
    nullif(r.email, ''),
    r.technician_id,
    coalesce(r.sort_order, 0)
  from jsonb_to_recordset(coalesce(v_event->'contacts', '[]'::jsonb)) as r(
    id uuid,
    name text,
    role text,
    phone text,
    email text,
    technician_id uuid,
    sort_order integer
  )
  where nullif(btrim(coalesce(r.name, '') || coalesce(r.role, '') || coalesce(r.phone, '') || coalesce(r.email, '')), '') is not null
  on conflict (id) do update
  set
    hoja_de_ruta_id = excluded.hoja_de_ruta_id,
    name = excluded.name,
    role = excluded.role,
    phone = excluded.phone,
    email = excluded.email,
    technician_id = excluded.technician_id,
    sort_order = excluded.sort_order;

  -- Staff.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(v_event->'staff', '[]'::jsonb)) as r(id uuid)
    join public.hoja_de_ruta_staff staff on staff.id = r.id
    where staff.hoja_de_ruta_id is distinct from v_id
  ) then
    raise exception 'Un miembro de personal pertenece a otra Hoja de Ruta' using errcode = '22023';
  end if;

  delete from public.hoja_de_ruta_staff t
  where t.hoja_de_ruta_id = v_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(v_event->'staff', '[]'::jsonb))
        as r(id uuid)
      where r.id = t.id
    );

  insert into public.hoja_de_ruta_staff (
    id, hoja_de_ruta_id, technician_id, name, surname1, surname2, position, dni, sort_order
  )
  select
    coalesce(r.id, gen_random_uuid()),
    v_id,
    r.technician_id,
    coalesce(r.name, ''),
    coalesce(r.surname1, ''),
    coalesce(r.surname2, ''),
    coalesce(r.position, ''),
    coalesce(r.dni, ''),
    coalesce(r.sort_order, 0)
  from jsonb_to_recordset(coalesce(v_event->'staff', '[]'::jsonb)) as r(
    id uuid,
    technician_id uuid,
    name text,
    surname1 text,
    surname2 text,
    position text,
    dni text,
    sort_order integer
  )
  where nullif(btrim(
    coalesce(r.name, '') || coalesce(r.surname1, '') ||
    coalesce(r.surname2, '') || coalesce(r.position, '')
  ), '') is not null
  on conflict (id) do update
  set
    hoja_de_ruta_id = excluded.hoja_de_ruta_id,
    technician_id = excluded.technician_id,
    name = excluded.name,
    surname1 = excluded.surname1,
    surname2 = excluded.surname2,
    position = excluded.position,
    dni = excluded.dni,
    sort_order = excluded.sort_order;

  -- Hoja transport rows.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(v_logistics->'transport', '[]'::jsonb)) as r(id uuid)
    join public.hoja_de_ruta_transport t on t.id = r.id
    where t.hoja_de_ruta_id is distinct from v_id
  ) then
    raise exception 'Un transporte pertenece a otra Hoja de Ruta' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(v_logistics->'transport', '[]'::jsonb))
      as r(source_logistics_event_id uuid)
    left join public.logistics_events le on le.id = r.source_logistics_event_id
    where r.source_logistics_event_id is not null
      and (le.id is null or le.job_id is distinct from p_job_id)
  ) then
    raise exception 'El evento logístico no pertenece al trabajo de esta Hoja de Ruta'
      using errcode = '22023';
  end if;

  delete from public.hoja_de_ruta_transport t
  where t.hoja_de_ruta_id = v_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(v_logistics->'transport', '[]'::jsonb))
        as r(id uuid)
      where r.id = t.id
    );

  insert into public.hoja_de_ruta_transport (
    id,
    hoja_de_ruta_id,
    transport_type,
    driver_name,
    driver_phone,
    license_plate,
    company,
    date_time,
    has_return,
    return_date_time,
    source_logistics_event_id,
    source_logistics_updated_at,
    origin,
    destination,
    is_hoja_relevant,
    logistics_categories,
    sort_order
  )
  select
    coalesce(r.id, gen_random_uuid()),
    v_id,
    r.transport_type,
    coalesce(r.driver_name, ''),
    coalesce(r.driver_phone, ''),
    coalesce(r.license_plate, ''),
    nullif(r.company, ''),
    r.date_time,
    coalesce(r.has_return, false),
    r.return_date_time,
    r.source_logistics_event_id,
    r.source_logistics_updated_at,
    nullif(r.origin, ''),
    nullif(r.destination, ''),
    coalesce(r.is_hoja_relevant, true),
    coalesce(r.logistics_categories::public.logistics_transport_category[], '{}'::public.logistics_transport_category[]),
    coalesce(r.sort_order, 0)
  from jsonb_to_recordset(coalesce(v_logistics->'transport', '[]'::jsonb)) as r(
    id uuid,
    transport_type text,
    driver_name text,
    driver_phone text,
    license_plate text,
    company text,
    date_time timestamptz,
    has_return boolean,
    return_date_time timestamptz,
    source_logistics_event_id uuid,
    source_logistics_updated_at timestamptz,
    origin text,
    destination text,
    is_hoja_relevant boolean,
    logistics_categories text[],
    sort_order integer
  )
  where nullif(btrim(coalesce(r.transport_type, '')), '') is not null
  on conflict (id) do update
  set
    hoja_de_ruta_id = excluded.hoja_de_ruta_id,
    transport_type = excluded.transport_type,
    driver_name = excluded.driver_name,
    driver_phone = excluded.driver_phone,
    license_plate = excluded.license_plate,
    company = excluded.company,
    date_time = excluded.date_time,
    has_return = excluded.has_return,
    return_date_time = excluded.return_date_time,
    source_logistics_event_id = excluded.source_logistics_event_id,
    source_logistics_updated_at = excluded.source_logistics_updated_at,
    origin = excluded.origin,
    destination = excluded.destination,
    is_hoja_relevant = excluded.is_hoja_relevant,
    logistics_categories = excluded.logistics_categories,
    sort_order = excluded.sort_order;

  update public.logistics_events le
  set
    is_hoja_relevant = ht.is_hoja_relevant,
    hoja_categories = coalesce(ht.logistics_categories, '{}'::public.logistics_transport_category[]),
    updated_at = now()
  from public.hoja_de_ruta_transport ht
  where ht.hoja_de_ruta_id = v_id
    and ht.source_logistics_event_id is not null
    and le.id = ht.source_logistics_event_id
    and (
      le.is_hoja_relevant is distinct from ht.is_hoja_relevant
      or le.hoja_categories is distinct from coalesce(ht.logistics_categories, '{}'::public.logistics_transport_category[])
    );

  -- Travel.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'travelArrangements', '[]'::jsonb)) as r(id uuid)
    join public.hoja_de_ruta_travel_arrangements t on t.id = r.id
    where t.hoja_de_ruta_id is distinct from v_id
  ) then
    raise exception 'Un viaje pertenece a otra Hoja de Ruta' using errcode = '22023';
  end if;

  delete from public.hoja_de_ruta_travel_arrangements t
  where t.hoja_de_ruta_id = v_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_payload->'travelArrangements', '[]'::jsonb))
        as r(id uuid)
      where r.id = t.id
    );

  insert into public.hoja_de_ruta_travel_arrangements (
    id,
    hoja_de_ruta_id,
    transportation_type,
    pickup_address,
    pickup_time,
    flight_train_number,
    departure_time,
    arrival_time,
    driver_name,
    driver_phone,
    plate_number,
    notes,
    sort_order
  )
  select
    coalesce(r.id, gen_random_uuid()),
    v_id,
    coalesce(nullif(r.transportation_type, ''), 'van'),
    coalesce(r.pickup_address, ''),
    r.pickup_time,
    coalesce(r.flight_train_number, ''),
    r.departure_time,
    r.arrival_time,
    coalesce(r.driver_name, ''),
    coalesce(r.driver_phone, ''),
    coalesce(r.plate_number, ''),
    coalesce(r.notes, ''),
    coalesce(r.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_payload->'travelArrangements', '[]'::jsonb)) as r(
    id uuid,
    transportation_type text,
    pickup_address text,
    pickup_time timestamptz,
    flight_train_number text,
    departure_time timestamptz,
    arrival_time timestamptz,
    driver_name text,
    driver_phone text,
    plate_number text,
    notes text,
    sort_order integer
  )
  where nullif(btrim(
    coalesce(r.transportation_type, '') || coalesce(r.pickup_address, '') ||
    coalesce(r.flight_train_number, '') || coalesce(r.driver_name, '') ||
    coalesce(r.notes, '')
  ), '') is not null
     or r.pickup_time is not null
     or r.departure_time is not null
     or r.arrival_time is not null
  on conflict (id) do update
  set
    hoja_de_ruta_id = excluded.hoja_de_ruta_id,
    transportation_type = excluded.transportation_type,
    pickup_address = excluded.pickup_address,
    pickup_time = excluded.pickup_time,
    flight_train_number = excluded.flight_train_number,
    departure_time = excluded.departure_time,
    arrival_time = excluded.arrival_time,
    driver_name = excluded.driver_name,
    driver_phone = excluded.driver_phone,
    plate_number = excluded.plate_number,
    notes = excluded.notes,
    sort_order = excluded.sort_order;

  -- Accommodations.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'accommodations', '[]'::jsonb)) as r(id uuid)
    join public.hoja_de_ruta_accommodations a on a.id = r.id
    where a.hoja_de_ruta_id is distinct from v_id
  ) then
    raise exception 'Un alojamiento pertenece a otra Hoja de Ruta' using errcode = '22023';
  end if;

  delete from public.hoja_de_ruta_accommodations a
  where a.hoja_de_ruta_id = v_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_payload->'accommodations', '[]'::jsonb))
        as r(id uuid)
      where r.id = a.id
    );

  insert into public.hoja_de_ruta_accommodations (
    id,
    hoja_de_ruta_id,
    hotel_name,
    address,
    check_in,
    check_out,
    latitude,
    longitude,
    sort_order
  )
  select
    coalesce(r.id, gen_random_uuid()),
    v_id,
    coalesce(r.hotel_name, ''),
    coalesce(r.address, ''),
    r.check_in,
    r.check_out,
    r.latitude,
    r.longitude,
    coalesce(r.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_payload->'accommodations', '[]'::jsonb)) as r(
    id uuid,
    hotel_name text,
    address text,
    check_in timestamptz,
    check_out timestamptz,
    latitude double precision,
    longitude double precision,
    sort_order integer,
    rooms jsonb
  )
  where nullif(btrim(coalesce(r.hotel_name, '') || coalesce(r.address, '')), '') is not null
  on conflict (id) do update
  set
    hoja_de_ruta_id = excluded.hoja_de_ruta_id,
    hotel_name = excluded.hotel_name,
    address = excluded.address,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    sort_order = excluded.sort_order;

  -- Rooms. Existing IDs and staff references must stay inside this Hoja.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'accommodations', '[]'::jsonb)) acc_json
    cross join lateral jsonb_to_recordset(coalesce(acc_json->'rooms', '[]'::jsonb)) as r(id uuid)
    join public.hoja_de_ruta_room_assignments room on room.id = r.id
    join public.hoja_de_ruta_accommodations owner_acc on owner_acc.id = room.accommodation_id
    where owner_acc.hoja_de_ruta_id is distinct from v_id
  ) then
    raise exception 'Una habitación pertenece a otra Hoja de Ruta' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'accommodations', '[]'::jsonb)) acc_json
    cross join lateral jsonb_to_recordset(coalesce(acc_json->'rooms', '[]'::jsonb)) as r(
      staff_member1_hoja_staff_id uuid,
      staff_member2_hoja_staff_id uuid
    )
    left join public.hoja_de_ruta_staff s1 on s1.id = r.staff_member1_hoja_staff_id
    left join public.hoja_de_ruta_staff s2 on s2.id = r.staff_member2_hoja_staff_id
    where (
      r.staff_member1_hoja_staff_id is not null
      and (s1.id is null or s1.hoja_de_ruta_id is distinct from v_id)
    ) or (
      r.staff_member2_hoja_staff_id is not null
      and (s2.id is null or s2.hoja_de_ruta_id is distinct from v_id)
    )
  ) then
    raise exception 'Una habitación referencia personal de otra Hoja de Ruta' using errcode = '22023';
  end if;

  delete from public.hoja_de_ruta_room_assignments room
  using public.hoja_de_ruta_accommodations acc
  where room.accommodation_id = acc.id
    and acc.hoja_de_ruta_id = v_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_payload->'accommodations', '[]'::jsonb)) acc_json
      cross join lateral jsonb_to_recordset(coalesce(acc_json->'rooms', '[]'::jsonb)) as r(
        id uuid
      )
      where r.id = room.id
    );

  insert into public.hoja_de_ruta_room_assignments (
    id,
    accommodation_id,
    room_type,
    room_number,
    staff_member1_id,
    staff_member2_id,
    staff_member1_hoja_staff_id,
    staff_member2_hoja_staff_id,
    sort_order
  )
  select
    coalesce(r.id, gen_random_uuid()),
    (acc_json->>'id')::uuid,
    coalesce(nullif(r.room_type, ''), 'single'),
    coalesce(r.room_number, ''),
    null,
    null,
    r.staff_member1_hoja_staff_id,
    r.staff_member2_hoja_staff_id,
    coalesce(r.sort_order, 0)
  from jsonb_array_elements(coalesce(p_payload->'accommodations', '[]'::jsonb)) acc_json
  cross join lateral jsonb_to_recordset(coalesce(acc_json->'rooms', '[]'::jsonb)) as r(
    id uuid,
    room_type text,
    room_number text,
    staff_member1_hoja_staff_id uuid,
    staff_member2_hoja_staff_id uuid,
    sort_order integer
  )
  where (acc_json->>'id') is not null
    and exists (
      select 1
      from public.hoja_de_ruta_accommodations a
      where a.id = (acc_json->>'id')::uuid
        and a.hoja_de_ruta_id = v_id
    )
  on conflict (id) do update
  set
    accommodation_id = excluded.accommodation_id,
    room_type = excluded.room_type,
    room_number = excluded.room_number,
    staff_member1_id = null,
    staff_member2_id = null,
    staff_member1_hoja_staff_id = excluded.staff_member1_hoja_staff_id,
    staff_member2_hoja_staff_id = excluded.staff_member2_hoja_staff_id,
    sort_order = excluded.sort_order;

  -- Image metadata. Binary objects are uploaded before this RPC. The DB stores
  -- only durable storage paths, never blob:/data: URLs.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'images', '[]'::jsonb)) as r(id uuid)
    join public.hoja_de_ruta_images img on img.id = r.id
    where img.hoja_de_ruta_id is distinct from v_id
  ) then
    raise exception 'Una imagen pertenece a otra Hoja de Ruta' using errcode = '22023';
  end if;

  delete from public.hoja_de_ruta_images img
  where img.hoja_de_ruta_id = v_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_payload->'images', '[]'::jsonb))
        as r(id uuid)
      where r.id = img.id
    );

  insert into public.hoja_de_ruta_images (
    id, hoja_de_ruta_id, image_path, image_type, sort_order
  )
  select
    coalesce(r.id, gen_random_uuid()),
    v_id,
    r.image_path,
    r.image_type,
    coalesce(r.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_payload->'images', '[]'::jsonb)) as r(
    id uuid,
    image_path text,
    image_type text,
    sort_order integer
  )
  where nullif(btrim(coalesce(r.image_path, '')), '') is not null
    and r.image_path not like 'blob:%'
    and r.image_path not like 'data:%'
  on conflict (id) do update
  set
    hoja_de_ruta_id = excluded.hoja_de_ruta_id,
    image_path = excluded.image_path,
    image_type = excluded.image_type,
    sort_order = excluded.sort_order;

  return query select v_id, v_version;
end;
$$;

revoke all on function public.save_hoja_de_ruta(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_hoja_de_ruta(uuid, integer, jsonb) to authenticated, service_role;

create or replace function public.get_hoja_de_ruta(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_hoja_id uuid;
  v_full_access boolean;
  v_role text := coalesce(public.get_current_user_role(), '');
  v_result jsonb;
begin
  select h.id into v_hoja_id
  from public.hoja_de_ruta h
  where h.job_id = p_job_id;

  if v_hoja_id is null then
    return null;
  end if;

  v_full_access := auth.role() = 'service_role'
    or v_role in ('admin', 'management', 'logistics');

  if not v_full_access then
    if v_role not in ('technician', 'house_tech')
       or not exists (
         select 1 from public.job_assignments ja
         where ja.job_id = p_job_id
           and ja.technician_id = auth.uid()
           and ja.status = 'confirmed'
       ) then
      raise exception 'permission denied' using errcode = '42501';
    end if;
  end if;

  select jsonb_build_object(
    'main', to_jsonb(h),
    'logistics', coalesce((
      select to_jsonb(l)
      from public.hoja_de_ruta_logistics l
      where l.hoja_de_ruta_id = h.id
    ), '{}'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.sort_order, c.id)
      from public.hoja_de_ruta_contacts c
      where c.hoja_de_ruta_id = h.id
    ), '[]'::jsonb),
    'staff', case when v_full_access then coalesce((
      select jsonb_agg(to_jsonb(s) order by s.sort_order, s.id)
      from public.hoja_de_ruta_staff s
      where s.hoja_de_ruta_id = h.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'transport', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.sort_order, t.id)
      from public.hoja_de_ruta_transport t
      where t.hoja_de_ruta_id = h.id
    ), '[]'::jsonb),
    'travelArrangements', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.sort_order, t.id)
      from public.hoja_de_ruta_travel_arrangements t
      where t.hoja_de_ruta_id = h.id
    ), '[]'::jsonb),
    'accommodations', coalesce((
      select jsonb_agg(
        to_jsonb(a) || jsonb_build_object(
          'rooms', coalesce((
            select jsonb_agg(to_jsonb(r) order by r.sort_order, r.id)
            from public.hoja_de_ruta_room_assignments r
            where r.accommodation_id = a.id
          ), '[]'::jsonb)
        )
        order by a.sort_order, a.id
      )
      from public.hoja_de_ruta_accommodations a
      where a.hoja_de_ruta_id = h.id
    ), '[]'::jsonb),
    'images', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.image_type, i.sort_order, i.id)
      from public.hoja_de_ruta_images i
      where i.hoja_de_ruta_id = h.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.hoja_de_ruta h
  where h.id = v_hoja_id;

  return v_result;
end;
$$;

revoke all on function public.get_hoja_de_ruta(uuid) from public, anon;
grant execute on function public.get_hoja_de_ruta(uuid) to authenticated, service_role;

-- Atomically make one generated Hoja PDF canonical and retire older rows.
-- Storage object deletion remains client-side using the returned paths.
create or replace function public.publish_hoja_de_ruta_document(
  p_job_id uuid,
  p_document_id uuid
)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare
  v_target_uploaded_at timestamptz;
  v_current_document_id uuid;
  v_current_uploaded_at timestamptz;
  v_deleted_paths text[];
begin
  if not public.can_manage_hoja(p_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select jd.uploaded_at
    into v_target_uploaded_at
  from public.job_documents jd
  where jd.id = p_document_id
    and jd.job_id = p_job_id
    and jd.document_kind = 'hoja_de_ruta'
    and (
      lower(split_part(coalesce(jd.file_type, ''), ';', 1)) = 'application/pdf'
      or jd.file_path ~* '\\.pdf
create or replace function public.replace_hoja_de_ruta_all(
  p_hoja_de_ruta_id uuid,
  p_transport_rows jsonb,
  p_contact_rows jsonb,
  p_staff_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
begin
  select job_id into v_job_id
  from public.hoja_de_ruta
  where id = p_hoja_de_ruta_id;

  if v_job_id is null or not public.can_manage_hoja(v_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  perform public.replace_hoja_de_ruta_transport(p_hoja_de_ruta_id, p_transport_rows);
  perform public.replace_hoja_de_ruta_contacts(p_hoja_de_ruta_id, p_contact_rows);
  perform public.replace_hoja_de_ruta_staff(p_hoja_de_ruta_id, p_staff_rows);
end;
$$;

revoke execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;

    )
  for update;

  if not found then
    raise exception 'El documento no es una Hoja de Ruta PDF válida para este trabajo'
      using errcode = '22023';
  end if;

  select h.published_document_id
    into v_current_document_id
  from public.hoja_de_ruta h
  where h.job_id = p_job_id
  for update;

  if not found then
    raise exception 'No existe una Hoja de Ruta para este trabajo' using errcode = '22023';
  end if;

  if v_current_document_id is not null and v_current_document_id <> p_document_id then
    select jd.uploaded_at
      into v_current_uploaded_at
    from public.job_documents jd
    where jd.id = v_current_document_id
      and jd.job_id = p_job_id
      and jd.document_kind = 'hoja_de_ruta';

    if v_current_uploaded_at is not null
       and v_target_uploaded_at is not null
       and v_current_uploaded_at > v_target_uploaded_at then
      raise exception 'Existe una Hoja de Ruta publicada más reciente'
        using errcode = '40001';
    end if;
  end if;

  update public.hoja_de_ruta
  set published_document_id = p_document_id
  where job_id = p_job_id;

  with deleted as (
    delete from public.job_documents jd
    where jd.job_id = p_job_id
      and jd.id <> p_document_id
      and (
        jd.document_kind = 'hoja_de_ruta'
        or (
          jd.document_kind is null
          and jd.file_path like ('hojas-de-ruta/' || p_job_id::text || '/%')
        )
      )
      and coalesce(jd.uploaded_at, '-infinity'::timestamptz)
          <= coalesce(v_target_uploaded_at, now())
    returning jd.file_path
  )
  select coalesce(array_agg(file_path), array[]::text[])
    into v_deleted_paths
  from deleted;

  return coalesce(v_deleted_paths, array[]::text[]);
end;
$;

revoke all on function public.publish_hoja_de_ruta_document(uuid, uuid) from public, anon;
grant execute on function public.publish_hoja_de_ruta_document(uuid, uuid) to authenticated, service_role;

-- Retire the stale "oscar" bypass from the old replacement RPC while keeping
-- the RPC for old clients until all deployed frontends have moved to save_hoja_de_ruta.
create or replace function public.replace_hoja_de_ruta_all(
  p_hoja_de_ruta_id uuid,
  p_transport_rows jsonb,
  p_contact_rows jsonb,
  p_staff_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
begin
  select job_id into v_job_id
  from public.hoja_de_ruta
  where id = p_hoja_de_ruta_id
  for update;

  if v_job_id is null or not public.can_manage_hoja(v_job_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.hoja_de_ruta
  set
    document_version = coalesce(document_version, 0) + 1,
    last_modified = now(),
    last_modified_by = auth.uid(),
    updated_at = now()
  where id = p_hoja_de_ruta_id;

  perform public.replace_hoja_de_ruta_transport(p_hoja_de_ruta_id, p_transport_rows);
  perform public.replace_hoja_de_ruta_contacts(p_hoja_de_ruta_id, p_contact_rows);
  perform public.replace_hoja_de_ruta_staff(p_hoja_de_ruta_id, p_staff_rows);
end;
$$;

revoke execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.replace_hoja_de_ruta_all(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;
