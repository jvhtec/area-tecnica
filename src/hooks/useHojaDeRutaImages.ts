import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  HojaDeRutaImageRecord,
  ImagePreviews,
  Images,
} from "@/types/hoja-de-ruta";

const IMAGE_BUCKET = "job-documents";

type ManagedImage = {
  id: string;
  imageType: "venue" | "venue_map";
  previewUrl: string;
  storagePath?: string;
  file?: File;
};

const extensionForBlob = (blob: Blob) => {
  const subtype = blob.type.split("/")[1]?.split("+")[0]?.replace(/[^a-z0-9]/gi, "");
  return subtype || "jpg";
};

const blobFromPreview = async (previewUrl: string): Promise<Blob> => {
  const response = await fetch(previewUrl);
  if (!response.ok) {
    throw new Error(`No se pudo preparar una imagen para guardar (HTTP ${response.status})`);
  }
  return response.blob();
};

const isDurableStoragePath = (value?: string | null) =>
  Boolean(value && !value.startsWith("blob:") && !value.startsWith("data:"));

export const useHojaDeRutaImages = () => {
  const [managedImages, setManagedImages] = useState<ManagedImage[]>([]);
  const [removedStoragePaths, setRemovedStoragePaths] = useState<string[]>([]);
  const hydratedKeyRef = useRef<string | null>(null);

  const venueItems = useMemo(
    () => managedImages.filter((item) => item.imageType === "venue"),
    [managedImages],
  );
  const venueMapItem = useMemo(
    () => managedImages.find((item) => item.imageType === "venue_map") || null,
    [managedImages],
  );

  const images = useMemo<Images>(() => ({
    venue: venueItems.flatMap((item) => item.file ? [item.file] : []),
  }), [venueItems]);

  const imagePreviews = useMemo<ImagePreviews>(() => ({
    venue: venueItems.map((item) => item.previewUrl),
  }), [venueItems]);

  const venueMap = venueMapItem?.file || null;
  const venueMapPreview = venueMapItem?.previewUrl || null;

  const replaceVenueMap = useCallback((next: ManagedImage | null) => {
    setManagedImages((current) => {
      const existing = current.find((item) => item.imageType === "venue_map");
      if (existing?.storagePath && existing.storagePath !== next?.storagePath) {
        setRemovedStoragePaths((paths) => Array.from(new Set([...paths, existing.storagePath!])));
      }
      if (existing?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(existing.previewUrl);
      }
      return [
        ...current.filter((item) => item.imageType !== "venue_map"),
        ...(next ? [next] : []),
      ];
    });
  }, []);

  const handleImageUpload = useCallback((type: keyof Images, files: FileList | null) => {
    if (!files || type !== "venue") return;
    const additions = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      imageType: "venue" as const,
      previewUrl: URL.createObjectURL(file),
      file,
    }));
    setManagedImages((current) => [...current, ...additions]);
  }, []);

  const removeImage = useCallback((type: keyof Images, index: number) => {
    if (type !== "venue") return;
    setManagedImages((current) => {
      const venue = current.filter((item) => item.imageType === "venue");
      const target = venue[index];
      if (!target) return current;
      if (target.storagePath) {
        setRemovedStoragePaths((paths) => Array.from(new Set([...paths, target.storagePath!])));
      }
      if (target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== target.id);
    });
  }, []);

  const handleVenueMapUpload = useCallback((file: File) => {
    replaceVenueMap({
      id: crypto.randomUUID(),
      imageType: "venue_map",
      previewUrl: URL.createObjectURL(file),
      file,
    });
  }, [replaceVenueMap]);

  const handleVenueMapInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVenueMapUpload(file);
  }, [handleVenueMapUpload]);

  const handleVenueMapUrl = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const blob = await response.blob();
      const file = new File([blob], "venue-map.jpg", {
        type: blob.type || "image/jpeg",
      });
      handleVenueMapUpload(file);
    } catch {
      // Static-map previews are optional. A failed preview must never block editing.
    }
  }, [handleVenueMapUpload]);

  const appendVenuePreviews = useCallback((urls: string[]) => {
    if (!urls.length) return;
    setManagedImages((current) => {
      const existing = new Set(current.map((item) => item.previewUrl));
      const additions = urls
        .filter((url) => !existing.has(url))
        .map((url) => ({
          id: crypto.randomUUID(),
          imageType: "venue" as const,
          previewUrl: url,
        }));
      return additions.length ? [...current, ...additions] : current;
    });
  }, []);

  const hydratePersistedImages = useCallback(async (
    jobId: string,
    rows: HojaDeRutaImageRecord[] | null | undefined,
  ) => {
    const signature = `${jobId}:${(rows || []).map((row) => `${row.id}:${row.image_path}`).join("|")}`;
    if (hydratedKeyRef.current === signature) return;

    const hydrated = await Promise.all((rows || []).map(async (row): Promise<ManagedImage | null> => {
      if (!row.image_path || row.image_path.startsWith("blob:")) return null;

      if (row.image_path.startsWith("data:")) {
        return {
          id: row.id || crypto.randomUUID(),
          imageType: row.image_type === "venue_map" ? "venue_map" : "venue",
          previewUrl: row.image_path,
        };
      }

      const { data, error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .createSignedUrl(row.image_path, 60 * 60);

      if (error || !data?.signedUrl) return null;

      return {
        id: row.id || crypto.randomUUID(),
        imageType: row.image_type === "venue_map" ? "venue_map" : "venue",
        previewUrl: data.signedUrl,
        storagePath: row.image_path,
      };
    }));

    setManagedImages((current) => {
      current.forEach((item) => {
        if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      });
      return hydrated.filter((item): item is ManagedImage => Boolean(item));
    });
    setRemovedStoragePaths([]);
    hydratedKeyRef.current = signature;
  }, []);

  const prepareImagesForSave = useCallback(async (jobId: string): Promise<HojaDeRutaImageRecord[]> => {
    const next = [...managedImages];

    for (let index = 0; index < next.length; index += 1) {
      const item = next[index];
      if (item.storagePath) continue;

      const blob = item.file || await blobFromPreview(item.previewUrl);
      const extension = extensionForBlob(blob);
      const storagePath = `hojas-de-ruta/${jobId}/images/${item.id}.${extension}`;

      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(storagePath, blob, {
          cacheControl: "3600",
          contentType: blob.type || "image/jpeg",
          upsert: true,
        });

      if (error) throw error;
      next[index] = { ...item, storagePath };
    }

    setManagedImages(next);

    let venueOrder = 0;
    return next.map((item) => ({
      id: item.id,
      image_path: item.storagePath!,
      image_type: item.imageType,
      sort_order: item.imageType === "venue" ? venueOrder++ : 0,
    }));
  }, [managedImages]);

  const commitImageSave = useCallback(async () => {
    if (removedStoragePaths.length === 0) return;
    const paths = [...removedStoragePaths];
    setRemovedStoragePaths([]);
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
    if (error) {
      // DB is already correct. Keep cleanup failure non-fatal and retry next edit session.
      setRemovedStoragePaths((current) => Array.from(new Set([...current, ...paths])));
    }
  }, [removedStoragePaths]);

  const clearVenueMap = useCallback(() => replaceVenueMap(null), [replaceVenueMap]);

  const imageFingerprint = useMemo(
    () => managedImages.map((item) => ({
      id: item.id,
      imageType: item.imageType,
      storagePath: item.storagePath || null,
      local: !item.storagePath,
    })),
    [managedImages],
  );

  return {
    images,
    imagePreviews,
    venueMap,
    venueMapPreview,
    handleImageUpload,
    removeImage,
    handleVenueMapUpload,
    handleVenueMapInputChange,
    handleVenueMapUrl,
    appendVenuePreviews,
    clearVenueMap,
    hydratePersistedImages,
    prepareImagesForSave,
    commitImageSave,
    imageFingerprint,
  };
};
