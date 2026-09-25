import { expect, test, type Page } from "@playwright/test";

import { bootstrapApp, isMobileViewport } from "./support/app";

// get_logistics_matrix / get_my_transport_assignments payloads for a fixed week:
// Ana has two overlapping Liceu runs on Wednesday, Beto declined the van pickup.
const matrix = {
  drivers: [
    { id: "d1", first_name: "Ana", last_name: "Conductora", nickname: null, department: "logistics", phone: "600 111 222", license_categories: ["B", "C", "C+E"], license_expiry: "2030-01-01", cap_expiry: "2026-01-01", tachograph_card_expiry: "2030-01-01", adr_certified: true, default_vehicle_id: "v1", notes: null, unavailable_days: [] },
    // Beto is on holiday on Thursday.
    { id: "d2", first_name: "Beto", last_name: "Ruedas", nickname: null, department: "logistics", phone: null, license_categories: ["B"], license_expiry: null, cap_expiry: null, tachograph_card_expiry: null, adr_certified: false, default_vehicle_id: null, notes: null, unavailable_days: [{ date: "2026-10-01", status: "vacation" }] },
  ],
  vehicles: [
    { id: "v1", name: "Tráiler 1", license_plate: "1234 ABC", vehicle_type: "trailer", required_license: "C+E", brand: "Volvo", model: "FH", payload_kg: 24000, cargo_length_m: 13.6, has_tail_lift: true, itv_expiry: "2030-01-01", insurance_expiry: "2030-01-01", notes: null, is_active: true },
    // The van's ITV ran out before the fixed clock below.
    { id: "v2", name: "Furgoneta 1", license_plate: "5678 DEF", vehicle_type: "furgoneta", required_license: "B", brand: null, model: null, payload_kg: null, cargo_length_m: null, has_tail_lift: false, itv_expiry: "2026-09-01", insurance_expiry: null, notes: null, is_active: true },
    { id: "v3", name: "Nightliner 1", license_plate: "9999 BUS", vehicle_type: "sleeper_bus", required_license: "D", brand: "Setra", model: "S 516 HD", payload_kg: null, cargo_length_m: null, has_tail_lift: false, itv_expiry: "2030-01-01", insurance_expiry: "2030-01-01", notes: null, is_active: true, berth_layouts: [18, 20] },
    { id: "v4", name: "Nightliner 2", license_plate: "8888 BUS", vehicle_type: "sleeper_bus", required_license: "D", brand: null, model: null, payload_kg: null, cargo_length_m: null, has_tail_lift: false, itv_expiry: "2030-01-01", insurance_expiry: "2030-01-01", notes: null, is_active: true, berth_layouts: [14] },
  ],
  events: [
    { id: "e1", event_type: "load", transport_type: "trailer", event_date: "2026-09-30", event_time: "08:00:00", timezone: "Europe/Madrid", title: null, color: null, job_id: "j1", job_title: "Gala Liceu", license_plate: null, transport_provider: null, loading_bay: "Muelle 2", notes: null, transport_request_id: null, origin: "Almacén", destination: "Liceu", location_name: "Liceu", location_address: "La Rambla 51, Barcelona", departments: ["sound"] },
    { id: "e2", event_type: "unload", transport_type: "trailer", event_date: "2026-09-30", event_time: "09:00:00", timezone: "Europe/Madrid", title: null, color: null, job_id: "j1", job_title: "Gala Liceu", license_plate: null, transport_provider: null, loading_bay: null, notes: null, transport_request_id: null, origin: null, destination: null, location_name: "Liceu", location_address: "La Rambla 51, Barcelona", departments: ["sound"] },
    { id: "e3", event_type: "load", transport_type: "furgoneta", event_date: "2026-09-30", event_time: "16:00:00", timezone: "Europe/Madrid", title: "Recogida subalquiler", color: null, job_id: null, job_title: null, license_plate: null, transport_provider: null, loading_bay: null, notes: null, transport_request_id: null, origin: null, destination: null, location_name: null, location_address: null, departments: ["lights"] },
    { id: "e4", event_type: "load", transport_type: "trailer", event_date: "2026-10-02", event_time: "07:00:00", timezone: "Europe/Madrid", title: null, color: null, job_id: "j2", job_title: "Festival Norte", license_plate: null, transport_provider: null, loading_bay: null, notes: null, transport_request_id: null, origin: null, destination: null, location_name: null, location_address: null, departments: [] },
  ],
  assignments: [
    { id: "a1", logistics_event_id: "e1", driver_id: "d1", vehicle_id: "v1", starts_at: "2026-09-30T06:00:00Z", ends_at: "2026-09-30T08:00:00Z", status: "confirmed", notes: null, responded_at: null, decline_reason: null },
    { id: "a2", logistics_event_id: "e2", driver_id: "d1", vehicle_id: "v1", starts_at: "2026-09-30T07:00:00Z", ends_at: "2026-09-30T09:00:00Z", status: "assigned", notes: null, responded_at: null, decline_reason: null },
    { id: "a3", logistics_event_id: "e3", driver_id: "d2", vehicle_id: "v2", starts_at: "2026-09-30T14:00:00Z", ends_at: "2026-09-30T16:00:00Z", status: "declined", notes: null, responded_at: null, decline_reason: "Tengo otro servicio" },
  ],
};

