-- Enforce one submission per artist across all tokens and use an upsert write path.

create or replace function public.get_public_artist_form_context(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.festival_artist_forms%rowtype;
  v_artist public.festival_artists%rowtype;
  v_gear_setup jsonb;
  v_logo_file_path text;
  v_already_submitted boolean := false;
begin
  if p_token is null then
    return jsonb_build_object('ok', false, 'error', 'missing_token');
  end if;

  select *
  into v_form
  from public.festival_artist_forms
  where token = p_token
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select exists(
    select 1
    from public.festival_artist_form_submissions s
    where s.artist_id = v_form.artist_id
      and s.status = 'submitted'
  )
  into v_already_submitted;

  if v_already_submitted then
    if v_form.status = 'pending'::public.form_status then
      update public.festival_artist_forms
      set
        status = 'submitted'::public.form_status,
        updated_at = timezone('utc', now())
      where id = v_form.id;
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', 'already_submitted',
      'status', 'submitted'
    );
  end if;

  if v_form.expires_at <= now() and v_form.status = 'pending'::public.form_status then
    update public.festival_artist_forms
    set
      status = 'expired'::public.form_status,
      updated_at = timezone('utc', now())
    where id = v_form.id;

    v_form.status := 'expired'::public.form_status;
  end if;

  if v_form.status <> 'pending'::public.form_status then
    return jsonb_build_object(
      'ok', false,
      'error', 'form_not_pending',
      'status', v_form.status
    );
  end if;

  select *
  into v_artist
  from public.festival_artists
  where id = v_form.artist_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'artist_not_found');
  end if;

  select fl.file_path
  into v_logo_file_path
  from public.festival_logos fl
  where fl.job_id = v_artist.job_id
  limit 1;

  select to_jsonb(gs)
  into v_gear_setup
  from (
    select
      id,
      job_id,
      max_stages,
      foh_consoles,
      mon_consoles,
      wireless_systems,
      iem_systems,
      wired_mics,
      available_monitors,
      has_side_fills,
      has_drum_fills,
      has_dj_booths,
      available_cat6_runs,
      available_hma_runs,
      available_coax_runs,
      available_analog_runs,
      available_opticalcon_duo_runs,
      notes,
      other_infrastructure,
      created_at,
      updated_at
    from public.festival_gear_setups
    where job_id = v_artist.job_id
    limit 1
  ) as gs;

  return jsonb_build_object(
    'ok', true,
    'form', jsonb_build_object(
      'id', v_form.id,
      'artist_id', v_form.artist_id,
      'status', v_form.status,
      'expires_at', v_form.expires_at
    ),
    'artist', to_jsonb(v_artist),
    'gear_setup', coalesce(v_gear_setup, 'null'::jsonb),
    'logo_file_path', v_logo_file_path
  );
end;
$$;

