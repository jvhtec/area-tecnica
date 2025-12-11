import { useState, useRef, useEffect } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ScreenshotCaptureProps {
  onScreenshotCapture: (screenshot: string, filename: string) => void;
  onClear?: () => void;
  currentScreenshot?: string;
}

export function ScreenshotCapture({
  onScreenshotCapture,
  onClear,
  currentScreenshot,
}: ScreenshotCaptureProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentScreenshot || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync previewUrl with currentScreenshot prop to avoid stale previews
  useEffect(() => {
    setPreviewUrl(currentScreenshot || null);
  }, [currentScreenshot]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecciona un archivo de imagen válido.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen es demasiado grande. El tamaño máximo es 5MB.");
      return;
    }

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);
      onScreenshotCapture(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleCapture = async () => {
    let stream: MediaStream | null = null;
    try {
      // Try to capture screen using modern API
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: "screen" } as MediaTrackConstraints,
        });

        // Create video element to capture frame
        const video = document.createElement("video");
        video.srcObject = stream;
        video.play();

        // Wait for video to load
        await new Promise((resolve) => {
          video.onloadedmetadata = resolve;
        });

        // Create canvas and capture frame
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          setPreviewUrl(dataUrl);
          onScreenshotCapture(dataUrl, "screenshot.png");
        }
      } else {
        // Fallback to file upload
        fileInputRef.current?.click();
      }
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      // Fallback to file upload
      fileInputRef.current?.click();
    } finally {
      // Always stop stream tracks to prevent leaking active screen capture
      stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClear?.();
  };

  return (
    <div className="space-y-4">
      <Label>Captura de pantalla (opcional)</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCapture}
          className="flex-1"
        >
          <Camera className="mr-2 h-4 w-4" />
          Capturar pantalla
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1"
        >
          <Upload className="mr-2 h-4 w-4" />
          Subir archivo
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {previewUrl && (
        <div className="relative border rounded-lg p-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute top-2 right-2 z-10"
          >
            <X className="h-4 w-4" />
          </Button>
          <img
            src={previewUrl}
            alt="Screenshot preview"
            className="w-full h-auto rounded-md"
          />
        </div>
      )}
    </div>
  );
}
