import { describe, expect, it } from "vitest";

import type { ArtistRfIemData } from "@/utils/rfIemTablePdfExport";
import { getProviderColor, summarizeArtistRfInventory } from "./artistRfMetrics";

const artist = (overrides: Partial<ArtistRfIemData> = {}): ArtistRfIemData => ({
  name: "Banda Uno",
  stage: 1,
  wirelessSystems: [],
  iemSystems: [],
  ...overrides,
});

describe("artist RF inventory metrics", () => {
  it("uses explicit RF channels while keeping HH and BP inventory totals", () => {
    const summary = summarizeArtistRfInventory(
      artist({
        wirelessSystems: [
          {
            model: "Axient",
            quantity_ch: 8,
            quantity_hh: 3,
            quantity_bp: 2,
            provided_by: "festival",
          },
          {
            model: "ULX-D",
            quantity_hh: 2,
            quantity_bp: 1,
            provided_by: "festival",
          },
        ],
        iemSystems: [
          { model: "PSM 1000", quantity_hh: 4, provided_by: "band" },
          { model: "EW IEM", quantity: 2, provided_by: "band" },
        ],
      }),
    );

    expect(summary).toMatchObject({
      totalRf: 11,
      totalIem: 6,
      totalHh: 5,
      totalBp: 3,
      rfProvider: "Festival",
      iemProvider: "Banda",
      dominantProvider: "Festival",
      providerColor: "#3B82F6",
    });
  });

  it("falls back to the IEM provider and then Festival for empty inventories", () => {
    expect(
      summarizeArtistRfInventory(
        artist({
          iemSystems: [{ model: "PSM 1000", quantity: 2, provided_by: "mixed" }],
        }),
      ),
    ).toMatchObject({
      dominantProvider: "Mixto",
      providerColor: "#22C55E",
    });

    expect(summarizeArtistRfInventory(artist())).toMatchObject({
      totalRf: 0,
      totalIem: 0,
      dominantProvider: "Festival",
      providerColor: "#3B82F6",
    });
  });

  it("keeps the existing provider color mapping", () => {
    expect(getProviderColor("Banda")).toBe("#F59E0B");
    expect(getProviderColor("unknown")).toBe("#6B7280");
  });
});