const mine = [
  { id: "a2", status: "assigned", starts_at: "2026-09-30T13:00:00Z", ends_at: "2026-09-30T15:00:00Z", notes: "Llaves en recepción", responded_at: null, decline_reason: null, event_id: "e2", event_type: "unload", transport_type: "trailer", event_date: "2026-09-30", event_time: "15:00:00", title: null, job_id: "j1", job_title: "Gala Liceu", loading_bay: "Muelle 2", event_notes: "Acceso por puerta norte", origin: "Almacén Sector Pro", destination: "Gran Teatre del Liceu", location_name: "Liceu", location_address: "La Rambla 51, Barcelona", location_lat: 41.38, location_lng: 2.17, vehicle: { id: "v1", name: "Tráiler 1", license_plate: "1234 ABC", vehicle_type: "trailer", has_tail_lift: true } },
  { id: "a4", status: "confirmed", starts_at: "2026-10-02T05:00:00Z", ends_at: "2026-10-02T09:00:00Z", notes: null, responded_at: null, decline_reason: null, event_id: "e4", event_type: "load", transport_type: "trailer", event_date: "2026-10-02", event_time: "07:00:00", title: null, job_id: null, job_title: "Festival Norte", loading_bay: null, event_notes: null, origin: null, destination: null, location_name: null, location_address: null, location_lat: null, location_lng: null, vehicle: null },
  // Finished yesterday: only shown under "Transportes anteriores".
  { id: "a0", status: "confirmed", starts_at: "2026-09-29T06:00:00Z", ends_at: "2026-09-29T08:00:00Z", notes: null, responded_at: null, decline_reason: null, event_id: "e0", event_type: "load", transport_type: "furgoneta", event_date: "2026-09-29", event_time: "08:00:00", title: "Recogida ayer", job_id: null, job_title: null, loading_bay: null, event_notes: null, origin: null, destination: null, location_name: null, location_address: null, location_lat: null, location_lng: null, vehicle: null },
];

// A 1×1 PNG standing in for the Mapbox tile the static-map function returns.
const mapTile = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" };
const producers = [{ job_id: "j1", producer_id: "p1", display_name: "Olga Producción", phone: "600 333 444", email: null }];

