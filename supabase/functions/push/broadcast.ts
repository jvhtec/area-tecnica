import type { SupabaseClient } from "./deps.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import {
  getAdminUserIds,
  getJobDepartment,
  getJobParticipantUserIds,
  getJobTitle,
  getJobType,
  getManagementByDepartmentUserIds,
  getManagementUserIds,
  getProfileDisplayName,
  getProfileRoles,
  getSoundDepartmentUserIds,
  getTourName,
} from "./data.ts";
import { channelEs } from "./format.ts";
import { jsonResponse } from "./http.ts";
import { applyRoutingOverrides, getPushNotificationRoutes } from "./routing.ts";
import { resolveNotificationUrl, validateInternalUrl } from "./urls.ts";
import { destinationForRole } from "./recipientDestinations.ts";
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
import {
  sendTransportRequestEmail,
  type TransportRequestEmailResult,
} from "./transportRequestEmail.ts";
import { claimInboxItems, recordAttemptResult, recordDeliveryOutcomes } from "./inbox.ts";
import {
  buildEventKey,
  decoratePayloadPolicy,
  loadRecipientPreferences,
  urgencyForEvent,
} from "./notificationPolicy.ts";

/**
 * Broadcasts a push notification for a given event to the correct audience,
 * constructs localized title/body and metadata, applies routing overrides, and
 * sends both web and native push notifications.
 */
