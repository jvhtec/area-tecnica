import { describe, expect, it } from "vitest";

import {
  artistsNeedingWiredMics,
  artistsWithPendingRider,
  groupArtistsByDateAndStage,
  toMissingRiderRows,
  type FestivalArtistRow,
} from "../reportData";

describe("groupArtistsByDateAndStage", () => {
  it("groups by date, then stage, in first-seen order", () => {
    const artists = [
      { name: "a", date: "2026-07-01", stage: 2 },
      { name: "b", date: "2026-07-01", stage: 1 },
      { name: "c", date: "2026-07-01", stage: 2 },
      { name: "d", date: "2026-07-02", stage: 1 },
    ];
    const groups = groupArtistsByDateAndStage(artists);
    expect(groups.map((g) => [g.date, g.stage, g.artists.map((a) => a.name)])).toEqual([
      ["2026-07-01", 2, ["a", "c"]],
      ["2026-07-01", 1, ["b"]],
      ["2026-07-02", 1, ["d"]],
    ]);
  });

  it("puts artists without a stage or date on stage 1 / the empty date", () => {
    const groups = groupArtistsByDateAndStage([{ date: null, stage: null }]);
    expect(groups).toEqual([{ date: "", stage: 1, artists: [{ date: null, stage: null }] }]);
  });

  it("returns nothing for nobody", () => {
    expect(groupArtistsByDateAndStage([])).toEqual([]);
  });
});

const artist = (overrides: Partial<FestivalArtistRow>): FestivalArtistRow =>
  ({ id: "x", name: "Banda", stage: 1, date: "2026-07-01", rider_missing: false, ...overrides }) as FestivalArtistRow;

describe("missing riders", () => {
  it("keeps the artists whose rider is missing or outdated", () => {
    const all = [
      artist({ id: "ok" }),
      artist({ id: "missing", rider_missing: true }),
      artist({ id: "outdated", rider_outdated: true, rider_copied_from_date: "2026-06-01" }),
    ];
    expect(artistsWithPendingRider(all).map((a) => a.id)).toEqual(["missing", "outdated"]);
  });

  it("describes them for the report, with their stage name and form link", () => {
    const rows = toMissingRiderRows(
      [
        artist({ id: "m", name: "", stage: 2, rider_missing: true, show_start: "20:00", show_end: "21:00" }),
        artist({ id: "o", rider_outdated: true, rider_copied_from_date: "2026-06-01" }),
      ],
      (stage) => `Escenario ${stage}!`,
      { m: "https://forms/m" },
    );
    expect(rows[0]).toMatchObject({
      id: "m",
      name: "Unnamed Artist",
      stageName: "Escenario 2!",
      status: "missing",
      formUrl: "https://forms/m",
      showTime: { start: "20:00", end: "21:00" },
    });
    expect(rows[1]).toMatchObject({ id: "o", status: "outdated", copiedFromDate: "2026-06-01" });
    expect(rows[1].formUrl).toBeUndefined();
  });
});

describe("artistsNeedingWiredMics", () => {
  it("wants a festival or mixed kit with at least one mic", () => {
    const mics = [{ model: "SM58", quantity: 2 }];
    const found = artistsNeedingWiredMics([
      artist({ id: "festival", mic_kit: "festival", wired_mics: mics }),
      artist({ id: "mixed", mic_kit: "mixed", wired_mics: mics }),
      artist({ id: "band", mic_kit: "band", wired_mics: mics }),
      artist({ id: "empty", mic_kit: "festival", wired_mics: [] }),
      artist({ id: "none", mic_kit: "festival", wired_mics: null }),
    ]);
    expect(found.map((a) => a.id)).toEqual(["festival", "mixed"]);
  });
});
