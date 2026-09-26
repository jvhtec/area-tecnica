/**
 * What a transport is for, shared by transport requests (`transport_requests.movement_type`)
 * and the loads/unloads planned from them (`logistics_events.movement_type`). The event
 * type (carga / descarga / traslado de personal) says what happens at that stop; this
 * says why the goods move.
 */
export const TRANSPORT_MOVEMENT_TYPES = ["transfer", "pickup", "delivery", "return", "other"] as const;

export type TransportMovementType = (typeof TRANSPORT_MOVEMENT_TYPES)[number];

export const TRANSPORT_MOVEMENT_LABELS: Record<TransportMovementType, string> = {
  transfer: "Traslado",
  pickup: "Recogida",
  delivery: "Entrega",
  return: "Devolución",
  other: "Otro",
};

export const isTransportMovementType = (value: unknown): value is TransportMovementType =>
  typeof value === "string" && (TRANSPORT_MOVEMENT_TYPES as readonly string[]).includes(value);

/** "Recogida", or null for an unknown or missing value. */
export const transportMovementLabel = (value: unknown): string | null =>
  isTransportMovementType(value) ? TRANSPORT_MOVEMENT_LABELS[value] : null;
