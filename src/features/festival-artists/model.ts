import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { ProviderValue } from "@/types/festival-form";
import type { WavesModelSelection } from "@/constants/wavesModels";
import type { IEMSystem, WirelessSystem } from "@/types/festival-equipment";

/**
 * Single form model for the artist technical spec, shared by the desktop form, the mobile
 * form sheet and the mobile per-category editor. Before this module each editor hand-rolled
 * its own `createFormData` with divergent defaults (`show_start`, `rider_missing`).
 */

export type { ProviderValue };

// A `type` alias (not an interface) so it stays assignable to the generated `Json` column type.
export type WiredMicValue = {
  model: string;
  quantity: number;
  exclusive_use?: boolean;
  notes?: string;
};

export interface ArtistFormValues {
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_date: string;
  soundcheck_start: string;
  soundcheck_end: string;
  line_check: boolean;
  line_check_start: string;
  line_check_end: string;
  load_in_time: string;
  foh_console: string;
  foh_console_provided_by: ProviderValue;
  foh_drive: string;
  foh_drive_position: string;
  mon_console: string;
  mon_console_provided_by: ProviderValue;
  mon_position: string;
  monitors_from_foh: boolean;
  foh_waves_models: WavesModelSelection[];
  foh_outboard: string;
  foh_waves_provided_by: ProviderValue;
  mon_waves_models: WavesModelSelection[];
  mon_outboard: string;
  mon_waves_provided_by: ProviderValue;
  wireless_systems: WirelessSystem[];
  iem_systems: IEMSystem[];
  wireless_provided_by: ProviderValue;
  iem_provided_by: ProviderValue;
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  extras_wired: string;
  infra_cat6: boolean;
  infra_cat6_quantity: number;
  infra_hma: boolean;
  infra_hma_quantity: number;
  infra_coax: boolean;
  infra_coax_quantity: number;
  infra_opticalcon_duo: boolean;
  infra_opticalcon_duo_quantity: number;
  infra_analog: number;
  infrastructure_provided_by: ProviderValue;
  other_infrastructure: string;
  notes: string;
  foh_tech: boolean;
  mon_tech: boolean;
  rider_missing: boolean;
  isaftermidnight: boolean;
  mic_kit: ProviderValue;
  wired_mics: WiredMicValue[];
}

/** Defaults for one field that only differ between "new artist" and "existing row". */
export const NEW_ARTIST_DEFAULTS = {
  show_start: "20:00",
  show_end: "21:00",
  soundcheck_start: "18:00",
  soundcheck_end: "19:00",
  provided_by: "festival" as ProviderValue,
  /** A newly created artist has no rider yet; an existing row keeps what the DB says. */
  rider_missing: true,
} as const;

/** Rows come from PostgREST (nullable columns) or from the older `Artist` UI type. */
export type ArtistRowInput = object;

/** An existing artist handed to an editor: any row shape, but it must be identifiable. */
export type ArtistEditTarget = { id: string } & ArtistRowInput;

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value !== "" ? value : fallback;
const flag = (value: unknown): boolean => value === true;
const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
export const isProviderValue = (value: unknown): value is ProviderValue =>
  value === "festival" || value === "band" || value === "mixed";

/** Narrows a raw column or select value to a provider, defaulting to the festival. */
export const toProviderValue = (value: unknown): ProviderValue =>
  isProviderValue(value) ? value : NEW_ARTIST_DEFAULTS.provided_by;
const provider = toProviderValue;

/**
 * Builds the editor values from a `festival_artists` row (or from nothing, for a new artist).
 * Timing defaults apply to new *and* existing rows with no value, matching what the full
 * editors always did; `rider_missing` is `true` only for a brand new artist.
 */
