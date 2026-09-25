-- Harden crew transfers and make logistics-event plan saves atomic.
--
-- The UI creates an event together with its department links and may also create a
-- paired unload/return. Those writes must succeed or fail as one transaction.
-- Crew-transfer invariants also belong in the database so alternate clients cannot
-- create routes the driver UI cannot execute.

alter table public.logistics_events
  drop constraint if exists logistics_events_crew_transfer_shape_check;

alter table public.logistics_events
  add constraint logistics_events_crew_transfer_shape_check
  check (
    event_type::text <> 'crew_transfer'
    or (
      origin_location_id is not null
      and passenger_count is not null
      and transport_type::text in ('furgoneta', 'rv', 'sleeper_bus')
    )
  );

create or replace function public.validate_crew_transfer_destination()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_destination_id uuid := new.location_id;
begin
  if new.event_type::text <> 'crew_transfer' then
    return new;
  end if;

  if v_destination_id is null and new.job_id is not null then
    select j.location_id
    into v_destination_id
    from public.jobs j
    where j.id = new.job_id;
  end if;

  if v_destination_id is null then
    raise exception 'El traslado de personal necesita un destino o un trabajo con recinto'
      using errcode = '22023';
  end if;

  if new.origin_location_id is not null and new.origin_location_id = v_destination_id then
    raise exception 'El origen y el destino del traslado no pueden ser el mismo lugar'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_crew_transfer_destination()
  from public, anon, authenticated;

drop trigger if exists trg_logistics_events_validate_crew_transfer_destination
  on public.logistics_events;
create trigger trg_logistics_events_validate_crew_transfer_destination
  before insert or update of event_type, job_id, location_id, origin_location_id
  on public.logistics_events
  for each row execute function public.validate_crew_transfer_destination();

create or replace function public.save_logistics_event_plan(
  p_event jsonb,
  p_departments text[],
  p_event_id uuid default null,
  p_paired_event jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_input public.logistics_events%rowtype;
  v_saved public.logistics_events%rowtype;
  v_paired_input public.logistics_events%rowtype;
  v_paired public.logistics_events%rowtype;
  v_department text;
begin
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'Datos de transporte no válidos' using errcode = '22023';
  end if;

  v_input := jsonb_populate_record(null::public.logistics_events, p_event);

  if p_event_id is null then
    insert into public.logistics_events (
      event_type,
      transport_type,
      transport_provider,
      berth_count,
      notes,
      event_date,
      event_time,
      loading_bay,
      job_id,
      title,
      license_plate,
      color,
      is_hoja_relevant,
      hoja_categories,
      location_id,
      end_date,
      end_time,
      origin_location_id,
      passenger_count,
      movement_type
    ) values (
      v_input.event_type,
      v_input.transport_type,
      v_input.transport_provider,
      v_input.berth_count,
      v_input.notes,
      v_input.event_date,
      v_input.event_time,
      v_input.loading_bay,
      v_input.job_id,
      v_input.title,
      v_input.license_plate,
      v_input.color,
      coalesce(v_input.is_hoja_relevant, true),
      coalesce(v_input.hoja_categories, '{}'::public.logistics_transport_category[]),
      v_input.location_id,
      v_input.end_date,
      v_input.end_time,
      v_input.origin_location_id,
      v_input.passenger_count,
      v_input.movement_type
    )
    returning * into v_saved;
  else
    update public.logistics_events
    set event_type = v_input.event_type,
        transport_type = v_input.transport_type,
        transport_provider = v_input.transport_provider,
        berth_count = v_input.berth_count,
        notes = v_input.notes,
        event_date = v_input.event_date,
        event_time = v_input.event_time,
        loading_bay = v_input.loading_bay,
        job_id = v_input.job_id,
        title = v_input.title,
        license_plate = v_input.license_plate,
        color = v_input.color,
        is_hoja_relevant = coalesce(v_input.is_hoja_relevant, true),
        hoja_categories = coalesce(v_input.hoja_categories, '{}'::public.logistics_transport_category[]),
        location_id = v_input.location_id,
        end_date = v_input.end_date,
        end_time = v_input.end_time,
        origin_location_id = v_input.origin_location_id,
        passenger_count = v_input.passenger_count,
        movement_type = v_input.movement_type
    where id = p_event_id
    returning * into v_saved;

    if not found then
      raise exception 'Evento de logística no encontrado' using errcode = 'P0002';
    end if;
  end if;

  delete from public.logistics_event_departments
  where event_id = v_saved.id;

  foreach v_department in array coalesce(p_departments, '{}'::text[])
  loop
    insert into public.logistics_event_departments(event_id, department)
    values (v_saved.id, v_department);
  end loop;

  if p_paired_event is not null then
    if p_event_id is not null then
      raise exception 'No se puede crear una segunda etapa al editar un transporte'
        using errcode = '22023';
    end if;
    if jsonb_typeof(p_paired_event) <> 'object' then
      raise exception 'Datos de la segunda etapa no válidos' using errcode = '22023';
    end if;

    v_paired_input := jsonb_populate_record(null::public.logistics_events, p_paired_event);

    insert into public.logistics_events (
      event_type,
      transport_type,
      transport_provider,
      berth_count,
      notes,
      event_date,
      event_time,
      loading_bay,
      job_id,
      title,
      license_plate,
      color,
      is_hoja_relevant,
      hoja_categories,
      location_id,
      end_date,
      end_time,
      origin_location_id,
      passenger_count,
      movement_type
    ) values (
      v_paired_input.event_type,
      v_paired_input.transport_type,
      v_paired_input.transport_provider,
      v_paired_input.berth_count,
      v_paired_input.notes,
      v_paired_input.event_date,
      v_paired_input.event_time,
      v_paired_input.loading_bay,
      v_paired_input.job_id,
      v_paired_input.title,
      v_paired_input.license_plate,
      v_paired_input.color,
      coalesce(v_paired_input.is_hoja_relevant, true),
      coalesce(v_paired_input.hoja_categories, '{}'::public.logistics_transport_category[]),
      v_paired_input.location_id,
      v_paired_input.end_date,
      v_paired_input.end_time,
      v_paired_input.origin_location_id,
      v_paired_input.passenger_count,
      v_paired_input.movement_type
    )
    returning * into v_paired;

    foreach v_department in array coalesce(p_departments, '{}'::text[])
    loop
      insert into public.logistics_event_departments(event_id, department)
      values (v_paired.id, v_department);
    end loop;
  end if;

  return jsonb_build_object(
    'event', to_jsonb(v_saved),
    'paired_event', case when v_paired.id is null then null else to_jsonb(v_paired) end
  );
end;
$$;

revoke all on function public.save_logistics_event_plan(jsonb, text[], uuid, jsonb)
  from public, anon;
grant execute on function public.save_logistics_event_plan(jsonb, text[], uuid, jsonb)
  to authenticated, service_role;
