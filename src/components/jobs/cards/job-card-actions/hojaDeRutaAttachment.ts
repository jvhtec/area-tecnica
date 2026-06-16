export type HojaDeRutaAttachmentSource = "job_documents" | "tour_documents";

export type HojaDeRutaAttachmentRow = {
  id: string;
  job_id?: string | null;
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
  const mimeType = (doc.file_type || "").split(";")[0].trim().toLowerCase();
  if (mimeType === "application/pdf") return true;

  return [doc.file_name, doc.file_path].some((value) =>
    /\.pdf$/i.test(normalizePath(value))
  );
};

const uploadedAtMs = (doc: HojaDeRutaAttachmentRow) => {
  const value = doc.uploaded_at ? Date.parse(doc.uploaded_at) : NaN;
  return Number.isFinite(value) ? value : 0;
};

const byNewestUpload = (a: HojaDeRutaAttachmentRow, b: HojaDeRutaAttachmentRow) =>
  uploadedAtMs(b) - uploadedAtMs(a);

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
  const doc = (docs || [])
    .filter((candidate) => isJobHojaDeRutaDocument(candidate, jobId))
    .sort(byNewestUpload)[0];
  return doc ? { ...doc, source: "job_documents" } : null;
};

export const pickLatestLinkedJobHojaDeRutaDocument = (
  docs: HojaDeRutaAttachmentRow[] | null | undefined,
  linkedJobIds: string[]
): HojaDeRutaAttachmentDoc | null => {
  const linkedJobIdSet = new Set(linkedJobIds);
  const doc = (docs || [])
    .filter((candidate) => {
      const candidateJobId = candidate.job_id || null;
      return Boolean(
        candidateJobId &&
        linkedJobIdSet.has(candidateJobId) &&
        isJobHojaDeRutaDocument(candidate, candidateJobId)
      );
    })
    .sort(byNewestUpload)[0];

  return doc ? { ...doc, source: "job_documents" } : null;
};

export const pickLatestTourHojaDeRutaDocument = (
  docs: HojaDeRutaAttachmentRow[] | null | undefined
): HojaDeRutaAttachmentDoc | null => {
  const doc = (docs || [])
    .filter(isTourHojaDeRutaDocument)
    .sort(byNewestUpload)[0];
  return doc ? { ...doc, source: "tour_documents" } : null;
};
