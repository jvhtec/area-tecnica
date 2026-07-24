import { describe, expect, it } from "vitest";

import {
  buildPowerReportSummary,
  formatTechnicalReportDate,
  formatTechnicalReportNumber,
} from "@/utils/pdf/technicalDataReportModel";
import { buildPowerCalculationSnapshot } from "@/features/technical-tools/power/powerCalculations";

describe("technicalDataReportModel", () => {
  it("formats report numbers and dates in Spanish", () => {
    expect(formatTechnicalReportNumber(42100, 0)).toBe("42.100");
    expect(formatTechnicalReportNumber(49.53, 2)).toBe("49,53");
    expect(formatTechnicalReportDate("2026-07-10")).toBe("10 julio 2026");
    expect(formatTechnicalReportDate("24/07/2026")).toBe("24 julio 2026");
    expect(formatTechnicalReportDate("31/02/2026")).toBe("No disponible");
    expect(formatTechnicalReportDate("not-a-date")).toBe("No disponible");
  });

  it("does not invent a global current for multiple single-phase circuits", () => {
    const calculation = buildPowerCalculationSnapshot({
      powerFactorSource: "global",
      settings: {
        phaseMode: "single",
        powerFactor: 0.95,
        safetyMargin: 20,
        voltage: 230,
      },
      totalWatts: 1000,
    });
    const summary = buildPowerReportSummary([
      { calculation, name: "A", rows: [] },
      { calculation, name: "B", rows: [] },
    ]);

    expect(summary.currentLine).toBeNull();
    expect(summary.aggregationReason).toContain("asignación de fase");
    expect(summary.totalWatts).toBe(2000);
  });
});
