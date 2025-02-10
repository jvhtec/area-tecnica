
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { Images, ImagePreviews } from "@/types/hoja-de-ruta";

interface ImageUploadSectionProps {
  type: keyof Images;
  label: string;
  images: Images;
  imagePreviews: ImagePreviews;
  onUpload: (type: keyof Images, files: FileList | null) => void;
  onRemove: (type: keyof Images, index: number) => void;
}

export const ImageUploadSection = ({
  type,
  label,
  imagePreviews,
  onUpload,
  onRemove,
}: ImageUploadSectionProps) => {
  return (
    <div className="space-y-4">
      <Label htmlFor={`${type}-upload`}>{label}</Label>
      <Input
        id={`${type}-upload`}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => onUpload(type, e.target.files)}
      />
      {imagePreviews[type]?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {imagePreviews[type].map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`${type} vista previa ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg"
              />
              <button
                onClick={() => onRemove(type, index)}
                className="absolute top-2 right-2 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
