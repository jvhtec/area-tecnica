import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ArtistSectionFormData } from "@/types/artist-form";
import type { GearSetupFormData } from "@/types/festival-gear";
import { normalizeWirelessSystems } from "@/lib/wirelessSystemNormalizer";
import { normalizeWavesModelSelections } from "@/constants/wavesModels";
import { asConsolePositionArray, asFohDriveArray, asMonConsolePositionArray } from "@/constants/consoleDrive";

/**
 * Form model of the festival gear setup screen. Stage 1 edits the festival-wide row
 * (`festival_gear_setups`, which stores availability as `available_*` columns); every other stage
 * edits its own override row (`festival_stage_gear_setups`, which mirrors the form 1:1).
 */

type GlobalRow = Tables<"festival_gear_setups">;
type StageRow = Tables<"festival_stage_gear_setups">;

const jsonArrayOrEmpty = <T>(value: Json | null | undefined): T[] =>
  Array.isArray(value) ? (value as unknown as T[]) : [];

export const buildEmptyGearFormData = (maxStages = 1): GearSetupFormData => ({
  max_stages: maxStages,
  foh_consoles: [],
  mon_consoles: [],
  foh_drive_options: [],
  foh_drive_positions: [],
  mon_positions: [],
  foh_waves_models: [],
  foh_outboard: "",
  mon_waves_models: [],
  mon_outboard: "",
  wireless_systems: [],
  iem_systems: [],
  wired_mics: [],
  monitors_enabled: false,
  monitors_quantity: 0,
  extras_sf: false,
  extras_df: false,
  extras_djbooth: false,
  extras_wired: "",
  infra_cat6: false,
  infra_cat6_quantity: 0,
  infra_hma: false,
  infra_hma_quantity: 0,
  infra_coax: false,
  infra_coax_quantity: 0,
  infra_opticalcon_duo: false,
  infra_opticalcon_duo_quantity: 0,
  infra_analog: 0,
  other_infrastructure: "",
  notes: "",
});

/** Columns both tables store identically. */
const sharedFields = (row: GlobalRow | StageRow) => ({
  foh_consoles: jsonArrayOrEmpty<GearSetupFormData["foh_consoles"][number]>(row.foh_consoles),
  mon_consoles: jsonArrayOrEmpty<GearSetupFormData["mon_consoles"][number]>(row.mon_consoles),
  foh_drive_options: asFohDriveArray(row.foh_drive_options),
  foh_drive_positions: asConsolePositionArray(row.foh_drive_positions),
  mon_positions: asMonConsolePositionArray(row.mon_positions),
  foh_waves_models: normalizeWavesModelSelections(row.foh_waves_models),
  foh_outboard: row.foh_outboard || "",
  mon_waves_models: normalizeWavesModelSelections(row.mon_waves_models),
  mon_outboard: row.mon_outboard || "",
  wireless_systems: normalizeWirelessSystems(row.wireless_systems, "wireless"),
  iem_systems: normalizeWirelessSystems(row.iem_systems, "iem"),
  wired_mics: jsonArrayOrEmpty<GearSetupFormData["wired_mics"][number]>(row.wired_mics),
  extras_wired: row.extras_wired || "",
  other_infrastructure: row.other_infrastructure || "",
  notes: row.notes || "",
});

/** Form values of the festival-wide (stage 1) setup. */
export function globalRowToFormData(row: GlobalRow): GearSetupFormData {
  return {
    ...sharedFields(row),
    max_stages: row.max_stages || 1,
    monitors_enabled: (row.available_monitors ?? 0) > 0,
    monitors_quantity: row.available_monitors || 0,
    extras_sf: row.has_side_fills || false,
    extras_df: row.has_drum_fills || false,
    extras_djbooth: row.has_dj_booths || false,
    infra_cat6: (row.available_cat6_runs ?? 0) > 0,
    infra_cat6_quantity: row.available_cat6_runs || 0,
    infra_hma: (row.available_hma_runs ?? 0) > 0,
    infra_hma_quantity: row.available_hma_runs || 0,
    infra_coax: (row.available_coax_runs ?? 0) > 0,
    infra_coax_quantity: row.available_coax_runs || 0,
    infra_opticalcon_duo: (row.available_opticalcon_duo_runs ?? 0) > 0,
    infra_opticalcon_duo_quantity: row.available_opticalcon_duo_runs || 0,
    infra_analog: row.available_analog_runs || 0,
  };
}

