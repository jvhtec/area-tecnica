import { describe, expect, it } from "vitest";

import { getLogisticsTransportTypeLabel } from "@/components/technician/details-modal/formatters";
import { VEHICLE_TYPES, vehicleTypeLabel } from "@/features/logistics/fleet/fleetModel";

import { REQUEST_TRANSPORT_OPTIONS } from "../transportOptions";

describe("transport type options", () => {
  it("offer the company sleeper buses wherever a transport type is chosen", () => {
    expect(REQUEST_TRANSPORT_OPTIONS).toContain("sleeper_bus");
  });

  it("never show a raw value: every selectable type has a Spanish label", () => {
    const expected: Record<string, string> = {
      trailer: "Tráiler",
      "9m": "Camión 9m",
      "8m": "Camión 8m",
      "6m": "Camión 6m",
      "4m": "Camión 4m",
      furgoneta: "Furgoneta",
      sleeper_bus: "Autobús cama",
    };
    // A new option must be added here with its label, so it cannot ship untranslated.
    expect([...REQUEST_TRANSPORT_OPTIONS].sort()).toEqual(Object.keys(expected).sort());
    for (const option of REQUEST_TRANSPORT_OPTIONS) {
      expect(getLogisticsTransportTypeLabel(option), option).toBe(expected[option]);
    }
  });

  it("can all be registered as fleet vehicles", () => {
    for (const option of REQUEST_TRANSPORT_OPTIONS) {
      expect(VEHICLE_TYPES as readonly string[], option).toContain(option);
      expect(vehicleTypeLabel(option), option).not.toBe(option);
    }
  });
});
