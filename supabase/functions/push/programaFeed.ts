import type { createClient } from "./deps.ts";
import { EVENT_TYPES } from "./config.ts";
import { jsonResponse } from "./http.ts";
import { sendPayloadToUsers } from "./broadcast/delivery.ts";
import type { PushPayload } from "./types.ts";
import { addDaysToDateKey, formatDateKeyInTimeZone, isDueInWindow, zonedDateTimeToUtc } from "./festivalFeedUtils.ts";
import {
  buildProgramaDueEvents,
  buildProgramaPayload,
  PROGRAMA_FEED_TIMEZONE,
  resolveProgramaRecipients,
  type ProgramaAssignment,
  type ProgramaFeedEvent,
  type ProgramaJob,
  type ProgramaProgramDay,
} from "./programaFeedUtils.ts";

type ProgramaFeedClient = ReturnType<typeof createClient>;

type JobRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
};

type HojaDeRutaRow = {
  job_id: string;
  program_schedule_json: ProgramaProgramDay[] | null;
};

type JobAssignmentRow = {
  job_id: string;
  technician_id: string;
  status: string | null;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
};

type ProfileRow = {
  id: string;
  department: string | null;
  push_notifications_enabled: boolean | null;
};

type PostgrestErrorLike = { code?: string; message?: string };

const asErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as PostgrestErrorLike;
  return typeof candidate.code === "string" ? candidate.code : null;
};

// Only festival/dryhire jobs are excluded — every other job_type (single, tour,
// tourdate, evento, ciclo, and any future addition) is eligible for programa push.
const EXCLUDED_JOB_TYPES = ["festival", "dryhire"];

const getWindowBounds = (now: Date) => {
  const today = formatDateKeyInTimeZone(now, PROGRAMA_FEED_TIMEZONE);
  const start = zonedDateTimeToUtc(addDaysToDateKey(today, -1), "00:00:00", PROGRAMA_FEED_TIMEZONE);
  const end = zonedDateTimeToUtc(addDaysToDateKey(today, 1), "23:59:59", PROGRAMA_FEED_TIMEZONE);
  return { start, end };
};

const loadEligibleJobsWithProgramas = async (
  client: ProgramaFeedClient,
  now: Date,
): Promise<Array<{ job: ProgramaJob; days: ProgramaProgramDay[] }>> => {
  const { start, end } = getWindowBounds(now);
  if (!start || !end) return [];

  const { data: jobs, error: jobsError } = await client
    .from("jobs")
    .select("id, title, start_time, end_time")
    .not("job_type", "in", `(${EXCLUDED_JOB_TYPES.join(",")})`)
    .lte("start_time", end.toISOString())
    .gte("end_time", start.toISOString())
    .returns<JobRow[]>();

  if (jobsError) {
    throw new Error(`Failed to load jobs for programa feed: ${jobsError.message}`);
  }

  const jobIds = (jobs ?? []).map((job) => job.id);
  if (jobIds.length === 0) return [];

  const { data: hojas, error: hojasError } = await client
    .from("hoja_de_ruta")
    .select("job_id, program_schedule_json")
    .in("job_id", jobIds)
    .not("program_schedule_json", "is", null)
    .returns<HojaDeRutaRow[]>();

  if (hojasError) {
    throw new Error(`Failed to load hoja de ruta programas: ${hojasError.message}`);
  }

  const jobById = new Map((jobs ?? []).map((job) => [job.id, job]));

  return (hojas ?? [])
    .map((hoja) => {
      const job = jobById.get(hoja.job_id);
      if (!job || !Array.isArray(hoja.program_schedule_json)) return null;
      return { job, days: hoja.program_schedule_json };
    })
    .filter((entry): entry is { job: ProgramaJob; days: ProgramaProgramDay[] } => entry !== null);
};

