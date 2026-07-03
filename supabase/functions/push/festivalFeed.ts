import type { createClient } from "./deps.ts";
import { EVENT_TYPES } from "./config.ts";
import { jsonResponse } from "./http.ts";
import { sendPayloadToUsers } from "./broadcast/delivery.ts";
import type { PushPayload } from "./types.ts";
import {
  buildAssignedStagesByUserJob,
  buildAssignedUsersByShift,
  buildFestivalFeedArtistEvents,
  buildFestivalFeedPayload,
  buildFestivalFeedShiftEvents,
  formatDateKeyInTimeZone,
  addDaysToDateKey,
  isDueInWindow,
  resolveArtistRecipients,
  resolveShiftRecipients,
  type FestivalFeedArtist,
  type FestivalFeedShift,
  type FestivalFeedShiftAssignment,
  type FestivalFeedSubscription,
} from "./festivalFeedUtils.ts";

type FestivalFeedClient = ReturnType<typeof createClient>;

type FestivalPushSubscriptionRow = {
  user_id: string;
  job_id: string;
  enabled: boolean;
  stages: number[] | null;
};

type ProfileRoleRow = {
  id: string;
  role: string | null;
};

type FestivalStageRow = {
  job_id: string | null;
  number: number;
  name: string;
};

type PostgrestErrorLike = {
  code?: string;
  message?: string;
};

const asErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as PostgrestErrorLike;
  return typeof candidate.code === "string" ? candidate.code : null;
};

const buildStageNames = (rows: FestivalStageRow[] | null | undefined): Map<string, string> => {
  const stageNames = new Map<string, string>();
  for (const row of rows ?? []) {
    if (!row.job_id || typeof row.number !== "number") continue;
    stageNames.set(`${row.job_id}:${row.number}`, row.name);
    stageNames.set(String(row.number), row.name);
  }
  return stageNames;
};

const getTargetDateRange = (now: Date) => {
  const today = formatDateKeyInTimeZone(now);
  return {
    start: addDaysToDateKey(today, -1),
    end: addDaysToDateKey(today, 1),
  };
};

const loadProfilesById = async (
  client: FestivalFeedClient,
  userIds: string[],
): Promise<Map<string, string | null>> => {
  if (userIds.length === 0) return new Map();

  const { data, error } = await client
    .from("profiles")
    .select("id, role")
    .in("id", userIds)
    .returns<ProfileRoleRow[]>();

  if (error) {
    console.error("festival feed failed loading profile roles", error);
    return new Map();
  }

  return new Map((data ?? []).map((row) => [row.id, row.role]));
};

const loadFestivalFeedData = async (
  client: FestivalFeedClient,
  jobIds: string[],
  now: Date,
) => {
  const { start, end } = getTargetDateRange(now);

  const [artistsResult, shiftsResult, stagesResult] = await Promise.all([
    client
      .from("festival_artists")
      .select(
        "id, job_id, name, date, stage, show_start, soundcheck, soundcheck_start, line_check, line_check_start, timezone, isaftermidnight",
      )
      .in("job_id", jobIds)
      .gte("date", start)
      .lte("date", end)
      .returns<FestivalFeedArtist[]>(),
    client
      .from("festival_shifts")
      .select("id, job_id, date, stage, name, start_time, end_time")
      .in("job_id", jobIds)
      .gte("date", start)
      .lte("date", end)
      .returns<FestivalFeedShift[]>(),
    client
      .from("festival_stages")
      .select("job_id, number, name")
      .in("job_id", jobIds)
      .returns<FestivalStageRow[]>(),
  ]);

  if (artistsResult.error) {
    throw new Error(`Failed to load festival artists: ${artistsResult.error.message}`);
  }
  if (shiftsResult.error) {
    throw new Error(`Failed to load festival shifts: ${shiftsResult.error.message}`);
  }
  if (stagesResult.error) {
    console.warn("festival feed failed loading stage names", stagesResult.error);
  }

  const shifts = shiftsResult.data ?? [];
  const shiftIds = shifts.map((shift) => shift.id).filter(Boolean);
  let assignments: FestivalFeedShiftAssignment[] = [];

  if (shiftIds.length > 0) {
    const { data, error } = await client
      .from("festival_shift_assignments")
      .select("shift_id, technician_id")
      .in("shift_id", shiftIds)
      .not("technician_id", "is", null)
      .returns<FestivalFeedShiftAssignment[]>();

    if (error) {
      throw new Error(`Failed to load festival shift assignments: ${error.message}`);
    }
    assignments = data ?? [];
  }

  return {
    artists: artistsResult.data ?? [],
    shifts,
    assignments,
    stageNames: buildStageNames(stagesResult.data),
  };
};

