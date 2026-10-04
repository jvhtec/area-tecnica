import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp, httpResponse, isMobileViewport } from "./support/app";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (offset: number) => {
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};

const JOB_ID = "job-staffing";
const D1 = day(1);
const D2 = day(2);
const D3 = day(3);
const TECHS = [
  { id: "t-ana", first: "Ana" },
  { id: "t-beto", first: "Beto" },
  { id: "t-carla", first: "Carla" },
];

interface Body { [key: string]: unknown }
const asBody = (body: unknown): Body => (typeof body === "object" && body !== null ? (body as Body) : {});

interface Options {
  /** Technicians whose next send is refused with a 409 clash. */
  clash?: string[];
  /** A request already out for this technician: the composer manages it. */
  requested?: string;
  /** Names of the technicians to have in the grid. */
  technicians?: typeof TECHS;
  /** The query string to open the matrix with; `?matriz=v2` stores the choice, an empty one leaves the default. */
  query?: string;
  /** localStorage entries to have in place on load (the harness clears storage on every navigation). */
  storage?: Record<string, string>;
}

/** A job over three days, staffing statuses for one pending availability request, and a send-staffing-email that can refuse. */
async function openMatrix(page: Page, options: Options = {}) {
  const technicians = options.technicians ?? TECHS;
  const clash = new Set(options.clash ?? []);
  const job = { id: JOB_ID, title: "Gira Lúa", description: "Carga a las 8 en la puerta B", start_time: `${D1}T08:00:00Z`, end_time: `${D3}T18:00:00Z`, color: "#2563eb", status: "Confirmado", job_type: "single", job_departments: [{ department: "sound" }], job_assignments: [] };
  const pending = options.requested
    ? [{ id: "req-1", job_id: JOB_ID, profile_id: options.requested, phase: "availability", status: "pending", single_day: false, target_date: null, updated_at: `${day(0)}T09:00:00Z`, created_at: `${day(0)}T09:00:00Z`, requested_by: null }]
    : [];

  const calls = await bootstrapApp(page, {
    auth: { role: "management", department: "sound" },
    tables: {
      jobs: [job], job_date_types: [], job_assignments: [], timesheets: [],
      job_required_roles_summary: [{ job_id: JOB_ID, department: "sound", roles: [{ role_code: "SND-MON-E", quantity: 1 }, { role_code: "SND-PA-T", quantity: 3 }] }],
      staffing_requests: pending, staffing_events: [], technician_fridge: [], availability_schedules: [], technician_availability: [], vacation_requests: [], profiles: [], skills: [],
    },
    rpc: {
      get_profiles_with_skills: technicians.map(({ id, first }) => ({ id, first_name: first, last_name: "Test", email: `${id}@example.test`, department: "sound", role: "technician", skills: [] })),
      get_job_staffing_summary: [], get_active_timesheet_counts_by_technician: [], get_assignment_matrix_staffing: [],
      get_assignment_matrix_staffing_filtered: pending.map((row) => ({ job_id: row.job_id, profile_id: row.profile_id, availability_status: "pending", offer_status: null })),
      get_staffing_requests_matrix_filtered: pending,
      get_assignment_command_state: { exists: false, assignment: null, dates: [], state_token: "t0" },
    },
    functions: {
      "send-staffing-email": ({ body }) => {
        const payload = asBody(body);
        const profile = String(payload.profile_id);
        if (clash.has(profile) && !payload.override_conflicts) {
          return httpResponse(409, { error: "Conflicto de agenda", details: { conflict_type: "job_overlap", conflicts: [{ job_name: "Boda Sol", start_time: `${D1}T08:00:00Z`, end_time: `${D1}T18:00:00Z` }], unavailability: [{ date: D2, reason: "Vacaciones" }] } });
        }
        return { success: true, channel: payload.channel };
      },
      "notify-staffing-cancellation": { ok: true },
      push: { ok: true },
    },
  });
  // Registered after the harness's own init script, so it runs after the clear.
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
  }, options.storage ?? {});
  await page.goto(`/job-assignment-matrix${options.query ?? "?matriz=v2"}`);
  return { calls };
}

type Calls = Awaited<ReturnType<typeof openMatrix>>["calls"];
const sends = (calls: Calls) => calls.functionCalls.filter((call) => call.name === "send-staffing-email").map((call) => asBody(call.body));
const cell = (page: Page, technicianId: string, date: string) => page.locator(`[data-technician-id="${technicianId}"][data-date-key="${date}"]`);
const inspector = (page: Page) => page.getByRole("dialog").filter({ hasText: "Test" }).first();
const bar = (page: Page) => page.getByTestId("batch-bar");
const results = (page: Page) => page.getByTestId("batch-results");
const toastText = (page: Page, text: string | RegExp) => page.getByRole("region", { name: /Notifications/ }).getByText(text);

