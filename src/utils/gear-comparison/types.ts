import { ConsoleSetup, WirelessSetup, WiredMicSetup } from "@/types/festival";

export interface GearMismatch {
  type: 'console' | 'wireless' | 'iem' | 'infrastructure' | 'extras' | 'monitors' | 'microphones';
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

export interface ArtistGearComparison {
  artistName: string;
  stage: number;
  mismatches: GearMismatch[];
  hasConflicts: boolean;
}

export interface EquipmentNeeds {
  consoles: {
    foh: Array<{ model: string; additionalQuantity: number; requiredBy: string[] }>;
    monitor: Array<{ model: string; additionalQuantity: number; requiredBy: string[] }>;
  };
  wireless: Array<{ model: string; additionalChannels: number; additionalHH: number; additionalBP: number; requiredBy: string[] }>;
  iem: Array<{ model: string; additionalChannels: number; additionalBP: number; requiredBy: string[] }>;
  microphones: Array<{ model: string; additionalQuantity: number; requiredBy: string[] }>;
  monitors: { additionalQuantity: number; requiredBy: string[] };
  infrastructure: {
    cat6: { additionalQuantity: number; requiredBy: string[] };
    hma: { additionalQuantity: number; requiredBy: string[] };
    coax: { additionalQuantity: number; requiredBy: string[] };
    opticalcon_duo: { additionalQuantity: number; requiredBy: string[] };
    analog: { additionalQuantity: number; requiredBy: string[] };
  };
  extras: {
    sideFills: { additionalStages: number; requiredBy: string[] };
    drumFills: { additionalStages: number; requiredBy: string[] };
    djBooths: { additionalStages: number; requiredBy: string[] };
  };
}

export interface ArtistRequirements {
  name: string;
  stage: number;
  foh_console: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_from_foh?: boolean;
  foh_waves_models?: string[];
  foh_outboard?: string;
  foh_waves_provided_by?: 'festival' | 'band' | 'mixed';
  mon_waves_models?: string[];
  mon_outboard?: string;
  mon_waves_provided_by?: 'festival' | 'band' | 'mixed';
  wireless_systems: WirelessSetup[];
  wireless_provided_by?: 'festival' | 'band' | 'mixed';
  iem_systems: WirelessSetup[];
  iem_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  infrastructure_provided_by?: 'festival' | 'band' | 'mixed';
  mic_kit?: 'festival' | 'band' | 'mixed';
  wired_mics?: WiredMicSetup[];
}

export interface AvailableGear {
  foh_consoles: ConsoleSetup[];
  mon_consoles: ConsoleSetup[];
  foh_waves_models?: string[];
  foh_outboard?: string | null;
  mon_waves_models?: string[];
  mon_outboard?: string | null;
  wireless_systems: WirelessSetup[];
  iem_systems: WirelessSetup[];
  wired_mics: WiredMicSetup[];
  available_monitors: number;
  has_side_fills: boolean;
  has_drum_fills: boolean;
  has_dj_booths: boolean;
  available_cat6_runs: number;
  available_hma_runs: number;
  available_coax_runs: number;
  available_opticalcon_duo_runs: number;
  available_analog_runs: number;
}
