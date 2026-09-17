import type { SupabaseClient } from "./deps.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import { EVENT_TYPES } from "./config.ts";
import { jsonResponse } from "./http.ts";
import { handleFestivalFeedTick } from "./festivalFeed.ts";
import { handleProgramaFeedTick } from "./programaFeed.ts";
import { loadNativeTokens, sendPayloadToTargets } from "./broadcast/delivery.ts";
import { claimInboxItems, recordDeliveryResults } from "./inbox.ts";
import {
  buildEventKey,
  decoratePayloadPolicy,
  loadRecipientPreferences,
  type RecipientPreference,
  urgencyForEvent,
} from "./notificationPolicy.ts";
import { isScheduleDue, occurrenceDate } from "./schedulePolicy.ts";
import { formatMorningSummary, formatMultiDepartmentSummary } from "./morningSummaryFormat.ts";
import type { MorningSummaryData } from "./morningSummaryTypes.ts";
import type {
  BroadcastBody,
  CheckScheduledBody,
  PushPayload,
  PushSubscriptionRow,
} from "./types.ts";

type MorningSummaryAssignment = MorningSummaryData["assignments"][number];
type MorningSummaryUnavailable = MorningSummaryData["unavailable"][number];
type MorningSummaryTech = MorningSummaryData["allTechs"][number];

type LegacyAvailabilityRow = {
  technician_id?: string | null;
  status?: string | null;
};

type ScheduleConfigRow = {
  enabled: boolean;
  timezone?: string | null;
  schedule_time: string;
  days_of_week?: number[] | null;
  last_sent_at?: string | null;
};

type MorningSummarySubscriptionRow = {
  user_id: string;
  subscribed_departments: string[] | null;
};