const loadAssignmentsByJob = async (
  client: ProgramaFeedClient,
  jobIds: string[],
): Promise<Map<string, ProgramaAssignment[]>> => {
  const assignmentsByJob = new Map<string, ProgramaAssignment[]>();
  if (jobIds.length === 0) return assignmentsByJob;

  const { data: assignments, error: assignmentsError } = await client
    .from("job_assignments")
    .select("job_id, technician_id, status, sound_role, lights_role, video_role, production_role")
    .eq("status", "confirmed")
    .in("job_id", jobIds)
    .returns<JobAssignmentRow[]>();

  if (assignmentsError) {
    console.error("programa feed failed loading job assignments", assignmentsError);
    return assignmentsByJob;
  }

  const technicianIds = Array.from(
    new Set((assignments ?? []).map((row) => row.technician_id).filter(Boolean)),
  );
  if (technicianIds.length === 0) return assignmentsByJob;

  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id, department, push_notifications_enabled")
    .in("id", technicianIds)
    .eq("push_notifications_enabled", true)
    .returns<ProfileRow[]>();

  if (profilesError) {
    console.error("programa feed failed loading profiles", profilesError);
    return assignmentsByJob;
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  for (const row of assignments ?? []) {
    const profile = profileById.get(row.technician_id);
    if (!profile) continue; // push disabled or profile missing

    const entry: ProgramaAssignment = {
      technician_id: row.technician_id,
      status: row.status,
      sound_role: row.sound_role,
      lights_role: row.lights_role,
      video_role: row.video_role,
      production_role: row.production_role,
      department: profile.department,
      push_notifications_enabled: profile.push_notifications_enabled,
    };

    const list = assignmentsByJob.get(row.job_id) ?? [];
    list.push(entry);
    assignmentsByJob.set(row.job_id, list);
  }

  return assignmentsByJob;
};

const insertDeliveryLog = async (
  client: ProgramaFeedClient,
  userId: string,
  event: ProgramaFeedEvent,
  payload: PushPayload,
): Promise<"inserted" | "duplicate" | "failed"> => {
  const { error } = await client
    .from("programa_push_delivery_log")
    .insert({
      user_id: userId,
      job_id: event.jobId,
      event_key: event.eventKey,
      event_kind: "programa_row",
      due_at: event.dueAt.toISOString(),
      payload: JSON.parse(JSON.stringify(payload)),
    });

  if (!error) return "inserted";
  if (asErrorCode(error) === "23505") return "duplicate";

  console.error("programa feed failed inserting delivery log", {
    userId,
    eventKey: event.eventKey,
    error,
  });
  return "failed";
};

export async function handleProgramaFeedTick(
  client: ProgramaFeedClient,
  now = new Date(),
) {
  let entries: Array<{ job: ProgramaJob; days: ProgramaProgramDay[] }>;
  try {
    entries = await loadEligibleJobsWithProgramas(client, now);
  } catch (loadError) {
    console.error("programa feed failed loading jobs/programas", loadError);
    return jsonResponse({ error: "Failed to load programa feed data" }, 500);
  }

  if (entries.length === 0) {
    return jsonResponse({ status: "skipped", reason: "No eligible jobs with programa data" });
  }

  const jobById = new Map(entries.map((entry) => [entry.job.id, entry.job]));

  const dueEvents = entries
    .flatMap((entry) => buildProgramaDueEvents(entry.job, entry.days, now))
    .filter((event) => isDueInWindow(event.dueAt, now))
    .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());

  if (dueEvents.length === 0) {
    return jsonResponse({ status: "skipped", reason: "No due programa events" });
  }

  const dueJobIds = Array.from(new Set(dueEvents.map((event) => event.jobId)));
  const assignmentsByJob = await loadAssignmentsByJob(client, dueJobIds);

  let attemptedUsers = 0;
  let duplicateUsers = 0;
  let deliveredCount = 0;
  let failedLogInserts = 0;

  for (const event of dueEvents) {
    const job = jobById.get(event.jobId);
    if (!job) continue;

    const assignments = assignmentsByJob.get(event.jobId) ?? [];
    const recipients = resolveProgramaRecipients(event, assignments);
    if (recipients.length === 0) continue;

    const payload = buildProgramaPayload(job, event);

    for (const recipient of recipients) {
      const logStatus = await insertDeliveryLog(client, recipient.technician_id, event, payload);

      if (logStatus === "duplicate") {
        duplicateUsers++;
        continue;
      }
      if (logStatus === "failed") {
        failedLogInserts++;
        continue;
      }

      attemptedUsers++;
      const results = await sendPayloadToUsers(client, [recipient.technician_id], payload);
      deliveredCount += results.filter((result) => result.ok).length;
    }
  }

  return jsonResponse({
    status: "sent",
    type: EVENT_TYPES.PROGRAMA_FEED_TICK,
    dueEvents: dueEvents.length,
    attemptedUsers,
    duplicateUsers,
    failedLogInserts,
    deliveredCount,
  });
}
