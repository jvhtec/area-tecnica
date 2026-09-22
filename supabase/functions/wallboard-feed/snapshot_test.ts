import {
  buildWallboardSnapshot,
  getSnapshotWindows,
  type SnapshotInputs,
  type SnapshotJobRow,
} from "./snapshotModel.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nExpected: ${expectedJson}\nActual:   ${actualJson}`);
  }
}

const assignment = (
  technicianId: string,
  roles: Partial<SnapshotJobRow["assignments"][number]> = {},
): SnapshotJobRow["assignments"][number] => ({
  technician_id: technicianId,
  sound_role: null,
  lights_role: null,
  video_role: null,
  ...roles,
});

const job = (overrides: Partial<SnapshotJobRow>): SnapshotJobRow => ({
  id: "job-1",
  title: "Montaje principal",
  start_time: "2026-09-23T08:00:00.000Z",
  end_time: "2026-09-23T18:00:00.000Z",
  status: "Confirmado",
  job_type: "festival",
  tour_id: null,
  color: "#123456",
  locationName: "Nave 1",
  departments: ["sound", "lights", "video"],
  assignments: [
    assignment("tech-sound", { sound_role: "responsable" }),
    assignment("tech-video", { video_role: "operador" }),
    assignment("tech-fallback"),
  ],
  ...overrides,
});

Deno.test("Madrid snapshot windows remain calendar-safe across spring DST", () => {
  const windows = getSnapshotWindows(new Date("2026-03-29T00:30:00.000Z"));

  assertEquals(windows.todayKey, "2026-03-29", "uses the Madrid calendar day");
  assertEquals(windows.weekStartISO, "2026-03-28T23:00:00.000Z", "starts at Madrid midnight before DST");
  assertEquals(windows.weekEndISO, "2026-04-04T21:59:59.999Z", "ends at Madrid midnight after DST");
  assertEquals(windows.gridStartKey, "2026-02-23", "uses a Monday-based six-week grid");
  assertEquals(windows.gridEndKey, "2026-04-05", "keeps exactly 42 Madrid date keys");
});

Deno.test("Madrid snapshot windows remain calendar-safe across autumn DST", () => {
  const windows = getSnapshotWindows(new Date("2026-10-25T01:30:00.000Z"));

  assertEquals(windows.todayKey, "2026-10-25", "uses the Madrid calendar day");
  assertEquals(windows.weekStartISO, "2026-10-24T22:00:00.000Z", "starts at Madrid midnight before the clock change");
  assertEquals(windows.weekEndISO, "2026-10-31T22:59:59.999Z", "ends at Madrid midnight after the clock change");
  assertEquals(windows.gridStartKey, "2026-09-28", "uses a Monday-based six-week grid");
  assertEquals(windows.gridEndKey, "2026-11-08", "keeps exactly 42 Madrid date keys");
});

