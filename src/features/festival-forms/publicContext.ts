import { normalizeWavesModelSelections } from "@/constants/wavesModels";
import { toProviderValue } from "@/features/festival-artists/model";
import { normalizeWirelessSystems } from "@/lib/wirelessSystemNormalizer";
import {
  asArray,
  asBoolean,
  asNumber,
  asString,
  hasConsoleSetups,
  hasPositiveNumber,
  hasText,
  normalizeConsoleSetups,
  normalizeTime,
  type ArtistFormState,
  type RiderFileRecord,
} from "@/components/festival/artistRequirementsFormModel";

type ArtistRecord = Record<string, unknown>;

const hasSystems = (value: unknown) =>
  asArray<Record<string, unknown>>(value).some(
    (system) =>
      hasText(system?.model) ||
      hasPositiveNumber(system?.quantity) ||
      hasPositiveNumber(system?.quantity_hh) ||
      hasPositiveNumber(system?.quantity_bp),
  );

const hasWiredMics = (value: unknown) =>
  asArray<Record<string, unknown>>(value).some((mic) => hasText(mic?.model) || hasPositiveNumber(mic?.quantity));

const INFRA_FLAGS = ["infra_cat6", "infra_hma", "infra_coax", "infra_opticalcon_duo"] as const;

/** Fields production already filled in: the artist sees them but cannot change them. */
export function computeLockedFields(artist: ArtistRecord): Set<string> {
  const locked = new Set<string>(["name", "stage", "date", "show_start", "show_end"]);

  if (hasText(artist.foh_console)) {
    locked.add("foh_console");
    locked.add("foh_console_provided_by");
  }
  if (hasText(artist.foh_drive)) locked.add("foh_drive");
  if (hasText(artist.foh_drive_position)) locked.add("foh_drive_position");
  if (hasConsoleSetups(artist.foh_consoles)) locked.add("foh_consoles");
  if (asArray(artist.foh_waves_models).length > 0 || hasText(artist.foh_outboard)) {
    locked.add("foh_waves_models");
    locked.add("foh_waves_provided_by");
  }
  if (asBoolean(artist.foh_tech)) locked.add("foh_tech");

  if (hasText(artist.mon_console)) {
    locked.add("mon_console");
    locked.add("mon_console_provided_by");
  }
  if (hasText(artist.mon_position)) locked.add("mon_position");
  if (hasConsoleSetups(artist.mon_consoles)) locked.add("mon_consoles");
  if (asBoolean(artist.monitors_from_foh)) locked.add("monitors_from_foh");
  if (asArray(artist.mon_waves_models).length > 0 || hasText(artist.mon_outboard)) {
    locked.add("mon_waves_models");
    locked.add("mon_waves_provided_by");
  }
  if (asBoolean(artist.mon_tech)) locked.add("mon_tech");

  if (hasSystems(artist.wireless_systems)) {
    locked.add("wireless_systems");
    locked.add("wireless_provided_by");
  }
  if (hasSystems(artist.iem_systems)) {
    locked.add("iem_systems");
    locked.add("iem_provided_by");
  }
  if (asBoolean(artist.monitors_enabled) || hasPositiveNumber(artist.monitors_quantity)) {
    locked.add("monitors_enabled");
    locked.add("monitors_quantity");
  }

  if (asBoolean(artist.extras_sf)) locked.add("extras_sf");
  if (asBoolean(artist.extras_df)) locked.add("extras_df");
  if (asBoolean(artist.extras_djbooth)) locked.add("extras_djbooth");
  if (hasText(artist.extras_wired)) locked.add("extras_wired");

  let hasInfrastructure = hasPositiveNumber(artist.infra_analog) || hasText(artist.other_infrastructure);
  for (const flag of INFRA_FLAGS) {
    const quantity = `${flag}_quantity`;
    if (asBoolean(artist[flag])) locked.add(flag);
    if (hasPositiveNumber(artist[quantity])) locked.add(quantity);
    hasInfrastructure ||= asBoolean(artist[flag]) || hasPositiveNumber(artist[quantity]);
  }
  if (hasPositiveNumber(artist.infra_analog)) locked.add("infra_analog");
  if (hasText(artist.other_infrastructure)) locked.add("other_infrastructure");
  if (hasInfrastructure) locked.add("infrastructure_provided_by");

  if (hasText(artist.notes)) locked.add("notes");
  if (asBoolean(artist.rider_missing)) locked.add("rider_missing");
  if (asBoolean(artist.isaftermidnight)) locked.add("isaftermidnight");

  const micKit = asString(artist.mic_kit);
  if (hasWiredMics(artist.wired_mics)) {
    locked.add("wired_mics");
    locked.add("mic_kit");
  } else if (micKit === "festival" || micKit === "mixed") {
    locked.add("mic_kit");
  }

  return locked;
}

