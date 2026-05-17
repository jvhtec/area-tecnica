import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleMessageEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  if (context.type !== 'message.received') {
    return false;
  }

  const recipientId = context.body.recipient_id?.trim();
  if (!recipientId) {
    context.audience.clearAllRecipients();
    return true;
  }

  setBroadcastMessage(context.state, 'Nuevo mensaje', `${context.actor}: ${context.body.message_preview || ''}`);
  context.audience.clearAllRecipients();
  context.audience.addRecipients([recipientId]);
  return true;
}
