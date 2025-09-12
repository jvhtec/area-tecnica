
import { supabase } from "@/lib/supabase";

export const uploadPdfToJob = async (jobId: string, pdfBlob: Blob, fileName: string): Promise<void> => {
  try {
    // Sanitize filename for storage - remove special characters and spaces
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    console.log('Uploading PDF:', sanitizedFileName, 'to job:', jobId);
    console.log('User authenticated:', (await supabase.auth.getUser()).data.user?.id);

    // 1) Clean up existing Hoja de Ruta PDFs for this job (storage + DB)
    try {
      // List existing files under the job's Hoja de Ruta folder
      const { data: existingFiles, error: listError } = await supabase.storage
        .from('job-documents')
        .list(`hojas-de-ruta/${jobId}`);

      if (listError) {
        console.warn('Storage list warning (hoja de ruta cleanup):', listError);
      } else if (existingFiles && existingFiles.length > 0) {
        const pathsToRemove = existingFiles.map(f => `hojas-de-ruta/${jobId}/${f.name}`);
        const { error: removeError } = await supabase.storage
          .from('job-documents')
          .remove(pathsToRemove);
        if (removeError) {
          console.warn('Storage remove warning (hoja de ruta cleanup):', removeError);
        } else {
          console.log(`Removed ${pathsToRemove.length} previous Hoja de Ruta file(s) from storage.`);
        }
      }

      // Remove previous DB references for this job's Hoja de Ruta PDFs
      const { error: dbDeleteError } = await supabase
        .from('job_documents')
        .delete()
        .like('file_path', `hojas-de-ruta/${jobId}/%`)
        .eq('job_id', jobId);
      if (dbDeleteError) {
        console.warn('DB delete warning (hoja de ruta cleanup):', dbDeleteError);
      } else {
        console.log('Cleared previous Hoja de Ruta document references in DB.');
      }
    } catch (cleanupErr) {
      console.warn('Hoja de Ruta cleanup step encountered an issue but will not block upload:', cleanupErr);
    }
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(`hojas-de-ruta/${jobId}/${sanitizedFileName}`, pdfBlob, {
        cacheControl: '3600',
        upsert: false
      });

    console.log('Upload result:', { uploadData, uploadError });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("job-documents")
      .getPublicUrl(`hojas-de-ruta/${jobId}/${sanitizedFileName}`);

    // Insert document reference into the database using correct column names
    const { error: insertError } = await supabase
      .from("job_documents")
      .insert({
        job_id: jobId,
        file_name: sanitizedFileName,
        file_path: `hojas-de-ruta/${jobId}/${sanitizedFileName}`,
        file_type: 'application/pdf',
        file_size: pdfBlob.size,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }
    
    console.log('PDF uploaded successfully:', sanitizedFileName);
  } catch (error) {
    console.error("Error uploading PDF:", error);
    throw error;
  }
};
