import { describe, expect, it } from "vitest";

import { buildPowerCalculationSnapshot } from "@/features/technical-tools/power/powerCalculations";
import {
  buildLegacyPowerCalculationSnapshot,
  parsePowerCalculationSnapshot,
} from "@/features/technical-tools/power/powerSnapshots";

describe("power calculation snapshots", () => {
  it("accepts a self-consistent v2 snapshot and rejects tampered current", () => {
    const snapshot = buildPowerCalculationSnapshot({
      powerFactorSource: "global",
      settings: {
        phaseMode: "three",
        powerFactor: 0.9,
        safetyMargin: 20,
        voltage: 400,
      },
      totalWatts: 1000,
    });

    expect(parsePowerCalculationSnapshot(snapshot)).toEqual(snapshot);
    expect(
      parsePowerCalculationSnapshot({ ...snapshot, currentLine: snapshot.currentLine * 2 }),
    ).toBeUndefined();
  });

  it("uses lights row PF and row watts when reconstructing a mismatched legacy record", () => {
    const snapshot = buildLegacyPowerCalculationSnapshot({
      fallbackPowerFactor: 0.9,
      perRowPowerFactor: true,
      rows: [
        {
          quantity: "1",
          componentId: "fixture",
          watts: "1000",
          totalWatts: 1000,
          pf: "1.00",
        },
      ],
      settings: { phaseMode: "three", safetyMargin: 0, voltage: 400 },
      totalWatts: 900,
    });

    expect(snapshot.totalWatts).toBe(1000);
    expect(snapshot.totalVa).toBe(1000);
    expect(snapshot.isEstimate).toBe(true);
  });

  it("uses valid row watts when a global-PF legacy record has no stored total", () => {
    const snapshot = buildLegacyPowerCalculationSnapshot({
      fallbackPowerFactor: 0.95,
      perRowPowerFactor: false,
      rows: [
        {
          quantity: "2",
          componentId: "amp",
          watts: "500",
          totalWatts: 1000,
        },
      ],
      settings: {
        phaseMode: "single",
        powerFactor: 1,
        safetyMargin: 0,
        voltage: 230,
      },
      totalWatts: 0,
    });

    expect(snapshot.totalWatts).toBe(1000);
    expect(snapshot.totalVa).toBe(1000);
    expect(snapshot.currentLine).toBeCloseTo(1000 / 230);
  });
});
