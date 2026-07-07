import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";

import {
  buildRiderLibraryEntries,
  buildFestivalStageOptions,
  buildFestivalWhatsappStageOptions,
  buildJobDates,
  formatFestivalDateLabel,
  getArtistRiderStatus,
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

  it("derives rider status with missing taking priority over outdated", () => {
    expect(getArtistRiderStatus({ rider_missing: true, rider_outdated: true })).toBe("missing");
    expect(getArtistRiderStatus({ rider_missing: false, rider_outdated: true })).toBe("outdated");
    expect(getArtistRiderStatus({ rider_missing: false, rider_copied_from_date: "2026-06-01" })).toBe("outdated");
    expect(
      getArtistRiderStatus({
        rider_missing: false,
        rider_outdated: true,
        rider_outdated_dismissed: true,
      }),
    ).toBe("complete");
    expect(getArtistRiderStatus({ rider_missing: false })).toBe("complete");
  });

  it("builds rider library entries sorted by latest upload and flags duplicate file paths", () => {
    const entries = buildRiderLibraryEntries({
      artistsById: {
        "artist-a": { id: "artist-a", name: "Alpha", job_id: "job-a", date: "2026-06-01", stage: 2 },
        "artist-b": { id: "artist-b", name: "Beta", job_id: "job-b", date: "2026-05-01", stage: 1 },
      },
      files: [
        {
          id: "file-old",
          artist_id: "artist-a",
          file_name: "alpha-old.pdf",
          file_path: "riders/alpha-old.pdf",
          uploaded_at: "2026-05-01T10:00:00.000Z",
        },
        {
          id: "file-new",
          artist_id: "artist-a",
          file_name: "alpha-new.pdf",
          file_path: "riders/alpha-new.pdf",
          uploaded_at: "2026-06-01T10:00:00.000Z",
        },
        {
          id: "file-beta",
          artist_id: "artist-b",
          file_name: "beta.pdf",
          file_path: "riders/beta.pdf",
          uploaded_at: "2026-07-01T10:00:00.000Z",
        },
      ],
      jobsById: {
        "job-a": { id: "job-a", title: "Source A", job_type: "festival" },
        "job-b": { id: "job-b", title: "Source B", job_type: "tourdate" },
      },
      targetFilePaths: ["riders/alpha-new.pdf"],
    });

    expect(entries.map((entry) => entry.artistName)).toEqual(["Beta", "Alpha"]);
    expect(entries[1]).toMatchObject({
      alreadyImported: true,
      duplicateFilePaths: ["riders/alpha-new.pdf"],
      latestUploadedAt: "2026-06-01T10:00:00.000Z",
      sourceJobTitle: "Source A",
      sourceStage: 2,
    });
    expect(entries[1].files.map((file) => file.file_name)).toEqual(["alpha-new.pdf", "alpha-old.pdf"]);
  });

  it("normalizes WhatsApp stage state by department and stage count", () => {
    expect(normalizeFestivalWhatsappStage({ currentStage: 0, department: "sound", maxStages: 3 })).toBe(1);
    expect(normalizeFestivalWhatsappStage({ currentStage: 2, department: "video", maxStages: 3 })).toBe(2);
    expect(normalizeFestivalWhatsappStage({ currentStage: 2, department: "lights", maxStages: 3 })).toBe(0);
    expect(normalizeFestivalWhatsappStage({ currentStage: 1, department: "sound", maxStages: 1 })).toBe(0);
    expect(requiresFestivalWhatsappStage(2, "sound")).toBe(true);
    expect(requiresFestivalWhatsappStage(1, "sound")).toBe(false);
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
