import { describe, expect, it } from "vitest";

import type { Artist } from "@/components/festival/artistTableTypes";
import { artistTableFilename, filterArtistsByStage, toArtistTableRow } from "../artistTablePdf";

const artist = (overrides: Partial<Artist> = {}): Artist =>
  ({
    id: "a1",
    name: "Banda",
    stage: 1,
    date: "2026-07-01",
    show_start: "20:00",
    show_end: "21:00",
    soundcheck: false,
    foh_console: "SD12",
    mon_console: "SD10",
    wireless_systems: [],
    iem_systems: [],
    monitors_enabled: false,
    monitors_quantity: 0,
    extras_sf: false,
    extras_df: false,
    extras_djbooth: false,
    ...overrides,
  }) as Artist;

describe("filterArtistsByStage", () => {
  const artists = [artist({ id: "1", stage: 1 }), artist({ id: "2", stage: 2 })];

  it("keeps everyone for 'all' or no stage", () => {
    expect(filterArtistsByStage(artists, "all")).toHaveLength(2);
    expect(filterArtistsByStage(artists, "")).toHaveLength(2);
  });

  it("keeps one stage", () => {
    expect(filterArtistsByStage(artists, "2").map((a) => a.id)).toEqual(["2"]);
  });
});

describe("toArtistTableRow", () => {
  it("defaults the providers to the festival and the mic kit to the band's", () => {
    const row = toArtistTableRow(artist(), undefined);
    expect(row.technical.fohConsole).toEqual({ model: "SD12", providedBy: "festival" });
    expect(row.micKit).toBe("band");
    expect(row.riderMissing).toBe(false);
    expect(row.gearMismatches).toBeUndefined();
  });

  it("carries the soundcheck (on the show date when it has none) and line check only when they are on", () => {
    const off = toArtistTableRow(artist({ soundcheck_start: "16:00" }), undefined);
    expect(off.soundcheck).toBeUndefined();
    expect(off.lineCheck).toBeUndefined();

    const on = toArtistTableRow(
      artist({ soundcheck: true, soundcheck_start: "16:00", soundcheck_end: "16:30", line_check: true, line_check_start: "15:00" }),
      undefined,
    );
    expect(on.soundcheck).toEqual({ date: "2026-07-01", start: "16:00", end: "16:30" });
    expect(on.lineCheck).toEqual({ start: "15:00", end: "" });
  });

  it("carries the artist's gear mismatches", () => {
    const mismatches = [{ category: "console", severity: "warning", message: "x" }] as never;
    expect(toArtistTableRow(artist(), { mismatches } as never).gearMismatches).toBe(mismatches);
  });
});

describe("artistTableFilename", () => {
  it("names the stage only for a single-stage print", () => {
    expect(artistTableFilename("2026-07-01", "all", {})).not.toContain("Escenario");
    expect(artistTableFilename("2026-07-01", "2", { 2: "Principal" })).toContain("Principal");
    expect(artistTableFilename("2026-07-01", "3", {})).toContain("Escenario 3");
  });
});
