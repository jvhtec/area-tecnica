import { useState } from "react";
import { toast } from "sonner";

import { dataLayerClient } from "@/services/dataLayerClient";
import type { JobDocument } from "@/types/job";
import { createSignedUrl, resolveJobDocLocation } from "@/utils/jobDocuments";

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
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      // Fetch as a blob rather than assigning a signed (cross-origin) URL to an
      // anchor's `download` attribute: browsers ignore that attribute across
      // origins, so it would open/navigate instead of downloading.
      const { bucket, path } = resolveJobDocLocation(doc.file_path);
      const { data, error } = await dataLayerClient.storage.from(bucket).download(path);
      if (error || !data) throw error || new Error("No se pudo descargar el documento");

      url = window.URL.createObjectURL(data);
      link = document.createElement("a");
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error(`No se pudo descargar el documento: ${message}`);
    } finally {
      link?.remove();
      if (url) window.URL.revokeObjectURL(url);
    }
  });

  return { documentLoading, handleDownload, handleViewDocument };
};
