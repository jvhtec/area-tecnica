import { expect, test, type Locator, type Page } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (offset: number) => {
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};

const JOB_ID = "job-batch";
const D1 = day(1);
const D2 = day(2);
const TECHS = [
  { id: "t-ana", first: "Ana" },
  { id: "t-beto", first: "Beto" },
  { id: "t-carla", first: "Carla" },
  { id: "t-dani", first: "Dani" },
];

interface Body { [key: string]: unknown }
const asBody = (body: unknown): Body => (typeof body === "object" && body !== null ? (body as Body) : {});
type Rejection = "conflict" | "stale_state";

interface Options {
  /** Technicians already on the job, with their days and status. */
  initial?: Record<string, { status: "invited" | "confirmed"; dates: string[] }>;
  /** Rejections served, in order, to a technician's next apply_direct_assignment. */
  rejections?: Record<string, Rejection[]>;
}

/** Four technicians and one two-day job whose assignment commands are stateful per technician. */
async function openMatrix(page: Page, options: Options = {}) {
  const assigned = new Map(Object.entries(options.initial ?? {}).map(([id, value]) => [id, { status: value.status as string, role: "SND-PA-T", dates: [...value.dates] }]));
  const rejections = new Map(Object.entries(options.rejections ?? {}).map(([id, list]) => [id, [...list]]));
  const job = { id: JOB_ID, title: "Gira Lúa", start_time: `${D1}T08:00:00Z`, end_time: `${D2}T18:00:00Z`, color: "#2563eb", status: "Confirmado", job_type: "single", job_departments: [{ department: "sound" }], job_assignments: [] };

  const row = (technicianId: string) => {
    const entry = assigned.get(technicianId);
    return entry
      ? { id: `assignment-${technicianId}`, status: entry.status, sound_role: entry.role, lights_role: null, video_role: null, production_role: null, single_day: false, assignment_date: null, assignment_source: "direct" }
      : null;
  };
  const token = (technicianId: string) => `token-${technicianId}-${assigned.get(technicianId)?.dates.join("+") ?? "none"}-${assigned.get(technicianId)?.status ?? ""}`;
  const pairState = (technicianId: string) => ({ exists: assigned.has(technicianId), assignment: row(technicianId), dates: assigned.get(technicianId)?.dates ?? [], state_token: token(technicianId) });
  const result = (id: string, technicianId: string, extra: Body = {}) => ({
    ok: true, outcome: "committed", command_id: id, job_id: JOB_ID, technician_id: technicianId, state_token: token(technicianId),
    replayed: false, assignment: row(technicianId), dates: assigned.get(technicianId)?.dates ?? [], side_effects: [], warnings: [], ...extra,
  });
  const rejection = (id: string, technicianId: string, code: Rejection) => ({
    ok: false, outcome: "rejected", code, message: code === "conflict" ? "Ya tiene otro trabajo esos días" : "Cambió mientras tanto", command_id: id, job_id: JOB_ID, technician_id: technicianId,
    state_token: token(technicianId), assignment: row(technicianId), dates: assigned.get(technicianId)?.dates ?? [],
    details: code === "conflict"
      ? { target_date: D1, conflict_dates: [D1], conflicts: { hasHardConflict: true, hasSoftConflict: false, hardConflicts: [{ id: "other", title: "Boda Sol", start_time: `${D1}T08:00:00Z`, end_time: `${D1}T18:00:00Z`, status: "Confirmado" }], softConflicts: [], unavailabilityConflicts: [] } }
      : {},
  });
  const input = (body: unknown) => asBody(body);

  const calls = await bootstrapApp(page, {
    auth: { role: "management", department: "sound" },
    tables: {
      jobs: [job], job_date_types: [],
      job_assignments: () => [...assigned].map(([technicianId, entry]) => ({ job_id: JOB_ID, technician_id: technicianId, status: entry.status, sound_role: entry.role, single_day: false, assignment_date: null, assigned_at: `${day(0)}T09:00:00Z`, assigned_by: null })),
      timesheets: () => [...assigned].flatMap(([technicianId, entry]) => entry.dates.map((date) => ({ id: `ts-${technicianId}-${date}`, job_id: JOB_ID, technician_id: technicianId, date, is_active: true, source: "direct" }))),
      job_required_roles_summary: [{ job_id: JOB_ID, department: "sound", roles: [{ role_code: "SND-PA-T", quantity: 6 }] }],
      technician_availability: [], technician_fridge: [], availability_schedules: [], vacation_requests: [], profiles: [], skills: [], staffing_requests: [], staffing_events: [],
    },
    rpc: {
      get_profiles_with_skills: TECHS.map(({ id, first }) => ({ id, first_name: first, last_name: "Test", email: `${id}@example.test`, department: "sound", role: "technician", skills: [] })),
      get_job_staffing_summary: [], get_active_timesheet_counts_by_technician: [], get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [], get_staffing_requests_matrix_filtered: [],
      get_assignment_command_state: ({ body }) => pairState(String(input(body).p_technician_id)),
      apply_direct_assignment: ({ body }) => {
        const args = input(body);
        const technicianId = String(args.p_technician_id);
        const next = rejections.get(technicianId)?.shift();
        if (next) return rejection(String(args.p_command_id), technicianId, next);
        const dates = args.p_coverage === "full" ? [D1, D2] : (args.p_dates as string[]);
        const existing = assigned.get(technicianId);
        assigned.set(technicianId, { status: String(args.p_status), role: String(args.p_role), dates: [...new Set([...(existing?.dates ?? []), ...dates])].sort() });
        return result(String(args.p_command_id), technicianId);
      },
      remove_direct_assignment: ({ body }) => {
        const args = input(body);
        const technicianId = String(args.p_technician_id);
        assigned.delete(technicianId);
        return result(String(args.p_command_id), technicianId, { removed: { job_id: JOB_ID, deleted_timesheets: 2, deleted_assignment: true, assignment: null } });
      },
      remove_assignment_date: ({ body }) => {
        const args = input(body);
        const technicianId = String(args.p_technician_id);
        const entry = assigned.get(technicianId);
        if (entry) entry.dates = entry.dates.filter((date) => date !== args.p_date);
        return result(String(args.p_command_id), technicianId);
      },
      set_assignment_status: ({ body }) => {
        const args = input(body);
        const technicianId = String(args.p_technician_id);
        const entry = assigned.get(technicianId);
        if (entry) entry.status = "confirmed";
        return result(String(args.p_command_id), technicianId);
      },
      unconfirm_assignment: ({ body }) => {
        const args = input(body);
        const technicianId = String(args.p_technician_id);
        const entry = assigned.get(technicianId);
        if (entry) entry.status = "invited";
        return result(String(args.p_command_id), technicianId);
      },
      claim_assignment_side_effects: { claim_token: "claim-1", effects: [] },
      record_assignment_side_effects: { ok: true },
      supersede_assignment_side_effects: { superseded: 0, not_superseded: 0, commands: [] },
    },
    functions: { push: { ok: true }, "manage-flex-crew-assignments": { ok: true } },
  });
  await page.goto("/job-assignment-matrix");
  return { calls, assigned };
}

