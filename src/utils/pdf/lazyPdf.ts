let jsPdfPromise: Promise<typeof import('jspdf')> | null = null;
let autoTablePromise: Promise<typeof import('jspdf-autotable')> | null = null;

export type AutoTableFn = (doc: any, options: any) => void;

export async function loadJsPDF() {
  jsPdfPromise ??= import('jspdf');
  const mod = await jsPdfPromise;
  return mod.default;
}

export async function loadAutoTable(): Promise<AutoTableFn> {
  autoTablePromise ??= import('jspdf-autotable');
  const mod: any = await autoTablePromise;
  return (mod?.default ?? mod?.autoTable ?? mod) as AutoTableFn;
}

export async function loadPdfLibs() {
  const [jsPDF, autoTable] = await Promise.all([loadJsPDF(), loadAutoTable()]);
  return { jsPDF, autoTable };
}

