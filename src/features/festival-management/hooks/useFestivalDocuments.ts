import { useCallback, useEffect, useMemo, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  downloadBlobInBrowser,
  downloadJobDocumentBlob,
  downloadRiderBlob,
  getJobDocumentSignedUrl,
  getRiderSignedUrl,
  uploadJobDocument,
} from "@/features/festival-management/commands";
import { fetchFestivalDocuments } from "@/features/festival-management/queries";
import { formatFestivalDateLabel, groupFestivalRiderFiles } from "@/features/festival-management/selectors";
import type { ArtistRiderFile, JobDocumentEntry } from "@/features/festival-management/types";
import { queryKeys } from "@/lib/react-query";

type ToastFn = (props: { description?: string; title: string; variant?: "destructive" }) => void;

const EMPTY_ARTIST_RIDER_FILES: ArtistRiderFile[] = [];
const EMPTY_JOB_DOCUMENTS: JobDocumentEntry[] = [];

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export const useFestivalDocuments = ({ jobId, toast }: { jobId?: string; toast: ToastFn }) => {
  const queryClient = useQueryClient();
  const documentsQueryKey = useMemo(() => queryKeys.scope("festival-documents", jobId ?? "none"), [jobId]);
  const {
    data: documents,
    error: documentsError,
    isFetching: isLoadingDocuments,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: documentsQueryKey,
    enabled: Boolean(jobId),
    staleTime: 0,
    queryFn: () => {
      if (!jobId) {
        return Promise.resolve({ artistRiderFiles: [], jobDocuments: [] });
      }

      return fetchFestivalDocuments(jobId);
    },
  });

  useEffect(() => {
    if (!documentsError) {
      return;
    }

    console.error("Error fetching documents:", documentsError);
    toast({
      title: "Error al cargar documentos",
      description: getErrorMessage(documentsError, "No se pudieron cargar los documentos para este trabajo."),
      variant: "destructive",
    });
  }, [documentsError, toast]);

  const fetchDocuments = useCallback(async () => {
    if (!jobId) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    await refetchDocuments();
  }, [documentsQueryKey, jobId, queryClient, refetchDocuments]);

  const { isPending: isUploadingDocument, mutateAsync: uploadDocument } = useMutation({
    mutationFn: (file: File) => {
      if (!jobId) {
        throw new Error("No se encontró el trabajo.");
      }

      return uploadJobDocument({ file, jobId });
    },
    onSuccess: async () => {
      toast({
        title: "Éxito",
        description: "Documento subido exitosamente",
      });
      await queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    },
    onError: (error) => {
      console.error("Error uploading document:", error);
      toast({
        title: "Error al subir",
        description: getErrorMessage(error, "Error al subir documento"),
        variant: "destructive",
      });
    },
  });

  const jobDocuments = documents?.jobDocuments ?? EMPTY_JOB_DOCUMENTS;
  const artistRiderFiles = documents?.artistRiderFiles ?? EMPTY_ARTIST_RIDER_FILES;

  const handleJobDocumentView = useCallback(
    async (docEntry: JobDocumentEntry) => {
      try {
        const signedUrl = await getJobDocumentSignedUrl(docEntry);
        if (signedUrl) {
          window.open(signedUrl, "_blank", "noopener");
        }
      } catch (error) {
        console.error("Error viewing document:", error);
        toast({
          title: "No se puede abrir el documento",
          description: getErrorMessage(error, "Por favor, inténtalo de nuevo en unos momentos."),
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
      } catch (error) {
        console.error("Error downloading document:", error);
        toast({
          title: "Descarga fallida",
          description: getErrorMessage(error, "No se pudo descargar ese archivo."),
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
      } catch (error) {
        console.error("Error viewing rider:", error);
        toast({
          title: "No se puede abrir el rider",
          description: getErrorMessage(error, "Por favor, inténtalo de nuevo más tarde."),
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
      } catch (error) {
        console.error("Error downloading rider:", error);
        toast({
          title: "Descarga fallida",
          description: getErrorMessage(error, "No se pudo descargar ese archivo de rider."),
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleDocumentUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !jobId) {
        event.target.value = "";
        return;
      }

      try {
        await uploadDocument(file);
      } finally {
        event.target.value = "";
      }
    },
    [jobId, uploadDocument],
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
