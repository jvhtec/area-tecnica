import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (offset: number) => {
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};

const JOB_ID = "job-focus";
const OTHER_JOB_ID = "job-other";
const DRY_JOB_ID = "job-dry";
const DAYS = [day(1), day(2), day(3)];
// Ana..Dani are free, Eva is off, Fran is on another job the first day.
const TECHS = [
  { id: "t-fran", first: "Fran" },
  { id: "t-eva", first: "Eva" },
  { id: "t-dani", first: "Dani" },
  { id: "t-carla", first: "Carla" },
  { id: "t-beto", first: "Beto" },
  { id: "t-ana", first: "Ana" },
];

interface Body { [key: string]: unknown }
const asBody = (body: unknown): Body => (typeof body === "object" && body !== null ? (body as Body) : {});

/** A matrix with six technicians and one three-day job whose commands are stateful per technician. */
async function openMatrix(page: Page, query = "", options: { evaOff?: boolean } = {}) {
  const assigned = new Map<string, { status: string; role: string; dates: string[] }>();
  const jobs = [
    { id: JOB_ID, title: "Festival Lúa", start_time: `${DAYS[0]}T08:00:00Z`, end_time: `${DAYS[2]}T18:00:00Z`, color: "#2563eb", status: "Confirmado", job_type: "single", job_departments: [{ department: "sound" }], job_assignments: [] },
    { id: OTHER_JOB_ID, title: "Boda Sol", start_time: `${DAYS[0]}T08:00:00Z`, end_time: `${DAYS[0]}T18:00:00Z`, color: "#16a34a", status: "Confirmado", job_type: "single", job_departments: [{ department: "sound" }], job_assignments: [] },
    { id: DRY_JOB_ID, title: "Alquiler Cielo", start_time: `${DAYS[0]}T08:00:00Z`, end_time: `${DAYS[1]}T18:00:00Z`, color: "#9333ea", status: "Confirmado", job_type: "dryhire", job_departments: [{ department: "sound" }], job_assignments: [] },
  ];
  const row = (technicianId: string) => {
    const entry = assigned.get(technicianId);
    return entry
      ? { id: `assignment-${technicianId}`, status: entry.status, sound_role: entry.role, lights_role: null, video_role: null, production_role: null, single_day: entry.dates.length === 1, assignment_date: entry.dates.length === 1 ? entry.dates[0] : null, assignment_source: "direct" }
      : null;
  };
  const pairState = (technicianId: string) => {
    const entry = assigned.get(technicianId);
    return { exists: !!entry, assignment: row(technicianId), dates: entry?.dates ?? [], state_token: `token-${technicianId}-${entry?.dates.length ?? 0}` };
  };
  const result = (id: string, technicianId: string) => ({
    ok: true, outcome: "committed", command_id: id, job_id: JOB_ID, technician_id: technicianId, state_token: pairState(technicianId).state_token,
    replayed: false, assignment: row(technicianId), dates: assigned.get(technicianId)?.dates ?? [], side_effects: [], warnings: [],
  });

  const calls = await bootstrapApp(page, {
    auth: { role: "management", department: "sound" },
    tables: {
      jobs, job_date_types: [],
      job_assignments: () => [
        { job_id: OTHER_JOB_ID, technician_id: "t-fran", status: "confirmed", sound_role: "SND-PA-T", single_day: true, assignment_date: DAYS[0], assigned_at: `${day(0)}T09:00:00Z`, assigned_by: null },
        ...[...assigned].map(([technicianId, entry]) => ({ job_id: JOB_ID, technician_id: technicianId, status: entry.status, sound_role: entry.role, single_day: false, assignment_date: null, assigned_at: `${day(0)}T09:00:00Z`, assigned_by: null })),
      ],
      timesheets: () => [
        { id: "ts-other", job_id: OTHER_JOB_ID, technician_id: "t-fran", date: DAYS[0], is_active: true, source: "direct" },
        ...[...assigned].flatMap(([technicianId, entry]) => entry.dates.map((date) => ({ id: `ts-${technicianId}-${date}`, job_id: JOB_ID, technician_id: technicianId, date, is_active: true, source: "direct" }))),
      ],
      job_required_roles_summary: [{ job_id: JOB_ID, department: "sound", roles: [{ role_code: "SND-FOH-R", quantity: 1 }, { role_code: "SND-MON-E", quantity: 1 }, { role_code: "SND-PA-T", quantity: 4 }] }],
      technician_availability: options.evaOff === false ? [] : DAYS.map((date) => ({ technician_id: "t-eva", date, status: "day_off" })),
      technician_fridge: [], availability_schedules: [], vacation_requests: [], profiles: [], skills: [], staffing_requests: [], staffing_events: [],
    },
    rpc: {
      get_profiles_with_skills: TECHS.map(({ id, first }) => ({ id, first_name: first, last_name: "Test", email: `${id}@example.test`, department: "sound", role: "technician", skills: [] })),
      get_job_staffing_summary: [], get_active_timesheet_counts_by_technician: [], get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [], get_staffing_requests_matrix_filtered: [],
      get_assignment_command_state: ({ body }) => pairState(String(asBody(body).p_technician_id)),
      apply_direct_assignment: ({ body }) => {
        const input = asBody(body);
        const technicianId = String(input.p_technician_id);
        const dates = input.p_coverage === "full" ? DAYS : (input.p_dates as string[]);
        const existing = assigned.get(technicianId);
        assigned.set(technicianId, { status: String(input.p_status), role: String(input.p_role), dates: [...new Set([...(existing?.dates ?? []), ...dates])].sort() });
        return result(String(input.p_command_id), technicianId);
      },
      remove_direct_assignment: ({ body }) => {
        const input = asBody(body);
        const technicianId = String(input.p_technician_id);
        assigned.delete(technicianId);
        return { ...result(String(input.p_command_id), technicianId), removed: { job_id: JOB_ID, deleted_timesheets: 3, deleted_assignment: true, assignment: null } };
      },
      claim_assignment_side_effects: { claim_token: "claim-1", effects: [] },
      record_assignment_side_effects: { ok: true },
      supersede_assignment_side_effects: { superseded: 0, not_superseded: 0, commands: [] },
    },
    functions: { push: { ok: true }, "manage-flex-crew-assignments": { ok: true } },
  });
  await page.goto(`/job-assignment-matrix${query}`);
  return { calls, assigned };
}

