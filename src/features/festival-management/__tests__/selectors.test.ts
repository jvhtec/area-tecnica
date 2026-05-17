import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";

import {
  buildFestivalStageOptions,
  buildFestivalWhatsappStageOptions,
  buildJobDates,
  formatFestivalDateLabel,
  getFestivalFlexStatus,
  groupFestivalRiderFiles,
  normalizeFestivalWhatsappStage,
  requiresFestivalWhatsappStage,
} from "@/features/festival-management/selectors";
import type { ArtistRiderFile } from "@/features/festival-management/types";

const formatMadridDate = (date: Date) => formatInTimeZone(date, "Europe/Madrid", "yyyy-MM-dd");

describe("festival management selectors", () => {
  it("merges configured stage names with fallback stage count", () => {
    const result = buildFestivalStageOptions(
      [
        { number: 1, name: "Main" },
        { number: 3, name: "Club" },
      ],
      2,
    );

    expect(result.maxStages).toBe(3);
    expect(result.options).toEqual([
      { number: 1, name: "Main" },
      { number: 2, name: "Stage 2" },
      { number: 3, name: "Club" },
    ]);
  });

  it("builds inclusive job dates and falls back to date-type rows when needed", () => {
    expect(
      buildJobDates({
        start_time: "2026-06-01T08:00:00.000Z",
        end_time: "2026-06-03T20:00:00.000Z",
      }).map(formatMadridDate),
    ).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);

    expect(
      buildJobDates(
        { start_time: "invalid", end_time: "invalid" },
        [{ date: "2026-07-01" }, { date: "2026-07-01" }, { date: "2026-07-02" }],
      ).map(formatMadridDate),
    ).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("groups rider files by artist and sorts artists by name", () => {
    const files: ArtistRiderFile[] = [
      {
        id: "file-1",
        artist_id: "artist-b",
        created_at: "2026-01-01",
        file_name: "b.pdf",
        file_path: "b.pdf",
        festival_artists: { id: "artist-b", name: "Beta" },
      },
      {
        id: "file-2",
        artist_id: "artist-a",
        created_at: "2026-01-01",
        file_name: "a.pdf",
        file_path: "a.pdf",
        festival_artists: { id: "artist-a", name: "Alpha" },
      },
    ];

    expect(groupFestivalRiderFiles(files).map((group) => group.artistName)).toEqual(["Alpha", "Beta"]);
  });

  it("normalizes WhatsApp stage state by department and stage count", () => {
    expect(normalizeFestivalWhatsappStage({ currentStage: 0, department: "sound", maxStages: 3 })).toBe(1);
    expect(normalizeFestivalWhatsappStage({ currentStage: 2, department: "video", maxStages: 3 })).toBe(2);
    expect(normalizeFestivalWhatsappStage({ currentStage: 2, department: "lights", maxStages: 3 })).toBe(0);
    expect(requiresFestivalWhatsappStage(2, "sound")).toBe(true);
    expect(requiresFestivalWhatsappStage(2, "lights")).toBe(false);
    expect(buildFestivalWhatsappStageOptions([], 2)).toEqual([
      { number: 1, name: "Stage 1" },
      { number: 2, name: "Stage 2" },
    ]);
  });

  it("formats status labels and safe date labels", () => {
    expect(getFestivalFlexStatus({ flexError: null, folderExists: true, isFlexLoading: false })).toEqual({
      label: "Carpetas listas",
      variant: "secondary",
    });
    expect(getFestivalFlexStatus({ flexError: "boom", folderExists: false, isFlexLoading: false }).variant).toBe(
      "destructive",
    );
    expect(formatFestivalDateLabel("not-a-date")).toBe("Unknown date");
    expect(formatFestivalDateLabel("2026-06-01T22:30:00.000Z")).toBe("Jun 2, 2026");
  });
});
