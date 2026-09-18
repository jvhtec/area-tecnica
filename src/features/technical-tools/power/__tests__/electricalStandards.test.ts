import { describe, expect, it } from "vitest";

import {
  evaluatePowerStandards,
  ITC_BT_44_DISCHARGE_VA_FACTOR,
  NOMINAL_LINE_TO_LINE_VOLTAGE,
  NOMINAL_LINE_TO_NEUTRAL_VOLTAGE,
} from "@/features/technical-tools/power/electricalStandards";
import { getVoltageForPhase } from "@/features/technical-tools/power/powerCalculations";
import {
  POWER_CALCULATION_VERSION,
  type PowerCalculationSnapshot,
} from "@/features/technical-tools/power/types";

const snapshot = (
  patch: Partial<PowerCalculationSnapshot> = {},
): PowerCalculationSnapshot => ({
  version: POWER_CALCULATION_VERSION,
  totalWatts: 10000,
  adjustedWatts: 10000,
  totalVa: 11111.11,
  currentLine: 16.04,
  safetyMargin: 0,
  phaseMode: "three",
  voltage: NOMINAL_LINE_TO_LINE_VOLTAGE,
  powerFactor: 0.9,
  powerFactorSource: "global",
  isEstimate: false,
  ...patch,
});

const codes = (findings: { code: string }[]) => findings.map((finding) => finding.code);

