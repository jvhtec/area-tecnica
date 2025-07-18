
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
    setVenueMap(file);
    const preview = URL.createObjectURL(file);
    setVenueMapPreview(preview);
  };

  const handleVenueMapInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleVenueMapUpload(e.target.files[0]);
    }
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
  };
};
