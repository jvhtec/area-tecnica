import type { Tables } from "@/integrations/supabase/types";
import { normalizeWirelessSystems } from "@/lib/wirelessSystemNormalizer";
import type { ConsoleSetup, FestivalGearSetup, StageGearSetup, WiredMicSetup } from "@/types/festival";
import { normalizeWavesModelSelections } from "@/constants/wavesModels";
import { asFohDriveArray, asConsolePositionArray, asMonConsolePositionArray } from "@/constants/consoleDrive";

type FestivalGearSetupRow = Tables<"festival_gear_setups">;
type StageGearSetupRow = Tables<"festival_stage_gear_setups">;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

const mapConsoleSetups = (value: unknown): ConsoleSetup[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item): ConsoleSetup => {
    const record = asRecord(item);
    return {
      model: toString(record?.model),
      quantity: toNumber(record?.quantity),
      notes: typeof record?.notes === "string" ? record.notes : undefined,
    };
  });
};

const mapWiredMics = (value: unknown): WiredMicSetup[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item): WiredMicSetup => {
    const record = asRecord(item);
    return {
      model: toString(record?.model),
      quantity: toNumber(record?.quantity),
      exclusive_use: typeof record?.exclusive_use === "boolean" ? record.exclusive_use : undefined,
      notes: typeof record?.notes === "string" ? record.notes : undefined,
    };
  });
};

export function mapFestivalGearSetup(row: FestivalGearSetupRow | null | undefined): FestivalGearSetup | null {
  if (!row) return null;

  return {
    id: row.id,
    job_id: row.job_id ?? "",
    max_stages: row.max_stages ?? 3,
    foh_consoles: mapConsoleSetups(row.foh_consoles),
    mon_consoles: mapConsoleSetups(row.mon_consoles),
    foh_drive_options: asFohDriveArray(row.foh_drive_options),
    foh_drive_positions: asConsolePositionArray(row.foh_drive_positions),
    mon_positions: asMonConsolePositionArray(row.mon_positions),
    foh_waves_models: normalizeWavesModelSelections(row.foh_waves_models),
    foh_outboard: row.foh_outboard,
    mon_waves_models: normalizeWavesModelSelections(row.mon_waves_models),
    mon_outboard: row.mon_outboard,
    wireless_systems: normalizeWirelessSystems(row.wireless_systems, "wireless"),
    iem_systems: normalizeWirelessSystems(row.iem_systems, "iem"),
    wired_mics: mapWiredMics(row.wired_mics),
    available_monitors: row.available_monitors ?? 0,
    has_side_fills: Boolean(row.has_side_fills),
    has_drum_fills: Boolean(row.has_drum_fills),
    has_dj_booths: Boolean(row.has_dj_booths),
    available_cat6_runs: row.available_cat6_runs ?? 0,
    available_hma_runs: row.available_hma_runs ?? 0,
    available_coax_runs: row.available_coax_runs ?? 0,
    available_analog_runs: row.available_analog_runs ?? 0,
    available_opticalcon_duo_runs: row.available_opticalcon_duo_runs ?? 0,
    notes: row.notes ?? undefined,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

export function mapStageGearSetup(row: StageGearSetupRow | null | undefined): StageGearSetup | null {
  if (!row) return null;

  return {
    id: row.id,
    gear_setup_id: row.gear_setup_id,
    stage_number: row.stage_number,
    foh_consoles: mapConsoleSetups(row.foh_consoles),
    mon_consoles: mapConsoleSetups(row.mon_consoles),
    foh_drive_options: asFohDriveArray(row.foh_drive_options),
    foh_drive_positions: asConsolePositionArray(row.foh_drive_positions),
    mon_positions: asMonConsolePositionArray(row.mon_positions),
    foh_waves_models: normalizeWavesModelSelections(row.foh_waves_models),
    foh_outboard: row.foh_outboard,
    mon_waves_models: normalizeWavesModelSelections(row.mon_waves_models),
    mon_outboard: row.mon_outboard,
    wireless_systems: normalizeWirelessSystems(row.wireless_systems, "wireless"),
    iem_systems: normalizeWirelessSystems(row.iem_systems, "iem"),
    wired_mics: mapWiredMics(row.wired_mics),
    monitors_enabled: Boolean(row.monitors_enabled),
    monitors_quantity: row.monitors_quantity ?? 0,
    extras_sf: Boolean(row.extras_sf),
    extras_df: Boolean(row.extras_df),
    extras_djbooth: Boolean(row.extras_djbooth),
    extras_wired: row.extras_wired,
    infra_cat6: Boolean(row.infra_cat6),
    infra_cat6_quantity: row.infra_cat6_quantity ?? 0,
    infra_hma: Boolean(row.infra_hma),
    infra_hma_quantity: row.infra_hma_quantity ?? 0,
    infra_coax: Boolean(row.infra_coax),
    infra_coax_quantity: row.infra_coax_quantity ?? 0,
    infra_opticalcon_duo: Boolean(row.infra_opticalcon_duo),
    infra_opticalcon_duo_quantity: row.infra_opticalcon_duo_quantity ?? 0,
    infra_analog: row.infra_analog ?? 0,
    other_infrastructure: row.other_infrastructure,
    notes: row.notes,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

export function mapStageGearSetups(rows: StageGearSetupRow[] | null | undefined): Record<number, StageGearSetup> {
  return (rows ?? []).reduce<Record<number, StageGearSetup>>((acc, row) => {
    const setup = mapStageGearSetup(row);
    if (setup) acc[setup.stage_number] = setup;
    return acc;
  }, {});
}
