-- Waves models can be selected with a quantity (e.g. 2x Server One), so the
-- column moves from a plain text[] of model keys to a jsonb array of
-- {model, quantity} objects, matching the existing wired_mics/wireless_systems
-- pattern. Existing selections are preserved with quantity 1 per model.

alter table public.festival_artists
  drop constraint if exists festival_artists_foh_waves_models_check,
  drop constraint if exists festival_artists_mon_waves_models_check;

alter table public.festival_gear_setups
  drop constraint if exists festival_gear_setups_foh_waves_models_check,
  drop constraint if exists festival_gear_setups_mon_waves_models_check;

alter table public.festival_stage_gear_setups
  drop constraint if exists festival_stage_gear_setups_foh_waves_models_check,
  drop constraint if exists festival_stage_gear_setups_mon_waves_models_check;

create or replace function public._waves_models_text_array_to_jsonb(p_models text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('model', model_key, 'quantity', 1)),
    '[]'::jsonb
  )
  from unnest(coalesce(p_models, '{}'::text[])) as model_key;
$$;

alter table public.festival_artists
  alter column foh_waves_models drop default,
  alter column mon_waves_models drop default;

alter table public.festival_gear_setups
  alter column foh_waves_models drop default,
  alter column mon_waves_models drop default;

alter table public.festival_stage_gear_setups
  alter column foh_waves_models drop default,
  alter column mon_waves_models drop default;

alter table public.festival_artists
  alter column foh_waves_models type jsonb using public._waves_models_text_array_to_jsonb(foh_waves_models),
  alter column foh_waves_models set default '[]'::jsonb,
  alter column mon_waves_models type jsonb using public._waves_models_text_array_to_jsonb(mon_waves_models),
  alter column mon_waves_models set default '[]'::jsonb;

alter table public.festival_gear_setups
  alter column foh_waves_models type jsonb using public._waves_models_text_array_to_jsonb(foh_waves_models),
  alter column foh_waves_models set default '[]'::jsonb,
  alter column mon_waves_models type jsonb using public._waves_models_text_array_to_jsonb(mon_waves_models),
  alter column mon_waves_models set default '[]'::jsonb;

alter table public.festival_stage_gear_setups
  alter column foh_waves_models type jsonb using public._waves_models_text_array_to_jsonb(foh_waves_models),
  alter column foh_waves_models set default '[]'::jsonb,
  alter column mon_waves_models type jsonb using public._waves_models_text_array_to_jsonb(mon_waves_models),
  alter column mon_waves_models set default '[]'::jsonb;

drop function public._waves_models_text_array_to_jsonb(text[]);

comment on column public.festival_artists.foh_waves_models is
  'Selected FOH Waves server model(s) with quantity: array of {model, quantity} objects. model is one of server_one, extreme, titan, livebox, fourier, axis_one, axis_scope.';
comment on column public.festival_artists.mon_waves_models is
  'Selected MON Waves server model(s) with quantity: array of {model, quantity} objects. model is one of server_one, extreme, titan, livebox, fourier, axis_one, axis_scope.';

-- Update the public artist form submission RPC: waves model selections are
-- now passed straight through as jsonb (like wireless_systems) instead of
-- being rebuilt from a text[] via jsonb_array_elements_text.
create or replace function public.submit_public_artist_form(p_token uuid, p_form_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.festival_artist_forms%rowtype;
  v_artist_id uuid;
begin
  if p_token is null then
    return jsonb_build_object('ok', false, 'error', 'missing_token');
  end if;

  if p_form_data is null or jsonb_typeof(p_form_data) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_form_payload');
  end if;

  select *
    into v_form
  from public.festival_artist_forms
  where token = p_token
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'form_not_found');
  end if;

  if v_form.status = 'submitted'::public.form_status then
    if v_form.artist_id is not null then
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
      line_check = coalesce((p_form_data->>'line_check')::boolean, festival_artists.line_check, false),
      line_check_start = coalesce(nullif(p_form_data->>'line_check_start', '')::time, festival_artists.line_check_start),
      line_check_end = coalesce(nullif(p_form_data->>'line_check_end', '')::time, festival_artists.line_check_end),
      load_in_time = coalesce(nullif(p_form_data->>'load_in_time', '')::time, festival_artists.load_in_time),
      foh_console = coalesce(nullif(trim(p_form_data->>'foh_console'), ''), festival_artists.foh_console),
      foh_console_provided_by = coalesce(
        nullif(p_form_data->>'foh_console_provided_by', '')::public.provider_type,
        festival_artists.foh_console_provided_by,
        'festival'::public.provider_type
      ),
      foh_tech = coalesce((p_form_data->>'foh_tech')::boolean, festival_artists.foh_tech, false),
      foh_waves_models = coalesce(
        nullif(p_form_data->'foh_waves_models', 'null'::jsonb),
        festival_artists.foh_waves_models,
        '[]'::jsonb
      ),
      foh_outboard = coalesce(nullif(trim(p_form_data->>'foh_outboard'), ''), festival_artists.foh_outboard),
      foh_waves_provided_by = coalesce(
        nullif(p_form_data->>'foh_waves_provided_by', '')::public.provider_type,
        festival_artists.foh_waves_provided_by,
        'festival'::public.provider_type
      ),
      monitors_from_foh = coalesce((p_form_data->>'monitors_from_foh')::boolean, festival_artists.monitors_from_foh, false),
      mon_console = case
        when coalesce((p_form_data->>'monitors_from_foh')::boolean, festival_artists.monitors_from_foh, false)
          then null
        else coalesce(nullif(trim(p_form_data->>'mon_console'), ''), festival_artists.mon_console)
      end,
      mon_console_provided_by = case
        when coalesce((p_form_data->>'monitors_from_foh')::boolean, festival_artists.monitors_from_foh, false)
          then 'festival'::public.provider_type
        else coalesce(
          nullif(p_form_data->>'mon_console_provided_by', '')::public.provider_type,
          festival_artists.mon_console_provided_by,
          'festival'::public.provider_type
        )
      end,
      mon_waves_models = case
        when coalesce((p_form_data->>'monitors_from_foh')::boolean, festival_artists.monitors_from_foh, false)
          then '[]'::jsonb
        else coalesce(
          nullif(p_form_data->'mon_waves_models', 'null'::jsonb),
          festival_artists.mon_waves_models,
          '[]'::jsonb
        )
      end,
      mon_outboard = case
        when coalesce((p_form_data->>'monitors_from_foh')::boolean, festival_artists.monitors_from_foh, false)
          then null
        else coalesce(nullif(trim(p_form_data->>'mon_outboard'), ''), festival_artists.mon_outboard)
      end,
      mon_waves_provided_by = case
        when coalesce((p_form_data->>'monitors_from_foh')::boolean, festival_artists.monitors_from_foh, false)
          then 'festival'::public.provider_type
        else coalesce(
          nullif(p_form_data->>'mon_waves_provided_by', '')::public.provider_type,
          festival_artists.mon_waves_provided_by,
          'festival'::public.provider_type
        )
      end,
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
      or invalid_parameter_value
      or check_violation then
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
