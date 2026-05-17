import { EVENT_TYPES } from "../../config.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleChangelogEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  if (context.type !== EVENT_TYPES.CHANGELOG_UPDATED) {
    return false;
  }

  const version = context.body.version;
  const content = context.body.content;

  setBroadcastMessage(
    context.state,
    '⚠️ ¡Actualiza ahora!',
    content || (version
      ? `Nueva versión v${version} disponible. Actualiza la aplicación para ver las novedades.`
      : 'Se han publicado cambios importantes. Actualiza la aplicación.'),
  );

  context.state.url = context.body.url || '/?showAbout=1';
  context.audience.clearAllRecipients();

  const { data: allUsers } = await context.client
    .from('profiles')
    .select('id');
  if (allUsers && allUsers.length > 0) {
    context.audience.addNaturalRecipients(allUsers.map((user: { id?: string | null }) => user.id));
  }

  return true;
}
