import { describe, expect, it } from "vitest";
import { matchesLogisticsCalendarScope } from "./calendarScope";
describe("logistics calendar scope", () => {
  it("shares the general calendar and separates personnel from material", () => {
    const events = [{ event_type: "load" }, { event_type: "crew_transfer" }, { event_type: "unload" }];
    expect(events.filter(event => matchesLogisticsCalendarScope(event, "all"))).toEqual(events);
    expect(events.filter(event => matchesLogisticsCalendarScope(event, "material"))).toEqual([events[0], events[2]]);
    expect(events.filter(event => matchesLogisticsCalendarScope(event, "personnel"))).toEqual([events[1]]);
  });
});
