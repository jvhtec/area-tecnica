import { EVENT_TYPES } from "../../config.ts";
import { getAdminUserIds, getManagementByDepartmentUserIds, getProfileDisplayName } from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function formatAmount(amount?: number): string {
  return typeof amount === "number" && Number.isFinite(amount) ? EUR.format(amount) : "";
}

/**
 * Expenses and payout overrides. Submissions go up to the approvers; decisions
 * and overrides go back down to the affected technician, who is the only person
 * whose own money changed.
 */
export async function handleFinanceEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { client, type, body, actor, jobTitle, recipName, state, audience, userId } = context;
  const { addRecipients, addNaturalRecipients, clearAllRecipients } = audience;
  const jobLabel = jobTitle ? ` de "${jobTitle}"` : "";

  if (type === EVENT_TYPES.EXPENSE_SUBMITTED) {
    const amount = formatAmount(body.amount_eur);
    setBroadcastMessage(
      state,
      "Gasto enviado",
      amount
        ? `${actor} ha enviado un gasto de ${amount}${jobLabel}.`
        : `${actor} ha enviado un gasto${jobLabel}.`,
    );

    const adminIds = await getAdminUserIds(client);
    const managementIds = body.department
      ? await getManagementByDepartmentUserIds(client, body.department)
      : [];

    clearAllRecipients();
    addRecipients([userId]);
    addNaturalRecipients(Array.from(new Set([...adminIds, ...managementIds])));
    return true;
  }

  if (type === EVENT_TYPES.EXPENSE_APPROVED || type === EVENT_TYPES.EXPENSE_REJECTED) {
    const approved = type === EVENT_TYPES.EXPENSE_APPROVED;
    const technicianId = body.technician_id || body.recipient_id || userId;
    const amount = formatAmount(body.amount_eur);
    const amountLabel = amount ? ` de ${amount}` : "";
    const reason = body.rejection_reason;

    setBroadcastMessage(
      state,
      approved ? "Gasto aprobado" : "Gasto rechazado",
      approved
        ? `Tu gasto${amountLabel}${jobLabel} ha sido aprobado.`
        : reason
          ? `Tu gasto${amountLabel}${jobLabel} ha sido rechazado. Motivo: ${reason}`
          : `Tu gasto${amountLabel}${jobLabel} ha sido rechazado.`,
    );

    clearAllRecipients();
    addRecipients([body.recipient_id || technicianId]);
    return true;
  }

  if (type === EVENT_TYPES.PAYOUT_OVERRIDE_APPLIED) {
    const technicianId = body.technician_id || body.recipient_id || userId;
    const technicianName = recipName
      || (await getProfileDisplayName(client, technicianId))
      || "";
    const amount = formatAmount(body.amount_eur);
    const recipientId = body.recipient_id || technicianId;
    const isSelf = recipientId === technicianId;

    setBroadcastMessage(
      state,
      "Importe de pago actualizado",
      isSelf
        ? amount
          ? `${actor} ha ajustado tu importe${jobLabel} a ${amount}.`
          : `${actor} ha ajustado tu importe${jobLabel}.`
        : amount
          ? `${actor} ha ajustado el importe de ${technicianName}${jobLabel} a ${amount}.`
          : `${actor} ha ajustado el importe de ${technicianName}${jobLabel}.`,
    );

    clearAllRecipients();
    addRecipients([recipientId]);
    return true;
  }

  return false;
}
