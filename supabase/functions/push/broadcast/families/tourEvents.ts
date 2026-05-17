import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";
import {
  buildTourDateTypeChangedMessage,
  buildTourdateUpdatedText,
} from "../messages/tourMessages.ts";

export async function handleTourEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, actor, state, audience } = context;

  if (type === 'tourdate.created') {
    const tourName = body.tour_name || '';
    setBroadcastMessage(
      state,
      'Fecha de tour creada',
      tourName ? `${actor} creó una fecha en "${tourName}".` : `${actor} creó una nueva fecha de tour.`,
    );
    state.url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : state.url);
    audience.addNaturalRecipients(Array.from(audience.mgmt));
    return true;
  }

  if (type === 'tourdate.updated') {
    setBroadcastMessage(state, 'Fecha de tour actualizada', buildTourdateUpdatedText(actor, body.changes));
    state.url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : state.url);
    audience.addNaturalRecipients(Array.from(audience.mgmt));
    return true;
  }

  if (type === 'tourdate.deleted') {
    const tourName = body.tour_name || '';
    setBroadcastMessage(
      state,
      'Fecha de tour eliminada',
      tourName ? `${actor} eliminó una fecha de "${tourName}".` : `${actor} eliminó una fecha de tour.`,
    );
    state.url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : state.url);
    audience.addNaturalRecipients(Array.from(audience.mgmt));
    return true;
  }

  if (type.startsWith('tourdate.type.changed')) {
    const message = buildTourDateTypeChangedMessage(type, actor, body);
    setBroadcastMessage(state, message.title, message.text);
    state.url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : state.url);
    audience.addNaturalRecipients(Array.from(audience.mgmt));
    return true;
  }

  return false;
}
