
import { supabase } from "@/lib/supabase";

export const uploadPdfToJob = async (jobId: string, pdfBlob: Blob, fileName: string): Promise<void> => {
  try {
    // Sanitize filename for storage - remove special characters and spaces
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    console.log('Uploading PDF:', sanitizedFileName, 'to job:', jobId);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(`hojas-de-ruta/${jobId}/${sanitizedFileName}`, pdfBlob, {
        cacheControl: '3600',
        upsert: false
      });

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
