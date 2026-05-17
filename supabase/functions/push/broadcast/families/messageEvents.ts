import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleMessageEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  if (context.type !== 'message.received') {
    return false;
  }

  setBroadcastMessage(context.state, 'Nuevo mensaje', `${context.actor}: ${context.body.message_preview || ''}`);
  context.audience.clearAllRecipients();
  context.audience.addRecipients([context.body.recipient_id]);
  return true;
}
