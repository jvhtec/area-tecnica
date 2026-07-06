ALTER TABLE public.festival_artists
  ADD COLUMN IF NOT EXISTS rider_outdated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.festival_artists.rider_outdated IS
  'Explicit rider freshness flag. Imported/copied riders are marked true until a current rider is uploaded for the artist.';

CREATE INDEX IF NOT EXISTS idx_festival_artist_files_uploaded_at
  ON public.festival_artist_files (uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_festival_artist_files_file_path
  ON public.festival_artist_files (file_path);

CREATE OR REPLACE FUNCTION public.import_artist_rider_to_job(
  p_source_artist_id uuid,
  p_target_job_id uuid,
  p_target_date date,
  p_target_stage integer
)
RETURNS TABLE (
  imported_artist_id uuid,
  imported_file_count integer,
  target_date date,
  target_stage integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_source_artist public.festival_artists%ROWTYPE;
  v_imported_artist_id uuid;
  v_file_count integer;
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role <> ALL (ARRAY['admin', 'management', 'logistics']) THEN
    RAISE EXCEPTION 'not_authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_source_artist_id IS NULL OR p_target_job_id IS NULL OR p_target_date IS NULL THEN
    RAISE EXCEPTION 'missing_required_argument'
      USING ERRCODE = '22023';
  END IF;

  IF p_target_stage IS NULL OR p_target_stage < 1 OR p_target_stage > 4 THEN
    RAISE EXCEPTION 'invalid_target_stage'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_source_artist
  FROM public.festival_artists
  WHERE id = p_source_artist_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'source_artist_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.jobs
  WHERE id = p_target_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_job_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.festival_artist_files
  WHERE artist_id = p_source_artist_id
  FOR SHARE;

  GET DIAGNOSTICS v_file_count = ROW_COUNT;

  IF v_file_count = 0 THEN
    RAISE EXCEPTION 'source_artist_has_no_riders'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_artist_files source_file
    JOIN public.festival_artist_files target_file
      ON target_file.file_path = source_file.file_path
    JOIN public.festival_artists target_artist
      ON target_artist.id = target_file.artist_id
    WHERE source_file.artist_id = p_source_artist_id
      AND target_artist.job_id = p_target_job_id
  ) THEN
    RAISE EXCEPTION 'duplicate_rider_import'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.festival_artists (
    job_id,
    name,
    date,
    stage,
    show_start,
    show_end,
    soundcheck,
    soundcheck_start,
    soundcheck_end,
    line_check,
    line_check_start,
    line_check_end,
    load_in_time,
    foh_console,
    foh_console_provided_by,
    foh_drive,
    foh_drive_position,
    foh_outboard,
    foh_tech,
    foh_waves_models,
    foh_waves_provided_by,
    mon_console,
    mon_console_provided_by,
    mon_position,
    mon_outboard,
    mon_tech,
    mon_waves_models,
    mon_waves_provided_by,
    monitors_from_foh,
    wireless_quantity,
    wireless_systems,
    wireless_provided_by,
    iem_systems,
    iem_provided_by,
    monitors_enabled,
    monitors_quantity,
    extras_sf,
    extras_df,
    extras_djbooth,
    extras_wired,
    mic_pack,
    rf_festival_mics,
    rf_festival_wireless,
    rf_festival_url,
    infra_cat6,
    infra_cat6_quantity,
    infra_hma,
    infra_hma_quantity,
    infra_coax,
    infra_coax_quantity,
    infra_opticalcon_duo,
    infra_opticalcon_duo_quantity,
    infra_analog,
    other_infrastructure,
    infrastructure_provided_by,
    notes,
    crew,
    timezone,
    isaftermidnight,
    rider_missing,
    rider_copied_from_date,
    rider_outdated,
    rider_outdated_dismissed,
    mic_kit,
    wired_mics,
    form_language,
    stage_plot_file_path,
    stage_plot_file_name,
    stage_plot_file_type,
    stage_plot_uploaded_at
  )
  VALUES (
    p_target_job_id,
    v_source_artist.name,
    p_target_date,
    p_target_stage,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL,
    v_source_artist.foh_console,
    v_source_artist.foh_console_provided_by,
    v_source_artist.foh_drive,
    v_source_artist.foh_drive_position,
    v_source_artist.foh_outboard,
    v_source_artist.foh_tech,
    v_source_artist.foh_waves_models,
    v_source_artist.foh_waves_provided_by,
    v_source_artist.mon_console,
    v_source_artist.mon_console_provided_by,
    v_source_artist.mon_position,
    v_source_artist.mon_outboard,
    v_source_artist.mon_tech,
    v_source_artist.mon_waves_models,
    v_source_artist.mon_waves_provided_by,
    v_source_artist.monitors_from_foh,
    v_source_artist.wireless_quantity,
    v_source_artist.wireless_systems,
    v_source_artist.wireless_provided_by,
    v_source_artist.iem_systems,
    v_source_artist.iem_provided_by,
    v_source_artist.monitors_enabled,
    v_source_artist.monitors_quantity,
    v_source_artist.extras_sf,
    v_source_artist.extras_df,
    v_source_artist.extras_djbooth,
    v_source_artist.extras_wired,
    v_source_artist.mic_pack,
    v_source_artist.rf_festival_mics,
    v_source_artist.rf_festival_wireless,
    v_source_artist.rf_festival_url,
    v_source_artist.infra_cat6,
    v_source_artist.infra_cat6_quantity,
    v_source_artist.infra_hma,
    v_source_artist.infra_hma_quantity,
    v_source_artist.infra_coax,
    v_source_artist.infra_coax_quantity,
    v_source_artist.infra_opticalcon_duo,
    v_source_artist.infra_opticalcon_duo_quantity,
    v_source_artist.infra_analog,
    v_source_artist.other_infrastructure,
    v_source_artist.infrastructure_provided_by,
    v_source_artist.notes,
    v_source_artist.crew,
    v_source_artist.timezone,
    false,
    false,
    v_source_artist.date,
    true,
    false,
    v_source_artist.mic_kit,
    v_source_artist.wired_mics,
    v_source_artist.form_language,
    NULL,
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_imported_artist_id;

  INSERT INTO public.festival_artist_files (
    artist_id,
    file_name,
    file_path,
    file_type,
    file_size,
    uploaded_by,
    uploaded_at
  )
  SELECT
    v_imported_artist_id,
    file_name,
    file_path,
    file_type,
    file_size,
    uploaded_by,
    uploaded_at
  FROM public.festival_artist_files
  WHERE artist_id = p_source_artist_id
  ORDER BY uploaded_at DESC NULLS LAST, file_name ASC;

  RETURN QUERY
  SELECT v_imported_artist_id, v_file_count, p_target_date, p_target_stage;
END;
$$;

COMMENT ON FUNCTION public.import_artist_rider_to_job(uuid, uuid, date, integer) IS
  'Imports a rider-bearing source artist into a target job as an outdated technical copy with shared rider file references.';

REVOKE ALL ON FUNCTION public.import_artist_rider_to_job(uuid, uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_artist_rider_to_job(uuid, uuid, date, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_festival_artist_file_reference(
  p_file_id uuid,
  p_artist_id uuid DEFAULT NULL
)
RETURNS TABLE (
  deleted_file_id uuid,
  file_path text,
  should_delete_storage boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_file public.festival_artist_files%ROWTYPE;
  v_remaining_references integer;
BEGIN
  v_role := public.get_current_user_role();
  IF auth.role() <> 'service_role'
    AND (v_role IS NULL OR v_role <> ALL (ARRAY['admin', 'management', 'logistics'])) THEN
    RAISE EXCEPTION 'not_authorized'
      USING ERRCODE = '42501';
  END IF;

  IF p_file_id IS NULL THEN
    RAISE EXCEPTION 'missing_required_argument'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_file
  FROM public.festival_artist_files
  WHERE id = p_file_id
    AND (p_artist_id IS NULL OR artist_id = p_artist_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'file_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.festival_artist_files
  WHERE id = v_file.id;

  SELECT count(*)::integer
  INTO v_remaining_references
  FROM public.festival_artist_files remaining_file
  WHERE remaining_file.file_path = v_file.file_path;

  RETURN QUERY
  SELECT v_file.id, v_file.file_path, v_remaining_references = 0;
END;
$$;

COMMENT ON FUNCTION public.delete_festival_artist_file_reference(uuid, uuid) IS
  'Deletes one rider file metadata reference and reports whether the shared storage object has no remaining references.';

REVOKE ALL ON FUNCTION public.delete_festival_artist_file_reference(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_festival_artist_file_reference(uuid, uuid) TO authenticated, service_role;