// Two shared positions at the fixed clock (08:00Z): Ana live, Beto silent for an hour.
const liveLocations = [
  { driver_id: "d1", first_name: "Ana", last_name: "Conductora", nickname: null, latitude: 41.39, longitude: 2.16, accuracy_m: 12, heading_deg: 90, speed_mps: 13.9, recorded_at: "2026-09-30T07:59:30Z", assignment: { id: "a2", status: "confirmed", starts_at: "2026-09-30T13:00:00Z", ends_at: "2026-09-30T15:00:00Z", event_type: "unload", title: "Gala Liceu", timezone: "Europe/Madrid", vehicle_name: "Tráiler 1", vehicle_plate: "1234 ABC", destination_name: "Liceu", destination_lat: 41.38, destination_lng: 2.17 } },
  { driver_id: "d2", first_name: "Beto", last_name: "Ruedas", nickname: null, latitude: 40.42, longitude: -3.7, accuracy_m: 30, heading_deg: null, speed_mps: null, recorded_at: "2026-09-30T07:00:00Z", assignment: null },
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

  test("shows days off, decline reasons and a dispatch contact for managers", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/logistics?tab=drivers");

    // One transport is still waiting for Ana's answer within the next 48 h.
    await expect(page.getByText("1 sin confirmar en 48 h")).toBeVisible();

    const thursday = page.getByRole("button", { name: /Beto Ruedas, jueves 1 de octubre: 0 asignaciones, vacaciones/ });
    await expect(thursday).toBeVisible();
    await expect(thursday).toContainText("Vacaciones");

    await page.getByRole("button", { name: /Beto Ruedas, miércoles 30 de septiembre: 1 asignaciones/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Motivo: Tengo otro servicio")).toBeVisible();
    // Beto has no phone on record; Ana does.
    await expect(dialog.getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /Ana Conductora, miércoles 30 de septiembre/ }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/34600111222/);
    await expect(page.getByRole("dialog").getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+34600111222");
  });

  test("lists the fleet and driver documentation", async ({ page }) => {
    await bootstrapManagement(page);
    await page.goto("/logistics?tab=fleet");

    await expect(page.getByText("Tráiler 1").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Añadir vehículo" })).toBeVisible();
    await expect(page.getByText("CAP caducado")).toBeVisible();
    await expect(page.getByText("ITV caducado")).toBeVisible();
    await expect(page.getByText("Plataforma", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Editar Furgoneta 1" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Caducidad de la ITV")).toHaveValue("2026-09-01");
    await expect(dialog.getByLabel("Plataforma elevadora")).not.toBeChecked();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // The company's sleeper buses are fleet vehicles too, and need a D licence.
    await expect(page.getByText("Autobús cama · Permiso D · Setra S 516 HD · 18 / 20 literas")).toBeVisible();
    await page.getByRole("button", { name: "Añadir vehículo" }).click();
    const form = page.getByRole("dialog");
    await expect(form.getByLabel("Permiso necesario")).toHaveText("B");
    await form.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Autobús cama" }).click();
    await expect(form.getByLabel("Permiso necesario")).toHaveText("D");
    await expect(form.getByLabel("Literas")).toBeVisible();
  });

  test("suggests sleeper buses for the job crew and records a hired one", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
    // 20 people on the job: 17 confirmed, 2 invited and one who declined.
    const crew = Array.from({ length: 20 }, (_, index) => ({
      technician_id: `t${index}`,
      external_technician_name: null,
      status: index < 17 ? "confirmed" : index < 19 ? "invited" : "declined",
    }));
    const busRun = {
      id: "bus-run", event_type: "load", transport_type: "sleeper_bus", event_date: "2026-09-30", event_time: "23:00:00",
      timezone: "Europe/Madrid", title: null, color: null, job_id: "j9", license_plate: null, transport_provider: null,
      berth_count: null, loading_bay: null, notes: null, is_hoja_relevant: true, hoja_categories: [], location_id: null,
      job: { title: "Gira Norte" }, departments: [],
    };
    const calls = await bootstrapApp(page, {
      auth: { userId: "mgr", role: "management", department: "logistics" },
      tables: {
        profiles: [{ id: "mgr", first_name: "Marta", last_name: "Log", role: "management", department: "logistics" }],
        logistics_events: [busRun],
        jobs: [{ id: "j9", title: "Gira Norte", start_time: "2026-09-30T18:00:00Z", status: "Confirmado", job_type: "single" }],
        job_assignments: crew,
      },
      rpc: { get_logistics_matrix: matrix, list_transport_requests: [] },
    });
    await page.goto("/logistics?tab=calendar");

    await page.getByText("Gira Norte").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Personal asignado:")).toContainText("19");
    await expect(dialog.getByText("(17 confirmados)")).toBeVisible();

    const suggestions = dialog.getByRole("list", { name: "Sugerencias de autobuses" }).getByRole("listitem");
    // Our 20-bed double-decker seats everyone; a hired 20-bed bus is the alternative.
    await expect(suggestions.first()).toContainText("Nightliner 1 (20)");
    await expect(suggestions.nth(1)).toContainText("Alquiler 20 literas");
    await expect(suggestions.nth(2)).toContainText("Nightliner 2 (14) + Alquiler 12 literas");

    await suggestions.first().getByRole("button", { name: "Usar Nightliner 1 (20)" }).click();
    await expect(dialog.getByLabel("Literas de este autobús")).toHaveValue("20");
    await expect(dialog.getByText("Todo el personal tiene litera.")).toBeVisible();

    // Hire the whole run from Montoya instead: a 16-berth bus leaves three short.
    await dialog.getByLabel("Personas extra (artistas, invitados…)").fill("0");
    await dialog.getByLabel("Literas de este autobús").fill("16");
    await dialog.getByLabel("Empresa de transporte").click();
    await page.getByRole("option", { name: "Montoya" }).click();
    await expect(dialog.getByText("Faltan 3 literas", { exact: false })).toBeVisible();

    await dialog.getByRole("button", { name: "Actualizar evento" }).click();
    await expect.poll(() => calls.tableMutations.find((mutation) => mutation.table === "logistics_events")?.body)
      .toMatchObject({ transport_type: "sleeper_bus", berth_count: 16, transport_provider: "montoya" });
  });

  test("plans a multi-day crew transfer with its pick-up point and passengers", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
    const crew = Array.from({ length: 7 }, (_, index) => ({ technician_id: `t${index}`, external_technician_name: null, status: "confirmed" }));
    const transfer = {
      id: "crew-run", event_type: "crew_transfer", transport_type: "furgoneta", event_date: "2026-09-30", event_time: "07:30:00",
      end_date: "2026-10-02", end_time: "20:00:00", timezone: "Europe/Madrid", title: null, color: null, job_id: "j9",
      license_plate: null, transport_provider: null, berth_count: null, loading_bay: null, notes: null, is_hoja_relevant: true,
      hoja_categories: [], location_id: "loc-venue", origin_location_id: "loc-nave", passenger_count: 5,
      job: { title: "Gira Norte" }, departments: [],
    };
    const calls = await bootstrapApp(page, {
      auth: { userId: "mgr", role: "management", department: "logistics" },
      tables: {
        profiles: [{ id: "mgr", first_name: "Marta", last_name: "Log", role: "management", department: "logistics" }],
        logistics_events: [transfer],
        // Looked up one by one (`id=eq.…` + maybeSingle), so honour the filter.
        locations: ({ url }) => [
          { id: "loc-nave", name: "Nave Sector Pro", formatted_address: "Calle Nave 1, Madrid" },
          { id: "loc-venue", name: "Recinto Norte", formatted_address: "Avenida Norte 2, Bilbao" },
        ].filter((row) => url.searchParams.get("id") === `eq.${row.id}`),
        jobs: [{ id: "j9", title: "Gira Norte", start_time: "2026-09-30T18:00:00Z", end_time: "2026-10-02T21:00:00Z", timezone: "Europe/Madrid", status: "Confirmado", job_type: "single", location_id: "loc-venue" }],
        job_assignments: crew,
      },
      rpc: { get_logistics_matrix: matrix, list_transport_requests: [] },
    });
    await page.goto("/logistics?tab=calendar");

    // A multi-day transfer is on every day it spans (30/09–02/10), not just its start
    // date: three month-grid cells plus the day panel on desktop. Mobile lists one day.
    await expect(page.getByText("30/09 07:30 → 02/10 20:00 · 5 personas")).toBeVisible();
    if (!isMobileViewport(page)) {
      await expect(page.getByText("Gira Norte")).toHaveCount(4, { timeout: 15_000 });
    }
    await page.getByRole("heading", { name: "Gira Norte" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Tipo de evento")).toContainText("Traslado de personal");
    await expect(dialog.getByLabel("Punto de encuentro (origen)")).toHaveValue("Nave Sector Pro");
    await expect(dialog.getByLabel("Destino (si no es el recinto del trabajo)")).toHaveValue("Recinto Norte");
    await expect(dialog.getByLabel("Muelle de carga")).toHaveCount(0);

    // Everyone on the job travels, and the van is taken for the job's span, plus a day.
    await dialog.getByRole("button", { name: "Todo el personal del trabajo (7)" }).click();
    await expect(dialog.getByLabel("Personas que viajan")).toHaveValue("7");
    await dialog.getByRole("button", { name: "Usar las fechas del trabajo (30/09 20:00 → 02/10 23:00)" }).click();
    await expect(dialog.getByLabel("Fecha de fin")).toHaveValue("2026-10-02");
    await expect(dialog.getByLabel("Hora de fin")).toHaveValue("23:00");
    await dialog.getByLabel("Fecha de fin").fill("2026-10-03");

    await dialog.getByRole("button", { name: "Actualizar evento" }).click();
    await expect.poll(() => calls.tableMutations.find((mutation) => mutation.table === "logistics_events")?.body)
      .toMatchObject({
        event_type: "crew_transfer",
        passenger_count: 7,
        event_date: "2026-09-30",
        event_time: "20:00",
        end_date: "2026-10-03",
        end_time: "23:00",
        origin_location_id: "loc-nave",
        location_id: "loc-venue",
      });
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

test.describe("Driver tracking", () => {
  test("lists shared positions with their age and flags silent drivers", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
    await bootstrapApp(page, {
      auth: { userId: "mgr", role: "management", department: "logistics" },
      tables: {
        profiles: [{ id: "mgr", first_name: "Marta", last_name: "Log", role: "management", department: "logistics" }],
        logistics_events: [],
      },
      rpc: { get_logistics_matrix: matrix, list_transport_requests: [], get_driver_locations: liveLocations },
      // No Mapbox token in the harness: the list must stand on its own.
      functions: { "get-mapbox-token": { token: null } },
    });
    await page.goto("/logistics?tab=tracking");

    await expect(page.getByRole("tab", { name: "Seguimiento" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("1 en directo")).toBeVisible();
    await expect(page.getByText("1 sin señal")).toBeVisible();
    const list = page.getByRole("list", { name: "Conductores compartiendo ubicación" });
    await expect(list.getByText("Ana Conductora")).toBeVisible();
    await expect(list.getByText(/Gala Liceu · 15:00–17:00 · Tráiler 1/)).toBeVisible();
    await expect(list.getByText(/ahora mismo · 50 km\/h/)).toBeVisible();
    await expect(list.getByText(/Sin señal · hace 1 h/)).toBeVisible();
    await expect(page.getByText("El mapa no está disponible ahora mismo", { exact: false })).toBeVisible();
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
        get_job_producer_contacts: producers,
      },
      functions: { "static-map": mapTile },
    });
    // Any other page sends a driver back to their transports.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/conductor$/);
    await expect(page.getByRole("heading", { name: "Mis transportes" })).toBeVisible();
    await expect(page.getByText("Descarga · Gala Liceu")).toBeVisible();
    await expect(page.getByText("Tráiler 1 · 1234 ABC · Plataforma")).toBeVisible();

    // The next run: countdown from the fixed clock (08:00Z → 13:00Z), map tile, and
    // turn-by-turn links built from the venue coordinates.
    await expect(page.getByText("Empieza en 5 h")).toBeVisible();
    await expect(page.getByRole("img", { name: "Mapa de Liceu" })).toHaveAttribute("src", /^data:image\/png/);
    await expect(page.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute("href", /destination=41\.38%2C2\.17&travelmode=driving/);
    await expect(page.getByRole("link", { name: "Waze" })).toHaveAttribute("href", /waze\.com\/ul\?ll=41\.38%2C2\.17/);
    await expect(page.getByRole("link", { name: "Ruta completa" })).toHaveAttribute("href", /origin=Almac%C3%A9n%20Sector%20Pro/);
    // Job-backed transports show who to call on site.
    await expect(page.getByText("Responsable de producción")).toBeVisible();
    await expect(page.getByRole("link", { name: "Llamar a Olga Producción" })).toHaveAttribute("href", "tel:+34600333444");
    // Finished runs are tucked away until asked for.
    await expect(page.getByText("Recogida ayer")).toHaveCount(0);
    await page.getByRole("button", { name: /Transportes anteriores \(1\)/ }).click();
    await expect(page.getByText("Recogida ayer")).toBeVisible();

    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "respond_transport_assignment").length).toBe(1);

    if (!isMobileViewport(page)) {
      await expect(page.getByRole("link", { name: "Matriz de asignaciones" })).toHaveCount(0);
    }
  });

  test("sends drivers on a crew transfer to the pick-up point first", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
    const transfer = {
      ...mine[0], id: "a9", event_id: "e9", event_type: "crew_transfer", transport_type: "furgoneta", loading_bay: null,
      starts_at: "2026-09-30T10:00:00Z", ends_at: "2026-10-02T18:00:00Z", end_date: "2026-10-02", end_time: "20:00:00",
      passenger_count: 6, origin: "Calle Nave 1, Madrid", destination: "Liceu", notes: null, event_notes: null,
      pickup_name: "Nave Sector Pro", pickup_address: "Calle Nave 1, Madrid", pickup_lat: 40.4, pickup_lng: -3.7,
    };
    await bootstrapApp(page, {
      auth: { userId: "d1", role: "conductor", department: "logistics" },
      tables: {
        profiles: [{ id: "d1", first_name: "Ana", last_name: "Conductora", role: "conductor", department: "logistics" }],
        driver_details: [],
      },
      rpc: { get_my_transport_assignments: [transfer], get_job_producer_contacts: [] },
      functions: { "static-map": mapTile },
    });
    await page.goto("/conductor");

    await expect(page.getByText("Traslado de personal · Gala Liceu")).toBeVisible();
    await expect(page.getByText("Nave Sector Pro, Calle Nave 1, Madrid")).toBeVisible();
    await expect(page.getByRole("img", { name: "Mapa de Liceu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir al punto de encuentro" })).toHaveAttribute("href", /destination=40\.4%2C-3\.7/);
    await expect(page.getByRole("link", { name: "Cómo llegar al destino" })).toHaveAttribute("href", /destination=41\.38%2C2\.17/);
  });

  test("shares the driver's position only while a transport is close", async ({ page, context }) => {
    // 12:00Z: Ana's 13:00Z unload starts within the two-hour lead, so sharing kicks in.
    await page.clock.setFixedTime(new Date("2026-09-30T12:00:00Z"));
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 41.39, longitude: 2.16, accuracy: 12 });
    const calls = await bootstrapApp(page, {
      auth: { userId: "d1", role: "conductor", department: "logistics" },
      tables: {
        profiles: [{ id: "d1", first_name: "Ana", last_name: "Conductora", role: "conductor", department: "logistics" }],
        driver_details: [],
      },
      rpc: {
        get_my_transport_assignments: mine,
        get_job_producer_contacts: producers,
        report_driver_location: { driver_id: "d1", recorded_at: "2026-09-30T12:00:05Z" },
        stop_sharing_driver_location: { driver_id: "d1", stopped: true },
      },
      functions: { "static-map": mapTile },
    });
    await page.goto("/conductor");

    const toggle = page.getByRole("switch", { name: "Compartir mi ubicación con logística" });
    await expect(toggle).not.toBeChecked();
    await expect(page.getByText("Desactivado. Logística no ve tu posición.")).toBeVisible();

    await toggle.click();
    await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "report_driver_location").length).toBeGreaterThan(0);
    const report = calls.rpcCalls.find((call) => call.name === "report_driver_location");
    expect(report?.body).toMatchObject({ p_latitude: 41.39, p_longitude: 2.16, p_assignment_id: "a2" });
    await expect(page.getByText(/Compartiendo · última posición enviada/)).toBeVisible();

    await toggle.click();
    await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "stop_sharing_driver_location").length).toBe(1);
    await expect(page.getByText("Desactivado. Logística no ve tu posición.")).toBeVisible();
  });

  test("asks why before recording a refusal and sends the reason", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-30T08:00:00Z"));
    const calls = await bootstrapApp(page, {
      auth: { userId: "d1", role: "conductor", department: "logistics" },
      tables: {
        profiles: [{ id: "d1", first_name: "Ana", last_name: "Conductora", role: "conductor", department: "logistics" }],
        driver_details: [],
      },
      rpc: {
        get_my_transport_assignments: mine,
        respond_transport_assignment: { assignment_id: "a2", status: "declined", decline_reason: "No llego a tiempo", logistics_event_id: "e2" },
      },
    });
    await page.goto("/conductor");
    await page.getByRole("button", { name: "No puedo" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "¿No puedes hacer este transporte?" })).toBeVisible();
    await dialog.getByLabel("Motivo (opcional)").fill("No llego a tiempo");
    await dialog.getByRole("button", { name: "No puedo" }).click();

    await expect.poll(() => calls.rpcCalls.filter((call) => call.name === "respond_transport_assignment").length).toBe(1);
    const call = calls.rpcCalls.find((entry) => entry.name === "respond_transport_assignment");
    expect(call?.body).toMatchObject({ p_assignment_id: "a2", p_response: "declined", p_reason: "No llego a tiempo" });
    await expect(dialog).toBeHidden();
  });
});
