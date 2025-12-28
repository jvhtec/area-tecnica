import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ViewFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: any;
  url: string;
}

export const ViewFileDialog = ({ open, onOpenChange, file, url }: ViewFileDialogProps) => {
  const isImage = file?.file_type.startsWith('image/');
  const isPDF = file?.file_type === 'application/pdf';
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!open || !isImage || !url) {
      setImageDimensions(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const width = img.naturalWidth || 0;
      const height = img.naturalHeight || 0;
      setImageDimensions(width > 0 && height > 0 ? { width, height } : null);
    };
    img.onerror = () => {
      if (cancelled) return;
      setImageDimensions(null);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [open, isImage, url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 min-h-0 mt-6">
          {isImage && (
            <img
              src={url}
              alt={file?.file_name}
              width={imageDimensions?.width}
              height={imageDimensions?.height}
              loading="lazy"
              decoding="async"
              className="max-w-full max-h-[70vh] object-contain mx-auto"
            />
          )}
          {isPDF && (
            <iframe
              src={`${url}#toolbar=0`}
              className="w-full h-[70vh] border-0"
              title={file?.file_name}
            />
          )}
          {!isImage && !isPDF && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                La vista previa no está disponible para este tipo de archivo.
                Por favor descargue el archivo para verlo.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
