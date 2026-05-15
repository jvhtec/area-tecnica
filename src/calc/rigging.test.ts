import { describe, expect, it } from "vitest";

import { solveTrussWithTilt, type TrussModel } from "./rigging";

const baseTruss: TrussModel = {
  id: "test",
  name: "Test truss",
  lengthM: 8,
  selfWeightKgPerM: 8,
  EI: 3.2e9,
  allowableM_Nm: 1,
  allowableDeflectionM: 0.001,
};

const loadCase = {
  fixtures: [{ x: 4, weightKg: 20, qty: 1 }],
  dynamicFactor: 1,
};

const supports = [
  { x: 0.8, label: "H1" },
  { x: 7.2, label: "H2" },
];

describe("solveTrussWithTilt safety gating", () => {
  it("does not emit pass/fail checks for unverified truss allowables", () => {
    const result = solveTrussWithTilt(
      { ...baseTruss, allowablesVerified: false },
      loadCase,
      { supports },
    );

    expect(result.okAgainstAllowables.moment).toBeUndefined();
    expect(result.okAgainstAllowables.deflection).toBeUndefined();
  });

  it("emits pass/fail checks only when a truss model is explicitly verified", () => {
    const result = solveTrussWithTilt(
      { ...baseTruss, allowablesVerified: true },
      loadCase,
      { supports },
    );

    expect(typeof result.okAgainstAllowables.moment).toBe("boolean");
    expect(typeof result.okAgainstAllowables.deflection).toBe("boolean");
  });
});
