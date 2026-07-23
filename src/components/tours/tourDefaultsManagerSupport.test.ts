import { describe, expect, it } from "vitest";

import type { TourDefaultTable } from "@/hooks/useTourDefaultSets";
import {
  getPowerValue,
  getTableName,
  getTourDateLocationName,
  getWeightValue,
  isNewFormatTable,
} from "./tourDefaultsManagerSupport";

const newTable: TourDefaultTable = {
  id: "table-1",
  set_id: "set-1",
  table_name: "Main PA",
  table_data: { rows: [] },
  table_type: "power",
  total_value: 12000,
  metadata: {},
  created_at: "2026-07-23T00:00:00Z",
  updated_at: "2026-07-23T00:00:00Z",
};

describe("tour defaults manager support", () => {
  it("distinguishes stored tables and reports their values", () => {
    expect(isNewFormatTable(newTable)).toBe(true);
    expect(getTableName(newTable)).toBe("Main PA");
    expect(getPowerValue(newTable)).toBe(12000);
  });

  it("normalizes legacy weight totals and joined location shapes", () => {
    const legacyWeight = {
      id: "weight-1",
      tour_id: "tour-1",
      item_name: "Motor",
      weight_kg: 25,
      quantity: 4,
      created_at: "2026-07-23T00:00:00Z",
      updated_at: "2026-07-23T00:00:00Z",
    };

    expect(getWeightValue(legacyWeight)).toBe(100);
    expect(
      getTourDateLocationName({
        id: "date-1",
        date: "2026-07-23",
        locations: [{ name: "Arena" }],
      }),
    ).toBe("Arena");
    expect(
      getTourDateLocationName({
        id: "date-2",
        date: "2026-07-24",
        locations: null,
      }),
    ).toBe("Ubicación desconocida");
  });
});
