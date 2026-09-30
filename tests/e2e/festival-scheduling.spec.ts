import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

const JOB_ID = "festival-job-1";

const festivalJob = {
  id: JOB_ID,
  title: "Festival Smoke",
  description: "Outdoor run",
  start_time: "2026-07-10T12:00:00.000Z",
  end_time: "2026-07-12T23:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  job_type: "festival",
  location_id: "loc-1",
};

const directory = [
  { id: "tech-cruz", first_name: "Cruz", last_name: "Cruzado", nickname: null, department: "lights", role: "technician" },
  { id: "tech-rita", first_name: "Rita", last_name: "Rol", nickname: null, department: "lights", role: "technician" },
];

type Row = Record<string, unknown>;

/** A tiny in-memory copy of the two shift tables, so create → assign → edit → delete can be driven for real. */
function shiftTables() {
  const shifts: Row[] = [];
  const assignments: Row[] = [];
  let nextId = 1;

  const asRows = (body: unknown): Row[] => (Array.isArray(body) ? (body as Row[]) : [body as Row]);

  return {
    festival_shifts: ({ method, body, url }: { method: string; body: unknown; url: URL }) => {
      if (method === "POST") {
        const created = asRows(body).map((row) => ({ id: `shift-${nextId++}`, notes: null, ...row }));
        shifts.push(...created);
        return created;
      }
      if (method === "PATCH") {
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const shift = shifts.find((row) => row.id === id);
        if (shift) Object.assign(shift, body as Row);
        return shift ? [shift] : [];
      }
      if (method === "DELETE") {
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const index = shifts.findIndex((row) => row.id === id);
        if (index >= 0) shifts.splice(index, 1);
        for (let i = assignments.length - 1; i >= 0; i--) if (assignments[i].shift_id === id) assignments.splice(i, 1);
        return [];
      }
      return shifts;
    },
    festival_shift_assignments: ({ method, body, url }: { method: string; body: unknown; url: URL }) => {
      if (method === "POST") {
        const created = asRows(body).map((row) => ({ id: `assignment-${nextId++}`, ...row }));
        assignments.push(...created);
        return created;
      }
      if (method === "DELETE") {
        const index = assignments.findIndex((row) => row.id === url.searchParams.get("id")?.replace("eq.", ""));
        if (index >= 0) assignments.splice(index, 1);
        return [];
      }
      return assignments;
    },
    shifts,
    assignments,
  };
}

async function openScheduling(page: Page) {
  const tables = shiftTables();
  const calls = await bootstrapApp(page, {
    auth: { role: "management", department: "sound" },
    functions: { "get-google-maps-key": { apiKey: "test-google-key" } },
    rpc: {
      get_current_user_role: "management",
      get_profile_directory: directory,
    },
    tables: {
      profiles: [
        {
          id: "e2e-user",
          role: "management",
          department: "sound",
          soundvision_access_enabled: false,
          assignable_as_tech: false,
        },
      ],
      jobs: [festivalJob],
      locations: [{ id: "loc-1", name: "Madrid Arena", formatted_address: "Madrid Arena", latitude: 40.4168, longitude: -3.7038 }],
      festival_artists: [],
      festival_artist_files: [],
      festival_gear_setups: [{ job_id: JOB_ID, max_stages: 2 }],
      festival_stages: [
        { job_id: JOB_ID, number: 1, name: "Main" },
        { job_id: JOB_ID, number: 2, name: "Club" },
      ],
      job_assignments: [
        { technician_id: "tech-cruz", status: "confirmed", lights_role: "LGT-BRD-E" },
        { technician_id: "tech-rita", status: "confirmed", lights_role: "LGT-SYS-E" },
      ],
      flex_folders: [],
      job_documents: [],
      job_whatsapp_group_requests: [],
      job_whatsapp_groups: [],
      tour_dates: [],
      tours: [],
      festival_shifts: tables.festival_shifts,
      festival_shift_assignments: tables.festival_shift_assignments,
    },
  });

  await page.goto(`/festival-management/${JOB_ID}/scheduling`);
  await expect(page.getByRole("heading", { name: "Planificación del festival" })).toBeVisible();
  return { calls, tables };
}

