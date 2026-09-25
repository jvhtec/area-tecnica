import type { LogisticsEventType } from "@/components/logistics/logisticsEventTypes";
import { dataLayerClient } from "@/services/dataLayerClient";

type BroadcastType = "logistics.event.created" | "logistics.event.updated" | "logistics.event.cancelled";

export type BroadcastableLogisticsEvent = {
  id: string;
  job_id: string | null;
  event_type: LogisticsEventType;
  event_date: string;
  event_time: string;
  title: string | null;
  transport_type: string;
  loading_bay: string | null;
  license_plate: string | null;
};

export type LogisticsEventLeg = Pick<BroadcastableLogisticsEvent, "event_type" | "event_date" | "event_time">;

export type LogisticsEventChanges = Record<string, { from?: unknown; to?: unknown }>;

/**
 * Push `logistics.event.*` for one event. Fire-and-forget: a failed push is
 * logged, never surfaced, as the save itself already succeeded.
 */
export async function broadcastLogisticsEvent(
  event: BroadcastableLogisticsEvent,
  {
    type = "logistics.event.created",
    departments,
    autoCreatedUnload,
    pairedEvent,
    changes,
  }: {
    type?: BroadcastType;
    departments: string[];
    autoCreatedUnload?: boolean;
    /** The other leg created together with this one (unload after load, return trip). */
    pairedEvent?: LogisticsEventLeg;
    changes?: LogisticsEventChanges;
  },
): Promise<void> {
  try {
    await dataLayerClient.functions.invoke("push", {
      body: {
        action: "broadcast",
        type,
        job_id: event.job_id || undefined,
        event_id: event.id,
        event_type: event.event_type,
        event_date: event.event_date,
        event_time: event.event_time,
        title: event.title,
        transport_type: event.transport_type,
        loading_bay: event.loading_bay,
        departments,
        license_plate: event.license_plate,
        auto_created_unload: autoCreatedUnload || undefined,
        paired_event_type: pairedEvent?.event_type,
        paired_event_date: pairedEvent?.event_date,
        paired_event_time: pairedEvent?.event_time,
        ...(changes ? { changes } : {}),
      },
    });
  } catch (pushError) {
    console.error(`Failed to broadcast logistics event ${type}`, pushError);
  }
}

type ComparableEvent = {
  event_type: string;
  event_date: string;
  event_time: string | null;
  transport_type: string | null;
  loading_bay?: string | null;
  license_plate?: string | null;
  is_hoja_relevant?: boolean | null;
  end_date?: string | null;
  end_time?: string | null;
  origin_location_id?: string | null;
  passenger_count?: number | null;
  movement_type?: string | null;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const blank = <T,>(value: T | null | undefined) => value ?? "";
const hhmm = (value: string | null | undefined) => (value ?? "").slice(0, 5);

/**
 * What an edit changed, for the `logistics.event.updated` push ("Cambios: Hora,
 * Fin…"). Undefined when nothing the recipients care about changed.
 */
export function diffLogisticsEventChanges(
  before: ComparableEvent,
  after: ComparableEvent,
  lists: { categories: [string[], string[]]; departments: [string[], string[]] },
): LogisticsEventChanges | undefined {
  const changes: LogisticsEventChanges = {};
  const track = (field: keyof ComparableEvent, changed: boolean) => {
    if (changed) changes[field] = { from: before[field], to: after[field] };
  };
  track("event_type", before.event_type !== after.event_type);
  track("event_date", before.event_date !== after.event_date);
  track("event_time", hhmm(before.event_time) !== hhmm(after.event_time));
  track("end_date", blank(before.end_date) !== blank(after.end_date));
  track("end_time", hhmm(before.end_time) !== hhmm(after.end_time));
  track("transport_type", blank(before.transport_type) !== blank(after.transport_type));
  track("loading_bay", blank(before.loading_bay) !== blank(after.loading_bay));
  track("license_plate", blank(before.license_plate) !== blank(after.license_plate));
  track("origin_location_id", blank(before.origin_location_id) !== blank(after.origin_location_id));
  track("passenger_count", blank(before.passenger_count) !== blank(after.passenger_count));
  track("movement_type", blank(before.movement_type) !== blank(after.movement_type));
  const previousHojaRelevant = before.is_hoja_relevant ?? true;
  if (previousHojaRelevant !== (after.is_hoja_relevant ?? true)) {
    changes.is_hoja_relevant = { from: previousHojaRelevant, to: after.is_hoja_relevant };
  }
  const [previousCategories, nextCategories] = lists.categories.map((list) => [...list].sort());
  if (!same(previousCategories, nextCategories)) {
    changes.hoja_categories = { from: previousCategories, to: nextCategories };
  }
  const [previousDepartments, nextDepartments] = lists.departments.map((list) => [...list].sort());
  if (!same(previousDepartments, nextDepartments)) {
    changes.departments = { from: previousDepartments, to: nextDepartments };
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}
