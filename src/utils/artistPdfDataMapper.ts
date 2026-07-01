import { combineWavesDisplay } from "@/constants/wavesModels";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { WirelessSystem, IEMSystem } from "@/types/festival-equipment";
import type { ProviderType } from "@/types/festival";
import type { ArtistPdfData } from "@/utils/artistPdfExport";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";

interface ArtistPdfSource {
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  line_check?: boolean;
  line_check_start?: string;
  line_check_end?: string;
  load_in_time?: string;
  foh_console: string;
  foh_console_provided_by?: ProviderType;
  mon_console: string;
  mon_console_provided_by?: ProviderType;
  monitors_from_foh?: boolean;
  foh_waves_models?: unknown;
  foh_outboard?: string | null;
  mon_waves_models?: unknown;
  mon_outboard?: string | null;
  wireless_systems?: WirelessSystem[];
  wireless_provided_by?: ProviderType;
  iem_systems?: IEMSystem[];
  iem_provided_by?: ProviderType;
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  notes?: string;
  rider_missing?: boolean;
  foh_tech?: boolean;
  mon_tech?: boolean;
  mic_kit?: ProviderType;
  wired_mics?: ArtistPdfData["wiredMics"];
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  other_infrastructure?: string;
  infrastructure_provided_by?: ProviderType;
  stage_plot_file_path?: string | null;
  stage_plot_file_type?: string | null;
}

const createStagePlotSignedUrl = async (filePath?: string | null): Promise<string | undefined> => {
  if (!filePath) return undefined;

  try {
    const { data: stagePlotData, error: stagePlotError } = await dataLayerClient.storage
      .from("festival_artist_files")
      .createSignedUrl(filePath, 60 * 60);

    if (stagePlotError) {
      console.error("Error creating signed URL for stage plot:", stagePlotError);
      return undefined;
    }

    return stagePlotData?.signedUrl;
  } catch (error) {
    console.error("Error loading stage plot for PDF:", error);
    return undefined;
  }
};

export const buildArtistPdfData = async (artist: ArtistPdfSource, jobId?: string): Promise<ArtistPdfData> => {
  let logoUrl: string | undefined;

  if (jobId) {
    try {
      logoUrl = await fetchJobLogo(jobId);
      console.log("Fetched logo URL for PDF:", logoUrl);
    } catch (error) {
      console.error("Error fetching logo for PDF:", error);
    }
  }

  return {
    name: artist.name,
    stage: artist.stage,
    date: artist.date,
    schedule: {
      loadIn: artist.load_in_time || undefined,
      show: { start: artist.show_start, end: artist.show_end },
      soundcheck: artist.soundcheck ? { start: artist.soundcheck_start || "", end: artist.soundcheck_end || "" } : undefined,
      lineCheck: artist.line_check ? { start: artist.line_check_start || "", end: artist.line_check_end || "" } : undefined,
    },
    technical: {
      fohTech: artist.foh_tech || false,
      monTech: artist.mon_tech || false,
      fohConsole: { model: artist.foh_console, providedBy: artist.foh_console_provided_by || "festival" },
      monConsole: { model: artist.mon_console, providedBy: artist.mon_console_provided_by || "festival" },
      monitorsFromFoh: artist.monitors_from_foh || false,
      fohWavesOutboard: combineWavesDisplay(artist.foh_waves_models, artist.foh_outboard),
      monWavesOutboard: combineWavesDisplay(artist.mon_waves_models, artist.mon_outboard),
      wireless: { systems: artist.wireless_systems || [], providedBy: artist.wireless_provided_by || "festival" },
      iem: { systems: artist.iem_systems || [], providedBy: artist.iem_provided_by || "festival" },
      monitors: { enabled: artist.monitors_enabled, quantity: artist.monitors_quantity },
    },
    infrastructure: {
      providedBy: artist.infrastructure_provided_by || "festival",
      cat6: { enabled: artist.infra_cat6 || false, quantity: artist.infra_cat6_quantity || 0 },
      hma: { enabled: artist.infra_hma || false, quantity: artist.infra_hma_quantity || 0 },
      coax: { enabled: artist.infra_coax || false, quantity: artist.infra_coax_quantity || 0 },
      opticalconDuo: { enabled: artist.infra_opticalcon_duo || false, quantity: artist.infra_opticalcon_duo_quantity || 0 },
      analog: artist.infra_analog || 0,
      other: artist.other_infrastructure || "",
    },
    extras: { sideFill: artist.extras_sf, drumFill: artist.extras_df, djBooth: artist.extras_djbooth, wired: "" },
    notes: artist.notes || "",
    wiredMics: artist.wired_mics || [],
    logoUrl,
    micKit: artist.mic_kit || "band",
    riderMissing: artist.rider_missing || false,
    stagePlotUrl: await createStagePlotSignedUrl(artist.stage_plot_file_path),
    stagePlotFileType: artist.stage_plot_file_type || undefined,
  };
};
