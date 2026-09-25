/**
 * Plan checks for the logistics event dialog: an optional end for any transport,
 * and the extra fields of a crew transfer (traslado de personal). Pure helpers;
 * the database enforces the same rules (migration 20260925101000), these just
 * give a readable message before the round trip.
 */

/** Longest transport the database accepts, in days from start date to end date. */
export const MAX_TRANSPORT_SPAN_DAYS = 21;

export type TransportPlanInput = {
  eventType: string;
  /** yyyy-MM-dd / HH:mm, local wall-clock values as the form edits them. */
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  hasJob: boolean;
  originInput: string;
  destinationInput: string;
  passengerCount: number | null;
  /** A new crew transfer that should also create its return trip. */
  createReturn: boolean;
  returnDate: string;
  returnTime: string;
};

const at = (dateKey: string, time: string) => `${dateKey}T${time.slice(0, 5)}`;

const daysBetween = (fromKey: string, toKey: string) =>
  Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);

/** The first problem with the plan, in Spanish, or null when it can be saved. */
export const validateTransportPlan = (plan: TransportPlanInput): string | null => {
  if (Boolean(plan.endDate) !== Boolean(plan.endTime)) {
    return "Indica fecha y hora de fin, o deja ambas vacías.";
  }
  const start = at(plan.date, plan.time);
  if (plan.endDate && at(plan.endDate, plan.endTime) <= start) {
    return "El fin debe ser posterior a la salida.";
  }
  if (plan.endDate && daysBetween(plan.date, plan.endDate) > MAX_TRANSPORT_SPAN_DAYS) {
    return `Un transporte puede durar como máximo ${MAX_TRANSPORT_SPAN_DAYS} días.`;
  }
  if (plan.eventType !== "crew_transfer") return null;
  if (!plan.originInput.trim()) return "Indica el punto de encuentro.";
  if (!plan.hasJob && !plan.destinationInput.trim()) return "Indica el destino.";
  if (!plan.passengerCount) return "Indica cuántas personas viajan.";
  if (plan.createReturn) {
    if (!plan.returnDate || !plan.returnTime) return "Indica fecha y hora de la vuelta.";
    const outboundEnd = plan.endDate ? at(plan.endDate, plan.endTime) : start;
    if (at(plan.returnDate, plan.returnTime) <= outboundEnd) {
      return "La vuelta debe salir después de la ida.";
    }
  }
  return null;
};

type CrewTransferPlaces = {
  title?: string | null;
  event_date: string;
  event_time: string;
  end_date: string | null;
  end_time: string | null;
  origin_location_id: string | null;
  location_id: string | null;
};

/**
 * The return leg of a crew transfer: same passengers and vehicle type, origin and
 * destination swapped, its own departure and no end. `destinationId` is where the
 * outbound trip ends (its own place, else the job venue).
 */
export const buildReturnTrip = <T extends CrewTransferPlaces>(
  outbound: T,
  {
    destinationId,
    returnDate,
    returnTime,
    outboundTitle,
  }: { destinationId: string | null; returnDate: string; returnTime: string; outboundTitle: string },
): T => ({
  ...outbound,
  title: `${outboundTitle} · vuelta`,
  event_date: returnDate,
  event_time: returnTime,
  end_date: null,
  end_time: null,
  origin_location_id: destinationId,
  location_id: outbound.origin_location_id,
});
