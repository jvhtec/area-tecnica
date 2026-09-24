import { EVENT_TYPES } from "../../config.ts";
import { getLogisticsManagementRecipients, getProfileDisplayName } from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

const PLANNING_STATUS_ES: Record<string, string> = {
  requested: "solicitado",
  reviewing: "en revisión",
  planned: "planificado",
  confirmed: "confirmado",
  completed: "completado",
  cancelled: "cancelado",
};

const planningStatusLabel = (status?: string): string =>
  (status && PLANNING_STATUS_ES[status]) || status || "actualizado";

/**
 * Production-side ownership and planning events: who is carrying a job, how a
 * transport request is progressing, and when a staffing campaign closes.
 */
export async function handleProductionEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { client, type, body, actor, jobTitle, state, audience, userId } = context;
  const { addRecipients, addNaturalRecipients, clearAllRecipients } = audience;
  const jobLabel = jobTitle || "Trabajo";

  if (type === EVENT_TYPES.JOB_PRODUCER_CLAIMED || type === EVENT_TYPES.JOB_PRODUCER_RELEASED) {
    const claimed = type === EVENT_TYPES.JOB_PRODUCER_CLAIMED;
    const producerName = body.producer_name
      || (await getProfileDisplayName(client, body.producer_id))
      || actor;
    const isSelfClaim = !body.producer_id || body.producer_id === (body.actor_id || userId);

    setBroadcastMessage(
      state,
      claimed ? "Responsable de producción" : "Responsable de producción liberado",
      claimed
        ? isSelfClaim
          ? `${producerName} es responsable de producción de "${jobLabel}".`
          : `${actor} ha asignado a ${producerName} como responsable de producción de "${jobLabel}".`
        : `${producerName} ya no es responsable de producción de "${jobLabel}".`,
    );

    // A claim is production bookkeeping, not staffing: tell the people already
    // attached to the job plus management, and never touch assignments.
    clearAllRecipients();
    addRecipients([userId]);
    addNaturalRecipients(Array.from(audience.participants));
    addNaturalRecipients(Array.from(audience.management));
    addNaturalRecipients([body.producer_id]);
    return true;
  }

  if (type === EVENT_TYPES.LOGISTICS_TRANSPORT_STATUS_CHANGED) {
    const status = planningStatusLabel(body.planning_status);
    setBroadcastMessage(
      state,
      "Transporte actualizado",
      `${actor} ha marcado el transporte de "${jobLabel}" como ${status}.`,
    );

    const logisticsIds = await getLogisticsManagementRecipients(client);
    clearAllRecipients();
    addRecipients([userId]);
    addNaturalRecipients(logisticsIds);
    addNaturalRecipients(Array.from(audience.participants));
    // The person who raised the request needs the outcome even if they are not
    // otherwise attached to the job.
    addNaturalRecipients([body.recipient_id]);
    return true;
  }

  if (type === EVENT_TYPES.STAFFING_CAMPAIGN_COMPLETED) {
    setBroadcastMessage(
      state,
      "Campaña de personal completada",
      `La campaña de personal de "${jobLabel}" ha cubierto todas las plazas.`,
    );

    clearAllRecipients();
    // The campaign's creator asked for it; department management owns the gap.
    addNaturalRecipients([body.recipient_id, body.actor_id]);
    addNaturalRecipients(Array.from(audience.management));
    return true;
  }

  return false;
}
