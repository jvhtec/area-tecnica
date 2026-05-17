import { useCallback, useMemo, useState, type ChangeEvent } from "react";

import {
  downloadBlobInBrowser,
  downloadJobDocumentBlob,
  downloadRiderBlob,
  getJobDocumentSignedUrl,
  getRiderSignedUrl,
  uploadJobDocument,
} from "../commands";
import { fetchFestivalDocuments } from "../queries";
import { formatFestivalDateLabel, groupFestivalRiderFiles } from "../selectors";
import type { ArtistRiderFile, JobDocumentEntry } from "../types";

type ToastFn = (props: { description?: string; title: string; variant?: "destructive" }) => void;

export const useFestivalDocuments = ({ jobId, toast }: { jobId?: string; toast: ToastFn }) => {
  const [jobDocuments, setJobDocuments] = useState<JobDocumentEntry[]>([]);
  const [artistRiderFiles, setArtistRiderFiles] = useState<ArtistRiderFile[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!jobId) {
      setJobDocuments([]);
      setArtistRiderFiles([]);
      setIsLoadingDocuments(false);
      return;
    }

    setIsLoadingDocuments(true);
    try {
      const documents = await fetchFestivalDocuments(jobId);
      setJobDocuments(documents.jobDocuments);
      setArtistRiderFiles(documents.artistRiderFiles);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error al cargar documentos",
        description: error.message || "No se pudieron cargar los documentos para este trabajo.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [jobId, toast]);

  const handleJobDocumentView = useCallback(
    async (docEntry: JobDocumentEntry) => {
      try {
        const signedUrl = await getJobDocumentSignedUrl(docEntry);
        if (signedUrl) {
          window.open(signedUrl, "_blank", "noopener");
        }
      } catch (error: any) {
        console.error("Error viewing document:", error);
        toast({
          title: "No se puede abrir el documento",
          description: error.message || "Por favor, inténtalo de nuevo en unos momentos.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleJobDocumentDownload = useCallback(
    async (docEntry: JobDocumentEntry) => {
      try {
        const blob = await downloadJobDocumentBlob(docEntry);
        downloadBlobInBrowser(blob, docEntry.file_name);
      } catch (error: any) {
        console.error("Error downloading document:", error);
        toast({
          title: "Descarga fallida",
          description: error.message || "No se pudo descargar ese archivo.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleRiderView = useCallback(
    async (file: ArtistRiderFile) => {
      try {
        const signedUrl = await getRiderSignedUrl(file);
        if (signedUrl) {
          window.open(signedUrl, "_blank", "noopener");
        }
      } catch (error: any) {
        console.error("Error viewing rider:", error);
        toast({
          title: "No se puede abrir el rider",
          description: error.message || "Por favor, inténtalo de nuevo más tarde.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleRiderDownload = useCallback(
    async (file: ArtistRiderFile) => {
      try {
        const blob = await downloadRiderBlob(file);
        downloadBlobInBrowser(blob, file.file_name);
      } catch (error: any) {
        console.error("Error downloading rider:", error);
        toast({
          title: "Descarga fallida",
          description: error.message || "No se pudo descargar ese archivo de rider.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleDocumentUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !jobId) return;

      setIsUploadingDocument(true);
      try {
        await uploadJobDocument({ file, jobId });
        toast({
          title: "Éxito",
          description: "Documento subido exitosamente",
        });
        fetchDocuments();
      } catch (error: any) {
        console.error("Error uploading document:", error);
        toast({
          title: "Error al subir",
          description: error.message || "Error al subir documento",
          variant: "destructive",
        });
      } finally {
        setIsUploadingDocument(false);
        event.target.value = "";
      }
    },
    [fetchDocuments, jobId, toast],
  );

  const groupedRiderFiles = useMemo(() => groupFestivalRiderFiles(artistRiderFiles), [artistRiderFiles]);

  return {
    artistRiderFiles,
    fetchDocuments,
    formatDateLabel: formatFestivalDateLabel,
    groupedRiderFiles,
    handleDocumentUpload,
    handleJobDocumentDownload,
    handleJobDocumentView,
    handleRefreshDocuments: fetchDocuments,
    handleRiderDownload,
    handleRiderView,
    isLoadingDocuments,
    isUploadingDocument,
    jobDocuments,
  };
};
