import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (offset: number) => {
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};

const JOB_ID = "job-inspector";
const TECH_ID = "tech-1";

interface Body { [key: string]: unknown }
const asBody = (body: unknown): Body => (typeof body === "object" && body !== null ? (body as Body) : {});

/**
 * A matrix with one technician and one two-day job whose assignment commands
 * are stateful, so the grid, the inspector and the undo window behave as they
 * do against the real database.
 */
async function openMatrix(page: Page, options: { initiallyAssigned?: boolean; query?: string } = {}) {
  const job = {
    id: JOB_ID, title: "Gira Lúa", start_time: `${day(1)}T08:00:00Z`, end_time: `${day(2)}T18:00:00Z`,
    color: "#2563eb", status: "Confirmado", job_type: "single", job_departments: [{ department: "sound" }], job_assignments: [],
  };
  const state = { assigned: options.initiallyAssigned ?? false, status: "invited", role: "SND-MON-E", token: options.initiallyAssigned ? "t-assigned" : "t0", removed: 0 };
  const row = () => ({
    id: "assignment-1", status: state.status, sound_role: state.role, lights_role: null, video_role: null,
    production_role: null, single_day: false, assignment_date: null, assignment_source: "direct",
  });
  const pairState = () => ({ exists: state.assigned, assignment: state.assigned ? row() : null, dates: state.assigned ? [day(1), day(2)] : [], state_token: state.token });
  const effects = (id: string) => [
    { kind: "flex", action: "add", job_id: JOB_ID, department: "sound", status: "pending", effect_id: `${id}:0` },
    { kind: "notification", action: "job.assignment.direct", job_id: JOB_ID, status: "pending", effect_id: `${id}:1` },
  ];
  const result = (id: string, extra: Body = {}) => ({
    ok: true, outcome: "committed", command_id: id, job_id: JOB_ID, technician_id: TECH_ID, state_token: state.token,
    replayed: false, assignment: state.assigned ? row() : null, dates: state.assigned ? [day(1), day(2)] : [], side_effects: [], warnings: [], ...extra,
  });

  const calls = await bootstrapApp(page, {
    auth: { role: "management", department: "sound" },
    tables: {
      jobs: [job], job_date_types: [],
      job_assignments: () => (state.assigned ? [{ job_id: JOB_ID, technician_id: TECH_ID, status: state.status, sound_role: state.role, single_day: false, assignment_date: null, assigned_at: `${day(0)}T09:00:00Z`, assigned_by: null }] : []),
      timesheets: () => (state.assigned ? [day(1), day(2)].map((date, index) => ({ id: `ts-${index}`, job_id: JOB_ID, technician_id: TECH_ID, date, is_active: true, source: "direct" })) : []),
      job_required_roles_summary: [{ job_id: JOB_ID, department: "sound", roles: [{ role_code: "SND-MON-E", quantity: 1 }, { role_code: "SND-PA-T", quantity: 2 }] }],
      technician_fridge: [], availability_schedules: [], technician_availability: [], vacation_requests: [], profiles: [], skills: [], staffing_requests: [], staffing_events: [],
    },
    rpc: {
      get_profiles_with_skills: [{ id: TECH_ID, first_name: "Marta", last_name: "Ibáñez", email: "marta@example.test", department: "sound", role: "technician", skills: [{ name: "Monitores", is_primary: true }] }],
      get_job_staffing_summary: [], get_active_timesheet_counts_by_technician: [], get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: [], get_staffing_requests_matrix_filtered: [],
      get_assignment_command_state: () => pairState(),
      apply_direct_assignment: ({ body }) => {
        const input = asBody(body);
        state.assigned = true;
        state.status = input.p_status === "confirmed" ? "confirmed" : "invited";
        state.role = String(input.p_role);
        state.token = "t1";
        return result(String(input.p_command_id), { side_effects: effects(String(input.p_command_id)) });
      },
      remove_direct_assignment: ({ body }) => {
        state.assigned = false;
        state.removed += 1;
        state.token = "t2";
        return result(String(asBody(body).p_command_id), {
          removed: { job_id: JOB_ID, deleted_timesheets: 2, deleted_assignment: true, assignment: null },
          side_effects: [{ kind: "notification", action: "assignment.removed", job_id: JOB_ID, status: "pending", effect_id: "x:0" }],
        });
      },
      set_assignment_status: ({ body }) => {
        state.status = "confirmed";
        state.token = "t3";
        return result(String(asBody(body).p_command_id), { side_effects: [{ kind: "notification", action: "job.assignment.confirmed", job_id: JOB_ID, status: "pending", effect_id: "c:0" }] });
      },
      unconfirm_assignment: ({ body }) => {
        state.status = "invited";
        state.token = "t4";
        return result(String(asBody(body).p_command_id));
      },
      claim_assignment_side_effects: ({ body }) => ({ claim_token: "claim-1", effects: effects(String(asBody(body).p_command_id)).map((effect, index) => ({ ...effect, index })) }),
      record_assignment_side_effects: { ok: true },
      supersede_assignment_side_effects: ({ body }) => ({ superseded: 2, not_superseded: 0, commands: (asBody(body).p_command_ids as string[]).map((id) => ({ command_id: id, superseded: 2, not_superseded: 0 })) }),
    },
    functions: { push: { ok: true }, "manage-flex-crew-assignments": { ok: true } },
  });
  await page.goto(`/job-assignment-matrix${options.query ?? "?matriz=v2"}`);
  return { calls, state };
}

