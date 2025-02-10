
import { supabase } from "@/lib/supabase";
import { Toast } from "@/components/ui/use-toast";

export const uploadPdfToJob = async (jobId: string, pdfBlob: Blob, fileName: string) => {
  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("job-documents")
      .upload(`hojas-de-ruta/${jobId}/${fileName}`, pdfBlob);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("job-documents")
      .getPublicUrl(`hojas-de-ruta/${jobId}/${fileName}`);

    // Insert document reference into the database
    const { error: insertError } = await supabase
      .from("job_documents")
      .insert({
        job_id: jobId,
        document_type: "hoja_de_ruta",
        file_name: fileName,
        url: urlData.publicUrl,
      });

    if (insertError) throw insertError;

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error uploading PDF:", error);
    throw error;
  }
};
