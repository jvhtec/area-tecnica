import { expect, test } from "@playwright/test";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { bootstrapApp } from "./support/app";

test.use({ timezoneId: "Europe/Madrid" });

type AssignmentRow = {
  job_id: string;
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  single_day: boolean;
  assignment_date: string | null;
  status: string;
  assigned_at?: string | null;
  assigned_by?: string | null;
  assignment_source?: string | null;
};

type TimesheetRow = {
  id: string;
  job_id: string;
  technician_id: string;
  date: string;
  is_active: boolean;
  status: string;
  category?: string | null;
};

const noConflictResult = {
  hasHardConflict: false,
  hasSoftConflict: false,
  hardConflicts: [],
  softConflicts: [],
  unavailabilityConflicts: [],
};

const MADRID_TZ = "Europe/Madrid";

function madridDateKey(offsetDays = 0) {
  return formatInTimeZone(addDays(new Date(), offsetDays), MADRID_TZ, "yyyy-MM-dd");
}

function asArray<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function decodeFilterValue(raw: string | null) {
  if (!raw) return null;
  return decodeURIComponent(raw);
}

function getEqParam(url: URL, key: string) {
  const raw = decodeFilterValue(url.searchParams.get(key));
  return raw?.startsWith("eq.") ? raw.slice(3) : null;
}

function getInParam(url: URL, key: string) {
  const raw = decodeFilterValue(url.searchParams.get(key));
  if (!raw?.startsWith("in.(") || !raw.endsWith(")")) return null;
  return raw
    .slice(4, -1)
    .split(",")
    .map((entry) => entry.replace(/^"|"$/g, ""));
}

function filterAssignments(rows: AssignmentRow[], url: URL) {
  const jobIdEq = getEqParam(url, "job_id");
  const technicianEq = getEqParam(url, "technician_id");
  const jobIdIn = getInParam(url, "job_id");
  const technicianIn = getInParam(url, "technician_id");

  return rows.filter((row) => {
    if (jobIdEq && row.job_id !== jobIdEq) return false;
    if (technicianEq && row.technician_id !== technicianEq) return false;
    if (jobIdIn && !jobIdIn.includes(row.job_id)) return false;
    if (technicianIn && !technicianIn.includes(row.technician_id)) return false;
    return true;
  });
}

function filterTimesheets(rows: TimesheetRow[], url: URL) {
  const jobIdEq = getEqParam(url, "job_id");
  const technicianEq = getEqParam(url, "technician_id");
  const isActiveEq = getEqParam(url, "is_active");

  return rows.filter((row) => {
    if (jobIdEq && row.job_id !== jobIdEq) return false;
    if (technicianEq && row.technician_id !== technicianEq) return false;
    if (isActiveEq && String(row.is_active) !== isActiveEq) return false;
    return true;
  });
}

