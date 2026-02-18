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
  v_stage_names jsonb := '[]'::jsonb;
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

  if v_artist.job_id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object('number', fs.number, 'name', fs.name)
        order by fs.number
      ),
      '[]'::jsonb
    )
    into v_stage_names
    from public.festival_stages fs
    where fs.job_id = v_artist.job_id;
  end if;

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
    'logo_file_path', v_logo_file_path,
    'stage_names', v_stage_names
  );
end;
$$;