const applyCalls = (calls: Awaited<ReturnType<typeof openMatrix>>["calls"]) =>
  calls.rpcCalls.filter((call) => call.name === "apply_direct_assignment").map((call) => asBody(call.body));
const bar = (page: Page) => page.getByTestId("job-focus-bar");
const nameCell = (page: Page, first: string) => page.locator(".matrix-technician-column").getByText(first, { exact: false }).first();
const cell = (page: Page, technicianId: string, offset: number) => page.locator(`[data-technician-id="${technicianId}"][data-date-key="${day(offset)}"]`);
const columnOrder = async (page: Page) => (await page.locator(".matrix-technician-column [data-focus-fit]").evaluateAll(
  (nodes) => nodes.map((node) => node.closest(".group\\/tech")?.textContent ?? ""),
)).map((text) => TECHS.find((tech) => text.includes(tech.first))?.first);

test("opening the job from the toolbar focuses it: bar, dimmed days, fit and a fixed order", async ({ page }) => {
  test.skip(isMobileViewport(page), "The toolbar entry lives in the desktop toolbar; the phone enters with ?trabajo=.");
  await openMatrix(page);
  await page.getByRole("button", { name: "Enfocar trabajo" }).click();
  // Dry-hire jobs take no crew, so they are not on offer.
  await expect(page.getByRole("option", { name: /Alquiler Cielo/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Festival Lúa/ }).click();

  await expect(bar(page)).toContainText("Festival Lúa");
  await expect(bar(page).getByRole("radio", { name: "Invitado" })).toBeChecked();
  await expect(bar(page).getByRole("listitem", { name: /Monitores — Especialista: 0 de 1 cubiertos/ })).toBeVisible();
  await expect(page.locator("[data-focus-dim]").first()).toBeAttached();
  await expect(page.locator("[data-focus-job-days]")).toHaveCount(1);
  await expect(page).toHaveURL(/trabajo=job-focus/);

  await expect(nameCell(page, "Ana").locator("xpath=ancestor::div[contains(@class,'group/tech')]").locator("[data-focus-fit='free']")).toHaveText("Libre 3/3");
  await expect(page.locator("[data-focus-fit='partial-free']")).toHaveText("Libre 2/3");
  await expect(page.locator("[data-focus-fit='unavailable']")).toHaveText("No disp.");
  // Best fit first: the four free technicians, then Fran (one day taken), then Eva (off).
  expect((await columnOrder(page)).slice(-2)).toEqual(["Fran", "Eva"]);
});

test("a six-person, three-day job is staffed in eight clicks", async ({ page }) => {
  test.skip(isMobileViewport(page), "Counts the desktop entry (toolbar picker + job).");
  const { calls } = await openMatrix(page, "", { evaOff: false });
  let clicks = 0;
  const click = async (action: () => Promise<void>) => { clicks += 1; await action(); };

  await click(() => page.getByRole("button", { name: "Enfocar trabajo" }).click());
  await click(() => page.getByRole("option", { name: /Festival Lúa/ }).click());
  await expect(bar(page)).toBeVisible();

  // One click per person: their name assigns every free day of the job.
  for (const { first } of TECHS) await click(() => nameCell(page, first).click());
  await expect.poll(() => applyCalls(calls).length).toBe(6);

  expect(clicks).toBe(8);
  expect(new Set(applyCalls(calls).map((call) => call.p_technician_id)).size).toBe(6);
  for (const call of applyCalls(calls)) {
    expect(call).toMatchObject({ p_job_id: JOB_ID, p_status: "invited", p_source: "matrix-focus", p_mode: "add" });
  }
  // Fran is on another job the first day, so only her two free days are added.
  expect(applyCalls(calls).find((call) => call.p_technician_id === "t-fran")).toMatchObject({ p_coverage: "multi", p_dates: [DAYS[1], DAYS[2]] });
  expect(applyCalls(calls).filter((call) => call.p_coverage === "full")).toHaveLength(5);
  // The slots fill as people land: the required levels first, then the rest.
  const roles = applyCalls(calls).map((call) => String(call.p_role));
  expect(roles.filter((role) => role === "SND-FOH-R")).toHaveLength(1);
  expect(roles.filter((role) => role === "SND-MON-E")).toHaveLength(1);
  expect(roles.filter((role) => role === "SND-PA-T")).toHaveLength(4);
  // Nobody was notified before the undo window closed.
  expect(calls.functionCalls.map((call) => call.name)).not.toContain("push");
});

test("a click on a free day assigns just that day; the rows stay where they were", async ({ page }) => {
  const { calls } = await openMatrix(page, `?trabajo=${JOB_ID}`);
  await expect(bar(page)).toBeVisible();
  await expect(cell(page, "t-ana", 2)).toBeVisible();
  const before = await columnOrder(page);

  await cell(page, "t-ana", 2).click();
  await expect.poll(() => applyCalls(calls).length).toBe(1);
  expect(applyCalls(calls)[0]).toMatchObject({ p_technician_id: "t-ana", p_coverage: "single", p_dates: [DAYS[1]], p_source: "matrix-focus", p_status: "invited" });
  await expect(cell(page, "t-ana", 2)).toContainText("Festival Lúa");
  await expect(page.locator("[data-focus-fit='partial']")).toHaveText("Asignado 1/3");
  expect(await columnOrder(page)).toEqual(before);
});

test("Confirmado in the bar confirms what is assigned next", async ({ page }) => {
  const { calls } = await openMatrix(page, `?trabajo=${JOB_ID}`);
  await bar(page).getByRole("radio", { name: "Confirmado" }).click();
  await nameCell(page, "Beto").click();
  await expect.poll(() => applyCalls(calls).length).toBe(1);
  expect(applyCalls(calls)[0]).toMatchObject({ p_technician_id: "t-beto", p_status: "confirmed", p_coverage: "full" });
});

test("a day outside the job, or one already taken, still opens the inspector", async ({ page }) => {
  const { calls } = await openMatrix(page, `?trabajo=${JOB_ID}`);
  await cell(page, "t-ana", 0).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Ana" })).toBeVisible();
  expect(applyCalls(calls)).toHaveLength(0);
});

test("Esc and Salir leave the focus", async ({ page }) => {
  await openMatrix(page, `?trabajo=${JOB_ID}`);
  await expect(bar(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bar(page)).toBeHidden();
  await expect(page).not.toHaveURL(/trabajo=/);
  await expect(page.locator("[data-focus-dim]")).toHaveCount(0);
  await expect(page.locator("[data-focus-fit]")).toHaveCount(0);

  await page.goto(`/job-assignment-matrix?trabajo=${JOB_ID}`);
  await bar(page).getByRole("button", { name: "Salir" }).click();
  await expect(bar(page)).toBeHidden();
});

test("a dry-hire job cannot be focused, not even from the URL", async ({ page }) => {
  await openMatrix(page, `?trabajo=${DRY_JOB_ID}`);
  await expect(cell(page, "t-ana", 1)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator("[data-focus-dim]")).toHaveCount(0);
});
