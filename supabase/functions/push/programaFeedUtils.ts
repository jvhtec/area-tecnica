import type { PushPayload } from "./types.ts";
import {
  addDaysToDateKey,
  FESTIVAL_FEED_TIMEZONE,
  formatDateKeyInTimeZone,
  zonedDateTimeToUtc,
} from "./festivalFeedUtils.ts";

export const PROGRAMA_FEED_EVENT_TYPE = "programa.feed.tick";
export const PROGRAMA_FEED_TIMEZONE = FESTIVAL_FEED_TIMEZONE;

export type ProgramaProgramRow = {
  id?: string | null;
  time?: string | null;
  item?: string | null;
  notes?: string | null;
  notify?: boolean | null;
  departments?: string[] | null;
};

export type ProgramaProgramDay = {
  date?: string | null;
  rows?: ProgramaProgramRow[] | null;
};

export type ProgramaJob = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
};

export type ProgramaAssignment = {
  technician_id: string;
  status: string | null;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
  department: string | null;
  push_notifications_enabled: boolean | null;
};

export type ProgramaFeedEvent = {
  eventKey: string;
  jobId: string;
  dueAt: Date;
  dateKey: string;
  rowId: string;
  item: string;
  notes: string | null;
  time: string;
  departments: string[];
};

const KNOWN_DEPARTMENTS = new Set([
  "sound",
  "lights",
  "video",
  "production",
  "logistics",
  "administrative",
]);

const normalizeDepartment = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return KNOWN_DEPARTMENTS.has(normalized) ? normalized : null;
};

const hasActiveRole = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "none";
};

// Mirrors src/utils/assignmentNotificationDepartments.ts — duplicated rather than shared
// because edge functions (Deno) can't import from src/ (frontend, Vite/Node-oriented).
export const deriveAssignmentDepartments = (assignment: ProgramaAssignment): string[] => {
  const departments = new Set<string>();

  if (hasActiveRole(assignment.sound_role)) departments.add("sound");
  if (hasActiveRole(assignment.lights_role)) departments.add("lights");
  if (hasActiveRole(assignment.video_role)) departments.add("video");
  if (hasActiveRole(assignment.production_role)) departments.add("production");

  if (departments.size === 0) {
    const fallback = normalizeDepartment(assignment.department);
    if (fallback) departments.add(fallback);
  }

  return Array.from(departments);
};

const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

// Builds due-events for rows marked `notify: true`. Rows tied to a specific day
// (`day.date` set) only ever fire on that date; undated rows (common on multi-day
// jobs where staff didn't bother filling in per-day dates) recur on every candidate
// date within the job's own run, bounded to the same 3-day window the feed polls
// (yesterday/today/tomorrow) so a single tick never has to enumerate an entire tour.
export const buildProgramaDueEvents = (
  job: ProgramaJob,
  days: ProgramaProgramDay[] | null | undefined,
  now: Date,
): ProgramaFeedEvent[] => {
  const events: ProgramaFeedEvent[] = [];
  const today = formatDateKeyInTimeZone(now, PROGRAMA_FEED_TIMEZONE);
  const candidateDates = [addDaysToDateKey(today, -1), today, addDaysToDateKey(today, 1)];

  const jobStartDate = formatDateKeyInTimeZone(new Date(job.start_time), PROGRAMA_FEED_TIMEZONE);
  const jobEndDate = formatDateKeyInTimeZone(new Date(job.end_time), PROGRAMA_FEED_TIMEZONE);

  for (const day of days ?? []) {
    for (const row of day.rows ?? []) {
      if (!row.notify || !row.id || !row.time || !TIME_PATTERN.test(row.time)) continue;

      const datesToCheck = day.date
        ? [day.date]
        : candidateDates.filter((dateKey) => dateKey >= jobStartDate && dateKey <= jobEndDate);

      for (const dateKey of datesToCheck) {
        const dueAt = zonedDateTimeToUtc(dateKey, row.time, PROGRAMA_FEED_TIMEZONE);
        if (!dueAt) continue;

        events.push({
          eventKey: `programa:${job.id}:${row.id}:${dateKey}`,
          jobId: job.id,
          dueAt,
          dateKey,
          rowId: row.id,
          item: row.item || "",
          notes: row.notes ?? null,
          time: row.time,
          departments: Array.isArray(row.departments)
            ? row.departments.filter((d): d is string => typeof d === "string")
            : [],
        });
      }
    }
  }

  return events;
};

export const resolveProgramaRecipients = (
  event: ProgramaFeedEvent,
  assignments: ProgramaAssignment[],
): ProgramaAssignment[] => {
  const eligible = assignments.filter(
    (assignment) => assignment.status === "confirmed" && assignment.push_notifications_enabled === true,
  );

  if (event.departments.length === 0) return eligible;

  const wanted = new Set(event.departments);
  return eligible.filter((assignment) =>
    deriveAssignmentDepartments(assignment).some((department) => wanted.has(department))
  );
};

export const buildProgramaMessage = (
  job: ProgramaJob,
  event: ProgramaFeedEvent,
): { title: string; body: string } => {
  const timeLabel = event.time.slice(0, 5);
  const body = event.notes
    ? `${job.title}: ${event.item} a las ${timeLabel} — ${event.notes}`
    : `${job.title}: ${event.item} a las ${timeLabel}`;

  return { title: "Recordatorio de programa", body };
};

export const buildProgramaPayload = (job: ProgramaJob, event: ProgramaFeedEvent): PushPayload => {
  const message = buildProgramaMessage(job, event);

  return {
    title: message.title,
    body: message.body,
    type: PROGRAMA_FEED_EVENT_TYPE,
    meta: {
      eventKey: event.eventKey,
      jobId: job.id,
      rowId: event.rowId,
      time: event.time,
      date: event.dateKey,
      departments: event.departments,
    },
  };
};
