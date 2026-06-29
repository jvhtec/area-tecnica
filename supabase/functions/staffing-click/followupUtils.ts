export type StaffingClickPhase = "availability" | "offer";
export type StaffingClickStatus = "confirmed" | "declined";

export function shouldSendStaffingClickWhatsappFollowup(
  channelHint: string,
  whatsappSend: unknown,
): boolean {
  return channelHint === "whatsapp" || Boolean(whatsappSend);
}

export function buildStaffingClickWhatsappFollowupMessage(
  phase: StaffingClickPhase | string,
  status: StaffingClickStatus,
): string {
  if (phase === "offer") {
    if (status === "confirmed") {
      return "Gracias por confirmar este trabajo con nosotros, la oferta queda cerrada y has sido añadido al equipo para este bolo, el departamento de producción te contactará más adelante con más detalles, saludos!";
    }

    return "Lamentamos que no estés disponible, en otra ocasión será. Gracias igualmente.";
  }

  if (status === "confirmed") {
    return "Gracias por confirmar tu disponibilidad, recibirás otro mensaje con una oferta formal y más detalles de confirmarse el trabajo.";
  }

  return "Lamentamos que no estés disponible, en otra ocasión será, gracias igualmente.";
}