async function openComposer(page: Page, technicianId = "t-ana") {
  await cell(page, technicianId, D1).click();
  const panel = inspector(page);
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /Pedir disponibilidad u oferta/ }).click();
  await expect(panel.getByRole("radiogroup", { name: "Qué enviar" })).toBeVisible();
  return panel;
}

const pick = async (page: Page, cells: Array<[string, string]>) => {
  for (const [technicianId, date] of cells) await cell(page, technicianId, date).click({ modifiers: ["Control"] });
};

test("a request is composed in the cell's own panel: intent, job and days are already chosen", async ({ page }) => {
  const { calls } = await openMatrix(page);
  const panel = await openComposer(page);
  await expect(panel.getByRole("radio", { name: "Disponibilidad" })).toBeChecked();
  await expect(panel.getByRole("radio", { name: /Gira Lúa/ })).toBeChecked();
  await expect(panel.getByRole("radio", { name: "Email" })).toBeChecked();
  // No dialog opened on top: the panel is the only one.
  await expect(page.getByRole("dialog")).toHaveCount(1);

  await panel.getByRole("button", { name: "Pedir disponibilidad" }).click();
  await expect.poll(() => sends(calls).length).toBe(1);
  expect(sends(calls)[0]).toMatchObject({ job_id: JOB_ID, profile_id: "t-ana", phase: "availability", channel: "email", single_day: false });
  await expect(toastText(page, /Disponibilidad pedida a Ana Test por Email/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("picked days go out as a list, and the button says how many", async ({ page }) => {
  const { calls } = await openMatrix(page);
  const panel = await openComposer(page);
  await panel.getByRole("button", { name: "Solo este día" }).click();
  await panel.getByRole("button", { name: "Pedir disponibilidad (1 día)" }).click();
  await expect.poll(() => sends(calls).length).toBe(1);
  expect(sends(calls)[0]).toMatchObject({ single_day: true, dates: [D1], target_date: D1 });
});

test("the channel is remembered for next time", async ({ page }) => {
  const { calls } = await openMatrix(page);
  const panel = await openComposer(page);
  await panel.getByRole("radio", { name: "WhatsApp" }).click();
  await panel.getByRole("button", { name: "Pedir disponibilidad" }).click();
  await expect.poll(() => sends(calls).length).toBe(1);
  expect(sends(calls)[0]).toMatchObject({ channel: "whatsapp" });
  // Kept per person, so it is there the next time the matrix opens.
  expect(await page.evaluate(() => window.localStorage.getItem("matrix-v2:staffing-channel:e2e-user"))).toBe("whatsapp");
});

test("a remembered channel is already selected when the composer opens", async ({ page }) => {
  await openMatrix(page, { storage: { "matrix-v2:staffing-channel:e2e-user": "whatsapp" } });
  const panel = await openComposer(page);
  await expect(panel.getByRole("radio", { name: "WhatsApp" })).toBeChecked();
});

test("an offer suggests the open slot's role and includes the job description unless edited", async ({ page }) => {
  const { calls } = await openMatrix(page);
  const panel = await openComposer(page);
  await panel.getByRole("radio", { name: "Oferta" }).click();
  await expect(panel.getByRole("radio", { name: /Monitores — Especialista, sugerido/ })).toBeChecked();
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await panel.getByRole("button", { name: "Enviar oferta" }).click();
  await expect.poll(() => sends(calls).length).toBe(1);
  expect(sends(calls)[0]).toMatchObject({ phase: "offer", role: "SND-MON-E", message: "Carga a las 8 en la puerta B", single_day: false });
});

test("a clash is shown in the panel and Enviar igualmente sends it accepting the clash", async ({ page }) => {
  const { calls } = await openMatrix(page, { clash: ["t-ana"] });
  const panel = await openComposer(page);
  await panel.getByRole("button", { name: "Pedir disponibilidad" }).click();

  const alert = panel.getByRole("alert");
  await expect(alert).toContainText("No se ha enviado: hay un choque de agenda");
  await expect(alert).toContainText("Boda Sol");
  await expect(alert).toContainText("Vacaciones");
  expect(sends(calls)).toHaveLength(1);

  await alert.getByRole("button", { name: "Enviar igualmente" }).click();
  await expect.poll(() => sends(calls).length).toBe(2);
  expect(sends(calls)[1]).toMatchObject({ profile_id: "t-ana", override_conflicts: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a request that is already out can be resent on the chosen channel", async ({ page }) => {
  const { calls } = await openMatrix(page, { requested: "t-ana" });
  const panel = await openComposer(page);
  await expect(panel).toContainText("Disponibilidad pedida");
  await expect(panel).toContainText("Esperando respuesta");

  await panel.getByRole("button", { name: "Reenviar por Email" }).click();
  await expect.poll(() => sends(calls).length).toBe(1);
  expect(sends(calls)[0]).toMatchObject({ phase: "availability", resend_request_id: "req-1", profile_id: "t-ana" });
});

test("a request that is already out is cancelled after one inline confirmation", async ({ page }) => {
  const { calls } = await openMatrix(page, { requested: "t-ana" });
  const panel = await openComposer(page);
  await panel.getByRole("button", { name: "Cancelar solicitud" }).click();
  const confirm = panel.getByRole("alertdialog");
  await expect(confirm).toContainText("¿Cancelar la solicitud?");
  expect(calls.tableMutations.filter((call) => call.table === "staffing_requests")).toHaveLength(0);
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect.poll(() => calls.tableMutations.filter((call) => call.table === "staffing_requests" && call.method === "PATCH").length).toBe(1);
  expect(asBody(calls.tableMutations.find((call) => call.table === "staffing_requests")?.body)).toMatchObject({ status: "expired" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("selecting people and asking for availability sends one request each; one clash is fixed alone", async ({ page }) => {
  const { calls } = await openMatrix(page, { clash: ["t-beto"] });
  await pick(page, [["t-ana", D1], ["t-beto", D1], ["t-carla", D1]]);
  await expect(bar(page)).toContainText("3 celdas · 3 personas");
  await bar(page).getByRole("button", { name: "Pedir disponibilidad" }).click();
  await page.getByRole("button", { name: /Gira Lúa/ }).click();

  await expect.poll(() => sends(calls).length).toBe(3);
  for (const body of sends(calls)) {
    expect(body).toMatchObject({ job_id: JOB_ID, phase: "availability", channel: "email", single_day: true, dates: [D1], target_date: D1 });
  }
  await expect(toastText(page, "2 solicitudes de disponibilidad enviadas")).toBeVisible();
  const panel = results(page);
  await expect(panel).toContainText("Beto Test");
  await expect(panel).toContainText("Ya tiene Boda Sol");

  await panel.getByRole("button", { name: "Enviar igualmente" }).click();
  await expect.poll(() => sends(calls).length).toBe(4);
  expect(sends(calls)[3]).toMatchObject({ profile_id: "t-beto", override_conflicts: true });
  expect(sends(calls).slice(0, 3).filter((body) => body.override_conflicts)).toHaveLength(0);
  await expect(results(page)).toBeHidden();
});

test("offers to a selection take the job's open slots in turn", async ({ page }) => {
  test.skip(isMobileViewport(page), "The role order is the same on phones; one viewport is enough.");
  const { calls } = await openMatrix(page);
  await pick(page, [["t-ana", D1], ["t-beto", D1], ["t-carla", D1]]);
  await bar(page).getByRole("button", { name: "Enviar oferta" }).click();
  await page.getByRole("radio", { name: "WhatsApp" }).click();
  await page.getByRole("button", { name: /Gira Lúa/ }).click();
  await expect.poll(() => sends(calls).length).toBe(3);
  expect(sends(calls).map((body) => body.role)).toEqual(["SND-MON-E", "SND-PA-T", "SND-PA-T"]);
  for (const body of sends(calls)) expect(body).toMatchObject({ phase: "offer", channel: "whatsapp", message: "Carga a las 8 en la puerta B" });
});

test("the new matrix is what a manager gets without asking, and a stored choice brings the old one back", async ({ page }) => {
  test.skip(isMobileViewport(page), "These controls are in the desktop toolbar; on a phone they sit behind Filtros.");
  await openMatrix(page, { query: "" });
  await expect(page.getByRole("button", { name: "Enfocar trabajo" }).first()).toBeVisible();
  await expect(page.getByLabel(/Alternar asignación directa/)).toHaveCount(0);
});

test("a manager who chose the old matrix in Ajustes keeps getting it", async ({ page }) => {
  test.skip(isMobileViewport(page), "These controls are in the desktop toolbar; on a phone they sit behind Filtros.");
  await openMatrix(page, { query: "", storage: { "matrix-v2": "v1" } });
  await expect(page.getByLabel(/Alternar asignación directa/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Enfocar trabajo" })).toHaveCount(0);
});