const insertDeliveryLog = async (
  client: FestivalFeedClient,
  userId: string,
  event: ReturnType<typeof buildFestivalFeedArtistEvents>[number],
  payload: PushPayload,
): Promise<"inserted" | "duplicate" | "failed"> => {
  const { error } = await client
    .from("festival_push_delivery_log")
    .insert({
      user_id: userId,
      job_id: event.jobId,
      event_key: event.eventKey,
      event_kind: event.eventKind,
      due_at: event.dueAt.toISOString(),
      payload: JSON.parse(JSON.stringify(payload)),
    });

  if (!error) return "inserted";
  if (asErrorCode(error) === "23505") return "duplicate";

  console.error("festival feed failed inserting delivery log", {
    userId,
    eventKey: event.eventKey,
    error,
  });
  return "failed";
};

export async function handleFestivalFeedTick(
  client: FestivalFeedClient,
  now = new Date(),
) {
  const { data, error } = await client
    .from("festival_push_subscriptions")
    .select("user_id, job_id, enabled, stages")
    .eq("enabled", true)
    .returns<FestivalPushSubscriptionRow[]>();

  if (error) {
    console.error("festival feed failed loading subscriptions", error);
    return jsonResponse({ error: "Failed to load festival feed subscriptions" }, 500);
  }

  const rawSubscriptions = (data ?? []).filter((row) => (row.stages ?? []).length > 0);
  if (rawSubscriptions.length === 0) {
    return jsonResponse({ status: "skipped", reason: "No users subscribed" });
  }

  const profileRoles = await loadProfilesById(
    client,
    Array.from(new Set(rawSubscriptions.map((row) => row.user_id))),
  );

  const subscriptions: FestivalFeedSubscription[] = rawSubscriptions.map((row) => ({
    user_id: row.user_id,
    job_id: row.job_id,
    enabled: row.enabled,
    stages: Array.from(new Set(row.stages ?? [])).sort((a, b) => a - b),
    role: profileRoles.get(row.user_id) ?? null,
  }));

  const jobIds = Array.from(new Set(subscriptions.map((row) => row.job_id)));
  if (jobIds.length === 0) {
    return jsonResponse({ status: "skipped", reason: "No subscribed jobs" });
  }

  let feedData: Awaited<ReturnType<typeof loadFestivalFeedData>>;
  try {
    feedData = await loadFestivalFeedData(client, jobIds, now);
  } catch (loadError) {
    console.error("festival feed failed loading data", loadError);
    return jsonResponse({ error: "Failed to load festival feed data" }, 500);
  }

  const assignedStagesByUserJob = buildAssignedStagesByUserJob(feedData.shifts, feedData.assignments);
  const assignedUsersByShift = buildAssignedUsersByShift(feedData.assignments);

  const artistEvents = buildFestivalFeedArtistEvents(feedData.artists, feedData.stageNames)
    .filter((event) => isDueInWindow(event.dueAt, now));
  const shiftEvents = buildFestivalFeedShiftEvents(feedData.shifts, feedData.stageNames)
    .filter((event) => isDueInWindow(event.dueAt, now));

  const dueEvents = [...artistEvents, ...shiftEvents].sort(
    (left, right) => left.dueAt.getTime() - right.dueAt.getTime(),
  );

  if (dueEvents.length === 0) {
    return jsonResponse({ status: "skipped", reason: "No due festival feed events" });
  }

  let attemptedUsers = 0;
  let duplicateUsers = 0;
  let deliveredCount = 0;
  let failedLogInserts = 0;

  for (const event of dueEvents) {
    const recipients = event.shiftId
      ? resolveShiftRecipients(event, subscriptions, assignedUsersByShift)
      : resolveArtistRecipients(event, subscriptions, assignedStagesByUserJob);

    for (const recipient of recipients) {
      const payload = buildFestivalFeedPayload(event, recipient);
      const logStatus = await insertDeliveryLog(client, recipient.user_id, event, payload);

      if (logStatus === "duplicate") {
        duplicateUsers++;
        continue;
      }
      if (logStatus === "failed") {
        failedLogInserts++;
        continue;
      }

      attemptedUsers++;
      const results = await sendPayloadToUsers(client, [recipient.user_id], payload);
      deliveredCount += results.filter((result) => result.ok).length;
    }
  }

  return jsonResponse({
    status: "sent",
    type: EVENT_TYPES.FESTIVAL_FEED_TICK,
    dueEvents: dueEvents.length,
    attemptedUsers,
    duplicateUsers,
    failedLogInserts,
    deliveredCount,
  });
}
