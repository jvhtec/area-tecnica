import type { Tables } from "@/integrations/supabase/types";
import { combineWavesDisplay } from "@/constants/wavesModels";
import { getArtistRiderStatus } from "@/features/festival-management/selectors";
import type { MissingRiderReportData } from "@/utils/missingRiderReportPdfExport";
import type { ArtistPdfData } from "@/utils/artistPdfExport";
import type { IEMSystem, WirelessSystem } from "@/types/festival-equipment";

export type FestivalArtistRow = Tables<"festival_artists">;

/** The rows of a per-date, per-stage grouping, in the order they were given. */
export interface ArtistDateStageGroup<T> {
  date: string;
  stage: number;
  artists: T[];
}

/**
 * Groups artists (already sorted) by date, then by stage within the date. Groups come out in the
 * order their date and stage first appear, so a chronological input gives a chronological document.
 */
export function groupArtistsByDateAndStage<T extends { date?: string | null; stage?: number | null }>(
  artists: readonly T[],
): ArtistDateStageGroup<T>[] {
  const byDate = new Map<string, Map<number, T[]>>();
  for (const artist of artists) {
    const date = String(artist.date ?? "");
    const stage = Number(artist.stage || 1);
    let byStage = byDate.get(date);
    if (!byStage) {
      byStage = new Map();
      byDate.set(date, byStage);
    }
    const group = byStage.get(stage);
    if (group) group.push(artist);
    else byStage.set(stage, [artist]);
  }

  const groups: ArtistDateStageGroup<T>[] = [];
  for (const [date, byStage] of byDate) {
    for (const [stage, stageArtists] of byStage) groups.push({ date, stage, artists: stageArtists });
  }
  return groups;
}

/** Artists whose rider is missing or outdated: the ones the missing-rider report is about. */
export const artistsWithPendingRider = <T extends Parameters<typeof getArtistRiderStatus>[0]>(
  artists: readonly T[],
): T[] => artists.filter((artist) => getArtistRiderStatus(artist) !== "complete");

/** Rows of the missing-rider report. `formUrls` are the already-issued public form links by artist id. */
export function toMissingRiderRows(
  artists: readonly FestivalArtistRow[],
  getStageName: (stage: number) => string,
  formUrls: Record<string, string>,
): MissingRiderReportData["artists"] {
  return artists.map((artist) => ({
    id: artist.id,
    name: artist.name || "Unnamed Artist",
    stage: artist.stage || 1,
    stageName: getStageName(artist.stage || 1),
    date: artist.date || "",
    showTime: {
      start: artist.show_start || "",
      end: artist.show_end || "",
    },
    formUrl: formUrls[artist.id],
    status: getArtistRiderStatus(artist) === "missing" ? ("missing" as const) : ("outdated" as const),
    copiedFromDate: artist.rider_copied_from_date || undefined,
  }));
}

/** Artists that ask for festival-provided wired microphones and list at least one. */
export const artistsNeedingWiredMics = <T extends Pick<FestivalArtistRow, "mic_kit" | "wired_mics">>(
  artists: readonly T[],
): T[] =>
  artists.filter(
    (artist) =>
      (artist.mic_kit === "festival" || artist.mic_kit === "mixed") &&
      Array.isArray(artist.wired_mics) &&
      artist.wired_mics.length > 0,
  );

/** A JSON column that holds a list, read as that list (anything else is an empty list). */
const jsonList = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const toProvider = (value: string | null | undefined): 'festival' | 'band' | 'mixed' | undefined =>
  value === 'festival' || value === 'band' || value === 'mixed' ? value : undefined;

/** The individual sheet (ficha) of one artist. */
export function toArtistPdfData(
  artist: FestivalArtistRow,
  { logoUrl, stagePlotUrl }: { logoUrl: string | undefined; stagePlotUrl: string | undefined },
): ArtistPdfData {
  return {
    name: artist.name || 'Unnamed Artist',
    stage: artist.stage || 1,
    date: artist.date || '',
    schedule: {
      loadIn: artist.load_in_time || undefined,
      show: { start: artist.show_start || '', end: artist.show_end || '' },
      soundcheck: artist.soundcheck_start ? {
        date: artist.soundcheck_date || artist.date || '',
        start: artist.soundcheck_start || '',
        end: artist.soundcheck_end || '',
      } : undefined,
      lineCheck: artist.line_check ? { start: artist.line_check_start || '', end: artist.line_check_end || '' } : undefined,
    },
    technical: {
      fohTech: Boolean(artist.foh_tech || false),
      monTech: Boolean(artist.mon_tech || false),
      fohConsole: { 
        model: String(artist.foh_console || ''), 
        providedBy: String(artist.foh_console_provided_by || 'festival') 
      },
      monConsole: { 
        model: String(artist.mon_console || ''), 
        providedBy: String(artist.mon_console_provided_by || 'festival') 
      },
      monitorsFromFoh: Boolean(artist.monitors_from_foh || false),
      fohWavesOutboard: combineWavesDisplay(artist.foh_waves_models, artist.foh_outboard),
      monWavesOutboard: combineWavesDisplay(artist.mon_waves_models, artist.mon_outboard),
      wireless: {
        systems: jsonList<WirelessSystem>(artist.wireless_systems),
        providedBy: String(artist.wireless_provided_by || 'festival'),
      },
      iem: {
        systems: jsonList<IEMSystem>(artist.iem_systems),
        providedBy: String(artist.iem_provided_by || 'festival'),
      },
      monitors: {
        enabled: Boolean(artist.monitors_enabled || false),
        quantity: Number(artist.monitors_quantity || 0)
      }
    },
    infrastructure: {
      providedBy: String(artist.infrastructure_provided_by || 'festival'),
      cat6: { 
        enabled: Boolean(artist.infra_cat6 || false), 
        quantity: Number(artist.infra_cat6_quantity || 0) 
      },
      hma: { 
        enabled: Boolean(artist.infra_hma || false), 
        quantity: Number(artist.infra_hma_quantity || 0) 
      },
      coax: { 
        enabled: Boolean(artist.infra_coax || false), 
        quantity: Number(artist.infra_coax_quantity || 0) 
      },
      opticalconDuo: { 
        enabled: Boolean(artist.infra_opticalcon_duo || false), 
        quantity: Number(artist.infra_opticalcon_duo_quantity || 0) 
      },
      analog: Number(artist.infra_analog || 0),
      other: String(artist.other_infrastructure || '')
    },
    extras: {
      sideFill: Boolean(artist.extras_sf || false),
      drumFill: Boolean(artist.extras_df || false),
      djBooth: Boolean(artist.extras_djbooth || false),
      wired: String(artist.extras_wired || '')
    },
    notes: artist.notes ? String(artist.notes) : undefined,
    logoUrl,
    wiredMics: jsonList<NonNullable<ArtistPdfData['wiredMics']>[number]>(artist.wired_mics),
    micKit: toProvider(artist.mic_kit),
    stagePlotUrl,
    stagePlotFileType: artist.stage_plot_file_type ? String(artist.stage_plot_file_type) : undefined,
  };
}
