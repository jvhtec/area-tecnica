import type ExcelJS from "exceljs";

let exceljsPromise: Promise<typeof import("exceljs")> | null = null;

export async function loadExceljs(): Promise<typeof ExcelJS> {
  exceljsPromise ??= import("exceljs");
  const mod = await exceljsPromise;
  return mod.default ?? mod;
}
