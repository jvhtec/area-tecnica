import { describe, expect, it } from "vitest";

import { buildPowerCalculationSnapshot } from "@/features/technical-tools/power/powerCalculations";
import { mergeStoredPowerSnapshot } from "@/features/technical-tools/power/powerTableHydration";

describe("stored power snapshot merging", () => {
  it("falls back to valid table data when metadata fields are invalid", () => {
    const calculation = buildPowerCalculationSnapshot({
      powerFactorSource: "global",
      settings: {
        phaseMode: "three",
        powerFactor: 0.9,
        safetyMargin: 20,
        voltage: 400,
      },
      totalWatts: 1000,
    });

    expect(
      mergeStoredPowerSnapshot(
        {
          calculation: { ...calculation, currentLine: calculation.currentLine * 2 },
          pf: 2,
          safetyMargin: 120,
          phaseMode: "invalid" as "three",
          voltage: 0,
        },
        {
          calculation,
          pf: 0.9,
          safetyMargin: 20,
          phaseMode: "three",
          voltage: 400,
        },
      ),
    ).toEqual({
      calculation,
      pf: 0.9,
      safetyMargin: 20,
      phaseMode: "three",
      voltage: 400,
    });
  });
});