create or replace function public.submit_public_artist_form(
  p_token uuid,
  p_form_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.festival_artist_forms%rowtype;
  v_artist_id uuid;
  v_already_submitted boolean := false;
begin
  if p_token is null then
    return jsonb_build_object('ok', false, 'error', 'missing_token');
  end if;

  if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_form_data');
  end if;

  select *
  into v_form
  from public.festival_artist_forms
  where token = p_token
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  -- Serialize submissions per artist, even across different tokens.
  perform pg_advisory_xact_lock(hashtext(v_form.artist_id::text));

  select exists(
    select 1
    from public.festival_artist_form_submissions s
    where s.artist_id = v_form.artist_id
      and s.status = 'submitted'
  )
  into v_already_submitted;

  if v_already_submitted then
    if v_form.status = 'pending'::public.form_status then
      update public.festival_artist_forms
      set
        status = 'submitted'::public.form_status,
        updated_at = timezone('utc', now())
      where id = v_form.id;
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', 'already_submitted',
      'status', 'submitted'
    );
  end if;

  if v_form.expires_at <= now() and v_form.status = 'pending'::public.form_status then
    update public.festival_artist_forms
    set
      status = 'expired'::public.form_status,
      updated_at = timezone('utc', now())
    where id = v_form.id;

    return jsonb_build_object('ok', false, 'error', 'form_expired', 'status', 'expired');
  end if;

  if v_form.status <> 'pending'::public.form_status then
    return jsonb_build_object(
      'ok', false,
      'error', 'form_not_pending',
      'status', v_form.status
    );
  end if;

  begin
    insert into public.festival_artists (
      id,
      name,
      updated_at
    ) values (
      v_form.artist_id,
      coalesce(nullif(trim(p_form_data->>'name'), ''), 'Artista'),
      timezone('utc', now())
    )
    on conflict (id) do update
    set
      name = coalesce(nullif(trim(p_form_data->>'name'), ''), festival_artists.name),
      stage = coalesce(nullif(p_form_data->>'stage', '')::integer, festival_artists.stage),
      date = coalesce(nullif(p_form_data->>'date', '')::date, festival_artists.date),
      show_start = coalesce(nullif(p_form_data->>'show_start', '')::time, festival_artists.show_start),
      show_end = coalesce(nullif(p_form_data->>'show_end', '')::time, festival_artists.show_end),
      soundcheck = coalesce((p_form_data->>'soundcheck')::boolean, festival_artists.soundcheck, false),
      soundcheck_start = coalesce(nullif(p_form_data->>'soundcheck_start', '')::time, festival_artists.soundcheck_start),
      soundcheck_end = coalesce(nullif(p_form_data->>'soundcheck_end', '')::time, festival_artists.soundcheck_end),
      foh_console = coalesce(nullif(trim(p_form_data->>'foh_console'), ''), festival_artists.foh_console),
      foh_console_provided_by = coalesce(
        nullif(p_form_data->>'foh_console_provided_by', '')::public.provider_type,
        festival_artists.foh_console_provided_by,
        'festival'::public.provider_type
      ),
      foh_tech = coalesce((p_form_data->>'foh_tech')::boolean, festival_artists.foh_tech, false),
      mon_console = coalesce(nullif(trim(p_form_data->>'mon_console'), ''), festival_artists.mon_console),
      mon_console_provided_by = coalesce(
        nullif(p_form_data->>'mon_console_provided_by', '')::public.provider_type,
        festival_artists.mon_console_provided_by,
        'festival'::public.provider_type
      ),
      mon_tech = coalesce((p_form_data->>'mon_tech')::boolean, festival_artists.mon_tech, false),
      wireless_systems = coalesce(
        nullif(p_form_data->'wireless_systems', 'null'::jsonb),
        festival_artists.wireless_systems,
        '[]'::jsonb
      ),
      wireless_provided_by = coalesce(
        nullif(p_form_data->>'wireless_provided_by', '')::public.provider_type,
        festival_artists.wireless_provided_by,
        'festival'::public.provider_type
      ),
      iem_systems = coalesce(
        nullif(p_form_data->'iem_systems', 'null'::jsonb),
        festival_artists.iem_systems,
        '[]'::jsonb
      ),
      iem_provided_by = coalesce(
        nullif(p_form_data->>'iem_provided_by', '')::public.provider_type,
        festival_artists.iem_provided_by,
        'festival'::public.provider_type
      ),
      monitors_enabled = coalesce((p_form_data->>'monitors_enabled')::boolean, festival_artists.monitors_enabled, false),
      monitors_quantity = coalesce(nullif(p_form_data->>'monitors_quantity', '')::integer, festival_artists.monitors_quantity, 0),
      extras_sf = coalesce((p_form_data->>'extras_sf')::boolean, festival_artists.extras_sf, false),
      extras_df = coalesce((p_form_data->>'extras_df')::boolean, festival_artists.extras_df, false),
      extras_djbooth = coalesce((p_form_data->>'extras_djbooth')::boolean, festival_artists.extras_djbooth, false),
      extras_wired = coalesce(nullif(trim(p_form_data->>'extras_wired'), ''), festival_artists.extras_wired),
      infra_cat6 = coalesce((p_form_data->>'infra_cat6')::boolean, festival_artists.infra_cat6, false),
      infra_cat6_quantity = coalesce(nullif(p_form_data->>'infra_cat6_quantity', '')::integer, festival_artists.infra_cat6_quantity, 0),
      infra_hma = coalesce((p_form_data->>'infra_hma')::boolean, festival_artists.infra_hma, false),
      infra_hma_quantity = coalesce(nullif(p_form_data->>'infra_hma_quantity', '')::integer, festival_artists.infra_hma_quantity, 0),
      infra_coax = coalesce((p_form_data->>'infra_coax')::boolean, festival_artists.infra_coax, false),
      infra_coax_quantity = coalesce(nullif(p_form_data->>'infra_coax_quantity', '')::integer, festival_artists.infra_coax_quantity, 0),
      infra_opticalcon_duo = coalesce((p_form_data->>'infra_opticalcon_duo')::boolean, festival_artists.infra_opticalcon_duo, false),
      infra_opticalcon_duo_quantity = coalesce(
        nullif(p_form_data->>'infra_opticalcon_duo_quantity', '')::integer,
        festival_artists.infra_opticalcon_duo_quantity,
        0
      ),
      infra_analog = coalesce(nullif(p_form_data->>'infra_analog', '')::integer, festival_artists.infra_analog, 0),
      infrastructure_provided_by = coalesce(
        nullif(p_form_data->>'infrastructure_provided_by', '')::public.provider_type,
        festival_artists.infrastructure_provided_by,
        'festival'::public.provider_type
      ),
      other_infrastructure = coalesce(p_form_data->>'other_infrastructure', festival_artists.other_infrastructure),
      notes = coalesce(p_form_data->>'notes', festival_artists.notes),
      rider_missing = coalesce((p_form_data->>'rider_missing')::boolean, festival_artists.rider_missing, false),
      isaftermidnight = coalesce((p_form_data->>'isaftermidnight')::boolean, festival_artists.isaftermidnight, false),
      updated_at = timezone('utc', now())
    returning id into v_artist_id;
  exception
    when invalid_text_representation
      or invalid_datetime_format
      or datetime_field_overflow
      or numeric_value_out_of_range
      or invalid_parameter_value then
      return jsonb_build_object('ok', false, 'error', 'invalid_form_data');
  end;

  if v_artist_id is null then
    return jsonb_build_object('ok', false, 'error', 'artist_not_found');
  end if;

  insert into public.festival_artist_form_submissions (
    form_id,
    artist_id,
    form_data,
    status,
    submitted_at
  ) values (
    v_form.id,
    v_form.artist_id,
    p_form_data,
    'submitted',
    timezone('utc', now())
  );

  update public.festival_artist_forms
  set
    status = 'submitted'::public.form_status,
    updated_at = timezone('utc', now())
  where id = v_form.id;

  return jsonb_build_object('ok', true, 'status', 'submitted');
end;
$$;

revoke all on function public.get_public_artist_form_context(uuid) from public;
revoke all on function public.submit_public_artist_form(uuid, jsonb) from public;

grant execute on function public.get_public_artist_form_context(uuid) to anon;
grant execute on function public.get_public_artist_form_context(uuid) to authenticated;
grant execute on function public.get_public_artist_form_context(uuid) to service_role;

grant execute on function public.submit_public_artist_form(uuid, jsonb) to anon;
grant execute on function public.submit_public_artist_form(uuid, jsonb) to authenticated;
grant execute on function public.submit_public_artist_form(uuid, jsonb) to service_role;
