import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";
import { buildTaskMessage } from "../messages/taskMessages.ts";

export async function handleTaskEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const contextLabel = context.jobId ? (context.jobTitle || 'Trabajo') : context.tourName;
  const message = buildTaskMessage(context.type, context.actor, context.recipName, context.body, contextLabel);

  if (!message) {
    return false;
  }

  setBroadcastMessage(context.state, message.title, message.text);
  context.state.changeSummary = message.changeSummary;

  if (context.type === 'task.updated') {
    context.audience.clearAllRecipients();
  }

  context.audience.addRecipients([context.body.recipient_id]);
  return true;
}
