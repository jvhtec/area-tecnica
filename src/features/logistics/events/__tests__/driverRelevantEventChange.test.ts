import { describe, expect, it } from "vitest";

import { DRIVER_RELEVANT_EVENT_FIELDS, isDriverRelevantEventChange } from "../driverRelevantEventChange";

const before = {
  event_type: "load",
  transport_type: "trailer",
  event_date: "2026-10-01",
  event_time: "08:00:00",
  timezone: "Europe/Madrid",
  job_id: "job-1",
  title: null,
  loading_bay: "Muelle 2",
  notes: null,
  location_id: "loc-1",
};

describe("isDriverRelevantEventChange", () => {
  it("ignores a save that changes nothing a driver acts on", () => {
    // The form sends HH:mm and "" where the row holds HH:mm:ss and null.
    expect(isDriverRelevantEventChange(before, { ...before, event_time: "08:00", title: "", notes: "  " })).toBe(false);
    // Fields the form does not send are treated as unchanged.
    const { timezone: _timezone, ...withoutTimezone } = before;
    expect(isDriverRelevantEventChange(before, withoutTimezone)).toBe(false);
  });

  it("flags every field the database trigger resets confirmations for", () => {
    const changed: Record<(typeof DRIVER_RELEVANT_EVENT_FIELDS)[number], string | null> = {
      event_type: "unload",
      transport_type: "furgoneta",
      event_date: "2026-10-02",
      event_time: "09:30",
      timezone: "Europe/London",
      job_id: null,
      title: "Recogida proveedor",
      loading_bay: "Muelle 3",
      notes: "Acceso por la puerta norte",
      location_id: "loc-2",
    };
    for (const field of DRIVER_RELEVANT_EVENT_FIELDS) {
      expect(isDriverRelevantEventChange(before, { ...before, [field]: changed[field] }), field).toBe(true);
    }
  });
});
