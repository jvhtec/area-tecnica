import { describe, expect, it } from "vitest";

import {
  assessPowerTableStandards,
  getPowerPduPlanningLimit,
} from "@/features/technical-tools/power/powerStandardsAssessment";
import {
  POWER_CALCULATION_VERSION,
  type PowerCalculationSnapshot,
  type PowerTable,
} from "@/features/technical-tools/power/types";

const calculation: PowerCalculationSnapshot = {
  version: POWER_CALCULATION_VERSION,
  totalWatts: 10000,
  adjustedWatts: 10000,
  totalVa: 11111.11,
  currentLine: 16.04,
  safetyMargin: 0,
  phaseMode: "three",
  voltage: 400,
  powerFactor: 0.9,
  powerFactorSource: "global",
  isEstimate: false,
};

const dischargeTable = (patch: Partial<PowerTable> = {}): PowerTable => ({
  name: "Escenario",
  rows: [
    {
      quantity: "5",
      componentId: "8",
      watts: "2000",
      totalWatts: 10000,
      pf: "0.90",
      fixtureType: "discharge",
    },
  ],
  calculation,
  pduType: "CEE32A 3P+N+G",
  ...patch,
});

describe("power standards assessment", () => {
  it("reads the planning limit from a listed PDU label and rejects unparseable ones", () => {
    expect(getPowerPduPlanningLimit("CEE32A 3P+N+G")).toBeCloseTo(25.6, 6);
    expect(getPowerPduPlanningLimit("Powerlock 400A 3P+N+G")).toBeCloseTo(320, 6);
    expect(getPowerPduPlanningLimit("PDU de casa")).toBeNull();
    expect(getPowerPduPlanningLimit("")).toBeNull();
  });

  it("warns when the regulatory floor overruns the recommended PDU", () => {
    const assessment = assessPowerTableStandards(dischargeTable());

    // 18 kVA needs ~25,98 A, past the 25,6 A planning limit of a CEE32A.
    expect(assessment?.findings[0].code).toBe("itc-bt-44-discharge");
    expect(assessment?.findings[0].severity).toBe("warning");
  });

  it("stays informational once a larger PDU is selected by hand", () => {
    const assessment = assessPowerTableStandards(
      dischargeTable({ customPduType: "CEE63A 3P+N+G" }),
    );

    expect(assessment?.findings[0].severity).toBe("info");
  });

  it("returns nothing for a table without a reproducible snapshot", () => {
    expect(assessPowerTableStandards(dischargeTable({ calculation: undefined }))).toBeNull();
  });
});
