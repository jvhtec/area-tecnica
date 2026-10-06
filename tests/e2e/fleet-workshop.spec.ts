import { expect, test } from "@playwright/test";
import { bootstrapApp } from "./support/app";

const vehicleId = "fa220000-0000-0000-0000-000000000001";
const vehicle = { id: vehicleId, name: "Autobús 1", license_plate: "1234 BUS", vehicle_type: "sleeper_bus", required_license: "D", is_active: true };
const appointment = { id: "fa440000-0000-0000-0000-000000000001", vehicle_id: vehicleId, starts_at: "2026-09-29T07:00:00Z", ends_at: "2026-09-29T09:00:00Z", workshop: "Taller Norte", reason: "Revisión", notes: null, mileage_km: 12345, status: "scheduled", updated_at: "2026-09-01T09:00:00Z" };

test("el calendario individual separa las citas y guarda en el vehículo seleccionado", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-29T06:00:00Z"));
  const secondVehicle = { ...vehicle, id: "fa220000-0000-0000-0000-000000000002", name: "Furgoneta 2", license_plate: "5678 VAN" };
  let saved: Record<string, unknown> | null = null;
  await bootstrapApp(page, {
    auth: { userId: "mgr", role: "management", department: "logistics" },
    rpc: {
      get_logistics_matrix: { drivers: [], vehicles: [vehicle, secondVehicle], events: [], assignments: [] },
      list_fleet_workshop_appointments: () => [appointment, ...(saved ? [{ ...appointment, id: "fa440000-0000-0000-0000-000000000002", vehicle_id: secondVehicle.id, reason: "ITV" }] : [])],
      save_fleet_workshop_appointment: ({ body }) => { saved = body as Record<string, unknown>; return appointment.id; },
    },
  });
  await page.goto("/logistics?tab=fleet");
  await page.getByRole("button", { name: "Calendario de Furgoneta 2", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Calendario de Furgoneta 2", exact: true });
  await expect(calendar.getByRole("button", { name: /09:00 · Revisión/ })).toHaveCount(0);
  await calendar.getByRole("button", { name: "Añadir cita para Furgoneta 2 el 2026-09-29", exact: true }).click();
  await expect(page.locator("#workshop-vehicle")).toContainText("Furgoneta 2");
  await page.getByLabel("Taller", { exact: true }).fill("Taller Sur");
  await page.getByLabel("Motivo", { exact: true }).fill("ITV");
  await page.getByRole("button", { name: "Guardar cita" }).click();
  await expect(calendar.getByRole("button", { name: /09:00 · ITV/ })).toBeVisible();
  expect(saved).toMatchObject({ p_vehicle_id: secondVehicle.id, p_workshop: "Taller Sur", p_reason: "ITV" });
});

test("el calendario individual de consulta no permite añadir citas", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-29T06:00:00Z"));
  await bootstrapApp(page, {
    auth: { userId: "reader", role: "house_tech", department: "sound" },
    rpc: { get_logistics_matrix: { drivers: [], vehicles: [vehicle], events: [], assignments: [] }, list_fleet_workshop_appointments: [appointment] },
  });
  await page.goto("/logistics?tab=fleet");
  await page.getByRole("button", { name: "Calendario de Autobús 1", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Calendario de Autobús 1", exact: true });
  await expect(calendar.getByRole("button", { name: "Nueva cita", exact: true })).toHaveCount(0);
  await expect(calendar.getByRole("button", { name: /^Añadir cita/ })).toHaveCount(0);
  await calendar.getByRole("button", { name: /09:00 · Revisión/ }).click();
  await expect(page.getByLabel("Taller", { exact: true })).toBeDisabled();
});

test("gestión crea una cita y la ve en el cuadrante de flota", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-29T06:00:00Z"));
  let saved: Record<string, unknown> | null = null;
  await bootstrapApp(page, {
    auth: { userId: "mgr", role: "management", department: "logistics" },
    rpc: {
      get_logistics_matrix: { drivers: [], vehicles: [vehicle], events: [], assignments: [] },
      list_fleet_workshop_appointments: () => saved ? [appointment] : [],
      save_fleet_workshop_appointment: ({ body }) => { saved = body as Record<string, unknown>; return appointment.id; },
    },
  });
  await page.goto("/logistics?tab=fleet");
  await page.getByRole("button", { name: "Nueva cita", exact: true }).click();
  await page.getByLabel("Taller", { exact: true }).fill("Taller Norte");
  await page.getByLabel("Motivo", { exact: true }).fill("Revisión");
  await page.getByLabel("Kilometraje (opcional)").fill("12345");
  await page.getByRole("button", { name: "Guardar cita" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: /09:00 · Revisión/ })).toBeVisible();
  expect(saved).toMatchObject({ p_vehicle_id: vehicleId, p_starts_at: "2026-09-29T07:00:00.000Z", p_ends_at: "2026-09-29T09:00:00.000Z", p_workshop: "Taller Norte", p_status: "scheduled", p_mileage_km: 12345 });
});