Deno.test("canonical snapshot maps staffing, docs, overdue alerts and display-safe fields", () => {
  const generatedAt = new Date("2026-09-22T10:00:00.000Z");
  const windows = getSnapshotWindows(generatedAt);
  const overdue = job({
    id: "job-overdue",
    title: "Evento finalizado",
    start_time: "2026-09-19T08:00:00.000Z",
    end_time: "2026-09-20T08:00:00.000Z",
    departments: ["lights"],
    assignments: [
      assignment("tech-overdue", { lights_role: "técnico" }),
      assignment("tech-overdue", { lights_role: "técnico" }),
    ],
  });
  const inputs: SnapshotInputs = {
    generatedAt,
    presetSlug: "produccion",
    visibleJobs: [
      job({}),
      overdue,
      job({ id: "dryhire", title: "Dry hire", job_type: "dryhire" }),
      job({ id: "cancelled", title: "Gira cancelada", tour_id: "tour-cancelled" }),
      job({
        id: "multi-day",
        title: "Evento de varios días",
        start_time: "2026-09-30T10:00:00.000Z",
        end_time: "2026-10-02T10:00:00.000Z",
        departments: ["sound"],
        assignments: [],
      }),
    ],
    overdueJobs: [overdue],
    cancelledTourIds: new Set(["tour-cancelled"]),
    requiredRoles: [
      { job_id: "job-1", department: "sound", total_required: 2 },
      { job_id: "job-1", department: "lights", total_required: 1 },
      { job_id: "multi-day", department: "sound", total_required: 1 },
    ],
    docCounts: [{ job_id: "job-1", department: "sound", have: 1 }],
    docRequirements: [
      { department: "sound", need: 3 },
      { department: "lights", need: 2 },
    ],
    timesheets: [
      { job_id: "job-1", technician_id: "tech-sound", status: "submitted" },
      { job_id: "job-overdue", technician_id: "tech-overdue", status: "draft" },
    ],
    profiles: [
      { id: "tech-sound", first_name: "Ana", last_name: "Luz", email: "private@example.com" },
      { id: "tech-fallback", first_name: "Pau", last_name: "Mar" },
    ] as SnapshotInputs["profiles"],
    logistics: [{
      id: "log-1",
      event_date: "2026-09-22",
      event_time: "09:00:00",
      title: null,
      transport_type: "furgoneta",
      transport_provider: null,
      license_plate: null,
      job_id: null,
      jobTitle: null,
      event_type: "load",
      loading_bay: null,
      color: null,
      notes: null,
      departments: ["sound"],
    }],
    announcements: [{
      id: "announcement-1",
      message: "Reunión a las 12:00",
      level: "info",
      active: true,
      created_at: "2026-09-22T08:00:00.000Z",
    }],
    windows,
  };

  const snapshot = buildWallboardSnapshot(inputs);

  assertEquals(Object.keys(snapshot), [
    "schemaVersion",
    "generatedAt",
    "presetSlug",
    "overview",
    "calendar",
    "crew",
    "pending",
    "logistics",
    "announcements",
  ], "keeps the versioned top-level contract exact");
  assertEquals(snapshot.overview.jobs.map((item) => item.id), ["job-1"], "excludes dry hire and cancelled tours");
  const overview = snapshot.overview.jobs[0];
  assertEquals(overview.departments, ["sound", "lights"], "hides video from operational readiness");
  assertEquals(overview.crewAssigned, { sound: 1, lights: 0, video: 1, total: 2 }, "counts assigned roles");
  assertEquals(overview.crewNeeded, { sound: 2, lights: 1, video: 0, total: 3 }, "uses required-role totals");
  assertEquals(overview.docs, { sound: { have: 1, need: 3 }, lights: { have: 0, need: 2 } }, "uses document views");
  assertEquals(overview.status, "red", "derives readiness from required versus assigned crew");
  assertEquals(snapshot.crew.jobs[0].crew.map((member) => member.role), ["responsable", "asignado"], "localizes fallback roles");
  assertEquals(snapshot.pending.items, [
    { severity: "red", text: "Montaje principal – falta 1 puesto de sonido" },
    { severity: "red", text: "Montaje principal – falta 1 puesto de luces" },
    { severity: "red", text: "Evento finalizado – falta 1 parte de horas" },
  ], "includes localized open-slot and ended-job timesheet alerts");
  assertEquals(snapshot.logistics.items[0].title, "Logística", "localizes the logistics fallback");
  assertEquals(Object.keys(snapshot.calendar.jobsByDate).filter((key) => key >= "2026-09-30"), [
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
  ], "expands multi-day jobs with Madrid date keys");
  const futureCalendarJob = snapshot.calendar.jobs.find((item) => item.id === "multi-day");
  assertEquals(futureCalendarJob?.crewNeeded.sound, 1, "keeps real readiness data outside the seven-day overview");
  assertEquals(futureCalendarJob?.status, "red", "derives calendar readiness instead of zeroing future jobs");
  const serialized = JSON.stringify(snapshot);
  assert(!serialized.includes("private@example.com"), "does not expose non-display profile fields");
  assert(!serialized.includes("technician_id"), "does not expose technician identifiers");
});
