import { type SupabaseClient } from "npm:@supabase/supabase-js@2";

type SupabaseAdminClient = SupabaseClient;

type HojaDocumentRow = {
  id?: string;
  job_id?: string | null;
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

const DEPT_PREFIXES = new Set(["sound", "lights", "video", "production", "logistics", "administrative"]);

const normalizeObjectPath = (value: string | null | undefined) => (value || "").replace(/^\/+/, "");

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const hasHojaDeRutaText = (doc: HojaDocumentRow) => {
  const text = normalizeText(`${doc.file_name || ""} ${doc.file_path || ""}`);
  return text.includes("hoja") && (text.includes("ruta") || text.includes("route"));
};

const isPdfDocument = (doc: HojaDocumentRow) => {
  const mimeType = (doc.file_type || "").split(";")[0].trim().toLowerCase();
  if (mimeType === "application/pdf") return true;

  return [doc.file_name, doc.file_path].some((value) =>
    /\.pdf$/i.test(normalizeObjectPath(value))
  );
};

const uploadedAtMs = (doc: HojaDocumentRow) => {
  const value = doc.uploaded_at ? Date.parse(doc.uploaded_at) : NaN;
  return Number.isFinite(value) ? value : 0;
};

const byNewestUpload = (a: HojaDocumentRow, b: HojaDocumentRow) =>
  uploadedAtMs(b) - uploadedAtMs(a);

function resolveJobDocumentBucket(filePath: string): "job-documents" | "job_documents" {
  const first = normalizeObjectPath(filePath).split("/")[0] || "";
  return DEPT_PREFIXES.has(first) ? "job_documents" : "job-documents";
}

function isJobHojaDeRutaDocument(doc: HojaDocumentRow, jobId: string): boolean {
  const path = normalizeObjectPath(doc.file_path);
  if (!path) return false;
  if (!isPdfDocument(doc)) return false;
  if (path.startsWith(`hojas-de-ruta/${jobId}/`)) return true;
  if (path.startsWith("hojas-de-ruta/") && hasHojaDeRutaText(doc)) return true;
  if (path.startsWith(`${jobId}/`) && hasHojaDeRutaText(doc)) return true;
  return hasHojaDeRutaText(doc);
}

function isTourHojaDeRutaDocument(doc: HojaDocumentRow): boolean {
  const path = normalizeObjectPath(doc.file_path);
  if (!path) return false;
  if (!isPdfDocument(doc)) return false;
  if (path.startsWith("hojas-de-ruta/")) return true;
  return hasHojaDeRutaText(doc);
}

function toHojaAttachment(
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

async function findLatestJobHojaAttachment(
  supabaseAdmin: SupabaseAdminClient,
  jobId: string,
): Promise<HojaAttachment | null> {
  const { data, error } = await supabaseAdmin
    .from("job_documents")
    .select("id, file_name, file_path, file_type, uploaded_at")
    .eq("job_id", jobId)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  const doc = ((data || []) as HojaDocumentRow[])
    .filter((row) => isJobHojaDeRutaDocument(row, jobId))
    .sort(byNewestUpload)[0];
  if (!doc?.file_path) return null;
  return toHojaAttachment("job_documents", doc, resolveJobDocumentBucket(doc.file_path));
}

async function findLatestLinkedJobHojaAttachment(
  supabaseAdmin: SupabaseAdminClient,
  linkedJobIds: string[],
): Promise<HojaAttachment | null> {
  if (linkedJobIds.length === 0) return null;

  const { data, error } = await supabaseAdmin
    .from("job_documents")
    .select("id, job_id, file_name, file_path, file_type, uploaded_at")
    .in("job_id", linkedJobIds)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  const linkedJobIdSet = new Set(linkedJobIds);
  const doc = ((data || []) as HojaDocumentRow[])
    .filter((row) => {
      const rowJobId = row.job_id || null;
      return Boolean(rowJobId && linkedJobIdSet.has(rowJobId) && isJobHojaDeRutaDocument(row, rowJobId));
    })
    .sort(byNewestUpload)[0];

  if (!doc?.file_path) return null;
  return toHojaAttachment("job_documents", doc, resolveJobDocumentBucket(doc.file_path));
}

async function findLinkedHojaJobIdsForTourDate(
  supabaseAdmin: SupabaseAdminClient,
  tourDateId: string,
  currentJobId: string,
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("hoja_de_ruta")
    .select("job_id")
    .eq("tour_date_id", tourDateId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Array.from(new Set(
    ((data || []) as Array<{ job_id?: string | null }>)
      .map((row) => row.job_id)
      .filter((id): id is string => Boolean(id && id !== currentJobId))
  ));
}

async function resolveTourIdFromTourDate(
  supabaseAdmin: SupabaseAdminClient,
  tourDateId: string | null,
): Promise<string | null> {
  if (!tourDateId) return null;

  const { data, error } = await supabaseAdmin
    .from("tour_dates")
    .select("tour_id")
    .eq("id", tourDateId)
    .maybeSingle();

  if (error) throw error;
  const tourId = (data as { tour_id?: string | null } | null)?.tour_id;
  return typeof tourId === "string" && tourId ? tourId : null;
}

async function findLatestTourHojaAttachment(
  supabaseAdmin: SupabaseAdminClient,
  tourId: string,
): Promise<HojaAttachment | null> {
  const { data, error } = await supabaseAdmin
    .from("tour_documents")
    .select("id, file_name, file_path, file_type, uploaded_at")
    .eq("tour_id", tourId)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  const doc = ((data || []) as HojaDocumentRow[])
    .filter(isTourHojaDeRutaDocument)
    .sort(byNewestUpload)[0];
  return doc ? toHojaAttachment("tour_documents", doc, "tour-documents") : null;
}

/**
 * Resolve the latest Hoja de Ruta PDF visible from a job context.
 *
 * Lookup order intentionally mirrors the existing job-message behavior:
 * direct job document, linked job document for the same tour date, then tour document.
 */
export async function resolveHojaAttachment(
  supabaseAdmin: SupabaseAdminClient,
  jobId: string,
): Promise<HojaAttachment | null> {
  const directJobDoc = await findLatestJobHojaAttachment(supabaseAdmin, jobId);
  if (directJobDoc) return directJobDoc;

  const { data: jobRow, error: jobErr } = await supabaseAdmin
    .from("jobs")
    .select("id, tour_id, tour_date_id")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr) throw jobErr;

  const jobContext = (jobRow || {}) as { tour_id?: string | null; tour_date_id?: string | null };
  const tourDateId = typeof jobContext.tour_date_id === "string" ? jobContext.tour_date_id : null;

  if (tourDateId) {
    const linkedJobIds = await findLinkedHojaJobIdsForTourDate(supabaseAdmin, tourDateId, jobId);
    const linkedJobDoc = await findLatestLinkedJobHojaAttachment(supabaseAdmin, linkedJobIds);
    if (linkedJobDoc) return linkedJobDoc;
  }

  const tourId = typeof jobContext.tour_id === "string" && jobContext.tour_id
    ? jobContext.tour_id
    : await resolveTourIdFromTourDate(supabaseAdmin, tourDateId);

  return tourId ? findLatestTourHojaAttachment(supabaseAdmin, tourId) : null;
}
