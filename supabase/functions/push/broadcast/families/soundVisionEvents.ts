import { resolveSoundVisionVenueName } from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleSoundVisionEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, actor, state, audience } = context;

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