/** Form values of one stage's override. `maxStages` comes from the festival-wide setup. */
export function stageRowToFormData(row: StageRow, maxStages: number): GearSetupFormData {
  return {
    ...sharedFields(row),
    max_stages: maxStages || 1,
    monitors_enabled: row.monitors_enabled || false,
    monitors_quantity: row.monitors_quantity || 0,
    extras_sf: row.extras_sf || false,
    extras_df: row.extras_df || false,
    extras_djbooth: row.extras_djbooth || false,
    infra_cat6: row.infra_cat6 || false,
    infra_cat6_quantity: row.infra_cat6_quantity || 0,
    infra_hma: row.infra_hma || false,
    infra_hma_quantity: row.infra_hma_quantity || 0,
    infra_coax: row.infra_coax || false,
    infra_coax_quantity: row.infra_coax_quantity || 0,
    infra_opticalcon_duo: row.infra_opticalcon_duo || false,
    infra_opticalcon_duo_quantity: row.infra_opticalcon_duo_quantity || 0,
    infra_analog: row.infra_analog || 0,
  };
}

const toJson = (value: unknown): Json => value as Json;

/** Columns both save paths write with the same shape. */
const sharedPayload = (setup: GearSetupFormData) => ({
  foh_consoles: toJson(setup.foh_consoles),
  mon_consoles: toJson(setup.mon_consoles),
  foh_drive_options: setup.foh_drive_options ?? [],
  foh_drive_positions: setup.foh_drive_positions ?? [],
  mon_positions: setup.mon_positions ?? [],
  foh_waves_models: toJson(setup.foh_waves_models),
  foh_outboard: setup.foh_outboard,
  mon_waves_models: toJson(setup.mon_waves_models),
  mon_outboard: setup.mon_outboard,
  wireless_systems: toJson(setup.wireless_systems),
  iem_systems: toJson(setup.iem_systems),
  wired_mics: toJson(Array.isArray(setup.wired_mics) ? setup.wired_mics : []),
  extras_wired: setup.extras_wired,
  other_infrastructure: setup.other_infrastructure,
  notes: setup.notes,
});

/** Upsert payload for the festival-wide row; a disabled toggle stores 0 available. */
export function toGlobalGearPayload(
  setup: GearSetupFormData,
  jobId: string,
  id?: string | null,
): TablesInsert<"festival_gear_setups"> {
  return {
    ...(id ? { id } : {}),
    job_id: jobId,
    max_stages: setup.max_stages,
    ...sharedPayload(setup),
    has_side_fills: setup.extras_sf,
    has_drum_fills: setup.extras_df,
    has_dj_booths: setup.extras_djbooth,
    available_monitors: setup.monitors_enabled ? setup.monitors_quantity : 0,
    available_cat6_runs: setup.infra_cat6 ? setup.infra_cat6_quantity : 0,
    available_hma_runs: setup.infra_hma ? setup.infra_hma_quantity : 0,
    available_coax_runs: setup.infra_coax ? setup.infra_coax_quantity : 0,
    available_opticalcon_duo_runs: setup.infra_opticalcon_duo ? setup.infra_opticalcon_duo_quantity : 0,
    available_analog_runs: setup.infra_analog,
  };
}

/** JSON payload of `save_festival_stage_gear_setup`. */
export function toStageGearPayload(setup: GearSetupFormData): Json {
  return {
    ...sharedPayload(setup),
    monitors_enabled: setup.monitors_enabled,
    monitors_quantity: setup.monitors_quantity,
    extras_sf: setup.extras_sf,
    extras_df: setup.extras_df,
    extras_djbooth: setup.extras_djbooth,
    infra_cat6: setup.infra_cat6,
    infra_cat6_quantity: setup.infra_cat6_quantity,
    infra_hma: setup.infra_hma,
    infra_hma_quantity: setup.infra_hma_quantity,
    infra_coax: setup.infra_coax,
    infra_coax_quantity: setup.infra_coax_quantity,
    infra_opticalcon_duo: setup.infra_opticalcon_duo,
    infra_opticalcon_duo_quantity: setup.infra_opticalcon_duo_quantity,
    infra_analog: setup.infra_analog,
  } as Json;
}

/**
 * The shared artist/gear sections read artist-shaped data. A gear setup has no artist, so the
 * artist-only fields are neutral; only what the gear sections actually edit comes from `setup`.
 */
export function toSectionFormData(setup: GearSetupFormData, stageNumber: number): ArtistSectionFormData {
  return {
    ...setup,
    name: "",
    stage: stageNumber,
    date: "",
    show_start: "",
    show_end: "",
    soundcheck: false,
    line_check: false,
    foh_console: "",
    foh_console_provided_by: "festival",
    mon_console: "",
    mon_console_provided_by: "festival",
    monitors_from_foh: false,
    foh_waves_models: [],
    foh_outboard: "",
    foh_waves_provided_by: "festival",
    mon_waves_models: [],
    mon_outboard: "",
    mon_waves_provided_by: "festival",
    wireless_provided_by: "festival",
    iem_provided_by: "festival",
    infrastructure_provided_by: "festival",
    foh_tech: false,
    mon_tech: false,
    rider_missing: false,
    isaftermidnight: false,
    mic_kit: "band",
    wired_mics: [],
  };
}
