import type { Artist } from "@/components/festival/artistTableTypes";
import { combineWavesDisplay } from "@/constants/wavesModels";
import type { ArtistTablePdfData } from "@/utils/artistTablePdfExport";
import { buildReadableFilename } from "@/utils/fileName";
import type { ArtistGearComparison } from "@/utils/gearComparisonService";

type TableArtist = ArtistTablePdfData["artists"][number];

/** The artists the print dialog is about: everything, or one stage ("all" and "" mean every stage). */
export const filterArtistsByStage = (artists: readonly Artist[], stageFilter: string): Artist[] =>
  artists.filter((artist) => stageFilter === "all" || !stageFilter || artist.stage?.toString() === stageFilter);

/** One artist as a row of the artist table PDF; `comparison` is that artist's gear check, if any. */
export function toArtistTableRow(artist: Artist, comparison: ArtistGearComparison | undefined): TableArtist {
  return {
    name: artist.name,
    stage: artist.stage,
    loadInTime: artist.load_in_time || undefined,
    showTime: {
      start: artist.show_start,
      end: artist.show_end,
    },
    soundcheck: artist.soundcheck
      ? {
          date: artist.soundcheck_date || artist.date,
          start: artist.soundcheck_start || "",
          end: artist.soundcheck_end || "",
        }
      : undefined,
    lineCheck: artist.line_check
      ? {
          start: artist.line_check_start || "",
          end: artist.line_check_end || "",
        }
      : undefined,
    technical: {
      fohTech: artist.foh_tech || false,
      monTech: artist.mon_tech || false,
      fohConsole: {
        model: artist.foh_console,
        providedBy: artist.foh_console_provided_by || "festival",
      },
      monConsole: {
        model: artist.mon_console,
        providedBy: artist.mon_console_provided_by || "festival",
      },
      monitorsFromFoh: artist.monitors_from_foh || false,
      fohWavesOutboard: combineWavesDisplay(artist.foh_waves_models, artist.foh_outboard),
      monWavesOutboard: combineWavesDisplay(artist.mon_waves_models, artist.mon_outboard),
      wireless: {
        systems: artist.wireless_systems || [],
        providedBy: artist.wireless_provided_by || "festival",
      },
      iem: {
        systems: artist.iem_systems || [],
        providedBy: artist.iem_provided_by || "festival",
      },
      monitors: {
        enabled: artist.monitors_enabled,
        quantity: artist.monitors_quantity,
      },
    },
    extras: {
      sideFill: artist.extras_sf,
      drumFill: artist.extras_df,
      djBooth: artist.extras_djbooth,
    },
    notes: artist.notes,
    micKit: artist.mic_kit || "band",
    wiredMics: artist.wired_mics || [],
    infrastructure: {
      infra_cat6: artist.infra_cat6,
      infra_cat6_quantity: artist.infra_cat6_quantity,
      infra_hma: artist.infra_hma,
      infra_hma_quantity: artist.infra_hma_quantity,
      infra_coax: artist.infra_coax,
      infra_coax_quantity: artist.infra_coax_quantity,
      infra_opticalcon_duo: artist.infra_opticalcon_duo,
      infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity,
      infra_analog: artist.infra_analog,
      other_infrastructure: artist.other_infrastructure,
      infrastructure_provided_by: artist.infrastructure_provided_by,
    },
    riderMissing: artist.rider_missing || false,
    gearMismatches: comparison?.mismatches,
  };
}

/** "Cronograma artistas – date – stage": the stage is named only when the print is for one stage. */
export function artistTableFilename(
  selectedDate: string,
  stageFilter: string,
  stageNames: Record<number, string> | undefined,
): string {
  const stageName =
    stageFilter && stageFilter !== "all" ? stageNames?.[parseInt(stageFilter)] || `Escenario ${stageFilter}` : "";
  return buildReadableFilename(["Cronograma artistas", selectedDate, stageName]);
}
