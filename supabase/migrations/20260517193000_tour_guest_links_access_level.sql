-- Add explicit guest-link access levels for external tour sharing.
-- "disabled" is represented by revoked_at, while active links use view/edit.

alter table public.tour_guest_links
  add column if not exists access_level text not null default 'view';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tour_guest_links_access_level_check'
      and conrelid = 'public.tour_guest_links'::regclass
  ) then
    alter table public.tour_guest_links
      add constraint tour_guest_links_access_level_check
      check (access_level in ('view', 'edit'));
  end if;
end $$;

drop function if exists public.create_tour_guest_link(uuid, text, jsonb, timestamptz);

create or replace function public.create_tour_guest_link(
  p_tour_id uuid,
  p_label text default 'External tour link',
  p_allowed_sections jsonb default null,
  p_expires_at timestamptz default null,
  p_access_level text default 'view'
)
returns table (
  id uuid,
  tour_id uuid,
  token text,
  label text,
  allowed_sections jsonb,
  access_level text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_link public.tour_guest_links%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'management')
  ) then
    raise exception 'Permission denied';
  end if;

  if coalesce(p_access_level, 'view') not in ('view', 'edit') then
    raise exception 'Invalid guest link access level';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.tour_guest_links (
    tour_id,
    token,
    token_hash,
    label,
    allowed_sections,
    access_level,
    expires_at,
    created_by
  )
  values (
    p_tour_id,
    v_token,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    coalesce(nullif(trim(p_label), ''), 'External tour link'),
    coalesce(p_allowed_sections, '{
      "overview": true,
      "timeline": true,
      "travel": true,
      "accommodations": true,
      "contacts": true,
      "documents": true,
      "weather": true
    }'::jsonb),
    coalesce(p_access_level, 'view'),
    p_expires_at,
    auth.uid()
  )
  returning * into v_link;

  return query
  select
    v_link.id,
    v_link.tour_id,
    v_token,
    v_link.label,
    v_link.allowed_sections,
    v_link.access_level,
    v_link.expires_at,
    v_link.revoked_at,
    v_link.created_at;
end;
$$;

create or replace function public.set_tour_guest_link_access(
  p_link_id uuid,
  p_access_level text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'management')
  ) then
    raise exception 'Permission denied';
  end if;

  p_access_level := coalesce(p_access_level, 'view');

  if p_access_level = 'disabled' then
    update public.tour_guest_links
    set revoked_at = coalesce(revoked_at, now())
    where id = p_link_id;
    return;
  end if;

  if p_access_level not in ('view', 'edit') then
    raise exception 'Invalid guest link access level';
  end if;

  update public.tour_guest_links
  set access_level = p_access_level,
      revoked_at = null
  where id = p_link_id;
end;
$$;