export async function handleBroadcast(
  client: SupabaseClient,
  userId: string,
  body: BroadcastBody,
) {
  const type = body.type || '';
  // Email recipients and delivery are independent of push subscriptions and routing.
  // The send starts here but is only awaited at each return site, so a slow or hung
  // mail provider runs alongside the push path instead of delaying or starving it.
  const pendingEmail = type === 'logistics.transport.requested'
    ? sendTransportRequestEmail(client, userId, body.request_id).catch(
      (): TransportRequestEmailResult => ({
        status: 'skipped', sent: 0, failed: 0, skipped: 0, reason: 'unexpected_error',
      }),
    )
    : null;
  // Every return path goes through this so the email is never dropped by the isolate
  // shutting down once a response is sent.
  const withEmail = async (payload: Record<string, unknown>) => {
    if (!pendingEmail) return payload;
    const email = await pendingEmail;
    if (email.failed > 0 ||
      ['data_unavailable', 'not_configured', 'unexpected_error'].includes(email.reason || '')) {
      logEvent('warn', 'transport_request_email_incomplete', { ...email });
    }
    return { ...payload, email };
  };
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
    getScopedManagementIds: (technicianId, scopeContext, departmentHint, options) =>
      resolveScopedManagementIds(client, technicianId, scopeContext, departmentHint, options),
  };

  const routeResult = await routeBroadcastEvent(context);
  if (routeResult && routeResult !== true) {
    await pendingEmail;
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

  // Family handlers may refine the destination after the initial URL is built.
  // Validate the final value so a caller-supplied override cannot bypass the
  // internal-only navigation boundary.
  state.url = validateInternalUrl(state.url)
    || resolveNotificationUrl(type, jobId, tourId, jobType);

  if (type === 'job.assignment.confirmed' || type === 'job.assignment.direct') {
    if (!body.recipient_id || body.recipient_id !== userId) {
      recipients.delete(userId);
    }
  }

  if (recipients.size === 0) {
    return jsonResponse(await withEmail({ status: 'skipped', reason: 'No recipients' }));
  }

  const recipientIds = Array.from(recipients);
  const eventKey = await buildEventKey(body);
  const urgency = urgencyForEvent(type);
  const payload = decoratePayloadPolicy({
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
  } satisfies PushPayload, body, eventKey, urgency);

  // One event, several audiences: tailor the deep link to what each recipient's
  // role can open, so a freelancer tapping a job push lands on that job in the
  // tech app instead of being bounced off a management-only page.
  const recipientRoles = await getProfileRoles(client, recipientIds);
  const jobUrl = jobId ? resolveNotificationUrl('job.updated', jobId, tourId, jobType) : null;
  const payloadCache = new Map<string, PushPayload>();
  const payloadFor = (recipientId: string | undefined): PushPayload => {
    if (!recipientId || !recipientRoles.has(recipientId)) return payload;
    const recipientUrl = destinationForRole(payload.url ?? "/", recipientRoles.get(recipientId), { jobId, jobUrl });
    if (recipientUrl === payload.url) return payload;
    const cached = payloadCache.get(recipientUrl);
    if (cached) return cached;
    const tailored = { ...payload, url: recipientUrl };
    payloadCache.set(recipientUrl, tailored);
    return tailored;
  };

  let inboxIds: Map<string, string>;
  try {
    inboxIds = await claimInboxItems(client, recipientIds, eventKey, body, payloadFor, urgency);
  } catch (error) {
    logEvent("error", "notification_inbox_claim_failed", {
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse(await withEmail({ status: "failed", reason: "inbox_persistence_failed" }), 500);
  }
  if (inboxIds.size === 0) {
    return jsonResponse(await withEmail({ status: "skipped", reason: "duplicate_event", eventKey }));
  }

  const claimedRecipientIds = Array.from(inboxIds.keys());
  let preferences: Awaited<ReturnType<typeof loadRecipientPreferences>>;
  try {
    preferences = await loadRecipientPreferences(client, claimedRecipientIds, body, urgency);
  } catch (error) {
    logEvent("error", "push_broadcast_preference_lookup_failed", {
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    // A failed lookup must not silently fall back to "everyone is opted in";
    // treat every claimed recipient as failed so a stored opt-out can never
    // be bypassed by a transient database error.
    await recordDeliveryOutcomes(client, inboxIds, [], [], claimedRecipientIds);
    return jsonResponse(await withEmail({ status: "failed", reason: "preference_lookup_failed", eventKey }), 500);
  }
  const eligibleRecipientIds = claimedRecipientIds.filter((recipientId) => {
    const preference = preferences.get(recipientId);
    return preference?.accountEnabled !== false
      && preference?.categoryEnabled !== false
      && preference?.quietNow !== true
      && preference?.muted !== true;
  });
  const skippedUserIds = claimedRecipientIds.filter((id) => !eligibleRecipientIds.includes(id));

  if (eligibleRecipientIds.length === 0) {
    await recordDeliveryOutcomes(client, inboxIds, [], skippedUserIds);
    return jsonResponse(await withEmail({
      status: "skipped",
      reason: "recipient_preferences",
      inboxCount: inboxIds.size,
      eventKey,
    }));
  }

  const [{ subscriptions, error: subscriptionsError }, nativeResult] = await Promise.all([
    loadPushSubscriptions(client, eligibleRecipientIds),
    loadNativeTokens(client, eligibleRecipientIds),
  ]);

  if (subscriptionsError || nativeResult.error) {
    logEvent("error", "push_broadcast_target_lookup_failed", {
      webFailed: Boolean(subscriptionsError),
      nativeFailed: Boolean(nativeResult.error),
    });
    await recordDeliveryOutcomes(client, inboxIds, [], [], claimedRecipientIds);
    return jsonResponse(await withEmail({ status: "failed", reason: "target_lookup_failed", eventKey }), 500);
  }

  if (subscriptions.length === 0 && nativeResult.tokens.length === 0) {
    // No target is a terminal non-error outcome for this occurrence: the inbox
    // item remains available, but there was simply nowhere to deliver a push.
    await recordDeliveryOutcomes(client, inboxIds, [], claimedRecipientIds);
    return jsonResponse(await withEmail({
      status: 'skipped',
      reason: 'no_registered_devices',
      inboxCount: inboxIds.size,
      eventKey,
    }));
  }

  const results = await sendPayloadToTargets(client, subscriptions, nativeResult.tokens, payloadFor, async (result) => {
    const inboxId = result.userId ? inboxIds.get(result.userId) : undefined;
    if (inboxId) await recordAttemptResult(client, inboxId, result);
  });
  await recordDeliveryOutcomes(client, inboxIds, results, skippedUserIds);
  const accepted = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok && !result.skipped).length;
  const skipped = results.filter((result) => result.skipped).length + skippedUserIds.length;
  const status = accepted > 0 && failed > 0
    ? "partial"
    : accepted > 0
      ? "accepted"
      : failed > 0
        ? "failed"
        : "skipped";
  return jsonResponse(await withEmail({
    status,
    eventKey,
    results,
    outcomes: { accepted, failed, skipped },
    inboxCount: inboxIds.size,
  }), status === "failed" ? 502 : 200);
}
