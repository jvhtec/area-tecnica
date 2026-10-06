import type { Workbook } from "exceljs";
import { operationKey, operationTotal, type Operation, type WorkItem } from "./operationsModel";

export type CostReportItem = Pick<WorkItem, "id" | "kind" | "title" | "date" | "status"> & { eventId?: string | null; eventTitle?: string; source?: WorkItem["source"] };

/** One card per job; standalone services retain their own identity. */
export function addEventCostCards(workbook: Workbook, items: CostReportItem[], operations: Operation[], period?: { first: string; last: string }) {
  const sheet = workbook.addWorksheet("Gastos por evento");
  sheet.properties.defaultRowHeight = 24;
  sheet.columns = Array.from({ length: 9 }, (_, index) => ({ width: index === 4 ? 3 : 18 }));
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const merged = (range: string, value: string | number) => {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(":")[0]);
    cell.value = value;
    cell.font = { name: "Arial", size: 11, color: { argb: "FF203047" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    return cell;
  };
  merged("A2:I2", "Gastos por evento · Formato 02").font = { name: "Arial", size: 17, bold: true };
  sheet.getRow(2).height = 32;
  merged("A3:I3", period ? `${period.first} a ${period.last}` : "Importes totales por servicio");
  const map = new Map(operations.map((operation) => [operationKey(operation.entity_kind, operation.entity_id), operation]));
  const groups = new Map<string, { title: string; items: CostReportItem[] }>();
  for (const item of items) {
    const jobId = item.eventId ?? item.source?.job_id;
    const key = jobId ? `job:${jobId}` : operationKey(item.kind, item.id);
    const title = item.eventTitle ?? (item.source && "job_title" in item.source ? item.source.job_title : item.title);
    const group = groups.get(key) ?? { title, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  let row = 5;
  let total = 0;
  for (const group of groups.values()) {
    const band = merged(`A${row}:I${row}`, group.title);
    band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    band.font = { name: "Arial", size: 12, bold: true };
    merged(`A${row + 1}:D${row + 1}`, "Servicios y responsables");
    merged(`F${row + 1}:I${row + 1}`, "Importes registrados (€)");
    const serviceText = group.items.map((item) => {
      const operation = map.get(operationKey(item.kind, item.id));
      return `${item.kind === "material" ? "Material" : "Personal"} · ${item.title}\n${item.date ?? "Sin fecha"} · ${item.status}\nResponsable: ${operation?.responsible_name ?? "Sin asignar"}\nEmpresa de transporte: ${operation?.transport_company?.trim() || "Sin indicar"}`;
    }).join("\n\n");
    const bodyHeight = Math.max(150, group.items.length * 105);
    merged(`A${row + 2}:D${row + 4}`, serviceText);
    for (let offset = 2; offset <= 4; offset++) sheet.getRow(row + offset).height = bodyHeight / 3;
    const keys = ["transport_cost", "hotel_cost", "other_cost"] as const;
    const labels = ["Transporte", "Hotel", "Otros"];
    const pending: string[] = [];
    const totals = keys.map((key, index) => {
      const values = group.items.map((item) => map.get(operationKey(item.kind, item.id))?.[key]);
      if (values.some((value) => value == null)) pending.push(labels[index]);
      const value = values.reduce<number>((sum, amount) => sum + Math.round((amount ?? 0) * 100), 0) / 100;
      merged(`F${row + 2 + index}:G${row + 2 + index}`, labels[index]);
      const cell = merged(`H${row + 2 + index}:I${row + 2 + index}`, value);
      cell.numFmt = '#,##0.00" €"';
      cell.font = { name: "Arial", size: 12, bold: true };
      return value;
    });
    const groupTotal = Math.round(totals.reduce((sum, value) => sum + value, 0) * 100) / 100;
    total += group.items.reduce((sum, item) => sum + Math.round(operationTotal(map.get(operationKey(item.kind, item.id))) * 100), 0);
    merged(`F${row + 5}:G${row + 5}`, "Total registrado");
    merged(`H${row + 5}:I${row + 5}`, groupTotal).numFmt = '#,##0.00" €"';
    const warning = merged(`A${row + 6}:I${row + 6}`, pending.length ? `Importes pendientes: ${pending.join(", ")}. Revisar Responsables y costes.` : "Todos los importes están registrados.");
    warning.fill = { type: "pattern", pattern: "solid", fgColor: { argb: pending.length ? "FFFEF3C7" : "FFF1F5F9" } };
    sheet.getRow(row + 6).height = 32;
    row += 9;
  }
  if (!items.length) { merged(`A${row}:I${row}`, "No hay servicios en el periodo seleccionado."); row++; }
  merged(`A${row}:G${row}`, "Total registrado del periodo");
  merged(`H${row}:I${row}`, total / 100).numFmt = '#,##0.00" €"';
  merged(`A${row + 2}:I${row + 3}`, "Los importes pendientes no están incluidos en el total. Los costes son totales por servicio, sin prorratear. Los servicios cancelados conservan su estado en el detalle.");
  sheet.pageSetup.printArea = `A1:I${row + 3}`;
}