test.describe("assignment matrix direct assignment lifecycle", () => {
  test("creates a direct assignment from an empty matrix cell and refreshes the matrix", async ({ page }) => {
    const targetDate = madridDateKey(1);
    const jobs = [
      {
        id: "job-create-1",
        title: "Create Flow Job",
        start_time: `${targetDate}T09:00:00.000Z`,
        end_time: `${targetDate}T18:00:00.000Z`,
        color: "#1d4ed8",
        status: "Confirmado",
        job_type: "single",
        job_departments: [{ department: "sound" }],
      },
    ];
    const assignments: AssignmentRow[] = [];
    const timesheets: TimesheetRow[] = [];

    const calls = await bootstrapApp(page, {
      auth: {
        role: "management",
        department: "sound",
      },
      tables: {
        jobs: () =>
          jobs.map((job) => ({
            ...job,
            job_assignments: assignments
              .filter((assignment) => assignment.job_id === job.id)
              .map((assignment) => ({ technician_id: assignment.technician_id })),
          })),
        profiles: ({ url }) => {
          const id = getEqParam(url, "id");
          const rows = [
            {
              id: "tech-1",
              first_name: "Pat",
              last_name: "Jones",
              email: "pat@example.com",
              department: "sound",
              role: "technician",
              assignable_as_tech: false,
              soundvision_access_enabled: false,
            },
          ];
          return id ? rows.filter((row) => row.id === id) : rows;
        },
        technician_fridge: [],
        availability_schedules: [],
        technician_availability: [],
        vacation_requests: [],
        job_required_roles_summary: [],
        job_assignments: ({ method, body, url }) => {
          if (method === "GET") {
            return filterAssignments(assignments, url).map((row) => ({
              ...row,
              jobs: jobs.find((job) => job.id === row.job_id) ?? null,
            }));
          }

          if (method === "POST") {
            const row = asArray(body)[0] as AssignmentRow;
            assignments.push({
              ...row,
              sound_role: row.sound_role ?? null,
              lights_role: row.lights_role ?? null,
              video_role: row.video_role ?? null,
              single_day: Boolean(row.single_day),
              assignment_date: row.assignment_date ?? null,
              status: row.status ?? "invited",
            });
            return null;
          }

          return null;
        },
        timesheets: ({ method, body, url }) => {
          if (method === "GET") {
            return filterTimesheets(timesheets, url);
          }

          if (method === "POST") {
            const rows = asArray(body) as Partial<TimesheetRow>[];
            rows.forEach((row) => {
              const date = String(row.date);
              const existing = timesheets.find((timesheet) =>
                timesheet.job_id === row.job_id &&
                timesheet.technician_id === row.technician_id &&
                timesheet.date === date,
              );

              if (existing) {
                Object.assign(existing, row, { is_active: true });
                return;
              }

              timesheets.push({
                id: `timesheet-${timesheets.length + 1}`,
                job_id: String(row.job_id),
                technician_id: String(row.technician_id),
                date,
                is_active: row.is_active ?? true,
                status: String(row.status ?? "draft"),
                category: row.category ?? null,
              });
            });
            return null;
          }

          if (method === "DELETE") {
            const matchingRows = filterTimesheets(timesheets, url);
            const matchingIds = new Set(matchingRows.map((row) => row.id));
            for (let index = timesheets.length - 1; index >= 0; index -= 1) {
              if (matchingIds.has(timesheets[index]!.id)) {
                timesheets.splice(index, 1);
              }
            }
            return matchingRows.map((row) => ({ id: row.id }));
          }

          if (method === "PATCH") {
            const updates = (body ?? {}) as Partial<TimesheetRow>;
            const matchingRows = filterTimesheets(timesheets, url);
            matchingRows.forEach((row) => {
              Object.assign(row, updates);
            });
            return matchingRows.map((row) => ({ id: row.id }));
          }

          return null;
        },
      },
      rpc: {
        get_profiles_with_skills: [
          {
            id: "tech-1",
            first_name: "Pat",
            last_name: "Jones",
            email: "pat@example.com",
            department: "sound",
            role: "technician",
            skills: [],
          },
        ],
        get_job_staffing_summary: [],
        get_assignment_matrix_staffing: [],
        check_technician_conflicts: noConflictResult,
        toggle_timesheet_day: ({ body }) => {
          const payload = body as Record<string, string | boolean>;
          const date = String(payload.p_date);
          const present = Boolean(payload.p_present);
          if (present) {
            const exists = timesheets.some((row) =>
              row.job_id === payload.p_job_id &&
              row.technician_id === payload.p_technician_id &&
              row.date === date,
            );
            if (!exists) {
              timesheets.push({
                id: `timesheet-${timesheets.length + 1}`,
                job_id: String(payload.p_job_id),
                technician_id: String(payload.p_technician_id),
                date,
                is_active: true,
                status: "draft",
                category: null,
              });
            }
          } else {
            timesheets.forEach((row) => {
              if (
                row.job_id === payload.p_job_id &&
                row.technician_id === payload.p_technician_id &&
                row.date === date
              ) {
                row.is_active = false;
              }
            });
          }
          return {};
        },
        compute_timesheet_amount_2025: {},
      },
      functions: {
        "manage-flex-crew-assignments": {},
        push: {},
      },
    });

    await page.goto("/job-assignment-matrix");

    await expect(page.getByRole("heading", { name: /matriz de asignación de trabajos/i })).toBeVisible();
    const directAssignSwitch = page.getByRole("switch", { name: /alternar asignación directa/i }).first();
    await directAssignSwitch.click();

    const targetCell = page.getByTestId(`matrix-cell-tech-1-${targetDate}`);
    await targetCell.click();

    await expect(page.getByRole("dialog")).toContainText("Seleccionar Trabajo");
    await page.getByText("Create Flow Job").click();
    await page.getByRole("button", { name: /continuar/i }).click();

    await expect(page.getByRole("dialog")).toContainText("Asignar Trabajo");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "FOH — Responsable" }).click();
    await page.getByRole("button", { name: /asignar trabajo/i }).click();

    await expect.poll(() => assignments.length).toBe(1);
    await expect.poll(() => timesheets.length).toBe(1);
    await expect(targetCell).toContainText("Create Flow Job");
    await expect(assignments[0]).toMatchObject({
      job_id: "job-create-1",
      technician_id: "tech-1",
      sound_role: "SND-FOH-R",
      single_day: false,
      assignment_date: null,
      status: "invited",
    });
    await expect
      .poll(() => calls.functionCalls.map((call) => call.name))
      .toEqual(expect.arrayContaining(["manage-flex-crew-assignments", "push"]));
  });

  test("reassigns an existing assignment to another job and keeps the updated matrix state", async ({ page }) => {
    const targetDate = madridDateKey(1);
    const jobs = [
      {
        id: "job-old",
        title: "Old Job",
        start_time: `${targetDate}T09:00:00.000Z`,
        end_time: `${targetDate}T18:00:00.000Z`,
        color: "#0f766e",
        status: "Confirmado",
        job_type: "single",
        job_departments: [{ department: "sound" }],
      },
      {
        id: "job-new",
        title: "New Job",
        start_time: `${targetDate}T10:00:00.000Z`,
        end_time: `${targetDate}T19:00:00.000Z`,
        color: "#9333ea",
        status: "Confirmado",
        job_type: "single",
        job_departments: [{ department: "sound" }],
      },
    ];
    const assignments: AssignmentRow[] = [
      {
        job_id: "job-old",
        technician_id: "tech-1",
        sound_role: "SND-FOH-R",
        lights_role: null,
        video_role: null,
        single_day: true,
        assignment_date: targetDate,
        status: "invited",
        assigned_at: new Date().toISOString(),
        assigned_by: "manager-1",
        assignment_source: "direct",
      },
    ];
    const timesheets: TimesheetRow[] = [
      {
        id: "timesheet-1",
        job_id: "job-old",
        technician_id: "tech-1",
        date: targetDate,
        is_active: true,
        status: "draft",
        category: "audio",
      },
    ];

    const calls = await bootstrapApp(page, {
      auth: {
        role: "management",
        department: "sound",
      },
      tables: {
        jobs: () =>
          jobs.map((job) => ({
            ...job,
            job_assignments: assignments
              .filter((assignment) => assignment.job_id === job.id)
              .map((assignment) => ({ technician_id: assignment.technician_id })),
          })),
        profiles: [
          {
            id: "tech-1",
            first_name: "Pat",
            last_name: "Jones",
            email: "pat@example.com",
            department: "sound",
            role: "technician",
          },
        ],
        technician_fridge: [],
        availability_schedules: [],
        technician_availability: [],
        vacation_requests: [],
        job_required_roles_summary: [],
        job_assignments: ({ method, body, url }) => {
          if (method === "GET") {
            return filterAssignments(assignments, url).map((row) => ({
              ...row,
              jobs: jobs.find((job) => job.id === row.job_id) ?? null,
            }));
          }

          if (method === "POST") {
            const row = asArray(body)[0] as AssignmentRow;
            assignments.push({
              ...row,
              sound_role: row.sound_role ?? null,
              lights_role: row.lights_role ?? null,
              video_role: row.video_role ?? null,
              single_day: Boolean(row.single_day),
              assignment_date: row.assignment_date ?? null,
              status: row.status ?? "invited",
            });
            return null;
          }

          return null;
        },
        timesheets: ({ method, body, url }) => {
          if (method === "GET") {
            return filterTimesheets(timesheets, url);
          }

          if (method === "POST") {
            const rows = asArray(body) as Partial<TimesheetRow>[];
            rows.forEach((row) => {
              const date = String(row.date);
              const existing = timesheets.find((timesheet) =>
                timesheet.job_id === row.job_id &&
                timesheet.technician_id === row.technician_id &&
                timesheet.date === date,
              );

              if (existing) {
                Object.assign(existing, row, { is_active: true });
                return;
              }

              timesheets.push({
                id: `timesheet-${timesheets.length + 1}`,
                job_id: String(row.job_id),
                technician_id: String(row.technician_id),
                date,
                is_active: row.is_active ?? true,
                status: String(row.status ?? "draft"),
                category: row.category ?? null,
              });
            });
            return null;
          }

          if (method === "DELETE") {
            const matchingRows = filterTimesheets(timesheets, url);
            const matchingIds = new Set(matchingRows.map((row) => row.id));
            for (let index = timesheets.length - 1; index >= 0; index -= 1) {
              if (matchingIds.has(timesheets[index]!.id)) {
                timesheets.splice(index, 1);
              }
            }
            return matchingRows.map((row) => ({ id: row.id }));
          }

          if (method === "PATCH") {
            const updates = (body ?? {}) as Partial<TimesheetRow>;
            const matchingRows = filterTimesheets(timesheets, url);
            matchingRows.forEach((row) => {
              Object.assign(row, updates);
            });
            return matchingRows.map((row) => ({ id: row.id }));
          }

          return null;
        },
      },
      rpc: {
        get_profiles_with_skills: [
          {
            id: "tech-1",
            first_name: "Pat",
            last_name: "Jones",
            email: "pat@example.com",
            department: "sound",
            role: "technician",
            skills: [],
          },
        ],
        get_job_staffing_summary: [],
        get_assignment_matrix_staffing: [],
        check_technician_conflicts: noConflictResult,
        toggle_timesheet_day: ({ body }) => {
          const payload = body as Record<string, string | boolean>;
          const date = String(payload.p_date);
          const present = Boolean(payload.p_present);
          if (present) {
            const existing = timesheets.find((row) =>
              row.job_id === payload.p_job_id &&
              row.technician_id === payload.p_technician_id &&
              row.date === date,
            );
            if (existing) {
              existing.is_active = true;
            } else {
              timesheets.push({
                id: `timesheet-${timesheets.length + 1}`,
                job_id: String(payload.p_job_id),
                technician_id: String(payload.p_technician_id),
                date,
                is_active: true,
                status: "draft",
                category: null,
              });
            }
          }
          return {};
        },
        remove_assignment_with_timesheets: ({ body }) => {
          const payload = body as Record<string, string>;
          const jobId = String(payload.p_job_id);
          const technicianId = String(payload.p_technician_id);
          for (let index = assignments.length - 1; index >= 0; index -= 1) {
            if (assignments[index]?.job_id === jobId && assignments[index]?.technician_id === technicianId) {
              assignments.splice(index, 1);
            }
          }
          let deletedTimesheets = 0;
          for (let index = timesheets.length - 1; index >= 0; index -= 1) {
            if (timesheets[index]?.job_id === jobId && timesheets[index]?.technician_id === technicianId) {
              timesheets.splice(index, 1);
              deletedTimesheets += 1;
            }
          }
          return [{ deleted_assignment: true, deleted_timesheets: deletedTimesheets }];
        },
        compute_timesheet_amount_2025: {},
      },
      functions: {
        "manage-flex-crew-assignments": {},
        push: {},
      },
    });

    await page.goto("/job-assignment-matrix");

    const directAssignSwitch = page.getByRole("switch", { name: /alternar asignación directa/i }).first();
    await directAssignSwitch.click();

    const targetCell = page.getByTestId(`matrix-cell-tech-1-${targetDate}`);
    await expect(targetCell).toContainText("Old Job");
    await targetCell.click();

    await expect(page.getByRole("dialog")).toContainText("Reasignar Trabajo");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /new job/i }).click();
    await page.getByRole("button", { name: /reasignar trabajo/i }).click();

    await expect.poll(() => assignments.map((assignment) => assignment.job_id)).toEqual(["job-new"]);
    await expect.poll(() => timesheets.map((row) => row.job_id)).toEqual(["job-new"]);
    await expect(targetCell).toContainText("New Job");
    await expect(targetCell).not.toContainText("Old Job");
    await expect
      .poll(() => calls.rpcCalls.map((call) => call.name))
      .toEqual(expect.arrayContaining(["remove_assignment_with_timesheets", "check_technician_conflicts"]));
  });

  test("removes an assignment from the reassignment dialog", async ({ page }) => {
    const targetDate = madridDateKey(1);
    const jobs = [
      {
        id: "job-remove-1",
        title: "Remove Flow Job",
        start_time: `${targetDate}T09:00:00.000Z`,
        end_time: `${targetDate}T18:00:00.000Z`,
        color: "#dc2626",
        status: "Confirmado",
        job_type: "single",
        job_departments: [{ department: "sound" }],
      },
    ];
    const assignments: AssignmentRow[] = [
      {
        job_id: "job-remove-1",
        technician_id: "tech-1",
        sound_role: "SND-FOH-R",
        lights_role: null,
        video_role: null,
        single_day: false,
        assignment_date: null,
        status: "invited",
      },
    ];
    const timesheets: TimesheetRow[] = [
      {
        id: "timesheet-1",
        job_id: "job-remove-1",
        technician_id: "tech-1",
        date: targetDate,
        is_active: true,
        status: "draft",
      },
    ];

    await bootstrapApp(page, {
      auth: {
        role: "management",
        department: "sound",
      },
      tables: {
        jobs: () =>
          jobs.map((job) => ({
            ...job,
            job_assignments: assignments
              .filter((assignment) => assignment.job_id === job.id)
              .map((assignment) => ({ technician_id: assignment.technician_id })),
          })),
        profiles: [
          {
            id: "tech-1",
            first_name: "Pat",
            last_name: "Jones",
            email: "pat@example.com",
            department: "sound",
            role: "technician",
          },
        ],
        technician_fridge: [],
        availability_schedules: [],
        technician_availability: [],
        vacation_requests: [],
        job_required_roles_summary: [],
        job_assignments: ({ method, url }) => {
          if (method === "GET") {
            return filterAssignments(assignments, url).map((row) => ({
              ...row,
              jobs: jobs.find((job) => job.id === row.job_id) ?? null,
            }));
          }

          return null;
        },
        timesheets: ({ method, url }) => {
          if (method === "GET") {
            return filterTimesheets(timesheets, url);
          }

          return null;
        },
      },
      rpc: {
        get_profiles_with_skills: [
          {
            id: "tech-1",
            first_name: "Pat",
            last_name: "Jones",
            email: "pat@example.com",
            department: "sound",
            role: "technician",
            skills: [],
          },
        ],
        get_job_staffing_summary: [],
        get_assignment_matrix_staffing: [],
        remove_assignment_with_timesheets: ({ body }) => {
          const payload = body as Record<string, string>;
          const jobId = String(payload.p_job_id);
          const technicianId = String(payload.p_technician_id);
          for (let index = assignments.length - 1; index >= 0; index -= 1) {
            if (assignments[index]?.job_id === jobId && assignments[index]?.technician_id === technicianId) {
              assignments.splice(index, 1);
            }
          }
          for (let index = timesheets.length - 1; index >= 0; index -= 1) {
            if (timesheets[index]?.job_id === jobId && timesheets[index]?.technician_id === technicianId) {
              timesheets.splice(index, 1);
            }
          }
          return [{ deleted_assignment: true, deleted_timesheets: 1 }];
        },
      },
      functions: {
        "manage-flex-crew-assignments": {},
      },
    });

    await page.goto("/job-assignment-matrix");

    const directAssignSwitch = page.getByRole("switch", { name: /alternar asignación directa/i }).first();
    await directAssignSwitch.click();

    const targetCell = page.getByTestId(`matrix-cell-tech-1-${targetDate}`);
    await expect(targetCell).toContainText("Remove Flow Job");
    await targetCell.click();

    await expect(page.getByRole("dialog")).toContainText("Reasignar Trabajo");
    await page.getByRole("button", { name: /eliminar asignación/i }).click();

    await expect(targetCell).not.toContainText("Remove Flow Job");
    await expect.poll(() => assignments.length).toBe(0);
    await expect.poll(() => timesheets.length).toBe(0);
  });
});
