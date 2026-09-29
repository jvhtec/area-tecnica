import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import { validateImageFile } from "@/utils/imageOptimization";
import { getErrorMessage } from "@/utils/errorMessage";
import { deleteFestivalLogo, fetchFestivalLogoDisplayUrl, uploadFestivalLogo } from "../api";
import { festivalAssetKeys } from "../keys";

const MAX_LOGO_MB = 5;

/** The festival's logo with upload and delete, for people who manage the festival. */
export function useFestivalLogo(jobId: string, userId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const key = festivalAssetKeys.logo(jobId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchFestivalLogoDisplayUrl(jobId),
    enabled: !!jobId,
    // The URL is signed for an hour; never show a stale one.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const reportError = (error: unknown, fallback: string, operation: string) => {
    void trackError(error, { system: "festivals", operation, jobId });
    const message = getErrorMessage(error, fallback);
    setErrorDetails(message);
    toast({ title: "Error", description: message, variant: "destructive" });
  };

  const upload = useMutation({
    mutationFn: (file: File) => uploadFestivalLogo({ jobId, file, userId: userId! }),
    onSuccess: (url) => {
      queryClient.setQueryData(key, url);
      void queryClient.invalidateQueries({ queryKey: festivalAssetKeys.listLogos() });
      toast({ title: "Éxito", description: "El logo del festival ha sido actualizado" });
    },
    onError: (error) => reportError(error, "No se pudo subir el logo", "upload-festival-logo"),
  });

  const remove = useMutation({
    mutationFn: () => deleteFestivalLogo(jobId),
    onSuccess: (deleted) => {
      if (!deleted) return;
      queryClient.setQueryData(key, null);
      void queryClient.invalidateQueries({ queryKey: festivalAssetKeys.listLogos() });
      toast({ title: "Éxito", description: "El logo del festival ha sido eliminado" });
    },
    onError: (error) => reportError(error, "No se pudo eliminar el logo", "delete-festival-logo"),
  });

  const uploadLogo = (file: File) => {
    setErrorDetails(null);

    const validation = validateImageFile(file, MAX_LOGO_MB);
    if (!validation.valid) {
      toast({
        title: "Tipo de archivo inválido",
        description: validation.error || "Por favor sube un archivo de imagen",
        variant: "destructive",
      });
      return;
    }
    if (!userId) {
      toast({
        title: "Autenticación requerida",
        description: "Debes iniciar sesión para subir logos",
        variant: "destructive",
      });
      return;
    }
    upload.mutate(file);
  };

  const deleteLogo = () => {
    setErrorDetails(null);
    if (!userId) {
      toast({
        title: "Autenticación requerida",
        description: "Debes iniciar sesión para eliminar logos",
        variant: "destructive",
      });
      return;
    }
    remove.mutate();
  };

  const loadError = query.error ? getErrorMessage(query.error, "Error desconocido") : null;

  return {
    logoUrl: query.data ?? null,
    isUploading: upload.isPending,
    errorDetails: errorDetails ?? loadError,
    uploadLogo,
    deleteLogo,
  };
}
