import type { DriverAssignmentFacts } from "../../driverAssignments.ts";

type Message = { title: string; text: string };

const MADRID = "Europe/Madrid";

export function formatDriverWindow(
  iso: string | null | undefined,
  timezone: string | null | undefined = MADRID,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const timeZone = timezone?.trim() || MADRID;
  try {
    const day = new Intl.DateTimeFormat("es-ES", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);
    const time = new Intl.DateTimeFormat("es-ES", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    return `${day}, ${time}`;
  } catch {
    return "";
  }
}

/** Compatibility helper for callers/tests that explicitly need Madrid time. */
export function formatMadridDriverWindow(iso: string | null | undefined): string {
  return formatDriverWindow(iso, MADRID);
}

const movementLabel = (eventType: string | null): string =>
  eventType === "unload" ? "Descarga" : eventType === "load" ? "Carga" : "Transporte";

function describeTransport(facts: DriverAssignmentFacts): string {
  const what = facts.eventTitle
    ? `${movementLabel(facts.eventType)} · ${facts.eventTitle}`
    : movementLabel(facts.eventType);
  const when = formatDriverWindow(facts.startsAt, facts.timezone);
  const vehicle = facts.vehicleName
    ? ` Vehículo: ${facts.vehicleName}${facts.vehiclePlate ? ` (${facts.vehiclePlate})` : ""}.`
    : "";
  return `${what}${when ? ` — ${when}` : ""}.${vehicle}`;
}

export function buildDriverAssignedMessage(facts: DriverAssignmentFacts, updated: boolean): Message {
  return {
    title: updated ? "Transporte actualizado" : "Nuevo transporte asignado",
    text: `${describeTransport(facts)} ${updated ? "Revisa los cambios y confírmalo." : "Confírmalo en tu panel."}`,
  };
}

export function buildDriverRemovedMessage(
  startsAt: string | null | undefined,
  timezone?: string | null,
): Message {
  const when = formatDriverWindow(startsAt, timezone);
  return {
    title: "Transporte retirado",
    text: when
      ? `Ya no tienes asignado el transporte del ${when}.`
      : "Se ha retirado uno de tus transportes asignados.",
  };
}

export function buildDriverResponseMessage(
  facts: DriverAssignmentFacts,
  driverName: string,
  confirmed: boolean,
): Message {
  const reason = !confirmed && facts.declineReason ? ` Motivo: ${facts.declineReason}` : "";
  return {
    title: confirmed ? "Transporte confirmado" : "Transporte rechazado",
    text: `${driverName} ${confirmed ? "confirmó" : "rechazó"}: ${describeTransport(facts)}${reason}`,
  };
}
