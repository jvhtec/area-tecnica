import type { DriverAssignmentFacts } from "../../driverAssignments.ts";

type Message = { title: string; text: string };

const MADRID = "Europe/Madrid";

/** "jue, 1 oct, 08:00" in Madrid time, whatever the runtime's timezone. */
export function formatMadridDriverWindow(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${day}, ${time}`;
}

const movementLabel = (eventType: string | null): string =>
  eventType === "unload" ? "Descarga" : eventType === "load" ? "Carga" : "Transporte";

function describeTransport(facts: DriverAssignmentFacts): string {
  const what = facts.eventTitle
    ? `${movementLabel(facts.eventType)} · ${facts.eventTitle}`
    : movementLabel(facts.eventType);
  const when = formatMadridDriverWindow(facts.startsAt);
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

export function buildDriverRemovedMessage(startsAt: string | null | undefined): Message {
  const when = formatMadridDriverWindow(startsAt);
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
  return {
    title: confirmed ? "Transporte confirmado" : "Transporte rechazado",
    text: `${driverName} ${confirmed ? "confirmó" : "rechazó"}: ${describeTransport(facts)}`,
  };
}
