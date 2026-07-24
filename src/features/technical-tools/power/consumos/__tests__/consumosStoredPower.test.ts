import { describe, expect, it } from "vitest";

import {
  getBooleanField,
  getPowerTableRows,
  getStringField,
  toStoredPowerFields,
} from "../consumosStoredPower";

describe("consumos stored power normalization", () => {
  it("keeps valid power rows and rejects malformed persisted rows", () => {
    const rows = getPowerTableRows({
      rows: [
        { componentId: "amp-1", quantity: "2", watts: "800" },
        { componentId: 42, quantity: "1", watts: "200" },
        null,
      ],
    });

    expect(rows).toEqual([
      { componentId: "amp-1", quantity: "2", watts: "800" },
    ]);
  });

  it("normalizes only supported snapshot and metadata values", () => {
    expect(
      toStoredPowerFields({
        calculation: { totalWatts: 1600 },
        pf: 0.9,
        phaseMode: "three",
        safetyMargin: 20,
        voltage: 400,
        rows: [{ componentId: "amp-1", quantity: "2", watts: "800" }],
      }),
    ).toEqual({
      calculation: { totalWatts: 1600 },
      pf: 0.9,
      phaseMode: "three",
      safetyMargin: 20,
      voltage: 400,
      rows: [{ componentId: "amp-1", quantity: "2", watts: "800" }],
    });

    expect(getStringField({ position: "FOH" }, "position")).toBe("FOH");
    expect(getStringField({ position: 4 }, "position")).toBeUndefined();
    expect(getBooleanField({ includes_hoist: true }, "includes_hoist")).toBe(true);
    expect(getBooleanField({ includes_hoist: "yes" }, "includes_hoist")).toBe(false);
  });
});