test("consulta puede abrir una cita pero no modificarla", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-29T06:00:00Z"));
  await bootstrapApp(page, {
    auth: { userId: "reader", role: "house_tech", department: "sound" },
    rpc: { get_logistics_matrix: { drivers: [], vehicles: [vehicle], events: [], assignments: [] }, list_fleet_workshop_appointments: [appointment] },
  });
  await page.goto("/logistics?tab=fleet");
  await expect(page.getByRole("button", { name: "Nueva cita", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /09:00 · Revisión/ }).click();
  await expect(page.getByLabel("Taller", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Guardar cita" })).toHaveCount(0);
});

test("un conflicto mantiene el formulario y sus datos", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-29T06:00:00Z"));
  await bootstrapApp(page, {
    auth: { userId: "mgr", role: "management", department: "logistics" },
    rpc: { get_logistics_matrix: { drivers: [], vehicles: [vehicle], events: [], assignments: [] }, list_fleet_workshop_appointments: [] },
  });
  await page.route("**/rest/v1/rpc/save_fleet_workshop_appointment", (route) => route.fulfill({
    status: 409, contentType: "application/json", body: JSON.stringify({ code: "23P01", message: "El vehículo tiene un transporte asignado en ese horario." }),
  }));
  await page.goto("/logistics?tab=fleet");
  await page.getByRole("button", { name: "Nueva cita", exact: true }).click();
  await page.getByLabel("Taller", { exact: true }).fill("Taller Norte");
  await page.getByLabel("Motivo", { exact: true }).fill("Revisión");
  await page.getByRole("button", { name: "Guardar cita" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("transporte asignado");
  await expect(page.getByLabel("Taller", { exact: true })).toHaveValue("Taller Norte");
});

test("permite cancelar una cita sin borrar su historial", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-29T06:00:00Z"));
  let status = "scheduled";
  await bootstrapApp(page, {
    auth: { userId: "mgr", role: "management", department: "logistics" },
    rpc: {
      get_logistics_matrix: { drivers: [], vehicles: [vehicle], events: [], assignments: [] },
      list_fleet_workshop_appointments: () => [{ ...appointment, status }],
      save_fleet_workshop_appointment: ({ body }) => { status = (body as { p_status: string }).p_status; return appointment.id; },
    },
  });
  await page.goto("/logistics?tab=fleet");
  await page.getByRole("button", { name: /09:00 · Revisión/ }).click();
  await page.getByRole("dialog").getByLabel("Estado", { exact: true }).click();
  await page.getByRole("option", { name: "Cancelada", exact: true }).click();
  await page.getByRole("button", { name: "Guardar cita" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: /09:00 · Revisión/ })).toContainText("Cancelada");
  expect(status).toBe("cancelled");
});
