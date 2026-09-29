import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { rebaseSoundcheckDate } from "@/utils/artistScheduleDates";

export interface CopyArtistsOptions {
  /** Clear show, soundcheck, line check and load-in times. */
  resetTimes: boolean;
  /** Put every copied artist on stage 1. */
  resetStages: boolean;
  copyNotes: boolean;
  /** Keep consoles, outboard, wireless/IEM and wired mics; otherwise they are cleared. */
  copyTechnicalSpecs: boolean;
}

export const DEFAULT_COPY_ARTISTS_OPTIONS: CopyArtistsOptions = {
  resetTimes: true,
  resetStages: false,
  copyNotes: true,
  copyTechnicalSpecs: true,
};

/**
 * Turns artists of another date/festival into inserts for `targetJobId` on `targetDate`.
 * Copied riders are stamped with the date they came from and flagged outdated, so the table
 * shows "rider outdated" (not "missing") until production gets a fresh one.
 */
export function buildCopiedArtistRows(
  sources: readonly Tables<"festival_artists">[],
  options: CopyArtistsOptions,
  target: { jobId: string; date: string },
): TablesInsert<"festival_artists">[] {
  const specs = options.copyTechnicalSpecs;
  const times = !options.resetTimes;

  return sources.map((source) => {
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...artist } = source;

    return {
      ...artist,
      job_id: target.jobId,
      date: target.date,
      rider_copied_from_date: artist.date || null,
      rider_outdated: true,
      rider_outdated_dismissed: false,
      show_start: times ? artist.show_start : null,
      show_end: times ? artist.show_end : null,
      soundcheck_start: times ? artist.soundcheck_start : null,
      soundcheck_end: times ? artist.soundcheck_end : null,
      soundcheck_date: times
        ? rebaseSoundcheckDate({
            soundcheckDate: artist.soundcheck_date,
            sourceShowDate: artist.date,
            targetShowDate: target.date,
          })
        : null,
      line_check_start: times ? artist.line_check_start : null,
      line_check_end: times ? artist.line_check_end : null,
      load_in_time: times ? artist.load_in_time : null,
      stage: options.resetStages ? 1 : artist.stage,
      notes: options.copyNotes ? artist.notes : null,
      foh_console: specs ? artist.foh_console : null,
      foh_console_provided_by: specs ? artist.foh_console_provided_by : "festival",
      mon_console: specs ? artist.mon_console : null,
      mon_console_provided_by: specs ? artist.mon_console_provided_by : "festival",
      monitors_from_foh: specs ? artist.monitors_from_foh : false,
      foh_drive: specs ? artist.foh_drive : null,
      foh_drive_position: specs ? artist.foh_drive_position : null,
      mon_position: specs ? artist.mon_position : null,
      foh_waves_models: specs ? artist.foh_waves_models : [],
      foh_outboard: specs ? artist.foh_outboard : null,
      foh_waves_provided_by: specs ? artist.foh_waves_provided_by : "festival",
      mon_waves_models: specs ? artist.mon_waves_models : [],
      mon_outboard: specs ? artist.mon_outboard : null,
      mon_waves_provided_by: specs ? artist.mon_waves_provided_by : "festival",
      wireless_systems: specs ? artist.wireless_systems : [],
      wireless_provided_by: specs ? artist.wireless_provided_by : "festival",
      iem_systems: specs ? artist.iem_systems : [],
      iem_provided_by: specs ? artist.iem_provided_by : "festival",
      wired_mics: specs ? artist.wired_mics : [],
    };
  });
}
