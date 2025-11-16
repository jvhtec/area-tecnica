import { supabase } from "@/lib/supabase";

/**
 * Upload a job-related PDF to the job-documents bucket under a category folder,
 * first cleaning up any previous versions for that job and category.
 *
 * Example category: "calculators/pesos" or "calculators/consumos"
 */
export const uploadJobPdfWithCleanup = async (
  jobId: string,
  pdfBlob: Blob,
  fileName: string,
  category: string
): Promise<string> => {
  // Sanitize filename for storage
  const sanitizedFileName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");

  const baseFolder = `${category}/${jobId}`; // e.g. calculators/pesos/<jobId>
  const objectPath = `${baseFolder}/${sanitizedFileName}`;

  try {
    // 1) Remove any existing files for this job/category
    try {
      const { data: existing, error: listError } = await supabase.storage
        .from("job-documents")
        .list(baseFolder);

      if (listError) {
        console.warn("[uploadJobPdfWithCleanup] list warning:", listError);
      } else if (existing && existing.length > 0) {
        const toRemove = existing.map(f => `${baseFolder}/${f.name}`);
        const { error: removeError } = await supabase.storage
          .from("job-documents")
          .remove(toRemove);
        if (removeError) {
          console.warn("[uploadJobPdfWithCleanup] remove warning:", removeError);
        }
      }

      const { error: dbDelError } = await supabase
        .from("job_documents")
        .delete()
        .like("file_path", `${baseFolder}/%`)
        .eq("job_id", jobId);
      if (dbDelError) {
        console.warn("[uploadJobPdfWithCleanup] DB delete warning:", dbDelError);
      }
    } catch (cleanupErr) {
      console.warn("[uploadJobPdfWithCleanup] cleanup non-fatal error:", cleanupErr);
    }

    // 2) Upload new file
    const { error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(objectPath, pdfBlob, {
        cacheControl: "3600",
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
    } catch {}
    return objectPath;
  } catch (err) {
    console.error("uploadJobPdfWithCleanup error:", err);
    throw err;
  }
};
