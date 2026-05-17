import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleFlexEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, jobTitle, state, audience } = context;

  if (type === 'flex.folders.created') {
    setBroadcastMessage(
      state,
      'Carpetas Flex creadas',
      jobTitle
        ? `Se han creado las carpetas de Flex para "${jobTitle}".`
        : 'Se han creado carpetas de Flex.',
    );
    audience.addNaturalRecipients(Array.from(audience.mgmt));
    audience.addNaturalRecipients(Array.from(audience.participants));
    return true;
  }

  if (type === 'flex.tourdate_folder.created') {
    const tourName = body.tour_name || '';
    const count = body.dates_count;
    let text = '';
    if (tourName && count && count > 1) {
      text = `Se han creado ${count} carpetas de fecha para "${tourName}".`;
    } else if (tourName) {
      text = `Se ha creado carpeta de fecha para "${tourName}".`;
    } else if (count && count > 1) {
      text = `Se han creado ${count} carpetas de fecha.`;
    } else {
      text = 'Se ha creado carpeta de fecha.';
    }

    setBroadcastMessage(state, 'Carpeta de fecha creada', text);
    state.url = body.url || (body.tour_id ? `/tours/${body.tour_id}` : state.url);
    audience.addNaturalRecipients(Array.from(audience.mgmt));
    return true;
  }

  return false;
}
