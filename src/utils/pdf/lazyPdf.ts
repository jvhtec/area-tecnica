import type { autoTable as autoTableFunction } from 'jspdf-autotable';

let jsPdfPromise: Promise<typeof import('jspdf')> | null = null;
let autoTablePromise: Promise<typeof import('jspdf-autotable')> | null = null;

export type AutoTableFn = typeof autoTableFunction;

export async function loadJsPDF() {
  jsPdfPromise ??= import('jspdf');
  const mod = await jsPdfPromise;
  return mod.default;
}

export async function loadAutoTable(): Promise<AutoTableFn> {
  autoTablePromise ??= import('jspdf-autotable');
  const mod = await autoTablePromise;
  return mod.autoTable as AutoTableFn;
}

export async function loadPdfLibs() {
  const [jsPDF, autoTable] = await Promise.all([loadJsPDF(), loadAutoTable()]);
  return { jsPDF, autoTable };
}