type Calls = Awaited<ReturnType<typeof openMatrix>>["calls"];
const rpcBodies = (calls: Calls, name: string) => calls.rpcCalls.filter((call) => call.name === name).map((call) => asBody(call.body));
const cell = (page: Page, technicianId: string, date: string) => page.locator(`[data-technician-id="${technicianId}"][data-date-key="${date}"]`);
const bar = (page: Page) => page.getByTestId("batch-bar");
const results = (page: Page) => page.getByTestId("batch-results");
const toastWith = (page: Page, text: string) =>
  page.getByRole("region", { name: /Notifications/ }).getByRole("status").filter({ hasText: text });

const center = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("cell has no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Brings the first day of the job next to the technician column, so a short drag stays on screen. */
async function showJobDays(page: Page) {
  await cell(page, "t-ana", D1).scrollIntoViewIfNeeded();
  await page.locator(".matrix-main-scroll").evaluate((element, date) => {
    const target = element.querySelector(`[data-technician-id="t-ana"][data-date-key="${date}"]`);
    if (target) element.scrollLeft += target.getBoundingClientRect().left - element.getBoundingClientRect().left - 300;
  }, D1);
}

/** Drags a rectangle from one cell to another, as a manager does with the mouse. */
async function drag(page: Page, from: Locator, to: Locator) {
  await showJobDays(page);
  const start = await center(from);
  const end = await center(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 6 });
  return { release: () => page.mouse.up() };
}

