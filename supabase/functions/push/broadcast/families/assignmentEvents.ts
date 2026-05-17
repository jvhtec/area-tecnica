import { EVENT_TYPES } from "../../config.ts";
import { getProfileDisplayName } from "../../data.ts";
import { jsonResponse } from "../../http.ts";
import type { PushPayload } from "../../types.ts";
import { sendPayloadToUsers } from "../delivery.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";
import {
  buildAssignmentConfirmedText,
  buildAssignmentRemovedTexts,
  buildDirectAssignmentTexts,
} from "../messages/assignmentMessages.ts";

const baseAssignmentMeta = (context: BroadcastEventContext, recipient?: string) => ({
  jobId: context.jobId,
  tourId: context.tourId,
  tourName: context.tourName ?? undefined,
  actor: context.actor,
  recipient,
  ...context.state.metaExtras,
});

export async function handleAssignmentEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, state, audience, jobTitle, recipName } = context;

  if (type === 'job.assignment.confirmed') {
    setBroadcastMessage(
      state,
      'Asignación confirmada',
      buildAssignmentConfirmedText(recipName, jobTitle, context.singleDayFlag, context.formattedTargetDate),
    );

    if (context.singleDayFlag && context.normalizedTargetDate) {
      state.metaExtras.singleDay = true;
      state.metaExtras.targetDate = context.normalizedTargetDate;
    }

    audience.addRecipients([body.recipient_id]);
    return true;
  }

  if (type === 'job.assignment.direct') {
    if (context.singleDayFlag && context.normalizedTargetDate) {
      state.metaExtras.singleDay = true;
      state.metaExtras.targetDate = context.normalizedTargetDate;
    }

    const assignedTechId = body.recipient_id;
    const assignedTechName = recipName;
    const { techText, managementText } = buildDirectAssignmentTexts(
      context.actor,
      assignedTechName,
      jobTitle,
      body.assignment_status,
      context.singleDayFlag,
      context.formattedTargetDate,
    );

    const baseMeta = baseAssignmentMeta(context, assignedTechName);
    let deliveredCount = 0;

    if (assignedTechId) {
      const techPayload: PushPayload = {
        title: 'Nueva asignación',
        body: techText,
        url: state.url,
        type,
        meta: baseMeta,
      };

      deliveredCount += (await sendPayloadToUsers(context.client, [assignedTechId], techPayload)).length;
    }

    const scopedMgmtIds = await context.getScopedManagementIds(assignedTechId, `job.assignment.direct job=${context.jobId}`);
    if (scopedMgmtIds.length > 0) {
      const mgmtPayload: PushPayload = {
        title: 'Asignación directa',
        body: managementText,
        url: state.url,
        type,
        meta: baseMeta,
      };

      deliveredCount += (await sendPayloadToUsers(context.client, scopedMgmtIds, mgmtPayload)).length;
    }

    return jsonResponse({ status: 'sent', count: deliveredCount });
  }

  if (type === EVENT_TYPES.ASSIGNMENT_REMOVED) {
    const removedTechId = body.recipient_id || body.technician_id;
    const removedTechName = recipName || (await getProfileDisplayName(context.client, removedTechId)) || 'Un técnico';
    const { techText, managementText } = buildAssignmentRemovedTexts(
      context.actor,
      removedTechName,
      jobTitle,
      context.singleDayFlag,
      context.formattedTargetDate,
    );

    audience.clearAllRecipients();
    let deliveredCount = 0;

    if (removedTechId) {
      const techPayload: PushPayload = {
        title: 'Asignación eliminada',
        body: techText,
        url: state.url,
        type,
        meta: baseAssignmentMeta(context, removedTechName),
      };

      deliveredCount += (await sendPayloadToUsers(context.client, [removedTechId], techPayload)).length;
    }

    const scopedMgmtIds = await context.getScopedManagementIds(removedTechId, `assignment.removed job=${context.jobId}`);
    if (scopedMgmtIds.length > 0) {
      const mgmtPayload: PushPayload = {
        title: 'Asignación eliminada',
        body: managementText,
        url: state.url,
        type,
        meta: baseAssignmentMeta(context, removedTechName),
      };

      deliveredCount += (await sendPayloadToUsers(context.client, scopedMgmtIds, mgmtPayload)).length;
    }

    console.log('Assignment removal notification sent');
    return jsonResponse({ status: 'sent', count: deliveredCount });
  }

  return false;
}
