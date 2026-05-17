import { EVENT_TYPES } from "../../config.ts";
import {
  getAdminUserIds,
  getManagementByDepartmentUserIds,
  getProfileDisplayName,
  getTimesheetSubmittingTechDepartment,
} from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleTimesheetEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, actor, jobId, jobTitle, recipName, state, audience, userId } = context;
  const { addRecipients, addNaturalRecipients, clearAllRecipients } = audience;

  if (type === 'timesheet.submitted') {
    setBroadcastMessage(
      state,
      'Parte enviado',
      `${actor} ha rellenado su hoja de horas para "${jobTitle || 'Trabajo'}".`,
    );

    const dept = await getTimesheetSubmittingTechDepartment(context.client, jobId || null, body.actor_id || userId);
    const adminIds = await getAdminUserIds(context.client);
    const mgmtDeptIds = dept ? await getManagementByDepartmentUserIds(context.client, dept) : [];

    clearAllRecipients();
    addRecipients([userId]);
    addNaturalRecipients(Array.from(new Set([...adminIds, ...mgmtDeptIds])));
    return true;
  }

  if (type === EVENT_TYPES.TIMESHEET_APPROVED) {
    const techId = body.technician_id || body.recipient_id || userId;
    const broadcastRecipientId = body.recipient_id || techId;
    const techName = recipName || (await getProfileDisplayName(context.client, techId)) || 'Tu';
    const text = broadcastRecipientId === techId
      ? `Tu parte para "${jobTitle || 'Trabajo'}" ha sido aprobado.`
      : `El parte de ${techName} para "${jobTitle || 'Trabajo'}" ha sido aprobado.`;

    setBroadcastMessage(state, 'Parte aprobado', text);
    clearAllRecipients();
    addRecipients([broadcastRecipientId]);
    return true;
  }

  if (type === EVENT_TYPES.TIMESHEET_REJECTED) {
    const techId = body.technician_id || body.recipient_id || userId;
    const broadcastRecipientId = body.recipient_id || techId;
    const techName = recipName || (await getProfileDisplayName(context.client, techId)) || 'Tu';
    const reason = body.rejection_reason;
    const text = broadcastRecipientId === techId
      ? reason
        ? `Tu parte para "${jobTitle || 'Trabajo'}" ha sido rechazado. Motivo: ${reason}`
        : `Tu parte para "${jobTitle || 'Trabajo'}" ha sido rechazado.`
      : reason
        ? `El parte de ${techName} para "${jobTitle || 'Trabajo'}" ha sido rechazado. Motivo: ${reason}`
        : `El parte de ${techName} para "${jobTitle || 'Trabajo'}" ha sido rechazado.`;

    setBroadcastMessage(state, 'Parte rechazado', text);
    clearAllRecipients();
    addRecipients([broadcastRecipientId]);
    return true;
  }

  return false;
}