/** The form state for the artist record the public-form RPC returned; `prev` supplies the fallbacks. */
export function artistToFormState(artist: ArtistRecord, prev: ArtistFormState): ArtistFormState {
  const fohConsoles = normalizeConsoleSetups(artist.foh_consoles);
  const monConsoles = normalizeConsoleSetups(artist.mon_consoles);
  const micKit = asString(artist.mic_kit);

  return {
    ...prev,
    max_stages: asNumber(artist.max_stages) || prev.max_stages || 1,
    name: asString(artist.name),
    stage: asNumber(artist.stage) || 1,
    date: asString(artist.date),
    show_start: normalizeTime(asString(artist.show_start)),
    show_end: normalizeTime(asString(artist.show_end)),
    soundcheck: asBoolean(artist.soundcheck),
    soundcheck_date: asString(artist.soundcheck_date) || asString(artist.date),
    soundcheck_start: normalizeTime(asString(artist.soundcheck_start)),
    soundcheck_end: normalizeTime(asString(artist.soundcheck_end)),
    line_check: asBoolean(artist.line_check),
    line_check_start: normalizeTime(asString(artist.line_check_start)),
    line_check_end: normalizeTime(asString(artist.line_check_end)),
    load_in_time: normalizeTime(asString(artist.load_in_time)),
    foh_console: asString(artist.foh_console),
    foh_consoles: fohConsoles.length > 0 ? fohConsoles : prev.foh_consoles,
    foh_console_provided_by: toProviderValue(artist.foh_console_provided_by),
    foh_drive: asString(artist.foh_drive),
    foh_drive_position: asString(artist.foh_drive_position),
    foh_tech: asBoolean(artist.foh_tech),
    foh_waves_models: normalizeWavesModelSelections(artist.foh_waves_models),
    foh_outboard: asString(artist.foh_outboard),
    foh_waves_provided_by: toProviderValue(artist.foh_waves_provided_by),
    mon_console: asString(artist.mon_console),
    mon_consoles: monConsoles.length > 0 ? monConsoles : prev.mon_consoles,
    mon_console_provided_by: toProviderValue(artist.mon_console_provided_by),
    mon_position: asString(artist.mon_position),
    monitors_from_foh: asBoolean(artist.monitors_from_foh),
    mon_waves_models: normalizeWavesModelSelections(artist.mon_waves_models),
    mon_outboard: asString(artist.mon_outboard),
    mon_waves_provided_by: toProviderValue(artist.mon_waves_provided_by),
    mon_tech: asBoolean(artist.mon_tech),
    wireless_systems: normalizeWirelessSystems(artist.wireless_systems, "wireless"),
    iem_systems: normalizeWirelessSystems(artist.iem_systems, "iem"),
    wireless_provided_by: toProviderValue(artist.wireless_provided_by),
    iem_provided_by: toProviderValue(artist.iem_provided_by),
    monitors_enabled: asBoolean(artist.monitors_enabled),
    monitors_quantity: asNumber(artist.monitors_quantity),
    extras_sf: asBoolean(artist.extras_sf),
    extras_df: asBoolean(artist.extras_df),
    extras_djbooth: asBoolean(artist.extras_djbooth),
    extras_wired: asString(artist.extras_wired),
    infra_cat6: asBoolean(artist.infra_cat6),
    infra_cat6_quantity: asNumber(artist.infra_cat6_quantity),
    infra_hma: asBoolean(artist.infra_hma),
    infra_hma_quantity: asNumber(artist.infra_hma_quantity),
    infra_coax: asBoolean(artist.infra_coax),
    infra_coax_quantity: asNumber(artist.infra_coax_quantity),
    infra_opticalcon_duo: asBoolean(artist.infra_opticalcon_duo),
    infra_opticalcon_duo_quantity: asNumber(artist.infra_opticalcon_duo_quantity),
    infra_analog: asNumber(artist.infra_analog),
    infrastructure_provided_by: toProviderValue(artist.infrastructure_provided_by),
    other_infrastructure: asString(artist.other_infrastructure),
    notes: asString(artist.notes),
    rider_missing: asBoolean(artist.rider_missing),
    isaftermidnight: asBoolean(artist.isaftermidnight),
    mic_kit: micKit === "festival" || micKit === "mixed" ? micKit : "band",
    wired_mics: asArray<Record<string, unknown>>(artist.wired_mics).map((mic) => ({
      model: asString(mic.model),
      quantity: asNumber(mic.quantity),
      exclusive_use: asBoolean(mic.exclusive_use),
      notes: asString(mic.notes),
    })),
  };
}

/** Rider files from the context RPC, dropping rows that cannot be opened (no id or path). */
export function parseRiderFiles(value: unknown): RiderFileRecord[] {
  return asArray<Record<string, unknown>>(value)
    .map((file) => ({
      id: asString(file.id),
      file_name: asString(file.file_name),
      file_path: asString(file.file_path),
      file_type: asString(file.file_type) || null,
      file_size: typeof file.file_size === "number" ? file.file_size : null,
      uploaded_at: asString(file.uploaded_at) || null,
      uploaded_by: asString(file.uploaded_by) || null,
      uploaded_by_name: asString(file.uploaded_by_name) || null,
    }))
    .filter((file) => file.id && file.file_path);
}

/** `{ number, name }` rows as a stage-number → name map, ignoring unnamed or non-numbered rows. */
export function stageNameMap(rows: ReadonlyArray<{ number?: unknown; name?: unknown }> | null | undefined) {
  const map: Record<number, string> = {};
  for (const row of rows ?? []) {
    if (typeof row.number === "number" && typeof row.name === "string" && row.name) map[row.number] = row.name;
  }
  return map;
}