test.describe("festival shift planner", () => {
  test("creates a shift, staffs it in the same sheet, edits it and deletes it", async ({ page }) => {
    const { tables } = await openScheduling(page);

    // Create: the sheet stays open on the new shift so its crew can be added right away.
    await page.getByRole("button", { name: "Crear turno" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Crear turno" })).toBeVisible();
    await sheet.getByLabel("Nombre del turno").fill("Montaje luces");
    await sheet.getByRole("button", { name: "Crear turno" }).click();

    await expect(sheet.getByRole("heading", { name: "Editar turno" })).toBeVisible();
    await expect(sheet.getByText("Personal asignado (0)")).toBeVisible();
    expect(tables.shifts).toHaveLength(1);

    // Assign two people at once, without re-picking a role for each.
    await sheet.getByRole("checkbox", { name: /Cruz Cruzado/ }).check();
    await sheet.getByRole("checkbox", { name: /Rita Rol/ }).check();
    await sheet.getByRole("button", { name: "Añadir al turno (2)" }).click();

    await expect(sheet.getByText("Personal asignado (2)")).toBeVisible();
    expect(tables.assignments).toHaveLength(2);
    expect(tables.assignments.map((row) => row.technician_id)).toEqual(["tech-cruz", "tech-rita"]);

    // Edit: Guardar stays disabled until something changes.
    const save = sheet.getByRole("button", { name: "Guardar cambios" });
    await expect(save).toBeDisabled();
    await sheet.getByLabel("Nombre del turno").fill("Montaje y pruebas");
    await save.click();
    await expect.poll(() => tables.shifts[0]?.name).toBe("Montaje y pruebas");

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // The shift is on the board (an agenda on a phone), in its lane; open it again and delete it, after confirming.
    await page.getByRole("button", { name: /^Montaje y pruebas, de 09:00 a 18:00, 2 personas/ }).click();
    await sheet.getByRole("button", { name: "Eliminar turno" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await expect.poll(() => tables.shifts.length).toBe(0);
    await expect(page.getByText("No hay turnos programados para esta fecha")).toBeVisible();
  });

  test("shows a shift's crew in the sheet and lets a person be removed", async ({ page }) => {
    const { tables } = await openScheduling(page);
    tables.shifts.push({
      id: "shift-existing",
      job_id: JOB_ID,
      date: "2026-07-10",
      name: "Noche",
      start_time: "22:00",
      end_time: "06:00",
      stage: 1,
      department: "lights",
      notes: null,
    });
    tables.assignments.push({
      id: "assignment-existing",
      shift_id: "shift-existing",
      technician_id: null,
      external_technician_name: "Pepe Externo",
      role: "runner",
    });
    await page.reload();

    await page.getByRole("button", { name: /^Noche, de 22:00 a 06:00, 1 persona/ }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Editar turno" })).toBeVisible();
    await expect(sheet.getByText("Pepe Externo")).toBeVisible();
    await expect(sheet.getByRole("listitem").getByText("Externo", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Duración: 8 h · termina al día siguiente")).toBeVisible();

    await sheet.getByRole("button", { name: "Quitar a Pepe Externo del turno" }).click();
    await expect(sheet.getByText("Personal asignado (0)")).toBeVisible();
    expect(tables.assignments).toHaveLength(0);
  });

  test("shows shifts in the lane of their stage and starts one from a lane", async ({ page }) => {
    const { tables } = await openScheduling(page);
    tables.shifts.push(
      { id: "s-main", job_id: JOB_ID, date: "2026-07-10", name: "Montaje", start_time: "09:00", end_time: "13:00", stage: 1, department: "sound", notes: null },
      { id: "s-club", job_id: JOB_ID, date: "2026-07-10", name: "Noche", start_time: "22:00", end_time: "06:00", stage: 2, department: "lights", notes: null },
    );
    await page.reload();

    // One lane per stage (a column on the board, a section on a phone), with its own shifts.
    const laneRole = isMobileViewport(page) ? "region" : "group";
    const main = page.getByRole(laneRole, { name: "Main" });
    const club = page.getByRole(laneRole, { name: "Club" });
    await expect(main.getByRole("button", { name: /^Montaje/ })).toBeVisible();
    await expect(club.getByRole("button", { name: /^Noche/ })).toBeVisible();
    await expect(main.getByRole("button", { name: /^Noche/ })).toHaveCount(0);

    // A lane's add button opens the sheet already on that stage.
    await page.getByRole("button", { name: "Añadir turno en Club" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Crear turno" })).toBeVisible();
    await expect(sheet.getByRole("combobox", { name: "Stage (opcional)" })).toHaveText("Club");
  });

  test("groups by department and offers the table for printing", async ({ page }) => {
    const { tables } = await openScheduling(page);
    tables.shifts.push(
      { id: "s-sound", job_id: JOB_ID, date: "2026-07-10", name: "Montaje", start_time: "09:00", end_time: "13:00", stage: 1, department: "sound", notes: null },
      { id: "s-lights", job_id: JOB_ID, date: "2026-07-10", name: "Noche", start_time: "22:00", end_time: "06:00", stage: 2, department: "lights", notes: null },
    );
    await page.reload();

    await page.getByRole("radio", { name: "Por departamento" }).click();
    const laneRole = isMobileViewport(page) ? "region" : "group";
    await expect(page.getByRole(laneRole, { name: "Sonido" }).getByRole("button", { name: /^Montaje/ })).toBeVisible();
    await expect(page.getByRole(laneRole, { name: "Luces" }).getByRole("button", { name: /^Noche/ })).toBeVisible();

    await page.getByRole("radio", { name: "Tabla" }).click();
    await expect(page.getByRole("button", { name: "Exportar a PDF" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Personal" })).toBeVisible();
  });
});