/** Ctrl-click each cell: the selection gesture that works on every viewport. */
async function pick(page: Page, cells: Array<[string, string]>) {
  for (const [technicianId, date] of cells) await cell(page, technicianId, date).click({ modifiers: ["Control"] });
}

const block = (ids: string[], dates: string[]): Array<[string, string]> => ids.flatMap((id) => dates.map((date): [string, string] => [id, date]));

test("dragging a block selects it as one rectangle and the bar counts it", async ({ page }) => {
  test.skip(isMobileViewport(page), "Dragging is for pointer devices; phones select with a long press.");
  await openMatrix(page);
  const held = await drag(page, cell(page, "t-ana", D1), cell(page, "t-carla", D2));
  // While dragging, the selection is a single overlay: no cell has re-rendered.
  await expect(page.locator("[data-selection-preview]")).toHaveCount(1);
  await held.release();
  await expect(page.locator("[data-selection-preview]")).toHaveCount(0);
  await expect(bar(page)).toContainText("6 celdas · 3 personas");
  // A drag is not a click: no inspector opened under it.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(bar(page)).toBeHidden();
});

test("a drag held at the edge scrolls the grid and keeps selecting", async ({ page }) => {
  test.skip(isMobileViewport(page), "Dragging is for pointer devices; phones select with a long press.");
  await openMatrix(page);
  await showJobDays(page);
  const scroller = page.locator(".matrix-main-scroll");
  const before = await scroller.evaluate((element) => element.scrollLeft);
  const start = await center(cell(page, "t-ana", D1));
  const box = await scroller.boundingBox();
  if (!box) throw new Error("no scroller");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y, { steps: 3 });
  // Held inside the right-hand edge zone: the grid scrolls on its own.
  await page.mouse.move(box.x + box.width - 20, start.y, { steps: 8 });
  await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before + 150);
  await page.mouse.up();
  const text = (await bar(page).textContent()) ?? "";
  const cells = Number(/(\d+) celdas/.exec(text)?.[1] ?? 0);
  expect(cells).toBeGreaterThan(3);
});

