import type { ConsoleSetup, FestivalGearSetup } from "@/types/festival";
import type { ArtistSectionProps } from "@/types/artist-form";
import { normalizeWirelessSystem } from "@/lib/wirelessSystemNormalizer";
import type { PublicRiderFileRecord } from "@/utils/publicArtistRiderUpload";

export interface ArtistRequirementsFormProps {
  isBlank?: boolean;
}
export interface PublicFormContextResponse {
  ok: boolean;
  error?: string;
  status?: string;
  artist?: Record<string, unknown>;
  gear_setup?: FestivalGearSetup | null;
  logo_file_path?: string | null;
  stage_names?: Array<{ number?: number; name?: string }>;
  rider_files?: Array<Record<string, unknown>>;
}

export interface PublicSubmitResponse {
  ok: boolean;
  error?: string;
  status?: string;
}

export type ArtistFormState = ArtistSectionProps["formData"];
export type RiderFileRecord = PublicRiderFileRecord;

export const makeBlankWirelessSystem = () =>
  normalizeWirelessSystem(
    {
      model: "",
      quantity: 0,
      quantity_ch: 0,
      quantity_hh: 0,
      quantity_bp: 0,
      band: undefined,
      provided_by: "festival",
    },
    "wireless",
  );

export const makeBlankIemSystem = () =>
  normalizeWirelessSystem(
    {
      model: "",
      quantity: 0,
      quantity_hh: 0,
      quantity_bp: 0,
      band: undefined,
      provided_by: "festival",
    },
    "iem",
  );

export const normalizeTime = (value: string | null | undefined) => {
  if (!value) return "";
  return value.length >= 5 ? value.slice(0, 5) : value;
};

export const asString = (value: unknown) => (typeof value === "string" ? value : "");
export const asBoolean = (value: unknown) => (typeof value === "boolean" ? value : false);
export const asNumber = (value: unknown) => (typeof value === "number" ? value : 0);
export const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
export const hasText = (value: unknown) => asString(value).trim().length > 0;
export const hasPositiveNumber = (value: unknown) => asNumber(value) > 0;

export const asFiniteNumber = (value: unknown) => {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numeric) ? numeric : 0;
};

export const normalizeConsoleSetups = (value: unknown): ConsoleSetup[] =>
  asArray<Record<string, unknown>>(value)
    .map((consoleSetup) => ({
      model: asString(consoleSetup.model),
      quantity: asFiniteNumber(consoleSetup.quantity),
      notes: asString(consoleSetup.notes) || undefined,
    }))
    .filter((consoleSetup) =>
      consoleSetup.model.trim().length > 0 ||
      consoleSetup.quantity > 0 ||
      Boolean(consoleSetup.notes?.trim())
    );

export const hasConsoleSetups = (value: unknown) => normalizeConsoleSetups(value).length > 0;

export const normalizeFestivalLogoPath = (filePath: string) => {
  let normalized = filePath.trim();
  if (!normalized) return "";
  if (normalized.startsWith("http")) return normalized;
  if (normalized.startsWith("/")) normalized = normalized.slice(1);
  if (normalized.startsWith("festival-logos/")) {
    normalized = normalized.slice("festival-logos/".length);
  }
  return normalized;
};

export const createInitialFormData = (isBlank: boolean, blankDate = ""): ArtistFormState => ({
  name: "",
  max_stages: 1,
  stage: 1,
  date: blankDate,
  show_start: "",
  show_end: "",
  soundcheck: false,
  soundcheck_start: "",
  soundcheck_end: "",
  line_check: false,
  line_check_start: "",
  line_check_end: "",
  load_in_time: "",
  foh_console: "",
  foh_consoles: [],
  foh_console_provided_by: "festival",
  foh_drive: "",
  foh_drive_position: "",
  foh_tech: false,
  mon_console: "",
  mon_consoles: [],
  mon_console_provided_by: "festival",
  mon_position: "",
  monitors_from_foh: false,
  foh_waves_models: [],
  foh_outboard: "",
  foh_waves_provided_by: "festival",
  mon_waves_models: [],
  mon_outboard: "",
  mon_waves_provided_by: "festival",
  mon_tech: false,
  wireless_systems: isBlank ? [makeBlankWirelessSystem()] : [],
  iem_systems: isBlank ? [makeBlankIemSystem()] : [],
  wireless_provided_by: "festival",
  iem_provided_by: "festival",
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
  infrastructure_provided_by: "festival",
  other_infrastructure: "",
  notes: "",
  rider_missing: false,
  isaftermidnight: false,
  mic_kit: "band",
  wired_mics: [],
});
