import { EVENT_TYPES } from "../../config.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";
import {
  buildFestivalPublicFormMessage,
  buildFestivalPublicRiderMessage,
} from "../messages/festivalMessages.ts";

export async function handleFestivalEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, jobId, jobTitle, state, audience } = context;

  if (type === EVENT_TYPES.FESTIVAL_PUBLIC_FORM_SUBMITTED) {
    const message = buildFestivalPublicFormMessage(body, jobTitle);
    setBroadcastMessage(state, message.title, message.text);

    if (jobId) {
      const artistDate = body.artist_date?.trim() || '';
      const dateParam = artistDate ? `?date=${encodeURIComponent(artistDate)}` : '';
      state.url = body.url || `/festival-management/${jobId}/artists${dateParam}`;
    }

    audience.addNaturalRecipients(Array.from(audience.mgmt));
    return true;
  }

  if (type === EVENT_TYPES.FESTIVAL_PUBLIC_RIDER_UPLOADED) {
    const message = buildFestivalPublicRiderMessage(body, jobTitle);
    setBroadcastMessage(state, message.title, message.text);

    if (jobId) {
      const artistDate = body.artist_date?.trim() || '';
      const dateParam = artistDate ? `?date=${encodeURIComponent(artistDate)}` : '';
      state.url = body.url || `/festival-management/${jobId}/artists${dateParam}`;
    }

    audience.addNaturalRecipients(Array.from(audience.mgmt));
    return true;
  }

  return false;
}
