import type ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Converts a 6-char hex color (e.g. "2980B9") to an 8-char ARGB string
 * required by ExcelJS (e.g. "FF2980B9").
 */
export function toArgb(hex: string): string {
  const clean = hex.replace(/^#/, "");
  return `FF${clean}`;
}

export interface CellStyleOptions {
  bold?: boolean;
  fontSize?: number;
  bgColor?: string;
  textColor?: string;
  alignment?: "left" | "center" | "right";
  wrapText?: boolean;
  italic?: boolean;
  borderStyle?: "thin" | "medium";
  borderColor?: string;
}

/**
 * Applies styling to a cell using the common style options pattern
 * used across the export files.
 */
export function applyStyle(
  cell: ExcelJS.Cell,
  options: CellStyleOptions
): void {
  if (options.bold || options.fontSize || options.textColor || options.italic) {
    cell.font = {
      bold: options.bold ?? false,
      size: options.fontSize ?? 11,
      color: options.textColor ? { argb: toArgb(options.textColor) } : undefined,
      italic: options.italic ?? false,
    };
  }

  if (options.bgColor) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: toArgb(options.bgColor) },
    };
  }

  cell.alignment = {
    horizontal: options.alignment ?? "left",
    vertical: "middle",
    wrapText: options.wrapText ?? false,
  };

  const borderColor = options.borderColor ?? "000000";
  const style = options.borderStyle ?? "thin";
  cell.border = {
    top: { style, color: { argb: toArgb(borderColor) } },
    bottom: { style, color: { argb: toArgb(borderColor) } },
    left: { style, color: { argb: toArgb(borderColor) } },
    right: { style, color: { argb: toArgb(borderColor) } },
  };
}

/**
 * Populates a worksheet from an array-of-arrays and returns it.
 * Equivalent to the old XLSX.utils.aoa_to_sheet() pattern.
 */
export function populateSheet(
  worksheet: ExcelJS.Worksheet,
  data: (string | number | null | undefined)[][]
): void {
  for (const row of data) {
    worksheet.addRow(row.map((v) => v ?? ""));
  }
}

/**
 * Saves a workbook as an .xlsx file download in the browser.
 */
export async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, filename);
}
