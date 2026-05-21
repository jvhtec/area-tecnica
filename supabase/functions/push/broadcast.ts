import { createClient } from "./deps.ts";
import {
  getAdminUserIds,
  getJobDepartment,
  getJobParticipantUserIds,
  getJobTitle,
  getJobType,
  getManagementByDepartmentUserIds,
  getManagementUserIds,
  getProfileDisplayName,
  getSoundDepartmentUserIds,
  getTourName,
} from "./data.ts";
import { channelEs } from "./format.ts";
import { jsonResponse } from "./http.ts";
import { applyRoutingOverrides, getPushNotificationRoutes } from "./routing.ts";
import { resolveNotificationUrl, validateInternalUrl } from "./urls.ts";
import {
  loadNativeTokens,
  loadPushSubscriptions,
  sendPayloadToTargets,
} from "./broadcast/delivery.ts";
import { formatSpanishMediumDate, normalizeDateKey } from "./broadcast/date.ts";
import { routeBroadcastEvent } from "./broadcast/eventRouter.ts";
import { getScopedManagementIds as resolveScopedManagementIds } from "./broadcast/recipients.ts";
import {
  filterStaffingRoutesForDepartment,
  getStaffingRoutingManagementIds,
  isStaffingEventCode,
  resolveStaffingDepartment,
} from "./broadcast/staffingRouting.ts";
import {
  CARLOS_AGENT_DESCRIPTION,
  CARLOS_AGENT_NAME,
  isCarlosStaffingRequest,
} from "./broadcast/staffingIdentity.ts";
import type {
  BroadcastEventContext,
  BroadcastMessageState,
  BroadcastRecipients,
} from "./broadcast/eventContext.ts";
import type { BroadcastBody, PushPayload } from "./types.ts";

/**
 * Broadcasts a push notification for a given event to the correct audience,
 * constructs localized title/body and metadata, applies routing overrides, and
 * sends both web and native push notifications.
 */
