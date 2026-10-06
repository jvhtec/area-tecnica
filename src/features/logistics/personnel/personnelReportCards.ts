import type { CellValue, Worksheet } from "exceljs";

const groups: [string, number[], boolean][] = [
  ["Evento y personas", [1, 2, 3, 16], true],
  ["Ruta y horario", [4, 5, 6, 7, 8, 9], true],
  ["Vehículo y conductor", [10, 11, 12, 13, 14, 15], false],
  ["Hotel y habitaciones", [17, 18, 19, 20, 21, 22, 23, 24, 25, 26], true],
  ["Observaciones y registro", [27, 0, 28, 29], false],
];

/** Format 03: one complete two-column card for each transfer, including hotel-only overlaps. */
export function addPersonnelReportCards(sheet: Worksheet, labels: string[], records: CellValue[][], first: string, last: string) {
  sheet.columns = Array.from({ length: 9 }, (_, index) => ({ width: index === 4 ? 3 : 20 }));
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup = { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true };
  const merge = (row: number, from: number, to: number, value: CellValue) => {
    sheet.mergeCells(row, from, row, to);
    const cell = sheet.getCell(row, from);
    cell.value = value;
    cell.font = { name: "Arial", size: 10, color: { argb: "FF172033" } };
    cell.alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
    return cell;
  };
  let top = 2;
  if (!records.length) {
    merge(top, 1, 9, "No hay traslados ni estancias de personal en este periodo.");
    sheet.getRow(top).height = 34;
  }
  for (const [position, record] of records.entries()) {
    if (position > 0) sheet.getRow(top - 1).addPageBreak();
    const title = merge(top, 1, 9, `Traslado de personal ${position + 1} · ${record[1] ?? ""}`);
    title.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF172033" } };
    sheet.getRow(top).height = Math.max(34, Math.ceil(String(title.value).length / 75) * 20);
    merge(top + 1, 1, 9, `${first} a ${last} · Horario de Madrid`);
    sheet.getRow(top + 1).height = 24;
    let left = top + 3;
    let right = top + 3;
    for (const [heading, indexes, isLeft] of groups) {
      let row = isLeft ? left : right;
      const labelStart = isLeft ? 1 : 6;
      const valueStart = labelStart + 2;
      const band = merge(row, labelStart, valueStart + 1, heading);
      band.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isLeft ? "FF1E3A5F" : "FF46646B" } };
      sheet.getRow(row).height = Math.max(sheet.getRow(row).height ?? 0, 26);
      row++;
      for (const index of indexes) {
        const raw = record[index];
        const text = typeof raw === "string" ? raw : "";
        // Long instructions occupy several rows so Excel never clips them at its row-height limit.
        const pieces: CellValue[] = text.length > 600 ? text.match(/[\s\S]{1,600}/g)! : [raw === null || raw === "" || raw === undefined ? "Sin registrar" : raw];
        for (const [part, value] of pieces.entries()) {
          const label = merge(row, labelStart, labelStart + 1, part ? `${labels[index]} (continuación)` : labels[index]);
          label.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF55657B" } };
          const cell = merge(row, valueStart, valueStart + 1, value);
          if ([4, 5, 28].includes(index)) cell.numFmt = "dd/mm/yyyy hh:mm";
          if ([20, 21].includes(index)) cell.numFmt = "dd/mm/yyyy";
          const lines = Math.max(Math.ceil(String(value ?? "").length / 34), Math.ceil(String(label.value).length / 34));
          sheet.getRow(row).height = Math.max(sheet.getRow(row).height ?? 0, 30, lines * 14 + 10);
          row++;
        }
      }
      if (isLeft) left = row + 1;
      else right = row + 1;
    }
    top = Math.max(left, right) + 2;
  }
  sheet.pageSetup.printArea = `A1:I${top}`;
}
