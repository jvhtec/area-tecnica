import type ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Converts a hex color string to an 8-char ARGB string required by ExcelJS.
 *
 * Accepted inputs:
 *   - 3-char shorthand: "F00" → "FFFF0000"
 *   - 6-char hex: "2980B9" → "FF2980B9"
 *   - With leading '#': "#2980B9" → "FF2980B9"
 *   - 8-char ARGB passthrough: "FF2980B9" → "FF2980B9"
 */
export function toArgb(hex: string): string {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    const expanded = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    return `FF${expanded.toUpperCase()}`;
  }
  if (clean.length === 6) {
    return `FF${clean.toUpperCase()}`;
  }
  if (clean.length === 8) {
    return clean.toUpperCase();
  }
  throw new Error(`toArgb: invalid hex color "${hex}" (expected 3, 6, or 8 hex chars)`);
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
 * Applies styling to a cell, merging with any existing styles.
 *
 * - `font` is set when any of bold/fontSize/textColor/italic is provided.
 * - `fill` is set only when bgColor is provided.
 * - `alignment` merges with existing: horizontal is set when options.alignment
 *   is provided, wrapText when options.wrapText is provided; vertical defaults
 *   to "middle" only if no existing alignment is present.
 * - `border` is set only when options.borderColor or options.borderStyle is
 *   provided; otherwise the existing cell.border is preserved.
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

  if (options.alignment !== undefined || options.wrapText !== undefined) {
    const existing = (cell.alignment as ExcelJS.Alignment) || {};
    cell.alignment = {
      ...existing,
      vertical: existing.vertical ?? "middle",
      ...(options.alignment !== undefined ? { horizontal: options.alignment } : {}),
      ...(options.wrapText !== undefined ? { wrapText: options.wrapText } : {}),
    };
  }

  if (options.borderColor !== undefined || options.borderStyle !== undefined) {
    const borderColor = options.borderColor ?? "000000";
    const style = options.borderStyle ?? "thin";
    cell.border = {
      top: { style, color: { argb: toArgb(borderColor) } },
      bottom: { style, color: { argb: toArgb(borderColor) } },
      left: { style, color: { argb: toArgb(borderColor) } },
      right: { style, color: { argb: toArgb(borderColor) } },
    };
  }
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

/**
 * Parses a hex color string (#RRGGBB or RRGGBB) into an [r, g, b] tuple.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

/**
 * Given a hex color (#RRGGBB or RRGGBB), returns black or white hex
 * (without '#') for optimal text contrast in ExcelJS cells.
 */
export function getContrastTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "000000" : "FFFFFF";
}

/**
 * Like getContrastTextColor but returns with leading '#' for use
 * in jsPDF / non-ExcelJS contexts.
 */
export function getContrastHexColor(hex: string): string {
  return `#${getContrastTextColor(hex)}`;
}

/**
 * Creates a lighter tint of a hex color (for cell backgrounds).
 * Factor 0.0 = white, 1.0 = original color.
 */
export function tintColor(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const tr = Math.round(r + (255 - r) * (1 - factor));
  const tg = Math.round(g + (255 - g) * (1 - factor));
  const tb = Math.round(b + (255 - b) * (1 - factor));
  return [tr, tg, tb].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates a uniform thin border object for ExcelJS cells.
 */
export function thinBorder(color = "D1D5DB") {
  return {
    top: { style: "thin" as const, color: { argb: toArgb(color) } },
    bottom: { style: "thin" as const, color: { argb: toArgb(color) } },
    left: { style: "thin" as const, color: { argb: toArgb(color) } },
    right: { style: "thin" as const, color: { argb: toArgb(color) } },
  };
}
