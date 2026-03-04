
import { supabase } from "@/lib/supabase";

type HojaPdfDocumentKind = 'hoja_de_ruta' | 'certificado_entrega';

const HOJA_PDF_FOLDER_BY_KIND: Record<HojaPdfDocumentKind, string> = {
  hoja_de_ruta: 'hojas-de-ruta',
  certificado_entrega: 'certificados-entrega',
};

interface UploadPdfToJobOptions {
  kind?: HojaPdfDocumentKind;
}

export const uploadPdfToJob = async (
  jobId: string,
  pdfBlob: Blob,
  fileName: string,
  options: UploadPdfToJobOptions = {}
): Promise<void> => {
  try {
    const kind = options.kind || 'hoja_de_ruta';
    const folderBase = HOJA_PDF_FOLDER_BY_KIND[kind];

    // Sanitize filename for storage while preserving human-readable spaces.
    const sanitizedFileName = fileName
      .replace(/_/g, ' ')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ') // illegal file/path chars
      .replace(/\s+/g, ' ')
      .replace(/\s+\./g, '.')
      .trim();

    const folderPath = `${folderBase}/${jobId}`;
    const filePath = `${folderPath}/${sanitizedFileName}`;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.warn('Auth getUser warning (hoja de ruta upload):', authError);
    }
    const userId = authData.user?.id || null;

    console.log('Uploading job PDF:', {
      kind,
      fileName: sanitizedFileName,
      jobId,
      userId,
    });

    // Snapshot existing PDFs in the same scoped folder so we can clean up
    // *after* a successful upload+insert.
    // This avoids a window where the DB row exists but the file has already been deleted.
    let previousDocs: Array<{ id: string; file_path: string }> = [];
    try {
      const { data, error } = await supabase
        .from('job_documents')
        .select('id,file_path')
        .eq('job_id', jobId)
        .like('file_path', `${folderPath}/%`)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.warn('DB select warning (hoja de ruta cleanup snapshot):', error);
      } else if (Array.isArray(data)) {
        previousDocs = data
          .filter((doc) => doc.file_path !== filePath)
          .map((doc) => ({ id: doc.id, file_path: doc.file_path }));
      }
    } catch (snapshotErr) {
      console.warn('Cleanup snapshot step encountered an issue (non-blocking):', snapshotErr);
    }

    // Upload new PDF first (no pre-delete)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(filePath, pdfBlob, {
        cacheControl: '3600',
        upsert: false
      });

    console.log('Upload result:', { uploadData, uploadError });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    // Insert document reference into the database using correct column names
    const { error: insertError } = await supabase
      .from("job_documents")
      .insert({
        job_id: jobId,
        file_name: sanitizedFileName,
        file_path: filePath,
        file_type: 'application/pdf',
        file_size: pdfBlob.size,
        uploaded_by: userId,
        original_type: 'pdf',
        visible_to_tech: true
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }
    
    console.log('PDF uploaded successfully:', sanitizedFileName);

    // Best-effort cleanup: delete previous DB rows first, then their storage objects.
    // If DB delete is not permitted, we intentionally skip storage removal to avoid broken download links.
    if (previousDocs.length > 0) {
      try {
        const previousIds = previousDocs.map((doc) => doc.id);
        const previousPaths = previousDocs.map((doc) => doc.file_path);

        const { error: dbDeleteError } = await supabase
          .from('job_documents')
          .delete()
          .in('id', previousIds);

        if (dbDeleteError) {
          console.warn('DB delete warning (hoja de ruta cleanup):', dbDeleteError);
        } else if (previousPaths.length > 0) {
          const { error: removeError } = await supabase.storage
            .from('job-documents')
            .remove(previousPaths);

          if (removeError) {
            console.warn('Storage remove warning (hoja de ruta cleanup):', removeError);
          } else {
            console.log(`Removed ${previousPaths.length} previous PDF file(s) from storage for kind "${kind}".`);
          }
        }
      } catch (cleanupErr) {
        console.warn('Hoja de Ruta cleanup step encountered an issue (non-blocking):', cleanupErr);
      }
    }

    // Broadcast push: new Hoja de Ruta uploaded
    try {
      void supabase.functions.invoke('push', {
        body: { action: 'broadcast', type: 'document.uploaded', job_id: jobId, file_name: sanitizedFileName }
      });
    } catch {}
  } catch (error) {
    console.error("Error uploading PDF:", error);
    throw error;
  }
};
