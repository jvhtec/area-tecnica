
import { ConsoleSetup, WirelessSetup } from "./festival";

export interface GearSetupFormData {
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
}

export interface ConsoleConfigProps {
  consoles: ConsoleSetup[];
  onChange: (consoles: ConsoleSetup[]) => void;
  label: string;
}

export interface InfrastructureConfigProps {
  data: Pick<GearSetupFormData, 
    'available_cat6_runs' | 
    'available_hma_runs' | 
    'available_coax_runs' | 
    'available_analog_runs' | 
    'available_opticalcon_duo_runs'
  >;
  onChange: (changes: Partial<GearSetupFormData>) => void;
}

export interface StageEquipmentConfigProps {
  data: Pick<GearSetupFormData,
    'available_monitors' |
    'has_side_fills' |
    'has_drum_fills' |
    'has_dj_booths'
  >;
  onChange: (changes: Partial<GearSetupFormData>) => void;
}