test("shift-click extends the selection from the last cell", async ({ page }) => {
  test.skip(isMobileViewport(page), "Shift-click is a pointer gesture.");
  await openMatrix(page);
  await showJobDays(page);
  await cell(page, "t-ana", D1).click({ modifiers: ["Control"] });
  await cell(page, "t-carla", D2).click({ modifiers: ["Shift"] });
  await expect(bar(page)).toContainText("6 celdas · 3 personas");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("assigning a selection to a job runs one command per person and one Deshacer undoes them all", async ({ page }) => {
  const { calls } = await openMatrix(page);
  await pick(page, block(["t-ana", "t-beto", "t-carla"], [D1, D2]));
  await expect(bar(page)).toContainText("6 celdas · 3 personas");

  await bar(page).getByRole("button", { name: "Asignar a…" }).click();
  await page.getByRole("button", { name: /Gira Lúa/ }).click();

  await expect.poll(() => rpcBodies(calls, "apply_direct_assignment").length).toBe(3);
  for (const body of rpcBodies(calls, "apply_direct_assignment")) {
    expect(body).toMatchObject({ p_job_id: JOB_ID, p_status: "invited", p_coverage: "full", p_mode: "add", p_source: "matrix-batch" });
  }
  expect(new Set(rpcBodies(calls, "apply_direct_assignment").map((body) => body.p_technician_id))).toEqual(new Set(["t-ana", "t-beto", "t-carla"]));
  await expect(bar(page)).toBeHidden();
  await expect(cell(page, "t-ana", D1)).toContainText("Gira Lúa");

  const toast = toastWith(page, "3 personas asignadas");
  await expect(toast.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect.poll(() => rpcBodies(calls, "remove_direct_assignment").length).toBe(3);
  await expect(cell(page, "t-ana", D1)).not.toContainText("Gira Lúa");
  // Nobody was told: the changes were taken back inside the undo window.
  await page.waitForTimeout(9_500);
  expect(calls.rpcCalls.map((call) => call.name)).not.toContain("claim_assignment_side_effects");
  expect(calls.functionCalls.map((call) => call.name)).not.toContain("push");
});

test("Confirmado in the popover assigns confirmed", async ({ page }) => {
  const { calls } = await openMatrix(page);
  await pick(page, block(["t-dani"], [D1, D2]));
  await bar(page).getByRole("button", { name: "Asignar a…" }).click();
  await page.getByRole("radio", { name: "Confirmado" }).click();
  await page.getByRole("button", { name: /Gira Lúa/ }).click();
  await expect.poll(() => rpcBodies(calls, "apply_direct_assignment").length).toBe(1);
  expect(rpcBodies(calls, "apply_direct_assignment")[0]).toMatchObject({ p_status: "confirmed", p_technician_id: "t-dani" });
});

test("a clash on one row leaves the others applied, and Forzar applies only that row", async ({ page }) => {
  const { calls } = await openMatrix(page, { rejections: { "t-beto": ["conflict"] } });
  await pick(page, block(["t-ana", "t-beto", "t-carla"], [D1, D2]));
  await bar(page).getByRole("button", { name: "Asignar a…" }).click();
  await page.getByRole("button", { name: /Gira Lúa/ }).click();

  const panel = results(page);
  await expect(panel).toContainText("1 fila necesita tu atención");
  await expect(panel).toContainText("Beto Test");
  await expect(panel).toContainText("Ya tiene Boda Sol");
  await expect(toastWith(page, "2 personas asignadas")).toBeVisible();
  await expect(cell(page, "t-ana", D1)).toContainText("Gira Lúa");
  await expect(cell(page, "t-beto", D1)).not.toContainText("Gira Lúa");
  expect(rpcBodies(calls, "apply_direct_assignment")).toHaveLength(3);

  await panel.getByRole("button", { name: "Forzar" }).click();
  await expect.poll(() => rpcBodies(calls, "apply_direct_assignment").length).toBe(4);
  const forced = rpcBodies(calls, "apply_direct_assignment")[3];
  expect(forced).toMatchObject({ p_technician_id: "t-beto", p_conflict_policy: "allow" });
  // Nobody else was touched by it.
  expect(rpcBodies(calls, "apply_direct_assignment").slice(0, 3).filter((body) => body.p_conflict_policy === "allow")).toHaveLength(0);
  await expect(results(page)).toBeHidden();
  await expect(cell(page, "t-beto", D1)).toContainText("Gira Lúa");
});

test("a pair that changed elsewhere meanwhile fails alone and Reintentar goes through", async ({ page }) => {
  const { calls } = await openMatrix(page, { rejections: { "t-carla": ["stale_state"] } });
  await pick(page, block(["t-ana", "t-carla"], [D1, D2]));
  await bar(page).getByRole("button", { name: "Asignar a…" }).click();
  await page.getByRole("button", { name: /Gira Lúa/ }).click();

  const panel = results(page);
  await expect(panel).toContainText("Carla Test");
  await expect(panel).toContainText("Otra persona ha modificado esta asignación");
  await expect(cell(page, "t-ana", D1)).toContainText("Gira Lúa");

  await panel.getByRole("button", { name: "Reintentar" }).click();
  await expect.poll(() => rpcBodies(calls, "apply_direct_assignment").filter((body) => body.p_technician_id === "t-carla").length).toBe(2);
  await expect(results(page)).toBeHidden();
  await expect(cell(page, "t-carla", D1)).toContainText("Gira Lúa");
  expect(rpcBodies(calls, "apply_direct_assignment").filter((body) => body.p_technician_id === "t-ana")).toHaveLength(1);
});

test("Confirmar confirms every invitation, and one Deshacer takes them back", async ({ page }) => {
  const { calls } = await openMatrix(page, { initial: {
    "t-ana": { status: "invited", dates: [D1, D2] }, "t-beto": { status: "invited", dates: [D1, D2] }, "t-carla": { status: "invited", dates: [D1, D2] },
  } });
  await pick(page, block(["t-ana", "t-beto", "t-carla"], [D1]));
  await bar(page).getByRole("button", { name: "Confirmar", exact: true }).click();

  await expect.poll(() => rpcBodies(calls, "set_assignment_status").length).toBe(3);
  for (const body of rpcBodies(calls, "set_assignment_status")) expect(body).toMatchObject({ p_action: "confirm", p_source: "matrix-batch" });
  const toast = toastWith(page, "3 asignaciones confirmadas");
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect.poll(() => rpcBodies(calls, "unconfirm_assignment").length).toBe(3);
});

test("Quitar asks once, inline, with the count; removing every day removes the assignment", async ({ page }) => {
  const { calls } = await openMatrix(page, { initial: {
    "t-ana": { status: "invited", dates: [D1, D2] }, "t-beto": { status: "invited", dates: [D1, D2] },
  } });

  // One day of two people: the assignment stays, a day at a time.
  await pick(page, block(["t-ana", "t-beto"], [D1]));
  await bar(page).getByRole("button", { name: "Quitar" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("¿Quitar 2 días de 2 personas? No se puede deshacer.");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(bar(page).getByRole("button", { name: "Quitar" })).toBeVisible();
  expect(calls.rpcCalls.map((call) => call.name)).not.toContain("remove_assignment_date");

  await bar(page).getByRole("button", { name: "Quitar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Quitar" }).click();
  await expect.poll(() => rpcBodies(calls, "remove_assignment_date").length).toBe(2);
  for (const body of rpcBodies(calls, "remove_assignment_date")) expect(body).toMatchObject({ p_date: D1, p_source: "matrix-batch" });
  // Removals are not undoable: no Deshacer to offer.
  await expect(toastWith(page, "asignaciones quitadas").getByRole("button", { name: "Deshacer" })).toHaveCount(0);
  await expect(cell(page, "t-ana", D1)).not.toContainText("Gira Lúa");
  await expect(cell(page, "t-ana", D2)).toContainText("Gira Lúa");

  // The last day is a removal of the assignment, never a "remove last day".
  await pick(page, [["t-ana", D2]]);
  await bar(page).getByRole("button", { name: "Quitar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Quitar" }).click();
  await expect.poll(() => rpcBodies(calls, "remove_direct_assignment").length).toBe(1);
  expect(rpcBodies(calls, "remove_direct_assignment")[0]).toMatchObject({ p_technician_id: "t-ana", p_source: "matrix-batch" });
});

test("No disponible marks the free days of the selection and leaves assignments alone", async ({ page }) => {
  const { calls } = await openMatrix(page, { initial: { "t-beto": { status: "invited", dates: [D1] } } });
  await pick(page, [["t-beto", D1], ["t-dani", D1], ["t-dani", D2]]);
  await bar(page).getByRole("button", { name: "No disponible" }).click();

  await expect.poll(() => calls.tableMutations.filter((call) => call.table === "technician_availability").length).toBe(1);
  const rows = calls.tableMutations.find((call) => call.table === "technician_availability")?.body as Array<{ technician_id: string; date: string }>;
  expect(rows.map((row) => `${row.technician_id}:${row.date}`).sort()).toEqual([`t-dani:${D1}`, `t-dani:${D2}`]);
  await expect(page.getByRole("region", { name: /Notifications/ }).getByText("2 días marcados como no disponibles")).toBeVisible();
});

test("Limpiar and Esc drop the selection", async ({ page }) => {
  await openMatrix(page);
  await pick(page, block(["t-ana"], [D1]));
  await expect(bar(page)).toBeVisible();
  await bar(page).getByRole("button", { name: "Limpiar la selección" }).click();
  await expect(bar(page)).toBeHidden();

  await pick(page, block(["t-ana"], [D1]));
  await page.keyboard.press("Escape");
  await expect(bar(page)).toBeHidden();
});
