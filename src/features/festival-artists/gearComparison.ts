import type { Artist } from "@/components/festival/artistTableTypes";
import type { ConsolePosition, FohDrive, MonConsolePosition } from "@/constants/consoleDrive";
import type { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import {
  compareArtistRequirements,
  type ArtistGearComparison,
  type ArtistRequirements,
} from "@/utils/gearComparisonService";

/** What the gear comparison needs to know about an artist's technical requirements. */
export function toArtistRequirements(artist: Artist): ArtistRequirements {
  return {
    name: artist.name,
    stage: artist.stage,
    foh_console: artist.foh_console,
    foh_console_provided_by: artist.foh_console_provided_by,
    foh_drive: artist.foh_drive as FohDrive | "" | undefined,
    foh_drive_position: artist.foh_drive_position as ConsolePosition | "" | undefined,
    mon_console: artist.mon_console,
    mon_console_provided_by: artist.mon_console_provided_by,
    mon_position: artist.mon_position as MonConsolePosition | "" | undefined,
    monitors_from_foh: artist.monitors_from_foh || false,
    foh_waves_models: artist.foh_waves_models || [],
    foh_outboard: artist.foh_outboard || "",
    foh_waves_provided_by: artist.foh_waves_provided_by,
    mon_waves_models: artist.mon_waves_models || [],
    mon_outboard: artist.mon_outboard || "",
    mon_waves_provided_by: artist.mon_waves_provided_by,
    wireless_systems: artist.wireless_systems || [],
    wireless_provided_by: artist.wireless_provided_by,
    iem_systems: artist.iem_systems || [],
    iem_provided_by: artist.iem_provided_by,
    monitors_enabled: artist.monitors_enabled,
    monitors_quantity: artist.monitors_quantity,
    extras_sf: artist.extras_sf,
    extras_df: artist.extras_df,
    extras_djbooth: artist.extras_djbooth,
    infra_cat6: artist.infra_cat6 || false,
    infra_cat6_quantity: artist.infra_cat6_quantity || 0,
    infra_hma: artist.infra_hma || false,
    infra_hma_quantity: artist.infra_hma_quantity || 0,
    infra_coax: artist.infra_coax || false,
    infra_coax_quantity: artist.infra_coax_quantity || 0,
    infra_opticalcon_duo: artist.infra_opticalcon_duo || false,
    infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity || 0,
    infra_analog: artist.infra_analog || 0,
    infrastructure_provided_by: artist.infrastructure_provided_by,
    mic_kit: artist.mic_kit || "band",
    wired_mics: artist.wired_mics || [],
  };
}

const NO_COMPARISONS: Record<string, ArtistGearComparison> = {};

/** Compares every artist with the festival setup (and its stage's setup), keyed by artist id. */
export function compareArtistsWithGear(
  artists: readonly Artist[],
  festivalGearSetup: FestivalGearSetup | null,
  stageGearSetups: Record<number, StageGearSetup>,
): Record<string, ArtistGearComparison> {
  if (!festivalGearSetup || artists.length === 0) return NO_COMPARISONS;

  const comparisons: Record<string, ArtistGearComparison> = {};
  for (const artist of artists) {
    comparisons[artist.id] = compareArtistRequirements(
      toArtistRequirements(artist),
      festivalGearSetup,
      stageGearSetups[artist.stage] || null,
    );
  }
  return comparisons;
}
