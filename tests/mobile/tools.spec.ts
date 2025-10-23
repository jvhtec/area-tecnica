import { describe, expect, it } from "vitest";
import { solveTrussWithTilt, suggestHoists } from "@/calc/rigging";

describe("mobile rigging calculator", () => {
  it("balances the load path and recommends appropriately rated hoists", () => {
    const truss = {
      id: "x12",
      name: "12m HD Box Truss",
      lengthM: 12,
      selfWeightKgPerM: 8,
      EI: 5.8e6,
      allowableM_Nm: 2.5e6,
      allowableDeflectionM: 0.5,
    };

    const loadCase = {
      fixtures: [
        { x: 3, weightKg: 120, qty: 1, name: "Spot 1" },
        { x: 9, weightKg: 80, qty: 1, name: "Spot 2" },
      ],
      includeMotorWeightOnTruss: true,
      motorWeightKgEach: 30,
      dynamicFactor: 1.2,
    } as const;

    const supports = [
      { x: 0, label: "H1" },
      { x: 12, label: "H2" },
    ] as const;

    const result = solveTrussWithTilt(truss, loadCase, {
      supports: supports.map((support) => ({ x: support.x, label: support.label })),
      tiltDeg: 1.5,
      nElements: 24,
    });

    const totalReactionKg = result.supportReactionsKg.reduce((sum, reaction) => sum + reaction, 0);
    const expectedTotalKg = 144 + 96 + 96 + 60; // fixtures + self weight + smeared motors

    expect(totalReactionKg).toBeCloseTo(expectedTotalKg, 1);
    expect(result.supportLabels).toEqual(["H1", "H2"]);
    expect(result.maxDeflectionM).toBeGreaterThan(0);
    expect(result.okAgainstAllowables.moment).toBe(true);
    expect(result.okAgainstAllowables.deflection).toBe(true);

    const recommendations = suggestHoists(result.supportReactionsKg, [
      { id: "a", name: "250 kg D8", WLL_kg: 250 },
      { id: "b", name: "500 kg D8+", WLL_kg: 500 },
    ]);

    expect(recommendations).toHaveLength(result.supportReactionsKg.length);
    recommendations.forEach((rec, index) => {
      expect(rec.support).toBe(`H${index + 1}`);
      expect(rec.hoist.WLL_kg).toBeGreaterThanOrEqual(result.supportReactionsKg[index]);
    });
  });
});
