import { EVENT_TYPES } from "../../config.ts";
import { getAdminUserIds, resolveSoundVisionVenueName } from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleSoundVisionEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, actor, state, audience } = context;

  if (
    type === EVENT_TYPES.SOUNDVISION_ACCESS_REQUESTED
    || type === EVENT_TYPES.SOUNDVISION_ACCESS_APPROVED
    || type === EVENT_TYPES.SOUNDVISION_ACCESS_REJECTED
  ) {
    return handleSoundVisionAccess(context);
  }

  if (type !== 'soundvision.file.uploaded' && type !== 'soundvision.file.downloaded') {
    return false;
  }

  const venueName = (await resolveSoundVisionVenueName(context.client, body)) || 'desconocido';
  const action = type === 'soundvision.file.uploaded' ? 'subido' : 'descargado';
  setBroadcastMessage(
    state,
    type === 'soundvision.file.uploaded' ? 'Archivo SoundVision subido' : 'Archivo SoundVision descargado',
    `${actor} ha ${action} un archivo SoundVision ${venueName} a la base de datos.`,
  );
  state.url = body.url || '/soundvision-files';

  audience.clearAllRecipients();
  const soundManagement = Array.from(audience.management).filter((id) => audience.soundDept.has(id));
  audience.addNaturalRecipients(soundManagement);
  return true;
}

/**
 * Access to the SoundVision library is requested by a technician and decided by
 * sound management or an admin. The request fans out to those deciders; the
 * decision goes back to the requester alone.
 */
async function handleSoundVisionAccess(
  context: BroadcastEventContext,
): Promise<BroadcastHandlerResult> {
  const { client, type, body, actor, state, audience, userId } = context;
  const note = (body.description || '').trim();

  if (type === EVENT_TYPES.SOUNDVISION_ACCESS_REQUESTED) {
    setBroadcastMessage(
      state,
      'Solicitud de acceso a SoundVision',
      note
        ? `${actor} ha solicitado acceso a SoundVision: ${note}`
        : `${actor} ha solicitado acceso a SoundVision.`,
    );

    const adminIds = await getAdminUserIds(client);
    const soundManagement = Array.from(audience.management).filter((id) => audience.soundDept.has(id));

    audience.clearAllRecipients();
    audience.addRecipients([userId]);
    audience.addNaturalRecipients(Array.from(new Set([...adminIds, ...soundManagement])));
    return true;
  }

  const approved = type === EVENT_TYPES.SOUNDVISION_ACCESS_APPROVED;
  const reason = body.rejection_reason;
  setBroadcastMessage(
    state,
    approved ? 'Acceso a SoundVision concedido' : 'Acceso a SoundVision denegado',
    approved
      ? 'Ya puedes consultar la biblioteca de archivos SoundVision.'
      : reason
        ? `Tu solicitud de acceso a SoundVision ha sido denegada. Motivo: ${reason}`
        : 'Tu solicitud de acceso a SoundVision ha sido denegada.',
  );

  audience.clearAllRecipients();
  audience.addRecipients([body.recipient_id || body.technician_id || userId]);
  return true;
}
