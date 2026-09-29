import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { toFullSchedulePdfArtists } from "../artistPdf";
import { compareArtistsWithGear } from "../gearComparison";

const row = (overrides: Partial<Tables<"festival_artists">>) =>
  ({
    name: "A",
    date: "2026-07-10",
    stage: 1,
    show_start: "20:00",
    show_end: "21:00",
    soundcheck: false,
    soundcheck_date: null,
    soundcheck_start: null,
    soundcheck_end: null,
    line_check: null,
    line_check_start: null,
    line_check_end: null,
    load_in_time: null,
    ...overrides,
  }) as Tables<"festival_artists">;

describe("toFullSchedulePdfArtists", () => {
  it("leaves out rows that cannot be placed on the schedule", () => {
    const result = toFullSchedulePdfArtists([
      row({ name: "ok" }),
      row({ name: "no date", date: null }),
      row({ name: "no stage", stage: null }),
      row({ name: "no start", show_start: null }),
    ]);
    expect(result.map((artist) => artist.name)).toEqual(["ok"]);
  });

  it("maps nullable optional columns to undefined and a missing end to an empty string", () => {
    const [artist] = toFullSchedulePdfArtists([row({ show_end: null })]);
    expect(artist).toMatchObject({ show_end: "", soundcheck_start: undefined, load_in_time: undefined });
  });
});

describe("compareArtistsWithGear", () => {
  it("returns no comparisons until the festival has a gear setup", () => {
    expect(compareArtistsWithGear([], null, {})).toEqual({});
  });
});
