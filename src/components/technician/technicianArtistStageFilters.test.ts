import { describe, expect, it } from "vitest";

import {
  buildTechnicianArtistStageOptions,
  normalizeTechnicianArtistStage,
} from "@/components/technician/technicianArtistStageFilters";

describe("technician artist stage filters", () => {
  it("groups nullable stages under the selectable stage-zero sentinel", () => {
    const artists = [{ stage: null }, { stage: 1 }, { stage: 1 }];

    expect(buildTechnicianArtistStageOptions(artists, { 1: "Principal" })).toEqual([
      { value: "0", label: "Sin escenario", count: 1 },
      { value: "1", label: "Principal", count: 2 },
    ]);
    expect(artists.filter((artist) => normalizeTechnicianArtistStage(artist.stage) === 0)).toHaveLength(1);
  });
});
