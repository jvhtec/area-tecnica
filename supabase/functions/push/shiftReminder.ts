import type { SupabaseClient } from "./deps.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import { joinedSingle } from "../_shared/joins.ts";
import { EVENT_TYPES } from "./config.ts";
import { jsonResponse } from "./http.ts";
import { destinationForRole } from "./recipientDestinations.ts";
import {
  addOutcome,
  deliverScheduledToUser,
  emptyTally,
  finishScheduledRun,
} from "./scheduledDelivery.ts";
import {
  addDaysToDateKey,
  formatShiftReminder,
  isWorkingEntry,
  normalizeCallTime,
  type ShiftReminderEntry,
} from "./shiftReminderFormat.ts";
import { resolveNotificationUrl } from "./urls.ts";
import type { BroadcastBody } from "./types.ts";

type Embedded<T> = T | T[] | null;

type ShiftTimesheetRow = {
  technician_id: string;
  job_id: string;
  start_time: string | null;
  job: Embedded<{
    id: string;
    title: string | null;
    status: string | null;
    job_type: string | null;
    location: Embedded<{ name: string | null }>;
  }>;
  profile: Embedded<{ role: string | null }>;
};

type JobDateTypeRow = { job_id: string; type: string | null };

type TechnicianShifts = { role: string | null; entries: ShiftReminderEntry[] };

/** Users processed at once; each one already fans out to its devices in parallel. */
const USER_CONCURRENCY = 4;

/**
 * Everyone with an active timesheet on `targetDate`, grouped per technician.
 * Timesheets are the source of truth for "who works that day" (the same rule the
 * morning summary and the personal agenda use), and they carry the per-day call
 * time. Cancelled jobs and days marked "off" on the job are left out.
 */
export async function loadShiftsForDate(
  client: SupabaseClient,
  targetDate: string,
): Promise<Map<string, TechnicianShifts>> {
  const { data, error } = await client
    .from("timesheets")
    .select(`
      technician_id,
      job_id,
      start_time,
      job:jobs!inner(id, title, status, job_type, location:locations(name)),
      profile:profiles!fk_timesheets_technician_id!inner(role)
    `)
    .eq("is_active", true)
    .eq("date", targetDate)
    .returns<ShiftTimesheetRow[]>();
  if (error) throw error;
  const rows = data ?? [];

  const jobIds = Array.from(new Set(rows.map((row) => row.job_id)));
  const dateTypes = new Map<string, string | null>();
  if (jobIds.length > 0) {
    const { data: typeRows, error: typeError } = await client
      .from("job_date_types")
      .select("job_id, type")
      .eq("date", targetDate)
      .in("job_id", jobIds)
      .returns<JobDateTypeRow[]>();
    if (typeError) throw typeError;
    for (const row of typeRows ?? []) dateTypes.set(row.job_id, row.type);
  }

  const byTechnician = new Map<string, TechnicianShifts>();
  for (const row of rows) {
    const job = joinedSingle(row.job);
    if (!job || job.status === "Cancelado") continue;
    const entry: ShiftReminderEntry = {
      jobId: row.job_id,
      jobTitle: job.title?.trim() || "Trabajo",
      jobType: job.job_type,
      jobStatus: job.status,
      startTime: normalizeCallTime(row.start_time),
      locationName: joinedSingle(job.location)?.name?.trim() || null,
      dateType: dateTypes.get(row.job_id) ?? null,
    };
    if (!isWorkingEntry(entry)) continue;

    const shifts = byTechnician.get(row.technician_id)
      ?? { role: joinedSingle(row.profile)?.role ?? null, entries: [] };
    // One reminder line per job even if a job has several rows for the day.
    if (!shifts.entries.some((existing) => existing.jobId === entry.jobId)) {
      shifts.entries.push(entry);
    }
    byTechnician.set(row.technician_id, shifts);
  }
  return byTechnician;
}

