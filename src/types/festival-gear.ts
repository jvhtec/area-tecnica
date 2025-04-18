
import { ConsoleSetup, WirelessSetup } from "./festival";

export interface GearSetupFormData {
  max_stages: number;
  foh_console: string;
  mon_console: string;
  wireless_model: string;
  wireless_quantity_hh: number;
  wireless_quantity_bp: number;
  wireless_band: string;
  iem_model: string;
  iem_quantity: number;
  iem_band: string;
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
  other_infrastructure: string;
  notes: string;
}

export interface StageEquipmentConfigProps {
  data: Pick<GearSetupFormData,
    'monitors_enabled' |
    'monitors_quantity' |
    'extras_sf' |
    'extras_df' |
    'extras_djbooth' |
    'extras_wired'
  >;
  onChange: (changes: Partial<GearSetupFormData>) => void;
}

export interface InfrastructureConfigProps {
  data: Pick<GearSetupFormData,
    'infra_cat6' |
    'infra_cat6_quantity' |
    'infra_hma' |
    'infra_hma_quantity' |
    'infra_coax' |
    'infra_coax_quantity' |
    'infra_opticalcon_duo' |
    'infra_opticalcon_duo_quantity' |
    'infra_analog' |
    'other_infrastructure'
  >;
  onChange: (changes: Partial<GearSetupFormData>) => void;
}

export interface ConsoleConfigProps {
  consoles: ConsoleSetup[];
  onChange: (consoles: ConsoleSetup[]) => void;
  label: string;
}

export interface StageSetup {
  id: string;
  name: string;
  description?: string;
  gear_setup_id: string;
}
