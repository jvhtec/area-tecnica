-- FEST-DATA-03 / FEST-DATA-04 (festival roadmap phase 2.3).
--
-- The gear screens did their multi-row writes from the browser:
--   * adding a stage upserted the global setup, then INSERTed the missing
--     festival_stages rows on the next *read* (a read-only viewer silently
--     failed to create them);
--   * saving a non-primary stage was three separate statements (create the
--     global setup, bump max_stages, upsert the stage row), so a failure in
--     the middle left a half-written festival.
-- Both become one transaction each. Both are SECURITY INVOKER: the existing
-- row-level policies on the three tables still decide who may write.

CREATE OR REPLACE FUNCTION public.set_festival_max_stages(
  p_job_id uuid,
  p_max_stages integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_job_id IS NULL OR p_max_stages IS NULL OR p_max_stages < 1 OR p_max_stages > 50 THEN
    RAISE EXCEPTION 'festival_max_stages_invalid'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.festival_gear_setups (job_id, max_stages)
  VALUES (p_job_id, p_max_stages)
  ON CONFLICT (job_id) DO UPDATE
    SET max_stages = EXCLUDED.max_stages;

  -- Never overwrite a stage that already has a (possibly renamed) row.
  INSERT INTO public.festival_stages (job_id, number, name)
  SELECT p_job_id, stage_number, 'Stage ' || stage_number
  FROM generate_series(1, p_max_stages) AS stage_number
  ON CONFLICT (job_id, number) DO NOTHING;

  RETURN p_max_stages;
END;
$$;

REVOKE ALL ON FUNCTION public.set_festival_max_stages(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_festival_max_stages(uuid, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.set_festival_max_stages(uuid, integer) IS
  'Sets the number of stages of a festival and creates the missing named stage rows in one transaction.';

CREATE OR REPLACE FUNCTION public.save_festival_stage_gear_setup(
  p_job_id uuid,
  p_stage_number integer,
  p_payload jsonb
)
RETURNS TABLE (
  gear_setup_id uuid,
  stage_setup_id uuid,
  max_stages integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
-- The RETURNS TABLE columns share their names with table columns used below.
#variable_conflict use_column
DECLARE
  v_gear_setup_id uuid;
  v_max_stages integer;
  v_stage_setup_id uuid;
  v_row public.festival_stage_gear_setups%ROWTYPE;
BEGIN
  -- Stage 1 is the festival-wide setup itself, not a per-stage override.
  IF p_job_id IS NULL OR p_stage_number IS NULL OR p_stage_number < 2 OR p_stage_number > 50 THEN
    RAISE EXCEPTION 'festival_stage_gear_setup_invalid_stage'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'festival_stage_gear_setup_invalid_payload'
      USING ERRCODE = '22023';
  END IF;

  -- Make sure the global setup exists and covers this stage.
  INSERT INTO public.festival_gear_setups AS setup (job_id, max_stages)
  VALUES (p_job_id, p_stage_number)
  ON CONFLICT (job_id) DO UPDATE
    SET max_stages = greatest(coalesce(setup.max_stages, 1), EXCLUDED.max_stages)
  RETURNING setup.id, setup.max_stages
  INTO v_gear_setup_id, v_max_stages;

  -- Keys that are not columns are ignored; identity columns are never taken from the payload.
  v_row := jsonb_populate_record(NULL::public.festival_stage_gear_setups, p_payload);

  INSERT INTO public.festival_stage_gear_setups AS stage_setup (
    gear_setup_id,
    stage_number,
    foh_consoles,
    mon_consoles,
    foh_drive_options,
    foh_drive_positions,
    mon_positions,
    foh_waves_models,
    foh_outboard,
    mon_waves_models,
    mon_outboard,
    wireless_systems,
    iem_systems,
    wired_mics,
    monitors_enabled,
    monitors_quantity,
    extras_sf,
    extras_df,
    extras_djbooth,
    extras_wired,
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
    notes
  )
  VALUES (
    v_gear_setup_id,
    p_stage_number,
    coalesce(v_row.foh_consoles, '[]'::jsonb),
    coalesce(v_row.mon_consoles, '[]'::jsonb),
    coalesce(v_row.foh_drive_options, '{}'::text[]),
    coalesce(v_row.foh_drive_positions, '{}'::text[]),
    coalesce(v_row.mon_positions, '{}'::text[]),
    coalesce(v_row.foh_waves_models, '[]'::jsonb),
    v_row.foh_outboard,
    coalesce(v_row.mon_waves_models, '[]'::jsonb),
    v_row.mon_outboard,
    coalesce(v_row.wireless_systems, '[]'::jsonb),
    coalesce(v_row.iem_systems, '[]'::jsonb),
    coalesce(v_row.wired_mics, '[]'::jsonb),
    coalesce(v_row.monitors_enabled, false),
    coalesce(v_row.monitors_quantity, 0),
    coalesce(v_row.extras_sf, false),
    coalesce(v_row.extras_df, false),
    coalesce(v_row.extras_djbooth, false),
    v_row.extras_wired,
    coalesce(v_row.infra_cat6, false),
    coalesce(v_row.infra_cat6_quantity, 0),
    coalesce(v_row.infra_hma, false),
    coalesce(v_row.infra_hma_quantity, 0),
    coalesce(v_row.infra_coax, false),
    coalesce(v_row.infra_coax_quantity, 0),
    coalesce(v_row.infra_opticalcon_duo, false),
    coalesce(v_row.infra_opticalcon_duo_quantity, 0),
    coalesce(v_row.infra_analog, 0),
    v_row.other_infrastructure,
    v_row.notes
  )
  ON CONFLICT (gear_setup_id, stage_number) DO UPDATE SET
    foh_consoles = EXCLUDED.foh_consoles,
    mon_consoles = EXCLUDED.mon_consoles,
    foh_drive_options = EXCLUDED.foh_drive_options,
    foh_drive_positions = EXCLUDED.foh_drive_positions,
    mon_positions = EXCLUDED.mon_positions,
    foh_waves_models = EXCLUDED.foh_waves_models,
    foh_outboard = EXCLUDED.foh_outboard,
    mon_waves_models = EXCLUDED.mon_waves_models,
    mon_outboard = EXCLUDED.mon_outboard,
    wireless_systems = EXCLUDED.wireless_systems,
    iem_systems = EXCLUDED.iem_systems,
    wired_mics = EXCLUDED.wired_mics,
    monitors_enabled = EXCLUDED.monitors_enabled,
    monitors_quantity = EXCLUDED.monitors_quantity,
    extras_sf = EXCLUDED.extras_sf,
    extras_df = EXCLUDED.extras_df,
    extras_djbooth = EXCLUDED.extras_djbooth,
    extras_wired = EXCLUDED.extras_wired,
    infra_cat6 = EXCLUDED.infra_cat6,
    infra_cat6_quantity = EXCLUDED.infra_cat6_quantity,
    infra_hma = EXCLUDED.infra_hma,
    infra_hma_quantity = EXCLUDED.infra_hma_quantity,
    infra_coax = EXCLUDED.infra_coax,
    infra_coax_quantity = EXCLUDED.infra_coax_quantity,
    infra_opticalcon_duo = EXCLUDED.infra_opticalcon_duo,
    infra_opticalcon_duo_quantity = EXCLUDED.infra_opticalcon_duo_quantity,
    infra_analog = EXCLUDED.infra_analog,
    other_infrastructure = EXCLUDED.other_infrastructure,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING stage_setup.id INTO v_stage_setup_id;

  RETURN QUERY SELECT v_gear_setup_id, v_stage_setup_id, v_max_stages;
END;
$$;

REVOKE ALL ON FUNCTION public.save_festival_stage_gear_setup(uuid, integer, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_festival_stage_gear_setup(uuid, integer, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.save_festival_stage_gear_setup(uuid, integer, jsonb) IS
  'Saves one non-primary stage gear setup, creating or widening the global setup, in one transaction.';
