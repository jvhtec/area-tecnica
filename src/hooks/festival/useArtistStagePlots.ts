import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent as ReactClipboardEvent } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { getOfflineFileBlob, isBrowserOnline } from "@/lib/offline";
import { dataLayerClient } from "@/services/dataLayerClient";
import { optimizeImageForUpload, validateImageFile } from "@/utils/imageOptimization";
import type { Artist } from "@/components/festival/artistTableTypes";

export const useArtistStagePlots = (artists: Artist[], onArtistStagePlotUpdated?: () => void) => {
  const confirm = useConfirm();
  const [stagePlotUrls, setStagePlotUrls] = useState<Record<string, string>>({});
  const [selectedStagePlotArtist, setSelectedStagePlotArtist] = useState<Artist | null>(null);
  const [stagePlotDialogOpen, setStagePlotDialogOpen] = useState(false);
  const [uploadingStagePlotArtistId, setUploadingStagePlotArtistId] = useState<string | null>(null);
  const [deletingStagePlotArtistId, setDeletingStagePlotArtistId] = useState<string | null>(null);
  const [isClipboardReading, setIsClipboardReading] = useState(false);
  const stagePlotInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls: string[] = [];

    const loadStagePlotUrls = async () => {
      const artistsWithPlot = artists.filter((artist) => Boolean(artist.stage_plot_file_path));

      if (artistsWithPlot.length === 0) {
        if (!isCancelled) {
          setStagePlotUrls({});
        }
        return;
      }

      const nextUrls: Record<string, string> = {};

      await Promise.all(
        artistsWithPlot.map(async (artist) => {
          if (!artist.stage_plot_file_path) return;

          // Cached blob first: renders offline and skips the signed-URL
          // round-trip when the festival was downloaded.
          const cachedBlob = await getOfflineFileBlob("festival_artist_files", artist.stage_plot_file_path);
          // Cleanup may have already revoked the tracked URLs; creating one
          // now would leak it
          if (isCancelled) return;
          if (cachedBlob) {
            const objectUrl = URL.createObjectURL(cachedBlob);
            objectUrls.push(objectUrl);
            nextUrls[artist.id] = objectUrl;
            return;
          }

          if (!isBrowserOnline()) return;
          const { data, error } = await dataLayerClient.storage
            .from("festival_artist_files")
            .createSignedUrl(artist.stage_plot_file_path, 60 * 60);

          if (!error && data?.signedUrl) {
            nextUrls[artist.id] = data.signedUrl;
          }
        })
      );

      if (!isCancelled) {
        setStagePlotUrls(nextUrls);
      }
    };

    loadStagePlotUrls();

    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [artists]);

  const handleOpenStagePlotCapture = (artist: Artist) => {
    setSelectedStagePlotArtist(artist);
    setStagePlotDialogOpen(true);
  };

  const uploadStagePlotFile = async (artist: Artist, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El stage plot debe ser una imagen.");
      return;
    }

    const validation = validateImageFile(file, 10);
    if (!validation.valid) {
      toast.error(validation.error || "El stage plot no es válido.");
      return;
    }

    setUploadingStagePlotArtistId(artist.id);

    try {
      const uploadFile = await optimizeImageForUpload(file, {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 0.82,
        outputFormat: "image/webp",
      });
      const fileExtension = uploadFile.name.split(".").pop() || "webp";
      const nextFilePath = `${artist.id}/stage-plots/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;

      const { error: uploadError } = await dataLayerClient.storage
        .from("festival_artist_files")
        .upload(nextFilePath, uploadFile, {
          contentType: uploadFile.type || file.type,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: updateError } = await dataLayerClient.from("festival_artists")
        .update({
          stage_plot_file_path: nextFilePath,
          stage_plot_file_name: file.name,
          stage_plot_file_type: uploadFile.type || file.type,
          stage_plot_uploaded_at: new Date().toISOString(),
        })
        .eq("id", artist.id);

      if (updateError) {
        await dataLayerClient.storage.from("festival_artist_files").remove([nextFilePath]);
        throw updateError;
      }

      if (
        artist.stage_plot_file_path &&
        artist.stage_plot_file_path !== nextFilePath
      ) {
        await dataLayerClient.storage
          .from("festival_artist_files")
          .remove([artist.stage_plot_file_path]);
      }

      onArtistStagePlotUpdated?.();
      toast.success(`Stage plot actualizado para ${artist.name}.`);
      setStagePlotDialogOpen(false);
      setSelectedStagePlotArtist(null);
    } catch (error) {
      console.error("Error uploading stage plot:", error);
      toast.error("No se pudo cargar el stage plot.");
    } finally {
      setUploadingStagePlotArtistId(null);
    }
  };

  const handleStagePlotUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedStagePlotArtist) return;
    await uploadStagePlotFile(selectedStagePlotArtist, file);
  };

  const handleStagePlotPaste = async (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (!selectedStagePlotArtist) return;
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) {
      toast.error("No se detectó ninguna imagen en el portapapeles.");
      return;
    }

    const imageFile = imageItem.getAsFile();
    if (!imageFile) {
      toast.error("No se pudo leer la imagen del portapapeles.");
      return;
    }

    event.preventDefault();
    await uploadStagePlotFile(selectedStagePlotArtist, imageFile);
  };

  const handleReadClipboardImage = async () => {
    if (!selectedStagePlotArtist) return;

    if (!navigator.clipboard?.read) {
      toast.error("Tu navegador no permite leer imágenes del portapapeles en este contexto.");
      return;
    }

    setIsClipboardReading(true);
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const clipboardFile = new File([blob], `stage-plot-${Date.now()}.png`, { type: blob.type });
        await uploadStagePlotFile(selectedStagePlotArtist, clipboardFile);
        return;
      }

      toast.error("No se encontró ninguna imagen en el portapapeles.");
    } catch (error) {
      console.error("Error reading image from clipboard:", error);
      toast.error("No se pudo leer la imagen del portapapeles.");
    } finally {
      setIsClipboardReading(false);
    }
  };

  const handleDeleteStagePlot = async (artist: Artist) => {
    if (!artist.stage_plot_file_path) return;

    const confirmed = await confirm({
      title: "Eliminar stage plot",
      description: `¿Eliminar el stage plot de ${artist.name}?`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setDeletingStagePlotArtistId(artist.id);
    try {
      const currentPath = artist.stage_plot_file_path;

      const { error: updateError } = await dataLayerClient.from("festival_artists")
        .update({
          stage_plot_file_path: null,
          stage_plot_file_name: null,
          stage_plot_file_type: null,
          stage_plot_uploaded_at: null,
        })
        .eq("id", artist.id);

      if (updateError) {
        throw updateError;
      }

      await dataLayerClient.storage.from("festival_artist_files").remove([currentPath]);

      setStagePlotUrls((previous) => {
        const updated = { ...previous };
        delete updated[artist.id];
        return updated;
      });

      onArtistStagePlotUpdated?.();
      if (selectedStagePlotArtist?.id === artist.id) {
        setStagePlotDialogOpen(false);
        setSelectedStagePlotArtist(null);
      }
      toast.success(`Stage plot eliminado para ${artist.name}.`);
    } catch (error) {
      console.error("Error deleting stage plot:", error);
      toast.error("No se pudo eliminar el stage plot.");
    } finally {
      setDeletingStagePlotArtistId(null);
    }
  };

  return {
    deletingStagePlotArtistId,
    handleDeleteStagePlot,
    handleOpenStagePlotCapture,
    handleReadClipboardImage,
    handleStagePlotPaste,
    handleStagePlotUpload,
    isClipboardReading,
    selectedStagePlotArtist,
    setSelectedStagePlotArtist,
    setStagePlotDialogOpen,
    stagePlotDialogOpen,
    stagePlotInputRef,
    stagePlotUrls,
    uploadingStagePlotArtistId,
  };
};