/** A toast, not the grid's screen-reader announcement (also a status region). */
const toastWith = (page: Page, text: string) =>
  page.getByRole("region", { name: /Notifications/ }).getByRole("status").filter({ hasText: text });
const cell = (page: Page, offset: number) => page.locator(`[data-technician-id="${TECH_ID}"][data-date-key="${day(offset)}"]`);
const inspector = (page: Page) => page.getByRole("dialog").filter({ hasText: "Marta" });
const rpcNames = (calls: Awaited<ReturnType<typeof openMatrix>>["calls"]) => calls.rpcCalls.map((call) => call.name);

test("a click on an empty cell opens the inspector and assigns in one step", async ({ page }) => {
  const { calls } = await openMatrix(page);
  await expect(cell(page, 1)).toBeVisible();
  await cell(page, 1).click();

  const panel = inspector(page);
  await expect(panel).toBeVisible();
  // The only job that day is preselected, and its open slot suggests the role.
  await expect(panel.getByRole("radio", { name: /Gira Lúa/ })).toBeChecked();
  await expect(panel.getByRole("radio", { name: /Monitores — Especialista, sugerido/ })).toBeChecked();

  const assign = panel.getByRole("button", { name: "Asignar", exact: true });
  await expect(assign).toBeEnabled();
  await assign.click();

  await expect.poll(() => rpcNames(calls)).toContain("apply_direct_assignment");
  const apply = asBody(calls.rpcCalls.find((call) => call.name === "apply_direct_assignment")?.body);
  expect(apply).toMatchObject({ p_role: "SND-MON-E", p_status: "invited", p_coverage: "full", p_job_id: JOB_ID, p_technician_id: TECH_ID, p_source: "matrix-inspector", p_expected_state_token: "t0" });

  await expect(panel).toBeHidden();
  await expect(cell(page, 1)).toContainText("Gira Lúa");
  await expect(toastWith(page, "Marta").getByRole("button", { name: "Deshacer" })).toBeVisible();
});

test("Deshacer takes the assignment back and nobody is notified", async ({ page }) => {
  const { calls, state } = await openMatrix(page);
  await cell(page, 1).click();
  await inspector(page).getByRole("button", { name: "Asignar", exact: true }).click();
  const toast = toastWith(page, "Marta");
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Deshacer" }).click();

  await expect.poll(() => state.removed).toBe(1);
  const remove = asBody(calls.rpcCalls.find((call) => call.name === "remove_direct_assignment")?.body);
  expect(remove).toMatchObject({ p_expected_state_token: "t1", p_job_id: JOB_ID });
  await expect.poll(() => rpcNames(calls).filter((name) => name === "supersede_assignment_side_effects").length).toBe(2);
  await expect(cell(page, 1)).not.toContainText("Gira Lúa");

  // Past the undo window nothing was claimed, no Flex call, no notification.
  await page.waitForTimeout(9_500);
  expect(rpcNames(calls)).not.toContain("claim_assignment_side_effects");
  expect(calls.functionCalls.map((call) => call.name)).not.toContain("push");
  expect(calls.functionCalls.map((call) => call.name)).not.toContain("manage-flex-crew-assignments");
});

