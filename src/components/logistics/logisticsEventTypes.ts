import type { Database } from "@/integrations/supabase/types";

type LogisticsEventRow = Database["public"]["Tables"]["logistics_events"]["Row"];

/**
 * `logistics_event_type`, including `crew_transfer` (20260925130000), which
 * postdates the generated types.
 */
export type LogisticsEventType = LogisticsEventRow["event_type"] | "crew_transfer";

export const LOGISTICS_EVENT_TYPE_OPTIONS: ReadonlyArray<{ value: LogisticsEventType; label: string }> = [
  { value: "load", label: "Carga" },
  { value: "unload", label: "Descarga" },
  { value: "crew_transfer", label: "Traslado de personal" },
];

export const logisticsEventTypeLabel = (eventType: string | null | undefined): string =>
  LOGISTICS_EVENT_TYPE_OPTIONS.find((option) => option.value === eventType)?.label ?? "Transporte";

/**
 * Whether a transport is on a calendar day (yyyy-MM-dd): its start date, or any
 * day up to its end when it has one. Plain date-key comparison, as event_date is
 * a DATE column.
 */
export const logisticsEventOverlapsRange = (
  event: { event_date: string; end_date?: string | null },
  startKey: string,
  endKey: string,
): boolean => {
  const eventEnd = event.end_date ?? event.event_date;
  return event.event_date <= endKey && eventEnd >= startKey;
};

export const isLogisticsEventOnDay = (
  event: { event_date: string; end_date?: string | null },
  dateKey: string,
): boolean => logisticsEventOverlapsRange(event, dateKey, dateKey);

export type LogisticsCalendarEvent = Omit<LogisticsEventRow, "event_type"> & {
  event_type: LogisticsEventType;
  departments: Array<{ department: string }>;
  job?: { id?: string; title: string } | null;
  /** The transport's own place (locations.id); for a crew transfer, its destination. Postdates the generated types. */
  location_id?: string | null;
  /** Sleeper buses only: berths this run provides; postdates the generated types. */
  berth_count?: number | null;
  /** Optional local end of the transport, both or neither; postdates the generated types. */
  end_date?: string | null;
  end_time?: string | null;
  /** Crew transfers only: pick-up point (locations.id); postdates the generated types. */
  origin_location_id?: string | null;
  /** Crew transfers only: people travelling; postdates the generated types. */
  passenger_count?: number | null;
  /** Loads/unloads: what the move is for (transport request movement type); postdates the generated types. */
  movement_type?: string | null;
};
