
import { useState } from "react";
import { Images, ImagePreviews } from "@/types/hoja-de-ruta";

export const useHojaDeRutaImages = () => {
  const [images, setImages] = useState<Images>({
    venue: [],
  });

  const [imagePreviews, setImagePreviews] = useState<ImagePreviews>({
    venue: [],
  });

  const [venueMap, setVenueMap] = useState<File | null>(null);
  const [venueMapPreview, setVenueMapPreview] = useState<string | null>(null);

  const handleImageUpload = (
    type: keyof Images,
    files: FileList | null
  ) => {
    if (!files) return;
    const fileArray = Array.from(files);
    const newImages = [...(images[type] || []), ...fileArray];
    setImages({ ...images, [type]: newImages });

    const previews = fileArray.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), ...previews],
    }));
  };

  const removeImage = (type: keyof Images, index: number) => {
    const newImages = [...images[type]];
    const newPreviews = [...imagePreviews[type]];
    URL.revokeObjectURL(newPreviews[index]);
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);
    setImages({ ...images, [type]: newImages });
    setImagePreviews({ ...imagePreviews, [type]: newPreviews });
  };

  const handleVenueMapUpload = (file: File) => {
    console.log("🗺️ Venue map uploaded:", file.name, file.size);
    setVenueMap(file);
    const preview = URL.createObjectURL(file);
    setVenueMapPreview(preview);
    console.log("🗺️ Venue map preview created:", preview);
  };

  const handleVenueMapInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleVenueMapUpload(e.target.files[0]);
    }
  };

  const handleVenueMapUrl = async (url: string) => {
    console.log("🗺️ Fetching venue map from URL:", url);
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        console.log("🗺️ Venue map image loaded successfully");
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              console.log("🗺️ Venue map blob created, size:", blob.size);
              const file = new File([blob], "venue-map.jpg", {
                type: "image/jpeg",
              });
              handleVenueMapUpload(file);
            }
          }, "image/jpeg");
        }
      };
      img.onerror = (error) => {
        console.error("🗺️ Error loading venue map image:", error);
      };
      img.src = url;
    } catch (error) {
      console.error("🗺️ Error fetching venue map from URL:", error);
    }
  };

  // Append externally-fetched previews (e.g., Google Places photos)
  const appendVenuePreviews = (dataUrls: string[]) => {
    if (!dataUrls || dataUrls.length === 0) return;
    setImagePreviews((prev) => {
      const existing = new Set(prev.venue);
      const toAdd: string[] = [];
      for (const url of dataUrls) {
        if (!existing.has(url)) toAdd.push(url);
      }
      if (toAdd.length === 0) return prev;
      return { ...prev, venue: [...prev.venue, ...toAdd] };
    });
  };

  // Clear venue map when needed
  const clearVenueMap = () => {
    console.log("🗺️ Clearing venue map");
    if (venueMapPreview) {
      URL.revokeObjectURL(venueMapPreview);
    }
    setVenueMap(null);
    setVenueMapPreview(null);
  };

  return {
    images,
    setImages,
    imagePreviews,
    setImagePreviews,
    venueMap,
    setVenueMap,
    venueMapPreview,
    setVenueMapPreview,
    handleImageUpload,
    removeImage,
    handleVenueMapUpload,
    handleVenueMapInputChange,
    handleVenueMapUrl,
    appendVenuePreviews,
    clearVenueMap,
  };
};
