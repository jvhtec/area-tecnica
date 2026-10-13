import { describe, expect, it } from "vitest";
import { createOperationsReport } from "./operationsReport";
import type { Operation, WorkItem } from "./operationsModel";

describe("Pendientes e importes registrados", () => {
  const item = (id: string, closed = false): WorkItem => ({ id, kind: "material", title: id, date: "2026-10-13", status: closed ? "Cerrado" : "Pendiente", closed, missing: [], vehicleIds: [], driverIds: [], source: {
    id, job_id: id, job_title: id, department: "sound", status: "pending", planning_status: closed ? "completed" : "planned", description: null, note: null, needed_at: null, origin: null, destination: null, movement_type: "delivery", priority: "normal", source_type: "manual", source_ref: null, is_hoja_relevant: true, created_at: "2026-10-13", updated_at: "2026-10-13", created_by: null, requester_name: null, items: [], events: [],
  } });
  const complete = (id: string): Operation => ({ entity_kind: "material", entity_id: id, responsible_name: "Ana", transport_cost: 0, hotel_cost: 0, other_cost: 0 } as Operation);
  it("excluye resueltos y cerrados y conserva todos los servicios en el detalle", async () => {
    const book = await createOperationsReport([item("Resuelto"), item("Cerrado", true), item("Sin responsable")], [complete("Resuelto"), { ...complete("Sin responsable"), responsible_name: null }], "2026-10-01", "2026-10-31");
    const sheet = book.getWorksheet("Pendientes")!;
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getCell("A2").value).toBe("Sin responsable");
    expect(sheet.getCell("E2").value).toBe("Responsable");
    expect(book.getWorksheet("Resumen")!.getCell("B5").value).toBe(1);
    expect(book.getWorksheet("Responsables y costes")!.getCell("A3").value).toBe("Cerrado");
  });
  it("distingue importe vacío de cero real sin alterar el formato 02", async () => {
    const book = await createOperationsReport([item("Sin gastos"), item("Cero real")], [complete("Cero real")], "2026-10-01", "2026-10-31");
    const detail = book.getWorksheet("Responsables y costes")!;
    expect(detail.getCell("I2").value).toBeNull();
    expect(detail.getCell("M2").value).toBe("Sin importes registrados");
    expect(detail.getCell("I3").value).toBe(0);
    expect(detail.getCell("M3").value).toBe("Completo");
    const cards = book.getWorksheet("Gastos por evento")!;
    expect(cards.getCell("H7").value).toBe("Pendiente");
    expect(cards.getCell("H10").value).toBe("Sin importes");
    expect(cards.getCell("H16").value).toBe(0);
  });
});
