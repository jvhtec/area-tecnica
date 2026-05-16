import { describe, expect, it } from "vitest";

import {
  calculateElectricalTotals,
  calculateMixedLoadApparentPower,
  calculatePowerRows,
  getPowerPduOptions,
  recommendPowerPdu,
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

  it("recommends department-specific PDU sizes using the shared planning limit", () => {
    expect(recommendPowerPdu(12, getPowerPduOptions("sound", "three"))).toBe("CEE16A 3P+N+G");
    expect(recommendPowerPdu(12, getPowerPduOptions("lights", "three"))).toBe("CEE32A 3P+N+G");
    expect(recommendPowerPdu(130, getPowerPduOptions("video", "three"))).toBe("Powerlock 400A 3P+N+G");
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
});