/** Where tapping the reminder should land for this technician. */
export function shiftReminderUrl(shifts: TechnicianShifts): string {
  if (shifts.entries.length === 1) {
    const [entry] = shifts.entries;
    const jobUrl = resolveNotificationUrl(EVENT_TYPES.JOB_UPDATED, entry.jobId, undefined, entry.jobType);
    return destinationForRole(jobUrl, shifts.role, { jobId: entry.jobId, jobUrl });
  }
  if (shifts.role === "technician") return "/tech-app?tab=jobs";
  return destinationForRole("/personal", shifts.role);
}

/** True once the local calendar day has moved past the evening the occurrence was for. */
export function isOccurrenceStale(occurrenceDay: string, timezone: string, now: Date = new Date()): boolean {
  // en-CA formats as YYYY-MM-DD, so the comparison is a plain string compare.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return today > occurrenceDay;
}

async function runBounded<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/**
 * Sends tomorrow's shift reminder for one claimed scheduler occurrence. The
 * occurrence is keyed by the evening it runs on, so a resumed retry still
 * reminds about the same next day.
 */
export async function handleShiftReminderOccurrence(
  client: SupabaseClient,
  occurrenceKey: string,
  occurrenceDay: string,
  timezone: string,
  now: Date = new Date(),
) {
  const type = EVENT_TYPES.JOB_SHIFT_REMINDER;
  const targetDate = addDaysToDateKey(occurrenceDay, 1);

  // A retry resumed after midnight (or on a later evening) would announce
  // "mañana" for a day that has already started. Such an occurrence is left to
  // exhaust its retry budget instead of sending a misleading reminder.
  if (isOccurrenceStale(occurrenceDay, timezone, now)) {
    logEvent("warn", "shift_reminder_occurrence_stale", { occurrenceDay });
    await client.rpc("finish_push_schedule", {
      p_event_type: type,
      p_occurrence_key: occurrenceKey,
      p_success: false,
      p_error: "stale_occurrence",
    });
    return jsonResponse({ status: "skipped", reason: "stale_occurrence", targetDate });
  }

  let shiftsByTechnician: Map<string, TechnicianShifts>;
  try {
    shiftsByTechnician = await loadShiftsForDate(client, targetDate);
  } catch (error) {
    logEvent("error", "shift_reminder_lookup_failed", {
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    await client.rpc("finish_push_schedule", {
      p_event_type: type,
      p_occurrence_key: occurrenceKey,
      p_success: false,
      p_error: "shift_lookup_failed",
    });
    return jsonResponse({ status: "error", reason: "Failed to load shifts" }, 500);
  }

  const tally = emptyTally();
  await runBounded(Array.from(shiftsByTechnician.entries()), USER_CONCURRENCY, async ([userId, shifts]) => {
    const { title, body } = formatShiftReminder(shifts.entries);
    const notificationBody: BroadcastBody = {
      action: "broadcast",
      type,
      event_id: occurrenceKey,
      recipient_id: userId,
      target_date: targetDate,
      ...(shifts.entries.length === 1 ? { job_id: shifts.entries[0].jobId } : {}),
    };
    try {
      const outcome = await deliverScheduledToUser(client, userId, notificationBody, {
        title,
        body,
        url: shiftReminderUrl(shifts),
        meta: {
          targetDate,
          jobIds: shifts.entries.map((entry) => entry.jobId),
          ...(shifts.entries.length === 1 ? { jobId: shifts.entries[0].jobId } : {}),
        },
      });
      addOutcome(tally, outcome);
    } catch (error) {
      // An inbox claim failure for one technician must not abort everyone
      // else's reminder; the occurrence stays retryable for this user.
      tally.hadOperationalFailure = true;
      logEvent("error", "shift_reminder_user_failed", {
        errorCode: error instanceof Error ? error.name : "unknown",
      });
    }
  });

  const succeeded = await finishScheduledRun(client, type, occurrenceKey, tally);
  logEvent("info", "shift_reminder_run_finished", {
    targetDate,
    technicians: shiftsByTechnician.size,
    successfulUsers: tally.successfulUsers,
    succeeded,
  });

  return jsonResponse({
    status: succeeded ? (tally.successfulUsers > 0 ? "accepted" : "skipped") : "failed",
    targetDate,
    technicians: shiftsByTechnician.size,
    users: tally.successfulUsers,
  }, succeeded ? 200 : 502);
}
