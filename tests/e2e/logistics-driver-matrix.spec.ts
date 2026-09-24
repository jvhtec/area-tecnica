import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

// get_logistics_matrix / get_my_transport_assignments payloads for a fixed week:
// Ana has two overlapping Liceu runs on Wednesday, Beto declined the van pickup.
const matrix = {
  drivers: [
    { id: "d1", first_name: "Ana", last_name: "Conductora", nickname: null, department: "logistics", license_categories: ["B", "C", "C+E"], license_expiry: "2030-01-01", cap_expiry: "2026-01-01", adr_certified: true, default_vehicle_id: "v1", notes: null },
    { id: "d2", first_name: "Beto", last_name: "Ruedas", nickname: null, department: "logistics", license_categories: ["B"], license_expiry: null, cap_expiry: null, adr_certified: false, default_vehicle_id: null, notes: null },
  ],
  vehicles: [
    { id: "v1", name: "Tráiler 1", license_plate: "1234 ABC", vehicle_type: "trailer", required_license: "C+E", brand: "Volvo", model: "FH", payload_kg: 24000, cargo_length_m: 13.6, notes: null, is_active: true },
    { id: "v2", name: "Furgoneta 1", license_plate: "5678 DEF", vehicle_type: "furgoneta", required_license: "B", brand: null, model: null, payload_kg: null, cargo_length_m: null, notes: null, is_active: true },
  ],
  events: [
    { id: "e1", event_type: "load", transport_type: "trailer", event_date: "2026-09-30", event_time: "08:00:00", timezone: "Europe/Madrid", title: null, color: null, job_id: "j1", job_title: "Gala Liceu", license_plate: null, transport_provider: null, loading_bay: "Muelle 2", notes: null, transport_request_id: null, origin: "Almacén", destination: "Liceu", location_name: "Liceu", departments: ["sound"] },
    { id: "e2", event_type: "unload", transport_type: "trailer", event_date: "2026-09-30", event_time: "09:00:00", timezone: "Europe/Madrid", title: null, color: null, job_id: "j1", job_title: "Gala Liceu", license_plate: null, transport_provider: null, loading_bay: null, notes: null, transport_request_id: null, origin: null, destination: null, location_name: "Liceu", departments: ["sound"] },
    { id: "e3", event_type: "load", transport_type: "furgoneta", event_date: "2026-09-30", event_time: "16:00:00", timezone: "Europe/Madrid", title: "Recogida subalquiler", color: null, job_id: null, job_title: null, license_plate: null, transport_provider: null, loading_bay: null, notes: null, transport_request_id: null, origin: null, destination: null, location_name: null, departments: ["lights"] },
    { id: "e4", event_type: "load", transport_type: "trailer", event_date: "2026-10-02", event_time: "07:00:00", timezone: "Europe/Madrid", title: null, color: null, job_id: "j2", job_title: "Festival Norte", license_plate: null, transport_provider: null, loading_bay: null, notes: null, transport_request_id: null, origin: null, destination: null, location_name: null, departments: [] },
  ],
  assignments: [
    { id: "a1", logistics_event_id: "e1", driver_id: "d1", vehicle_id: "v1", starts_at: "2026-09-30T06:00:00Z", ends_at: "2026-09-30T08:00:00Z", status: "confirmed", notes: null, responded_at: null },
    { id: "a2", logistics_event_id: "e2", driver_id: "d1", vehicle_id: "v1", starts_at: "2026-09-30T07:00:00Z", ends_at: "2026-09-30T09:00:00Z", status: "assigned", notes: null, responded_at: null },
    { id: "a3", logistics_event_id: "e3", driver_id: "d2", vehicle_id: "v2", starts_at: "2026-09-30T14:00:00Z", ends_at: "2026-09-30T16:00:00Z", status: "declined", notes: null, responded_at: null },
  ],
};

