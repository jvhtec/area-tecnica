import { supabase } from "@/lib/supabase";

export type JobPdfCleanupCandidate = {
  fileName: string;
  filePath: string;
};

export type JobPdfUploadOptions = {
  cleanupScope?: string;
  /**
   * Limits which previous documents are removed before the new upload. Every
   * direct child of the job/category folder (in both storage layouts) is
   * offered; return false to keep it. Needed for shared category folders
   * (sound and video Consumos both live under calculators/consumos) so one
   * department's regeneration doesn't delete the other department's latest PDF.
   */
  cleanupFilter?: (candidate: JobPdfCleanupCandidate) => boolean;
};

const sanitizeFileName = (fileName: string) =>
  fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");

const sanitizePathSegment = (value: string) =>
  sanitizeFileName(value)
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "") || "scope";

const createDocumentVersionSegment = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Only direct children of the slot folder belong to it: deeper paths are
// sibling stage scopes (e.g. an unscoped upload must not touch
// `${baseFolder}/stage-2-main/...`, which has its own slot).
const isDirectChildPath = (filePath: string, baseFolder: string) => {
  const prefix = `${baseFolder}/`;
  return filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes("/");
};

/**
 * Upload a job-related PDF to the job-documents bucket under a category folder,
 * first cleaning up any previous versions for that job and category.
 *
 * Cleanup covers both storage layouts a generated PDF can live under: the
 * legacy `${category}/${jobId}` layout written by the calculators and the
 * job-scoped `${jobId}/${category}` layout written when documentation is
 * duplicated from another job — otherwise superseded copies linger next to the
 * regenerated report.
 *
 * Example category: "calculators/pesos" or "calculators/consumos"
 */
export const uploadJobPdfWithCleanup = async (
  jobId: string,
  pdfBlob: Blob,
  fileName: string,
  category: string,
  options: JobPdfUploadOptions = {}
): Promise<void> => {
  // Sanitize filename for storage
  const sanitizedFileName = sanitizeFileName(fileName);

  const scopeFolder = options.cleanupScope
    ? `/${sanitizePathSegment(options.cleanupScope)}`
    : "";
  const baseFolder = `${category}/${jobId}${scopeFolder}`; // e.g. calculators/pesos/<jobId>/<stage>
  const jobScopedFolder = `${jobId}/${category}${scopeFolder}`; // copies land here (RLS-compatible layout)
  const cleanupFolders = [baseFolder, jobScopedFolder];
  const matchesCleanupFilter = (candidate: JobPdfCleanupCandidate) =>
    !options.cleanupFilter || options.cleanupFilter(candidate);
  const objectPath = `${baseFolder}/${createDocumentVersionSegment()}-${sanitizedFileName}`;

  try {
    // 1) Remove any existing files for this job/category (both layouts)
    try {
      const pathsToRemove = new Set<string>();
      const rowIdsToRemove: string[] = [];

      const { data: existingRows, error: rowsError } = await supabase
        .from("job_documents")
        .select("id, file_name, file_path")
        .eq("job_id", jobId)
        .or(cleanupFolders.map((folder) => `file_path.like.${folder}/%`).join(","));

      if (rowsError) {
        console.warn("[uploadJobPdfWithCleanup] row lookup warning:", rowsError);
      } else {
        for (const row of existingRows || []) {
          if (!row.file_path) continue;
          const isDirectChild = cleanupFolders.some((folder) =>
            isDirectChildPath(row.file_path, folder)
          );
          if (!isDirectChild) continue;
          if (!matchesCleanupFilter({ fileName: row.file_name || "", filePath: row.file_path })) {
            continue;
          }
          pathsToRemove.add(row.file_path);
          rowIdsToRemove.push(row.id);
        }
      }

      // Also list storage directly so orphaned files (uploads whose DB insert
      // failed) still get cleaned up.
      for (const folder of cleanupFolders) {
        const { data: existing, error: listError } = await supabase.storage
          .from("job-documents")
          .list(folder);

        if (listError) {
          console.warn("[uploadJobPdfWithCleanup] list warning:", listError);
          continue;
        }

        for (const entry of existing || []) {
          // Subfolder placeholders come back with a null id — those are
          // sibling stage scopes, not files of this slot.
          if ("id" in entry && entry.id === null) continue;
          const candidatePath = `${folder}/${entry.name}`;
          if (!matchesCleanupFilter({ fileName: entry.name, filePath: candidatePath })) continue;
          pathsToRemove.add(candidatePath);
        }
      }

      if (pathsToRemove.size > 0) {
        const { error: removeError } = await supabase.storage
          .from("job-documents")
          .remove([...pathsToRemove]);
        if (removeError) {
          console.warn("[uploadJobPdfWithCleanup] remove warning:", removeError);
        }
      }

      if (rowIdsToRemove.length > 0) {
        const { error: dbDelError } = await supabase
          .from("job_documents")
          .delete()
          .in("id", rowIdsToRemove)
          .eq("job_id", jobId);
        if (dbDelError) {
          console.warn("[uploadJobPdfWithCleanup] DB delete warning:", dbDelError);
        }
      }
    } catch (cleanupErr) {
      console.warn("[uploadJobPdfWithCleanup] cleanup non-fatal error:", cleanupErr);
    }

    // 2) Upload new file
    const { error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(objectPath, pdfBlob, {
        cacheControl: "0",
        upsert: false,
        contentType: "application/pdf",
      });
    if (uploadError) throw uploadError;

    // 3) Insert DB reference
    const { data: userRes } = await supabase.auth.getUser();
    const { error: insertError } = await supabase
      .from("job_documents")
      .insert({
        job_id: jobId,
        file_name: sanitizedFileName,
        file_path: objectPath,
        file_type: "application/pdf",
        file_size: pdfBlob.size,
        uploaded_by: userRes?.user?.id || null,
        original_type: 'pdf',
        visible_to_tech: true,
      });
    if (insertError) throw insertError;

    // Broadcast push: new document uploaded (fire-and-forget)
    // CRITICAL: Use incident.report.uploaded for incident reports
    try {
      const pushEventType = category === 'incident-reports'
        ? 'incident.report.uploaded'
        : 'document.uploaded';

      void supabase.functions.invoke('push', {
        body: {
          action: 'broadcast',
          type: pushEventType,
          job_id: jobId,
          file_name: sanitizedFileName
        }
      });
    } catch { /* best-effort push notification; ignore delivery failures */ }
  } catch (err) {
    console.error("uploadJobPdfWithCleanup error:", err);
    throw err;
  }
};
