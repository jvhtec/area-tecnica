import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: { functions: { invoke: vi.fn() } } }));

import { diffLogisticsEventChanges } from "../logisticsEventBroadcast";

const base = {
  event_type: "crew_transfer",
  event_date: "2026-10-01",
  event_time: "08:00:00",
  transport_type: "furgoneta",
  loading_bay: null,
  license_plate: null,
  is_hoja_relevant: true,
  end_date: "2026-10-03",
  end_time: "20:00:00",
  origin_location_id: "nave",
  passenger_count: 6,
};
const lists = { categories: [[], []] as [string[], string[]], departments: [["sound"], ["sound"]] as [string[], string[]] };

describe("diffLogisticsEventChanges", () => {
  it("ignores form formatting and reports nothing when nothing changed", () => {
    expect(diffLogisticsEventChanges(base, { ...base, event_time: "08:00", end_time: "20:00", loading_bay: "" }, lists)).toBeUndefined();
  });

  it("reports the crew-transfer fields drivers and crew care about", () => {
    const changes = diffLogisticsEventChanges(base, { ...base, end_date: "2026-10-04", passenger_count: 8, origin_location_id: "hotel" }, lists);
    expect(Object.keys(changes ?? {})).toEqual(["end_date", "origin_location_id", "passenger_count"]);
    expect(diffLogisticsEventChanges({ ...base, movement_type: "pickup" }, { ...base, movement_type: "return" }, lists))
      .toEqual({ movement_type: { from: "pickup", to: "return" } });
    expect(changes?.passenger_count).toEqual({ from: 6, to: 8 });
  });

  it("compares departments and categories as sets", () => {
    expect(diffLogisticsEventChanges(base, base, { ...lists, departments: [["sound", "lights"], ["lights", "sound"]] })).toBeUndefined();
    expect(diffLogisticsEventChanges(base, base, { ...lists, departments: [["sound"], ["lights"]] }))
      .toEqual({ departments: { from: ["sound"], to: ["lights"] } });
  });
});
