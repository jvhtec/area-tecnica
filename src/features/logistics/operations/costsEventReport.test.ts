import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { addOperationsCosts } from "./operationsReport";
import type { Operation } from "./operationsModel";

describe("Fichas de gastos por evento", () => {
  it("agrupa por identificador de evento y conserva empresa, cero y costes pendientes", async () => {
    const workbook = new ExcelJS.Workbook();
    const items = [
      { id: "a", kind: "material" as const, title: "Sonido", date: "2026-10-05", status: "Confirmado", eventId: "job-1", eventTitle: "Concierto" },
      { id: "b", kind: "personnel" as const, title: "Equipo", date: "2026-10-05", status: "Confirmado", eventId: "job-1", eventTitle: "Concierto" },
      { id: "c", kind: "material" as const, title: "Otro", date: "2026-10-06", status: "Cancelado", eventId: "job-2", eventTitle: "Concierto" },
    ];
    const operations = [{ entity_kind: "material", entity_id: "a", transport_cost: 0.1, hotel_cost: 0, other_cost: 0.2, transport_company: "Transportes Ejemplo", responsible_name: "Ana" }, { entity_kind: "personnel", entity_id: "b", transport_cost: 50, hotel_cost: null, other_cost: 0, transport_company: "Transporte propio" }] as Operation[];
    addOperationsCosts(workbook, items, operations, { first: "2026-10-05", last: "2026-10-11" });
    const roundtrip = new ExcelJS.Workbook();
    await roundtrip.xlsx.load(await workbook.xlsx.writeBuffer());
    const cards = roundtrip.getWorksheet("Gastos por evento")!;
    expect(cards.getCell("A5").value).toBe("Concierto");
    expect(cards.getCell("A14").value).toBe("Concierto");
    expect(cards.getCell("H10").value).toBe(50.3);
    expect(cards.getCell("A7").value).toContain("Transportes Ejemplo");
    expect(cards.getCell("A7").value).toContain("Transporte propio");
    expect(cards.getCell("A11").value).toContain("Hotel");
    const detail = roundtrip.getWorksheet("Responsables y costes")!;
    expect(detail.getCell("L2").value).toBe("Transportes Ejemplo");
    expect(detail.getCell("G2").value).toBe(0);
    expect(detail.getCell("G3").value).toBeNull();
    expect(detail.getCell("D4").value).toBe("Cancelado");
  });
  it("genera un informe vacío legible", () => {
    const workbook = new ExcelJS.Workbook();
    addOperationsCosts(workbook, [], []);
    expect(workbook.getWorksheet("Gastos por evento")!.getCell("A5").value).toContain("No hay servicios");
  });
});
