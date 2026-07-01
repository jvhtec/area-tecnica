import { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import type { AvailableGear } from "@/utils/gear-comparison/types";

export const EMPTY_AVAILABLE_GEAR: AvailableGear = {
  foh_consoles: [],
  mon_consoles: [],
  foh_drive_options: [],
  foh_drive_positions: [],
  mon_positions: [],
  foh_waves_models: [],
  foh_outboard: "",
  mon_waves_models: [],
  mon_outboard: "",
  wireless_systems: [],
  iem_systems: [],
  wired_mics: [],
  available_monitors: 0,
  has_side_fills: false,
  has_drum_fills: false,
  has_dj_booths: false,
  available_cat6_runs: 0,
  available_hma_runs: 0,
  available_coax_runs: 0,
  available_opticalcon_duo_runs: 0,
  available_analog_runs: 0
};

export const mapStageSetupToAvailableGear = (stageSetup: StageGearSetup): AvailableGear => ({
  foh_consoles: stageSetup.foh_consoles || [],
  mon_consoles: stageSetup.mon_consoles || [],
  foh_drive_options: stageSetup.foh_drive_options || [],
  foh_drive_positions: stageSetup.foh_drive_positions || [],
  mon_positions: stageSetup.mon_positions || [],
  foh_waves_models: stageSetup.foh_waves_models || [],
  foh_outboard: stageSetup.foh_outboard || "",
  mon_waves_models: stageSetup.mon_waves_models || [],
  mon_outboard: stageSetup.mon_outboard || "",
  wireless_systems: stageSetup.wireless_systems || [],
  iem_systems: stageSetup.iem_systems || [],
  wired_mics: stageSetup.wired_mics || [],
  available_monitors: stageSetup.monitors_quantity || 0,
  has_side_fills: stageSetup.extras_sf || false,
  has_drum_fills: stageSetup.extras_df || false,
  has_dj_booths: stageSetup.extras_djbooth || false,
  available_cat6_runs: stageSetup.infra_cat6_quantity || 0,
  available_hma_runs: stageSetup.infra_hma_quantity || 0,
  available_coax_runs: stageSetup.infra_coax_quantity || 0,
  available_opticalcon_duo_runs: stageSetup.infra_opticalcon_duo_quantity || 0,
  available_analog_runs: stageSetup.infra_analog || 0
});

export const mapGlobalSetupToAvailableGear = (globalSetup: FestivalGearSetup): AvailableGear => ({
  foh_consoles: globalSetup.foh_consoles || [],
  mon_consoles: globalSetup.mon_consoles || [],
  foh_drive_options: globalSetup.foh_drive_options || [],
  foh_drive_positions: globalSetup.foh_drive_positions || [],
  mon_positions: globalSetup.mon_positions || [],
  foh_waves_models: globalSetup.foh_waves_models || [],
  foh_outboard: globalSetup.foh_outboard || "",
  mon_waves_models: globalSetup.mon_waves_models || [],
  mon_outboard: globalSetup.mon_outboard || "",
  wireless_systems: globalSetup.wireless_systems || [],
  iem_systems: globalSetup.iem_systems || [],
  wired_mics: globalSetup.wired_mics || [],
  available_monitors: globalSetup.available_monitors || 0,
  has_side_fills: globalSetup.has_side_fills || false,
  has_drum_fills: globalSetup.has_drum_fills || false,
  has_dj_booths: globalSetup.has_dj_booths || false,
  available_cat6_runs: globalSetup.available_cat6_runs || 0,
  available_hma_runs: globalSetup.available_hma_runs || 0,
  available_coax_runs: globalSetup.available_coax_runs || 0,
  available_opticalcon_duo_runs: globalSetup.available_opticalcon_duo_runs || 0,
  available_analog_runs: globalSetup.available_analog_runs || 0
});
