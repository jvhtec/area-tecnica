export type LogisticsCalendarScope = "all" | "material" | "personnel";
export function matchesLogisticsCalendarScope(event: { event_type: string }, scope: LogisticsCalendarScope) {
  return scope === "all" || (scope === "personnel" ? event.event_type === "crew_transfer" : event.event_type !== "crew_transfer");
}
