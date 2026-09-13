import { expect, test, type Page } from "@playwright/test";

import type { TransportRequestRecord } from "../../src/features/logistics/transportRequests";
import { bootstrapApp, isMobileViewport } from "./support/app";

const pendingRequest: TransportRequestRecord = {
  id: "transport-request-pending",
  job_id: "transport-job-pending",
  job_title: "Concierto pendiente de transporte",
  department: "sound",
  status: "requested",
  planning_status: "requested",
  description: "Trasladar el equipo de sonido",
  note: null,
  needed_at: "2026-09-14T22:30:00Z",
  origin: "Almacén Sector Pro",
  destination: "Madrid Arena",
  movement_type: "transfer",
  priority: "high",
  source_type: "manual",
  source_ref: null,
  is_hoja_relevant: true,
  created_at: "2026-09-13T08:00:00Z",
  updated_at: "2026-09-13T08:00:00Z",
  created_by: "transport-user",
  requester_name: "María Transporte",
  items: [{ id: "transport-item", transport_type: "trailer", leftover_space_meters: null }],
  events: [],
  legacy_completion_eligible: true,
};

const plannedRequest: TransportRequestRecord = {
  ...pendingRequest,
  id: "transport-request-planned",
  job_id: "transport-job-planned",
  job_title: "Festival con transporte planificado",
  planning_status: "planned",
  legacy_completion_eligible: false,
  events: [{
    id: "transport-event-load",
    event_type: "load",
    event_date: "2026-09-14",
    event_time: "09:15:00",
    transport_provider: null,
    license_plate: "1234 TST",
    loading_bay: "Muelle 2",
    notes: null,
  }],
};

async function bootstrapTransport(page: Page, role: "admin" | "management" | "house_tech" | "technician", department = "sound") {
  // Fix the calendar date without freezing timers used by auth and query loading.
  await page.clock.setFixedTime(new Date("2026-09-14T10:00:00Z"));
  let legacyCompleted = false;
  return bootstrapApp(page, {
    auth: { userId: "transport-user", role, department },
    tables: {
      profiles: [{
        id: "transport-user",
        first_name: "María",
        last_name: "Transporte",
        role,
        department,
        selected_job_statuses: ["Confirmado", "Tentativa"],
      }],
      logistics_events: [{
        ...plannedRequest.events[0],
        job_id: plannedRequest.job_id,
        job: { id: plannedRequest.job_id, title: "Carga del festival en calendario" },
        transport_type: "trailer",
        departments: [{ department: "sound" }],
        notes: "Acceso por puerta norte",
      }],
    },
    rpc: {
      list_transport_requests: () => legacyCompleted ? [plannedRequest] : [pendingRequest, plannedRequest],
      complete_legacy_transport_request: () => { legacyCompleted = true; return null; },
    },
  });
}

const mutationButtons = /^(Crear solicitud|Nueva solicitud|Editar solicitud|Revisar|Volver a revisión|Planificar|Editar planificación|Cancelar|Completar|Añadir evento|Guardar|Eliminar)/;
const transportMutationRpcs = new Set([
  "save_transport_request",
  "schedule_transport_request",
  "set_transport_request_stage",
  "complete_legacy_transport_request",
]);

