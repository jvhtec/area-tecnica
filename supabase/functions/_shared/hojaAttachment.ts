import { type SupabaseClient } from "npm:@supabase/supabase-js@2";

type SupabaseAdminClient = SupabaseClient;

type HojaDocumentRow = {
  id: string;
  job_id: string | null;
  file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  document_kind: string | null;
};

type PublishedHojaRow = {
  job_id: string | null;
  published_document_id: string | null;
};

export type HojaAttachment = {
  source: "job_documents";
  bucket: "job-documents" | "job_documents";
  path: string;
  filename: string;
};

const DEPT_PREFIXES = new Set([
  "sound",
  "lights",
  "video",
  "production",
  "logistics",
  "administrative",
]);

const normalizeObjectPath = (value: string | null | undefined) =>
  (value || "").replace(/^\/+/, "");

const isPdfDocument = (doc: HojaDocumentRow): boolean => {
  const mimeType = (doc.file_type || "").split(";")[0].trim().toLowerCase();
  return mimeType === "application/pdf"
    || /\.pdf$/i.test(normalizeObjectPath(doc.file_path));
};

function resolveJobDocumentBucket(
  filePath: string,
): "job-documents" | "job_documents" {
  const first = normalizeObjectPath(filePath).split("/")[0] || "";
  return DEPT_PREFIXES.has(first) ? "job_documents" : "job-documents";
}

async function fetchPublishedDocument(
  supabaseAdmin: SupabaseAdminClient,
  hoja: PublishedHojaRow | null,
): Promise<HojaAttachment | null> {
  const documentId = hoja?.published_document_id;
  const jobId = hoja?.job_id;
  if (!documentId || !jobId) return null;

  const { data, error } = await supabaseAdmin
    .from("job_documents")
    .select("id, job_id, file_name, file_path, file_type, document_kind")
    .eq("id", documentId)
    .eq("job_id", jobId)
    .eq("document_kind", "hoja_de_ruta")
    .maybeSingle();

  if (error) throw error;
  const doc = data as HojaDocumentRow | null;
  if (!doc?.file_path || !isPdfDocument(doc)) return null;

  return {
    source: "job_documents",
    bucket: resolveJobDocumentBucket(doc.file_path),
    path: normalizeObjectPath(doc.file_path),
    filename: doc.file_name || "Hoja de Ruta.pdf",
  };
}

async function findDirectPublishedHoja(
  supabaseAdmin: SupabaseAdminClient,
  jobId: string,
): Promise<HojaAttachment | null> {
  const { data, error } = await supabaseAdmin
    .from("hoja_de_ruta")
    .select("job_id,published_document_id")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) throw error;
  return fetchPublishedDocument(supabaseAdmin, data as PublishedHojaRow | null);
}

async function findLinkedPublishedHoja(
  supabaseAdmin: SupabaseAdminClient,
  tourDateId: string,
  currentJobId: string,
): Promise<HojaAttachment | null> {
  const { data, error } = await supabaseAdmin
    .from("hoja_de_ruta")
    .select("job_id,published_document_id,updated_at")
    .eq("tour_date_id", tourDateId)
    .neq("job_id", currentJobId)
    .not("published_document_id", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  for (const row of (data || []) as Array<PublishedHojaRow & { updated_at?: string | null }>) {
    const attachment = await fetchPublishedDocument(supabaseAdmin, row);
    if (attachment) return attachment;
  }

  return null;
}

/**
 * Resolve the canonical published Hoja PDF for a job. A tour-date sibling is a
 * deliberate fallback because several operational job records may represent
 * the same tour stop. There are no filename/path heuristics.
 */
export async function resolveHojaAttachment(
  supabaseAdmin: SupabaseAdminClient,
  jobId: string,
): Promise<HojaAttachment | null> {
  const direct = await findDirectPublishedHoja(supabaseAdmin, jobId);
  if (direct) return direct;

  const { data: jobRow, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select("tour_date_id")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) throw jobError;
  const tourDateId = (jobRow as { tour_date_id?: string | null } | null)?.tour_date_id;
  return tourDateId
    ? findLinkedPublishedHoja(supabaseAdmin, tourDateId, jobId)
    : null;
}
