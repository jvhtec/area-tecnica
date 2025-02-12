
export interface ConsoleSetup {
  model: string;
  quantity: number;
  notes?: string;
}

export interface WirelessSetup {
  model: string;
  quantity: number;
  band?: string;
  notes?: string;
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
  available_side_fills: number;
  available_drum_fills: number;
  available_dj_booths: number;
  available_cat6_runs: number;
  available_hma_runs: number;
  available_coax_runs: number;
  available_analog_runs: number;
  available_opticalcon_duo_runs: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}
