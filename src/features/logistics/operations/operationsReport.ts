import type { Workbook } from "exceljs";
import { addEventCostCards, type CostReportItem } from "./costsEventReport";
import { itemOverlapsPeriod, operationKey, operationTotal, type Operation, type WorkItem } from "./operationsModel";
export function addOperationsCosts(workbook: Workbook, items: CostReportItem[], operations: Operation[], period?: { first: string; last: string }) {
  addEventCostCards(workbook, items, operations, period);
  const map = new Map(operations.map((row) => [operationKey(row.entity_kind, row.entity_id), row]));
  const sheet = workbook.addWorksheet("Responsables y costes");
  sheet.addRow(["Servicio", "Área", "Fecha", "Estado", "Responsable", "Transporte (€)", "Hotel (€)", "Otros (€)", "Total registrado (€)", "Costes pendientes", "Detalle"]);
  for (const item of items) {
    const operation = map.get(operationKey(item.kind, item.id));
    sheet.addRow([item.title, item.kind === "material" ? "Material" : "Personal", item.date, item.status, operation?.responsible_name ?? "Sin asignar", operation?.transport_cost ?? null, operation?.hotel_cost ?? null, operation?.other_cost ?? null, operationTotal(operation), [operation?.transport_cost == null && "Transporte", operation?.hotel_cost == null && "Hotel", operation?.other_cost == null && "Otros"].filter(Boolean).join(", "), operation?.cost_notes ?? "", operation?.transport_company?.trim() || "Sin indicar"]);
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 24; });
  for (const index of [6, 7, 8, 9]) sheet.getColumn(index).numFmt = '#,##0.00" €"';
  sheet.eachRow((row) => { row.alignment = { wrapText: true, vertical: "top" }; });
  sheet.getCell("L1").value = "Empresa de transporte";
  sheet.getColumn(12).width = 32;
  sheet.autoFilter = { from: "A1", to: `L${Math.max(1, sheet.rowCount)}` };
  sheet.addRow(["Los costes son totales por servicio, sin prorratear. Cancelados separados por estado; los importes vacíos están pendientes. No representa contabilidad ni impuestos."]);
}
export async function createOperationsReport(items: WorkItem[], operations: Operation[], first: string, last: string, jobs: { id: string; title: string }[] = []) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sector Pro";
  const rows = items.filter((item) => itemOverlapsPeriod(item, first, last));
  addOperationsCosts(workbook, rows.map((item) => ({ ...item, eventTitle: jobs.find((job) => job.id === item.source.job_id)?.title })), operations, { first, last });
  const summary = workbook.addWorksheet("Resumen");
  summary.addRows([["Logística · " + first + " a " + last], ["Servicios", rows.length], ["Material", rows.filter((item) => item.kind === "material").length], ["Personal", rows.filter((item) => item.kind === "personnel").length], ["Servicios con pendientes", rows.filter((item) => !item.closed && item.missing.length).length]]);
  summary.getColumn(1).width = 65;
  const detail = workbook.addWorksheet("Pendientes");
  detail.addRow(["Servicio", "Área", "Fecha", "Estado", "Falta por resolver"]);
  rows.forEach((item) => detail.addRow([item.title, item.kind, item.date, item.status, item.missing.join(", ")]));
  detail.columns.forEach((column) => { column.width = 30; });
  return workbook;
}
