import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleDocumentEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, actor, jobTitle, state, audience } = context;
  const { participants, mgmt, addNaturalRecipients } = audience;
  const fileName = body.file_name || 'documento';

  if (type === 'document.uploaded') {
    setBroadcastMessage(state, 'Nuevo documento', `${actor} subió "${fileName}" a "${jobTitle || 'Trabajo'}".`);
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  if (type === 'document.deleted') {
    setBroadcastMessage(state, 'Documento eliminado', `${actor} eliminó "${fileName}" de "${jobTitle || 'Trabajo'}".`);
    addNaturalRecipients(Array.from(mgmt));
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  if (type === 'document.tech_visible.enabled') {
    setBroadcastMessage(state, 'Documento disponible para técnicos', `Nuevo documento visible: "${fileName}" en "${jobTitle || 'Trabajo'}".`);
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  if (type === 'document.tech_visible.disabled') {
    setBroadcastMessage(state, 'Documento oculto para técnicos', `El documento "${fileName}" dejó de estar visible en "${jobTitle || 'Trabajo'}".`);
    addNaturalRecipients(Array.from(participants));
    return true;
  }

  return false;
}
