import { getLogisticsManagementRecipients, getManagementOnlyUserIds } from "../../data.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";
import {
  buildLogisticsEventMessage,
  buildLogisticsTransportRequestedMessage,
} from "../messages/logisticsMessages.ts";

export async function handleLogisticsEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, jobId, jobTitle, state, audience } = context;

  if (type === 'logistics.transport.requested') {
    const message = buildLogisticsTransportRequestedMessage(context.actor, jobTitle, body);
    setBroadcastMessage(state, message.title, message.text);

    const logisticsUrl = jobId ? `/jobs/${jobId}` : '/logistics';
    state.url = body.url || logisticsUrl;
    audience.clearAllRecipients();
    audience.addNaturalRecipients(await getLogisticsManagementRecipients(context.client));
    state.metaExtras.view = 'logistics';
    state.metaExtras.department = body.department;
    state.metaExtras.description = body.description;
    state.metaExtras.targetUrl = logisticsUrl;
    return true;
  }

  if (
    type === 'logistics.event.created'
    || type === 'logistics.event.updated'
    || type === 'logistics.event.cancelled'
  ) {
    const message = buildLogisticsEventMessage(type, jobTitle, body);
    setBroadcastMessage(state, message.title, message.text);

    audience.clearAllRecipients();
    audience.addNaturalRecipients(await getManagementOnlyUserIds(context.client));

    const logisticsUrl = body.url || (jobId ? `/jobs/${jobId}` : '/logistics/calendar');
    state.url = logisticsUrl;
    state.metaExtras.view = 'logistics-calendar';
    state.metaExtras.targetUrl = logisticsUrl;
    state.metaExtras.department = 'logistics';
    return true;
  }

  return false;
}
