import { describe, expect, it } from "vitest";

import {
  calculateWeightRows,
  formatRiggingPoint,
  sumWeightRows,
} from "@/features/technical-tools/weights/weightCalculations";

describe("technical weight calculations", () => {
  it("calculates row totals from department component catalogs", () => {
    const rows = calculateWeightRows(
      [
        { quantity: "4", componentId: "1", weight: "10" },
        { quantity: "bad", componentId: "2", weight: "20" },
      ],
      [
        { id: 1, name: "Cabinet", weight: 10 },
        { id: 2, name: "Motor", weight: 20 },
      ],
    );

    expect(rows[0]).toMatchObject({ componentName: "Cabinet", totalWeight: 40 });
    expect(rows[1]).toMatchObject({ componentName: "Motor", totalWeight: 0 });
    expect(sumWeightRows(rows)).toBe(40);
  });

  it("formats department rigging point suffixes consistently", () => {
    expect(formatRiggingPoint("SX", 1)).toBe("SX01");
    expect(formatRiggingPoint("VX", 12)).toBe("VX12");
  });
});
