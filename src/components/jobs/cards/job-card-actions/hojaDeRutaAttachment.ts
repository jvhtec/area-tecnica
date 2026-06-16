export type HojaDeRutaAttachmentSource = "job_documents" | "tour_documents";

export type HojaDeRutaAttachmentRow = {
  id: string;
  file_name: string | null;
  file_path: string | null;
  file_type?: string | null;
  uploaded_at?: string | null;
};

export type HojaDeRutaAttachmentDoc = HojaDeRutaAttachmentRow & {
  source: HojaDeRutaAttachmentSource;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizePath = (value: string | null | undefined) => (value || "").replace(/^\/+/, "");

const hasHojaDeRutaText = (doc: HojaDeRutaAttachmentRow) => {
  const text = normalizeText(`${doc.file_name || ""} ${doc.file_path || ""}`);
  return text.includes("hoja") && (text.includes("ruta") || text.includes("route"));
};

const isPdfDocument = (doc: HojaDeRutaAttachmentRow) => {
  const text = normalizeText(`${doc.file_type || ""} ${doc.file_name || ""} ${doc.file_path || ""}`);
  return text.includes("pdf");
};

export const isJobHojaDeRutaDocument = (doc: HojaDeRutaAttachmentRow, jobId: string) => {
  const path = normalizePath(doc.file_path);
  if (!path) return false;
  if (!isPdfDocument(doc)) return false;
  if (path.startsWith(`hojas-de-ruta/${jobId}/`)) return true;
  if (path.startsWith("hojas-de-ruta/") && hasHojaDeRutaText(doc)) return true;
  if (path.startsWith(`${jobId}/`) && hasHojaDeRutaText(doc)) return true;
  return hasHojaDeRutaText(doc);
};

export const isTourHojaDeRutaDocument = (doc: HojaDeRutaAttachmentRow) => {
  const path = normalizePath(doc.file_path);
  if (!path) return false;
  if (!isPdfDocument(doc)) return false;
  if (path.startsWith("hojas-de-ruta/")) return true;
  return hasHojaDeRutaText(doc);
};

export const pickLatestJobHojaDeRutaDocument = (
  docs: HojaDeRutaAttachmentRow[] | null | undefined,
  jobId: string
): HojaDeRutaAttachmentDoc | null => {
  const doc = (docs || []).find((candidate) => isJobHojaDeRutaDocument(candidate, jobId));
  return doc ? { ...doc, source: "job_documents" } : null;
};

export const pickLatestTourHojaDeRutaDocument = (
  docs: HojaDeRutaAttachmentRow[] | null | undefined
): HojaDeRutaAttachmentDoc | null => {
  const doc = (docs || []).find(isTourHojaDeRutaDocument);
  return doc ? { ...doc, source: "tour_documents" } : null;
};
