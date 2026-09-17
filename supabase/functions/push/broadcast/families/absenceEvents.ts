import { EVENT_TYPES } from "../../config.ts";
import { getAdminUserIds, getManagementByDepartmentUserIds, getProfileDisplayName } from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";
import { formatSpanishMediumDate, normalizeDateKey } from "../date.ts";

function formatRange(startDate?: string, endDate?: string): string {
  const start = formatSpanishMediumDate(normalizeDateKey(startDate));
  const end = formatSpanishMediumDate(normalizeDateKey(endDate));
  if (start && end && start !== end) return ` del ${start} al ${end}`;
  if (start) return ` el ${start}`;
  return "";
}

/**
 * Vacation and absence requests. A submission is reviewed by the requester's own
 * department management plus admins; a decision goes back to the requester only,
 * because the rest of the reviewers do not need to see each other's outcomes.
 */
export async function handleAbsenceEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { client, type, body, actor, recipName, state, audience, userId } = context;
  const { addRecipients, addNaturalRecipients, clearAllRecipients } = audience;

  if (type === EVENT_TYPES.VACATION_REQUEST_SUBMITTED) {
    const range = formatRange(body.start_date, body.end_date);
    setBroadcastMessage(
      state,
      "Solicitud de ausencia",
      `${actor} ha solicitado ausencia${range}.`,
    );

    const technicianId = body.technician_id || body.actor_id || userId;
    const department = body.department
      || (await getProfileDepartment(client, technicianId));
    const adminIds = await getAdminUserIds(client);
    const managementIds = department
      ? await getManagementByDepartmentUserIds(client, department)
      : [];

    clearAllRecipients();
    addRecipients([userId]);
    addNaturalRecipients(Array.from(new Set([...adminIds, ...managementIds])));
    return true;
  }

  if (
    type === EVENT_TYPES.VACATION_REQUEST_APPROVED
    || type === EVENT_TYPES.VACATION_REQUEST_REJECTED
  ) {
    const approved = type === EVENT_TYPES.VACATION_REQUEST_APPROVED;
    const technicianId = body.technician_id || body.recipient_id || userId;
    const range = formatRange(body.start_date, body.end_date);
    const technicianName = recipName
      || (await getProfileDisplayName(client, technicianId))
      || "";
    const isSelf = (body.recipient_id || technicianId) === technicianId;
    const subject = isSelf ? "Tu solicitud de ausencia" : `La solicitud de ${technicianName}`;
    const reason = body.rejection_reason;

    setBroadcastMessage(
      state,
      approved ? "Ausencia aprobada" : "Ausencia rechazada",
      approved
        ? `${subject}${range} ha sido aprobada.`
        : reason
          ? `${subject}${range} ha sido rechazada. Motivo: ${reason}`
          : `${subject}${range} ha sido rechazada.`,
    );

    clearAllRecipients();
    addRecipients([body.recipient_id || technicianId]);
    return true;
  }

  return false;
}

async function getProfileDepartment(
  client: BroadcastEventContext["client"],
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("profiles")
    .select("department")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { department: string | null }).department;
}
