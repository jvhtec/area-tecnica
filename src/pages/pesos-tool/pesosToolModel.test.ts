import { describe, expect, it } from "vitest";

import { assignSuffixes, deriveBaseName, getRiggingPointNumbers, type Table } from "@/pages/pesos-tool/pesosToolModel";

const table = (overrides: Partial<Table> = {}): Table => ({
  name: "Cluster",
  rows: [],
  ...overrides,
});

describe("pesosToolModel", () => {
  it("derives stable base names and extracts persisted rigging points", () => {
    expect(deriveBaseName("Main PA (SX01, SX02)")).toBe("Main PA");
    expect(getRiggingPointNumbers("SX01, SX002, invalid")).toEqual([1, 2]);
  });

  it("allocates dual motors and keeps counters independent per stage", () => {
    const result = assignSuffixes([
      table({ stageNumber: 1, dualMotors: true }),
      table({ stageNumber: 1 }),
      table({ stageNumber: 2 }),
    ]);

    expect(result.map((item) => item.riggingPoints)).toEqual(["SX01, SX02", "SX03", "SX01"]);
  });

  it("preserves persisted identifiers and advances the following counter", () => {
    const result = assignSuffixes([
      table({ defaultTableId: "default-1", riggingPoints: "SX04, SX05" }),
      table(),
    ]);

    expect(result[0].riggingPoints).toBe("SX04, SX05");
    expect(result[1].riggingPoints).toBe("SX06");
  });
});
