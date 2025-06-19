import { WirelessSetup, ConsoleSetup } from "./festival";

export interface WirelessConfigProps {
  systems: WirelessSetup[];
  onChange: (systems: WirelessSetup[]) => void;
  label: string;
  includeQuantityTypes?: boolean;
  isIEM?: boolean;
  hideProvidedBy?: boolean;
}

export interface ConsoleConfigProps {
  consoles: ConsoleSetup[];
  onChange: (consoles: ConsoleSetup[]) => void;
  label: string;
}

export interface GearSetupFormData {
  max_stages: number;
  foh_consoles: ConsoleSetup[];
  mon_consoles: ConsoleSetup[];
  wireless_systems: WirelessSetup[];
  iem_systems: WirelessSetup[];
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
  data: {
    monitors_quantity: number;
    extras_sf: boolean;
    extras_df: boolean;
    extras_djbooth: boolean;
  };
  onChange: (changes: Partial<{
    monitors_quantity: number;
    extras_sf: boolean;
    extras_df: boolean;
    extras_djbooth: boolean;
  }>) => void;
}

export interface InfrastructureConfigProps {
  data: {
    infra_cat6_quantity: number;
    infra_hma_quantity: number;
    infra_coax_quantity: number;
    infra_analog: number;
    infra_opticalcon_duo_quantity: number;
  };
  onChange: (changes: Partial<{
    infra_cat6_quantity: number;
    infra_hma_quantity: number;
    infra_coax_quantity: number;
    infra_analog: number;
    infra_opticalcon_duo_quantity: number;
  }>) => void;
}
