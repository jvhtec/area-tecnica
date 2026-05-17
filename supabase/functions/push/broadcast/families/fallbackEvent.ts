import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleFallbackEvent(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  let title = '';
  try {
    const { data: catalogEntry } = await context.client
      .from('activity_catalog')
      .select('label')
      .eq('code', context.type)
      .maybeSingle();
    title = (catalogEntry?.label as string) || context.body.type || 'Nueva actividad';
  } catch (_) {
    title = context.body.type || 'Nueva actividad';
  }

  setBroadcastMessage(
    context.state,
    title,
    context.jobTitle
      ? `${context.actor} — ${title} en "${context.jobTitle}".`
      : `${context.actor} — ${title}.`,
  );
  context.audience.addNaturalRecipients(Array.from(context.audience.mgmt));
  return true;
}
