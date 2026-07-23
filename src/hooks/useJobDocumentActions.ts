import { useState } from "react";
import { toast } from "sonner";

import { dataLayerClient } from "@/services/dataLayerClient";
import type { JobDocument } from "@/types/job";
import { createSignedUrl } from "@/utils/jobDocuments";

export const useJobDocumentActions = () => {
  const [documentLoading, setDocumentLoading] = useState<Set<string>>(new Set());

  const withLoadingDocument = async (docId: string, action: () => Promise<void>) => {
    setDocumentLoading((current) => new Set(current).add(docId));
    try {
      await action();
    } finally {
      setDocumentLoading((current) => {
        const next = new Set(current);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleViewDocument = (doc: JobDocument) => withLoadingDocument(doc.id, async () => {
    try {
      const url = await createSignedUrl(dataLayerClient, doc.file_path, 60);
      window.open(url, "_blank");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error(`No se pudo abrir el documento: ${message}`);
    }
  });

  const handleDownload = (doc: JobDocument) => withLoadingDocument(doc.id, async () => {
    try {
      const url = await createSignedUrl(dataLayerClient, doc.file_path, 60);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error(`No se pudo descargar el documento: ${message}`);
    }
  });

  return { documentLoading, handleDownload, handleViewDocument };
};
