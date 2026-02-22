import { supabase } from "@/integrations/supabase/client";
import type { PdfFestivalGearOptions } from "@/utils/artistPdfExport";

interface ConsoleOption {
  model: string;
  quantity: number;
}

interface WirelessOption {
  model: string;
  quantity_hh: number;
  quantity_bp: number;
  band?: string;
}

interface WiredMicOption {
  model: string;
  quantity: number;
}

const toConsoleOptions = (value: unknown): ConsoleOption[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = (item || {}) as Record<string, unknown>;
      const model = typeof record.model === "string" ? record.model.trim() : "";
      const quantity = Number(record.quantity);
      return {
        model,
        quantity: Number.isFinite(quantity) ? quantity : 0,
      };
    })
    .filter((item) => item.model.length > 0);
};

const toWirelessOptions = (value: unknown): WirelessOption[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = (item || {}) as Record<string, unknown>;
      const model = typeof record.model === "string" ? record.model.trim() : "";
      const quantityHh = Number(record.quantity_hh);
      const quantityBp = Number(record.quantity_bp);
      const band = typeof record.band === "string" ? record.band.trim() : "";

      return {
        model,
        quantity_hh: Number.isFinite(quantityHh) ? quantityHh : 0,
        quantity_bp: Number.isFinite(quantityBp) ? quantityBp : 0,
        band: band || undefined,
      };
    })
    .filter((item) => item.model.length > 0);
};

const toWiredMicOptions = (value: unknown): WiredMicOption[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = (item || {}) as Record<string, unknown>;
      const model = typeof record.model === "string" ? record.model.trim() : "";
      const quantity = Number(record.quantity);

      return {
        model,
        quantity: Number.isFinite(quantity) ? quantity : 0,
      };
    })
    .filter((item) => item.model.length > 0);
};

export const fetchFestivalGearOptionsForTemplate = async (
  jobId?: string,
  stageNumber?: number,
): Promise<PdfFestivalGearOptions | undefined> => {
  if (!jobId) return undefined;

  const { data: mainSetup, error: mainError } = await supabase
    .from("festival_gear_setups")
    .select(
      "id, foh_consoles, mon_consoles, wireless_systems, iem_systems, wired_mics, available_monitors, has_side_fills, has_drum_fills, has_dj_booths, available_cat6_runs, available_hma_runs, available_coax_runs, available_opticalcon_duo_runs, available_analog_runs",
    )
    .eq("job_id", jobId)
    .maybeSingle();

  if (mainError) {
    throw mainError;
  }

  if (!mainSetup) {
    return undefined;
  }

  type SetupShape = {
    foh_consoles: unknown;
    mon_consoles: unknown;
    wireless_systems: unknown;
    iem_systems: unknown;
    wired_mics: unknown;
    available_monitors?: number | null;
    has_side_fills?: boolean | null;
    has_drum_fills?: boolean | null;
    has_dj_booths?: boolean | null;
    available_cat6_runs?: number | null;
    available_hma_runs?: number | null;
    available_coax_runs?: number | null;
    available_opticalcon_duo_runs?: number | null;
    available_analog_runs?: number | null;
  };

  let setupToUse: SetupShape = {
    foh_consoles: mainSetup.foh_consoles,
    mon_consoles: mainSetup.mon_consoles,
    wireless_systems: mainSetup.wireless_systems,
    iem_systems: mainSetup.iem_systems,
    wired_mics: mainSetup.wired_mics,
    available_monitors: mainSetup.available_monitors,
    has_side_fills: mainSetup.has_side_fills,
    has_drum_fills: mainSetup.has_drum_fills,
    has_dj_booths: mainSetup.has_dj_booths,
    available_cat6_runs: mainSetup.available_cat6_runs,
    available_hma_runs: mainSetup.available_hma_runs,
    available_coax_runs: mainSetup.available_coax_runs,
    available_opticalcon_duo_runs: mainSetup.available_opticalcon_duo_runs,
    available_analog_runs: mainSetup.available_analog_runs,
  };

  if (typeof stageNumber === "number" && Number.isFinite(stageNumber)) {
    const { data: stageSetup, error: stageError } = await supabase
      .from("festival_stage_gear_setups")
      .select(
        "foh_consoles, mon_consoles, wireless_systems, iem_systems, wired_mics, monitors_quantity, extras_sf, extras_df, extras_djbooth, infra_cat6_quantity, infra_hma_quantity, infra_coax_quantity, infra_opticalcon_duo_quantity, infra_analog",
      )
      .eq("gear_setup_id", mainSetup.id)
      .eq("stage_number", stageNumber)
      .maybeSingle();

    if (stageError) {
      throw stageError;
    }

    if (stageSetup) {
      setupToUse = {
        foh_consoles: stageSetup.foh_consoles,
        mon_consoles: stageSetup.mon_consoles,
        wireless_systems: stageSetup.wireless_systems,
        iem_systems: stageSetup.iem_systems,
        wired_mics: stageSetup.wired_mics,
        available_monitors: stageSetup.monitors_quantity,
        has_side_fills: stageSetup.extras_sf,
        has_drum_fills: stageSetup.extras_df,
        has_dj_booths: stageSetup.extras_djbooth,
        available_cat6_runs: stageSetup.infra_cat6_quantity,
        available_hma_runs: stageSetup.infra_hma_quantity,
        available_coax_runs: stageSetup.infra_coax_quantity,
        available_opticalcon_duo_runs: stageSetup.infra_opticalcon_duo_quantity,
        available_analog_runs: stageSetup.infra_analog,
      };
    }
  }

  return {
    fohConsoles: toConsoleOptions(setupToUse.foh_consoles),
    monConsoles: toConsoleOptions(setupToUse.mon_consoles),
    wirelessSystems: toWirelessOptions(setupToUse.wireless_systems),
    iemSystems: toWirelessOptions(setupToUse.iem_systems),
    wiredMics: toWiredMicOptions(setupToUse.wired_mics),
    monitorsQuantity: Number(setupToUse.available_monitors) || 0,
    hasSideFill: Boolean(setupToUse.has_side_fills),
    hasDrumFill: Boolean(setupToUse.has_drum_fills),
    hasDjBooth: Boolean(setupToUse.has_dj_booths),
    availableCat6Runs: Number(setupToUse.available_cat6_runs) || 0,
    availableHmaRuns: Number(setupToUse.available_hma_runs) || 0,
    availableCoaxRuns: Number(setupToUse.available_coax_runs) || 0,
    availableOpticalconDuoRuns: Number(setupToUse.available_opticalcon_duo_runs) || 0,
    availableAnalogRuns: Number(setupToUse.available_analog_runs) || 0,
  };
};
