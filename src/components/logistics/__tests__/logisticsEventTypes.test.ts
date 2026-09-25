import { describe, expect, it } from "vitest";

import { isLogisticsEventOnDay, logisticsEventTypeLabel } from "../logisticsEventTypes";

describe("logistics event types", () => {
  it("labels every event type in Spanish", () => {
    expect(logisticsEventTypeLabel("load")).toBe("Carga");
    expect(logisticsEventTypeLabel("unload")).toBe("Descarga");
    expect(logisticsEventTypeLabel("crew_transfer")).toBe("Traslado de personal");
    expect(logisticsEventTypeLabel(null)).toBe("Transporte");
  });

  it("puts a multi-day transport on every day it spans", () => {
    const transfer = { event_date: "2026-10-01", end_date: "2026-10-03" };
    expect(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((day) => isLogisticsEventOnDay(transfer, day)))
      .toEqual([false, true, true, true, false]);
    expect(isLogisticsEventOnDay({ event_date: "2026-10-01", end_date: null }, "2026-10-02")).toBe(false);
    expect(isLogisticsEventOnDay({ event_date: "2026-10-01" }, "2026-10-01")).toBe(true);
  });
});
