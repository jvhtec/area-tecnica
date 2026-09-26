import { supabase } from "@/lib/supabase";
import { reportHojaError } from "@/features/hoja-de-ruta/lib/hojaLogger";

export type HojaPdfDocumentKind = "hoja_de_ruta" | "certificado_entrega";

const HOJA_PDF_FOLDER_BY_KIND: Record<HojaPdfDocumentKind, string> = {
  hoja_de_ruta: "hojas-de-ruta",
  certificado_entrega: "certificados-entrega",
};

interface UploadPdfToJobOptions {
  kind?: HojaPdfDocumentKind;
  expectedDocumentVersion?: number;
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
  const filePath = `${folderPath}/${crypto.randomUUID()}-${sanitizedFileName}`;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id || null;

  // Non-published document kinds can use ordinary replacement cleanup. The
  // canonical Hoja path is finalized by one database transaction below.
  let previousDocs: Array<{ id: string; file_path: string }> = [];
  if (kind !== "hoja_de_ruta") {
    const { data: existingDocs, error: snapshotError } = await supabase
      .from("job_documents")
      .select("id,file_path")
      .eq("job_id", jobId)
      .like("file_path", `${folderPath}/%`)
      .order("uploaded_at", { ascending: false });

    if (snapshotError) throw snapshotError;
    previousDocs = (existingDocs || []).filter((doc) => doc.file_path !== filePath);
  }

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

  let previousPaths: string[] = [];

  if (kind === "hoja_de_ruta") {
    if (options.expectedDocumentVersion === undefined) {
      await supabase.from("job_documents").delete().eq("id", inserted.id);
      await supabase.storage.from("job-documents").remove([filePath]);
      throw new Error("Falta la versión esperada para publicar la Hoja de Ruta");
    }
    const { data: retiredPaths, error: publishError } = await supabase.rpc(
      "publish_hoja_de_ruta_document",
      {
        p_job_id: jobId,
        p_document_id: inserted.id,
        p_expected_version: options.expectedDocumentVersion,
      },
    );

    if (publishError) {
      await supabase.from("job_documents").delete().eq("id", inserted.id);
      await supabase.storage.from("job-documents").remove([filePath]);
      throw publishError;
    }
    previousPaths = Array.isArray(retiredPaths) ? retiredPaths : [];
  } else if (previousDocs.length) {
    const previousIds = previousDocs.map((doc) => doc.id);
    previousPaths = previousDocs.map((doc) => doc.file_path);

    const { error: dbDeleteError } = await supabase
      .from("job_documents")
      .delete()
      .in("id", previousIds);

    if (dbDeleteError) {
      reportHojaError("pdfUpload.oldReferences.cleanup", dbDeleteError);
      previousPaths = [];
    }
  }

  if (previousPaths.length) {
    const { error: removeError } = await supabase.storage
      .from("job-documents")
      .remove(previousPaths);
    if (removeError) {
      reportHojaError("pdfUpload.oldObjects.cleanup", removeError);
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
