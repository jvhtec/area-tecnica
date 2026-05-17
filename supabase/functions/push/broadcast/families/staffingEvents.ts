import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleStaffingEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, actor, recipName, channelLabel, jobTitle, state, audience } = context;
  const isStaffingEvent = type.startsWith('staffing.');
  const recipientId = body.recipient_id?.trim();

  if (isStaffingEvent && !recipientId) {
    audience.clearAllRecipients();
    return true;
  }

  if (type === 'staffing.availability.sent') {
    setBroadcastMessage(state, 'Solicitud de disponibilidad enviada', `${actor} envió solicitud a ${recipName || 'técnico'} (${channelLabel}).`);
    audience.addNaturalRecipients(await context.getScopedManagementIds(recipientId, 'staffing.availability.sent'));
    audience.addRecipients([recipientId]);
    return true;
  }

  if (type === 'staffing.offer.sent') {
    setBroadcastMessage(state, 'Oferta enviada', `${actor} envió oferta a ${recipName || 'técnico'} (${channelLabel}).`);
    audience.addNaturalRecipients(await context.getScopedManagementIds(recipientId, 'staffing.offer.sent'));
    audience.addRecipients([recipientId]);
    return true;
  }

  if (type === 'staffing.availability.confirmed') {
    setBroadcastMessage(state, 'Disponibilidad confirmada', `${recipName || 'Técnico'} confirmó disponibilidad para "${jobTitle || 'Trabajo'}".`);
    audience.addNaturalRecipients(await context.getScopedManagementIds(recipientId, 'staffing.availability.confirmed'));
    return true;
  }

  if (type === 'staffing.availability.declined') {
    setBroadcastMessage(state, 'Disponibilidad rechazada', `${recipName || 'Técnico'} rechazó disponibilidad para "${jobTitle || 'Trabajo'}".`);
    audience.addNaturalRecipients(await context.getScopedManagementIds(recipientId, 'staffing.availability.declined'));
    return true;
  }

  if (type === 'staffing.offer.confirmed') {
    setBroadcastMessage(state, 'Oferta aceptada', `${recipName || 'Técnico'} aceptó oferta para "${jobTitle || 'Trabajo'}".`);
    audience.addNaturalRecipients(await context.getScopedManagementIds(recipientId, 'staffing.offer.confirmed'));
    return true;
  }

  if (type === 'staffing.offer.declined') {
    setBroadcastMessage(state, 'Oferta rechazada', `${recipName || 'Técnico'} rechazó oferta para "${jobTitle || 'Trabajo'}".`);
    audience.addNaturalRecipients(await context.getScopedManagementIds(recipientId, 'staffing.offer.declined'));
    return true;
  }

  if (type === 'staffing.availability.cancelled') {
    setBroadcastMessage(state, 'Disponibilidad cancelada', `Solicitud de disponibilidad cancelada para "${jobTitle || 'Trabajo'}".`);
    audience.addNaturalRecipients(await context.getScopedManagementIds(recipientId, 'staffing.availability.cancelled'));
    audience.addRecipients([recipientId]);
    return true;
  }

  if (type === 'staffing.offer.cancelled') {
    setBroadcastMessage(state, 'Oferta cancelada', `Oferta cancelada para "${jobTitle || 'Trabajo'}".`);
    audience.addNaturalRecipients(await context.getScopedManagementIds(recipientId, 'staffing.offer.cancelled'));
    audience.addRecipients([recipientId]);
    return true;
  }

  return false;
}
