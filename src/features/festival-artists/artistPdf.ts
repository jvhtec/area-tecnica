import type { Tables } from "@/integrations/supabase/types";
import type { FullScheduleArtist } from "@/utils/fullFestivalSchedulePdfExport";

/**
 * Rows of the full-festival schedule PDF (one line per artist, every date). Rows without a
 * date, stage or show start cannot be placed on the schedule and are left out.
 */
export function toFullSchedulePdfArtists(
  rows: readonly Tables<"festival_artists">[],
): FullScheduleArtist[] {
  return rows.flatMap((artist) => {
    if (artist.date == null || artist.stage == null || artist.show_start == null) return [];
    return [
      {
        name: artist.name,
        date: artist.date,
        stage: artist.stage,
        show_start: artist.show_start,
        show_end: artist.show_end ?? "",
        soundcheck_start: artist.soundcheck_start ?? undefined,
        soundcheck_end: artist.soundcheck_end ?? undefined,
        soundcheck_date: artist.soundcheck_date,
        soundcheck: artist.soundcheck ?? false,
        line_check: artist.line_check ?? undefined,
        line_check_start: artist.line_check_start ?? undefined,
        line_check_end: artist.line_check_end ?? undefined,
        load_in_time: artist.load_in_time ?? undefined,
      },
    ];
  });
}
