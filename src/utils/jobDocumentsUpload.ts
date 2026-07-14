import { supabase } from "@/lib/supabase";
import { sanitizeFilenamePart } from "@/utils/fileName";

export type JobPdfCleanupCandidate = {
  fileName: string;
  filePath: string;
};

export type JobPdfUploadOptions = {
  cleanupScope?: string;
  /**
   * Limits which previous documents are retired after the new upload. Every
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

const pendingUploads = new Map<string, Promise<unknown>>();

const withJobPdfUploadLock = <T>(slot: string, upload: () => Promise<T>): Promise<T> => {
  const run = (pendingUploads.get(slot) ?? Promise.resolve()).then(upload, upload);
  const clear = () => {
    if (pendingUploads.get(slot) === run) pendingUploads.delete(slot);
  };
  pendingUploads.set(slot, run);
  void run.then(clear, clear);
  return run;
};

// Only direct children of the slot folder belong to it: deeper paths are
// sibling stage scopes (e.g. an unscoped upload must not touch
// `${baseFolder}/stage-2-main/...`, which has its own slot).
const isDirectChildPath = (filePath: string, baseFolder: string) => {
  const prefix = `${baseFolder}/`;
  return filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes("/");
};

/**
 * Upload a job-related PDF to the job-documents bucket under a category folder,
 * then clean up previous versions for that job and category.
 *
 * Cleanup covers both storage layouts a generated PDF can live under: the
 * legacy `${category}/${jobId}` layout written by the calculators and the
 * job-scoped `${jobId}/${category}` layout written when documentation is
 * duplicated from another job — otherwise superseded copies linger next to the
 * regenerated report.
 *
 * Example category: "calculators/pesos" or "calculators/consumos"
 */
const runJobPdfUploadWithCleanup = async (
  jobId: string,
  pdfBlob: Blob,
  fileName: string,
  category: string,
  options: JobPdfUploadOptions = {}
): Promise<void> => {
  // Keep the readable canonical name in metadata; only the storage object path
  // needs the stricter ASCII-safe representation.
  const displayFileName = sanitizeFilenamePart(fileName, "Documento.pdf");
  const sanitizedFileName = sanitizeFileName(displayFileName);

  const scopeFolder = options.cleanupScope
    ? `/${sanitizePathSegment(options.cleanupScope)}`
    : "";
  const baseFolder = `${category}/${jobId}${scopeFolder}`; // e.g. calculators/pesos/<jobId>/<stage>
  const jobScopedFolder = `${jobId}/${category}${scopeFolder}`; // copies land here (RLS-compatible layout)
  const cleanupFolders = [baseFolder, jobScopedFolder];
  const matchesCleanupFilter = (candidate: JobPdfCleanupCandidate) =>
    !options.cleanupFilter || options.cleanupFilter(candidate);
  const objectPath = `${baseFolder}/${createDocumentVersionSegment()}-${sanitizedFileName}`;

    // 1) Discover previous versions before uploading. We intentionally defer
    // their removal until the replacement object and row both exist.
    let cleanupPlan: { paths: string[]; rowIds: string[] } | null = null;
    try {
      const pathsToRemove = new Set<string>();
      const rowIdsToRemove: string[] = [];

      const { data: existingRows, error: rowsError } = await supabase
        .from("job_documents")
        .select("id, file_name, file_path")
        .eq("job_id", jobId)
        .or(cleanupFolders.map((folder) => `file_path.like.${folder}/%`).join(","));

      if (rowsError) {
        // Without the row list we can't pair storage deletions with their DB
        // rows: removing files anyway would orphan job_documents rows that
        // point at missing objects (a broad pattern delete instead would hit
        // stage-scoped sibling rows and bypass the cleanup filter). Skip
        // cleanup for this run — the new upload still becomes the latest
        // version and the next successful regeneration cleans up.
        console.warn("[uploadJobPdfWithCleanup] skipping cleanup, row lookup failed:", rowsError);
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

        // Also list storage directly so orphaned files (uploads whose DB
        // insert failed) still get cleaned up.
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

        cleanupPlan = { paths: [...pathsToRemove], rowIds: rowIdsToRemove };
      }
    } catch (cleanupErr) {
      console.warn("[uploadJobPdfWithCleanup] cleanup discovery non-fatal error:", cleanupErr);
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
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error: insertError } = await supabase
        .from("job_documents")
        .insert({
          job_id: jobId,
          file_name: displayFileName,
          file_path: objectPath,
          file_type: "application/pdf",
          file_size: pdfBlob.size,
          uploaded_by: userRes?.user?.id || null,
          original_type: 'pdf',
          visible_to_tech: true,
        });
      if (insertError) throw insertError;
    } catch (insertFailure) {
      // The old versions have not been touched yet. Remove only the untracked
      // replacement object and leave the last valid document available.
      try {
        const { error: replacementCleanupError } = await supabase.storage
          .from("job-documents")
          .remove([objectPath]);
        if (replacementCleanupError) {
          console.warn(
            "[uploadJobPdfWithCleanup] replacement cleanup warning:",
            replacementCleanupError
          );
        }
      } catch (replacementCleanupError) {
        console.warn(
          "[uploadJobPdfWithCleanup] replacement cleanup warning:",
          replacementCleanupError
        );
      }
      throw insertFailure;
    }

    // 4) Retire the previous versions only after the replacement is fully
    // published. If storage cleanup fails, retain the old DB rows as valid
    // references rather than deleting metadata for files that may still exist.
    if (cleanupPlan) {
      try {
        let storageCleanupSucceeded = true;
        if (cleanupPlan.paths.length > 0) {
          const { error: removeError } = await supabase.storage
            .from("job-documents")
            .remove(cleanupPlan.paths);
          if (removeError) {
            storageCleanupSucceeded = false;
            console.warn("[uploadJobPdfWithCleanup] remove warning:", removeError);
          }
        }

        if (storageCleanupSucceeded && cleanupPlan.rowIds.length > 0) {
          const { error: dbDelError } = await supabase
            .from("job_documents")
            .delete()
            .in("id", cleanupPlan.rowIds)
            .eq("job_id", jobId);
          if (dbDelError) {
            console.warn("[uploadJobPdfWithCleanup] DB delete warning:", dbDelError);
          }
        }
      } catch (cleanupErr) {
        console.warn("[uploadJobPdfWithCleanup] cleanup non-fatal error:", cleanupErr);
      }
    }

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
          file_name: displayFileName
        }
      });
    } catch { /* best-effort push notification; ignore delivery failures */ }
};

export const uploadJobPdfWithCleanup = (
  jobId: string,
  pdfBlob: Blob,
  fileName: string,
  category: string,
  options: JobPdfUploadOptions = {}
): Promise<void> => {
  const scopeKey = options.cleanupScope
    ? sanitizePathSegment(options.cleanupScope)
    : "unscoped";
  const slotKey = `${jobId}/${category}/${scopeKey}`;

  return withJobPdfUploadLock(slotKey, () =>
    runJobPdfUploadWithCleanup(jobId, pdfBlob, fileName, category, options)
  );
};
