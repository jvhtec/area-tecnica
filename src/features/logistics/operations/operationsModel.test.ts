import { describe, expect, it } from "vitest";
import { parseCost, operationTotal } from "./operationsModel";
import { resourceConflicts } from "./conflicts";
import type { DriverAssignment } from "@/features/logistics/fleet/fleetModel";
import type { WorkshopAppointment } from "@/features/logistics/fleet/workshopModel";
import { createOperationsReport } from "./operationsReport";
describe("Gestión diaria de logística", () => {
  it("distingue importes pendientes de cero y acepta coma decimal", () => {
    expect(parseCost("")).toBeNull(); expect(parseCost("0")).toBe(0); expect(parseCost("120,35")).toBe(120.35);
    for (const invalid of ["-1", "1e3", "12.345", "Infinity", "10000001"]) expect(() => parseCost(invalid)).toThrow();
    expect(operationTotal({ transport_cost: 0.1, hotel_cost: 0.2, other_cost: null })).toBe(0.3);
  });
  const assignment = { logistics_event_id: "other", vehicle_id: "van", driver_id: "driver", starts_at: "2026-10-05T08:00Z", ends_at: "2026-10-05T10:00Z", status: "confirmed" } as DriverAssignment;
  const input = { start: "2026-10-05T09:00Z", end: "2026-10-05T11:00Z", vehicleId: "van", driverId: "driver", excludeEventIds: [] as string[] };
  it("detecta conductor y vehículo ocupados sin bloquear reservas contiguas", () => {
    expect(resourceConflicts(input, [assignment], [])).toHaveLength(2);
    expect(resourceConflicts({ ...input, start: assignment.ends_at }, [assignment], [])).toEqual([]);
    expect(resourceConflicts({ ...input, excludeEventIds: ["other"] }, [assignment], [])).toEqual([]);
    expect(resourceConflicts(input, [{ ...assignment, status: "declined" }], [])).toEqual([]);
  });
  it("detecta el taller y permite citas canceladas", () => {
    const appointment = { vehicle_id: "van", starts_at: input.start, ends_at: input.end, reason: "ITV", status: "scheduled" } as WorkshopAppointment;
    expect(resourceConflicts(input, [], [appointment])[0]).toContain("taller");
    expect(resourceConflicts(input, [], [{ ...appointment, status: "in_progress" }])[0]).toContain("taller");
    expect(resourceConflicts(input, [], [{ ...appointment, status: "cancelled" }])).toEqual([]);
  });
  it("exporta solo el periodo indicado y conserva costes vacíos", async () => {
    const workbook = await createOperationsReport([{ id: "one", kind: "personnel", title: "Salida", date: "2026-10-05", status: "Pendiente", closed: false, missing: ["Conductor"], vehicleIds: [], driverIds: [], source: {} } as never, { id: "other", kind: "material", title: "Fuera", date: "2026-11-01", source: { events: [] } } as never], [], "2026-10-05", "2026-10-11");
    const sheet = workbook.getWorksheet("Responsables y costes")!;
    expect(sheet.getCell("A2").value).toBe("Salida");
    expect(sheet.getCell("F2").value).toBeNull();
    expect(sheet.getCell("I2").value).toBe(0);
    expect(sheet.getCell("A3").value).not.toBe("Fuera");
  });
});