create or replace function public.get_tour_guest_payload(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.tour_guest_links%rowtype;
  v_payload jsonb;
begin
  select *
  into v_link
  from public.tour_guest_links
  where (
      token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      or token = p_token
    )
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  select jsonb_build_object(
    'share', jsonb_build_object(
      'id', v_link.id,
      'label', v_link.label,
      'allowed_sections', v_link.allowed_sections,
      'access_level', v_link.access_level,
      'expires_at', v_link.expires_at
    ),
    'tour', jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'description', t.description,
      'color', t.color,
      'status', t.status,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'default_timezone', t.default_timezone,
      'tour_contacts', case
        when coalesce((v_link.allowed_sections->>'contacts')::boolean, true) then coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', contact.value->>'id',
              'name', contact.value->>'name',
              'role', contact.value->>'role',
              'phone', contact.value->>'phone',
              'email', contact.value->>'email',
              'company', contact.value->>'company',
              'isPrimary', coalesce((contact.value->>'isPrimary')::boolean, false)
            )
          )
          from jsonb_array_elements(coalesce(t.tour_contacts, '[]'::jsonb)) as contact(value)
        ), '[]'::jsonb)
        else '[]'::jsonb
      end
    ),
    'tour_dates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', td.id,
          'date', td.date,
          'start_date', td.start_date,
          'end_date', td.end_date,
          'tour_date_type', td.tour_date_type,
          'rehearsal_days', td.rehearsal_days,
          'is_tour_pack_only', td.is_tour_pack_only,
          'location_id', td.location_id,
          'location', case
            when loc.id is null then null
            else jsonb_build_object(
              'id', loc.id,
              'name', loc.name,
              'formatted_address', loc.formatted_address,
              'latitude', loc.latitude,
              'longitude', loc.longitude
            )
          end
        )
        order by td.date
      )
      from public.tour_dates td
      left join public.locations loc on loc.id = td.location_id
      where td.tour_id = v_link.tour_id
    ), '[]'::jsonb),
    'timeline_events', case
      when coalesce((v_link.allowed_sections->>'timeline')::boolean, true) then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', tte.id,
            'tour_id', tte.tour_id,
            'event_type', tte.event_type,
            'title', tte.title,
            'description', tte.description,
            'date', tte.date,
            'start_time', tte.start_time,
            'end_time', tte.end_time,
            'timezone', tte.timezone,
            'all_day', tte.all_day,
            'location_id', tte.location_id,
            'location_details', tte.location_details,
            'departments', tte.departments,
            'visible_to_crew', tte.visible_to_crew
          )
          order by tte.date, tte.start_time nulls last
        )
        from public.tour_timeline_events tte
        where tte.tour_id = v_link.tour_id
          and coalesce(tte.visible_to_crew, true) = true
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'travel_segments', case
      when coalesce((v_link.allowed_sections->>'travel')::boolean, true) then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', tts.id,
            'tour_id', tts.tour_id,
            'from_tour_date_id', tts.from_tour_date_id,
            'to_tour_date_id', tts.to_tour_date_id,
            'from_location_id', tts.from_location_id,
            'to_location_id', tts.to_location_id,
            'transportation_type', tts.transportation_type,
            'departure_time', tts.departure_time,
            'arrival_time', tts.arrival_time,
            'carrier_name', tts.carrier_name,
            'vehicle_details', tts.vehicle_details,
            'distance_km', tts.distance_km,
            'estimated_duration_minutes', tts.estimated_duration_minutes,
            'route_notes', tts.route_notes,
            'stops', tts.stops,
            'luggage_truck', tts.luggage_truck,
            'status', tts.status
          )
          order by tts.departure_time nulls last, tts.created_at
        )
        from public.tour_travel_segments tts
        where tts.tour_id = v_link.tour_id
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'accommodations', case
      when coalesce((v_link.allowed_sections->>'accommodations')::boolean, true) then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', ta.id,
            'tour_id', ta.tour_id,
            'tour_date_id', ta.tour_date_id,
            'hotel_name', ta.hotel_name,
            'hotel_address', ta.hotel_address,
            'check_in_date', ta.check_in_date,
            'check_out_date', ta.check_out_date,
            'confirmation_number', ta.confirmation_number,
            'rooms_booked', ta.rooms_booked,
            'status', ta.status
          )
          order by ta.check_in_date nulls last
        )
        from public.tour_accommodations ta
        where ta.tour_id = v_link.tour_id
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'hoja_de_ruta', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', hdr.id,
          'tour_date_id', hdr.tour_date_id,
          'job_id', null,
          'program_schedule_json', case
            when coalesce((v_link.allowed_sections->>'timeline')::boolean, true) then hdr.program_schedule_json
            else '[]'::jsonb
          end,
          'logistics_info', null,
          'venue_name', hdr.venue_name,
          'venue_address', hdr.venue_address,
          'weather_data', case
            when coalesce((v_link.allowed_sections->>'weather')::boolean, true) then hdr.weather_data
            else null
          end,
          'local_contacts', null,
          'restaurants_info', null
        )
      )
      from public.hoja_de_ruta hdr
      where hdr.tour_date_id in (
        select id from public.tour_dates where tour_id = v_link.tour_id
      )
    ), '[]'::jsonb),
    'documents', case
      when coalesce((v_link.allowed_sections->>'documents')::boolean, true) then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', td.id,
            'file_name', td.file_name,
            'file_path', td.file_path,
            'file_type', td.file_type,
            'uploaded_at', td.uploaded_at,
            'visible_to_guest', td.visible_to_guest
          )
          order by td.uploaded_at desc
        )
        from public.tour_documents td
        where td.tour_id = v_link.tour_id
          and coalesce(td.visible_to_guest, false) = true
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  into v_payload
  from public.tours t
  where t.id = v_link.tour_id
    and coalesce(t.deleted, false) = false;

  return coalesce(v_payload, jsonb_build_object('error', 'not_found'));
end;
$$;

revoke execute on function public.create_tour_guest_link(uuid, text, jsonb, timestamptz, text) from anon;
revoke execute on function public.set_tour_guest_link_access(uuid, text) from anon;
grant execute on function public.create_tour_guest_link(uuid, text, jsonb, timestamptz, text) to authenticated;
grant execute on function public.set_tour_guest_link_access(uuid, text) to authenticated;
