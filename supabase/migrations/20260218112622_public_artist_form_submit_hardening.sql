-- Hardening for public artist form submission:
-- 1) lock form row to prevent duplicate concurrent submissions
-- 2) normalize updated_at to UTC for consistency
-- 3) return structured JSON on cast/validation errors

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
    update public.festival_artists
    set
      name = coalesce(nullif(trim(p_form_data->>'name'), ''), name),
      stage = coalesce(nullif(p_form_data->>'stage', '')::integer, stage),
      date = coalesce(nullif(p_form_data->>'date', '')::date, date),
      show_start = coalesce(nullif(p_form_data->>'show_start', '')::time, show_start),
      show_end = coalesce(nullif(p_form_data->>'show_end', '')::time, show_end),
      soundcheck = coalesce((p_form_data->>'soundcheck')::boolean, soundcheck, false),
      soundcheck_start = coalesce(nullif(p_form_data->>'soundcheck_start', '')::time, soundcheck_start),
      soundcheck_end = coalesce(nullif(p_form_data->>'soundcheck_end', '')::time, soundcheck_end),
      foh_console = coalesce(nullif(trim(p_form_data->>'foh_console'), ''), foh_console),
      foh_console_provided_by = coalesce(
        nullif(p_form_data->>'foh_console_provided_by', '')::public.provider_type,
        foh_console_provided_by,
        'festival'::public.provider_type
      ),
      foh_tech = coalesce((p_form_data->>'foh_tech')::boolean, foh_tech, false),
      mon_console = coalesce(nullif(trim(p_form_data->>'mon_console'), ''), mon_console),
      mon_console_provided_by = coalesce(
        nullif(p_form_data->>'mon_console_provided_by', '')::public.provider_type,
        mon_console_provided_by,
        'festival'::public.provider_type
      ),
      mon_tech = coalesce((p_form_data->>'mon_tech')::boolean, mon_tech, false),
      wireless_systems = coalesce(
        nullif(p_form_data->'wireless_systems', 'null'::jsonb),
        wireless_systems,
        '[]'::jsonb
      ),
      wireless_provided_by = coalesce(
        nullif(p_form_data->>'wireless_provided_by', '')::public.provider_type,
        wireless_provided_by,
        'festival'::public.provider_type
      ),
      iem_systems = coalesce(
        nullif(p_form_data->'iem_systems', 'null'::jsonb),
        iem_systems,
        '[]'::jsonb
      ),
      iem_provided_by = coalesce(
        nullif(p_form_data->>'iem_provided_by', '')::public.provider_type,
        iem_provided_by,
        'festival'::public.provider_type
      ),
      monitors_enabled = coalesce((p_form_data->>'monitors_enabled')::boolean, monitors_enabled, false),
      monitors_quantity = coalesce(nullif(p_form_data->>'monitors_quantity', '')::integer, monitors_quantity, 0),
      extras_sf = coalesce((p_form_data->>'extras_sf')::boolean, extras_sf, false),
      extras_df = coalesce((p_form_data->>'extras_df')::boolean, extras_df, false),
      extras_djbooth = coalesce((p_form_data->>'extras_djbooth')::boolean, extras_djbooth, false),
      extras_wired = coalesce(nullif(trim(p_form_data->>'extras_wired'), ''), extras_wired),
      infra_cat6 = coalesce((p_form_data->>'infra_cat6')::boolean, infra_cat6, false),
      infra_cat6_quantity = coalesce(nullif(p_form_data->>'infra_cat6_quantity', '')::integer, infra_cat6_quantity, 0),
      infra_hma = coalesce((p_form_data->>'infra_hma')::boolean, infra_hma, false),
      infra_hma_quantity = coalesce(nullif(p_form_data->>'infra_hma_quantity', '')::integer, infra_hma_quantity, 0),
      infra_coax = coalesce((p_form_data->>'infra_coax')::boolean, infra_coax, false),
      infra_coax_quantity = coalesce(nullif(p_form_data->>'infra_coax_quantity', '')::integer, infra_coax_quantity, 0),
      infra_opticalcon_duo = coalesce((p_form_data->>'infra_opticalcon_duo')::boolean, infra_opticalcon_duo, false),
      infra_opticalcon_duo_quantity = coalesce(
        nullif(p_form_data->>'infra_opticalcon_duo_quantity', '')::integer,
        infra_opticalcon_duo_quantity,
        0
      ),
      infra_analog = coalesce(nullif(p_form_data->>'infra_analog', '')::integer, infra_analog, 0),
      infrastructure_provided_by = coalesce(
        nullif(p_form_data->>'infrastructure_provided_by', '')::public.provider_type,
        infrastructure_provided_by,
        'festival'::public.provider_type
      ),
      other_infrastructure = coalesce(p_form_data->>'other_infrastructure', other_infrastructure),
      notes = coalesce(p_form_data->>'notes', notes),
      rider_missing = coalesce((p_form_data->>'rider_missing')::boolean, rider_missing, false),
      isaftermidnight = coalesce((p_form_data->>'isaftermidnight')::boolean, isaftermidnight, false),
      updated_at = timezone('utc', now())
    where id = v_form.artist_id
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

revoke all on function public.submit_public_artist_form(uuid, jsonb) from public;
grant execute on function public.submit_public_artist_form(uuid, jsonb) to anon;
grant execute on function public.submit_public_artist_form(uuid, jsonb) to authenticated;
grant execute on function public.submit_public_artist_form(uuid, jsonb) to service_role;
