import { useCallback, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import { uploadPublicArtistRiderFiles } from "@/utils/publicArtistRiderUpload";
import type { RiderFileRecord } from "@/components/festival/artistRequirementsFormModel";

type Options = {
  token?: string;
  publicArtistId: string | null;
  formLanguage: "es" | "en";
  tx: (spanish: string, english: string) => string;
};

export const usePublicArtistRiderFiles = ({ token, publicArtistId, formLanguage, tx }: Options) => {
  const { toast } = useToast();
  const [riderFiles, setRiderFiles] = useState<RiderFileRecord[]>([]);
  const [isUploadingRider, setIsUploadingRider] = useState(false);
  const [deletingRiderId, setDeletingRiderId] = useState<string | null>(null);

  const formatUploadedAt = useCallback(
    (uploadedAt: string | null) => {
      if (!uploadedAt) return tx("Fecha desconocida", "Unknown date");
      const date = new Date(uploadedAt);
      if (Number.isNaN(date.getTime())) return tx("Fecha desconocida", "Unknown date");
      return new Intl.DateTimeFormat(formLanguage === "en" ? "en-GB" : "es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Madrid",
      }).format(date);
    },
    [formLanguage, tx]
  );

  const formatFileSize = useCallback(
    (value: number | null) => {
      if (!value || value <= 0) return tx("Tamaño desconocido", "Unknown size");
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    },
    [tx]
  );

  const openRiderFile = useCallback(
    async (file: RiderFileRecord) => {
      try {
        const { data, error } = await dataLayerClient.storage
          .from("festival_artist_files")
          .createSignedUrl(file.file_path, 60 * 60);

        if (error || !data?.signedUrl) {
          throw error ?? new Error("Could not create signed URL");
        }

        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("Error opening rider file:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudo abrir el rider.", "Could not open rider file."),
          variant: "destructive",
        });
      }
    },
    [toast, tx]
  );

  const downloadRiderFile = useCallback(
    async (file: RiderFileRecord) => {
      try {
        const { data, error } = await dataLayerClient.storage
          .from("festival_artist_files")
          .download(file.file_path);

        if (error || !data) {
          throw error ?? new Error("Could not download file");
        }

        const url = window.URL.createObjectURL(data);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = file.file_name;
        window.document.body.appendChild(anchor);
        anchor.click();
        window.document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error downloading rider file:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudo descargar el rider.", "Could not download rider file."),
          variant: "destructive",
        });
      }
    },
    [toast, tx]
  );

  const handleRiderUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const selectedFiles = Array.from(input.files || []);
      if (selectedFiles.length === 0) return;

      if (!token || !publicArtistId) {
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudo identificar este formulario público.", "Could not identify this public form."),
          variant: "destructive",
        });
        input.value = "";
        return;
      }

      setIsUploadingRider(true);

      try {
        const uploaded = await uploadPublicArtistRiderFiles(token, selectedFiles);

        setRiderFiles((prev) => {
          const deduped = prev.filter((existing) => !uploaded.some((nextFile) => nextFile.id === existing.id));
          return [...uploaded, ...deduped];
        });

        toast({
          title: tx("Éxito", "Success"),
          description:
            uploaded.length > 1
              ? tx("Riders cargados correctamente.", "Rider files uploaded successfully.")
              : tx("Rider cargado correctamente.", "Rider uploaded successfully."),
        });
      } catch (error) {
        console.error("Error uploading rider file:", error);
        const uploadErrorMessage = error instanceof Error ? error.message : "";
        toast({
          title: tx("Error", "Error"),
          description: uploadErrorMessage || tx(
            "No se pudo cargar el rider. Inténtalo de nuevo.",
            "Could not upload rider file. Please try again."
          ),
          variant: "destructive",
        });
      } finally {
        setIsUploadingRider(false);
        input.value = "";
      }
    },
    [publicArtistId, toast, token, tx]
  );

  const handleDeleteRider = useCallback(
    async (file: RiderFileRecord) => {
      if (!token || !file.id) return;
      setDeletingRiderId(file.id);

      try {
        const { data, error } = await dataLayerClient.functions.invoke("delete-public-artist-rider", {
          body: {
            token,
            fileId: file.id,
          },
        });

        if (error) {
          throw error;
        }

        const response = data as { ok?: boolean; error?: string } | null;
        if (!response?.ok) {
          throw new Error(response?.error || "delete_failed");
        }

        setRiderFiles((prev) => prev.filter((item) => item.id !== file.id));

        toast({
          title: tx("Éxito", "Success"),
          description: tx("Rider eliminado.", "Rider file deleted."),
        });
      } catch (error) {
        console.error("Error deleting rider file:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudo eliminar el rider.", "Could not delete rider file."),
          variant: "destructive",
        });
      } finally {
        setDeletingRiderId(null);
      }
    },
    [toast, token, tx]
  );

  return {
    deletingRiderId,
    downloadRiderFile,
    formatFileSize,
    formatUploadedAt,
    handleDeleteRider,
    handleRiderUpload,
    isUploadingRider,
    openRiderFile,
    riderFiles,
    setRiderFiles,
  };
};
