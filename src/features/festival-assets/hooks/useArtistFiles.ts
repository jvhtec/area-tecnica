import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import { downloadBlobInBrowser } from "@/features/festival-management/commands";
import { getDocumentUploadValidationError } from "@/utils/documentUploadValidation";
import { getErrorMessage } from "@/utils/errorMessage";
import {
  deleteArtistFile,
  downloadArtistFileBlob,
  fetchArtistFiles,
  signArtistFileUrl,
  uploadArtistFiles,
  type ArtistFileRow,
} from "../api";
import { festivalAssetKeys } from "../keys";

const NO_FILES: ArtistFileRow[] = [];

/** An artist's rider files: list, upload a batch, delete, download and preview. */
export function useArtistFiles(artistId: string, open: boolean) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const key = festivalAssetKeys.artistFiles(artistId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchArtistFiles(artistId),
    enabled: open && !!artistId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!query.error) return;
    void trackError(query.error, { system: "festivals", operation: "load-artist-files", artistId });
    toast({ title: "Error", description: "No se pudieron obtener los archivos", variant: "destructive" });
  }, [query.error, artistId, toast]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const upload = useMutation({
    mutationFn: (files: File[]) => uploadArtistFiles(artistId, files),
    onSuccess: ({ riderStateUpdated }, files) => {
      const description = files.length === 1 ? "Archivo cargado correctamente" : `${files.length} archivos cargados correctamente`;
      toast({
        title: riderStateUpdated ? "Éxito" : "Carga completada con aviso",
        description: riderStateUpdated
          ? description
          : `${description}, pero no se pudo actualizar el estado del rider.`,
      });
      void refresh();
    },
    onError: (error) => {
      void trackError(error, { system: "festivals", operation: "upload-artist-files", artistId });
      toast({
        title: "Error",
        description: getErrorMessage(
          error,
          "No se pudo completar la carga. Se han revertido los archivos de esta tanda.",
        ),
        variant: "destructive",
      });
    },
  });

  const remove = useMutation({
    mutationFn: (fileId: string) => deleteArtistFile(fileId),
    onSuccess: () => {
      toast({ title: "Éxito", description: "Archivo eliminado correctamente" });
      void refresh();
    },
    onError: (error) => {
      void trackError(error, { system: "festivals", operation: "delete-artist-file", artistId });
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo eliminar el archivo"),
        variant: "destructive",
      });
    },
  });

  const uploadFiles = (files: File[]) => {
    if (files.length === 0) return;
    const validationError = getDocumentUploadValidationError(files);
    if (validationError) {
      toast({ title: "Archivo no permitido", description: validationError, variant: "destructive" });
      return;
    }
    upload.mutate(files);
  };

  const downloadFile = async (file: Pick<ArtistFileRow, "file_path" | "file_name">) => {
    try {
      downloadBlobInBrowser(await downloadArtistFileBlob(file.file_path), file.file_name);
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "download-artist-file", artistId });
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo descargar el archivo"),
        variant: "destructive",
      });
    }
  };

  /** Preview URL of a file, or `null` (with a message shown) when it cannot be signed. */
  const getPreviewUrl = async (file: Pick<ArtistFileRow, "file_path">): Promise<string | null> => {
    try {
      return await signArtistFileUrl(file.file_path);
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "preview-artist-file", artistId });
      toast({ title: "Error", description: "No se pudo ver el archivo", variant: "destructive" });
      return null;
    }
  };

  return {
    files: query.data ?? NO_FILES,
    isUploading: upload.isPending,
    uploadFiles,
    deleteFile: (fileId: string) => remove.mutateAsync(fileId).catch(() => undefined),
    downloadFile,
    getPreviewUrl,
  };
}