type PushDeliveryResult = {
  endpoint: string;
  ok: boolean;
  status?: number;
  skipped?: boolean;
  user_id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorCode(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.code === 'string' ? value.code : null;
}

function getErrorMessage(value: unknown): string | unknown {
  if (value instanceof Error) return value.message;
  if (isRecord(value) && typeof value.message === 'string') return value.message;
  return value;
}

// ============================================================================
// DAILY MORNING SUMMARY HELPERS
// ============================================================================


async function getMorningSummaryDataForDepartment(
  client: SupabaseClient,
  department: string,
  targetDate: string, // YYYY-MM-DD
): Promise<MorningSummaryData> {
  // 1) Get today's assignments for this department.
  // Source of truth: timesheets (NOT job_assignments), which matches the Personal agenda.
  // Important: do NOT filter by job.start_time here — multi-day jobs may have a start_time on a
  // different day, but the technician is still working today if they have an active timesheet row.
  const { data: assignmentsRows, error: assignmentsError } = await client
    .from('timesheets')
    .select(`
      technician_id,
      job:jobs!inner(title, start_time),
      profile:profiles!fk_timesheets_technician_id!inner(first_name, last_name, nickname, department, role)
    `)
    .eq('is_active', true)
    .eq('date', targetDate)
    .eq('profile.department', department)
    .eq('profile.role', 'house_tech')
    .eq('profile.warehouse_duty_exempt', false)
    .returns<MorningSummaryAssignment[]>();
  // Fail loudly: `data` is null on error, so a bare `?? []` would send a "successful"
  // morning summary that silently omits everyone.
  if (assignmentsError) throw assignmentsError;
  const assignments: MorningSummaryAssignment[] = assignmentsRows ?? [];

  // 2) Get today's unavailability for this department (primary source)
  const { data: unavailableRows, error: unavailableError } = await client
    .from('availability_schedules')
    .select(`
      user_id,
      source,
      profile:profiles!availability_schedules_user_id_fkey!inner(first_name, last_name, nickname, department, role)
    `)
    .eq('date', targetDate)
    .eq('status', 'unavailable')
    .eq('profile.department', department)
    .eq('profile.role', 'house_tech')
    .eq('profile.warehouse_duty_exempt', false)
    .returns<MorningSummaryUnavailable[]>();
  if (unavailableError) throw unavailableError;
  const unavailable: MorningSummaryUnavailable[] = unavailableRows ?? [];
  const unavailableHouseOnly: MorningSummaryUnavailable[] = [...unavailable];

  // 3) Get all house techs in department (population)
  const { data: allTechsRows, error: allTechsError } = await client
    .from('profiles')
    .select('id, first_name, last_name, nickname')
    .eq('department', department)
    .eq('role', 'house_tech')
    .eq('warehouse_duty_exempt', false)
    .returns<MorningSummaryTech[]>();
  if (allTechsError) throw allTechsError;
  const allTechs: MorningSummaryTech[] = allTechsRows ?? [];

  // 4) Legacy fallback: include legacy table marks (technician_availability)
  // Some environments still record travel/sick/day_off/vacation here.
  // We treat these as 'unavailable' for the day if they aren't already present.
  try {
    const techIds = allTechs.map(t => t.id);
    if (techIds.length) {
      const { data: legacyRows, error: legacyErr } = await client
        .from('technician_availability')
        .select('technician_id, date, status')
        .in('technician_id', techIds)
        .eq('date', targetDate)
        .in('status', ['vacation', 'travel', 'sick', 'day_off'])
        .returns<LegacyAvailabilityRow[]>();
      if (!legacyErr && legacyRows && legacyRows.length) {
        const existing = new Set<string>(unavailableHouseOnly.map(u => u.user_id));
        for (const row of legacyRows) {
          const technicianId = row.technician_id;
          if (technicianId && !existing.has(technicianId)) {
            const prof = allTechs.find(t => t.id === technicianId);
            if (prof) {
              unavailableHouseOnly.push({
                user_id: technicianId,
                source: row.status ?? 'legacy',
                profile: {
                  first_name: prof.first_name,
                  last_name: prof.last_name,
                  nickname: prof.nickname,
                },
              });
              existing.add(technicianId);
            }
          }
        }
      }
    }
  } catch (e: unknown) {
    // Ignore if legacy table missing
    if (getErrorCode(e) !== '42P01') {
      // Log non-table-missing errors for visibility
      console.log('morning summary legacy availability lookup warning:', getErrorMessage(e));
    }
  }

  return {
    assignments,
    unavailable: unavailableHouseOnly,
    allTechs,
  };
}

async function checkAndGetScheduleConfig(
  client: SupabaseClient,
  eventType: string,
  force: boolean = false,
): Promise<{ shouldSend: boolean; config: ScheduleConfigRow | null }> {
  // Get schedule configuration
  const { data: config, error } = await client
    .from('push_notification_schedules')
    .select('*')
    .eq('event_type', eventType)
    .returns<ScheduleConfigRow[]>()
    .maybeSingle();

  if (error || !config) {
    console.log('❌ No schedule config found for:', eventType);
    return { shouldSend: false, config: null };
  }

  if (!config.enabled) {
    console.log('⏸️ Schedule is disabled for:', eventType);
    return { shouldSend: false, config };
  }

  // If force flag is set (for testing), skip time check
  if (force) {
    console.log('⚡ Force flag set, skipping time check');
    return { shouldSend: true, config };
  }

  // Get current time in configured timezone
  const timezone = config.timezone || 'Europe/Madrid';
  const now = new Date();

  if (!isScheduleDue(config, now)) {
    console.log(`⏰ Fuera del minuto programado para ${config.schedule_time} (${timezone})`);
    return { shouldSend: false, config };
  }

  // Convert to target timezone using Intl API
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const hourPart = parts.find(p => p.type === 'hour');
  const minutePart = parts.find(p => p.type === 'minute');
  const weekdayPart = parts.find(p => p.type === 'weekday');

  const currentHour = parseInt(hourPart?.value || '0');
  const currentMinute = parseInt(minutePart?.value || '0');
  const currentWeekday = weekdayPart?.value;

  console.log(`✅ Time check passed! Sending at ${currentHour}:${currentMinute} on ${currentWeekday}`);
  return { shouldSend: true, config };
}

/**
 * Current calendar date in the schedule's timezone, as YYYY-MM-DD.
 */
function currentDateInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export async function handleCheckScheduled(
  client: SupabaseClient,
  body: CheckScheduledBody,
) {
  const type = body.type;
  const supportedTypes = new Set<string>([
    EVENT_TYPES.DAILY_MORNING_SUMMARY,
    EVENT_TYPES.FESTIVAL_FEED_TICK,
    EVENT_TYPES.PROGRAMA_FEED_TICK,
  ]);
  if (!supportedTypes.has(type)) {
    return jsonResponse({ status: 'error', reason: 'Unsupported scheduled notification type' }, 400);
  }
  console.log(`🔍 Checking scheduled notification: ${type}`);

  if (type === EVENT_TYPES.FESTIVAL_FEED_TICK) {
    return handleFestivalFeedTick(client);
  }

  if (type === EVENT_TYPES.PROGRAMA_FEED_TICK) {
    return handleProgramaFeedTick(client);
  }

  // Check if it's time to send
  const { shouldSend, config } = await checkAndGetScheduleConfig(client, type, body.force);

  if (!config) {
    return jsonResponse({ status: 'skipped', reason: 'Not scheduled time or already sent' });
  }

  const timezone = config.timezone || 'Europe/Madrid';
  let occurrenceKey: string | null = null;
  let resumed = false;

  if (shouldSend) {
    const freshKey = body.force
      ? `manual:${currentDateInTimezone(timezone)}:${Date.now()}`
      : `${currentDateInTimezone(timezone)}:${config.schedule_time}`;
    const { data: claimed, error: claimError } = await client.rpc('claim_push_schedule', {
      p_event_type: type,
      p_occurrence_key: freshKey,
    });
    if (claimError) {
      console.error('❌ Failed to claim scheduled occurrence:', claimError);
      return jsonResponse({ status: 'error', reason: 'Failed to claim scheduled occurrence' }, 500);
    }
    if (claimed) occurrenceKey = freshKey;
  }

  // The minute gate above opens once a day, so an occurrence left 'retryable' by
  // a partial send would never be revisited under its own key. Resume it on any
  // tick instead, independently of the gate. A forced run always starts a fresh
  // occurrence, so it never adopts an interrupted one.
  if (!occurrenceKey && !body.force) {
    const { data: retryKey, error: retryError } = await client.rpc('claim_push_schedule_retry', {
      p_event_type: type,
    });
    if (retryError) {
      logEvent('error', 'push_schedule_retry_claim_failed', {
        errorCode: retryError.code ?? 'unknown',
      });
    } else if (typeof retryKey === 'string' && retryKey.length > 0) {
      occurrenceKey = retryKey;
      resumed = true;
      console.log(`🔁 Resuming interrupted scheduled occurrence: ${retryKey}`);
    }
  }

  if (!occurrenceKey) {
    return jsonResponse({ status: 'skipped', reason: 'Not scheduled time or already sent' });
  }

  console.log(`✅ Proceeding to send scheduled notification: ${type}`);

  // A resumed occurrence must keep reporting against the day it was created for,
  // not the day the retry happens to run, or its inbox rows and summary would
  // silently target the wrong date.
  const targetDate = (resumed ? occurrenceDate(occurrenceKey) : null)
    ?? currentDateInTimezone(timezone);

  // For daily morning summary, use granular user subscriptions
  if (type === EVENT_TYPES.DAILY_MORNING_SUMMARY) {
    // Query user subscriptions
    const { data: subscriptions, error: subsError } = await client
      .from('morning_summary_subscriptions')
      .select('user_id, subscribed_departments')
      .eq('enabled', true)
      .returns<MorningSummarySubscriptionRow[]>();

    if (subsError) {
      console.error('❌ Failed to load subscriptions:', subsError);
      await client.rpc('finish_push_schedule', {
        p_event_type: type,
        p_occurrence_key: occurrenceKey,
        p_success: false,
        p_error: 'subscription_lookup_failed',
      });
      return jsonResponse({ error: 'Failed to load user subscriptions' }, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ No users subscribed to morning summary');
      await client.rpc('finish_push_schedule', {
        p_event_type: type,
        p_occurrence_key: occurrenceKey,
        p_success: true,
        p_error: null,
      });
      return jsonResponse({ status: 'skipped', reason: 'No users subscribed' });
    }

    console.log(`📨 Found ${subscriptions.length} subscribed users`);

    // Cache department data to avoid redundant queries
    const departmentDataCache = new Map<string, MorningSummaryData>();

    // Process each user
    const allResults: PushDeliveryResult[] = [];
    let successfulUsers = 0;
    let hadOperationalFailure = false;

    for (const subscription of subscriptions) {
      const userId = subscription.user_id;
      const departments = subscription.subscribed_departments ?? [];

      if (!departments || departments.length === 0) {
        console.log(`⚠️ User ${userId} has no departments subscribed`);
        continue;
      }

      console.log(`\n👤 Processing user ${userId}: departments [${departments.join(', ')}]`);

      // Fetch data for each department (use cache if available)
      const dataByDept = new Map<string, MorningSummaryData>();
      for (const dept of departments) {
        if (!departmentDataCache.has(dept)) {
          console.log(`  📊 Fetching data for ${dept}...`);
          const data = await getMorningSummaryDataForDepartment(client, dept, targetDate);
          departmentDataCache.set(dept, data);
        }
        dataByDept.set(dept, departmentDataCache.get(dept)!);
      }

      // Format message (multi-department or single)
      let title: string;
      let text: string;
      if (departments.length === 1) {
        const formatted = formatMorningSummary(departments[0], dataByDept.get(departments[0])!, targetDate);
        title = formatted.title;
        text = formatted.body;
      } else {
        const formatted = formatMultiDepartmentSummary(departments, dataByDept, targetDate);
        title = formatted.title;
        text = formatted.body;
      }

      console.log(`  📝 Message: ${title}`);

      // Build URL with query parameters for in-app viewing
      const deptParam = departments.join(',');
      const summaryUrl = `/morning-summary?date=${targetDate}&departments=${deptParam}`;

      const notificationBody: BroadcastBody = {
        action: 'broadcast',
        type,
        event_id: occurrenceKey,
        recipient_id: userId,
        target_date: targetDate,
      };
      const eventKey = await buildEventKey(notificationBody);
      const urgency = urgencyForEvent(type);
      const payload = decoratePayloadPolicy({
        title,
        body: text,
        url: summaryUrl,
        type,
        meta: {
          departments,
          targetDate,
        },
      } satisfies PushPayload, notificationBody, eventKey, urgency);

      const inboxIds = await claimInboxItems(
        client,
        [userId],
        eventKey,
        notificationBody,
        payload,
        urgency,
        true,
      );
      if (inboxIds.size === 0) continue;

      let preference: RecipientPreference | undefined;
      try {
        preference = (await loadRecipientPreferences(client, [userId], notificationBody, urgency)).get(userId);
      } catch (error) {
        hadOperationalFailure = true;
        logEvent("error", "scheduled_push_preference_lookup_failed", {
          errorCode: error instanceof Error ? error.name : "unknown",
        });
        await recordDeliveryResults(client, inboxIds, [], [], [userId]);
        continue;
      }
      if (
        preference?.accountEnabled === false
        || preference?.categoryEnabled === false
        || preference?.quietNow === true
        || preference?.muted === true
      ) {
        await recordDeliveryResults(client, inboxIds, [], [userId]);
        continue;
      }

      // Load push subscriptions only after the durable inbox item is claimed.
      const { data: pushSubs, error: pushSubsErr } = await client
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId)
        .eq('enabled', true)
        .returns<PushSubscriptionRow[]>();

      if (pushSubsErr) {
        hadOperationalFailure = true;
        logEvent("error", "scheduled_push_subscription_lookup_failed", {
          errorCode: pushSubsErr.code ?? "unknown",
        });
        await recordDeliveryResults(client, inboxIds, [], [], [userId]);
        continue;
      }

      const nativeResult = await loadNativeTokens(client, [userId]);
      if (nativeResult.error) {
        hadOperationalFailure = true;
        await recordDeliveryResults(client, inboxIds, [], [], [userId]);
        continue;
      }
      const nativeTokens = nativeResult.tokens;
      if ((!pushSubs || pushSubs.length === 0) && nativeTokens.length === 0) {
        console.log(`  ⚠️ User ${userId} has no push subscriptions`);
        await recordDeliveryResults(client, inboxIds, [], [userId]);
        continue;
      }

      // Send with the shared bounded-concurrency and transient-retry policy.
      const deliveryResults = await sendPayloadToTargets(
        client,
        (pushSubs || []).map((subscription) => ({ ...subscription, user_id: userId })),
        nativeTokens,
        payload,
      );
      await recordDeliveryResults(client, inboxIds, deliveryResults, []);
      const userSent = deliveryResults.some((result) => result.ok);
      allResults.push(...deliveryResults.map((result) => ({
        endpoint: result.endpoint,
        ok: result.ok,
        status: result.status,
        skipped: result.skipped,
        user_id: userId,
      })));

      if (userSent) {
        successfulUsers++;
        console.log(`  ✅ Sent to ${(pushSubs?.length || 0) + nativeTokens.length} device(s) for user ${userId}`);
      }
    }

    const hadProviderAttempts = allResults.length > 0;
    const scheduleSucceeded = !hadOperationalFailure && (successfulUsers > 0 || !hadProviderAttempts);
    const { error: finishError } = await client.rpc('finish_push_schedule', {
      p_event_type: type,
      p_occurrence_key: occurrenceKey,
      p_success: scheduleSucceeded,
      p_error: scheduleSucceeded ? null : 'no_provider_acceptance',
    });
    if (finishError) console.error('❌ Failed to finalize scheduled occurrence:', finishError);

    if (successfulUsers > 0) {
      const { error: updateScheduleError } = await client
        .from('push_notification_schedules')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('event_type', type);
      if (updateScheduleError) console.error('❌ Failed to update last_sent_at:', updateScheduleError);
    }

    console.log(`\n✅ Summary: Sent to ${successfulUsers}/${subscriptions.length} users, ${allResults.length} total notifications`);

    return jsonResponse({
      status: scheduleSucceeded ? (successfulUsers > 0 ? 'accepted' : 'skipped') : 'failed',
      results: allResults,
      count: allResults.length,
      users: successfulUsers,
    }, scheduleSucceeded ? 200 : 502);
  }

  // For other scheduled notification types (future expansion)
  return jsonResponse({ status: 'error', reason: 'Unsupported scheduled notification type' }, 400);
}
