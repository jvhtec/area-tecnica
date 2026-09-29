import { Button } from "@/components/ui/button";
import { Image, Upload, X } from "lucide-react";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useFestivalLogo } from "@/features/festival-assets/hooks/useFestivalLogo";

interface FestivalLogoManagerProps {
  jobId: string;
}

/** Shown in place of a logo whose URL no longer loads. */
const BROKEN_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgMTRIMTRWMTZIMTBWMTRaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz48cGF0aCBkPSJNMTIgMUMxNC4yMDkxIDEgMTYgMi43OTA4NiAxNiA1QzE2IDcuMjA5MTQgMTQuMjA5MSA5IDEyIDlDOS43OTA4NiA5IDggNy4yMDkxNCA4IDVDOCAyLjc5MDg2IDkuNzkwODYgMSAxMiAxWiIgZmlsbD0iY3VycmVudENvbG9yIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xIDEzQzEgMTAuNzkwOSAyLjc5MDg2IDkgNSA5SDE5QzIxLjIwOTEgOSAyMyAxMC43OTA5IDIzIDEzVjE5QzIzIDIwLjEwNDYgMjIuMTA0NiAyMSAyMSAyMUgzQzEuODk1NDMgMjEgMSAyMC4xMDQ2IDEgMTlWMTNaTTE5IDExSDVDMy44OTU0MyAxMSAzIDExLjg5NTQgMyAxM0MzIDE1LjIwOTEgNC43OTA5MSAxNyA3IDE3SDE3QzE5LjIwOTEgMTcgMjEgMTUuMjA5MSAyMSAxM0MyMSAxMS44OTU0IDIwLjEwNDYgMTEgMTkgMTFaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz48L3N2Zz4=";

export const FestivalLogoManager = ({ jobId }: FestivalLogoManagerProps) => {
  const { user } = useOptimizedAuth();
  const { logoUrl, isUploading, errorDetails, uploadLogo, deleteLogo } = useFestivalLogo(jobId, user?.id);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires a change.
    event.target.value = "";
    if (file) uploadLogo(file);
  };

  return (
    <div className="space-y-4">
      {logoUrl ? (
        <div className="relative w-48 h-48">
          <img
            src={logoUrl}
            alt="Festival logo"
            width={192}
            height={192}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain"
            onError={(event) => {
              const target = event.currentTarget;
              target.onerror = null;
              target.src = BROKEN_IMAGE_PLACEHOLDER;
            }}
          />
          <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={deleteLogo}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
          <Image className="h-12 w-12 text-gray-400" />
        </div>
      )}

      {errorDetails && <div className="text-sm text-red-500 mt-1">Error: {errorDetails}</div>}

      <div>
        <input
          type="file"
          id="logo-upload"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Button asChild variant="outline" disabled={isUploading}>
          <label htmlFor="logo-upload" className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Subiendo..." : "Subir Logo"}
          </label>
        </Button>
      </div>
    </div>
  );
};
