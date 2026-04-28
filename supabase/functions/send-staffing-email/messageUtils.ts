export type StaffingPhase = "availability" | "offer";
export type StaffingAction = "confirm" | "decline";

export interface BuildWhatsAppStaffingMessageArgs {
  phase: StaffingPhase;
  fullName?: string | null;
  jobTitle: string;
  roleLabel?: string | null;
  note?: string | null;
  normalizedDates: string[];
  isSingleDayRequest: boolean;
  targetDateLabel?: string | null;
  startDate: string;
  endDate?: string | null;
  callTime: string;
  location: string;
  tourPdfSignedUrl?: string | null;
  confirmUrl: string;
  declineUrl: string;
}

export function normalizeStaffingConfirmBase(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

export function buildPathStaffingActionUrl(
  base: string,
  action: StaffingAction,
  rid: string,
  token: string,
): string {
  const normalizedBase = normalizeStaffingConfirmBase(base);
  return `${normalizedBase}/${action}/${encodeURIComponent(rid)}/${encodeURIComponent(token)}`;
}

export function buildLegacyStaffingActionUrl(args: {
  base: string;
  rid: string;
  action: StaffingAction;
  exp: string;
  token: string;
  channel: "email" | "whatsapp";
}): string {
  const normalizedBase = normalizeStaffingConfirmBase(args.base);
  const params = new URLSearchParams({
    rid: args.rid,
    a: args.action,
    exp: args.exp,
    t: args.token,
    c: args.channel,
  });
  return `${normalizedBase}?${params.toString()}`;
}

export function buildWhatsAppStaffingMessage(
  args: BuildWhatsAppStaffingMessageArgs,
): string {
  const fullName = (args.fullName || "").trim();
  const jobTitle = args.jobTitle.trim() || "el trabajo";
  const note = (args.note || "").trim();
  const roleLabel = (args.roleLabel || "").trim();
  const lines: string[] = [fullName ? `Hola ${fullName},` : "Hola,"];

  if (args.phase === "availability") {
    lines.push(`Consulta de disponibilidad para ${jobTitle}.`);
  } else {
    lines.push(`Tienes una oferta para ${jobTitle}.`);
  }

  lines.push("");
  lines.push("Resumen:");

  if (roleLabel) {
    lines.push(`- Rol: ${roleLabel}`);
  }

  if (args.normalizedDates.length > 1) {
    lines.push("- Fechas:");
    args.normalizedDates.forEach((dateLabel) => {
      lines.push(`  • ${dateLabel}`);
    });
  } else if (args.isSingleDayRequest && args.targetDateLabel) {
    lines.push(`- Fecha: ${args.targetDateLabel}`);
  } else {
    lines.push(`- Fechas: ${args.startDate}${args.endDate ? ` — ${args.endDate}` : ""}`);
  }

  lines.push(`- Horario: ${args.callTime}`);
  lines.push(`- Ubicación: ${args.location}`);

  if (note) {
    lines.push("");
    lines.push(note);
  }

  if (args.tourPdfSignedUrl) {
    lines.push("");
    lines.push(`Calendario del tour (PDF): ${args.tourPdfSignedUrl}`);
  }

  lines.push("");
  if (args.phase === "availability") {
    lines.push(`Confirmar disponibilidad: ${args.confirmUrl}`);
    lines.push(`No disponible: ${args.declineUrl}`);
  } else {
    lines.push(`Aceptar oferta: ${args.confirmUrl}`);
    lines.push(`Rechazar oferta: ${args.declineUrl}`);
  }

  return lines.join("\n");
}
