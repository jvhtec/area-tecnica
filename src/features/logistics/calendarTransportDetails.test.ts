import { describe, expect, it, vi } from "vitest";
import { calendarTransportForExport, resolveCalendarTransport } from "./calendarTransportDetails";
import { fetchLogisticsMatrix } from "./fleet/fleetApi";
import { listOperations } from "./operations/operationsApi";
import { listPersonnelPlans } from "./personnel/personnelApi";
import { listTransportRequests } from "./transportRequests";
import type { LogisticsMatrixData } from "./fleet/fleetModel";
import type { Operation } from "./operations/operationsModel";

vi.mock("./fleet/useLogisticsFleet", () => ({ useLogisticsMatrix: vi.fn() }));
vi.mock("./operations/operationsApi", () => ({ useOperations: vi.fn(), listOperations: vi.fn() }));
vi.mock("./personnel/personnelApi", () => ({ usePersonnelPlans: vi.fn(), listPersonnelPlans: vi.fn() }));
vi.mock("./fleet/fleetApi", () => ({ fetchLogisticsMatrix: vi.fn() }));
vi.mock("./transportRequests", () => ({ listTransportRequests: vi.fn() }));

const matrix = {
  vehicles: [{ id: "v1", license_plate: "5678DEF" }, { id: "v2", license_plate: "1234ABC" }],
  assignments: [{ logistics_event_id: "e1", vehicle_id: "v1", status: "confirmed" }],
} as Pick<LogisticsMatrixData, "vehicles" | "assignments">;
describe("Datos de transporte del calendario", () => {
  it("muestra la matrícula asignada aunque el evento no tenga una copia", () => {
    expect(resolveCalendarTransport({ id: "e1", event_type: "load", license_plate: null }, matrix, [], []).license_plate).toBe("5678DEF");
  });
  it("prioriza Flota y advierte de la matrícula manual desactualizada", () => {
    const result = resolveCalendarTransport({ id: "e1", event_type: "load", license_plate: "ANTIGUA" }, matrix, [], []);
    expect(result.license_plate).toBe("5678DEF");
    expect(result.transport_data_warning).toContain("difiere");
  });
  it("incluye varios vehículos y excluye las asignaciones rechazadas", () => {
    const multiple = { ...matrix, assignments: [...matrix.assignments, { ...matrix.assignments[0], vehicle_id: "v2" }, { ...matrix.assignments[0], vehicle_id: "v1", status: "declined" as const }] };
    expect(resolveCalendarTransport({ id: "e1", event_type: "load" }, multiple, [], []).license_plate).toBe("5678DEF, 1234ABC");
    expect(resolveCalendarTransport({ id: "e1", event_type: "load", license_plate: "EXTERNA" }, { ...matrix, assignments: [{ ...matrix.assignments[0], status: "declined" }] }, [], []).license_plate).toBe("EXTERNA");
  });
  it("relaciona la empresa por identificador de petición y no por título", () => {
    const operation = { entity_kind: "material", entity_id: "r1", transport_company: "Transportes Ejemplo" } as Operation;
    const requests = [{ id: "r1", events: [{ id: "e1" }] }] as never;
    expect(resolveCalendarTransport({ id: "e1", event_type: "load", transport_provider: "sector_pro" }, matrix, [operation], requests).transport_company).toBe("Transportes Ejemplo");
    expect(resolveCalendarTransport({ id: "otro", event_type: "load" }, matrix, [operation], requests).transport_company).toBeNull();
  });
  it("usa la empresa del servicio de Personal enlazado al traslado", () => {
    const operation = { entity_kind: "personnel", entity_id: "p1", transport_company: "Autocares Ejemplo" } as Operation;
    expect(resolveCalendarTransport({ id: "e1", event_type: "crew_transfer" }, matrix, [operation], [], [{ id: "p1", event_id: "e1" }]).transport_company).toBe("Autocares Ejemplo");
  });
  it("consulta las fechas exportadas y propaga un fallo en vez de descargar datos incompletos", async () => {
    vi.mocked(fetchLogisticsMatrix).mockResolvedValue({ ...matrix } as LogisticsMatrixData);
    vi.mocked(listOperations).mockResolvedValue([]);
    vi.mocked(listTransportRequests).mockResolvedValue([]);
    vi.mocked(listPersonnelPlans).mockResolvedValue([]);
    const result = await calendarTransportForExport([{ id: "e1", event_type: "load" }], "month", new Date(2026, 10, 1));
    expect(fetchLogisticsMatrix).toHaveBeenLastCalledWith("2026-11-01", "2026-11-30");
    expect(listPersonnelPlans).toHaveBeenLastCalledWith("2026-11-01", "2026-11-30");
    expect(result[0].license_plate).toBe("5678DEF");
    vi.mocked(fetchLogisticsMatrix).mockRejectedValueOnce(new Error("Sin acceso"));
    await expect(calendarTransportForExport([], "month", new Date(2026, 10, 1))).rejects.toThrow("Sin acceso");
  });
});