export async function handleBroadcast(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: BroadcastBody,
) {
  const type = body.type || '';
  let jobId = body.job_id;

  if (!jobId && body.doc_id) {
    try {
      const { data } = await client.from('job_documents').select('job_id').eq('id', body.doc_id).maybeSingle();
      if (data?.job_id) jobId = data.job_id;
    } catch (_) {
      // Best-effort lookup; event fallback text still works without a job id.
    }
  }

  const bodyJobTitle = typeof body.job_title === 'string' ? body.job_title.trim() : '';
  const lookedUpJobTitle = await getJobTitle(client, jobId);
  const jobTitle = bodyJobTitle || lookedUpJobTitle;
  const jobDepartment = await getJobDepartment(client, jobId);
  const jobType = await getJobType(client, jobId);
  const tourId = body.tour_id;
  const tourName = body.tour_name || (await getTourName(client, tourId)) || null;
  const routes = await getPushNotificationRoutes(client, type);
  const sentByCarlos = isCarlosStaffingRequest(body.request_origin);

  const recipients = new Set<string>();
  const naturalRecipients = new Set<string>();
  const management = new Set(await getManagementUserIds(client));
  const soundDept = new Set(await getSoundDepartmentUserIds(client));
  const admin = new Set(await getAdminUserIds(client));
  const mgmt = new Set<string>(management);
  const participants = new Set(await getJobParticipantUserIds(client, jobId || ''));

  const addRecipients = (ids: (string | null | undefined)[]) => {
    for (const id of ids) {
      if (id) recipients.add(id);
    }
  };
  const addNaturalRecipients = (ids: (string | null | undefined)[]) => {
    for (const id of ids) {
      if (id) {
        recipients.add(id);
        naturalRecipients.add(id);
      }
    }
  };
  const clearAllRecipients = () => {
    recipients.clear();
    naturalRecipients.clear();
  };

  if (Array.isArray(body.user_ids) && body.user_ids.length) {
    addRecipients(body.user_ids);
  }

  addRecipients([userId]);

  const url = validateInternalUrl(body.url) || resolveNotificationUrl(type, jobId, tourId, jobType);
  const actorIdForLookup = body.actor_id || userId;
  const actor = sentByCarlos
    ? CARLOS_AGENT_NAME
    : body.actor_name || (await getProfileDisplayName(client, actorIdForLookup)) || 'Alguien';
  const recipName = body.recipient_name || (await getProfileDisplayName(client, body.recipient_id)) || '';
  const channelLabel = channelEs(body.channel);
  const rawTargetDate = typeof body.target_date === 'string' ? body.target_date : undefined;
  const normalizedTargetDate = normalizeDateKey(rawTargetDate);
  const formattedTargetDate = formatSpanishMediumDate(normalizedTargetDate);
  const singleDayFlag = Boolean(body.single_day);

  const state: BroadcastMessageState = {
    title: '',
    text: '',
    url,
    metaExtras: {},
  };

  const audience: BroadcastRecipients = {
    recipients,
    naturalRecipients,
    management,
    soundDept,
    admin,
    mgmt,
    participants,
    addRecipients,
    addNaturalRecipients,
    clearAllRecipients,
  };

  const context: BroadcastEventContext = {
    client,
    userId,
    body,
    type,
    jobId,
    jobTitle,
    jobDepartment,
    jobType,
    tourId,
    tourName,
    routes,
    actor,
    recipName,
    channelLabel,
    rawTargetDate,
    normalizedTargetDate,
    formattedTargetDate,
    singleDayFlag,
    state,
    audience,
    getScopedManagementIds: (technicianId, scopeContext, departmentHint) =>
      resolveScopedManagementIds(client, technicianId, scopeContext, departmentHint),
  };

  const routeResult = await routeBroadcastEvent(context);
  if (routeResult && routeResult !== true) {
    return routeResult;
  }

  let routesForOverrides = routes;
  let managementForOverrides = mgmt;
  if (isStaffingEventCode(type)) {
    const staffingDepartment = await resolveStaffingDepartment(client, body, jobDepartment);
    routesForOverrides = await filterStaffingRoutesForDepartment(client, routes, staffingDepartment);
    managementForOverrides = new Set(await getStaffingRoutingManagementIds(client, staffingDepartment));
  }

  await applyRoutingOverrides({
    routes: routesForOverrides,
    recipients,
    naturalRecipients,
    management: managementForOverrides,
    getDepartmentRecipients: async (department: string) =>
      getManagementByDepartmentUserIds(client, department),
    participants,
  });

  if (type === 'job.assignment.confirmed' || type === 'job.assignment.direct') {
    if (!body.recipient_id || body.recipient_id !== userId) {
      recipients.delete(userId);
    }
  }

  if (recipients.size === 0) {
    return jsonResponse({ status: 'skipped', reason: 'No recipients' });
  }

  const recipientIds = Array.from(recipients);
  const [{ subscriptions, error: subscriptionsError }, nativeTokens] = await Promise.all([
    loadPushSubscriptions(client, recipientIds),
    loadNativeTokens(client, recipientIds),
  ]);

  if (subscriptionsError) {
    console.error('push broadcast fetch subs error', subscriptionsError);
    return jsonResponse({ error: 'Failed to load subscriptions' }, 500);
  }

  if (subscriptions.length === 0 && nativeTokens.length === 0) {
    return jsonResponse({ status: 'skipped', reason: 'No subscriptions for recipients' });
  }

  const payload: PushPayload = {
    title: state.title,
    body: state.text,
    url: state.url,
    type,
    meta: {
      jobId,
      jobTitle: jobTitle || undefined,
      tourId,
      tourName: tourName ?? undefined,
      actor,
      ...(sentByCarlos ? { actorDescription: CARLOS_AGENT_DESCRIPTION } : {}),
      recipient: recipName,
      channel: channelLabel,
      ...(body.department ? { department: body.department } : {}),
      ...('file_name' in body ? { fileName: body.file_name } : {}),
      ...('artist_id' in body ? { artistId: body.artist_id } : {}),
      ...('artist_name' in body ? { artistName: body.artist_name } : {}),
      ...('artist_date' in body ? { artistDate: body.artist_date } : {}),
      ...('file_id' in body ? { fileId: body.file_id } : {}),
      ...('venue_id' in body ? { venueId: body.venue_id } : {}),
      ...('venue_name' in body ? { venueName: body.venue_name } : {}),
      ...('changes' in body ? { changes: body.changes } : {}),
      ...('message_preview' in body ? { messagePreview: body.message_preview } : {}),
      ...('message_id' in body ? { messageId: body.message_id } : {}),
      ...('task_id' in body ? { taskId: body.task_id } : {}),
      ...('task_type' in body ? { taskType: body.task_type } : {}),
      ...('staffing_request_id' in body ? { staffingRequestId: body.staffing_request_id } : {}),
      ...('role_code' in body ? { roleCode: body.role_code } : {}),
      ...('request_origin' in body ? { requestOrigin: body.request_origin } : {}),
      ...('campaign_id' in body ? { campaignId: body.campaign_id } : {}),
      ...(state.changeSummary ? { changeSummary: state.changeSummary } : {}),
      ...(state.metaExtras.view ? { view: state.metaExtras.view } : {}),
      ...(state.metaExtras.department ? { department: state.metaExtras.department } : {}),
      ...(state.metaExtras.targetUrl ? { targetUrl: state.metaExtras.targetUrl } : {}),
      ...(state.metaExtras.requirementsSummary ? { departmentRoles: state.metaExtras.requirementsSummary } : {}),
      ...(state.metaExtras.requirementsSummaryText ? { departmentRolesText: state.metaExtras.requirementsSummaryText } : {}),
    },
  };

  const results = await sendPayloadToTargets(client, subscriptions, nativeTokens, payload);
  return jsonResponse({ status: 'sent', results, count: results.length });
}