export function toArtistFormValues(
  row: ArtistRowInput | null | undefined,
  options: { selectedDate?: string } = {},
): ArtistFormValues {
  const isNew = !row;
  // Columns are read one by one through the coercion helpers above, so an untyped view is safe.
  const r = (row ?? {}) as Record<string, unknown>;
  const date = text(r.date, options.selectedDate ?? "");
  const riderMissing = typeof r.rider_missing === "boolean" ? r.rider_missing : isNew;

  return {
    name: text(r.name),
    stage: count(r.stage) || 1,
    date,
    show_start: text(r.show_start, NEW_ARTIST_DEFAULTS.show_start),
    show_end: text(r.show_end, NEW_ARTIST_DEFAULTS.show_end),
    soundcheck: flag(r.soundcheck),
    soundcheck_date: text(r.soundcheck_date, date),
    soundcheck_start: text(r.soundcheck_start, NEW_ARTIST_DEFAULTS.soundcheck_start),
    soundcheck_end: text(r.soundcheck_end, NEW_ARTIST_DEFAULTS.soundcheck_end),
    line_check: flag(r.line_check),
    line_check_start: text(r.line_check_start),
    line_check_end: text(r.line_check_end),
    load_in_time: text(r.load_in_time),
    foh_console: text(r.foh_console),
    foh_console_provided_by: provider(r.foh_console_provided_by),
    foh_drive: text(r.foh_drive),
    foh_drive_position: text(r.foh_drive_position),
    mon_console: text(r.mon_console),
    mon_console_provided_by: provider(r.mon_console_provided_by),
    mon_position: text(r.mon_position),
    monitors_from_foh: flag(r.monitors_from_foh),
    foh_waves_models: list<WavesModelSelection>(r.foh_waves_models),
    foh_outboard: text(r.foh_outboard),
    foh_waves_provided_by: provider(r.foh_waves_provided_by),
    mon_waves_models: list<WavesModelSelection>(r.mon_waves_models),
    mon_outboard: text(r.mon_outboard),
    mon_waves_provided_by: provider(r.mon_waves_provided_by),
    wireless_systems: list<WirelessSystem>(r.wireless_systems),
    iem_systems: list<IEMSystem>(r.iem_systems),
    wireless_provided_by: provider(r.wireless_provided_by),
    iem_provided_by: provider(r.iem_provided_by),
    monitors_enabled: flag(r.monitors_enabled),
    monitors_quantity: count(r.monitors_quantity),
    extras_sf: flag(r.extras_sf),
    extras_df: flag(r.extras_df),
    extras_djbooth: flag(r.extras_djbooth),
    extras_wired: text(r.extras_wired),
    infra_cat6: flag(r.infra_cat6),
    infra_cat6_quantity: count(r.infra_cat6_quantity),
    infra_hma: flag(r.infra_hma),
    infra_hma_quantity: count(r.infra_hma_quantity),
    infra_coax: flag(r.infra_coax),
    infra_coax_quantity: count(r.infra_coax_quantity),
    infra_opticalcon_duo: flag(r.infra_opticalcon_duo),
    infra_opticalcon_duo_quantity: count(r.infra_opticalcon_duo_quantity),
    infra_analog: count(r.infra_analog),
    infrastructure_provided_by: provider(r.infrastructure_provided_by),
    other_infrastructure: text(r.other_infrastructure),
    notes: text(r.notes),
    foh_tech: flag(r.foh_tech),
    mon_tech: flag(r.mon_tech),
    rider_missing: riderMissing,
    isaftermidnight: flag(r.isaftermidnight),
    mic_kit: isProviderValue(r.mic_kit) ? r.mic_kit : "festival",
    wired_mics: list<WiredMicValue>(r.wired_mics),
  };
}

/** Validation shared by every editor that creates or renames an artist. */
export const artistFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre del artista es obligatorio"),
  stage: z.number().int().min(1),
  date: z.string().min(1, "La fecha es obligatoria"),
});

/** Fields each mobile category editor is allowed to write. Keeps saves partial. */
export const ARTIST_CATEGORY_FIELDS = {
  consoles: [
    "foh_console",
    "foh_console_provided_by",
    "foh_drive",
    "foh_drive_position",
    "mon_console",
    "mon_console_provided_by",
    "mon_position",
    "monitors_from_foh",
    "foh_waves_models",
    "foh_outboard",
    "foh_waves_provided_by",
    "mon_waves_models",
    "mon_outboard",
    "mon_waves_provided_by",
    "foh_tech",
    "mon_tech",
  ],
  wireless: ["wireless_systems", "wireless_provided_by", "iem_systems", "iem_provided_by"],
  microphones: ["mic_kit", "wired_mics"],
  monitors: [
    "monitors_enabled",
    "monitors_quantity",
    "extras_sf",
    "extras_df",
    "extras_djbooth",
    "extras_wired",
  ],
  infrastructure: [
    "infra_cat6",
    "infra_cat6_quantity",
    "infra_hma",
    "infra_hma_quantity",
    "infra_coax",
    "infra_coax_quantity",
    "infra_opticalcon_duo",
    "infra_opticalcon_duo_quantity",
    "infra_analog",
    "infrastructure_provided_by",
    "other_infrastructure",
  ],
  notes: ["notes"],
} as const satisfies Record<string, readonly (keyof ArtistFormValues)[]>;

export type ArtistEditCategory = keyof typeof ARTIST_CATEGORY_FIELDS;

/** Optional text columns are stored as NULL rather than an empty string. */
const NULLABLE_TEXT_FIELDS: ReadonlySet<keyof ArtistFormValues> = new Set([
  "foh_drive",
  "foh_drive_position",
  "mon_position",
  "foh_outboard",
  "mon_outboard",
  "extras_wired",
  "other_infrastructure",
  "notes",
]);

/** Database patch for one category of the form, with empty optional text as NULL. */
export function toArtistCategoryPatch(
  values: ArtistFormValues,
  category: ArtistEditCategory,
): TablesUpdate<"festival_artists"> {
  const patch: Partial<Record<keyof ArtistFormValues, unknown>> = {};
  for (const field of ARTIST_CATEGORY_FIELDS[category] as readonly (keyof ArtistFormValues)[]) {
    const value = values[field];
    patch[field] = NULLABLE_TEXT_FIELDS.has(field) && value === "" ? null : value;
  }
  // Every field listed in ARTIST_CATEGORY_FIELDS is a `festival_artists` column of the same type.
  return patch as TablesUpdate<"festival_artists">;
}
