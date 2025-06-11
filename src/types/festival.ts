export interface ConsoleSetup {
  model: string;
  quantity: number;
  notes?: string;
}

export interface WirelessSetup {
  model: string;
  quantity?: number; // Make quantity optional since we're using quantity_hh/quantity_bp instead
  quantity_hh?: number;
  quantity_bp?: number;
  band?: string;
  notes?: string;
  provided_by?: 'festival' | 'band';
}

export interface FestivalGearSetup {
  id: string;
  job_id: string;
  date: string;
  max_stages: number;
  foh_consoles: ConsoleSetup[];
  mon_consoles: ConsoleSetup[];
  wireless_systems: WirelessSetup[];
  iem_systems: WirelessSetup[];
  available_monitors: number;
  has_side_fills: boolean;
  has_drum_fills: boolean;
  has_dj_booths: boolean;
  available_cat6_runs: number;
  available_hma_runs: number;
  available_coax_runs: number;
  available_analog_runs: number;
  available_opticalcon_duo_runs: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type ProviderType = 'festival' | 'band';

export interface ArtistFormData {
  readonly name: string;
  readonly stage: number;
  readonly date: string;
  readonly show_start: string;
  readonly show_end: string;
  readonly soundcheck: boolean;
  readonly soundcheck_start?: string;
  readonly soundcheck_end?: string;
  foh_console: string;
  foh_console_provided_by: ProviderType;
  mon_console: string;
  mon_console_provided_by: ProviderType;
  wireless_systems: WirelessSetup[];
  iem_systems: WirelessSetup[];
  wireless_provided_by: ProviderType;
  iem_provided_by: ProviderType;
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
  infrastructure_provided_by: ProviderType;
  other_infrastructure: string;
  notes: string;
  isaftermidnight?: boolean;
  foh_tech?: boolean;
  mon_tech?: boolean;
  rider_missing?: boolean;
}

export interface FestivalSettings {
  id: string;
  job_id: string;
  day_start_time: string; // Format: "07:00"
  created_at?: string;
  updated_at?: string;
}

export interface StageGearSetup {
  id: string;
  gear_setup_id: string;
  stage_number: number;
  foh_consoles: ConsoleSetup[];
  mon_consoles: ConsoleSetup[];
  wireless_systems: WirelessSetup[];
  iem_systems: WirelessSetup[];
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  extras_wired: string | null;
  infra_cat6: boolean;
  infra_cat6_quantity: number;
  infra_hma: boolean;
  infra_hma_quantity: number;
  infra_coax: boolean;
  infra_coax_quantity: number;
  infra_opticalcon_duo: boolean;
  infra_opticalcon_duo_quantity: number;
  infra_analog: number;
  other_infrastructure: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CombinedGearSetup {
  globalSetup: FestivalGearSetup | null;
  stageSetup: StageGearSetup | null;
}