test("without Deshacer the effects go out when the window closes", async ({ page }) => {
  const { calls } = await openMatrix(page);
  await cell(page, 1).click();
  await inspector(page).getByRole("button", { name: "Asignar", exact: true }).click();
  await expect(cell(page, 1)).toContainText("Gira Lúa");
  expect(rpcNames(calls)).not.toContain("claim_assignment_side_effects");

  await expect.poll(() => rpcNames(calls), { timeout: 15_000 }).toContain("claim_assignment_side_effects");
  await expect.poll(() => calls.functionCalls.map((call) => call.name), { timeout: 15_000 }).toEqual(expect.arrayContaining(["push", "manage-flex-crew-assignments"]));
  await expect.poll(() => rpcNames(calls)).toContain("record_assignment_side_effects");
});

test("an invited technician is confirmed in one click, and it can be undone", async ({ page }) => {
  const { calls, state } = await openMatrix(page, { initiallyAssigned: true });
  await expect(cell(page, 1)).toContainText("Gira Lúa");
  await cell(page, 1).click();

  const panel = inspector(page);
  await expect(panel.getByText("Invitado · sin respuesta")).toBeVisible();
  await panel.getByRole("button", { name: /Confirmar/ }).click();
  await expect.poll(() => state.status).toBe("confirmed");
  expect(asBody(calls.rpcCalls.find((call) => call.name === "set_assignment_status")?.body)).toMatchObject({ p_action: "confirm", p_expected_state_token: "t-assigned" });

  await toastWith(page, "confirmado").getByRole("button", { name: "Deshacer" }).click();
  await expect.poll(() => state.status).toBe("invited");
  expect(asBody(calls.rpcCalls.find((call) => call.name === "unconfirm_assignment")?.body)).toMatchObject({ p_expected_state_token: "t3" });
});

test("removing an assignment asks inside the inspector, not in a dialog", async ({ page }) => {
  const { state } = await openMatrix(page, { initiallyAssigned: true });
  await cell(page, 1).click();
  const panel = inspector(page);
  await panel.getByRole("button", { name: /Quitar del trabajo/ }).click();
  const confirm = panel.getByRole("alertdialog");
  await expect(confirm).toContainText("Quitar a Marta");
  expect(state.removed).toBe(0);
  await confirm.getByRole("button", { name: /Quitar 2 días/ }).click();
  await expect.poll(() => state.removed).toBe(1);
  await expect(cell(page, 1)).not.toContainText("Gira Lúa");
});

test("a second click on the same cell closes the inspector (desktop)", async ({ page }) => {
  test.skip(isMobileViewport(page), "Touch uses a sheet, which has its own close control.");
  await openMatrix(page);
  await cell(page, 1).click();
  await expect(inspector(page)).toBeVisible();
  await cell(page, 1).click();
  await expect(inspector(page)).toBeHidden();
});