const mine = [
  { id: "a2", status: "assigned", starts_at: "2026-09-30T13:00:00Z", ends_at: "2026-09-30T15:00:00Z", notes: "Llaves en recepción", responded_at: null, event_id: "e2", event_type: "unload", transport_type: "trailer", event_date: "2026-09-30", event_time: "15:00:00", title: null, job_title: "Gala Liceu", loading_bay: "Muelle 2", event_notes: "Acceso por puerta norte", origin: "Almacén Sector Pro", destination: "Gran Teatre del Liceu", location_name: "Liceu", location_address: "La Rambla 51, Barcelona", vehicle: { id: "v1", name: "Tráiler 1", license_plate: "1234 ABC", vehicle_type: "trailer" } },
  { id: "a4", status: "confirmed", starts_at: "2026-10-02T05:00:00Z", ends_at: "2026-10-02T09:00:00Z", notes: null, responded_at: null, event_id: "e4", event_type: "load", transport_type: "trailer", event_date: "2026-10-02", event_time: "07:00:00", title: null, job_title: "Festival Norte", loading_bay: null, event_notes: null, origin: null, destination: null, location_name: null, location_address: null, vehicle: null },
];


async function bootstrapManagement(page: Page) {
  await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
  return bootstrapApp(page, {
    auth: { userId: "mgr", role: "management", department: "logistics" },
    tables: {
      profiles: [{ id: "mgr", first_name: "Marta", last_name: "Log", role: "management", department: "logistics" }],
      logistics_events: [],
    },
    rpc: { get_logistics_matrix: matrix, list_transport_requests: [] },
  });
}

test.describe("Logistics driver matrix", () => {
  test("shows several transports per driver and day, and flags uncovered ones", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/logistics?tab=drivers");

    await expect(page.getByRole("tab", { name: "Conductores" })).toHaveAttribute("aria-selected", "true");
    const wednesday = page.getByRole("button", { name: /Ana Conductora, miércoles 30 de septiembre: 2 asignaciones/ });
    await expect(wednesday).toBeVisible();
    await expect(page.getByText("1 sin conductor").first()).toBeVisible();

    await wednesday.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Recogida subalquiler", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Asignar" }).last().click();
    await expect(dialog.getByLabel("Conductor", { exact: true })).toContainText("Ana Conductora");
    // Her usual trailer is not offered for a van transport.
    await expect(dialog.getByLabel("Vehículo", { exact: true })).toContainText("Sin vehículo propio");
    await expect(dialog.getByText("El CAP estará caducado ese día")).toHaveCount(0);
  });

  test("lists the fleet and driver documentation", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/logistics?tab=fleet");

    await expect(page.getByText("Tráiler 1").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir vehículo" })).toBeVisible();
    await expect(page.getByText("CAP caducado")).toBeVisible();
  });

  test("keeps house technicians read-only", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
    await bootstrapApp(page, {
      auth: { userId: "house", role: "house_tech", department: "sound" },
      tables: { profiles: [{ id: "house", first_name: "Hugo", role: "house_tech", department: "sound" }], logistics_events: [] },
      rpc: { get_logistics_matrix: matrix, list_transport_requests: [] },
    });
    await page.goto("/logistics?tab=fleet");
    await expect(page.getByText("Tráiler 1").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir vehículo" })).toHaveCount(0);
  });
});

test.describe("Conductor dashboard", () => {
  test("lands drivers on their own transports and lets them confirm", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
    const calls = await bootstrapApp(page, {
      auth: { userId: "d1", role: "conductor", department: "logistics" },
      tables: {
        profiles: [{ id: "d1", first_name: "Ana", last_name: "Conductora", role: "conductor", department: "logistics" }],
        driver_details: [],
      },
      rpc: {
        get_my_transport_assignments: mine,
        respond_transport_assignment: { assignment_id: "a2", status: "confirmed", logistics_event_id: "e2" },
      },
    });
    // Any other page sends a driver back to their transports.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/conductor$/);
    await expect(page.getByRole("heading", { name: "Mis transportes" })).toBeVisible();
    await expect(page.getByText("Descarga · Gala Liceu")).toBeVisible();
    await expect(page.getByText("Tráiler 1 · 1234 ABC")).toBeVisible();

    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "respond_transport_assignment").length).toBe(1);

    if (!isMobileViewport(page)) {
      await expect(page.getByRole("link", { name: "Matriz de asignaciones" })).toHaveCount(0);
    }
  });
});
