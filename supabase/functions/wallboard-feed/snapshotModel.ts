import type { DocDept } from "./docRules.ts";

export type Dept = DocDept;
export type Readiness = "green" | "yellow" | "red";
export type TimesheetStatus = "submitted" | "draft" | "missing" | "approved" | "rejected";

export const SNAPSHOT_JOB_TYPES = [
  "single",
  "festival",
  "ciclo",
  "tourdate",
  "dryhire",
  "evento",
] as const;
export const SNAPSHOT_JOB_STATUSES = ["Confirmado", "Tentativa", "Completado"] as const;

const DEPARTMENTS: readonly Dept[] = ["sound", "lights", "video"];
const MADRID_TIMEZONE = "Europe/Madrid";
const OVERDUE_TIMESHEET_LOOKBACK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A required document still missing this close to the job start is critical. */
export const DOC_CRITICAL_WINDOW_MS = 72 * 60 * 60 * 1000;
/** The calendar shows four weeks starting on the current Madrid Monday. */
export const CALENDAR_DAYS = 28;
export const DEFAULT_HIGHLIGHT_TTL_SECONDS = 300;
export const SNAPSHOT_ANNOUNCEMENT_LIMIT = 20;
export const HIGHLIGHT_ANNOUNCEMENT_LIKE_PATTERN = "%[HIGHLIGHT_JOB:%";
const HIGHLIGHT_ANNOUNCEMENT_PATTERN = /^\s*\[HIGHLIGHT_JOB:[a-f0-9-]+\]\s*/i;
const DEPARTMENT_LABELS: Record<Dept, string> = {
  sound: "sonido",
  lights: "luces",
  video: "vídeo",
};

export type SnapshotAssignmentRow = {
  technician_id: string | null;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
};

export type SnapshotJobRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string | null;
  job_type: string | null;
  tour_id: string | null;
  color: string | null;
  locationName: string | null;
  departments: Array<string | null>;
  assignments: SnapshotAssignmentRow[];
};

export type RequiredRoleRow = {
  job_id: string;
  department: string | null;
  total_required: number | null;
};

export type DocRequirementRow = {
  department: string | null;
  key: string;
  label: string | null;
};

export type DocState = "delivered" | "pending" | "missing";

export type DocChecklistItem = {
  dept: Dept;
  key: string;
  label: string;
  state: DocState;
};

export type PendingKind = "staffing" | "docs" | "timesheet";

export type PendingItem = {
  severity: "red" | "yellow";
  text: string;
  kind: PendingKind;
  jobId: string;
  jobTitle: string;
  color: string | null;
  startTime: string;
  dept: Dept | null;
  count: number;
  detail: string | null;
};

export type TimesheetStatusRow = {
  job_id: string;
  technician_id: string;
  status: string | null;
};

export type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type SnapshotLogisticsRow = {
  id: string;
  event_date: string;
  event_time: string;
  title: string | null;
  transport_type: string | null;
  transport_provider: string | null;
  license_plate: string | null;
  job_id: string | null;
  jobTitle: string | null;
  event_type: string | null;
  loading_bay: string | null;
  color: string | null;
  notes: string | null;
  departments: string[];
};

export type SnapshotAnnouncementRow = {
  id: string;
  message: string;
  level: string;
  active: boolean;
  created_at: string;
};

export type SnapshotWindows = {
  todayKey: string;
  weekEndKey: string;
  weekStartISO: string;
  weekEndISO: string;
  gridStartKey: string;
  gridEndKey: string;
  calendarStartISO: string;
  calendarEndISO: string;
  calendarEndExclusiveISO: string;
  queryStartISO: string;
  overdueStartISO: string;
  overdueCutoffISO: string;
  focusMonth: number;
  focusYear: number;
};

export type SnapshotInputs = {
  generatedAt: Date;
  presetSlug?: string | null;
  highlightTtlSeconds: number;
  visibleJobs: SnapshotJobRow[];
  overdueJobs: SnapshotJobRow[];
  cancelledTourIds: Set<string>;
  requiredRoles: RequiredRoleRow[];
  docRequirements: DocRequirementRow[];
  /** `jobId -> Set<"dept:key">` of documents already delivered, see docRules.ts. */
  deliveredDocs: Map<string, Set<string>>;
  timesheets: TimesheetStatusRow[];
  profiles: ProfileRow[];
  logistics: SnapshotLogisticsRow[];
  announcements: SnapshotAnnouncementRow[];
  windows: SnapshotWindows;
};

export function normalizeHighlightTtlSeconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_HIGHLIGHT_TTL_SECONDS;
  return Math.min(3600, Math.max(30, Math.round(parsed)));
}

export function selectSnapshotAnnouncements(
  rows: SnapshotAnnouncementRow[],
  generatedAt: Date,
  highlightTtlSeconds: number,
  limit = SNAPSHOT_ANNOUNCEMENT_LIMIT,
): SnapshotAnnouncementRow[] {
  const now = generatedAt.getTime();
  const ttlMs = normalizeHighlightTtlSeconds(highlightTtlSeconds) * 1000;

  return rows
    .filter((row) => {
      if (!row.active) return false;
      if (!HIGHLIGHT_ANNOUNCEMENT_PATTERN.test(row.message)) return true;
      const createdAt = new Date(row.created_at).getTime();
      return Number.isFinite(createdAt) && createdAt + ttlMs > now;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, Math.max(0, limit));
}

const madridFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MADRID_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function madridParts(date: Date) {
  const values = Object.fromEntries(
    madridFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`Invalid Madrid date key: ${dateKey}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatMadridDateKey(date: Date): string {
  const { year, month, day } = madridParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addMadridCalendarDays(dateKey: string, amount: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function madridMidnight(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  const target = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = madridParts(new Date(candidate));
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = target - represented;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
}

export function getSnapshotWindows(generatedAt: Date): SnapshotWindows {
  const todayKey = formatMadridDateKey(generatedAt);
  const { year, month, day } = parseDateKey(todayKey);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const gridStartKey = addMadridCalendarDays(todayKey, -((weekday + 6) % 7));
  const gridEndKey = addMadridCalendarDays(gridStartKey, CALENDAR_DAYS - 1);
  const weekEndKey = addMadridCalendarDays(todayKey, 6);
  const weekEndExclusive = madridMidnight(addMadridCalendarDays(weekEndKey, 1));
  const calendarEndExclusive = madridMidnight(addMadridCalendarDays(gridEndKey, 1));
  const calendarStart = madridMidnight(gridStartKey);
  const overdueStart = madridMidnight(addMadridCalendarDays(todayKey, -OVERDUE_TIMESHEET_LOOKBACK_DAYS));

  return {
    todayKey,
    weekEndKey,
    weekStartISO: madridMidnight(todayKey).toISOString(),
    weekEndISO: new Date(weekEndExclusive.getTime() - 1).toISOString(),
    gridStartKey,
    gridEndKey,
    calendarStartISO: calendarStart.toISOString(),
    calendarEndISO: new Date(calendarEndExclusive.getTime() - 1).toISOString(),
    calendarEndExclusiveISO: calendarEndExclusive.toISOString(),
    queryStartISO: new Date(Math.min(calendarStart.getTime(), overdueStart.getTime())).toISOString(),
    overdueStartISO: overdueStart.toISOString(),
    overdueCutoffISO: new Date(generatedAt.getTime() - DAY_MS).toISOString(),
    focusMonth: month - 1,
    focusYear: year,
  };
}

const isDept = (value: unknown): value is Dept =>
  typeof value === "string" && (DEPARTMENTS as readonly string[]).includes(value);

const isTechnicianId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function overlaps(job: SnapshotJobRow, startMs: number, endMs: number): boolean {
  const jobStart = new Date(job.start_time).getTime();
  const jobEnd = new Date(job.end_time).getTime();
  return Number.isFinite(jobStart) && Number.isFinite(jobEnd) && jobEnd >= startMs && jobStart <= endMs;
}

function filterDisplayJobs(jobs: SnapshotJobRow[], cancelledTourIds: Set<string>): SnapshotJobRow[] {
  return jobs.filter((job) => !job.tour_id || !cancelledTourIds.has(job.tour_id));
}

function assignmentDepartment(assignment: SnapshotAssignmentRow): Dept | null {
  if (assignment.sound_role) return "sound";
  if (assignment.lights_role) return "lights";
  if (assignment.video_role) return "video";
  return null;
}

function assignmentRole(assignment: SnapshotAssignmentRow): string {
  return assignment.sound_role || assignment.lights_role || assignment.video_role || "asignado";
}

function buildIndex<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  return new Map(rows.map((row) => [key(row), row]));
}

function buildSnapshotIndexes(inputs: SnapshotInputs) {
  const required = new Map<string, number>();
  inputs.requiredRoles.forEach((row) => {
    if (isDept(row.department)) required.set(`${row.job_id}:${row.department}`, Number(row.total_required ?? 0));
  });
  const docRequirements = new Map<Dept, Array<{ key: string; label: string }>>();
  inputs.docRequirements.forEach((row) => {
    if (!isDept(row.department) || !row.key) return;
    const list = docRequirements.get(row.department) ?? [];
    if (!list.some((entry) => entry.key === row.key)) {
      list.push({ key: row.key, label: row.label?.trim() || row.key });
    }
    docRequirements.set(row.department, list);
  });
  const timesheets = new Map<string, TimesheetStatus>();
  inputs.timesheets.forEach((row) => {
    const status = row.status;
    const normalized: TimesheetStatus =
      status === "approved" || status === "submitted" || status === "draft" || status === "rejected"
        ? status
        : "missing";
    timesheets.set(`${row.job_id}:${row.technician_id}`, normalized);
  });
  return {
    required,
    docRequirements,
    deliveredDocs: inputs.deliveredDocs,
    generatedAtMs: inputs.generatedAt.getTime(),
    timesheets,
    profiles: buildIndex(inputs.profiles, (row) => row.id),
  };
}

type SnapshotIndexes = ReturnType<typeof buildSnapshotIndexes>;

/**
 * `includeDocs` is false for calendar-only jobs beyond the seven-day window:
 * their documents are not loaded, so reporting them as undelivered would be wrong.
 */
function mapOverviewJob(job: SnapshotJobRow, indexes: SnapshotIndexes, includeDocs = true) {
  const departments = DEPARTMENTS.filter((dept) => job.departments.includes(dept));
  const crewAssigned = { sound: 0, lights: 0, video: 0, total: 0 };
  job.assignments.forEach((assignment) => {
    if (assignment.sound_role) crewAssigned.sound += 1;
    if (assignment.lights_role) crewAssigned.lights += 1;
    if (assignment.video_role) crewAssigned.video += 1;
  });
  crewAssigned.total = crewAssigned.sound + crewAssigned.lights + crewAssigned.video;

  const crewNeeded = { sound: 0, lights: 0, video: 0, total: 0 };
  departments.forEach((dept) => {
    crewNeeded[dept] = indexes.required.get(`${job.id}:${dept}`) ?? 0;
  });
  crewNeeded.total = crewNeeded.sound + crewNeeded.lights + crewNeeded.video;

  let status: Readiness;
  if (departments.some((dept) => crewNeeded[dept] > 0)) {
    const coverage = departments.map((dept) => {
      if (crewNeeded[dept] <= 0 || crewAssigned[dept] >= crewNeeded[dept]) return 1;
      return crewAssigned[dept] > 0 ? 0.5 : 0;
    });
    const minimum = coverage.length ? Math.min(...coverage) : 0;
    status = minimum >= 1 ? "green" : minimum > 0 ? "yellow" : "red";
  } else {
    const present = departments.map((dept) => crewAssigned[dept]);
    status = departments.length > 0 && present.every((count) => count > 0)
      ? "green"
      : present.some((count) => count > 0) ? "yellow" : "red";
  }

  const delivered = indexes.deliveredDocs.get(job.id) ?? new Set<string>();
  const startsInMs = new Date(job.start_time).getTime() - indexes.generatedAtMs;
  const undeliveredState: DocState = startsInMs <= DOC_CRITICAL_WINDOW_MS ? "missing" : "pending";
  const docChecklist: DocChecklistItem[] = [];
  const docs: Partial<Record<Dept, { have: number; need: number }>> = {};
  departments.forEach((dept) => {
    const requirements = includeDocs ? indexes.docRequirements.get(dept) ?? [] : [];
    let have = 0;
    requirements.forEach(({ key, label }) => {
      const isDelivered = delivered.has(`${dept}:${key}`);
      if (isDelivered) have += 1;
      docChecklist.push({ dept, key, label, state: isDelivered ? "delivered" : undeliveredState });
    });
    docs[dept] = { have, need: requirements.length };
  });

  return {
    id: job.id,
    title: job.title,
    start_time: job.start_time,
    end_time: job.end_time,
    location: { name: job.locationName },
    departments,
    crewAssigned,
    crewNeeded,
    docs,
    docChecklist,
    status,
    color: job.color,
    job_type: job.job_type,
  };
}

const DEPARTMENT_TITLES: Record<Dept, string> = { sound: "Sonido", lights: "Luces", video: "Vídeo" };

function describeMissingDocs(items: DocChecklistItem[]): string {
  return DEPARTMENTS
    .map((dept) => {
      const labels = items.filter((item) => item.dept === dept).map((item) => item.label.toLowerCase());
      return labels.length ? `${DEPARTMENT_TITLES[dept]}: ${labels.join(", ")}` : null;
    })
    .filter((entry): entry is string => entry !== null)
    .join(" · ");
}

function buildCalendar(jobs: ReturnType<typeof mapOverviewJob>[], windows: SnapshotWindows) {
  const startMs = new Date(windows.calendarStartISO).getTime();
  const endMs = new Date(windows.calendarEndISO).getTime();
  const jobsByDate: Record<string, typeof jobs> = {};
  const jobDateLookup: Record<string, string> = {};

  jobs.forEach((job) => {
    const jobStart = new Date(job.start_time).getTime();
    const jobEnd = new Date(job.end_time).getTime();
    if (!Number.isFinite(jobStart) || !Number.isFinite(jobEnd)) return;
    jobDateLookup[job.id] = formatMadridDateKey(new Date(jobStart));
    const spanStart = Math.max(jobStart, startMs);
    const spanEnd = Math.min(jobEnd, endMs);
    if (spanEnd < spanStart) return;
    let key = formatMadridDateKey(new Date(spanStart));
    const lastKey = formatMadridDateKey(new Date(spanEnd));
    while (key <= lastKey) {
      (jobsByDate[key] ??= []).push(job);
      key = addMadridCalendarDays(key, 1);
    }
  });

  return {
    jobs,
    jobsByDate,
    jobDateLookup,
    range: { start: windows.calendarStartISO, end: windows.calendarEndISO },
    focusMonth: windows.focusMonth,
    focusYear: windows.focusYear,
  };
}

export function buildWallboardSnapshot(inputs: SnapshotInputs) {
  const generatedAtMs = inputs.generatedAt.getTime();
  const weekStartMs = new Date(inputs.windows.weekStartISO).getTime();
  const weekEndMs = new Date(inputs.windows.weekEndISO).getTime();
  const calendarStartMs = new Date(inputs.windows.calendarStartISO).getTime();
  const calendarEndMs = new Date(inputs.windows.calendarEndISO).getTime();
  const indexes = buildSnapshotIndexes(inputs);
  const visibleJobs = filterDisplayJobs(inputs.visibleJobs, inputs.cancelledTourIds);
  const overdueJobs = filterDisplayJobs(inputs.overdueJobs, inputs.cancelledTourIds);
  const detailJobs = visibleJobs.filter((job) => job.job_type !== "dryhire" && overlaps(job, weekStartMs, weekEndMs));
  const calendarJobs = visibleJobs
    .filter((job) => job.job_type !== "dryhire" && overlaps(job, calendarStartMs, calendarEndMs))
    .map((job) => mapOverviewJob(job, indexes, overlaps(job, weekStartMs, weekEndMs)))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const overviewJobs = detailJobs
    .map((job) => mapOverviewJob(job, indexes))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const overviewById = new Map(overviewJobs.map((job) => [job.id, job]));
  const crewJobs = detailJobs.map((job) => ({
    id: job.id,
    title: job.title,
    jobType: job.job_type,
    job_type: job.job_type,
    start_time: job.start_time,
    end_time: job.end_time,
    color: job.color,
    departments: overviewById.get(job.id)?.departments ?? [],
    crewNeeded: overviewById.get(job.id)?.crewNeeded ?? { sound: 0, lights: 0, video: 0, total: 0 },
    crew: job.assignments
      .filter((assignment) => isTechnicianId(assignment.technician_id))
      .map((assignment) => {
        const technicianId = assignment.technician_id as string;
        const profile = indexes.profiles.get(technicianId);
        return {
          name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
          role: assignmentRole(assignment),
          dept: assignmentDepartment(assignment),
          timesheetStatus: indexes.timesheets.get(`${job.id}:${technicianId}`) ?? "missing" as TimesheetStatus,
        };
      }),
  }));

  const pendingItems: PendingItem[] = [];
  const pendingBase = (job: { id: string; title: string; color?: string | null; start_time: string }) => ({
    jobId: job.id,
    jobTitle: job.title,
    color: job.color ?? null,
    startTime: job.start_time,
  });
  overviewJobs.forEach((job) => {
    job.departments.forEach((dept) => {
      const need = job.crewNeeded[dept];
      const have = job.crewAssigned[dept];
      if (need > 0 && have < need) {
        const within24Hours = new Date(job.start_time).getTime() - generatedAtMs <= DAY_MS;
        pendingItems.push({
          ...pendingBase(job),
          kind: "staffing",
          severity: within24Hours ? "red" : "yellow",
          dept,
          count: need - have,
          detail: null,
          text: need - have === 1
            ? `${job.title} – falta 1 puesto de ${DEPARTMENT_LABELS[dept]}`
            : `${job.title} – faltan ${need - have} puestos de ${DEPARTMENT_LABELS[dept]}`,
        });
      }
    });

    const undelivered = job.docChecklist.filter((item) => item.state !== "delivered");
    if (undelivered.length > 0) {
      const detail = describeMissingDocs(undelivered);
      pendingItems.push({
        ...pendingBase(job),
        kind: "docs",
        severity: undelivered.some((item) => item.state === "missing") ? "red" : "yellow",
        dept: null,
        count: undelivered.length,
        detail,
        text: undelivered.length === 1
          ? `${job.title} – falta 1 documento (${detail})`
          : `${job.title} – faltan ${undelivered.length} documentos (${detail})`,
      });
    }
  });

  overdueJobs
    .filter((job) => job.job_type !== "dryhire")
    .forEach((job) => {
      const technicianIds = Array.from(new Set(
        job.assignments
          .map((assignment) => assignment.technician_id)
          .filter(isTechnicianId),
      ));
      const missingCount = technicianIds.filter((technicianId) => {
        const status = indexes.timesheets.get(`${job.id}:${technicianId}`) ?? "missing";
        return status !== "submitted" && status !== "approved";
      }).length;
      if (missingCount > 0) {
        pendingItems.push({
          ...pendingBase(job),
          kind: "timesheet",
          severity: "red",
          dept: null,
          count: missingCount,
          detail: null,
          text: missingCount === 1
            ? `${job.title} – falta 1 parte de horas`
            : `${job.title} – faltan ${missingCount} partes de horas`,
        });
      }
    });

  const logisticsItems = inputs.logistics.map((event) => ({
    id: event.id,
    date: event.event_date,
    time: event.event_time,
    title: event.title || event.jobTitle || "Logística",
    transport_type: event.transport_type,
    transport_provider: event.transport_provider,
    plate: event.license_plate,
    job_title: event.jobTitle,
    procedure: event.event_type,
    loadingBay: event.loading_bay,
    departments: event.departments,
    color: event.color,
    notes: event.notes,
  })).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  return {
    schemaVersion: 1 as const,
    generatedAt: inputs.generatedAt.toISOString(),
    presetSlug: inputs.presetSlug ?? null,
    overview: { jobs: overviewJobs },
    calendar: buildCalendar(calendarJobs, inputs.windows),
    crew: { jobs: crewJobs },
    pending: { items: pendingItems },
    logistics: { items: logisticsItems },
    announcements: {
      announcements: selectSnapshotAnnouncements(
        inputs.announcements,
        inputs.generatedAt,
        inputs.highlightTtlSeconds,
      ),
    },
  };
}
