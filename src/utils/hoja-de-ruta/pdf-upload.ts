import { supabase } from "@/lib/supabase";

export type HojaPdfDocumentKind = "hoja_de_ruta" | "certificado_entrega";

const HOJA_PDF_FOLDER_BY_KIND: Record<HojaPdfDocumentKind, string> = {
  hoja_de_ruta: "hojas-de-ruta",
  certificado_entrega: "certificados-entrega",
};

interface UploadPdfToJobOptions {
  kind?: HojaPdfDocumentKind;
}

export const sanitizeHojaPdfFileName = (fileName: string): string => {
  const sanitized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  return sanitized || "Hoja de Ruta.pdf";
};

export const uploadPdfToJob = async (
  jobId: string,
  pdfBlob: Blob,
  fileName: string,
  options: UploadPdfToJobOptions = {},
): Promise<{ id: string; file_path: string }> => {
  const kind = options.kind || "hoja_de_ruta";
  const folderBase = HOJA_PDF_FOLDER_BY_KIND[kind];
  const sanitizedFileName = sanitizeHojaPdfFileName(fileName);
  const folderPath = `${folderBase}/${jobId}`;
  const filePath = `${folderPath}/${sanitizedFileName}`;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id || null;

  // Snapshot the previous documents of this exact kind. Legacy generated rows
  // are also caught by the canonical folder while they are being migrated.
  const { data: existingDocs, error: snapshotError } = await supabase
    .from("job_documents")
    .select("id,file_path,document_kind")
    .eq("job_id", jobId)
    .like("file_path", `${folderPath}/%`)
    .order("uploaded_at", { ascending: false });

  if (snapshotError) throw snapshotError;

  const previousDocs = (existingDocs || []).filter((doc) => doc.file_path !== filePath);

  const { error: uploadError } = await supabase.storage
    .from("job-documents")
    .upload(filePath, pdfBlob, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });

  if (uploadError) throw uploadError;

  const { data: inserted, error: insertError } = await supabase
    .from("job_documents")
    .insert({
      job_id: jobId,
      file_name: sanitizedFileName,
      file_path: filePath,
      file_type: "application/pdf",
      file_size: pdfBlob.size,
      uploaded_by: userId,
      original_type: "pdf",
      document_kind: kind,
      visible_to_tech: kind === "hoja_de_ruta",
    })
    .select("id,file_path")
    .single();

  if (insertError || !inserted) {
    await supabase.storage.from("job-documents").remove([filePath]);
    throw insertError || new Error("No se pudo registrar el documento publicado");
  }

  if (kind === "hoja_de_ruta") {
    const { data: publishedHoja, error: publishError } = await supabase
      .from("hoja_de_ruta")
      .update({ published_document_id: inserted.id })
      .eq("job_id", jobId)
      .select("id")
      .maybeSingle();

    if (publishError || !publishedHoja) {
      // Keep the new document intact for diagnosis/retry, but never notify the
      // crew when the canonical pointer was not committed.
      throw publishError || new Error("No se pudo marcar la Hoja de Ruta como publicada");
    }
  }

  // Cleanup only after the new row and, for Hoja, the canonical pointer exist.
  if (previousDocs.length) {
    const previousIds = previousDocs.map((doc) => doc.id);
    const previousPaths = previousDocs.map((doc) => doc.file_path);

    const { error: dbDeleteError } = await supabase
      .from("job_documents")
      .delete()
      .in("id", previousIds);

    if (!dbDeleteError && previousPaths.length) {
      const { error: removeError } = await supabase.storage
        .from("job-documents")
        .remove(previousPaths);
      if (removeError) {
        console.warn("No se pudieron limpiar PDFs antiguos de Hoja de Ruta:", removeError);
      }
    } else if (dbDeleteError) {
      console.warn("No se pudieron limpiar referencias antiguas de Hoja de Ruta:", dbDeleteError);
    }
  }

  // Only the canonical crew-facing Hoja triggers document.uploaded.
  if (kind === "hoja_de_ruta") {
    try {
      void supabase.functions.invoke("push", {
        body: {
          action: "broadcast",
          type: "document.uploaded",
          job_id: jobId,
          file_name: sanitizedFileName,
        },
      });
    } catch {
      // Best effort. Publication itself is already committed.
    }
  }

  return inserted;
};
