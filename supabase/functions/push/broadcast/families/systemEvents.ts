import { EVENT_TYPES } from "../../config.ts";
import { getAllUserIds } from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

const ANNOUNCEMENT_PREFIX: Record<string, string> = {
  info: "📣",
  warning: "⚠️",
  critical: "🚨",
};

/**
 * Platform-wide events that are not tied to a single job: announcements, bug
 * report outcomes, and the automated timesheet reminder.
 */
export async function handleSystemEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, actor, jobTitle, state, audience, userId } = context;
  const { addRecipients, addNaturalRecipients, clearAllRecipients } = audience;

  if (type === EVENT_TYPES.ANNOUNCEMENT_PUBLISHED) {
    const prefix = ANNOUNCEMENT_PREFIX[body.announcement_level ?? "info"] ?? "📣";
    const message = (body.description || body.title || "").trim();
    setBroadcastMessage(
      state,
      `${prefix} Aviso de la empresa`,
      message || `${actor} ha publicado un aviso.`,
    );

    // Announcements are the one family that deliberately reaches everyone, so the
    // audience is derived server-side rather than trusted from the caller. The
    // routing table still applies on top via applyRoutingOverrides.
    clearAllRecipients();
    addNaturalRecipients(await getAllUserIds(context.client));
    return true;
  }

  if (type === EVENT_TYPES.BUG_REPORT_RESOLVED) {
    const title = (body.title || "").trim();
    setBroadcastMessage(
      state,
      "Incidencia resuelta",
      title
        ? `Se ha resuelto la incidencia que reportaste: "${title}".`
        : "Se ha resuelto la incidencia que reportaste.",
    );

    clearAllRecipients();
    addRecipients([body.recipient_id]);
    return true;
  }

  if (type === EVENT_TYPES.TIMESHEET_REMINDER_DUE) {
    setBroadcastMessage(
      state,
      "Parte de horas pendiente",
      jobTitle
        ? `Tienes un parte de horas pendiente de enviar para "${jobTitle}".`
        : "Tienes un parte de horas pendiente de enviar.",
    );

    clearAllRecipients();
    addRecipients([body.recipient_id || body.technician_id || userId]);
    return true;
  }

  return false;
}
