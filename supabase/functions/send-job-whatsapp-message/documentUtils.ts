/**
 * Pure utility functions for resolving Hoja de Ruta document attachments.
 * Extracted from index.ts to enable unit testing.
 */

export type HojaDocumentRow = {
  id?: string;
  file_name?: string | null;
  file_path?: string | null;
  file_type?: string | null;
  uploaded_at?: string | null;
};

export type HojaAttachment = {
  source: "job_documents" | "tour_documents";
  bucket: "job-documents" | "job_documents" | "tour-documents";
  path: string;
  filename: string;
};

export const DEPT_PREFIXES = new Set(["sound", "lights", "video", "production", "logistics", "administrative"]);

export const normalizeObjectPath = (value: string | null | undefined) => (value || "").replace(/^\/+/, "");

export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const hasHojaDeRutaText = (doc: HojaDocumentRow) => {
  const text = normalizeText(`${doc.file_name || ""} ${doc.file_path || ""}`);
  return text.includes("hoja") && (text.includes("ruta") || text.includes("route"));
};

export const isPdfDocument = (doc: HojaDocumentRow) => {
  const text = normalizeText(`${doc.file_type || ""} ${doc.file_name || ""} ${doc.file_path || ""}`);
  return text.includes("pdf");
};

export function resolveJobDocumentBucket(filePath: string): "job-documents" | "job_documents" {
  const first = normalizeObjectPath(filePath).split("/")[0] || "";
  return DEPT_PREFIXES.has(first) ? "job_documents" : "job-documents";
}

export function isJobHojaDeRutaDocument(doc: HojaDocumentRow, jobId: string): boolean {
  const path = normalizeObjectPath(doc.file_path);
  if (!path) return false;
  if (!isPdfDocument(doc)) return false;
  if (path.startsWith(`hojas-de-ruta/${jobId}/`)) return true;
  if (path.startsWith("hojas-de-ruta/") && hasHojaDeRutaText(doc)) return true;
  if (path.startsWith(`${jobId}/`) && hasHojaDeRutaText(doc)) return true;
  return hasHojaDeRutaText(doc);
}

export function isTourHojaDeRutaDocument(doc: HojaDocumentRow): boolean {
  const path = normalizeObjectPath(doc.file_path);
  if (!path) return false;
  if (!isPdfDocument(doc)) return false;
  if (path.startsWith("hojas-de-ruta/")) return true;
  return hasHojaDeRutaText(doc);
}

export function toHojaAttachment(
  source: HojaAttachment["source"],
  doc: HojaDocumentRow,
  bucket: HojaAttachment["bucket"],
): HojaAttachment | null {
  const path = normalizeObjectPath(doc.file_path);
  if (!path) return null;
  return {
    source,
    bucket,
    path,
    filename: (doc.file_name || "Hoja de Ruta.pdf").toString(),
  };
}