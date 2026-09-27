import { type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Department uploads (sound/..., lights/...) live in the legacy `job_documents`
// bucket; everything else, including Hoja de Ruta PDFs and images under
// `hojas-de-ruta/<jobId>/`, lives in `job-documents`.
const DEPT_PREFIXES = new Set([
  "sound",
  "lights",
  "video",
  "production",
  "logistics",
  "administrative",
]);

export type JobDocumentBucket = "job-documents" | "job_documents";

export const normalizeObjectPath = (value: string | null | undefined): string =>
  (value || "").replace(/^\/+/, "");

export function resolveJobDocumentBucket(filePath: string): JobDocumentBucket {
  const first = normalizeObjectPath(filePath).split("/")[0] || "";
  return DEPT_PREFIXES.has(first) ? "job_documents" : "job-documents";
}

/** Groups object paths by the job-document bucket that stores them. */
export function groupPathsByJobDocumentBucket(
  paths: Array<string | null | undefined>,
): Map<JobDocumentBucket, string[]> {
  const grouped = new Map<JobDocumentBucket, string[]>();
  for (const raw of paths) {
    const path = normalizeObjectPath(raw);
    if (!path) continue;
    const bucket = resolveJobDocumentBucket(path);
    grouped.set(bucket, [...(grouped.get(bucket) || []), path]);
  }
  return grouped;
}

/**
 * Lists every object below `prefix` (storage `list` is one level deep, so
 * folders are walked). Bounded so a malformed tree cannot loop forever.
 */
export async function listObjectsUnder(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
  maxDepth = 4,
): Promise<string[]> {
  const root = normalizeObjectPath(prefix).replace(/\/+$/, "");
  if (!root || maxDepth < 0) return [];

  const { data, error } = await client.storage.from(bucket).list(root, { limit: 1000 });
  if (error) throw error;

  const objects: string[] = [];
  for (const entry of data || []) {
    const path = `${root}/${entry.name}`;
    // Folders are returned without an id.
    if (entry.id === null) {
      objects.push(...await listObjectsUnder(client, bucket, path, maxDepth - 1));
    } else {
      objects.push(path);
    }
  }
  return objects;
}
