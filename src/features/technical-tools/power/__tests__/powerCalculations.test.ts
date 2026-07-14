import { describe, expect, it } from "vitest";

import {
  createCalculatedPowerTable,
  calculateElectricalTotals,
  calculateMixedLoadApparentPower,
  calculatePowerRows,
  getPowerPduOptions,
  recommendPowerPdu,
  PowerCalculationValidationError,
} from "@/features/technical-tools/power/powerCalculations";

describe("technical power calculations", () => {
  it("calculates single-phase current with safety margin and power factor", () => {
    const totals = calculateElectricalTotals({
      settings: {
        phaseMode: "single",
        powerFactor: 0.9,
        safetyMargin: 20,
        voltage: 230,
      },
      totalWatts: 2070,
    });

    expect(totals.adjustedWatts).toBe(2484);
    expect(totals.totalVa).toBeCloseTo(2760, 3);
    expect(totals.currentLine).toBeCloseTo(12, 3);
  });

  it("guards invalid voltage and power factor without returning infinite current", () => {
    const invalidPowerFactorTotals = calculateElectricalTotals({
      settings: {
        phaseMode: "three",
        powerFactor: 0,
        safetyMargin: 20,
        voltage: 400,
      },
      totalWatts: 1000,
    });

    expect(invalidPowerFactorTotals.totalVa).toBe(1200);
    expect(invalidPowerFactorTotals.currentLine).toBe(0);

    const invalidVoltageTotals = calculateElectricalTotals({
      rawApparentPowerVa: 900,
      settings: {
        phaseMode: "single",
        safetyMargin: 10,
        voltage: 0,
      },
      totalWatts: 800,
    });

    expect(invalidVoltageTotals.totalVa).toBeCloseTo(990, 3);
    expect(invalidVoltageTotals.currentLine).toBe(0);
  });

  it("recommends department-specific PDU sizes using the shared planning limit", () => {
    expect(recommendPowerPdu(12, getPowerPduOptions("sound", "three"))).toBe("CEE16A 3P+N+G");
    expect(recommendPowerPdu(12, getPowerPduOptions("lights", "three"))).toBe("CEE32A 3P+N+G");
    expect(recommendPowerPdu(130, getPowerPduOptions("video", "three"))).toBe("Powerlock 400A 3P+N+G");
  });

  it("does not present an undersized PDU when every listed option is over capacity", () => {
    const options = getPowerPduOptions("sound", "single");

    expect(recommendPowerPdu(70, options)).toBe("");
  });

  it("keeps mixed lights apparent power as a vector sum", () => {
    const rows = calculatePowerRows(
      [
        { quantity: "1", componentId: "inc", watts: "1000", pf: "1.00" },
        { quantity: "1", componentId: "led", watts: "1000", pf: "0.90" },
      ],
      [
        { id: "inc", name: "Incandescent", watts: 1000 },
        { id: "led", name: "LED", watts: 1000 },
      ],
    );

    const totalVa = calculateMixedLoadApparentPower(rows, (row) => Number(row.pf));

    expect(totalVa).toBeCloseTo(2057.8, 1);
  });

  it("rejects non-positive row and supply inputs before creating a table", () => {
    expect(() =>
      createCalculatedPowerTable({
        components: [{ id: "amp", name: "Amp", watts: 1000 }],
        currentTable: {
          rows: [{ quantity: "-1", componentId: "amp", watts: "1000" }],
          position: undefined,
          customPosition: undefined,
        },
        id: "invalid",
        name: "Invalid",
        pduOptions: getPowerPduOptions("sound", "single"),
        settings: {
          phaseMode: "single",
          powerFactor: 0.9,
          safetyMargin: 20,
          voltage: 0,
        },
      }),
    ).toThrow(PowerCalculationValidationError);
  });

  it("stores a reproducible v2 calculation snapshot", () => {
    const table = createCalculatedPowerTable({
      components: [{ id: "amp", name: "Amp", watts: 2070 }],
      currentTable: {
        rows: [{ quantity: "1", componentId: "amp", watts: "2070" }],
        position: undefined,
        customPosition: undefined,
      },
      id: "valid",
      name: "Valid",
      pduOptions: getPowerPduOptions("sound", "single"),
      settings: {
        phaseMode: "single",
        powerFactor: 0.9,
        safetyMargin: 20,
        voltage: 230,
      },
    });

    expect(table.calculation).toMatchObject({
      version: 2,
      totalWatts: 2070,
      adjustedWatts: 2484,
      totalVa: 2760,
      currentLine: 12,
      phaseMode: "single",
      voltage: 230,
      powerFactor: 0.9,
      powerFactorSource: "global",
      isEstimate: false,
    });
  });
});