test("Escape closes the inspector", async ({ page }) => {
  await openMatrix(page);
  await cell(page, 1).click();
  await expect(inspector(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inspector(page)).toBeHidden();
});

test.describe("without editing modes", () => {
  test("Matrix v2 has no assignment, unavailability or staffing-icon switches", async ({ page }) => {
    await openMatrix(page);
    await expect(cell(page, 1)).toBeVisible();
    if (isMobileViewport(page)) await page.getByRole("button", { name: /^Filtros/ }).click();
    await expect(page.getByRole("switch", { name: /alternar asignación directa/i })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: /alternar marcar no disponible/i })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: /mostrar botones de (email|whatsapp)/i })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: /nevera/i }).first()).toBeVisible();
    // The per-cell staffing icon cluster is gone; those requests start in the inspector.
    await expect(cell(page, 1).getByRole("button", { name: /disponibilidad/i })).toHaveCount(0);
  });

  test("the old modes are still there with ?matriz=v1", async ({ page }) => {
    await openMatrix(page, { query: "?matriz=v1" });
    await expect(cell(page, 1)).toBeVisible();
    if (isMobileViewport(page)) await page.getByRole("button", { name: /^Filtros/ }).click();
    await expect(page.getByRole("switch", { name: /alternar asignación directa/i }).first()).toBeVisible();
  });

  test("the ✓ on an invited cell confirms at once, and there is no ✕ that removes", async ({ page }) => {
    test.skip(isMobileViewport(page), "The phone cell has no icon buttons: it opens the sheet.");
    const { calls, state } = await openMatrix(page, { initiallyAssigned: true });
    await expect(cell(page, 1)).toContainText("Gira Lúa");
    await expect(cell(page, 1).getByTitle("Eliminar asignación")).toHaveCount(0);
    await cell(page, 1).getByTitle("Confirmar", { exact: true }).click();
    await expect.poll(() => state.status).toBe("confirmed");
    expect(asBody(calls.rpcCalls.find((call) => call.name === "set_assignment_status")?.body)).toMatchObject({ p_action: "confirm", p_source: "matrix-inspector" });
    await expect(toastWith(page, "confirmado").getByRole("button", { name: "Deshacer" })).toBeVisible();
    await expect(inspector(page)).toBeHidden();
  });

  test("the cell's ✕ opens the inspector already asking to decline", async ({ page }) => {
    test.skip(isMobileViewport(page), "The phone cell has no icon buttons: it opens the sheet.");
    const { state } = await openMatrix(page, { initiallyAssigned: true });
    await cell(page, 1).getByTitle("Rechazar", { exact: true }).click();
    const confirm = inspector(page).getByRole("alertdialog");
    await expect(confirm).toContainText("¿Rechazar en nombre de Marta?");
    expect(state.status).toBe("invited");
  });

  test("right-click opens the inspector", async ({ page }) => {
    test.skip(isMobileViewport(page), "Right-click is a desktop gesture.");
    await openMatrix(page);
    await cell(page, 1).click({ button: "right" });
    await expect(inspector(page)).toBeVisible();
  });
});

test.describe("keyboard", () => {
  test.beforeEach(({ page }) => {
    test.skip(isMobileViewport(page), "The keyboard model is for desktop.");
  });

  test("arrows move a ring, Intro opens the inspector and Escape returns to the grid", async ({ page }) => {
    await openMatrix(page);
    const grid = page.locator("[data-matrix-grid]");
    await expect(cell(page, 1)).toBeVisible();
    await grid.focus();
    await expect(page.locator("[data-matrix-active-ring]")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    // The live region names the cell the ring is on.
    await expect(page.getByRole("status").filter({ hasText: "Marta Ibáñez" })).toContainText("libre");
    await page.keyboard.press("Enter");
    await expect(inspector(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(inspector(page)).toBeHidden();
    await expect(grid).toBeFocused();
  });

  test("C confirms the active invited cell and X asks to decline", async ({ page }) => {
    const { state } = await openMatrix(page, { initiallyAssigned: true });
    const grid = page.locator("[data-matrix-grid]");
    await expect(cell(page, 1)).toContainText("Gira Lúa");
    await grid.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("c");
    await expect.poll(() => state.status).toBe("confirmed");
    await page.keyboard.press("x");
    await expect(inspector(page).getByRole("alertdialog")).toContainText("¿Rechazar en nombre de Marta?");
  });

  test("Supr asks before removing", async ({ page }) => {
    const { state } = await openMatrix(page, { initiallyAssigned: true });
    await page.locator("[data-matrix-grid]").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Delete");
    const confirm = inspector(page).getByRole("alertdialog");
    await expect(confirm).toContainText("Quitar a Marta");
    expect(state.removed).toBe(0);
  });

  test("N marks the day unavailable", async ({ page }) => {
    const { calls } = await openMatrix(page);
    await page.locator("[data-matrix-grid]").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("n");
    await expect.poll(() => calls.tableMutations.filter((mutation) => mutation.table.startsWith("technician_availability")).length).toBeGreaterThan(0);
  });

  test("? lists the shortcuts", async ({ page }) => {
    await openMatrix(page);
    await page.locator("[data-matrix-grid]").focus();
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Atajos de la matriz" });
    await expect(help).toBeVisible();
    await expect(help).toContainText("Confirmar la asignación");
  });

  test("C on an empty cell says there is nothing to confirm", async ({ page }) => {
    const { calls } = await openMatrix(page);
    await page.locator("[data-matrix-grid]").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("c");
    await expect(page.getByText("Esta celda no tiene ninguna asignación que confirmar.")).toBeVisible();
    expect(calls.rpcCalls.map((call) => call.name)).not.toContain("set_assignment_status");
  });
});