describe("Spanish/EU electrical design rules", () => {
  it("uses the UNE-EN 60038 nominal voltages for both phase modes", () => {
    expect(getVoltageForPhase("single")).toBe(NOMINAL_LINE_TO_NEUTRAL_VOLTAGE);
    expect(getVoltageForPhase("three")).toBe(NOMINAL_LINE_TO_LINE_VOLTAGE);
    expect(NOMINAL_LINE_TO_NEUTRAL_VOLTAGE).toBe(230);
    expect(NOMINAL_LINE_TO_LINE_VOLTAGE).toBe(400);
  });

  it("raises the ITC-BT-44 floor when discharge lamps are sized on power factor alone", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot(),
      rows: [
        { quantity: "5", watts: "2000", totalWatts: 10000, pf: "0.90", fixtureType: "discharge" },
      ],
    });

    expect(assessment.dischargeWatts).toBe(10000);
    expect(assessment.regulatoryMinimumVa).toBeCloseTo(18000, 6);
    expect(assessment.regulatoryMinimumCurrent).toBeCloseTo(
      18000 / (Math.sqrt(3) * 400),
      6,
    );
    expect(codes(assessment.findings)).toContain("itc-bt-44-discharge");
  });

  it("applies the planning margin to the regulatory floor and combines mixed rows", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot({ safetyMargin: 20, totalWatts: 11000, adjustedWatts: 13200 }),
      rows: [
        { quantity: "1", watts: "10000", totalWatts: 10000, pf: "0.90", fixtureType: "discharge" },
        { quantity: "1", watts: "1000", totalWatts: 1000, pf: "1.00", fixtureType: "incandescent" },
      ],
    });

    // 1,2 x (1,8 x 10 000 + 1 000 VA of unity-PF load)
    expect(assessment.regulatoryMinimumVa).toBeCloseTo(
      1.2 * (ITC_BT_44_DISCHARGE_VA_FACTOR * 10000 + 1000),
      6,
    );
  });

  it("stays quiet when no row declares a discharge source", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot(),
      rows: [{ quantity: "1", watts: "10000", totalWatts: 10000, pf: "0.90", fixtureType: "led" }],
    });

    expect(assessment.regulatoryMinimumVa).toBeNull();
    expect(codes(assessment.findings)).not.toContain("itc-bt-44-discharge");
  });

  it("does not flag a discharge table already sized above the regulatory floor", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot({ totalVa: 20000 }),
      rows: [
        { quantity: "1", watts: "10000", totalWatts: 10000, pf: "0.90", fixtureType: "discharge" },
      ],
    });

    expect(assessment.regulatoryMinimumVa).toBeCloseTo(18000, 6);
    expect(codes(assessment.findings)).not.toContain("itc-bt-44-discharge");
  });

  it("only escalates the discharge floor once it stops fitting the recommended PDU", () => {
    const rows = [
      { quantity: "1", watts: "10000", totalWatts: 10000, pf: "0.90", fixtureType: "discharge" },
    ];
    // 18 kVA at 400 V three-phase needs ~25,98 A of line current.
    const overCapacity = evaluatePowerStandards({
      calculation: snapshot(),
      pduLimitCurrent: 25.6, // 32 A x 0,80
      rows,
    });
    const withinCapacity = evaluatePowerStandards({
      calculation: snapshot(),
      pduLimitCurrent: 50.4, // 63 A x 0,80
      rows,
    });

    expect(overCapacity.findings[0].severity).toBe("warning");
    expect(overCapacity.findings[0].message).toContain("no cubre ese mínimo reglamentario");
    expect(withinCapacity.findings[0].severity).toBe("info");
    expect(withinCapacity.findings[0].message).not.toContain("no cubre");
  });

  it("warns about neutral loading once non-linear load passes a third of a 3-phase table", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot(),
      rows: [
        { quantity: "1", watts: "6000", totalWatts: 6000, pf: "0.90", fixtureType: "led" },
        { quantity: "1", watts: "4000", totalWatts: 4000, pf: "1.00", fixtureType: "incandescent" },
      ],
    });

    expect(assessment.nonLinearWattsShare).toBeCloseTo(0.6, 6);
    expect(codes(assessment.findings)).toContain("itc-bt-19-neutral-harmonics");
    expect(
      assessment.findings.find((finding) => finding.code === "itc-bt-19-neutral-harmonics")
        ?.severity,
    ).toBe("info");
  });

  it("does not warn about neutral loading on a mostly resistive rig", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot(),
      rows: [
        { quantity: "1", watts: "2000", totalWatts: 2000, pf: "0.90", fixtureType: "led" },
        { quantity: "1", watts: "8000", totalWatts: 8000, pf: "1.00", fixtureType: "incandescent" },
      ],
    });

    expect(codes(assessment.findings)).not.toContain("itc-bt-19-neutral-harmonics");
  });

  it("leaves the neutral check out of single-phase tables and of untyped rows", () => {
    const singlePhase = evaluatePowerStandards({
      calculation: snapshot({ phaseMode: "single", voltage: 230 }),
      rows: [{ quantity: "1", watts: "3000", totalWatts: 3000, pf: "0.90", fixtureType: "led" }],
    });
    const untyped = evaluatePowerStandards({
      calculation: snapshot(),
      rows: [{ quantity: "1", watts: "10000", totalWatts: 10000 }],
    });

    expect(codes(singlePhase.findings)).not.toContain("itc-bt-19-neutral-harmonics");
    expect(untyped.nonLinearWattsShare).toBeNull();
    expect(codes(untyped.findings)).toHaveLength(0);
  });

  it("reminds that the hoist feed is sized separately at 125 %", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot(),
      includesHoist: true,
      rows: [{ quantity: "1", watts: "10000", totalWatts: 10000 }],
    });

    expect(codes(assessment.findings)).toEqual(["itc-bt-47-motor-feed"]);
    expect(assessment.findings[0].message).toContain("125");
  });

  it("falls back to the table power factor when a row carries none", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot({ powerFactor: 0.8 }),
      rows: [
        { quantity: "1", watts: "1000", totalWatts: 1000, fixtureType: "discharge" },
        { quantity: "1", watts: "1000", totalWatts: 1000 },
      ],
    });

    // 1,8 x 1 000 + 1 000/0,8 for the row that inherits the table PF.
    expect(assessment.regulatoryMinimumVa).toBeCloseTo(1800 + 1250, 6);
  });

  it("ignores rows with no usable load", () => {
    const assessment = evaluatePowerStandards({
      calculation: snapshot(),
      rows: [
        { quantity: "", watts: "", fixtureType: "discharge" },
        { quantity: "0", watts: "2000", fixtureType: "discharge" },
      ],
    });

    expect(assessment.dischargeWatts).toBe(0);
    expect(assessment.regulatoryMinimumVa).toBeNull();
  });
});
