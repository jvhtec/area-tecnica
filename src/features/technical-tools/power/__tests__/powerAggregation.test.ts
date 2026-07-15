import { describe, expect, it } from "vitest";

import { aggregatePowerCalculations } from "@/features/technical-tools/power/powerAggregation";
import { buildPowerCalculationSnapshot } from "@/features/technical-tools/power/powerCalculations";

const snapshot = (totalWatts: number, powerFactor: number, phaseMode: "single" | "three" = "three") =>
  buildPowerCalculationSnapshot({
    powerFactorSource: "global",
    settings: {
      phaseMode,
      powerFactor,
      safetyMargin: 0,
      voltage: phaseMode === "three" ? 400 : 230,
    },
    totalWatts,
  });

describe("power aggregation", () => {
  it("combines compatible balanced three-phase loads by summing P and Q", () => {
    const first = snapshot(1000, 1);
    const second = snapshot(1000, 0.8);
    const aggregate = aggregatePowerCalculations([
      { calculation: first },
      { calculation: second },
    ]);

    expect(aggregate.reason).toBeUndefined();
    expect(aggregate.adjustedWatts).toBe(2000);
    expect(aggregate.totalVa).toBeCloseTo(Math.hypot(2000, 750), 6);
    expect(aggregate.currentLine).toBeCloseTo(
      Math.hypot(2000, 750) / (Math.sqrt(3) * 400),
      6,
    );
  });

  it("does not add multiple single-phase currents without phase allocation", () => {
    const aggregate = aggregatePowerCalculations([
      { calculation: snapshot(1000, 0.9, "single") },
      { calculation: snapshot(1000, 0.9, "single") },
    ]);

    expect(aggregate.currentLine).toBeNull();
    expect(aggregate.totalVa).toBeNull();
    expect(aggregate.reason).toContain("asignación de fase");
  });

  it("does not fabricate totals for mixed supplies", () => {
    const aggregate = aggregatePowerCalculations([
      { calculation: snapshot(1000, 0.9, "single") },
      { calculation: snapshot(1000, 0.9, "three") },
    ]);

    expect(aggregate.currentLine).toBeNull();
    expect(aggregate.reason).toContain("monofásicos y trifásicos");
  });
});