test.describe("Logistics transport permissions and planning", () => {
  test("only admins can close eligible legacy demand without an execution plan", async ({ page }) => {
    const calls = await bootstrapTransport(page, "admin");
    await page.goto("/logistics");
    const closeLegacy = page.getByRole("button", { name: "Completar solicitud antigua", exact: true });
    await expect(closeLegacy).toHaveCount(1);
    await closeLegacy.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText(/Los eventos existentes se conservarán/)).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Confirmar cierre" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Motivo del cierre").fill("   ");
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("button", { name: "Volver", exact: true }).click();
    expect(calls.rpcCalls.filter((call) => call.name === "complete_legacy_transport_request")).toEqual([]);

    await closeLegacy.click();
    await dialog.getByLabel("Motivo del cierre").fill("  Transporte realizado antes del nuevo flujo  ");
    await confirm.click();
    await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "complete_legacy_transport_request")).toEqual([{
      name: "complete_legacy_transport_request", method: "POST",
      body: { p_request_id: pendingRequest.id, p_reason: "Transporte realizado antes del nuevo flujo" },
    }]);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(pendingRequest.job_title, { exact: true })).toHaveCount(0);
    await expect(page.getByText(plannedRequest.job_title, { exact: true })).toBeVisible();
  });

  for (const department of ["sound", "logistics"]) {
    test(`management in ${department} keeps normal completion without the legacy override`, async ({ page }) => {
      await bootstrapTransport(page, "management", department);
      await page.goto("/logistics");
      await expect(page.getByText(pendingRequest.job_title, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Completar solicitud antigua", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Completar", exact: true })).toBeVisible();
    });
  }

  test("house technicians can read populated requests and calendar without mutation controls", async ({ page }) => {
    const calls = await bootstrapTransport(page, "house_tech");
    // A management creation link must remain read-only when opened by a house technician.
    await page.goto(`/logistics?jobId=${pendingRequest.job_id}&department=sound`);

    await expect(page.getByRole("heading", { name: "Solicitudes de transporte" })).toBeVisible();
    await expect(page.getByText(pendingRequest.job_title, { exact: true })).toBeVisible();
    await expect(page.getByText(plannedRequest.job_title, { exact: true })).toBeVisible();
    await expect(page.getByText("Solo lectura", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: mutationButtons })).toHaveCount(0);

    await page.getByRole("tab", { name: "Calendario" }).click();
    await expect(page.getByRole("heading", {
      name: isMobileViewport(page) ? "Agenda móvil" : "Calendario de logística",
    })).toBeVisible();
    const eventTitle = page.getByText("Carga del festival en calendario", { exact: true });
    await expect(eventTitle.first()).toBeVisible();
    await expect(page.getByRole("button", { name: mutationButtons })).toHaveCount(0);
    await eventTitle.first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Desktop also renders the selected day's detailed event card.
    if (!isMobileViewport(page)) {
      await page.getByRole("heading", { name: "Carga del festival en calendario" }).last().click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    expect(calls.rpcCalls.filter((call) => transportMutationRpcs.has(call.name))).toEqual([]);
    expect(calls.tableMutations.filter((call) => call.table.startsWith("logistics_"))).toEqual([]);
  });

  for (const role of ["admin", "management"] as const) {
    test(`${role} can plan the selected request with distinct load and unload dates`, async ({ page }) => {
      const calls = await bootstrapTransport(page, role);
      await page.goto("/logistics");

      await expect(page.getByText(pendingRequest.job_title, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Editar solicitud", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Completar", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Editar planificación", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Planificar", exact: true }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(pendingRequest.job_title, { exact: true })).toBeVisible();
      // 22:30 UTC is already the next day in the job's Europe/Madrid timezone.
      await expect(dialog.getByLabel("Carga · fecha", { exact: true })).toHaveValue("2026-09-15");
      await dialog.getByLabel("Carga · fecha", { exact: true }).fill("2026-09-15");
      await dialog.getByLabel("Carga · hora", { exact: true }).fill("23:45");
      await dialog.getByLabel("Descarga · fecha", { exact: true }).fill("2026-09-15");
      await dialog.getByLabel("Descarga · hora", { exact: true }).fill("01:15");
      await dialog.getByRole("combobox", { name: "Proveedor" }).click();
      await page.getByRole("option", { name: "Recogida Cliente", exact: true }).click();
      await dialog.getByLabel("Matrícula / identificador").fill("5678 E2E");
      await dialog.getByLabel("Muelle / punto de carga").fill("Muelle 3");
      await dialog.getByLabel("Notas operativas").fill("Descarga después de medianoche");
      await dialog.getByRole("button", { name: "Guardar planificación", exact: true }).click();

      await expect(dialog.getByText("La descarga no puede ser anterior a la carga", { exact: true })).toBeVisible();
      expect(calls.rpcCalls.filter((call) => call.name === "schedule_transport_request")).toEqual([]);
      await dialog.getByLabel("Descarga · fecha", { exact: true }).fill("2026-09-16");
      await dialog.getByRole("button", { name: "Guardar planificación", exact: true }).click();

      await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "schedule_transport_request")).toEqual([{
        name: "schedule_transport_request",
        method: "POST",
        body: {
          p_request_id: pendingRequest.id,
          p_load_date: "2026-09-15",
          p_load_time: "23:45",
          p_unload_date: "2026-09-16",
          p_unload_time: "01:15",
          p_provider: "recogida_cliente",
          p_license_plate: "5678 E2E",
          p_loading_bay: "Muelle 3",
          p_notes: "Descarga después de medianoche",
        },
      }]);
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText("Transporte planificado", { exact: true }).first()).toBeVisible();
      await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "list_transport_requests").length).toBeGreaterThan(1);
    });
  }

  test("technicians are redirected away from a Logistics creation link", async ({ page }) => {
    const calls = await bootstrapTransport(page, "technician");
    await page.goto(`/logistics?jobId=${pendingRequest.job_id}&department=sound`);

    await expect(page).toHaveURL(/\/tech-app(?:\?|$)/);
    await expect(page.getByRole("heading", { name: "Solicitudes de transporte" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Crear solicitud" })).toHaveCount(0);
    expect(calls.rpcCalls.filter((call) => transportMutationRpcs.has(call.name))).toEqual([]);
  });

  test("returning a plan to review requires confirmation and targets that request", async ({ page }) => {
    const calls = await bootstrapTransport(page, "management");
    await page.goto("/logistics");
    await page.getByRole("button", { name: "Volver a revisión", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText(/Se retirarán todos los movimientos/)).toBeVisible();
    await dialog.getByRole("button", { name: "Volver", exact: true }).click();
    expect(calls.rpcCalls.filter((call) => call.name === "set_transport_request_stage")).toEqual([]);

    await page.getByRole("button", { name: "Volver a revisión", exact: true }).click();
    await dialog.getByRole("button", { name: "Retirar planificación" }).click();
    await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "set_transport_request_stage")).toEqual([{
      name: "set_transport_request_stage", method: "POST",
      body: { p_request_id: plannedRequest.id, p_stage: "reviewing" },
    }]);
  });
});
