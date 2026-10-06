import { expect, test } from "@playwright/test";
import { bootstrapApp } from "./support/app";
const planId = "bb100000-0000-0000-0000-000000000001";
const ownerId = "bb200000-0000-0000-0000-000000000001";
const vehicleId = "bb300000-0000-0000-0000-000000000001";
const eventId = "bb400000-0000-0000-0000-000000000001";
const plan = { id: planId, title: "Equipo Festival Norte", job_id: null, people_count: 6, starts_at: "2026-10-05T07:00:00Z", ends_at: "2026-10-05T09:00:00Z", origin_location_id: "origin", destination_location_id: "destination", vehicle_id: null, driver_id: null, status: "planned", hotel_needed: true, hotel_name: "Hotel Norte", hotel_address: "Calle Mayor 20", hotel_check_in: "2026-10-05", hotel_check_out: "2026-10-06", single_rooms: 0, double_rooms: 3, hotel_status: "pending", notes: "Equipo de prueba", updated_at: "2026-10-01T08:00:00Z", event_id: eventId, assignment_id: null };
const vehicle = { id: vehicleId, name: "Furgoneta Norte", license_plate: "1234 ABC", vehicle_type: "furgoneta", required_license: "B", passenger_seats: 8, is_active: true };
const driver = { id: ownerId, first_name: "Ana", last_name: "López", license_categories: ["B"] };
const event = { id: eventId, event_type: "crew_transfer", transport_type: "furgoneta", event_date: "2026-10-05", event_time: "09:00:00", end_date: "2026-10-05", end_time: "11:00:00", title: plan.title, job_id: null, job: null, departments: [], origin: "Almacén", destination: "Festival", location: null, passenger_count: 6 };
test("el panel guarda responsable y gastos y permite descargar el informe", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T08:00:00Z"));
  let saved: Record<string, unknown> | null = null;
  await bootstrapApp(page, { auth: { userId: ownerId, role: "management", department: "logistics" }, tables: { jobs: [], locations: [{ id: "origin", name: "Almacén" }, { id: "destination", name: "Festival" }] }, rpc: {
    list_transport_requests: [], list_personnel_logistics_plans: [plan], get_logistics_matrix: { drivers: [driver], vehicles: [vehicle], events: [], assignments: [] }, list_fleet_workshop_appointments: [],
    list_logistics_operations: () => saved ? [{ ...saved, responsible_name: "Ana López", updated_at: "2026-10-05T08:01:00Z" }] : [],
    list_logistics_responsibles: [{ id: ownerId, name: "Ana López" }],
    save_logistics_operation: ({ body }) => { saved = (body as { p_input: Record<string, unknown> }).p_input; return null; },
    list_logistics_operation_history: () => saved ? [{ id: "change", changed_at: "2026-10-05T08:01:00Z", actor_name: "Ana López", action: "INSERT", before_data: null, after_data: saved }] : [],
  } });
  await page.goto("/logistics?tab=work");
  await expect(page.getByText("Equipo Festival Norte", { exact: true })).toBeVisible();
  await expect(page.getByText("Falta: Vehículo · Conductor · Reserva de hotel · Responsable", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Responsable, gastos e historial" }).click();
  await page.getByLabel("Responsable de logística").selectOption(ownerId);
  await page.getByLabel("Transporte (€)").fill("125,50");
  await page.getByLabel("Hotel (€)").fill("240");
  await page.getByLabel("Otros gastos (€)").fill("0");
  await page.getByLabel("Detalle de los gastos").fill("Hotel y transporte del grupo");
  await page.getByRole("button", { name: "Guardar responsable y gastos" }).click();
  await expect(page.getByText("Responsable: Ana López", { exact: true })).toBeVisible();
  expect(saved).toMatchObject({ entity_id: planId, transport_cost: 125.5, hotel_cost: 240, other_cost: 0, responsible_id: ownerId });
  await page.getByRole("button", { name: "Responsable, gastos e historial" }).click();
  await expect(page.getByRole("heading", { name: "Historial de cambios" })).toBeVisible();
  await expect(page.getByText(/Coste de transporte: Sin indicar → 125.5/)).toBeVisible();
  await page.keyboard.press("Escape");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel semanal" }).click();
  expect((await download).suggestedFilename()).toBe("Logistica-semanal-2026-10-05.xlsx");
  await page.screenshot({ path: `Capturas/panel-logistica-${test.info().project.name}.png`, fullPage: true });
});
test("consulta no puede modificar responsables ni costes", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T08:00:00Z"));
  await bootstrapApp(page, { auth: { userId: ownerId, role: "house_tech", department: "sound" }, tables: { jobs: [], locations: [] }, rpc: { list_transport_requests: [], list_personnel_logistics_plans: [plan], get_logistics_matrix: { drivers: [driver], vehicles: [vehicle], events: [], assignments: [] }, list_fleet_workshop_appointments: [], list_logistics_operations: [], list_logistics_responsibles: [], list_logistics_operation_history: [] } });
  await page.goto("/logistics?tab=work");
  await page.getByRole("button", { name: "Responsable, gastos e historial" }).click();
  await expect(page.getByLabel("Transporte (€)")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Guardar responsable y gastos" })).toHaveCount(0);
});
test("el calendario filtra los servicios por conductor y vehículo", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T08:00:00Z"));
  const other = { ...event, id: "bb400000-0000-0000-0000-000000000002", title: "Material escenario", event_type: "load" };
  await bootstrapApp(page, { auth: { userId: ownerId, role: "management", department: "logistics" }, tables: { logistics_events: [event, other] }, rpc: { get_logistics_matrix: { drivers: [driver], vehicles: [vehicle], events: [event, other], assignments: [{ id: "assignment", logistics_event_id: eventId, driver_id: ownerId, vehicle_id: vehicleId, starts_at: plan.starts_at, ends_at: plan.ends_at, status: "confirmed" }] } } });
  await page.goto("/logistics?tab=calendar");
  await expect(page.getByText("Material escenario", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Filtrar por conductor").selectOption(ownerId);
  await expect(page.getByText("Material escenario", { exact: true }).first()).toBeHidden();
  await expect(page.getByText(plan.title, { exact: true }).first()).toBeVisible();
  await page.getByLabel("Filtrar por vehículo").selectOption(vehicleId);
  await expect(page.getByText(plan.title, { exact: true }).first()).toBeVisible();
});
test("avisa del taller antes de guardar un traslado de personal", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T08:00:00Z"));
  const calls = await bootstrapApp(page, { auth: { userId: ownerId, role: "management", department: "logistics" }, tables: { jobs: [], locations: [{ id: "origin", name: "Almacén" }, { id: "destination", name: "Festival" }] }, rpc: {
    list_personnel_logistics_plans: [{ ...plan, vehicle_id: vehicleId, driver_id: ownerId }],
    get_logistics_matrix: { drivers: [driver], vehicles: [vehicle], events: [], assignments: [] },
    list_fleet_workshop_appointments: [{ id: "bb500000-0000-0000-0000-000000000001", vehicle_id: vehicleId, starts_at: plan.starts_at, ends_at: plan.ends_at, workshop: "Taller", reason: "ITV", notes: null, mileage_km: null, status: "in_progress", updated_at: plan.updated_at }],
  } });
  await page.goto("/logistics?area=personnel&tab=personnel");
  await page.getByRole("button", { name: "Editar traslado", exact: true }).click();
  await expect(page.getByText("El vehículo está reservado en el taller: ITV.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Guardar traslado", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(calls.rpcCalls.some((call) => call.name === "save_personnel_logistics_plan")).toBe(false);
});
